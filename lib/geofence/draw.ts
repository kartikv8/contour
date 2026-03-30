import { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Feature } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { DrawMode, SupportedGeofenceGeometry } from "@/lib/geofence/types";

type TerraDrawWithEvents = TerraDraw & {
  on?: (eventName: string, callback: () => void) => void;
  off?: (eventName: string, callback: () => void) => void;
  clear?: () => void;
  addFeatures?: (features: Feature[]) => void;
};

const DRAW_MODES: DrawMode[] = ["select", "polygon", "rectangle"];

export function initTerraDraw(map: MapLibreMap): TerraDraw {
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({
      map,
      coordinatePrecision: 9
    }),
    modes: [
      new TerraDrawSelectMode(),
      new TerraDrawPolygonMode(),
      new TerraDrawRectangleMode()
    ]
  });

  draw.start();
  draw.setMode("select");
  return draw;
}

export function getEnabledDrawModes(): DrawMode[] {
  return DRAW_MODES;
}

export function setDrawMode(draw: TerraDraw, mode: DrawMode) {
  draw.setMode(mode);
}

export function subscribeToDrawChanges(draw: TerraDraw, onChange: () => void): () => void {
  const instance = draw as TerraDrawWithEvents;
  if (!instance.on) {
    return () => undefined;
  }

  instance.on("change", onChange);
  instance.on("finish", onChange);

  return () => {
    instance.off?.("change", onChange);
    instance.off?.("finish", onChange);
  };
}

function isSupportedGeometryFeature(feature: Feature): feature is Feature<SupportedGeofenceGeometry> {
  return feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
}

export function extractActiveGeometry(draw: TerraDraw): SupportedGeofenceGeometry | null {
  const snapshot = draw.getSnapshot();
  const geometries = snapshot.filter(isSupportedGeometryFeature);
  const latest = geometries[geometries.length - 1];
  return latest?.geometry ?? null;
}

export function syncGeometryToDraw(draw: TerraDraw, geometry: SupportedGeofenceGeometry | null) {
  const instance = draw as TerraDrawWithEvents;
  if (!instance.clear || !instance.addFeatures) {
    return;
  }

  instance.clear();

  if (!geometry) {
    return;
  }

  instance.addFeatures([{
    type: "Feature",
    properties: {},
    geometry
  }]);
}
