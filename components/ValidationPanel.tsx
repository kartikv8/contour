import { ValidationIssue } from "../lib/geometry/types";

type ValidationPanelProps = {
  valid: boolean;
  errors: ValidationIssue[];
};

export function ValidationPanel({ valid, errors }: ValidationPanelProps) {
  return (
    <section className="panel" aria-label="Validation panel">
      <h2>Validation</h2>
      <p>{valid ? "Geometry is valid." : "This geometry is invalid."}</p>
      {errors.length > 0 ? (
        <ul>
          {errors.map((error) => (
            <li key={`${error.code}-${error.message}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
