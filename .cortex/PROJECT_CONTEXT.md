# PROJECT_CONTEXT

Snapshot date: 2026-04-14
Repository: `WPM-GESTAO-INTERNA`
Evidence basis: `index.html`, `package.json`, `playwright.config.js`, `vitest.config.js`, `sw.js`, `MODULE_MAP.md`, `MIGRATION_STATUS.md`, `TECH_DEBT.md`, `QWEN.md`, `Docs/AUDITORIA_COMPLETA.md`, `Docs/AUDITORIA_2604.md`, `Docs/BUGS_CONHECIDOS.md`, `Docs/DIAGNOSTICO_MOBILE.md`, `Docs/MAPA_ENTIDADES.md`, `Docs/PROXIMOS_PASSOS.md`, `Docs/SEPARACAO_EVENTOS_UI.md`, `Docs/SEPARACAO_MAIN_LIFECYCLE_BACKUP.md`.

## Purpose

`WPM Gestão Interna` is a browser-only internal operations app for reception workflows. The repository evidence shows eight operating domains in the UI:

- Dashboard
- Alunos novos
- Vendas de addons
- Pendências
- NPS
- Escala
- Eventos e ações
- Configurações

The app is period-based by month, stores data locally, exposes diagnostics, and preserves operational continuity without requiring a backend in the current architecture.

## Actual runtime model

The current repo is not a single inline-runtime file anymore. The active runtime is:

- `index.html` + `styles.css`
- 30 classic `<script>` files loaded in fixed order
- browser globals shared across files
- no `type="module"` in the runtime
- no build step in the app runtime
- local persistence via IndexedDB plus localStorage mirror/fallback
- optional PWA layer via `sw.js`

Critical implication: behavior still depends on script order and shared globals. Structural fragility is architectural, not merely documentary.

## Current module shape

Observed under `src/`:

- `src/core/`: 7 files
- `src/domain/`: 1 file
- `src/features/`: 5 files
- `src/ui/`: 15 files
- `src/utils/`: 1 file
- `src/main.js`
- `src/types.js` as non-runtime JSDoc/reference support

`index.html` currently loads, in order:

1. `src/utils/helpers.js`
2. `src/core/config.js`
3. `src/core/period-builder.js`
4. `src/core/seed.js`
5. `src/core/schema.js`
6. `src/core/storage.js`
7. `src/domain/selectors.js`
8. `src/features/forms.js`
9. `src/features/nps.js`
10. `src/features/csv.js`
11. `src/features/diagnostics.js`
12. `src/ui/render-core.js`
13. `src/ui/render-dashboard.js`
14. `src/ui/render-students.js`
15. `src/ui/render-pending.js`
16. `src/ui/render-nps.js`
17. `src/ui/render-scale.js`
18. `src/ui/render-events.js`
19. `src/ui/render-settings.js`
20. `src/ui/render-addons.js`
21. `src/features/crud.js`
22. `src/ui/events-core.js`
23. `src/ui/events-students.js`
24. `src/ui/events-pending.js`
25. `src/ui/events-addons.js`
26. `src/ui/events-scale.js`
27. `src/ui/events-nps.js`
28. `src/core/backup.js`
29. `src/core/lifecycle.js`
30. `src/main.js`

## Stable facts confirmed from code

- `APP_VERSION` in `src/core/config.js` is `v34`.
- `STORE_VERSION` in `src/core/config.js` is `4`.
- IndexedDB database is `wpm-gestao-interna-db`.
- Primary storage key is `recepcao-smartfit-dashboard-v34`.
- `window.__APP_INTERNALS__` is exposed in `src/main.js`.
- `package.json` already points `test:e2e` and `test:visual` to `Scripts/...`.
- `playwright.config.js` now uses a local HTTP server instead of an old absolute file path.
- `vitest.config.js` coverage now targets `src/**/*.js`.
- `sw.js` cache name is currently `wpm-2026-04-10`.
- `todayISO()` now uses local-date formatting rather than `toISOString().slice(...)`.
- `src/features/crud.js` compares event duplicate time against `entity.time`, not against itself.
- `styles.css` contains mobile dashboard fixes for Bug 2 and Bug 3.

## Documentation drift already present

The repository contains both current and stale narratives.

Current-enough structural sources:

- `MODULE_MAP.md`
- `TECH_DEBT.md`
- `Docs/SEPARACAO_EVENTOS_UI.md`
- `Docs/SEPARACAO_MAIN_LIFECYCLE_BACKUP.md`
- recent git history

Historically useful but partially outdated:

- `QWEN.md`
- `Docs/DOCUMENTACAO.md`
- `Docs/AUDITORIA_2604.md`
- `Docs/AUDITORIA_COMPLETA.md`
- `Docs/DIAGNOSTICO_MOBILE.md`

Main drift pattern:

- several docs still describe a single-file or older split state
- some documented risks were already fixed in later commits
- docs still mention files that no longer exist in runtime, such as `src/ui/render.js`

## Current architectural reading

Best-fit description from evidence:

- advisory category: functional app with fragile internals
- architecture category: browser-only modularized script-chain SPA
- operational category: monthly local-first internal operations console
- testing category: meaningful automated coverage exists in-repo, but executable validation depends on installing dev dependencies
- change strategy category: preserve behavior first, then harden seams, then consider deeper restructuring

## Current safe interpretation

This repo is already beyond initial modularization, but not yet at true module isolation. The safe posture is:

- treat `index.html` script order as a contract
- treat storage schema and lifecycle as critical state infrastructure
- treat dashboard/mobile, backup/import, and month transitions as regression-sensitive surfaces
- treat existing audits as evidence, not as authoritative current truth
