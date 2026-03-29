# Geofence Polygon Builder — Codex Build Spec

## Build this tool

Build an internal web tool that lets an operator create, edit, validate, import, and export map geofences as WKT in this exact output shape:

```text
MULTIPOLYGON(((lng lat,lng lat,...)))
```

Do **not** build this around Google Maps Drawing Manager or other deprecated Google drawing flows.

Use this stack unless there is a compelling implementation reason not to:
- **Next.js + TypeScript**
- **MapLibre GL JS** for the map
- **Terra Draw + MapLibre adapter** for drawing/editing
- **GeoJSON as the internal geometry model**
- **betterknown** for WKT ⇄ GeoJSON parsing/stringifying
- **Local storage** for persistence in v1

The app should be map-first, not text-first.

---

## Core product decision

Internally, store and edit geometry as **GeoJSON**.

At export time, always normalize to **WKT MULTIPOLYGON**, even if the user only drew a single polygon.

That means:
- Accept import of both `POLYGON(...)` and `MULTIPOLYGON(...)`
- Normalize imported `POLYGON` into internal `MultiPolygon`
- Always export as `MULTIPOLYGON(...)`

This is mandatory. Do not make export behavior conditional on geometry count.

---

## Primary goal

The operator should be able to:
1. Search for a location
2. Draw a geofence on the map
3. Edit the boundary precisely
4. Validate the shape
5. Copy or download `MULTIPOLYGON(((...)))`

This tool is for internal operations use, so optimize for speed, clarity, and reliability rather than GIS power-user complexity.

---

## v1 scope — must build

Implement all of the following:

### 1. Map + search
- Render a full interactive map
- Include location search/geocoder
- Allow pan and zoom
- Show cursor coordinates on hover

### 2. Drawing modes
Provide these modes:
- `Select/Edit`
- `Polygon`
- `Freehand`
- `Rectangle`
- `Delete selected`
- `Clear all`

### 3. Geometry editing
The user must be able to:
- draw polygon geometry
- select an existing geometry
- edit vertices
- move geometry if supported cleanly
- delete geometry
- redraw geometry easily

### 4. Import
Support:
- Paste WKT
- Upload GeoJSON

Accepted WKT input types:
- `POLYGON`
- `MULTIPOLYGON`

Rejected WKT input types:
- `POINT`
- `LINESTRING`
- `MULTILINESTRING`
- `GEOMETRYCOLLECTION`

### 5. Export
Support:
- Copy WKT to clipboard
- Download WKT as `.txt`
- Download GeoJSON as `.geojson`

The WKT export must always be in `MULTIPOLYGON(...)` syntax.

### 6. Precision control
Add export precision options:
- 5 decimals
- 6 decimals
- 7 decimals
- 8 decimals

Default to **6 decimals**.

Precision should apply at export time only, unless the user explicitly uses a simplify/round action later.

### 7. Validation
Block export when geometry is invalid.

Validate all of the following:
- geometry exists
- supported geometry type only
- minimum number of vertices
- coordinates within valid longitude/latitude bounds
- ring closure
- no self-intersection
- no empty geometry

### 8. Coordinate preview
Display a live coordinate preview for the selected/current geometry.

### 9. Save/load
Persist named geofences locally in browser storage for v1.

Each saved geofence should include:
- name
- optional notes
- optional market tag
- source type
- geometry
- created/updated timestamps
- export precision

---

## v2 scope — build only after v1 works

Implement later, not before the core flow is stable:

### 1. Image-assisted tracing
Allow the user to:
- upload a screenshot or image
- overlay it on top of the map
- adjust opacity
- manually align/position it over the live map
- trace over it using polygon or freehand tools

Important:
- Do **not** implement fake “automatic screenshot to coordinates” behavior
- This is a **manual alignment + manual tracing** workflow
- Export should always come from traced vector geometry, never from the image itself

### 2. Better editing utilities
- simplify polygon
- reduce points
- fit map to geometry
- undo/redo

### 3. Multiple polygons
Support true multi-part geometry editing and export as:
```text
MULTIPOLYGON(((...)),((...)))
```

---

## Non-goals

Do **not** build these in v1:
- automatic georeferencing of arbitrary screenshots
- full GIS topology editing suite
- CRS/projection switching
- support for holes/interior rings unless it is extremely easy
- collaborative editing
- backend services or auth unless already required by the host app

---

## UX requirements

## Layout

Use a clean 2-pane desktop layout.

### Left panel
Include:
- search box
- tool mode selector
- save/load controls
- shape metadata
- validation messages
- coordinate preview
- import panel
- export panel

### Right panel
Include:
- full-height map
- drawing/editing interactions
- selected geometry rendering
- optional future image overlay rendering

