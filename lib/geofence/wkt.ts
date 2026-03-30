import type { SupportedGeofenceGeometry } from "@/lib/geofence/types";
import { normalizeToMultiPolygon } from "@/lib/geofence/normalize";
import { toMultiPolygonGeometry, toPolygonGeometry } from "@/lib/geofence/geojson";

function stripType(input: string): { type: string; body: string } {
  const trimmed = input.trim();
  const match = trimmed.match(/^([A-Za-z]+)\s*(\(.+\))$/s);
  if (!match) {
    throw new Error("WKT input is malformed.");
  }
  return { type: match[1].toUpperCase(), body: match[2] };
}

function unwrapPairParentheses(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    throw new Error("WKT coordinates are malformed.");
  }
  return trimmed.slice(1, -1);
}

function splitTopLevelGroups(input: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of input) {
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      current += char;
      continue;
    }

    if (char === "," && depth === 0) {
      if (current.trim()) {
        groups.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    groups.push(current.trim());
  }

  return groups;
}

function parsePosition(input: string): number[] {
  const parts = input.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error("WKT coordinate pair is malformed.");
  }

  const lng = Number(parts[0]);
  const lat = Number(parts[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error("WKT coordinate contains non-numeric values.");
  }

  return [lng, lat];
}

function parseRing(input: string): number[][] {
  const inner = unwrapPairParentheses(input);
  return inner
    .split(",")
    .map((part) => parsePosition(part))
    .filter((coords) => coords.length >= 2);
}

function parsePolygonBody(input: string): number[][][] {
  const rings = splitTopLevelGroups(unwrapPairParentheses(input));
  return rings.map(parseRing);
}

function formatPosition(position: number[], precision: number): string {
  return `${position[0].toFixed(precision)} ${position[1].toFixed(precision)}`;
}

function formatRing(ring: number[][], precision: number): string {
  return `(${ring.map((position) => formatPosition(position, precision)).join(", ")})`;
}

export function importWkt(input: string): SupportedGeofenceGeometry {
  const { type, body } = stripType(input);

  if (type === "POLYGON") {
    return toPolygonGeometry(parsePolygonBody(body));
  }

  if (type === "MULTIPOLYGON") {
    const polygons = splitTopLevelGroups(unwrapPairParentheses(body)).map((polygonBody) => parsePolygonBody(polygonBody));
    return toMultiPolygonGeometry(polygons);
  }

  throw new Error(`Unsupported WKT geometry type: ${type}.`);
}

export function exportWkt(geometry: SupportedGeofenceGeometry, precision = 6): string {
  const multiPolygon = normalizeToMultiPolygon(geometry);
  const polygonText = multiPolygon.coordinates
    .map((polygon) => `(${polygon.map((ring) => formatRing(ring, precision)).join(", ")})`)
    .join(", ");

  return `MULTIPOLYGON(${polygonText})`;
}
