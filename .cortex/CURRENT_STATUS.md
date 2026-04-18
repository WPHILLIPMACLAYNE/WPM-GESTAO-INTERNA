# CURRENT_STATUS

Snapshot date: 2026-04-18
Last updated: 2026-04-18 18:22:20 -03

## Live status

- Branch: `VSCODEX1807`
- HEAD: `0496003`
- Baseline in production: `origin/main`
- App version: `v34`
- Store version: `4`
- Runtime model: browser-only SPA with 30 classic `<script>` files in fixed order
- Active recovery branch: `VSCODEX1807`
- Recovery branch created at: `2026-04-18 18:07:46 -03`

## Current working reading

The project is operationally mature and still architecturally fragile.

Confirmed live facts:

- `index.html` script order remains a hard runtime contract
- `window.__APP_INTERNALS__` is exposed and part of the continuity surface
- `package.json` already points `test:e2e` and `test:visual` to `Scripts/...`
- `todayISO()` already uses local-date formatting
- `sw.js` cache naming improved from the old `wpm-v1` state, but still is not tied to `APP_VERSION` or commit
- `src/core/seed.js` still appears to keep a `rankSnapshot` semantic mismatch candidate

## Current safe next step

Before any functional rewrite:

1. stay on `VSCODEX1807` for recovery-safe work
2. validate executable baseline
3. record the exact outcome in this file, `RETOMADA_MASTER.md`, and `TASK_LEDGER.md`
4. only then start scoped hardening work

Suggested validation sequence:

1. `node --check src/main.js`
2. `npm test`
3. `npx playwright test --reporter=line`

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
- service worker release identity still not coupled to version/commit
- CSP/CDN hardening gap
- `rankSnapshot` semantics still require explicit validation
