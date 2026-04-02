import { OverlapPair } from "../lib/geometry/overlap";

type OverlapWarningsPanelProps = {
  shapeCount: number;
  overlaps: OverlapPair[];
  shapeLabelsById: Record<string, string>;
  activePairKey: string | null;
  onSelectOverlap: (pairKey: string) => void;
};

export function OverlapWarningsPanel({
  shapeCount,
  overlaps,
  shapeLabelsById,
  activePairKey,
  onSelectOverlap,
}: OverlapWarningsPanelProps) {
  return (
    <section className="panel" aria-label="Overlap warnings">
      <h2>Overlap Warnings</h2>
      {shapeCount < 2 ? <p className="muted">Draw or import at least 2 shapes to check overlaps</p> : null}
      {shapeCount >= 2 && overlaps.length === 0 ? <p className="muted">No overlaps detected</p> : null}
      {shapeCount >= 2 && overlaps.length > 0 ? (
        <>
          <p className="warning-summary">
            {overlaps.length} overlaps detected across {shapeCount} shapes
          </p>
          <div className="overlap-list" role="list">
            {overlaps.map((overlap) => (
              <button
                key={overlap.pairKey}
                type="button"
                role="listitem"
                className={`overlap-row${activePairKey === overlap.pairKey ? " active" : ""}`}
                onClick={() => onSelectOverlap(overlap.pairKey)}
              >
                {shapeLabelsById[overlap.shapeAId] ?? overlap.shapeAId} overlaps {shapeLabelsById[overlap.shapeBId] ?? overlap.shapeBId}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
