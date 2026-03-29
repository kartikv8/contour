import type { CSSProperties } from "react";
import type { SupportedGeofenceGeometry } from "@/lib/geofence/types";
import { normalizeToMultiPolygon } from "@/lib/geofence/normalize";

type CoordinatePreviewProps = {
  geometry: SupportedGeofenceGeometry | null;
  precision?: number;
};

export function CoordinatePreview({ geometry, precision = 6 }: CoordinatePreviewProps) {
  const rows = geometry
    ? normalizeToMultiPolygon(geometry).coordinates[0]?.[0]?.map((position, index) => ({
        index: index + 1,
        lng: position[0].toFixed(precision),
        lat: position[1].toFixed(precision)
      })) ?? []
    : [];

  return (
    <section style={panelStyle}>
      <h2 style={headingStyle}>Coordinate Preview</h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem" }}>No active geometry coordinates.</p>
      ) : (
        <ol style={listStyle}>
          {rows.map((row) => (
            <li key={row.index}>
              <span style={monoStyle}>lng: {row.lng}</span> <span style={monoStyle}>lat: {row.lat}</span>
            </li>
          ))}
        </ol>
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
const listStyle: CSSProperties = { margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" };
const monoStyle: CSSProperties = { fontFamily: "monospace" };
