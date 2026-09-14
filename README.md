# Acoustic Room Visualizer

A local listening-room planner built with React, TypeScript, Vite, Tailwind CSS, Three.js, React Three Fiber, Drei and Zustand. No backend, accounts, API keys, online assets or external services are required at runtime. The existing Git repository is preserved.

Current release: **v1.2.0**. This release adds room-mode analysis, physically consistent treatment coverage, practical panel optimization, independent ray filters, shared ft/cm/in controls, and library import/export. See [CHANGELOG.md](CHANGELOG.md) for the release summary.

## Run locally

Requires Node.js 22.12+ (or a compatible newer release), npm, and a modern WebGL-capable browser.

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. If that port is in use, use the URL Vite prints. Production preview: `npm run build` then `npm run preview -- --host 127.0.0.1`.

## Start with a blank room

A new workspace has no objects, with axes and measurements off. Add your room dimensions in Design, then open Library. Your working room resumes on reload. Existing version 1 autosaves and manual saves are preserved as milestones named “Previous workspace” and “Previous manual save”; the first launch of the revised workspace starts blank. Use Files → New blank room to start over; the previous room is checkpointed first.

### Reusable object library

- Create, edit and delete types for absorption panels, corner bass traps, speakers, stands and sofas. Enter a type’s name, dimensions and color before saving it. Panel and trap types include 2, 4 and 6 inch thickness presets with frequency-dependent absorption curves, plus a custom thickness option.
- Custom curves accept points from 20 Hz to 20 kHz and interpolate between them on a logarithmic frequency scale. The displayed NRC-style average uses 250–2000 Hz. Coefficients are constrained to 0–1.
- Speaker types include cabinet dimensions, tweeter height and a reusable stand selection. Stand types include width, height, depth and post width. Sofas include width, height and depth.
- Click Place or drag a library card into the viewport. Objects use the saved dimensions; speakers are initially placed toward the front, sofas toward the rear. Use the gizmo for exact placement. Dragging a card places its standard starting position, not the screen drop coordinate.
- Editing a type changes future placements. Check “Also update placed copies” to apply its dimensions/material data to existing copies while retaining placement. Changing a stand type can update attached speaker stands. Deleting a type keeps placed objects; Undo restores library changes.
- Every sofa automatically includes **two fixed listening positions**. Their ear locations follow sofa translation, rotation and dimensions. They need no manual setup and cannot be separately moved, deleted or duplicated. Their visibility can be toggled. Duplicating/deleting a sofa duplicates/deletes its listeners. Legacy standalone listeners are attached to the first sofa when possible.

### Saves and time travel

**Save / Update** in the header always creates a new immutable milestone. It never overwrites an earlier save. In **Saves**, optionally name the milestone, inspect timestamps and branch origins, and jump to any saved state. Each milestone contains both the room and the complete reusable library.

Restoring a milestone first checkpoints unsaved edits as “Before history jump.” Later saves remain available. Saving after restoring an older milestone creates a new branch referencing that milestone. Milestones persist across reloads and are never automatically pruned. Undo/redo is separate and retains the last 50 editing steps, including library changes and complete drag gestures.

The working copy autosaves to localStorage. This is distinct from explicit milestone saves. Browser storage is finite: the app reports failures and blocks history jumps if it cannot safely checkpoint. Files → Export workspace history downloads **all milestones and branches**, plus the current design/library. Keep this JSON backup when you want storage independent of the browser.

### Room editing and views

Select objects in the viewport or the Design list. Set positions numerically or use the move/rotate gizmo. Numeric inputs commit on Enter or blur. Gizmo changes update measurements and sofa listeners live; a drag is one undo step. Camera orbit pauses while dragging a gizmo.

Treatments mount to front/rear/left/right walls, floor or ceiling with edge offsets. Bass traps straddle any vertical corner at 45°. Mounted treatments can have horizontal/vertical orientation. Dragging a mounted treatment releases it into free placement. Grid and 15° angle snapping are configurable. Every object can snap its rotated bounding box to a room surface.

Camera toolbar: perspective, front, rear, left, right, top, side, reset, axes, labels and measurements. Room walls use a translucent inspection view. Drag to orbit, right-drag to pan, scroll to zoom. Standard views use a perspective camera aligned to the chosen axis.

The UI uses a consistent system sans-serif family with 14–15 px editing controls and larger headings. **Light mode / Dark mode** changes the interface and viewport, and remembers the choice locally. On small screens the viewport appears above the editing panel.

### Reflection paths

**Direct**, immediately before First order and Second order, independently toggles direct paths (initially on). Speaker buttons still select active sources; enabling a speaker never re-enables Direct. Existing direct destinations remain unchanged.

