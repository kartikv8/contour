import type { Polygon } from "geojson";
import type { Map } from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { EditorMode } from "../geometry/types";

export type DrawSeam = {
  draw: TerraDraw;
  setMode: (mode: EditorMode) => void;
  subscribeToChanges: (onChange: () => void) => () => void;
  getPolygons: () => Polygon[];
  replaceWithMultiPolygon: (geometry: GeoJSON.MultiPolygon) => void;
  clearAll: () => void;
  cleanup: () => void;
};

function toPolygonFeature(id: string | number, rings: [number, number][][]): GeoJSONStoreFeatures {
  return {
    type: "Feature",
    id,
    properties: { mode: "polygon" },
    geometry: {
      type: "Polygon",
      coordinates: rings,
    },
  } as GeoJSONStoreFeatures;
}

export function initDrawSeam(map: Map): DrawSeam {
  const adapter = new TerraDrawMapLibreGLAdapter({ map });

  const draw = new TerraDraw({
    adapter,
    modes: [new TerraDrawSelectMode(), new TerraDrawPolygonMode(), new TerraDrawRectangleMode()],
  });

  draw.start();
  draw.setMode("select");

  const setMode = (mode: EditorMode) => {
    draw.setMode(mode);
  };

  const subscribeToChanges = (onChange: () => void): (() => void) => {
    const listener = () => {
      onChange();
    };

    draw.on("change", listener);
    draw.on("finish", listener);

    return () => {
      draw.off("change", listener);
      draw.off("finish", listener);
    };
  };

  const getPolygons = (): Polygon[] => {
    const snapshot = draw.getSnapshot();

    return snapshot
      .filter((feature) => feature.geometry.type === "Polygon")
      .map((feature) => feature.geometry as Polygon);
  };

  const replaceWithMultiPolygon = (geometry: GeoJSON.MultiPolygon) => {
    draw.clear();
    const features = geometry.coordinates.map((rings) => toPolygonFeature(draw.getFeatureId(), rings as [number, number][][]));
    if (features.length > 0) {
      draw.addFeatures(features);
    }
    draw.setMode("select");
  };

  const clearAll = () => {
    draw.clear();
  };

  const cleanup = () => {
    draw.stop();
  };

  return { draw, setMode, subscribeToChanges, getPolygons, replaceWithMultiPolygon, clearAll, cleanup };
}
