import { EditorMode } from "../lib/geometry/types";

type ToolbarProps = {
  mode: EditorMode;
  canUndo: boolean;
  canRedo: boolean;
  onModeChange: (mode: EditorMode) => void;
  onUndo: () => void;
  onRedo: () => void;
};

const MODES: EditorMode[] = ["select", "polygon", "rectangle"];

export function Toolbar({ mode, canUndo, canRedo, onModeChange, onUndo, onRedo }: ToolbarProps) {
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
      <div className="toolbar-row">
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </div>
    </section>
  );
}
