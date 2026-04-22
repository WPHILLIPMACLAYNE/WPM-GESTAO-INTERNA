# Repository Guidelines

## Project Structure & Module Organization
`index.html` is the runtime entrypoint. The app is browser-only, with script load order documented in `MODULE_MAP.md`. Keep feature code split by responsibility:
- `src/core/`: storage, backup, lifecycle, schema, config.
- `src/domain/`: pure selectors and computed state.
- `src/features/`: CRUD, forms, CSV, NPS, diagnostics.
- `src/ui/`: `render-*` and `events-*` modules.
- `src/utils/`: shared helpers.
- `tests/unit`, `tests/integration`, `tests/e2e`: Vitest, integration, and Playwright coverage.
- `Scripts/`: local env/bootstrap and visual/responsive checks.

## Build, Test, and Development Commands
- `npm install`: installs deps and runs `Scripts/setup-env.mjs`.
- `npm run build:env`: regenerates the local `env.js` bootstrap.
- `npm test`: runs Vitest unit and integration tests.
- `npm run test:coverage`: emits coverage reports for `src/**/*.js`.
- `npm run test:e2e`: runs the responsive Playwright smoke suite.
- `npm run test:visual`: captures screenshots for visual review.
- `npm run test:all`: runs unit tests and E2E together.
- Local run: serve the repo over HTTP, for example `python3 -m http.server 3000`, then open `http://localhost:3000`.

## Coding Style & Naming Conventions
Use the existing ES2022 style, semicolons, and JSDoc comments where helpful. Match the indentation already used in the file you are editing; do not reformat unrelated blocks. Keep filenames predictable: `render-*.js`, `events-*.js`, `*.test.js`, and snapshot assets under `tests/e2e/*-snapshots/`. This repo uses `checkJs`, so keep JSDoc types and globals consistent.

## Testing Guidelines
Vitest runs in `happy-dom`; Playwright uses Chromium with a single local web server. Place pure logic tests in `tests/unit/`, workflow tests in `tests/integration/`, and browser coverage in `tests/e2e/`. Name tests by behavior, not implementation. When UI output changes, update snapshots intentionally and mention it in the PR.

## Commit & Pull Request Guidelines
History follows Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Use a short imperative summary and add a scope when useful, for example `fix(ui): ajusta cards mobile`. PRs should include a clear description, the validation commands you ran, and screenshots or snapshot notes for visual changes.
For reviews with code or release impact, follow [`Docs/GUIA_CODE_REVIEW_PROJETO.md`](Docs/GUIA_CODE_REVIEW_PROJETO.md) to keep severity, evidence, and validation consistent.

## Security & Configuration Tips
Do not commit secrets or real environment values. Use `env.example.js` as the template and generate local runtime config with `npm run build:env`. Because the app depends on script order and a service worker, verify `index.html`, `sw.js`, and `MODULE_MAP.md` together before changing bootstrap flow.
