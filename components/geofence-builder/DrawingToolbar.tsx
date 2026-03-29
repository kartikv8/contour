"use client";

import type { CSSProperties } from "react";
import type { DrawMode } from "@/lib/geofence/types";

type DrawingToolbarProps = {
  modes: DrawMode[];
  activeMode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
};

export function DrawingToolbar({ modes, activeMode, onModeChange }: DrawingToolbarProps) {
  return (
    <section style={panelStyle}>
      <h2 style={headingStyle}>Toolbar</h2>
      <div style={buttonRowStyle}>
        {modes.map((mode) => {
          const isActive = mode === activeMode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              style={isActive ? activeButtonStyle : buttonStyle}
            >
              {mode}
            </button>
          );
        })}
      </div>
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
const buttonRowStyle: CSSProperties = { display: "flex", gap: "0.4rem", flexWrap: "wrap" };
const buttonStyle: CSSProperties = {
  padding: "0.3rem 0.55rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff"
};
const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #2563eb",
  background: "#dbeafe",
  color: "#1e40af",
  fontWeight: 600
};
