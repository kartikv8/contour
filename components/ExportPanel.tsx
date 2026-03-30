type ExportPanelProps = {
  precision: number;
  wktPreview: string;
  canExport: boolean;
  onPrecisionChange: (precision: number) => void;
  onCopy: () => void;
};

const PRECISION_OPTIONS = [5, 6, 7, 8];

export function ExportPanel({ precision, wktPreview, canExport, onPrecisionChange, onCopy }: ExportPanelProps) {
  return (
    <section className="panel" aria-label="Export panel">
      <h2>Export</h2>
      <label htmlFor="precision">Precision</label>
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
      <textarea className="text-area" readOnly value={wktPreview} />
      <div className="panel-actions">
        <button type="button" disabled={!canExport} onClick={onCopy}>
          Copy WKT
        </button>
      </div>
      {!canExport ? <p className="error-text">Fix validation errors to export.</p> : null}
    </section>
  );
}