Keep the visual design clean, operational, and uncluttered.

---

## Required UI behavior

### Toolbar
Provide clear controls for:
- select/edit
- polygon
- freehand
- rectangle
- delete selected
- clear all
- fit to geometry

### Import panel
Include:
- WKT paste input
- parse/import button
- GeoJSON upload input
- error message area

### Export panel
Include:
- WKT preview
- format toggle: `WKT` / `GeoJSON`
- precision selector
- copy button
- download button

### Validation display
Show inline validation status.

Use clear operational messages such as:
- “Draw a polygon before exporting.”
- “This geometry is invalid.”
- “Self-intersecting polygons cannot be exported.”
- “Only Polygon and MultiPolygon are supported.”

### Empty state
Show:
- “Search for a location or start drawing a geofence.”

---

## Exact geometry rules

These are mandatory.

### Coordinate order
Always use:
```text
longitude latitude
```

Never reverse to latitude-longitude in WKT output.

### Ring closure
Every polygon ring must be explicitly closed before export:
- first coordinate = last coordinate

### Export type
Always export `MULTIPOLYGON`, even for a single polygon.

### Precision
Default export precision = 6 decimal places.

### Holes
Ignore/support later unless trivial. v1 can assume no holes.

### Self-intersection
If the polygon self-intersects, mark invalid and block export.

### Empty geometry
Never export empty geometry.

---

## Data model to implement

Use these TypeScript types or close equivalents.

```ts
type GeometrySourceType = "drawn" | "imported_wkt" | "imported_geojson" | "traced_image";

type GeofenceRecord = {
  id: string;
  name: string;
  notes?: string;
  market?: string;
  sourceType: GeometrySourceType;
  geometry: GeoJSON.MultiPolygon;
  rawInput?: string;
  exportPrecision: number;
  createdAt: string;
  updatedAt: string;
};

type EditorMode = "select" | "polygon" | "freehand" | "rectangle";

type EditorState = {
  selectedGeofenceId?: string;
  mode: EditorMode;
  isDirty: boolean;
  validationErrors: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
  }>;
  cursorLngLat?: { lng: number; lat: number };
};
```

---

## File structure to create

Use this structure or something very close to it.

```text
/app
  /geofence-builder
    page.tsx

/components
  MapCanvas.tsx
  Toolbar.tsx
  SearchBar.tsx
  ValidationPanel.tsx
  ExportPanel.tsx
  ImportPanel.tsx
  CoordinateTable.tsx
  SaveLoadPanel.tsx
  ImageOverlayPanel.tsx

/lib
  /geometry
    normalize.ts
    validate.ts
    wkt.ts
    geojson.ts
    simplify.ts
    bounds.ts
  /map
    initMap.ts
    initDraw.ts
    styles.ts
  /storage
    geofenceStore.ts
  /types
    geofence.ts
```

If your preferred Next.js file structure differs slightly, keep the logical separation the same.

---

## Implementation instructions

## 1. Map setup

Initialize a MapLibre map that:
- fills the available editor area
- supports navigation controls
- supports geocoder/search
- supports pointer coordinate tracking
- can fit to current geometry bounds

The map must be stable and responsive before drawing logic is added.

---

## 2. Drawing integration

Integrate Terra Draw with the MapLibre adapter.

Set up drawing modes for:
- select/edit
- polygon
- freehand
- rectangle

Do not treat Terra Draw as the sole source of truth.

Instead:
- listen to draw/create/update/delete changes
- read the feature collection from the drawing layer
- normalize it into canonical app state
- derive validation + export output from canonical app state

The canonical app state should be the source of truth for import/export/save.

---

## 3. Geometry normalization pipeline

Build a dedicated geometry pipeline.

### Required utilities

Implement these functions:

```ts
normalizePolygonToMultiPolygon(...)
normalizeAnySupportedGeometryToMultiPolygon(...)
ensureClosedRings(...)
roundCoordinates(...)
isSupportedGeometryType(...)
hasMinimumVertices(...)
hasCoordinatesInBounds(...)
hasSelfIntersection(...)
validateMultiPolygon(...)
toWktMultiPolygon(...)
fromWktToMultiPolygon(...)
toGeoJsonExport(...)
```

### Rules
- If input is `Polygon`, convert to `MultiPolygon`
- If input is already `MultiPolygon`, keep it
- If input is unsupported, reject it
- Ensure ring closure before export
- Apply precision only during export
- Keep full precision internally

---

## 4. WKT import/export layer

Wrap the WKT library in your own internal utility module.

UI components must not call the WKT library directly.

### `wkt.ts` should handle:
- parsing WKT input
- rejecting unsupported geometry types
- converting Polygon → MultiPolygon
- serializing MultiPolygon → WKT
- ensuring exact `MULTIPOLYGON(...)` output
- throwing/returning clean parse errors

