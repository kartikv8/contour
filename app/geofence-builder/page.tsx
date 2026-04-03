"use client";

import { useCallback, useMemo, useState } from "react";
import { ExportWktPanel } from "../../components/ExportWktPanel";
import { ImportWktPanel } from "../../components/ImportWktPanel";
import { MapCanvas } from "../../components/MapCanvas";
import { OverlapWarningsPanel } from "../../components/OverlapWarningsPanel";
import { Toolbar } from "../../components/Toolbar";
import { detectPolygonOverlaps } from "../../lib/geometry/overlap";
import { normalizeAnySupportedGeometryToMultiPolygon } from "../../lib/geometry/normalize";
import { createFallbackShapesFromMultiPolygon, parseMetadataShapesJson } from "../../lib/geometry/shapeMetadata";
import { EditorMode, ShapeRecord } from "../../lib/geometry/types";
import { validateMultiPolygon } from "../../lib/geometry/validate";
import { fromWktToMultiPolygon, toWktMultiPolygon } from "../../lib/geometry/wkt";

function toMultiPolygonFromShapes(shapes: ShapeRecord[]): GeoJSON.MultiPolygon | null {
  if (shapes.length === 0) {
    return null;
  }

  return {
    type: "MultiPolygon",
    coordinates: shapes.map((shape) => shape.polygon.coordinates),
  };
}

function buildFallbackShapeFromDraw(id: string, polygon: GeoJSON.Polygon, index: number): ShapeRecord {
  return {
    id,
    name: `Shape ${index + 1}`,
    polygon,
    tags: [],
  };
}

function normalizeTags(rawTags: string): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .forEach((tag) => {
      if (seen.has(tag)) {
        return;
      }

      seen.add(tag);
      normalized.push(tag);
    });

  return normalized;
}

