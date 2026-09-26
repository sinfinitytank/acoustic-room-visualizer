# Contributing

Thanks for improving Acoustic Room Visualizer. Before opening a pull request, please keep changes focused, preserve existing user data, and validate the affected behavior.

## Local development

Requirements:

- Node.js 22 or later
- npm
- A modern browser with WebGL support

```sh
npm ci
npm run dev
```

Vite prints the local address when the development server starts.

## Checks

Run the relevant checks before submitting a change:

```sh
npm run build
npm run lint
npm test
```

For browser-level changes, run the Playwright suite as well:

```sh
npm run test:e2e
```

Install the Playwright browser once when required:

```sh
npx playwright install chromium
```

## Project conventions

- Keep geometry and acoustic calculations independent of React rendering.
- Preserve the existing import validation, Undo/Redo, milestone history, and browser-storage compatibility when changing workspace data.
- Internal lengths are metres. The room origin is the front-left floor corner; X is width, Y is height, and Z is front-to-rear length.
- Treat reflection paths and room modes as approximations. Do not present them as measurements or complete acoustic predictions.
- Update public documentation when user-visible behavior or model assumptions change.

## Deployment

Pushes to `main` build and publish the GitHub Pages site automatically. The deployment workflow publishes only Vite's production `dist` output.
