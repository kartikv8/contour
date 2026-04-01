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
  subscribeToSelection: (handlers: { onSelect?: (id: string) => void; onDeselect?: (id: string) => void }) => () => void;
  getPolygonFeatures: () => Array<{ id: string; polygon: Polygon }>;
  replaceWithMultiPolygon: (geometry: GeoJSON.MultiPolygon) => Array<{ id: string; polygon: Polygon }>;
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

function toShapeId(featureId: string | number): string {
  return String(featureId);
}

export function initDrawSeam(map: Map): DrawSeam {
  const adapter = new TerraDrawMapLibreGLAdapter({ map });

  const draw = new TerraDraw({
    adapter,
    modes: [
      new TerraDrawSelectMode({
        flags: {
          polygon: {
            feature: {
              draggable: false,
              rotateable: false,
              scaleable: false,
              selfIntersectable: false,
              coordinates: {
                draggable: true,
                midpoints: { draggable: true },
              },
            },
          },
        },
      }),
      new TerraDrawPolygonMode(),
      new TerraDrawRectangleMode(),
    ],
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

  const subscribeToSelection = (handlers: {
    onSelect?: (id: string) => void;
    onDeselect?: (id: string) => void;
  }): (() => void) => {
    const selectListener = (id: string | number) => {
      handlers.onSelect?.(toShapeId(id));
    };
    const deselectListener = (id: string | number) => {
      handlers.onDeselect?.(toShapeId(id));
    };

    draw.on("select", selectListener);
    draw.on("deselect", deselectListener);

    return () => {
      draw.off("select", selectListener);
      draw.off("deselect", deselectListener);
    };
  };

  const getPolygonFeatures = (): Array<{ id: string; polygon: Polygon }> => {
    const snapshot = draw.getSnapshot();

    return snapshot
      .filter((feature) => feature.geometry.type === "Polygon" && feature.id !== undefined)
      .map((feature) => ({ id: toShapeId(feature.id as string | number), polygon: feature.geometry as Polygon }));
  };

  const replaceWithMultiPolygon = (geometry: GeoJSON.MultiPolygon): Array<{ id: string; polygon: Polygon }> => {
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
    return getPolygonFeatures();
  };

  const clearAll = () => {
    draw.clear();
  };

  const cleanup = () => {
    draw.stop();
  };

  return {
    draw,
    setMode,
    subscribeToChanges,
    subscribeToSelection,
    getPolygonFeatures,
    replaceWithMultiPolygon,
    clearAll,
    cleanup,
  };
}
