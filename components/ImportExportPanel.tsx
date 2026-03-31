import { ValidationIssue } from "../lib/geometry/types";

type ShapeExportEntry = {
  id: string;
  wkt: string;
  valid: boolean;
  errors: ValidationIssue[];
};

type ImportExportPanelProps = {
  wktInput: string;
  importError: string | null;
  precision: number;
  shapeExports: ShapeExportEntry[];
  combinedWkt: string;
  onWktInputChange: (value: string) => void;
  onImportWkt: () => void;
  onPrecisionChange: (precision: number) => void;
  onCopyShape: (shapeId: string) => void;
  onCopyCombined: () => void;
};

const PRECISION_OPTIONS = [5, 6, 7, 8];

export function ImportExportPanel({
  wktInput,
  importError,
  precision,
  shapeExports,
  combinedWkt,
  onWktInputChange,
  onImportWkt,
  onPrecisionChange,
  onCopyShape,
  onCopyCombined,
}: ImportExportPanelProps) {
  return (
    <section className="panel" aria-label="Import and export panel">
      <h2>Import / Export</h2>
      <textarea
        className="text-area"
        placeholder="Paste POLYGON(...) or MULTIPOLYGON(...)"
        value={wktInput}
        onChange={(event) => onWktInputChange(event.target.value)}
      />
      <div className="panel-actions">
        <button type="button" onClick={onImportWkt}>
          Import WKT
        </button>
      </div>
      {importError ? <p className="error-text">{importError}</p> : null}

      <label htmlFor="precision">Export precision</label>
      <select
        id="precision"
        value={precision}
        onChange={(event) => onPrecisionChange(Number(event.target.value))}
      >
        {PRECISION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <h3>Per-shape WKT</h3>
      {shapeExports.length === 0 ? <p className="muted">Draw or import shapes to export.</p> : null}
      {shapeExports.map((entry, index) => (
        <div key={entry.id} className="shape-export-row">
          <p className="shape-export-title">Shape {index + 1}</p>
          <textarea className="text-area" readOnly value={entry.wkt} />
          <div className="panel-actions">
            <button type="button" disabled={!entry.valid} onClick={() => onCopyShape(entry.id)}>
              Copy shape WKT
            </button>
          </div>
          {!entry.valid
            ? entry.errors.map((error) => (
                <p key={`${entry.id}-${error.code}-${error.message}`} className="error-text">
                  {error.message}
                </p>
              ))
            : null}
        </div>
      ))}

      {combinedWkt ? (
        <>
          <h3>Combined MULTIPOLYGON</h3>
          <textarea className="text-area" readOnly value={combinedWkt} />
          <div className="panel-actions">
            <button type="button" onClick={onCopyCombined}>
              Copy combined WKT
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
