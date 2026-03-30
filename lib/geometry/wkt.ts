import { normalizeAnySupportedGeometryToMultiPolygon, roundCoordinates } from "./normalize";

function splitTopLevelGroups(input: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "(") {
      depth += 1;
      if (depth === 1) {
        start = i + 1;
      }
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        groups.push(input.slice(start, i));
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
      const [lngText, latText] = pair.split(/\s+/);
      const lng = Number(lngText);
      const lat = Number(latText);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error("Malformed coordinate pair in WKT.");
      }
      return [lng, lat] as [number, number];
    });
}

function parsePolygonBody(body: string): [number, number][][] {
  const ringGroups = splitTopLevelGroups(body);
  if (ringGroups.length === 0) {
    throw new Error("Invalid POLYGON WKT format.");
  }

  return ringGroups.map(parseRing);
}

export function fromWktToMultiPolygon(input: string): GeoJSON.MultiPolygon {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  if (upper.startsWith("POLYGON")) {
    const body = trimmed.slice(trimmed.indexOf("(")).trim();
    const polygonRings = parsePolygonBody(body);
    return normalizeAnySupportedGeometryToMultiPolygon({ type: "Polygon", coordinates: polygonRings });
  }

  if (upper.startsWith("MULTIPOLYGON")) {
    const body = trimmed.slice(trimmed.indexOf("(")).trim();
    const polygonGroups = splitTopLevelGroups(body);
    if (polygonGroups.length === 0) {
      throw new Error("Invalid MULTIPOLYGON WKT format.");
    }

    const polygons = polygonGroups.map((polygonText) => parsePolygonBody(`(${polygonText})`));
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
