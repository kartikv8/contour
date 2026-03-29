"use client";

import { useMemo, useState } from "react";
import { CoordinatePreview } from "@/components/geofence-builder/CoordinatePreview";
import { DrawingToolbar } from "@/components/geofence-builder/DrawingToolbar";
import { ImportExportPanel } from "@/components/geofence-builder/ImportExportPanel";
import { MapCanvas } from "@/components/geofence-builder/MapCanvas";
import { ValidationPanel } from "@/components/geofence-builder/ValidationPanel";
import { getEnabledDrawModes } from "@/lib/geofence/draw";
import type { DrawMode, PrecisionOption, SupportedGeofenceGeometry } from "@/lib/geofence/types";
import { validateGeometry } from "@/lib/geofence/validate";

const modes = getEnabledDrawModes();

export function GeofenceBuilderClient() {
  const [activeMode, setActiveMode] = useState<DrawMode>("select");
  const [precision, setPrecision] = useState<PrecisionOption>(6);
  const [geometry, setGeometry] = useState<SupportedGeofenceGeometry | null>(null);

  const validation = useMemo(() => validateGeometry(geometry), [geometry]);

  return (
    <main style={{ padding: "1rem", minHeight: "100vh" }}>
      <h1 style={{ marginTop: 0 }}>Geofence Builder</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "1rem",
          alignItems: "start"
        }}
      >
        <aside style={{ display: "grid", gap: "0.75rem" }}>
          <DrawingToolbar modes={modes} activeMode={activeMode} onModeChange={setActiveMode} />
          <ImportExportPanel
            geometry={geometry}
            validation={validation}
            precision={precision}
            onPrecisionChange={setPrecision}
            onImportedGeometry={setGeometry}
          />
          <ValidationPanel validation={validation} />
          <CoordinatePreview geometry={geometry} />
        </aside>
        <section>
          <MapCanvas activeMode={activeMode} geometry={geometry} onGeometryChange={setGeometry} />
        </section>
      </div>
    </main>
  );
}
