"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { OverlapPair } from "../lib/geometry/overlap";
import { EditorMode } from "../lib/geometry/types";
import { fitMapToMultiPolygon, initMap } from "../lib/map/initMap";
import { initDrawSeam, DrawSeam } from "../lib/map/initDraw";

type CursorCoords = { lng: number; lat: number };

const OVERLAP_SOURCE_ID = "overlap-regions";
const OVERLAP_FILL_LAYER_ID = "overlap-regions-fill";
const OVERLAP_LINE_LAYER_ID = "overlap-regions-line";
const HIGHLIGHTED_SHAPES_SOURCE_ID = "highlighted-shapes";
const HIGHLIGHTED_SHAPES_LINE_LAYER_ID = "highlighted-shapes-line";

type MapCanvasProps = {
  mode: EditorMode;
  importedGeometry: GeoJSON.MultiPolygon | null;
  syncRevision: number;
  onDrawPolygonsChange: (shapes: Array<{ id: string; polygon: GeoJSON.Polygon }>) => void;
  onActiveShapeChange?: (shapeId: string | null) => void;
  overlapPairs: OverlapPair[];
  focusedOverlapGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  focusedOverlapPairKey: string | null;
  focusedOverlapNonce: number;
  highlightedShapePolygons: GeoJSON.Polygon[];
};

function toEmptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function toMultiPolygonLikeGeometry(geometry: Polygon | MultiPolygon): GeoJSON.MultiPolygon {
  if (geometry.type === "MultiPolygon") {
    return geometry;
  }

  return {
    type: "MultiPolygon",
    coordinates: [geometry.coordinates],
  };
}

function ensureOverlapLayers(map: Map) {
  if (!map.getSource(OVERLAP_SOURCE_ID)) {
    map.addSource(OVERLAP_SOURCE_ID, {
      type: "geojson",
      data: toEmptyFeatureCollection(),
    });
  }

  if (!map.getLayer(OVERLAP_FILL_LAYER_ID)) {
    map.addLayer({
      id: OVERLAP_FILL_LAYER_ID,
      type: "fill",
      source: OVERLAP_SOURCE_ID,
      paint: {
        "fill-color": "#dc2626",
        "fill-opacity": ["case", ["==", ["get", "active"], true], 0.45, 0.22],
      },
    });
  }

  if (!map.getLayer(OVERLAP_LINE_LAYER_ID)) {
    map.addLayer({
      id: OVERLAP_LINE_LAYER_ID,
      type: "line",
      source: OVERLAP_SOURCE_ID,
      paint: {
        "line-color": "#b91c1c",
        "line-width": ["case", ["==", ["get", "active"], true], 3, 2],
      },
    });
  }

  if (!map.getSource(HIGHLIGHTED_SHAPES_SOURCE_ID)) {
    map.addSource(HIGHLIGHTED_SHAPES_SOURCE_ID, {
      type: "geojson",
      data: toEmptyFeatureCollection(),
    });
  }

  if (!map.getLayer(HIGHLIGHTED_SHAPES_LINE_LAYER_ID)) {
    map.addLayer({
      id: HIGHLIGHTED_SHAPES_LINE_LAYER_ID,
      type: "line",
      source: HIGHLIGHTED_SHAPES_SOURCE_ID,
      paint: {
        "line-color": "#f59e0b",
        "line-width": 2,
      },
    });
  }
}

