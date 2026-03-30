"use client";

import { useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import { EditorMode } from "../lib/geometry/types";
import { initMap } from "../lib/map/initMap";
import { initDrawSeam, DrawSeam } from "../lib/map/initDraw";

type CursorCoords = { lng: number; lat: number };

type MapCanvasProps = {
  mode: EditorMode;
  importedGeometry: GeoJSON.MultiPolygon | null;
  onCursorChange?: (coords: CursorCoords | undefined) => void;
  onDrawPolygonsChange: (polygons: GeoJSON.Polygon[]) => void;
};

export function MapCanvas({ mode, importedGeometry, onCursorChange, onDrawPolygonsChange }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<DrawSeam | null>(null);
  const [cursor, setCursor] = useState<CursorCoords>();
  const importedHashRef = useRef<string>("none");

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const { map, cleanup: mapCleanup, resetView } = initMap({
      container: mapContainerRef.current,
      onCursorMove: (coords) => {
        setCursor(coords);
        onCursorChange?.(coords);
      },
    });

    const draw = initDrawSeam(map);
    drawRef.current = draw;

    const unsubscribe = draw.subscribeToChanges(() => {
      onDrawPolygonsChange(draw.getPolygons());
    });

    const resetButton = document.createElement("button");
    resetButton.className = "map-reset-button";
    resetButton.type = "button";
    resetButton.textContent = "Reset View";
    resetButton.addEventListener("click", resetView);
    map.getContainer().appendChild(resetButton);

    mapRef.current = map;

    return () => {
      unsubscribe();
      resetButton.removeEventListener("click", resetView);
      resetButton.remove();
      onCursorChange?.(undefined);
      draw.cleanup();
      drawRef.current = null;
      mapRef.current = null;
      mapCleanup();
    };
  }, [onCursorChange, onDrawPolygonsChange]);

  useEffect(() => {
    if (!drawRef.current) {
      return;
    }

    drawRef.current.setMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!drawRef.current || !importedGeometry) {
      return;
    }

    const nextHash = JSON.stringify(importedGeometry.coordinates);
    if (nextHash === importedHashRef.current) {
      return;
    }

    importedHashRef.current = nextHash;
    drawRef.current.replaceWithMultiPolygon(importedGeometry);
    onDrawPolygonsChange(drawRef.current.getPolygons());
  }, [importedGeometry, onDrawPolygonsChange]);

  return (
    <div className="map-canvas-shell">
      <div ref={mapContainerRef} className="map-canvas" aria-label="Live MapLibre map" />
      <div className="map-cursor-readout" aria-live="polite">
        {cursor ? `Lng ${cursor.lng.toFixed(6)} | Lat ${cursor.lat.toFixed(6)}` : "Move cursor over map"}
      </div>
    </div>
  );
}
