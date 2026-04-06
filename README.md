# Contour

**Contour is a precision geospatial editor for defining, validating, and exporting polygon-based zones.**

It’s built for operational use cases where shape accuracy, boundary integrity, and clean data export matter — not just drawing on a map.

---

## Why Contour exists

Most map drawing tools are optimized for visualization.

Contour is built for **systems that depend on geometry**:
- Dispatch and routing logic  
- Pricing zones  
- Geofencing and compliance boundaries  
- Marketplace supply/demand segmentation  

In these systems, **bad geometry = bad outcomes**.

Contour ensures:
- Shapes are **precise**
- Boundaries are **intentional**
- Overlaps are **explicit and controlled**

---

## Core capabilities

### Shape creation & editing
- Draw and edit polygons with full vertex control  
- Move, refine, and reshape boundaries with precision  

### Overlap detection
- Automatically detects intersecting regions between shapes  
- Highlights overlaps directly on the map  
- Surfaces structured warnings for operational clarity  

### Snap-to-geometry
- Vertex-first snapping for exact alignment  
- Edge snapping fallback for clean adjacency  
- Threshold-based behavior to avoid accidental snaps  

### Shape metadata
- Each shape has:
  - ID (stable, system-friendly)
  - Name (human-readable)
  - Tags (optional classification)
- Inline editing with immediate state updates  

### Map ↔ Data linkage
- Shapes are labeled directly on the map  
- Selecting a shape highlights its metadata  
- Editing metadata reflects instantly across the system  

### Import & export
- Import polygons with metadata  
- Export clean WKT for downstream systems  
- Structured output designed for backend consumption  

---

## Design principles

Contour is built around a few non-negotiables:

- **Canonical state first**  
  The map is a view — the source of truth is structured shape data.

- **Deterministic behavior**  
  No hidden mutations, no ambiguous edits.

- **Operational clarity > visual polish**  
  Every interaction should reduce ambiguity.

- **Minimal but powerful UX**  
  No clutter. Every feature earns its place.

---

## Use cases

- Ride dispatch zoning (Uber/Flywheel-style systems)  
- Dynamic pricing boundaries  
- City / region segmentation  
- Logistics and routing constraints  
- Compliance geofencing  

---

## Status

**Actively evolving**

Recent additions:
- Metadata editing (name + tags)
- Snap-to-vertex / edge
- Overlap detection + map visualization
- Map ↔ metadata linkage

---

## What’s next

- Manual snap (tap → target snapping)
- Better overlap resolution workflows
- Zone versioning / history
- Multi-user collaboration
