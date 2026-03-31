function samePair(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function ensureClosedRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!samePair(first, last)) {
    return [...ring, [first[0], first[1]]];
  }

  return ring;
}

export function normalizePolygonToMultiPolygon(polygon: GeoJSON.Polygon): GeoJSON.MultiPolygon {
  const rings = polygon.coordinates.map((ring) => ensureClosedRing(ring as [number, number][]));
  return { type: "MultiPolygon", coordinates: [rings] };
}

export function normalizeAnySupportedGeometryToMultiPolygon(geometry: GeoJSON.Geometry): GeoJSON.MultiPolygon {
  if (geometry.type === "Polygon") {
    return normalizePolygonToMultiPolygon(geometry);
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => ensureClosedRing(ring as [number, number][])),
      ),
    };
  }

  throw new Error("Only Polygon and MultiPolygon are supported.");
}

export function multipolygonFromPolygons(polygons: GeoJSON.Polygon[]): GeoJSON.MultiPolygon | null {
  if (polygons.length === 0) {
    return null;
  }

  return {
    type: "MultiPolygon",
    coordinates: polygons.map((polygon) =>
      polygon.coordinates.map((ring) => ensureClosedRing(ring as [number, number][])),
    ),
  };
}

export function roundCoordinates(geometry: GeoJSON.MultiPolygon, precision: number): GeoJSON.MultiPolygon {
  const factor = 10 ** precision;
  const round = (value: number) => Math.round(value * factor) / factor;

  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon.map((ring) =>
        ring.map((coordinate) => {
          const [lng, lat] = coordinate;
          return [round(lng), round(lat)];
        }),
      ),
    ),
  };
}
