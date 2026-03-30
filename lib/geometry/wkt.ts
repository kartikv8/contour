import { normalizeAnySupportedGeometryToMultiPolygon, roundCoordinates } from "./normalize";

function stripOuterParentheses(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    throw new Error("Invalid WKT format.");
  }

  return trimmed.slice(1, -1).trim();
}

function extractTopLevelGroups(input: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (char === "(") {
      if (depth === 0) {
        start = i + 1;
      }
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        groups.push(input.slice(start, i).trim());
        start = -1;
      }
    }
  }

  return groups;
}

function parseRing(raw: string): [number, number][] {
  return raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((pair) => {
      const parts = pair.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        throw new Error("Malformed coordinate pair in WKT.");
      }

      const lng = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error("Malformed coordinate pair in WKT.");
      }
      return [lng, lat] as [number, number];
    });
}

function parsePolygonContent(content: string): [number, number][][] {
  const rings = extractTopLevelGroups(content);
  if (rings.length === 0) {
    throw new Error("Invalid POLYGON WKT format.");
  }

  return rings.map(parseRing);
}

export function fromWktToMultiPolygon(input: string): GeoJSON.MultiPolygon {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  if (upper.startsWith("POLYGON")) {
    const body = stripOuterParentheses(trimmed.slice(trimmed.indexOf("(")));
    const polygonRings = parsePolygonContent(body);
    return normalizeAnySupportedGeometryToMultiPolygon({ type: "Polygon", coordinates: polygonRings });
  }

  if (upper.startsWith("MULTIPOLYGON")) {
    const body = stripOuterParentheses(trimmed.slice(trimmed.indexOf("(")));
    const polygonContents = extractTopLevelGroups(body);
    if (polygonContents.length === 0) {
      throw new Error("Invalid MULTIPOLYGON WKT format.");
    }

    const polygons = polygonContents.map(parsePolygonContent);
    return normalizeAnySupportedGeometryToMultiPolygon({
      type: "MultiPolygon",
      coordinates: polygons,
    });
  }

  throw new Error("Only POLYGON and MULTIPOLYGON are supported.");
}

export function toWktMultiPolygon(geometry: GeoJSON.MultiPolygon, precision: number): string {
  const rounded = roundCoordinates(geometry, precision);

  const polygonText = rounded.coordinates
    .map((polygon) =>
      `(${polygon
        .map((ring) => `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(",")})`)
        .join(",")})`,
    )
    .join(",");

  return `MULTIPOLYGON(${polygonText})`;
}
