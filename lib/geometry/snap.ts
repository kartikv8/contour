import type { Position } from "geojson";

export type PolygonCandidate = {
  id: string;
  rings: Position[][];
};

export type SnapResolverInput = {
  point: Position;
  candidates: PolygonCandidate[];
  project: (lng: number, lat: number) => { x: number; y: number };
  unproject: (x: number, y: number) => { lng: number; lat: number };
  thresholdPx: number;
  ambiguityTolerancePx: number;
};

function distancePx(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isSamePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function nearestPointOnSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;

  if (lengthSq === 0) {
    return { x: a.x, y: a.y, t: 0 };
  }

  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSq));

  return {
    x: a.x + abx * t,
    y: a.y + aby * t,
    t,
  };
}

function flattenVertices(candidates: PolygonCandidate[]): Position[] {
  return candidates.flatMap((shape) =>
    shape.rings.flatMap((ring) => {
      const uniqueRing = ring.filter((coordinate, index) => {
        const isClosingCoordinate = index === ring.length - 1 && ring.length > 1 && isSamePosition(coordinate, ring[0]);
        return !isClosingCoordinate;
      });

      return uniqueRing;
    }),
  );
}

function flattenSegments(candidates: PolygonCandidate[]): Array<{ start: Position; end: Position }> {
  const segments: Array<{ start: Position; end: Position }> = [];

  candidates.forEach((shape) => {
    shape.rings.forEach((ring) => {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const start = ring[index];
        const end = ring[index + 1];

        if (isSamePosition(start, end)) {
          continue;
        }

        segments.push({ start, end });
      }
    });
  });

  return segments;
}

function hasAmbiguousDistance(distances: number[], ambiguityTolerancePx: number): boolean {
  if (distances.length < 2) {
    return false;
  }

  const sorted = [...distances].sort((a, b) => a - b);
  return Math.abs(sorted[1] - sorted[0]) <= ambiguityTolerancePx;
}

export function resolveSnapTarget(input: SnapResolverInput): Position | undefined {
  const {
    point,
    candidates,
    project,
    unproject,
    thresholdPx,
    ambiguityTolerancePx,
  } = input;

  if (candidates.length === 0) {
    return undefined;
  }

  const projectedPoint = project(point[0], point[1]);

  const vertexHits = flattenVertices(candidates)
    .map((vertex) => ({
      coordinate: vertex,
      distance: distancePx(projectedPoint, project(vertex[0], vertex[1])),
    }))
    .filter((hit) => hit.distance <= thresholdPx);

  if (vertexHits.length > 0) {
    if (hasAmbiguousDistance(vertexHits.map((hit) => hit.distance), ambiguityTolerancePx)) {
      return undefined;
    }

    const nearestVertex = vertexHits.reduce((best, current) => (current.distance < best.distance ? current : best));
    return [nearestVertex.coordinate[0], nearestVertex.coordinate[1]];
  }

  const segmentHits = flattenSegments(candidates)
    .map((segment) => {
      const projectedStart = project(segment.start[0], segment.start[1]);
      const projectedEnd = project(segment.end[0], segment.end[1]);
      const nearestPoint = nearestPointOnSegment(projectedPoint, projectedStart, projectedEnd);
      return {
        nearestPoint,
        distance: distancePx(projectedPoint, nearestPoint),
      };
    })
    .filter((hit) => hit.distance <= thresholdPx);

  if (segmentHits.length === 0) {
    return undefined;
  }

  if (hasAmbiguousDistance(segmentHits.map((hit) => hit.distance), ambiguityTolerancePx)) {
    return undefined;
  }

  const nearestSegmentHit = segmentHits.reduce((best, current) => (current.distance < best.distance ? current : best));
  const unprojected = unproject(nearestSegmentHit.nearestPoint.x, nearestSegmentHit.nearestPoint.y);

  return [unprojected.lng, unprojected.lat];
}
