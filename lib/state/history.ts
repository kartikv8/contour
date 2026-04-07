import { ShapeRecord } from "../geometry/types";

const MAX_HISTORY_ENTRIES = 50;

export type HistoryState = {
  past: ShapeRecord[][];
  future: ShapeRecord[][];
};

function cloneShapesSnapshot(shapes: ShapeRecord[]): ShapeRecord[] {
  return shapes.map((shape) => ({
    ...shape,
    tags: shape.tags ? [...shape.tags] : undefined,
    polygon: {
      type: "Polygon",
      coordinates: shape.polygon.coordinates.map((ring) => ring.map(([lng, lat]) => [lng, lat])),
    },
  }));
}

export function areShapeSnapshotsEqual(a: ShapeRecord[], b: ShapeRecord[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createHistoryState(): HistoryState {
  return {
    past: [],
    future: [],
  };
}

export function commitHistoryEntry(history: HistoryState, current: ShapeRecord[]): HistoryState {
  const currentSnapshot = cloneShapesSnapshot(current);
  const nextPast = [...history.past, currentSnapshot].slice(-MAX_HISTORY_ENTRIES);

  return {
    past: nextPast,
    future: [],
  };
}

export function undoHistory(history: HistoryState, current: ShapeRecord[]) {
  if (history.past.length === 0) {
    return null;
  }

  const target = history.past[history.past.length - 1];
  const nextPast = history.past.slice(0, -1);

  return {
    shapes: cloneShapesSnapshot(target),
    history: {
      past: nextPast,
      future: [cloneShapesSnapshot(current), ...history.future].slice(0, MAX_HISTORY_ENTRIES),
    } satisfies HistoryState,
  };
}

export function redoHistory(history: HistoryState, current: ShapeRecord[]) {
  if (history.future.length === 0) {
    return null;
  }

  const [target, ...nextFuture] = history.future;

  return {
    shapes: cloneShapesSnapshot(target),
    history: {
      past: [...history.past, cloneShapesSnapshot(current)].slice(-MAX_HISTORY_ENTRIES),
      future: nextFuture,
    } satisfies HistoryState,
  };
}
