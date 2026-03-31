"use client";

import { useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import { EditorMode } from "../lib/geometry/types";
import { fitMapToMultiPolygon, initMap } from "../lib/map/initMap";
import { initDrawSeam, DrawSeam } from "../lib/map/initDraw";

type CursorCoords = { lng: number; lat: number };

type MapCanvasProps = {
  mode: EditorMode;
  importedGeometry: GeoJSON.MultiPolygon | null;
  importRevision: number;
  clearRevision: number;
  deleteSelectedRevision: number;
  onDrawPolygonsChange: (polygons: GeoJSON.Polygon[]) => void;
};

export function MapCanvas({
  mode,
  importedGeometry,
  importRevision,
  clearRevision,
  deleteSelectedRevision,
  onDrawPolygonsChange,
}: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<DrawSeam | null>(null);
  const modeRef = useRef<EditorMode>(mode);
  const importedGeometryRef = useRef<GeoJSON.MultiPolygon | null>(importedGeometry);
  const importRevisionRef = useRef<number>(importRevision);
  const appliedImportRevisionRef = useRef<number>(0);
  const appliedClearRevisionRef = useRef<number>(0);
  const appliedDeleteRevisionRef = useRef<number>(0);
  const [cursor, setCursor] = useState<CursorCoords>();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    importedGeometryRef.current = importedGeometry;
  }, [importedGeometry]);

  useEffect(() => {
    importRevisionRef.current = importRevision;
  }, [importRevision]);

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

    let unsubscribeDrawChanges: (() => void) | null = null;

    const startDrawWhenStyleReady = () => {
      if (drawRef.current) {
        return;
      }

      const draw = initDrawSeam(map);
      drawRef.current = draw;
      draw.setMode(modeRef.current);

      unsubscribeDrawChanges = draw.subscribeToChanges(() => {
        onDrawPolygonsChange(draw.getPolygons());
      });

      const currentImported = importedGeometryRef.current;
      if (currentImported && importRevisionRef.current > 0) {
        appliedImportRevisionRef.current = importRevisionRef.current;
        draw.replaceWithMultiPolygon(currentImported);
        fitMapToMultiPolygon(map, currentImported);
        onDrawPolygonsChange(draw.getPolygons());
      }
    };

    if (map.isStyleLoaded()) {
      startDrawWhenStyleReady();
    } else {
      map.on("load", startDrawWhenStyleReady);
    }

    const resetButton = document.createElement("button");
    resetButton.className = "map-reset-button";
    resetButton.type = "button";
    resetButton.textContent = "Reset View";
    resetButton.addEventListener("click", resetView);
    map.getContainer().appendChild(resetButton);

    mapRef.current = map;

    return () => {
      map.off("load", startDrawWhenStyleReady);
      if (unsubscribeDrawChanges) {
        unsubscribeDrawChanges();
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
    if (!drawRef.current || !importedGeometry) {
      return;
    }

    if (importRevision <= appliedImportRevisionRef.current) {
      return;
    }

    appliedImportRevisionRef.current = importRevision;
    drawRef.current.replaceWithMultiPolygon(importedGeometry);
    const map = mapRef.current;
    if (map) {
      fitMapToMultiPolygon(map, importedGeometry);
    }
    onDrawPolygonsChange(drawRef.current.getPolygons());
  }, [importRevision, importedGeometry, onDrawPolygonsChange]);

  useEffect(() => {
    if (!drawRef.current || clearRevision <= appliedClearRevisionRef.current) {
      return;
    }

    appliedClearRevisionRef.current = clearRevision;
    drawRef.current.clearAll();
    onDrawPolygonsChange([]);
  }, [clearRevision, onDrawPolygonsChange]);

  useEffect(() => {
    if (!drawRef.current || deleteSelectedRevision <= appliedDeleteRevisionRef.current) {
      return;
    }

    appliedDeleteRevisionRef.current = deleteSelectedRevision;
    drawRef.current.deleteSelected();
    onDrawPolygonsChange(drawRef.current.getPolygons());
  }, [deleteSelectedRevision, onDrawPolygonsChange]);

  return (
    <div className="map-canvas-shell">
      <div ref={mapContainerRef} className="map-canvas" aria-label="Live MapLibre map" />
      <div className="map-cursor-readout" aria-live="polite">
        {cursor ? `Lng ${cursor.lng.toFixed(6)} | Lat ${cursor.lat.toFixed(6)}` : "Move cursor over map"}
      </div>
    </div>
  );
}
