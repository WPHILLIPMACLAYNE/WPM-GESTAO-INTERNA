# CURRENT_STATUS

Snapshot date: 2026-04-22
Last updated: 2026-04-22 16:08:54 -03

## Live status

- Branch: `VSCODEX1807`
- HEAD: `8c57fb4`
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
- `src/core/seed.js` still appears to keep a `rankSnapshot` semantic mismatch candidate

## Current safe next step

After the validated baseline and service-worker hardening:

1. stay on `VSCODEX1807` for recovery-safe work
2. push the continuity checkpoint so local and remote converge again
3. begin Etapa 3 before backend expansion
4. first validate `rankSnapshot`, duplicate-event logic, and persistence rollback behavior

Latest validation result:

1. `node --check sw.js` OK
2. `npm test` OK with `129 passed`
3. `npx playwright test tests/e2e/service-worker.spec.js --reporter=line` OK with `2 passed`
4. `npm run test:e2e` OK with no issues across all viewports
5. `npx playwright test tests/e2e/app.spec.js --reporter=line` OK with `23 passed`

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
- `rankSnapshot` semantics still require explicit validation
