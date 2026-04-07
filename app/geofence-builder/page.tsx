"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  areShapeSnapshotsEqual,
  commitHistoryEntry,
  createHistoryState,
  HistoryState,
  redoHistory,
  undoHistory,
} from "../../lib/state/history";

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
  const [history, setHistory] = useState<HistoryState>(() => createHistoryState());
  const shapesRef = useRef<ShapeRecord[]>(shapes);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

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

  const applyShapes = useCallback(
    (
      nextShapes: ShapeRecord[],
      options?: {
        commit?: boolean;
        source?: "draw_change" | "draw_finish" | "import" | "delete" | "metadata" | "undo" | "redo" | "rehydrate";
        preserveSelection?: boolean;
        syncDraw?: boolean;
      },
    ) => {
      const shouldCommit = options?.commit ?? false;
      const preserveSelection = options?.preserveSelection ?? true;
      const shouldSyncDraw = options?.syncDraw ?? false;

      const currentShapes = shapesRef.current;
      if (areShapeSnapshotsEqual(currentShapes, nextShapes)) {
        return;
      }

      if (shouldCommit) {
        setHistory((previousHistory) => commitHistoryEntry(previousHistory, currentShapes));
      }

      setShapes(nextShapes);

      if (!preserveSelection) {
        setSelectedShapeIds([]);
        setActiveShapeId(null);
      } else {
        setSelectedShapeIds((previousSelected) => previousSelected.filter((shapeId) => nextShapes.some((shape) => shape.id === shapeId)));
        setActiveShapeId((previousActive) =>
          previousActive && nextShapes.some((shape) => shape.id === previousActive) ? previousActive : null,
        );
      }

      setImportErrors([]);

      if (shouldSyncDraw) {
        setSyncRevision((previous) => previous + 1);
      }
    },
    [],
  );

  const handleDrawPolygonsChange = useCallback(
    (
      entries: Array<{ id: string; polygon: GeoJSON.Polygon }>,
      context?: { commitHistory?: boolean; source?: "change" | "finish" | "rehydrate" },
    ) => {
      const previousById = new Map(shapesRef.current.map((shape) => [shape.id, shape]));
      const nextShapes = entries.map((entry, index) => {
        const existing = previousById.get(entry.id);
        if (existing) {
          return { ...existing, polygon: entry.polygon };
        }

        return buildFallbackShapeFromDraw(entry.id, entry.polygon, index);
      });

      applyShapes(nextShapes, {
        commit: context?.commitHistory ?? false,
        source:
          context?.source === "finish"
            ? "draw_finish"
            : context?.source === "rehydrate"
              ? "rehydrate"
              : "draw_change",
        preserveSelection: true,
      });
    },
    [applyShapes],
  );

  const handleImportWkt = () => {
    try {
      const imported = fromWktToMultiPolygon(wktInput);
      const normalized = normalizeAnySupportedGeometryToMultiPolygon(imported);
      const importedShapes = createFallbackShapesFromMultiPolygon(normalized);

      applyShapes(importedShapes, { commit: true, source: "import", preserveSelection: false, syncDraw: true });
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

      applyShapes(parsed.shapes, { commit: true, source: "import", preserveSelection: false, syncDraw: true });
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

  const handleShapeNameCommit = (shapeId: string, nextName: string) => {
    const nextShapes = shapesRef.current.map((shape) => (shape.id === shapeId ? { ...shape, name: nextName } : shape));
    applyShapes(nextShapes, { commit: true, source: "metadata", preserveSelection: true });
  };

  const handleShapeTagsChange = (shapeId: string, rawTags: string) => {
    const normalizedTags = normalizeTags(rawTags);
    const nextShapes = shapesRef.current.map((shape) =>
      shape.id === shapeId ? { ...shape, tags: normalizedTags } : shape,
    );
    applyShapes(nextShapes, { commit: true, source: "metadata", preserveSelection: true });
  };

  const handleClearSelected = () => {
    if (selectedShapeIds.length === 0) {
      return;
    }

    const remainingShapes = shapesRef.current.filter((shape) => !selectedShapeIds.includes(shape.id));
    applyShapes(remainingShapes, { commit: true, source: "delete", preserveSelection: false, syncDraw: true });
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

  const handleUndo = () => {
    const result = undoHistory(history, shapes);
    if (!result) {
      return;
    }

    setHistory(result.history);
    applyShapes(result.shapes, { commit: false, source: "undo", preserveSelection: true, syncDraw: true });
  };

  const handleRedo = () => {
    const result = redoHistory(history, shapes);
    if (!result) {
      return;
    }

    setHistory(result.history);
    applyShapes(result.shapes, { commit: false, source: "redo", preserveSelection: true, syncDraw: true });
  };

  const focusedPairKey = selectedOverlap?.pairKey ?? null;

  return (
    <main className="builder-shell">
      <aside className="builder-left-pane">
        <h1>Geofence Builder</h1>
        <p className="muted">Draw, import, and export per-shape WKT.</p>
        <p className="muted">Import will replace existing shapes.</p>
        <p className="muted">{activeShapeId ? `Active shape on map: ${activeShapeId}` : "No active map selection."}</p>

        <Toolbar
          mode={mode}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onModeChange={setMode}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

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
          activeShapeId={activeShapeId}
          onPrecisionChange={setPrecision}
          onCopyShape={handleCopyShape}
          onCopyCombined={handleCopyCombined}
          onToggleShape={handleToggleShape}
          onClearSelected={handleClearSelected}
          onShapeNameCommit={handleShapeNameCommit}
          onShapeTagsChange={handleShapeTagsChange}
          onSetActiveShape={setActiveShapeId}
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
          canonicalShapes={shapes}
          activeShapeId={activeShapeId}
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
