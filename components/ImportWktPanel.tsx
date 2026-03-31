type ImportWktPanelProps = {
  wktInput: string;
  importError: string | null;
  onWktInputChange: (value: string) => void;
  onImportWkt: () => void;
};

export function ImportWktPanel({ wktInput, importError, onWktInputChange, onImportWkt }: ImportWktPanelProps) {
  return (
    <section className="panel" aria-label="Import WKT panel">
      <h2>Import WKT</h2>
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
    </section>
  );
}