### Export contract
A single polygon should export like:

```text
MULTIPOLYGON(((-87.59288588495576 20.374177104180983,-87.60541716547334 20.362751214307842,-87.6033572289499 20.342794110856197,-87.5865344140085 20.32975622389493,-87.56610671015108 20.33539001366791,-87.56284514398897 20.352612040450143,-87.56919661493623 20.36677451145885,-87.57983962030733 20.374177104180983,-87.59288588495576 20.374177104180983)))
```

Maintain exact WKT syntax and longitude-latitude ordering.

---

## 5. Validation system

Create a dedicated validation layer.

Return structured validation results like:

```ts
type ValidationResult = {
  valid: boolean;
  errors: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
  }>;
};
```

### Validation checks
Run these checks before allowing export:
1. geometry exists
2. supported type only
3. at least 3 distinct points in ring
4. ring closure
5. longitude between -180 and 180
6. latitude between -90 and 90
7. no self-intersection
8. no malformed coordinate arrays

Block export if any error-level validation fails.

---

## 6. Storage layer

Implement a simple browser persistence layer.

Use local storage or IndexedDB. Local storage is fine for v1.

Persist:
- saved geofences
- last selected geofence
- user preferences such as precision and last mode

Suggested storage keys:
```text
geofence-builder.records
geofence-builder.last-view
geofence-builder.user-settings
```

Add save/load/delete flows in the UI.

---

## 7. Coordinate preview

Render a coordinate table for the currently selected/current geometry.

Requirements:
- show ordered vertex list
- show lng and lat separately
- reflect currently selected precision in export preview, but preserve full precision internally
- update live as geometry changes

---

## 8. Image overlay tracing — v2 only

When implementing image-assisted tracing, use this flow:

1. Upload PNG/JPG
2. Render image as a map overlay
3. Allow manual alignment/placement over the map
4. Add opacity control
5. Let the user trace over the image with polygon/freehand
6. Export traced vector geometry only

Do not attempt automatic screenshot coordinate extraction unless there is an actual georeferencing system in place.

This mode is optional and should be isolated from the main v1 geometry pipeline.

---

## Build order

Follow this order.

### Milestone 1 — foundation
- create page shell
- create 2-pane layout
- initialize MapLibre map
- add geocoder/search
- add basic toolbar shell
- display cursor coordinates

### Milestone 2 — drawing
- integrate Terra Draw
- add polygon mode
- add select/edit mode
- add freehand mode
- add rectangle mode
- sync drawn features into app state

### Milestone 3 — geometry pipeline
- add normalization utilities
- add validation layer
- add WKT import/export wrapper
- derive live WKT preview from app state
- block export on invalid geometry

### Milestone 4 — operator workflow
- add import panel
- add export panel
- add copy/download actions
- add coordinate table
- add save/load/delete locally

### Milestone 5 — polish
- add fit-to-geometry
- improve validation UX
- improve empty states
- add simplify if easy
- add undo/redo if clean

### Milestone 6 — image tracing
- add image upload
- add manual image overlay controls
- add opacity slider
- support tracing over image

---

## Acceptance criteria

The build is complete only when all of these are true:

1. User can search a place and recenter the map.
2. User can draw a polygon directly on the map.
3. User can edit polygon vertices after drawing.
4. User can use freehand mode.
5. User can use rectangle mode.
6. User can paste valid `POLYGON(...)` WKT and render it.
7. User can paste valid `MULTIPOLYGON(...)` WKT and render it.
8. User can export a single polygon as `MULTIPOLYGON(...)`.
9. User can choose export precision.
10. User can copy WKT with one click.
11. User can download GeoJSON.
12. Invalid geometry blocks export.
13. Validation messages are visible and understandable.
14. Saved geofences persist locally across reloads.
15. The app does not crash on malformed WKT input.
16. The WKT output uses `longitude latitude` ordering.
17. The first and last point in each ring are identical in exported WKT.

---

## Engineering notes

- Keep the app operational and clean, not GIS-enterprise style.
- Do not overcomplicate the state model.
- Prefer small reusable utility modules for geometry logic.
- Do not bury geometry normalization inside UI components.
- Treat export correctness as more important than fancy UI polish.
- Build the simplest working local-first version first.
- Avoid introducing a backend unless absolutely required.

---

## Final instruction

Build a working internal geofence editor that is production-usable for operations teams.

The most important outcomes are:
1. reliable drawing/editing
2. clean validation
3. exact `MULTIPOLYGON(...)` export
4. stable WKT import
5. minimal operator friction

Prioritize correctness and usability over extra features.
