import type { MultiPolygon, Polygon } from "geojson";
import type { SupportedGeofenceGeometry } from "@/lib/geofence/types";

function isPosition(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 && value.every((entry) => typeof entry === "number");
}

function isRing(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every(isPosition);
}

function isPolygonCoordinates(value: unknown): value is number[][][] {
  return Array.isArray(value) && value.every(isRing);
}

function isMultiPolygonCoordinates(value: unknown): value is number[][][][] {
  return Array.isArray(value) && value.every(isPolygonCoordinates);
}

export function isSupportedGeometry(input: unknown): input is SupportedGeofenceGeometry {
  if (!input || typeof input !== "object") {
    return false;
  }

  const geometry = input as { type?: string; coordinates?: unknown };

  if (geometry.type === "Polygon") {
    return isPolygonCoordinates(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return isMultiPolygonCoordinates(geometry.coordinates);
  }

  return false;
}

export function toPolygonGeometry(coordinates: number[][][]): Polygon {
  return { type: "Polygon", coordinates };
}

export function toMultiPolygonGeometry(coordinates: number[][][][]): MultiPolygon {
  return { type: "MultiPolygon", coordinates };
}
