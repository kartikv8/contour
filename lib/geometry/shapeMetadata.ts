import { fromWktToMultiPolygon } from "./wkt";
import { normalizeAnySupportedGeometryToMultiPolygon } from "./normalize";
import { validateMultiPolygon } from "./validate";
import { MetadataImportEntry, ShapeRecord } from "./types";

export type MetadataImportResult = {
  shapes: ShapeRecord[];
};

export type MetadataImportError = {
  index: number;
  message: string;
};

let idCounter = 0;

function nextIdPrefix(): string {
  idCounter += 1;
  return `shape-${Date.now()}-${idCounter}`;
}

export function createFallbackShapesFromMultiPolygon(geometry: GeoJSON.MultiPolygon): ShapeRecord[] {
  const idPrefix = nextIdPrefix();

  return geometry.coordinates.map((coordinates, index) => ({
    id: `${idPrefix}-${index + 1}`,
    name: `Shape ${index + 1}`,
    polygon: {
      type: "Polygon",
      coordinates,
    },
    tags: [],
  }));
}

function parseJsonInput(rawInput: string): unknown {
  try {
    return JSON.parse(rawInput);
  } catch {
    throw new Error("Invalid JSON. Provide a JSON array of shape metadata objects.");
  }
}

function toMetadataEntry(value: unknown): MetadataImportEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const { id, name, polygon, tags } = candidate;

  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    return null;
  }

  if (typeof polygon !== "string" || polygon.trim().length === 0) {
    return null;
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0)) {
      return null;
    }
  }

  return {
    id: id.trim(),
    name: name.trim(),
    polygon,
    tags: tags ? tags.map((tag) => tag.trim()) : undefined,
  };
}

export function parseMetadataShapesJson(rawInput: string): MetadataImportResult {
  const parsed = parseJsonInput(rawInput);

  if (!Array.isArray(parsed)) {
    throw new Error("JSON import expects an array of shape objects.");
  }

  if (parsed.length === 0) {
    throw new Error("JSON import array cannot be empty.");
  }

  const seenIds = new Set<string>();
  const errors: MetadataImportError[] = [];
  const shapes: ShapeRecord[] = [];

  parsed.forEach((entry, index) => {
    const humanIndex = index + 1;
    const normalized = toMetadataEntry(entry);

    if (!normalized) {
      errors.push({
        index,
        message:
          `Entry ${humanIndex}: expected { id: string, name: string, polygon: string, tags?: string[] } with non-empty values.`,
      });
      return;
    }

    if (seenIds.has(normalized.id)) {
      errors.push({ index, message: `Entry ${humanIndex}: duplicate id \"${normalized.id}\".` });
      return;
    }
    seenIds.add(normalized.id);

    let multiPolygon: GeoJSON.MultiPolygon;
    try {
      const parsedWkt = fromWktToMultiPolygon(normalized.polygon);
      multiPolygon = normalizeAnySupportedGeometryToMultiPolygon(parsedWkt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid polygon WKT.";
      errors.push({ index, message: `Entry ${humanIndex}: polygon WKT failed to parse (${message}).` });
      return;
    }

    const validation = validateMultiPolygon(multiPolygon);
    if (!validation.valid) {
      const firstIssue = validation.errors[0]?.message ?? "Invalid or empty geometry.";
      errors.push({ index, message: `Entry ${humanIndex}: ${firstIssue}` });
      return;
    }

    if (multiPolygon.coordinates.length !== 1) {
      errors.push({
        index,
        message: `Entry ${humanIndex}: polygon WKT must produce exactly one polygon geometry.`,
      });
      return;
    }

    shapes.push({
      id: normalized.id,
      name: normalized.name,
      polygon: {
        type: "Polygon",
        coordinates: multiPolygon.coordinates[0],
      },
      tags: normalized.tags ?? [],
    });
  });

  if (errors.length > 0) {
    const message = errors.map((error) => error.message).join("\n");
    throw new Error(message);
  }

  return { shapes };
}

export function buildShapeLabel(shape: ShapeRecord, index: number): string {
  return shape.name.trim().length > 0 ? shape.name : `Shape ${index + 1}`;
}
