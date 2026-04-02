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

const APP_SHAPE_ID_PROPERTY = "appShapeId";

export type DrawSeam = {
  draw: TerraDraw;
  setMode: (mode: EditorMode) => void;
  subscribeToChanges: (onChange: () => void) => () => void;
  subscribeToSelection: (handlers: { onSelect?: (id: string) => void; onDeselect?: (id: string) => void }) => () => void;
  getPolygonFeatures: () => Array<{ id: string; polygon: Polygon }>;
  replaceWithShapes: (shapes: Array<{ id: string; polygon: Polygon }>) => Array<{ id: string; polygon: Polygon }>;
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

function toPolygonFeature(id: string | number, appShapeId: string, rings: [number, number][][]): GeoJSONStoreFeatures {
  return {
    type: "Feature",
    id,
    properties: { mode: "polygon", [APP_SHAPE_ID_PROPERTY]: appShapeId },
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
  const terraToAppId = new globalThis.Map<string, string>();
  let generatedIdCounter = 0;

  const createAppOwnedId = () => {
    generatedIdCounter += 1;
    return `drawn-${Date.now()}-${generatedIdCounter}`;
  };

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
      const terraId = toShapeId(id);
      const appId = terraToAppId.get(terraId);
      handlers.onSelect?.(appId ?? terraId);
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
      .map((feature) => {
        const terraId = toShapeId(feature.id as string | number);
        const rawPropertyId =
          feature.properties && typeof feature.properties[APP_SHAPE_ID_PROPERTY] === "string"
            ? (feature.properties[APP_SHAPE_ID_PROPERTY] as string)
            : null;
        const appShapeId = rawPropertyId && rawPropertyId.trim().length > 0 ? rawPropertyId.trim() : createAppOwnedId();

        terraToAppId.set(terraId, appShapeId);

        if (!rawPropertyId || rawPropertyId.trim() !== appShapeId) {
          draw.updateFeatureProperties(feature.id as string | number, { [APP_SHAPE_ID_PROPERTY]: appShapeId });
        }

        return { id: appShapeId, polygon: feature.geometry as Polygon };
      });
  };

  const replaceWithShapes = (shapes: Array<{ id: string; polygon: Polygon }>): Array<{ id: string; polygon: Polygon }> => {
    draw.clear();
    terraToAppId.clear();

    const features = shapes.map((shape) =>
      toPolygonFeature(draw.getFeatureId(), shape.id, toTerraDrawRings(shape.polygon.coordinates as [number, number][][])),
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
    replaceWithShapes,
    clearAll,
    cleanup,
  };
}
