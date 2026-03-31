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
  replaceWithMultiPolygon: (geometry: GeoJSON.MultiPolygon) => Polygon[];
  clearAll: () => void;
  cleanup: () => void;
};

const TERRA_DRAW_COORDINATE_PRECISION = 9;

function roundCoordinate(value: number): number {
  const factor = 10 ** TERRA_DRAW_COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

function toTerraDrawRings(rings: [number, number][][]): [number, number][][] {
  return rings.map((ring) => ring.map(([lng, lat]) => [roundCoordinate(lng), roundCoordinate(lat)]));
}

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

  const replaceWithMultiPolygon = (geometry: GeoJSON.MultiPolygon): Polygon[] => {
    draw.clear();

    const features = geometry.coordinates.map((rings) =>
      toPolygonFeature(draw.getFeatureId(), toTerraDrawRings(rings as [number, number][][])),
    );

    if (features.length > 0) {
      const addResults = draw.addFeatures(features);
      const invalidResults = addResults.filter((result) => !result.valid);

      if (invalidResults.length > 0) {
        console.error("[DRAW_HYDRATE] TerraDraw rejected imported features", { invalidResults });
      }
    }

    draw.setMode("select");
    return getPolygons();
  };

  const clearAll = () => {
    draw.clear();
  };

  const cleanup = () => {
    draw.stop();
  };

  return { draw, setMode, subscribeToChanges, getPolygons, replaceWithMultiPolygon, clearAll, cleanup };
}
