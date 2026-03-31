import { isCoordinatePair } from "./geojson";
import { ValidationResult, ValidationIssue } from "./types";

function issue(code: string, message: string): ValidationIssue {
  return { code, message, severity: "error" };
}

function hasValidBounds(lng: number, lat: number): boolean {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

function orientation(a: [number, number], b: [number, number], c: [number, number]): number {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (value === 0) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: [number, number], b: [number, number], c: [number, number]): boolean {
  return (
    b[0] <= Math.max(a[0], c[0]) &&
    b[0] >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) &&
    b[1] >= Math.min(a[1], c[1])
  );
}

function segmentsIntersect(
  p1: [number, number],
  q1: [number, number],
  p2: [number, number],
  q2: [number, number],
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function hasSelfIntersection(ring: [number, number][]): boolean {
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a1 = ring[i];
    const a2 = ring[i + 1];

    for (let j = i + 1; j < ring.length - 1; j += 1) {
      const b1 = ring[j];
      const b2 = ring[j + 1];

      const sharesEndpoint =
        i === j || i + 1 === j || (i === 0 && j === ring.length - 2) || (j === 0 && i === ring.length - 2);

      if (sharesEndpoint) {
        continue;
      }

      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}

export function validateMultiPolygon(geometry: GeoJSON.MultiPolygon | null): ValidationResult {
  const errors: ValidationIssue[] = [];

  if (!geometry) {
    errors.push(issue("no_geometry", "Draw a polygon before exporting."));
    return { valid: false, errors };
  }

  if (geometry.type !== "MultiPolygon" || !Array.isArray(geometry.coordinates)) {
    errors.push(issue("invalid_geojson", "Only Polygon and MultiPolygon are supported."));
    return { valid: false, errors };
  }

  geometry.coordinates.forEach((polygon, polygonIndex) => {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      errors.push(issue("malformed_polygon", `Polygon ${polygonIndex + 1} has no rings.`));
      return;
    }

    polygon.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring)) {
        errors.push(issue("malformed_ring", `Polygon ${polygonIndex + 1} ring ${ringIndex + 1} is malformed.`));
        return;
      }

      const parsed = ring.filter(isCoordinatePair) as [number, number][];
      if (parsed.length !== ring.length) {
        errors.push(issue("malformed_coordinates", `Polygon ${polygonIndex + 1} ring ${ringIndex + 1} has invalid coordinates.`));
        return;
      }

      if (parsed.length < 4) {
        errors.push(issue("min_points", `Polygon ${polygonIndex + 1} ring ${ringIndex + 1} needs at least 4 points.`));
      }

      const first = parsed[0];
      const last = parsed[parsed.length - 1];
      if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
        errors.push(issue("ring_open", `Polygon ${polygonIndex + 1} ring ${ringIndex + 1} must be closed.`));
      }

      parsed.forEach(([lng, lat]) => {
        if (!hasValidBounds(lng, lat)) {
          errors.push(issue("bounds", `Coordinates must be within valid longitude/latitude bounds.`));
        }
      });

      if (hasSelfIntersection(parsed)) {
        errors.push(issue("self_intersection", `Self-intersecting polygons cannot be exported.`));
      }
    });
  });

  return { valid: errors.length === 0, errors };
}
