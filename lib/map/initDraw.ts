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
    try {
      console.log("[DRAW_HYDRATE] replaceWithMultiPolygon called", {
        polygonCount: geometry.coordinates.length,
      });

      console.log("[DRAW_HYDRATE] before draw.clear()");
      draw.clear();

      const features = geometry.coordinates.map((rings, polygonIndex) => {
        const featureId = draw.getFeatureId();
        const feature = toPolygonFeature(featureId, rings as [number, number][][]);

        console.log("[DRAW_HYDRATE] generated TerraDraw feature", {
          polygonIndex,
          feature,
          featureId: feature.id,
          mode: feature.properties.mode,
          geometryType: feature.geometry.type,
          ringCount: rings.length,
          coordinateCountByRing: rings.map((ring) => ring.length),
        });

        return feature;
      });

      if (features.length > 0) {
        console.log("[DRAW_HYDRATE] before draw.addFeatures(...)", {
          featureCount: features.length,
          featureIds: features.map((feature) => feature.id),
        });
        const addResults = draw.addFeatures(features);
        console.log("[DRAW_HYDRATE] draw.addFeatures(...) result", { addResults });
      }

      const snapshot = draw.getSnapshot();
      console.log("[DRAW_HYDRATE] draw snapshot immediately after hydration", {
        snapshotFeatureCount: snapshot.length,
        polygonFeatureCount: snapshot.filter((feature) => feature.geometry.type === "Polygon").length,
        allGeometryTypes: snapshot.map((feature) => feature.geometry.type),
      });

      draw.setMode("select");
      console.log("[DRAW_HYDRATE] active mode after hydration", { mode: draw.getMode() });
    } catch (error) {
      console.error("[DRAW_HYDRATE] replaceWithMultiPolygon exception", error);
      throw error;
    }
  };

  const clearAll = () => {
    draw.clear();
  };

  const cleanup = () => {
    draw.stop();
  };

  return { draw, setMode, subscribeToChanges, getPolygons, replaceWithMultiPolygon, clearAll, cleanup };
}
