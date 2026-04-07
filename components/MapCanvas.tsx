"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { OverlapPair } from "../lib/geometry/overlap";
import { EditorMode, ShapeRecord } from "../lib/geometry/types";
import { fitMapToMultiPolygon, initMap } from "../lib/map/initMap";
import { initDrawSeam, DrawSeam } from "../lib/map/initDraw";

type CursorCoords = { lng: number; lat: number };

const OVERLAP_SOURCE_ID = "overlap-regions";
const OVERLAP_FILL_LAYER_ID = "overlap-regions-fill";
const OVERLAP_LINE_LAYER_ID = "overlap-regions-line";
const HIGHLIGHTED_SHAPES_SOURCE_ID = "highlighted-shapes";
const HIGHLIGHTED_SHAPES_LINE_LAYER_ID = "highlighted-shapes-line";
const SHAPE_LABELS_SOURCE_ID = "shape-labels";
const SHAPE_LABELS_LAYER_ID = "shape-labels-layer";

type MapCanvasProps = {
  mode: EditorMode;
  importedShapes: Array<{ id: string; polygon: GeoJSON.Polygon }>;
  canonicalShapes: ShapeRecord[];
  activeShapeId: string | null;
  syncRevision: number;
  onDrawPolygonsChange: (
    shapes: Array<{ id: string; polygon: GeoJSON.Polygon }>,
    context?: { commitHistory?: boolean; source?: "change" | "finish" | "rehydrate" },
  ) => void;
  onActiveShapeChange?: (shapeId: string | null) => void;
  overlapPairs: OverlapPair[];
  focusedOverlapPairKey: string | null;
  mapFocusGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  mapFocusNonce: number;
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

function getRingCentroid(ring: [number, number][]): [number, number] | null {
  if (ring.length < 3) {
    return null;
  }

  let areaTerm = 0;
  let centroidXTerm = 0;
  let centroidYTerm = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    const cross = x1 * y2 - x2 * y1;
    areaTerm += cross;
    centroidXTerm += (x1 + x2) * cross;
    centroidYTerm += (y1 + y2) * cross;
  }

  if (Math.abs(areaTerm) < Number.EPSILON) {
    const uniquePoints = ring.slice(0, -1);
    if (uniquePoints.length === 0) {
      return null;
    }

    const [sumLng, sumLat] = uniquePoints.reduce<[number, number]>(
      (accumulator, [lng, lat]) => [accumulator[0] + lng, accumulator[1] + lat],
      [0, 0],
    );
    return [sumLng / uniquePoints.length, sumLat / uniquePoints.length];
  }

  return [centroidXTerm / (3 * areaTerm), centroidYTerm / (3 * areaTerm)];
}

function getRingBboxCenter(ring: [number, number][]): [number, number] | null {
  if (ring.length === 0) {
    return null;
  }

  let minLng = ring[0][0];
  let maxLng = ring[0][0];
  let minLat = ring[0][1];
  let maxLat = ring[0][1];

  ring.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

function getLabelPointForPolygon(polygon: GeoJSON.Polygon): [number, number] | null {
  const outerRing = polygon.coordinates[0] as [number, number][] | undefined;
  if (!outerRing || outerRing.length === 0) {
    return null;
  }

  const centroid = getRingCentroid(outerRing);
  if (centroid) {
    return centroid;
  }

  const bboxCenter = getRingBboxCenter(outerRing);
  if (bboxCenter) {
    return bboxCenter;
  }

  return outerRing[0] ?? null;
}

function ensureOverlapLayers(map: Map) {
  const overlapBeforeLayerId = (() => {
    const styleLayers = map.getStyle()?.layers ?? [];
    return styleLayers.find((layer) => /(?:terra|draw|td-)/i.test(layer.id) && (layer.type === "circle" || layer.type === "symbol"))
      ?.id;
  })();

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
    }, overlapBeforeLayerId);
  } else if (overlapBeforeLayerId) {
    map.moveLayer(OVERLAP_FILL_LAYER_ID, overlapBeforeLayerId);
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
    }, overlapBeforeLayerId);
  } else if (overlapBeforeLayerId) {
    map.moveLayer(OVERLAP_LINE_LAYER_ID, overlapBeforeLayerId);
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

function ensureShapeLabelLayers(map: Map) {
  if (!map.getSource(SHAPE_LABELS_SOURCE_ID)) {
    map.addSource(SHAPE_LABELS_SOURCE_ID, {
      type: "geojson",
      data: toEmptyFeatureCollection(),
    });
  }

  if (!map.getLayer(SHAPE_LABELS_LAYER_ID)) {
    map.addLayer({
      id: SHAPE_LABELS_LAYER_ID,
      type: "symbol",
      source: SHAPE_LABELS_SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 12,
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-offset": [0, 0],
        "text-anchor": "center",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.25,
        "text-halo-blur": 0.5,
      },
    });
  }
}

