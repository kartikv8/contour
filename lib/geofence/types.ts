import type { Feature, MultiPolygon, Polygon } from "geojson";

export type SupportedGeofenceGeometry = Polygon | MultiPolygon;

export type GeofenceFeature = Feature<SupportedGeofenceGeometry>;

export type DrawMode = "select" | "polygon" | "rectangle" | "delete-selection";

export type PrecisionOption = 5 | 6 | 7 | 8;

export type GeofenceValidationResult = {
  isValid: boolean;
  errors: string[];
};
