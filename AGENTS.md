# AGENTS.md

## Repository focus
- Build a Next.js App Router + TypeScript internal geofence polygon builder.
- Keep work milestone-scoped and foundation-first.

## Core technical rules
- Use **MapLibre** for map rendering. Do **not** use Google Maps packages/tools.
- Keep **GeoJSON** as the internal geometry model.
- In later milestones, normalize/export WKT as **MULTIPOLYGON**.

## Change management
- Prefer small diffs and avoid unrelated refactors.
- Do not add backend/auth/database unless explicitly requested.
- Keep UI minimal and functional until feature milestones request richer UX.
