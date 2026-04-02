type ImportWktPanelProps = {
  importMode: "wkt" | "json";
  wktInput: string;
  jsonInput: string;
  importErrors: string[];
  onImportModeChange: (mode: "wkt" | "json") => void;
  onWktInputChange: (value: string) => void;
  onJsonInputChange: (value: string) => void;
  onImportWkt: () => void;
  onImportJson: () => void;
};

export function ImportWktPanel({
  importMode,
  wktInput,
  jsonInput,
  importErrors,
  onImportModeChange,
  onWktInputChange,
  onJsonInputChange,
  onImportWkt,
  onImportJson,
}: ImportWktPanelProps) {
  return (
    <section className="panel" aria-label="Import panel">
      <h2>Import</h2>

      <div className="toolbar-row" role="tablist" aria-label="Import mode selector">
        <button
          type="button"
          role="tab"
          aria-selected={importMode === "wkt"}
          className={`toolbar-button${importMode === "wkt" ? " active" : ""}`}
          onClick={() => onImportModeChange("wkt")}
        >
          WKT
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={importMode === "json"}
          className={`toolbar-button${importMode === "json" ? " active" : ""}`}
          onClick={() => onImportModeChange("json")}
        >
          JSON
        </button>
      </div>

      {importMode === "wkt" ? (
        <>
          <p className="muted import-helper-text">Supports POLYGON and MULTIPOLYGON. Metadata will be auto-generated.</p>
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
        </>
      ) : (
        <>
          <p className="muted import-helper-text">
            Expected JSON: [&#123; &quot;id&quot;: &quot;zone_a&quot;, &quot;name&quot;: &quot;Zone A&quot;, &quot;polygon&quot;:
            &quot;POLYGON((...))&quot;, &quot;tags&quot;: [&quot;optional&quot;] &#125;]
          </p>
          <textarea
            className="text-area"
            placeholder='Paste JSON array: [{"id":"zone_a","name":"Zone A","polygon":"POLYGON((...))"}]'
            value={jsonInput}
            onChange={(event) => onJsonInputChange(event.target.value)}
          />
          <div className="panel-actions">
            <button type="button" onClick={onImportJson}>
              Import JSON metadata
            </button>
          </div>
        </>
      )}

      {importErrors.length > 0
        ? importErrors.map((error) => (
            <p key={error} className="error-text">
              {error}
            </p>
          ))
        : null}
    </section>
  );
}
