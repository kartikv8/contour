import type { MultiPolygon, Polygon } from "geojson";
import type { SupportedGeofenceGeometry } from "@/lib/geofence/types";

function closeRing(ring: number[][]): number[][] {
  if (ring.length === 0) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  return isClosed ? ring : [...ring, [first[0], first[1]]];
}

function closePolygonRings(polygon: Polygon): Polygon {
  return {
    ...polygon,
    coordinates: polygon.coordinates.map(closeRing)
  };
}

export function normalizeToMultiPolygon(geometry: SupportedGeofenceGeometry): MultiPolygon {
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map(closeRing))
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: [closePolygonRings(geometry).coordinates]
  };
}
