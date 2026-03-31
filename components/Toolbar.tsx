import { EditorMode } from "../lib/geometry/types";

type ToolbarProps = {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onClearAll: () => void;
  onDeleteSelected: () => void;
};

const MODES: EditorMode[] = ["select", "polygon", "rectangle"];

export function Toolbar({ mode, onModeChange, onClearAll, onDeleteSelected }: ToolbarProps) {
  return (
    <section className="panel" aria-label="Toolbar">
      <h2>Toolbar</h2>
      <div className="toolbar-row">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onModeChange(option)}
            className={option === mode ? "toolbar-button active" : "toolbar-button"}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="toolbar-row toolbar-actions">
        <button type="button" onClick={onDeleteSelected} className="toolbar-button">
          Delete selected
        </button>
        <button type="button" onClick={onClearAll} className="toolbar-button">
          Clear all
        </button>
      </div>
    </section>
  );
}
