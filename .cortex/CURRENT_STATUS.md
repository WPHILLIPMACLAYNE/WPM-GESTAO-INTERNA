# CURRENT_STATUS

Snapshot date: 2026-05-03
Last updated: 2026-05-03 10:37:11 -03

## Live status

- Branch: `main`
- HEAD: `d1abdc4`
- Baseline in production: `origin/main`
- App version: `v34`
- Store version: `4`
- Runtime model: browser-only SPA with classic `<script>` files in fixed order
- Active recovery branch: `main` after post-Reversa merge
- Recovery branch created at: not applicable for this checkpoint
- Previous continuity base commit: `1d34d0b`
- Remote tracking branch: `origin/main`

## Current working reading

The project is operationally mature, baseline-validated, and now locally hardened on the most urgent PWA/cache risks, while still architecturally fragile.

Current 2026-05-03 reading:

- local Supabase homologation passed after reset/reseed of a disposable local target
- published GitHub Pages and Vercel URLs both answered `200`
- both published artifacts booted in local-first mode but did not expose Supabase runtime env
- the functional remote dry-run cannot proceed until the deploy publishes a browser-safe `env.js`
- `src/core/env-bootstrap.js` now loads optional `env.js` in local and deployed HTTP/HTTPS runtimes
- `vercel.json` now runs `npm run build:env` so Vercel can materialize `env.js` from public/browser-safe env vars
- runtime hotfix commit `d1abdc4` was pushed to `origin/main`
- focused validation passed with 44 Vitest tests and one Playwright smoke against local HTTP runtime

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
- Etapa 4 security hardening started in `5eb1324`
- `script-src` no longer depends on `'unsafe-inline'`
- DOMPurify and Chart.js CDN tags now use SRI plus `crossorigin="anonymous"`
- former inline app-shell scripts now live in `src/core/env-bootstrap.js`, `src/ui/back-to-top.js`, and `src/core/pwa.js`
- Playwright HTTP tests now use an isolated `127.0.0.1:4173` server and never reuse an unrelated process

## Current safe next step

After the validated baseline, service-worker hardening, Etapa 3 logic hardening, Etapa 4 CSP hardening slice, and post-merge local homologation:

1. configure only public/browser-safe deploy env vars in Vercel
2. wait for/retrigger redeploy from `d1abdc4`
3. confirm `/env.js` exists without logging secrets
4. authenticate in the real unit and run only the assisted-migration dry-run

Latest validation result:

1. `npx vitest run tests/unit/reconstruction-env-bootstrap.test.js tests/unit/runtime-env.test.js tests/unit/reconstruction-app-shell.test.js tests/unit/reconstruction-service-worker-pwa.test.js` OK with `44 passed`
2. `git diff --check` OK
3. `npm run smoke:deploy` OK with `1 passed` against local HTTP runtime

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
- remote deploy env still must be configured before real-unit dry-run
- `style-src 'unsafe-inline'` still remains because of inline style attributes/templates
- production CSP/clickjacking headers still need deploy-platform implementation
- XSS regression tests per entity still need to be added