export function MapCanvas({
  mode,
  importedGeometry,
  syncRevision,
  onDrawPolygonsChange,
  onActiveShapeChange,
  overlapPairs,
  focusedOverlapGeometry,
  focusedOverlapPairKey,
  focusedOverlapNonce,
  highlightedShapePolygons,
}: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<DrawSeam | null>(null);
  const modeRef = useRef<EditorMode>(mode);
  const importedGeometryRef = useRef<GeoJSON.MultiPolygon | null>(importedGeometry);
  const syncRevisionRef = useRef<number>(syncRevision);
  const appliedSyncRevisionRef = useRef<number>(0);
  const isImportHydratingRef = useRef<boolean>(false);
  const [cursor, setCursor] = useState<CursorCoords>();
  const unsubscribeDrawChangesRef = useRef<(() => void) | null>(null);
  const unsubscribeSelectionRef = useRef<(() => void) | null>(null);

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
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const { map, cleanup: mapCleanup, resetView } = initMap({
      container: mapContainerRef.current,
      onCursorMove: (coords) => {
        setCursor(coords);
      },
    });

    const createDrawForLoadedStyle = () => {
      if (unsubscribeDrawChangesRef.current) {
        unsubscribeDrawChangesRef.current();
        unsubscribeDrawChangesRef.current = null;
      }
      if (unsubscribeSelectionRef.current) {
        unsubscribeSelectionRef.current();
        unsubscribeSelectionRef.current = null;
      }
      if (drawRef.current) {
        drawRef.current.cleanup();
        drawRef.current = null;
      }
      const draw = initDrawSeam(map);
      drawRef.current = draw;
      draw.setMode(modeRef.current);

      unsubscribeDrawChangesRef.current = draw.subscribeToChanges(() => {
        const polygons = draw.getPolygonFeatures();
        if (isImportHydratingRef.current && polygons.length === 0) {
          return;
        }
        onDrawPolygonsChange(polygons);
      });
      unsubscribeSelectionRef.current = draw.subscribeToSelection({
        onSelect: (shapeId) => {
          onActiveShapeChange?.(shapeId);
        },
        onDeselect: () => {
          onActiveShapeChange?.(null);
        },
      });

      ensureOverlapLayers(map);

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
      if (unsubscribeSelectionRef.current) {
        unsubscribeSelectionRef.current();
        unsubscribeSelectionRef.current = null;
      }
      resetButton.removeEventListener("click", resetView);
      resetButton.remove();
      if (drawRef.current) {
        drawRef.current.cleanup();
      }
      drawRef.current = null;
      mapRef.current = null;
      mapCleanup();
    };
  }, [onDrawPolygonsChange, onActiveShapeChange]);

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
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureOverlapLayers(map);

    const source = map.getSource(OVERLAP_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    const features: Feature<Polygon | MultiPolygon>[] = overlapPairs.map((pair) => ({
      type: "Feature",
      properties: { pairKey: pair.pairKey, active: pair.pairKey === focusedOverlapPairKey },
      geometry: pair.geometry,
    }));

    source.setData({ type: "FeatureCollection", features });
  }, [overlapPairs, focusedOverlapPairKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureOverlapLayers(map);

    const source = map.getSource(HIGHLIGHTED_SHAPES_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    const features: Feature<Polygon>[] = highlightedShapePolygons.map((shapePolygon) => ({
      type: "Feature",
      properties: {},
      geometry: shapePolygon,
    }));

    source.setData({ type: "FeatureCollection", features });
  }, [highlightedShapePolygons]);

  useEffect(() => {
    if (!focusedOverlapGeometry || focusedOverlapNonce === 0) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    fitMapToMultiPolygon(map, toMultiPolygonLikeGeometry(focusedOverlapGeometry));
  }, [focusedOverlapGeometry, focusedOverlapNonce]);

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
      onActiveShapeChange?.(null);
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
  }, [syncRevision, importedGeometry, onDrawPolygonsChange, onActiveShapeChange]);

  return (
    <div className="map-canvas-shell">
      <div ref={mapContainerRef} className="map-canvas" aria-label="Live MapLibre map" />
      <div className="map-cursor-readout" aria-live="polite">
        {cursor ? `Lng ${cursor.lng.toFixed(6)} | Lat ${cursor.lat.toFixed(6)}` : "Move cursor over map"}
      </div>
    </div>
  );
}
