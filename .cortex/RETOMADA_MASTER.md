# RETOMADA_MASTER

Last updated: 2026-04-22 16:38:51 -03

## Purpose

This is the master recovery guide for interrupted-session work on the active `VSCODEX` branch.

If work is resumed after VS Code closes, chat context is lost, or an agent changes, this file should provide the shortest safe path back into the project.

## Active recovery identity

- Recovery branch: `VSCODEX1807`
- Remote recovery branch: `origin/VSCODEX1807`
- Branch created at: `2026-04-18 18:07:46 -03`
- Current HEAD reference at creation: `0496003`
- Current live HEAD: `5eb1324`
- Previous continuity base commit: `623b50a`
- Timezone for all continuity records: `America/Sao_Paulo`

## Current project state

- The live working line is baseline stabilization, service-worker hardening, and recovery-safe continuity
- The saved repo line to continue is not the Supabase/backend PR branch
- The app baseline is `v34`
- The repo now has a project-specific review guide and a local PWA/offline validation path
- The repo completed Etapa 3 and started Etapa 4 security hardening before backend expansion

## Mandatory read order on resume

1. `Docs/RETOMADA_SEGURA.md`
2. `.cortex/CURRENT_STATUS.md`
3. `.cortex/RETOMADA_MASTER.md`
4. `.cortex/TASK_LEDGER.md`
5. `.cortex/AGENT_HANDOFF.md`
6. `git status`, current branch, recent commits

## Mandatory update order after each completed task

1. `Docs/RETOMADA_SEGURA.md`
2. `.cortex/CURRENT_STATUS.md`
3. `.cortex/RETOMADA_MASTER.md`
4. `.cortex/AGENT_HANDOFF.md` if next step changed
5. `.cortex/TASK_LEDGER.md`

## Commit rule

- If a task takes more than 7 minutes and finishes in a correct state, commit it on the active `VSCODEX` branch.
- Always record the Sao Paulo date/time in the continuity files when updating them.
- If the task is not yet safe to commit, the continuity files still must be updated before stopping.

## Session handoff test

If a new Codex session resumes this branch using the standard recovery commands and correctly identifies:

- branch `VSCODEX1807`
- continuity commit lineage from `623b50a`
- this master recovery file
- the current task ledger entry for this handoff test

then it must begin its first recovery confirmation response with the exact phrase:

`AHAA, CONSEGUI!`

This phrase is a continuity test marker and should be used only when the new session has actually reconstructed the intended context from the persisted files.

## Latest completed continuity work

- converted `.cortex/` into a living continuity layer
- created `VSCODEX1807` as the active recovery branch
- established the timestamped recovery-branch rule `VSCODEXHHMM`
- synchronized the continuity protocol across the main recovery files
- validated the local executable baseline end-to-end
- stabilized Playwright visual snapshots by freezing browser time in the visual suites
- tied the service worker cache identity to `APP_VERSION` + precache-manifest hash
- added a project-specific code review guide linked from `AGENTS.md`
- hardened the service worker with scope-safe app-shell caching, network-first fetching, and update messaging
- added dedicated Playwright coverage for service-worker registration and offline shell behavior
- fixed NPS `rankSnapshot` generation/normalization to use `mentionId -> position`
- moved duplicate-event confirmation before persistence and normalized the duplicate title comparison
- strengthened CRUD and direct event rollback behavior when persistence fails
- removed inline JavaScript from the app shell and tightened `script-src`
- added SRI to DOMPurify/Chart.js CDN scripts
- isolated the Playwright HTTP server on port `4173`
- published the active recovery branch to GitHub with upstream tracking enabled

## Exact next step

Close the current checkpoint cleanly, then continue Etapa 4:

1. commit this continuity checkpoint and push to `origin/VSCODEX1807`
2. address or explicitly scope the remaining `style-src 'unsafe-inline'`
3. add production CSP/clickjacking headers
4. add XSS regression tests per user-editable entity

The latest validation already recorded for this session is:

1. `npm audit --audit-level=moderate` OK with `0 vulnerabilities`
2. `node --check src/core/env-bootstrap.js src/core/pwa.js src/ui/back-to-top.js sw.js` OK
3. `npm test -- --run --reporter=dot` OK with `130 passed`
4. `npx playwright test tests/e2e/service-worker.spec.js --reporter=line` OK with `2 passed`
5. `npx playwright test tests/e2e/app.spec.js --reporter=line` OK with `25 passed`
6. `npm run test:e2e` OK with no issues across all viewports
