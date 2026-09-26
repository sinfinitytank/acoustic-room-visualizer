# Acoustic Room Visualizer

[Open the live app](https://sinfinitytank.github.io/acoustic-room-visualizer/)

Acoustic Room Visualizer is a browser-based planning tool for arranging a listening room, exploring approximate reflection paths, and inspecting ideal rectangular-room modes. It runs entirely in your browser: there are no accounts, API keys, analytics services, or server-side storage.

## Use the app

Open the [live app](https://sinfinitytank.github.io/acoustic-room-visualizer/) in a modern browser with WebGL support.

1. In **Design**, set the room dimensions.
2. In **Library**, create speakers, a sofa, stands, and treatment types, then place them in the room.
3. Use **Rays** to inspect direct, first-order, and second-order specular paths.
4. Use **Mode** to explore the room's ideal modal frequencies and pressure patterns.
5. Use **Files** to export a portable JSON backup of a design, library, or complete workspace history.

The workspace autosaves in browser storage. Use **Save / Update** to create a named milestone, and export a workspace-history file before clearing browser data or moving to another device.

## What it includes

- A 3D room editor with placement, rotation, mounting, snapping, measurements, and ft/cm/in display.
- A reusable object library for speakers, sofas, stands, absorption panels, and bass traps.
- Branching milestones, Undo/Redo, and validated JSON import/export.
- Finite-plane, image-source reflection visualization with direct, first-order, and second-order paths.
- Frequency-dependent treatment coverage and practical panel-layout suggestions around active reflection points.
- Ideal rectangular-room mode analysis with a frequency spectrum and interactive Room3D pressure view.

## Privacy and data

Your room data stays in the browser unless you explicitly download a JSON export. No account is required. Browser storage can be cleared by privacy tools, browser settings, or device changes, so keep exported backups for work you want to retain.

## Important model limits

This is a planning and visualization tool, not an acoustical measurement system or a substitute for a qualified acoustic design. Reflection paths use simplified specular geometry; room modes use an ideal rigid rectangular-room model. The app does not predict measured SPL, decay, scattering, diffraction, wave interference, source directivity, furniture effects, or the performance of a specific treatment product.

See [Acoustic model and limitations](docs/ACOUSTIC-MODEL.md) for the underlying assumptions.

## Project information

- Current release: **v1.2.0** — see [CHANGELOG.md](CHANGELOG.md).
- The public site is deployed from `main` through GitHub Pages.
- Contributions and local development instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Technology

React, TypeScript, Vite, Three.js, React Three Fiber, Drei, and Zustand.

## References

- [amroc — THE Room Mode Calculator](https://amcoustics.com/tools/amroc/)
- [Room modes and pressure-zone interpretation](https://amcoustics.com/articles/roommodes/)

These references inform the interaction and background material only. This project does not use their code, assets, or runtime services.