export default function GeofenceBuilderPage() {
  const [mode, setMode] = useState<EditorMode>("select");
  const [shapes, setShapes] = useState<ShapeRecord[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);
  const [precision, setPrecision] = useState<number>(6);
  const [importMode, setImportMode] = useState<"wkt" | "json">("wkt");
  const [wktInput, setWktInput] = useState<string>("");
  const [jsonInput, setJsonInput] = useState<string>("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [syncRevision, setSyncRevision] = useState<number>(0);
  const [focusedOverlap, setFocusedOverlap] = useState<{ pairKey: string; nonce: number } | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<{
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
    nonce: number;
  } | null>(null);

  const combinedGeometry = useMemo(() => toMultiPolygonFromShapes(shapes), [shapes]);

  const overlaps = useMemo(() => detectPolygonOverlaps(shapes), [shapes]);

  const shapeLabelsById = useMemo(
    () =>
      Object.fromEntries(shapes.map((shape, index) => [shape.id, shape.name?.trim() || `Shape ${index + 1}`])) as Record<
        string,
        string
      >,
    [shapes],
  );

  const selectedOverlap = useMemo(
    () => (focusedOverlap ? overlaps.find((entry) => entry.pairKey === focusedOverlap.pairKey) ?? null : null),
    [focusedOverlap, overlaps],
  );

  const highlightedShapePolygons = useMemo(() => {
    if (!selectedOverlap) {
      return [];
    }

    const highlightedIds = new Set([selectedOverlap.shapeAId, selectedOverlap.shapeBId]);
    return shapes.filter((shape) => highlightedIds.has(shape.id)).map((shape) => shape.polygon);
  }, [selectedOverlap, shapes]);

  const shapeExports = useMemo(() => {
    return shapes.map((shape) => {
      const shapeGeometry: GeoJSON.MultiPolygon = {
        type: "MultiPolygon",
        coordinates: [shape.polygon.coordinates],
      };
      const validation = validateMultiPolygon(shapeGeometry);

      return {
        id: shape.id,
        name: shape.name,
        tags: shape.tags ?? [],
        valid: validation.valid,
        errors: validation.errors,
        selected: selectedShapeIds.includes(shape.id),
        wkt: validation.valid ? toWktMultiPolygon(shapeGeometry, precision) : "",
      };
    });
  }, [precision, selectedShapeIds, shapes]);

  const combinedWkt = useMemo(() => {
    if (!combinedGeometry) {
      return "";
    }

    const validation = validateMultiPolygon(combinedGeometry);
    if (!validation.valid) {
      return "";
    }

    return toWktMultiPolygon(combinedGeometry, precision);
  }, [combinedGeometry, precision]);

  const handleDrawPolygonsChange = useCallback((entries: Array<{ id: string; polygon: GeoJSON.Polygon }>) => {
    setShapes((previous) => {
      const previousById = new Map(previous.map((shape) => [shape.id, shape]));

      return entries.map((entry, index) => {
        const existing = previousById.get(entry.id);
        if (existing) {
          return { ...existing, polygon: entry.polygon };
        }

        return buildFallbackShapeFromDraw(entry.id, entry.polygon, index);
      });
    });
    setSelectedShapeIds((previous) => previous.filter((shapeId) => entries.some((entry) => entry.id === shapeId)));
    setActiveShapeId((previous) => (previous && entries.some((entry) => entry.id === previous) ? previous : null));
    setImportErrors([]);
  }, []);

  const handleImportWkt = () => {
    try {
      const imported = fromWktToMultiPolygon(wktInput);
      const normalized = normalizeAnySupportedGeometryToMultiPolygon(imported);
      const importedShapes = createFallbackShapesFromMultiPolygon(normalized);

      setShapes(importedShapes);
      setSelectedShapeIds([]);
      setActiveShapeId(null);
      setSyncRevision((previous) => previous + 1);
      setImportErrors([]);
      setMode("select");
      setFocusedOverlap(null);
      setMapFocusRequest(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse WKT.";
      setImportErrors([message]);
    }
  };

  const handleImportJson = () => {
    try {
      const parsed = parseMetadataShapesJson(jsonInput);

      setShapes(parsed.shapes);
      setSelectedShapeIds([]);
      setActiveShapeId(null);
      setSyncRevision((previous) => previous + 1);
      setImportErrors([]);
      setMode("select");
      setFocusedOverlap(null);
      setMapFocusRequest(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse JSON metadata.";
      setImportErrors(message.split("\n"));
    }
  };

  const handleCopyShape = async (shapeId: string) => {
    const entry = shapeExports.find((shape) => shape.id === shapeId);
    if (!entry || !entry.valid || !entry.wkt) {
      return;
    }

    await navigator.clipboard.writeText(entry.wkt);
  };

  const handleCopyCombined = async () => {
    if (!combinedWkt) {
      return;
    }

    await navigator.clipboard.writeText(combinedWkt);
  };

  const handleToggleShape = (shapeId: string) => {
    setSelectedShapeIds((previous) =>
      previous.includes(shapeId) ? previous.filter((id) => id !== shapeId) : [...previous, shapeId],
    );
  };

  const handleShapeNameChange = (shapeId: string, nextName: string) => {
    setShapes((previous) =>
      previous.map((shape) => (shape.id === shapeId ? { ...shape, name: nextName } : shape)),
    );
  };

  const handleShapeTagsChange = (shapeId: string, rawTags: string) => {
    const normalizedTags = normalizeTags(rawTags);

    setShapes((previous) =>
      previous.map((shape) => (shape.id === shapeId ? { ...shape, tags: normalizedTags } : shape)),
    );
  };

  const handleClearSelected = () => {
    if (selectedShapeIds.length === 0) {
      return;
    }

    const remainingShapes = shapes.filter((shape) => !selectedShapeIds.includes(shape.id));
    setShapes(remainingShapes);
    setSelectedShapeIds([]);
    setActiveShapeId((previous) =>
      previous && remainingShapes.some((shape) => shape.id === previous) ? previous : null,
    );
    setSyncRevision((previous) => previous + 1);
    setFocusedOverlap((previous) => {
      if (!previous) {
        return null;
      }

      const pair = previous.pairKey.split("::");
      if (pair.length !== 2) {
        return null;
      }

      const [shapeAId, shapeBId] = pair;
      const shapeAExists = remainingShapes.some((shape) => shape.id === shapeAId);
      const shapeBExists = remainingShapes.some((shape) => shape.id === shapeBId);
      return shapeAExists && shapeBExists ? previous : null;
    });
    setMapFocusRequest((previous) => {
      if (!previous || !focusedOverlap) {
        return null;
      }

      const pair = focusedOverlap.pairKey.split("::");
      if (pair.length !== 2) {
        return null;
      }

      const [shapeAId, shapeBId] = pair;
      const shapeAExists = remainingShapes.some((shape) => shape.id === shapeAId);
      const shapeBExists = remainingShapes.some((shape) => shape.id === shapeBId);
      return shapeAExists && shapeBExists ? previous : null;
    });
  };

  const handleSelectOverlap = (pairKey: string) => {
    const overlap = overlaps.find((entry) => entry.pairKey === pairKey);
    if (!overlap) {
      return;
    }

    setFocusedOverlap((previous) => ({ pairKey, nonce: (previous?.nonce ?? 0) + 1 }));
    setMapFocusRequest((previous) => ({ geometry: overlap.geometry, nonce: (previous?.nonce ?? 0) + 1 }));
  };

  const focusedPairKey = selectedOverlap?.pairKey ?? null;

  return (
    <main className="builder-shell">
      <aside className="builder-left-pane">
        <h1>Geofence Builder</h1>
        <p className="muted">Draw, import, and export per-shape WKT.</p>
        <p className="muted">Import will replace existing shapes.</p>
        <p className="muted">{activeShapeId ? `Active shape on map: ${activeShapeId}` : "No active map selection."}</p>

        <Toolbar mode={mode} onModeChange={setMode} />

        <ImportWktPanel
          importMode={importMode}
          wktInput={wktInput}
          jsonInput={jsonInput}
          importErrors={importErrors}
          onImportModeChange={setImportMode}
          onWktInputChange={setWktInput}
          onJsonInputChange={setJsonInput}
          onImportWkt={handleImportWkt}
          onImportJson={handleImportJson}
        />

        <ExportWktPanel
          precision={precision}
          shapeExports={shapeExports}
          combinedWkt={combinedWkt}
          onPrecisionChange={setPrecision}
          onCopyShape={handleCopyShape}
          onCopyCombined={handleCopyCombined}
          onToggleShape={handleToggleShape}
          onClearSelected={handleClearSelected}
          onShapeNameChange={handleShapeNameChange}
          onShapeTagsChange={handleShapeTagsChange}
        />

        <OverlapWarningsPanel
          shapeCount={shapes.length}
          overlaps={overlaps}
          shapeLabelsById={shapeLabelsById}
          activePairKey={focusedPairKey}
          onSelectOverlap={handleSelectOverlap}
        />
      </aside>

      <section className="builder-right-pane">
        <MapCanvas
          mode={mode}
          importedShapes={shapes.map((shape) => ({ id: shape.id, polygon: shape.polygon }))}
          syncRevision={syncRevision}
          onDrawPolygonsChange={handleDrawPolygonsChange}
          onActiveShapeChange={setActiveShapeId}
          overlapPairs={overlaps}
          focusedOverlapPairKey={focusedPairKey}
          mapFocusGeometry={mapFocusRequest?.geometry ?? null}
          mapFocusNonce={mapFocusRequest?.nonce ?? 0}
          highlightedShapePolygons={highlightedShapePolygons}
        />
      </section>
    </main>
  );
}
