"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { LngLat, Map as MapLibreMap } from "maplibre-gl";
import type { TerraDraw } from "terra-draw";
import { addMapControls, initMap, resetMapView } from "@/lib/geofence/map";
import { extractActiveGeometry, initTerraDraw, setDrawMode, subscribeToDrawChanges, syncGeometryToDraw } from "@/lib/geofence/draw";
import type { DrawMode, SupportedGeofenceGeometry } from "@/lib/geofence/types";

type MapCanvasProps = {
  activeMode: DrawMode;
  geometry: SupportedGeofenceGeometry | null;
  onGeometryChange: (geometry: SupportedGeofenceGeometry | null) => void;
};

export function MapCanvas({ activeMode, geometry, onGeometryChange }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const [cursor, setCursor] = useState<LngLat | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = initMap(containerRef.current);
    mapRef.current = map;
    let unsubscribe: () => void = () => {};

    map.on("load", () => {
      addMapControls(map);
      const draw = initTerraDraw(map);
      drawRef.current = draw;

      unsubscribe = subscribeToDrawChanges(draw, () => {
        onGeometryChange(extractActiveGeometry(draw));
      });
    });

    map.on("mousemove", (event) => {
      setCursor(event.lngLat);
    });

    return () => {
      unsubscribe();
      drawRef.current?.stop();
      mapRef.current?.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [onGeometryChange]);

  useEffect(() => {
    if (!drawRef.current) {
      return;
    }

    setDrawMode(drawRef.current, activeMode);
  }, [activeMode]);

  useEffect(() => {
    if (!drawRef.current) {
      return;
    }

    syncGeometryToDraw(drawRef.current, geometry);
  }, [geometry]);

  return (
    <section style={wrapperStyle}>
      <div style={toolbarStyle}>
        <button type="button" onClick={() => mapRef.current && resetMapView(mapRef.current)}>
          Fit / Reset View
        </button>
        <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: "0.85rem" }}>
          {cursor ? `Lng ${cursor.lng.toFixed(5)} | Lat ${cursor.lat.toFixed(5)}` : "Move cursor over map"}
        </span>
      </div>
      <div ref={containerRef} style={mapStyle} aria-label="MapLibre map canvas" />
    </section>
  );
}

const wrapperStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  overflow: "hidden",
  background: "#fff",
  minHeight: 520,
  display: "grid",
  gridTemplateRows: "auto 1fr"
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
  borderBottom: "1px solid #e5e7eb",
  padding: "0.5rem 0.75rem"
};

const mapStyle: CSSProperties = {
  width: "100%",
  minHeight: 480,
  height: "100%"
};
