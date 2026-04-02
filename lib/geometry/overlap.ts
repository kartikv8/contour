import { featureCollection, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";

export type ShapeOverlapInput = {
  id: string;
  polygon: GeoJSON.Polygon;
};

export type OverlapPair = {
  pairKey: string;
  shapeAId: string;
  shapeBId: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export function toOverlapPairKey(shapeAId: string, shapeBId: string): string {
  return [shapeAId, shapeBId].sort().join("::");
}

export function detectPolygonOverlaps(shapes: ShapeOverlapInput[]): OverlapPair[] {
  const overlaps: OverlapPair[] = [];

  for (let i = 0; i < shapes.length; i += 1) {
    for (let j = i + 1; j < shapes.length; j += 1) {
      const shapeA = shapes[i];
      const shapeB = shapes[j];

      const a = polygon(shapeA.polygon.coordinates);
      const b = polygon(shapeB.polygon.coordinates);
      const overlap = intersect(featureCollection([a, b]));

      if (!overlap) {
        continue;
      }

      if (overlap.geometry.type !== "Polygon" && overlap.geometry.type !== "MultiPolygon") {
        continue;
      }

      overlaps.push({
        pairKey: toOverlapPairKey(shapeA.id, shapeB.id),
        shapeAId: shapeA.id,
        shapeBId: shapeB.id,
        geometry: overlap.geometry,
      });
    }
  }

  return overlaps;
}
