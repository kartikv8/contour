import { KeyboardEvent, useState } from "react";
import { ValidationIssue } from "../lib/geometry/types";

type ShapeExportEntry = {
  id: string;
  name: string;
  tags: string[];
  wkt: string;
  valid: boolean;
  errors: ValidationIssue[];
  selected: boolean;
};

type ExportWktPanelProps = {
  precision: number;
  shapeExports: ShapeExportEntry[];
  combinedWkt: string;
  activeShapeId: string | null;
  onPrecisionChange: (precision: number) => void;
  onCopyShape: (shapeId: string) => void;
  onCopyCombined: () => void;
  onToggleShape: (shapeId: string) => void;
  onClearSelected: () => void;
  onShapeNameChange: (shapeId: string, name: string) => void;
  onShapeTagsChange: (shapeId: string, rawTags: string) => void;
  onSetActiveShape: (shapeId: string) => void;
};

const PRECISION_OPTIONS = [5, 6, 7, 8];

export function ExportWktPanel({
  precision,
  shapeExports,
  combinedWkt,
  activeShapeId,
  onPrecisionChange,
  onCopyShape,
  onCopyCombined,
  onToggleShape,
  onClearSelected,
  onShapeNameChange,
  onShapeTagsChange,
  onSetActiveShape,
}: ExportWktPanelProps) {
  const hasSelected = shapeExports.some((shape) => shape.selected);
  const [tagDraftById, setTagDraftById] = useState<Record<string, string>>({});

  const commitTags = (shapeId: string, rawValue: string) => {
    onShapeTagsChange(shapeId, rawValue);
    setTagDraftById((previous) => {
      const next = { ...previous };
      delete next[shapeId];
      return next;
    });
  };

  const handleTagsKeyDown = (shapeId: string, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const value = event.currentTarget.value;
    commitTags(shapeId, value);
    event.currentTarget.blur();
  };

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

      <div className="panel-actions">
        <button type="button" disabled={!hasSelected} onClick={onClearSelected}>
          Clear selected
        </button>
      </div>

      {shapeExports.length === 0 ? <p className="muted">Draw or import shapes to export.</p> : null}
      {shapeExports.map((entry) => (
        <div
          key={entry.id}
          className={`shape-export-row${entry.id === activeShapeId ? " active" : ""}`}
          onClick={() => onSetActiveShape(entry.id)}
        >
          <label className="shape-export-title">
            <input
              type="checkbox"
              checked={entry.selected}
              onChange={() => onToggleShape(entry.id)}
            />{" "}
            {entry.name}
          </label>
          <p className="muted metadata-row">ID: {entry.id}</p>
          <label className="metadata-field" htmlFor={`shape-name-${entry.id}`}>
            Name
          </label>
          <input
            id={`shape-name-${entry.id}`}
            className="metadata-input"
            type="text"
            value={entry.name}
            onChange={(event) => onShapeNameChange(entry.id, event.target.value)}
            onFocus={() => onSetActiveShape(entry.id)}
          />
          <label className="metadata-field" htmlFor={`shape-tags-${entry.id}`}>
            Tags (comma-separated)
          </label>
          <input
            id={`shape-tags-${entry.id}`}
            className="metadata-input"
            type="text"
            value={tagDraftById[entry.id] ?? entry.tags.join(", ")}
            onChange={(event) =>
              setTagDraftById((previous) => ({
                ...previous,
                [entry.id]: event.target.value,
              }))
            }
            onBlur={(event) => commitTags(entry.id, event.target.value)}
            onKeyDown={(event) => handleTagsKeyDown(entry.id, event)}
            onFocus={() => onSetActiveShape(entry.id)}
          />
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
