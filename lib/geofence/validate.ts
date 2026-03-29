import type { MultiPolygon } from "geojson";
import type { GeofenceValidationResult, SupportedGeofenceGeometry } from "@/lib/geofence/types";
import { normalizeToMultiPolygon } from "@/lib/geofence/normalize";

function isFiniteLngLat(position: number[]): boolean {
  const [lng, lat] = position;
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

function getDistinctVertices(ring: number[][]): number {
  const withoutClosing = ring.slice(0, -1);
  return new Set(withoutClosing.map((coord) => `${coord[0]},${coord[1]}`)).size;
}

function validateMultiPolygonShape(multiPolygon: MultiPolygon): string[] {
  const errors: string[] = [];

  multiPolygon.coordinates.forEach((polygon, polygonIndex) => {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      errors.push(`Polygon ${polygonIndex + 1} is missing rings.`);
      return;
    }

    polygon.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring) || ring.length < 4) {
        errors.push(`Polygon ${polygonIndex + 1} ring ${ringIndex + 1} must contain at least 4 positions.`);
        return;
      }

      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        errors.push(`Polygon ${polygonIndex + 1} ring ${ringIndex + 1} must be closed.`);
      }

      ring.forEach((position, coordIndex) => {
        if (!Array.isArray(position) || position.length < 2) {
          errors.push(`Polygon ${polygonIndex + 1} ring ${ringIndex + 1} coordinate ${coordIndex + 1} is malformed.`);
          return;
        }

        if (!isFiniteLngLat(position)) {
          errors.push(`Polygon ${polygonIndex + 1} ring ${ringIndex + 1} coordinate ${coordIndex + 1} is out of lng/lat bounds.`);
        }
      });

      if (ringIndex === 0 && getDistinctVertices(ring) < 3) {
        errors.push(`Polygon ${polygonIndex + 1} outer ring must contain at least 3 distinct vertices.`);
      }
    });
  });

  return errors;
}

export function validateGeometry(geometry: SupportedGeofenceGeometry | null): GeofenceValidationResult {
  if (!geometry) {
    return { isValid: false, errors: ["No geometry is available."] };
  }

  const normalized = normalizeToMultiPolygon(geometry);
  const errors = validateMultiPolygonShape(normalized);

  return {
    isValid: errors.length === 0,
    errors
  };
}