**All rays / Treated rays / Untreated rays** filter both viewport rays and inspector rows using acoustic contact coverage. Treated requires at least one reflection contact to have enabled treatment; Untreated means all contacts are uncovered. Direct paths have no reflection contacts and appear only under All rays. Coverage uses the same finite panel footprint, actual wall attachment and treatment state as attenuation, even when absorption is zero. A stale mount label on a detached panel does not cover wall contacts. Inspector dropdown filters remain table-only.

Place a speaker and a sofa to see rays immediately. The destination automatically resolves to an available listener, including after importing or restoring a design with different IDs. Rays shows an actionable status if a source, listener or enabled reflection order is missing.

Select either listener, first/second order, frequency, sources, room surfaces and individual treatments. Quality controls cap candidate surfaces and second-order paths per speaker. All ray markers start together, wait at the listener for the longest route, then restart together. The compact Ray inspector table is filterable by source, listener, order or surface, has a Remove all filters control, and shows each path’s travel time as seconds:milliseconds at 343 m/s. Its sticky header and scrollable area keep the panel small. Click a row or a path in the viewport to highlight it; clicking the selected inspector row again clears the highlight. Visible panels occlude ray lines and moving markers. Mint and lavender distinguish alternating speakers, with darker colors in light mode. Translucent room walls keep paths inspectable.

Speaker/listener visibility is independent of reflection participation. Mounted absorption panels apply attenuation at the existing wall contacts; switching their treatment on/off changes energy without changing wall names, contact points, path counts, or animation routes. Fully absorbed paths remain faintly visible, with visible moving markers for inspection.

Under Rays → Treatment surfaces, configure panel dimensions independently for the walls, floor and ceiling selected in Room surfaces. Each selected surface has Length, Width and Thickness dropdowns populated from saved library types. Changing a dimension chooses a matching type (and may update the other dimensions), preserving its absorption curve. Add more sizes in Library. Add absorbers and the red Remove absorbers action sit side by side. Then choose Vertical or Horizontal for each room surface (click an active option again to exclude that surface) and click Optimize panels. The optimizer replaces absorption panels with a non-overlapping layout around nearby active reflection points, preserving bass traps and supporting Undo. The weighted cluster search prioritizes first-order contacts and repeated ray contacts, prefers aligned rows and centered clusters, and maintains 5 cm panel gaps. Isolated low-priority second-order contacts may remain uncovered to avoid fragmented layouts; oversized panels are not placed. Coverage is a greedy geometric estimate; the result reports uncovered points and capacity limits.

### Room modes

Open **Mode**, directly below Rays, for the two reference views: a frequency spectrum and **Room3D** pressure map. The calculator uses your saved room dimensions; editing dimensions here also updates Design and supports Undo.

- The logarithmic frequency chart has piano-semitone bands, axial/tangential/oblique frequency lines, type filters and an RT60-based Schroeder marker. Choose a range within 5–300 Hz (default 20–160 Hz). Line heights distinguish mode types, not predicted loudness; the chart does not display a measured or source-dependent frequency response.
- Click a line, use the Previous/Next buttons or the mode selector, or focus the chart and press arrow keys. Home/End jump to the first/last mode. Repeated clicks cycle modes sharing one frequency; coincident modes retain their separate spatial patterns. For large mode counts, the dropdown lists nearby modes while the chart and arrows reach the complete range.
- Room3D uses the same room materials and transparency control as Rays, with the selected pressure map overlaid on inside surfaces. Near walls cut away as you orbit. Red and blue are opposite pressure phases, both with high pressure magnitude; stationary gray bands are nodes. Optional nodal planes show zeros inside the room; pressure animation is deliberately slowed. Existing visible speakers, listeners and treatments remain in place.
- A mode's three orders are **length, width, height** (world Z, X, Y). Frequencies use `f = 343/2 × sqrt((nL/L)² + (nW/W)² + (nH/H)²)` in metres. The Schroeder estimate is `2000 × sqrt(RT60 / volume)`, with RT60 in seconds; default RT60 is 0.21 s.
- The pressure map can help locate pressure-based resonant absorbers. Porous traps depend on air motion, depth and material properties. These ideal rigid rectangular-room modes do not model treatment effectiveness, damping, measured SPL or furniture effects. RT60 changes the transition marker, not the mode frequencies. Analysis selections, filters and RT60 are session-local; room dimensions and objects use the existing workspace saves.

