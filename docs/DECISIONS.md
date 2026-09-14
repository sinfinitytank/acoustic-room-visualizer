# Decisions

## 2026-09-14 — Project context lives in versioned files

**Decision:** Keep durable project context in `AGENTS.md`, `docs/PROJECT_STATE.md`, and this decision log instead of relying on chat history.

**Why:** New Codex chats can read a small, current project brief and the working tree without replaying long conversations. `AGENTS.md` holds stable operating rules, `PROJECT_STATE.md` holds active work and handoffs, and this file records choices that should not be repeatedly reconsidered.

## Existing architectural decisions

### Stable treatment reflection geometry

Mounted absorption panels apply attenuation to the room boundary at covered contact points. Panel thickness, optimization, and treatment on/off must preserve wall sequences, coordinates, path IDs, and animation routes. Free panels and diagonal bass traps keep their geometric planes when absorption is toggled. This avoids treatment-dependent second-order count limits substituting unrelated paths.

### Local-first application

The product is a client-side app with no backend, accounts, API keys, or online runtime services. Browser localStorage provides working-copy persistence and milestones; JSON export provides portable backup.

### Acoustic-simulation scope

Reflection paths are an approximate specular geometric visualization using finite-plane image-source geometry. They are not acoustic measurements or complete room-response predictions.

### Immutable workspace history

Explicit saves create immutable, branching milestones. Autosave is separate. Restoring or importing checkpoints unsaved work where possible; undo/redo is separate from history.

### Sofa listeners are derived objects

Each sofa owns two fixed listening positions. They follow sofa transforms and dimensions and cannot be separately moved, deleted, or duplicated.

## 2026-09-14 — Room-mode analysis is separate from reflection rays

**Decision:** Add Mode directly below Rays, using the existing saved room dimensions and 3D scene. Compute ideal rigid rectangular-room eigenfrequencies and cosine-product pressure fields independently of React in `acoustics.ts`. Mode orders use length/width/height (world Z/X/Y), with sound speed 343 m/s. Preserve coincident modes individually. The displayed Schroeder estimate uses a user-entered RT60, initially 0.21 s.

**Scope:** The requested frequency chart and Room3D are implemented locally. No tuner, Bonello graph, Bolt area, audio playback or online service is included. The chart shows frequency distribution, not an estimated source-dependent response or measured SPL. Treatment objects remain visible but do not change ideal mode frequencies or fields. Analysis settings are session-local, like the existing ray controls; workspace schema and history are unchanged.

**Rendering:** Pressure colors are calculated analytically in the fragment shader on inside-facing room walls. The camera automatically exposes the interior; optional nodal planes show the same cosine zeros through the room volume. Animation is a slowed phase illustration, not real-time audio. Spectrum paths coalesce subpixel overlaps by type for large rooms without discarding modes from selection.

## 2026-09-14 — Shared project units and ray coverage

All lengths remain stored in metres. Project conversions use 1 ft = 30 cm and 12 in = 1 ft through model.ts; existing persisted geometry is not rescaled. Ray coverage comes from the same enabled treatment contact lookup used for attenuation, independently of absorption magnitude. Reflected paths with at least one covered contact are Treated; only paths with all contacts uncovered are Untreated. Direct paths appear only in All rays and have an independent visibility toggle. Library-only JSON replaces reusable data through validated, undoable state updates with a checkpoint.

## 2026-09-14 — Physical coverage and practical panel layouts

Mounted coverage checks the actual finite footprint projected along the room-surface normal and verifies attachment (including the existing 8 mm backing gap), rather than trusting mount metadata. Attenuation and ray filters share this lookup. At least one contact must be covered for a reflected path to be Treated. Optimization skips rays already treated by retained objects and reports ray treatment using the same contact-coverage classifier as viewport and inspector filters.

Panel optimization weights first-order contacts at 2 and secondary contacts at 0.5, accumulating repeated contacts. Candidate search includes independent rectangle-edge events as well as cluster centers and aligned placements. A 5 cm separation and modest alignment/centering preferences favor practical layouts; candidates scoring below 0.6 are omitted so a lone secondary contact does not require another panel. These are layout heuristics, not predicted acoustic performance. Selected sizes, orientations, surface bounds, replacement/Undo behavior and object capacity remain in force.
