import { ValidationIssue } from "../lib/geometry/types";

type ShapeExportEntry = {
  id: string;
  wkt: string;
  valid: boolean;
  errors: ValidationIssue[];
  selected: boolean;
};

type ExportWktPanelProps = {
  precision: number;
  shapeExports: ShapeExportEntry[];
  combinedWkt: string;
  onPrecisionChange: (precision: number) => void;
  onCopyShape: (shapeId: string) => void;
  onCopyCombined: () => void;
  onToggleShape: (shapeId: string) => void;
  onDeleteSelected: () => void;
  onClearSelected: () => void;
};

const PRECISION_OPTIONS = [5, 6, 7, 8];

export function ExportWktPanel({
  precision,
  shapeExports,
  combinedWkt,
  onPrecisionChange,
  onCopyShape,
  onCopyCombined,
  onToggleShape,
  onDeleteSelected,
  onClearSelected,
}: ExportWktPanelProps) {
  const hasSelected = shapeExports.some((shape) => shape.selected);

  return (
    <section className="panel" aria-label="Export WKT panel">
      <h2>Export WKT</h2>
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

      <div className="panel-actions toolbar-row">
        <button type="button" disabled={!hasSelected} onClick={onDeleteSelected}>
          Delete selected
        </button>
        <button type="button" disabled={!hasSelected} onClick={onClearSelected}>
          Clear selected
        </button>
      </div>

      {shapeExports.length === 0 ? <p className="muted">Draw or import shapes to export.</p> : null}
      {shapeExports.map((entry, index) => (
        <div key={entry.id} className="shape-export-row">
          <label className="shape-export-title">
            <input
              type="checkbox"
              checked={entry.selected}
              onChange={() => onToggleShape(entry.id)}
            />{" "}
            Shape {index + 1}
          </label>
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
        <div className="shape-export-row">
          <p className="shape-export-title">Combined MULTIPOLYGON</p>
          <textarea className="text-area" readOnly value={combinedWkt} />
          <div className="panel-actions">
            <button type="button" onClick={onCopyCombined}>
              Copy combined WKT
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
