# 3D Furniture Showroom — Design Spec

**Date**: 2026-07-16
**Status**: Approved by user (brainstorming session)
**Route**: `/showroom`, linked from the main furniture-finder page

## Goal

An interactive page where the user draws a house floorplan on a 2D grid, adds
interior walls and doors to form rooms, converts it to a navigable 3D house,
and furnishes it with items — either photos they import or products from the
existing furniture-finder search — placed only on floors and walls, at real
scale.

## Decisions made

| Decision | Choice | Rationale |
|---|---|---|
| 3D library | Three.js via `@react-three/fiber` + `@react-three/drei` | Declarative React scene graph fits the Next.js/React 19 app; drei provides OrbitControls, per-mesh raycast events, `useTexture`; largest ecosystem. Babylon.js rejected (imperative, needs a state-sync layer); PlayCanvas/Unity-WebGL rejected (editor-centric, heavyweight). |
| Photo → 3D (req. 5-1) | **Hybrid**: instant dimension-box textured with the photo, plus optional per-item "Generate 3D model" AI upgrade | Box is free/instant/offline and identical to how finder items render; AI mesh is opt-in where fidelity matters. |
| AI image-to-3D provider | Meshy.ai behind a swappable `Image3DProvider` adapter | Mature API, free prototyping tier, GLB output. Adapter keeps the provider replaceable (e.g. Tripo3D). |
| Navigation | Orbit + pan + zoom (dollhouse style) | Purely mouse-driven per requirement 4; easiest mode for precise placement; standard in room planners. First-person walkthrough deferred. |
| Wall model | Auto exterior walls from the floor outline; user draws only interior walls; doors placeable on any wall | Least clicking; impossible to accidentally leave the house open. |
| Grid cell size | 0.5 m × 0.5 m | 3×4 m bedroom = 6×8 cells; good fidelity-vs-effort balance. |
| Persistence | localStorage | No backend needed beyond the Meshy proxy route. |

## Architecture

```
src/lib/showroom/          # pure, unit-testable core (no React, no three.js)
  types.ts                 # FloorPlan, Edge, Room, PlacedItem
  edges.ts                 # normalized cell-edge addressing
  perimeter.ts             # derive exterior walls from selected-cell outline
  rooms.ts                 # flood-fill room derivation (walls = barriers)
  geometry.ts              # FloorPlan -> 3D build description (floor tiles,
                           #   wall segments with door gaps) as plain data
src/lib/model3d/
  provider.ts              # Image3DProvider interface
  meshy.ts                 # Meshy.ai implementation
src/app/showroom/page.tsx  # page shell; editing <-> furnishing mode state
src/components/showroom/
  FloorPlanEditor.tsx      # 2D SVG editor
  ShowroomScene.tsx        # r3f <Canvas>: house meshes, controls, placement
  FurniturePanel.tsx       # Finder tab + Import tab
src/app/api/model3d/route.ts  # server proxy holding MESHY_API_KEY
```

New dependencies: `three`, `@react-three/fiber`, `@react-three/drei`.
All 3D components are client components (`"use client"`); before writing page
code, read the bundled Next.js docs in `node_modules/next/dist/docs/` per
AGENTS.md (this Next.js version has breaking changes).

## Data model

- **`FloorPlan`**: `{ cols, rows, cellSizeMm: 500, cells: Set<CellKey>, walls: Set<EdgeKey>, doors: Set<EdgeKey> }` (v1 단순화: 문 메타데이터가 없어 `Map<EdgeKey, DoorInfo>` 대신 `Set<EdgeKey>` 사용).
  Edges are addressed on cell boundaries and normalized so each physical edge
  has exactly one key. Exterior walls are **derived** (outline of `cells`),
  never stored; `walls` holds interior walls only. A door references an edge
  that carries a wall (derived-exterior or interior).
- **`Room`**: derived, not stored — flood-fill over selected cells where any
  wall (with or without a door) is a barrier. Doors are openings for 3D
  geometry/navigation but still separate rooms, per requirement 2.