Interaction reference: [amroc — THE Room Mode Calculator](https://amcoustics.com/tools/amroc/). Background: [room modes and pressure-zone interpretation](https://amcoustics.com/articles/roommodes/). No reference-site code, assets or runtime services are required.

### Measurements and files

Display and numeric editing support **ft**, **cm**, and **in** through one shared conversion system: **1 ft = 30 cm = 12 in**, so **1 in = 2.5 cm**. Grid spacing, snapping and thickness presets use the same helpers. Existing saved metre geometry is retained.

Files → **Library Export** downloads a versioned JSON containing every reusable type, including dimensions, curves, colors and speaker stand settings. **Library Import** validates and replaces the library, checkpoints the previous state and supports Undo/Redo without changing placed objects.

Measure enables room dimensions, selected-object dimensions, origin-to-wall distances and custom two-point measurements. Click two surface points or objects; object anchors follow the object origin while surface-point anchors stay fixed in world coordinates. Labels face the camera. Axes and all measurements are off initially.

Files supports a blank new room, design/library JSON export, full workspace-history export and validated import. Importing a design checkpoints your current progress. Importing a full history merges it with your existing history using fresh milestone IDs, preserving branch references and existing saves. Version 1 design-only JSON remains supported.

Shortcuts: Delete/Backspace removes selected objects, Ctrl/⌘ D duplicates, Ctrl/⌘ Z undoes, Ctrl/⌘ Shift Z or Ctrl Y redoes, Escape cancels measurement or closes the guide. Fixed sofa listeners ignore destructive and movement commands.

## Development context

Persistent project context is intentionally split by purpose:

- `AGENTS.md` contains durable instructions for Codex and other coding agents.
- `docs/PROJECT_STATE.md` contains the current implementation state, active work, known limitations, verification status, and next tasks.
- `docs/DECISIONS.md` records durable product and technical decisions.
- Source code and tests define the currently implemented behavior.

Previous Chat, Work, or Codex conversations are not required to understand or modify the project. Important requirements and decisions should be captured in the versioned project files above rather than relying on chat history.

## Data and architecture

- `src/domain/model.ts`: typed geometry and explicit feet/inches/meters helpers. Internal lengths are meters; origin is front-left floor. X = room width, Y = height, Z = room length front-to-rear.
- `src/domain/workspace.ts`: reusable library, instantiation, derived sofa listeners, version 2 workspace/history validation and migration.
- `src/domain/store.ts`: Zustand state, transactional transforms, undo/redo, localStorage and immutable branching milestones.
- `src/domain/acoustics.ts`: finite-plane image-source geometry and rectangular-room eigenmodes, independent of React/rendering.
- `src/components`: reusable editors, library, timeline, import/export and Three.js scene.

Speaker Y is the cabinet base; the stand descends from it. Tweeter height is relative to that base. Sofa and standalone stand origins are their floor centers; panel/trap origins are their centers. Listener ears sit 0.65 m above the sofa cushion, with automatic lateral seat offsets.

The active workspace uses `acoustic-room-workspace-v2`. Legacy keys remain untouched. Imports validate finite dimensions, kinds, vectors, absorption bounds, unique object IDs, mounting data, measurement references, library data and milestone branch references. Import files are capped at 20 MB, designs and libraries at 150 objects/types. WebGL failures have a React error boundary and editor/export fallback.

## Acoustic model limitations

**Reflection output is an approximate specular geometric visualization, not an acoustical measurement or prediction.**

First-order paths mirror the source in one finite plane. Second-order paths mirror it sequentially in two distinct planes, then trace intersections backward from the listener. Intersections must be within each rectangle and the rectangular room. Specular-angle validation rejects invalid paths. Mounted panels coat the room boundary instead of replacing it with a displaced plane. Free panels and diagonal bass traps retain finite reflecting and occluding geometry; their treatment switch changes absorption only.

Treatment absorption uses the selected frequency curve and incidence angle at each contact. Overlapping mounted panels use the strongest coefficient at the wall point rather than multiplying duplicate coverage. Opacity shows retained energy with a small visibility floor. Loss is `−10 log10(retained energy)`; distance spreading is excluded. Preset curves are planning references, not claims about a specific product. The NRC-style arithmetic average is informational, not a certified NRC.

Speaker cabinets, stands and sofa are visual geometry, not acoustic obstacles. Walls are ideal unit-reflectivity planes. The separate Mode tab computes ideal rectangular-room eigenmodes. Reflection rays do not include modal effects, wave interference, phase, scattering, diffraction, calibrated SPL or a full acoustic simulation. Geometry overlap and oversized objects are not automatically resolved. The quality cap uses deterministic surface ordering rather than acoustic importance.

## Verification

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

For first-time browser testing, install Chromium with `npx playwright install chromium`. Playwright starts/reuses the Vite server.

Unit tests cover units, intersections, specular reflections, attenuation, mounting, snaps, import validation, live state synchronization, blank initialization, NRC defaults, reusable templates, stand defaults, fixed sofa listeners, automatic ray destinations, persistent branching history, legacy migration and undo/redo. Browser tests cover actual library creation/editing/placement/deletion, save/restore/reload/branching, rays to newly created listeners, camera views, mounting, themes and typography, import/export, mobile layout, gizmo movement and measurements.
