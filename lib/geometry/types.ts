export type EditorMode = "select" | "polygon" | "rectangle";

export type ShapeRecord = {
  id: string;
  name: string;
  polygon: GeoJSON.Polygon;
  tags?: string[];
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
};

export type MetadataImportEntry = {
  id: string;
  name: string;
  polygon: string;
  tags?: string[];
};