export function MapCanvas({
  mode,
  importedShapes,
  canonicalShapes,
  activeShapeId,
  syncRevision,
  onDrawPolygonsChange,
  onActiveShapeChange,
  overlapPairs,
  focusedOverlapPairKey,
  mapFocusGeometry,
  mapFocusNonce,
  highlightedShapePolygons,
}: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<DrawSeam | null>(null);
  const modeRef = useRef<EditorMode>(mode);
  const importedShapesRef = useRef<Array<{ id: string; polygon: GeoJSON.Polygon }>>(importedShapes);
  const syncRevisionRef = useRef<number>(syncRevision);
  const appliedSyncRevisionRef = useRef<number>(0);
  const isImportHydratingRef = useRef<boolean>(false);
  const labelFeatureCollectionRef = useRef<FeatureCollection>(toEmptyFeatureCollection());
  const overlapFeatureCollectionRef = useRef<FeatureCollection>(toEmptyFeatureCollection());
  const [cursor, setCursor] = useState<CursorCoords>();
  const unsubscribeDrawChangesRef = useRef<(() => void) | null>(null);
  const unsubscribeSelectionRef = useRef<(() => void) | null>(null);
  const labelFeatureCollection = useMemo<FeatureCollection>(() => {
    const features: Feature[] = canonicalShapes
      .map((shape) => {
        const label = shape.name.trim().length > 0 ? shape.name.trim() : "Unnamed shape";
        const labelPoint = getLabelPointForPolygon(shape.polygon);
        if (!labelPoint) {
          return null;
        }

        return {
          type: "Feature",
          properties: {
            shapeId: shape.id,
            label,
            active: shape.id === activeShapeId,
          },
          geometry: {
            type: "Point",
            coordinates: labelPoint,
          },
        } as Feature;
      })
      .filter((feature): feature is Feature => feature !== null);

    return { type: "FeatureCollection", features };
  }, [canonicalShapes, activeShapeId]);

  const overlapFeatureCollection = useMemo<FeatureCollection<Polygon | MultiPolygon>>(
    () => ({
      type: "FeatureCollection",
      features: overlapPairs.map((pair) => ({
        type: "Feature",
        properties: { pairKey: pair.pairKey, active: pair.pairKey === focusedOverlapPairKey },
        geometry: pair.geometry,
      })),
    }),
    [overlapPairs, focusedOverlapPairKey],
  );

  useEffect(() => {
    labelFeatureCollectionRef.current = labelFeatureCollection;
  }, [labelFeatureCollection]);

  useEffect(() => {
    overlapFeatureCollectionRef.current = overlapFeatureCollection;
  }, [overlapFeatureCollection]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    importedShapesRef.current = importedShapes;
  }, [importedShapes]);

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

      unsubscribeDrawChangesRef.current = draw.subscribeToChanges((eventType) => {
        const polygons = draw.getPolygonFeatures();
        if (isImportHydratingRef.current && polygons.length === 0) {
          return;
        }
        onDrawPolygonsChange(polygons, {
          commitHistory: eventType === "finish",
          source: eventType,
        });
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
      ensureShapeLabelLayers(map);

      const currentImported = importedShapesRef.current;
      if (currentImported.length > 0) {
        if (syncRevisionRef.current > 0) {
          appliedSyncRevisionRef.current = syncRevisionRef.current;
        }
        try {
          isImportHydratingRef.current = true;
          const hydratedPolygons = draw.replaceWithShapes(currentImported);
          if (hydratedPolygons.length > 0) {
            onDrawPolygonsChange(hydratedPolygons, { commitHistory: false, source: "rehydrate" });
          }
        } catch (error) {
          console.error("[DRAW_HYDRATE] replaceWithShapes failed in style-ready path", error);
        } finally {
          isImportHydratingRef.current = false;
        }
        fitMapToMultiPolygon(map, {
          type: "MultiPolygon",
          coordinates: currentImported.map((shape) => shape.polygon.coordinates),
        });
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

    const handleStyleData = () => {
      ensureOverlapLayers(map);
      ensureShapeLabelLayers(map);

      const overlapSource = map.getSource(OVERLAP_SOURCE_ID) as GeoJSONSource | undefined;
      overlapSource?.setData(overlapFeatureCollectionRef.current);

      const labelsSource = map.getSource(SHAPE_LABELS_SOURCE_ID) as GeoJSONSource | undefined;
      labelsSource?.setData(labelFeatureCollectionRef.current);
    };
    map.on("styledata", handleStyleData);

    return () => {
      map.off("load", createDrawForLoadedStyle);
      map.off("styledata", handleStyleData);
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

    source.setData(overlapFeatureCollection);
  }, [overlapFeatureCollection]);

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
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureShapeLabelLayers(map);

    const source = map.getSource(SHAPE_LABELS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData(labelFeatureCollection);
  }, [labelFeatureCollection]);

  useEffect(() => {
    if (!mapFocusGeometry || mapFocusNonce === 0) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    fitMapToMultiPolygon(map, toMultiPolygonLikeGeometry(mapFocusGeometry));
  }, [mapFocusGeometry, mapFocusNonce]);

  useEffect(() => {
    if (!drawRef.current) {
      return;
    }

    if (syncRevision <= appliedSyncRevisionRef.current) {
      return;
    }

    appliedSyncRevisionRef.current = syncRevision;

    if (importedShapes.length === 0) {
      drawRef.current.clearAll();
      onActiveShapeChange?.(null);
      onDrawPolygonsChange([], { commitHistory: false, source: "rehydrate" });
      return;
    }

    try {
      isImportHydratingRef.current = true;
      const hydratedPolygons = drawRef.current.replaceWithShapes(importedShapes);
      if (hydratedPolygons.length > 0) {
        onDrawPolygonsChange(hydratedPolygons, { commitHistory: false, source: "rehydrate" });
      }
    } catch (error) {
      console.error("[DRAW_HYDRATE] replaceWithShapes failed in import sync effect", error);
    } finally {
      isImportHydratingRef.current = false;
    }
    const map = mapRef.current;
    if (map) {
      fitMapToMultiPolygon(map, {
        type: "MultiPolygon",
        coordinates: importedShapes.map((shape) => shape.polygon.coordinates),
      });
    }
  }, [syncRevision, importedShapes, onDrawPolygonsChange, onActiveShapeChange]);

  return (
    <div className="map-canvas-shell">
      <div ref={mapContainerRef} className="map-canvas" aria-label="Live MapLibre map" />
      <div className="map-cursor-readout" aria-live="polite">
        {cursor ? `Lng ${cursor.lng.toFixed(6)} | Lat ${cursor.lat.toFixed(6)}` : "Move cursor over map"}
      </div>
    </div>
  );
}
