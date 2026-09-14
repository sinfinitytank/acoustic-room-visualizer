# Changelog

All notable user-facing changes to Acoustic Room Visualizer are recorded here.

## 1.2.0 — 2026-09-14

### Added

- Ideal rectangular-room mode analysis with a logarithmic spectrum, coincident-mode selection, Schroeder marker, and animated Room3D pressure map.
- Independent Direct, First order, and Second order ray controls, plus All, Treated, and Untreated ray filters shared by the viewport and inspector.
- Surface-specific absorption-panel sizing and orientation with weighted, non-overlapping panel optimization around reflection contacts.
- Shared ft, cm, and in editing throughout room, object, grid, snap, and thickness controls.
- Versioned reusable-library import and export with validation, checkpointing, persistence, and Undo/Redo.
- Synchronized ray-marker animation, compact inspector filters, travel-time display, and toggleable path selection.

### Changed

- Mounted panels now attenuate the underlying room-boundary reflection without changing path geometry or counts.
- Treatment coverage now verifies finite panel bounds and physical wall attachment instead of trusting mount metadata alone.
- Fully absorbed paths retain a small visibility floor, and visible scene objects occlude rays and moving markers.
- Panel optimization favors first-order and repeated contacts, aligned clusters, centered placement, and 5 cm gaps.

### Compatibility

- Existing metre-based geometry, version 1 design imports, version 2 workspaces, milestones, and legacy localStorage data remain supported.
- Room-mode and ray-analysis controls remain session-local; workspace data stays local to the browser unless exported.
