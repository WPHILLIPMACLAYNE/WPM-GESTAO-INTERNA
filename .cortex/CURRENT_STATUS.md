# CURRENT_STATUS

Snapshot date: 2026-04-22
Last updated: 2026-04-22 16:26:40 -03

## Live status

- Branch: `VSCODEX1807`
- HEAD: `eaa4559`
- Baseline in production: `origin/main`
- App version: `v34`
- Store version: `4`
- Runtime model: browser-only SPA with 30 classic `<script>` files in fixed order
- Active recovery branch: `VSCODEX1807`
- Recovery branch created at: `2026-04-18 18:07:46 -03`
- Previous continuity base commit: `623b50a`
- Remote tracking branch: `origin/VSCODEX1807`

## Current working reading

The project is operationally mature, baseline-validated, and now locally hardened on the most urgent PWA/cache risks, while still architecturally fragile.

Confirmed live facts:

- `index.html` script order remains a hard runtime contract
- `window.__APP_INTERNALS__` is exposed and part of the continuity surface
- `package.json` already points `test:e2e` and `test:visual` to `Scripts/...`
- `todayISO()` already uses local-date formatting
- the local baseline now validates with `npm test`, Playwright structure checks, responsive smoke, and dedicated service-worker coverage
- Playwright visual suites required a fixed browser clock to stop date-driven snapshot drift
- `Docs/GUIA_CODE_REVIEW_PROJETO.md` now defines severity, evidence, and validation expectations for this repo
- `sw.js` cache identity is now tied to `APP_VERSION` plus a hash of the active precache manifest
- service worker registration, manifest scope, and precache paths are now safe for root or subpath deploys
- the app shell now uses network-first fetches with cached offline fallback
- Etapa 3 logic hardening is now completed locally in `eaa4559`
- `rankSnapshot` now normalizes to `{ mentionId: position }` in generated and legacy-normalized NPS data
- duplicate-event confirmation now runs before persistence and compares normalized titles plus date/time
- CRUD rollback now restores `state`, `storage.periods`, selector cache, and affected render targets when persistence fails
- direct event delete/duplicate paths now restore their previous event collection on persistence failure

## Current safe next step

After the validated baseline, service-worker hardening, and Etapa 3 logic hardening:

1. stay on `VSCODEX1807` for recovery-safe work
2. commit this continuity checkpoint
3. push `VSCODEX1807` so local and remote converge again
4. begin Etapa 4 security work before backend expansion

Latest validation result:

1. `node --check src/utils/helpers.js src/core/seed.js src/core/lifecycle.js src/domain/selectors.js src/features/crud.js src/ui/render-events.js` OK
2. `npx vitest run tests/unit/selectors-real.test.js --reporter=dot` OK with `7 passed`
3. `npx playwright test tests/e2e/workflows.spec.js -g "eventos fazem rollback" --reporter=line` OK with `1 passed`
4. `npm test -- --run --reporter=dot` OK with `130 passed`
5. `npx playwright test tests/e2e/workflows.spec.js --reporter=line` OK with `8 passed`

## CORTEX operating rule

`.cortex/` is now a living continuity layer, not a one-time bootstrap snapshot.

After every completed task:

1. update `CURRENT_STATUS.md`
2. update `AGENT_HANDOFF.md`
3. update `RETOMADA_MASTER.md`
4. append an entry to `TASK_LEDGER.md`
5. update any reference artifact that changed materially

Protocol details live in `UPDATE_PROTOCOL.md`.

## Authoritative priority

For present-state decisions, trust these in order:

1. live code in `index.html`, `src/`, `sw.js`, configs
2. `Docs/RETOMADA_SEGURA.md`
3. `CURRENT_STATUS.md`
4. `RETOMADA_MASTER.md`
5. `TASK_LEDGER.md`
6. `MODULE_MAP.md`
7. other audit/reference docs as dated evidence

## Main unresolved pressures

- script-order coupling
- shared mutable globals
- storage, backup, and lifecycle centrality
- documentation drift across historical docs
- deploy/rollback validation in a reused browser is still pending outside local tests
- CSP/CDN hardening gap
- Etapa 4 security hardening is the next high-priority line
