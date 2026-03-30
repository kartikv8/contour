"use client";

import { useMemo, useState } from "react";
import { CoordinateTable } from "../../components/CoordinateTable";
import { ExportPanel } from "../../components/ExportPanel";
import { ImportPanel } from "../../components/ImportPanel";
import { MapCanvas } from "../../components/MapCanvas";
import { Toolbar } from "../../components/Toolbar";
import { ValidationPanel } from "../../components/ValidationPanel";
import { multipolygonFromPolygons, normalizeAnySupportedGeometryToMultiPolygon } from "../../lib/geometry/normalize";
import { EditorMode } from "../../lib/geometry/types";
import { validateMultiPolygon } from "../../lib/geometry/validate";
import { fromWktToMultiPolygon, toWktMultiPolygon } from "../../lib/geometry/wkt";

type CursorCoords = { lng: number; lat: number };

export default function GeofenceBuilderPage() {
  const [cursorCoords, setCursorCoords] = useState<CursorCoords>();
  const [mode, setMode] = useState<EditorMode>("select");
  const [geometry, setGeometry] = useState<GeoJSON.MultiPolygon | null>(null);
  const [precision, setPrecision] = useState<number>(6);
  const [wktInput, setWktInput] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);

  const validation = useMemo(() => validateMultiPolygon(geometry), [geometry]);

  const wktPreview = useMemo(() => {
    if (!geometry || !validation.valid) {
      return "";
    }

    return toWktMultiPolygon(geometry, precision);
  }, [geometry, precision, validation.valid]);

  const coordinatePreview = useMemo<[number, number][]>(() => {
    if (!geometry?.coordinates.length || !geometry.coordinates[0]?.length || !geometry.coordinates[0][0]) {
      return [];
    }

    return geometry.coordinates[0][0] as [number, number][];
  }, [geometry]);

  const handleDrawPolygonsChange = (polygons: GeoJSON.Polygon[]) => {
    const multiPolygon = multipolygonFromPolygons(polygons);
    setGeometry(multiPolygon ? normalizeAnySupportedGeometryToMultiPolygon(multiPolygon) : null);
    setImportError(null);
  };

  const handleImportWkt = () => {
    try {
      const imported = fromWktToMultiPolygon(wktInput);
      const normalized = normalizeAnySupportedGeometryToMultiPolygon(imported);
      setGeometry(normalized);
      setImportError(null);
      setMode("select");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse WKT.";
      setImportError(message);
    }
  };

  const handleCopy = async () => {
    if (!wktPreview || !validation.valid) {
      return;
    }

    await navigator.clipboard.writeText(wktPreview);
  };

  return (
    <main className="builder-shell">
      <aside className="builder-left-pane">
        <h1>Geofence Builder</h1>
        <p className="muted">Milestone 3: draw + normalize + validate + WKT.</p>
        <p className="cursor-chip" aria-live="polite">
          Cursor: {cursorCoords ? `${cursorCoords.lng.toFixed(6)}, ${cursorCoords.lat.toFixed(6)}` : "—"}
        </p>

        <Toolbar mode={mode} onModeChange={setMode} />
        <ImportPanel
          wktInput={wktInput}
          importError={importError}
          onWktInputChange={setWktInput}
          onImportWkt={handleImportWkt}
        />
        <ExportPanel
          precision={precision}
          wktPreview={wktPreview}
          canExport={validation.valid && Boolean(wktPreview)}
          onPrecisionChange={setPrecision}
          onCopy={handleCopy}
        />
        <ValidationPanel valid={validation.valid} errors={validation.errors} />
        <CoordinateTable coordinates={coordinatePreview} />
      </aside>

      <section className="builder-right-pane">
        <MapCanvas
          mode={mode}
          importedGeometry={geometry}
          onCursorChange={setCursorCoords}
          onDrawPolygonsChange={handleDrawPolygonsChange}
        />
      </section>
    </main>
  );
}
