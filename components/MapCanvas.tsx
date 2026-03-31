"use client";

import { useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import { EditorMode } from "../lib/geometry/types";
import { fitMapToMultiPolygon, initMap } from "../lib/map/initMap";
import { initDrawSeam, DrawSeam } from "../lib/map/initDraw";
import { DEFAULT_MAP_STYLE, HAS_MAPBOX_TOKEN, MapStyleKey } from "../lib/map/styles";

type CursorCoords = { lng: number; lat: number };

type MapCanvasProps = {
  mode: EditorMode;
  importedGeometry: GeoJSON.MultiPolygon | null;
  syncRevision: number;
  onDrawPolygonsChange: (polygons: GeoJSON.Polygon[]) => void;
};

export function MapCanvas({ mode, importedGeometry, syncRevision, onDrawPolygonsChange }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<DrawSeam | null>(null);
  const modeRef = useRef<EditorMode>(mode);
  const importedGeometryRef = useRef<GeoJSON.MultiPolygon | null>(importedGeometry);
  const syncRevisionRef = useRef<number>(syncRevision);
  const appliedSyncRevisionRef = useRef<number>(0);
  const isImportHydratingRef = useRef<boolean>(false);
  const [cursor, setCursor] = useState<CursorCoords>();
  const [mapStyle, setMapStyle] = useState<MapStyleKey>(DEFAULT_MAP_STYLE);
  const mapStyleRef = useRef<MapStyleKey>(DEFAULT_MAP_STYLE);
  const setMapStyleRef = useRef<((styleKey: MapStyleKey) => Promise<void>) | null>(null);
  const unsubscribeDrawChangesRef = useRef<(() => void) | null>(null);
  const reinitializeDrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    importedGeometryRef.current = importedGeometry;
  }, [importedGeometry]);

  useEffect(() => {
    syncRevisionRef.current = syncRevision;
  }, [syncRevision]);

  useEffect(() => {
    mapStyleRef.current = mapStyle;
  }, [mapStyle]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const { map, setMapStyle: setMapStyleOnMap, cleanup: mapCleanup, resetView } = initMap({
      container: mapContainerRef.current,
      styleKey: mapStyleRef.current,
      onCursorMove: (coords) => {
        setCursor(coords);
      },
    });
    setMapStyleRef.current = setMapStyleOnMap;

    const createDrawForLoadedStyle = () => {
      if (unsubscribeDrawChangesRef.current) {
        unsubscribeDrawChangesRef.current();
        unsubscribeDrawChangesRef.current = null;
      }
      if (drawRef.current) {
        drawRef.current.cleanup();
        drawRef.current = null;
      }
      const draw = initDrawSeam(map);
      drawRef.current = draw;
      draw.setMode(modeRef.current);

      unsubscribeDrawChangesRef.current = draw.subscribeToChanges(() => {
        const polygons = draw.getPolygons();
        if (isImportHydratingRef.current && polygons.length === 0) {
          return;
        }
        onDrawPolygonsChange(polygons);
      });

      const currentImported = importedGeometryRef.current;
      if (currentImported) {
        if (syncRevisionRef.current > 0) {
          appliedSyncRevisionRef.current = syncRevisionRef.current;
        }
        try {
          isImportHydratingRef.current = true;
          const hydratedPolygons = draw.replaceWithMultiPolygon(currentImported);
          if (hydratedPolygons.length > 0) {
            onDrawPolygonsChange(hydratedPolygons);
          }
        } catch (error) {
          console.error("[DRAW_HYDRATE] replaceWithMultiPolygon failed in style-ready path", error);
        } finally {
          isImportHydratingRef.current = false;
        }
        fitMapToMultiPolygon(map, currentImported);
      }
    };
    reinitializeDrawRef.current = createDrawForLoadedStyle;

    if (map.isStyleLoaded()) {
      createDrawForLoadedStyle();
    } else {
      map.on("load", createDrawForLoadedStyle);
    }

    const resetButton = document.createElement("button");
    resetButton.className = "map-reset-button";
    resetButton.type = "button";
    resetButton.textContent = "Reset View";
    resetButton.addEventListener("click", resetView);
    map.getContainer().appendChild(resetButton);

    mapRef.current = map;

    return () => {
      map.off("load", createDrawForLoadedStyle);
      if (unsubscribeDrawChangesRef.current) {
        unsubscribeDrawChangesRef.current();
        unsubscribeDrawChangesRef.current = null;
      }
      resetButton.removeEventListener("click", resetView);
      resetButton.remove();
      if (drawRef.current) {
        drawRef.current.cleanup();
      }
      drawRef.current = null;
      mapRef.current = null;
      setMapStyleRef.current = null;
      reinitializeDrawRef.current = null;
      mapCleanup();
    };
  }, [onDrawPolygonsChange]);

  useEffect(() => {
    if (!drawRef.current) {
      return;
    }

    drawRef.current.setMode(mode);

    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (mode === "select") {
      map.dragPan.enable();
    } else {
      map.dragPan.disable();
    }
  }, [mode]);

  useEffect(() => {
    if (!drawRef.current) {
      return;
    }

    if (syncRevision <= appliedSyncRevisionRef.current) {
      return;
    }

    appliedSyncRevisionRef.current = syncRevision;

    if (!importedGeometry) {
      drawRef.current.clearAll();
      onDrawPolygonsChange([]);
      return;
    }

    try {
      isImportHydratingRef.current = true;
      const hydratedPolygons = drawRef.current.replaceWithMultiPolygon(importedGeometry);
      if (hydratedPolygons.length > 0) {
        onDrawPolygonsChange(hydratedPolygons);
      }
    } catch (error) {
      console.error("[DRAW_HYDRATE] replaceWithMultiPolygon failed in import sync effect", error);
    } finally {
      isImportHydratingRef.current = false;
    }
    const map = mapRef.current;
    if (map) {
      fitMapToMultiPolygon(map, importedGeometry);
    }
  }, [syncRevision, importedGeometry, onDrawPolygonsChange]);

  const handleStyleChange = async (nextStyle: MapStyleKey) => {
    if (!HAS_MAPBOX_TOKEN) {
      return;
    }

    if (nextStyle === mapStyleRef.current) {
      return;
    }

    const map = mapRef.current;
    const setMapStyleOnMap = setMapStyleRef.current;
    if (!map || !setMapStyleOnMap) {
      return;
    }

    setMapStyle(nextStyle);

    await setMapStyleOnMap(nextStyle);
    reinitializeDrawRef.current?.();
  };

  return (
    <div className="map-canvas-shell">
      <div ref={mapContainerRef} className="map-canvas" aria-label="Live MapLibre map" />
      {HAS_MAPBOX_TOKEN ? (
        <div className="map-style-toggle" role="group" aria-label="Map style">
          <button
            type="button"
            className={mapStyle === "streets" ? "map-style-button active" : "map-style-button"}
            onClick={() => void handleStyleChange("streets")}
          >
            Streets
          </button>
          <button
            type="button"
            className={mapStyle === "satellite" ? "map-style-button active" : "map-style-button"}
            onClick={() => void handleStyleChange("satellite")}
          >
            Satellite
          </button>
        </div>
      ) : (
        <div className="map-style-fallback-notice">Default map mode (set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for styles).</div>
      )}
      <div className="map-cursor-readout" aria-live="polite">
        {cursor ? `Lng ${cursor.lng.toFixed(6)} | Lat ${cursor.lat.toFixed(6)}` : "Move cursor over map"}
      </div>
    </div>
  );
}
