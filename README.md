# Acoustic Room Visualizer

A local listening-room planner built with React, TypeScript, Vite, Tailwind CSS, Three.js, React Three Fiber, Drei and Zustand. No backend, accounts, API keys, online assets or external services are required at runtime. The existing Git repository is preserved.

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

- Create, edit and delete types for absorption panels, corner bass traps, speakers, stands and sofas. Enter a type’s name, dimensions and color before saving it. Panel and trap types include thickness in inches and NRC, defaulting to **1.00**.
- Setting NRC fills all six absorption bands with that value. Expand per-frequency data to edit 125, 250, 500, 1000, 2000 and 4000 Hz separately; the displayed NRC-style average uses 250–2000 Hz. Values are constrained to 0–1.
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

Camera toolbar: perspective, front, rear, left, right, top, side, reset, see-through/opaque walls, grid, axes, labels and measurements. Drag to orbit, right-drag to pan, scroll to zoom. Standard views use a perspective camera aligned to the chosen axis.

The UI uses a consistent system sans-serif family with 14–15 px editing controls and larger headings. **Light mode / Dark mode** changes the interface and viewport, and remembers the choice locally. On small screens the viewport appears above the editing panel.

### Reflection paths

Place a speaker and a sofa to see rays immediately. The destination automatically resolves to an available listener, including after importing or restoring a design with different IDs. Rays shows an actionable status if a source, listener or enabled reflection order is missing.

Select either listener, first/second order, frequency, sources, room surfaces and individual treatments. Quality controls cap candidate surfaces and second-order paths per speaker. Click a path in the viewport or select it in the inspector for its surfaces, length and coefficient-only energy attenuation. Mint and lavender distinguish alternating speakers, with darker colors in light mode. See-through mode draws paths through room walls for inspection.

Speaker/listener visibility is independent of reflection participation. Treatment layer visibility disables that treatment’s acoustic geometry. Fully absorbed paths remain faintly visible for inspection.

### Measurements and files

Measure enables room dimensions, selected-object dimensions, origin-to-wall distances and custom two-point measurements. Click two surface points or objects; object anchors follow the object origin while surface-point anchors stay fixed in world coordinates. Labels face the camera. Axes and all measurements are off initially.

Files supports a blank new room, design/library JSON export, full workspace-history export and validated import. Importing a design checkpoints your current progress. Importing a full history merges it with your existing history using fresh milestone IDs, preserving branch references and existing saves. Version 1 design-only JSON remains supported.

Shortcuts: Delete/Backspace removes selected objects, Ctrl/⌘ D duplicates, Ctrl/⌘ Z undoes, Ctrl/⌘ Shift Z or Ctrl Y redoes, Escape cancels measurement or closes the guide. Fixed sofa listeners ignore destructive and movement commands.

## Data and architecture

- `src/domain/model.ts`: typed geometry and explicit feet/inches/meters helpers. Internal lengths are meters; origin is front-left floor. X = room width, Y = height, Z = room length front-to-rear.
- `src/domain/workspace.ts`: reusable library, instantiation, derived sofa listeners, version 2 workspace/history validation and migration.
- `src/domain/store.ts`: Zustand state, transactional transforms, undo/redo, localStorage and immutable branching milestones.
- `src/domain/acoustics.ts`: finite-plane image-source geometry, independent of React/rendering.
- `src/components`: reusable editors, library, timeline, import/export and Three.js scene.

Speaker Y is the cabinet base; the stand descends from it. Tweeter height is relative to that base. Sofa and standalone stand origins are their floor centers; panel/trap origins are their centers. Listener ears sit 0.65 m above the sofa cushion, with automatic lateral seat offsets.

The active workspace uses `acoustic-room-workspace-v2`. Legacy keys remain untouched. Imports validate finite dimensions, kinds, vectors, absorption bounds, unique object IDs, mounting data, measurement references, library data and milestone branch references. Import files are capped at 20 MB, designs and libraries at 150 objects/types. WebGL failures have a React error boundary and editor/export fallback.

## Acoustic model limitations

**Reflection output is an approximate specular geometric visualization, not an acoustical measurement or prediction.**

First-order paths mirror the source in one finite plane. Second-order paths mirror it sequentially in two distinct planes, then trace intersections backward from the listener. Intersections must be within each rectangle and the rectangular room. Specular-angle validation rejects invalid paths. Intervening treatment planes occlude candidate segments, including room-wall paths behind treatment.

Treatments are finite two-sided planar reflectors at their front face. Second-order treatment contacts use the same image-source construction and multiply `(1 − coefficient)` at each contact for the selected band. Opacity shows retained energy with a small visibility floor. Loss is `−10 log10(retained energy)`; distance spreading is excluded. NRC 1.00 is the requested default, not a claim about real material performance. The NRC-style arithmetic average is informational, not a certified NRC.

Speaker cabinets, stands and sofa are visual geometry, not acoustic obstacles. Walls are ideal unit-reflectivity planes. No room modes, wave interference, phase, scattering, diffraction, calibrated SPL or full acoustic simulation is modeled. Geometry overlap and oversized objects are not automatically resolved. The quality cap uses deterministic surface ordering rather than acoustic importance.

## Verification

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

For first-time browser testing, install Chromium with `npx playwright install chromium`. Playwright starts/reuses the Vite server.

Unit tests cover units, intersections, specular reflections, attenuation, mounting, snaps, import validation, live state synchronization, blank initialization, NRC defaults, reusable templates, stand defaults, fixed sofa listeners, automatic ray destinations, persistent branching history, legacy migration and undo/redo. Browser tests cover actual library creation/editing/placement/deletion, save/restore/reload/branching, rays to newly created listeners, camera views, mounting, themes and typography, import/export, mobile layout, gizmo movement and measurements.
