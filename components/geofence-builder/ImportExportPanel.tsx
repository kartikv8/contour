"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { GeofenceValidationResult, PrecisionOption, SupportedGeofenceGeometry } from "@/lib/geofence/types";
import { exportWkt, importWkt } from "@/lib/geofence/wkt";
import { validateGeometry } from "@/lib/geofence/validate";

type ImportExportPanelProps = {
  geometry: SupportedGeofenceGeometry | null;
  validation: GeofenceValidationResult;
  precision: PrecisionOption;
  onPrecisionChange: (precision: PrecisionOption) => void;
  onImportedGeometry: (geometry: SupportedGeofenceGeometry) => void;
};

export function ImportExportPanel({
  geometry,
  validation,
  precision,
  onPrecisionChange,
  onImportedGeometry
}: ImportExportPanelProps) {
  const [input, setInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const exportText = useMemo(() => {
    if (!geometry || !validation.isValid) {
      return "";
    }

    try {
      return exportWkt(geometry, precision);
    } catch {
      return "";
    }
  }, [geometry, precision, validation.isValid]);

  const canExport = validation.isValid && Boolean(exportText);

  function handleImport() {
    setImportError(null);
    setCopyMessage(null);

    try {
      const parsed = importWkt(input);
      const result = validateGeometry(parsed);
      if (!result.isValid) {
        setImportError(result.errors.join(" "));
        return;
      }

      onImportedGeometry(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import WKT.";
      setImportError(message);
    }
  }

  async function handleCopy() {
    if (!canExport) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportText);
      setCopyMessage("Copied WKT to clipboard.");
    } catch {
      setCopyMessage("Clipboard access failed.");
    }
  }

  return (
    <section style={panelStyle}>
      <h2 style={headingStyle}>Import / Export</h2>
      <label style={labelStyle} htmlFor="wkt-input">
        WKT Input (POLYGON or MULTIPOLYGON)
      </label>
      <textarea
        id="wkt-input"
        rows={4}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        style={textareaStyle}
        placeholder="Paste WKT here"
      />
      <div style={rowStyle}>
        <button type="button" onClick={handleImport}>
          Import WKT
        </button>
        <label htmlFor="precision-select" style={{ marginLeft: "auto" }}>
          Precision:
        </label>
        <select
          id="precision-select"
          value={precision}
          onChange={(event) => onPrecisionChange(Number(event.target.value) as PrecisionOption)}
        >
          {[5, 6, 7, 8].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      {importError ? <p style={errorStyle}>{importError}</p> : null}
      <label style={labelStyle}>WKT Export Preview (always MULTIPOLYGON)</label>
      <textarea rows={4} readOnly value={exportText} style={textareaStyle} placeholder="Export preview appears here" />
      <div style={rowStyle}>
        <button type="button" onClick={handleCopy} disabled={!canExport}>
          Copy Export WKT
        </button>
        {copyMessage ? <span style={noteStyle}>{copyMessage}</span> : null}
      </div>
    </section>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  padding: 12
};

const headingStyle: CSSProperties = { margin: "0 0 0.5rem", fontSize: "1rem" };
const labelStyle: CSSProperties = { display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" };
const rowStyle: CSSProperties = { display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.5rem 0" };
const textareaStyle: CSSProperties = { width: "100%", fontFamily: "monospace", fontSize: "0.8rem" };
const errorStyle: CSSProperties = { margin: "0.5rem 0", color: "#991b1b", fontSize: "0.85rem" };
const noteStyle: CSSProperties = { fontSize: "0.8rem", color: "#374151" };
