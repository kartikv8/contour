"use client";

import { useCallback, useMemo, useState } from "react";
import { ExportWktPanel } from "../../components/ExportWktPanel";
import { ImportWktPanel } from "../../components/ImportWktPanel";
import { MapCanvas } from "../../components/MapCanvas";
import { Toolbar } from "../../components/Toolbar";
import { normalizeAnySupportedGeometryToMultiPolygon } from "../../lib/geometry/normalize";
import { EditorMode } from "../../lib/geometry/types";
import { validateMultiPolygon } from "../../lib/geometry/validate";
import { fromWktToMultiPolygon, toWktMultiPolygon } from "../../lib/geometry/wkt";

type ShapeEntry = {
  id: string;
  polygon: GeoJSON.Polygon;
};

function toMultiPolygonFromShapes(shapes: ShapeEntry[]): GeoJSON.MultiPolygon | null {
  if (shapes.length === 0) {
    return null;
  }

  return {
    type: "MultiPolygon",
    coordinates: shapes.map((shape) => shape.polygon.coordinates),
  };
}

export default function GeofenceBuilderPage() {
  const [mode, setMode] = useState<EditorMode>("select");
  const [shapes, setShapes] = useState<ShapeEntry[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [precision, setPrecision] = useState<number>(6);
  const [wktInput, setWktInput] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const [syncRevision, setSyncRevision] = useState<number>(0);

  const combinedGeometry = useMemo(() => toMultiPolygonFromShapes(shapes), [shapes]);


  const shapeExports = useMemo(() => {
    return shapes.map((shape, index) => {
      const shapeGeometry: GeoJSON.MultiPolygon = {
        type: "MultiPolygon",
        coordinates: [shape.polygon.coordinates],
      };
      const validation = validateMultiPolygon(shapeGeometry);

      return {
        id: shape.id,
        valid: validation.valid,
        errors: validation.errors,
        selected: selectedShapeIds.includes(shape.id),
        wkt: validation.valid ? toWktMultiPolygon(shapeGeometry, precision) : "",
        index,
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

  const handleDrawPolygonsChange = useCallback((polygons: GeoJSON.Polygon[]) => {
    setShapes(polygons.map((polygon, index) => ({ id: `shape-${index + 1}`, polygon })));
    setImportError(null);
  }, []);

  const handleImportWkt = () => {
    try {
      const imported = fromWktToMultiPolygon(wktInput);
      const normalized = normalizeAnySupportedGeometryToMultiPolygon(imported);
      const importedShapes = normalized.coordinates.map((polygon, index) => ({
        id: `imported-${Date.now()}-${index + 1}`,
        polygon: { type: "Polygon" as const, coordinates: polygon },
      }));

      setShapes(importedShapes);
      setSelectedShapeIds([]);
      setSyncRevision((previous) => previous + 1);
      setImportError(null);
      setMode("select");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse WKT.";
      setImportError(message);
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

  const handleDeleteSelected = () => {
    if (selectedShapeIds.length === 0) {
      return;
    }

    const remainingShapes = shapes.filter((shape) => !selectedShapeIds.includes(shape.id));
    setShapes(remainingShapes);
    setSelectedShapeIds([]);
    setSyncRevision((previous) => previous + 1);
  };

  const handleClearSelected = () => {
    if (selectedShapeIds.length === 0) {
      return;
    }

    const remainingShapes = shapes.filter((shape) => !selectedShapeIds.includes(shape.id));
    setShapes(remainingShapes);
    setSelectedShapeIds([]);
    setSyncRevision((previous) => previous + 1);
  };

  return (
    <main className="builder-shell">
      <aside className="builder-left-pane">
        <h1>Geofence Builder</h1>
        <p className="muted">Draw, import, and export per-shape WKT.</p>

        <Toolbar mode={mode} onModeChange={setMode} />

        <ImportWktPanel
          wktInput={wktInput}
          importError={importError}
          onWktInputChange={setWktInput}
          onImportWkt={handleImportWkt}
        />

        <ExportWktPanel
          precision={precision}
          shapeExports={shapeExports}
          combinedWkt={combinedWkt}
          onPrecisionChange={setPrecision}
          onCopyShape={handleCopyShape}
          onCopyCombined={handleCopyCombined}
          onToggleShape={handleToggleShape}
          onDeleteSelected={handleDeleteSelected}
          onClearSelected={handleClearSelected}
        />
      </aside>

      <section className="builder-right-pane">
        <MapCanvas
          mode={mode}
          importedGeometry={combinedGeometry}
          syncRevision={syncRevision}
          onDrawPolygonsChange={handleDrawPolygonsChange}
        />
      </section>
    </main>
  );
}
