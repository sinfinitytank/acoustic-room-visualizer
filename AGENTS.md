# Acoustic Room Visualizer — Project Instructions

## Start here

Before making a change:

1. Read `README.md` and `docs/PROJECT_STATE.md`.
2. Read the files directly related to the request.
3. Consult `docs/DECISIONS.md` for established product or technical decisions relevant to the change.
4. Inspect the current implementation before editing; do not rely on previous chat context as the source of truth.

## Source of truth

When documentation and implementation disagree:

1. Current source code and tests define existing behavior.
2. `docs/DECISIONS.md` defines intentional architectural and product constraints.
3. `docs/PROJECT_STATE.md` describes the current implementation, active work, known issues, and verification state.
4. `README.md` documents user-facing behavior and architecture.

Do not silently change established behavior merely to make it match stale documentation. Determine whether the implementation or documentation should be updated.

## Project conventions

- This is a local-only React + TypeScript + Vite application. Do not add a backend, accounts, API keys, online assets, or runtime external services unless explicitly requested.
- Keep acoustic computation independent of React/rendering in `src/domain/acoustics.ts`.
- Preserve typed geometry and unit conversions in `src/domain/model.ts`.
- Preserve import validation, undo/redo, immutable milestone history, and localStorage compatibility when changing workspace data or object behavior.
- Internal lengths are metres. The room origin is front-left floor: X = width, Y = height, Z = front-to-rear length.
- Reflection rays are approximate geometric visualizations, not measurements or complete acoustic simulations.
- Preserve existing working functionality unless the requested change explicitly replaces it.
- Avoid unrelated refactoring or cleanup while implementing a scoped request.

## Working-tree safety

- Preserve unrelated existing and uncommitted changes.
- Before editing a file, inspect its current contents.
- Do not assume a file still matches previous chat context, documentation, or an earlier version.
- Do not revert, overwrite, reformat, or clean up unrelated work unless explicitly requested.
- Keep changes limited to files required for the requested behavior whenever practical.

## Verification

- During development, run the narrowest relevant tests.
- Before handing off a completed feature, run `npm run verify`.
- Run relevant Playwright tests for changes affecting user interaction, rendering, layout, import/export, history, or browser behavior.
- If required verification cannot be run, state exactly what was not run and why.

## Releases

- Keep the application version in `package.json` and `package-lock.json` aligned.
- Summarize user-facing release changes in `CHANGELOG.md` and keep `README.md` focused on current behavior.
- Before publishing a release, run `npm run verify` and the full Playwright suite, then record the result in `docs/PROJECT_STATE.md`.
- Release tags use the `v<major>.<minor>.<patch>` form. Do not move or replace an existing tag without explicit approval.

## Documentation

- Update `README.md` when user-facing behavior or architecture changes.
- Update `docs/PROJECT_STATE.md` after meaningful work. Keep it focused on current state, active work, known limitations, verification, and next tasks; do not use it as a chronological development log.
- Add durable product or technical decisions to `docs/DECISIONS.md`.
- Do not duplicate temporary implementation history across documentation files.