- **`PlacedItem`**: `{ id, source: "finder" | "upload", title, dims: { widthMm, depthMm, heightMm }, imageUrl (or data URL for uploads), meshUrl?, position: [x, y, z], rotationY, mount: "floor" | "wall" }`.

## User flow

### Phase 1 — 2D floorplan editing (`FloorPlanEditor`)

- Grid rendered in SVG. Unselected cells `rgba(0,0,0,0.6)` over a subtle grid;
  selected cells colored.
- Tools: **paint floor** (click/drag toggles cells), **draw wall** (click a
  cell edge between two selected cells), **place door** (click an existing
  wall edge), **erase**.
- **[DONE]** validates (≥ 1 selected cell) and switches the page to 3D mode.
  A "back to edit" control returns to 2D with state intact.

### Phase 2 — 3D house (`ShowroomScene`)

- `geometry.ts` turns the `FloorPlan` into plain build data: floor tiles at
  y = 0, wall segments (0.5 m long, ~2.4 m high, ~0.1 m thick boxes) with door
  edges producing a gap + frame instead of a full segment.
- `OrbitControls`: drag to rotate, right-drag/two-finger to pan, scroll zoom.

### Phase 3 — Furnishing (`FurniturePanel` + placement mode)

- **Finder tab**: search UI reusing the existing `/api/search`; results carry
  `dimensions` (mm) and `imageUrl`. Items with `confidence: "unknown"` (or
  missing any of W/D/H) prompt for manual dimensions before placement.
- **Import tab**: photo upload + required manual W/D/H entry (a photo alone
  has no scale). Photos stored as size-capped data URLs so they survive
  reload.
- **Placement**: selecting an item enters placement mode. A ghost preview
  follows the cursor via raycasting **against floor and wall meshes only** —
  a ray that hits nothing places nothing, so empty space is unplaceable by
  construction (requirement 5-3). Floor-mount items sit on the floor;
  wall-mount items snap flush to the hit wall's normal. Click commits.
  Placed items: drag to move (same raycast constraint), scroll/R to rotate,
  Delete/button to remove. No furniture–furniture collision in v1.
- Items render as boxes at exact real-world scale (mm → meters) textured with
  the product/imported photo.

### Phase 4 — AI mesh upgrade (hybrid path)

- Per-item "Generate 3D model" button → `POST /api/model3d` with the image →
  server route (holds `MESHY_API_KEY`, added to `.env.example`) creates a
  Meshy image-to-3D task → client polls → on success, GLB URL is stored on
  the item and the box is swapped for the GLTF, scaled to the declared
  dimensions.
- Failure or timeout → keep the textured box, show a toast. Missing API key →
  button shows an "unconfigured" state (same pattern as existing source
  adapters).

## Persistence

Floorplan + placed items serialized to localStorage on change; restored on
page load. `Set`/`Map` serialized as arrays. Data-URL photo storage is capped
(~1 MB per image, downscaled client-side) to respect localStorage limits.

## Error handling

- 3D generation of a degenerate plan (single cell, disconnected islands) must
  not crash; disconnected floor islands are allowed and each gets its own
  perimeter walls.
- Meshy errors/timeouts degrade to the box representation with a toast.
- Finder items without usable dimensions cannot be placed until dimensions
  are entered manually (consistent with the existing `unknown` confidence
  handling).

## Testing

- **Unit tests** (pure core): edge normalization, perimeter derivation from
  cell sets (including holes and islands), flood-fill room derivation with
  walls/doors, geometry build output (door gaps, wall counts), placement math
  (mm→m scaling, wall-normal snapping).
- **Manual browser verification** for 3D interactions (orbit, ghost preview,
  floor/wall snapping, localStorage restore), per the project's verify flow.

## Out of scope (v1)

- First-person walkthrough mode
- Furniture–furniture collision
- Multi-floor houses, sloped walls, windows
- Server-side saving/sharing of layouts
