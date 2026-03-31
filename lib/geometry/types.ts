export type EditorMode = "select" | "polygon" | "rectangle";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
};
