import type { CSSProperties } from "react";
import type { GeofenceValidationResult } from "@/lib/geofence/types";

type ValidationPanelProps = {
  validation: GeofenceValidationResult;
};

export function ValidationPanel({ validation }: ValidationPanelProps) {
  return (
    <section style={panelStyle}>
      <h2 style={headingStyle}>Validation</h2>
      <p style={{ margin: "0 0 0.5rem", color: validation.isValid ? "#166534" : "#991b1b" }}>
        {validation.isValid ? "Geometry is exportable." : "Geometry is not exportable."}
      </p>
      {validation.errors.length > 0 ? (
        <ul style={listStyle}>
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: "0.85rem" }}>No validation errors.</p>
      )}
    </section>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  padding: 12
};

const headingStyle: CSSProperties = { margin: "0 0 0.5rem", fontSize: "1rem" };
const listStyle: CSSProperties = { margin: 0, paddingLeft: "1rem", fontSize: "0.85rem" };
