# Project State

Last updated: 2026-09-14

Release: v1.2.0

## Product goal

Build a local, browser-based listening-room planner where users can arrange rooms, speakers, sofas, stands, and acoustic treatments; inspect approximate specular reflection paths and ideal rectangular-room modes; and preserve designs as branching local milestones.

## Current implementation

### Workspace

- ft/cm/in editing and display share model.ts conversions: 1 ft = 30 cm = 12 in. Grid, snap and thickness defaults use the same helpers. Saved metre values are preserved.
- Files provides library-only JSON import/export with complete type data, validation, checkpointing, persistence and Undo/Redo. Placed objects remain unchanged.

- Workspace version 2 supports reusable object types, derived sofa listeners, validation/migration, local autosave, undo/redo, and immutable branching milestones.
- Room dimensions and placed objects are persisted in the workspace.
- Mode and ray analysis controls that are not part of the room design remain session-local.

### Reflection rays

- Direct has an independent toggle before First order and Second order; speaker activation is preserved.
- Wall coverage verifies actual attachment and finite projected panel bounds, rejecting stale mount labels on detached or wall-penetrating panels. All/Treated/Untreated filters apply shared acoustic contact coverage to viewport and inspector. Treated requires at least one contact covered, Untreated means all contacts uncovered, and direct paths appear under All only.

- Reflection paths use finite-plane image-source geometric approximations.
- First- and second-order paths are supported.
- Mounted treatments attenuate existing room-wall contacts without changing reflection coordinates, wall sequences, path IDs, counts, or animation routes when treatment is toggled.
- The Ray inspector displays all calculated paths and allows viewport/path selection.
- Ray markers run in synchronized cycles: each begins together, completed routes wait at their listener, and all restart after the longest route arrives.
- The Ray inspector filters by source, listener, order, or surface, offers Remove all filters, and displays travel time as seconds:milliseconds at 343 m/s.

### Treatment optimization

- Optimize panels provides independent Length, Width, and Thickness selections for enabled room surfaces.
- Dimension selections resolve to saved library panel types and their absorption data, preserving the other selected dimensions whenever a compatible type exists.
- Optimized-panel names wrap within their treatment cards.
- Each enabled surface can use vertical or horizontal panel orientation or be excluded.
- The optimizer searches weighted contact clusters, prioritizes first-order/repeated contacts, and prefers centered, aligned rows with 5 cm gaps. Marginal isolated secondary contacts may remain uncovered. Panels exceeding the selected surface bounds are skipped.
- The optimizer is greedy and does not claim globally optimal treatment placement.

### Room modes

- Mode appears directly below Rays.
- It provides a logarithmic frequency spectrum and linked 3D pressure map.
- Mode calculations use saved room dimensions, ideal rectangular rigid boundaries, and sound speed 343 m/s.
- Coincident modes remain individually selectable.
- Mode orders map length/width/height to world Z/X/Y.
- The Schroeder estimate uses user-entered RT60, defaulting to 0.21 s.
- Treatment objects remain visible but do not modify ideal mode frequencies or pressure fields.
- Mode settings are session-local.

## Active working-tree changes

The v1.2 implementation and documentation are release-ready. There is no known active feature work after the v1.2 release commit.

Before modifying related functionality, inspect the current working tree and relevant implementation files. Do not assume previous Codex requests left partial changes.

## Known constraints and risks

- A room has a 150-object validation limit.
- Treatment optimization uses a greedy geometric strategy.
- Reflection rays do not predict measured room response, SPL, modal behavior, phase, scattering, diffraction, or calibrated acoustics.
- Room-mode calculations use ideal rigid rectangular-room assumptions and do not model damping, source-dependent response, furniture effects, or treatment effectiveness.
- The production build has an existing large-bundle advisory.
- Three.js reports non-blocking development-console deprecations for `Clock` and `PCFSoftShadowMap` during browser tests.
- The legacy responsive-layout browser assertion currently detects horizontal overflow at a 390 px viewport and needs a focused layout fix.

## Current verification

Release verification on 2026-09-14:

- `npm run verify` passes: production build, lint, and all 47 domain tests.
- Current feature-focused browser scenarios pass. The latest full run passed 9 of 11 before one remaining obsolete transparency-toggle step was removed; the known 390 px horizontal-overflow assertion still needs a focused layout fix. Welcome-screen and control locators now match the current UI.
- Domain coverage includes units, reflection geometry and stability, treatment attachment/footprints, ray classification, panel cluster placement, workspace validation, history, and Undo/Redo.
- Browser coverage includes library workflows, milestones and branching, modes, ray filters, optimization, panel sizing, import/export, themes, responsive layout, camera views, gizmo movement, and measurements.
- The build retains its known large-chunk advisory; browser runs retain the non-blocking Three.js deprecation warnings listed above.

## Verification commands

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

Install Chromium when required:

```sh
npx playwright install chromium
```

## Next tasks

- Consider global layout search only if weighted greedy cluster placement becomes limiting.
- Consider code splitting if the production bundle size becomes a loading concern.
- Update the deprecated Three.js timer and shadow-map APIs during a focused maintenance pass.
