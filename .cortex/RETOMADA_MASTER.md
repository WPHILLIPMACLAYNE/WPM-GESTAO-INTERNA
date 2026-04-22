# RETOMADA_MASTER

Last updated: 2026-04-22 16:08:54 -03

## Purpose

This is the master recovery guide for interrupted-session work on the active `VSCODEX` branch.

If work is resumed after VS Code closes, chat context is lost, or an agent changes, this file should provide the shortest safe path back into the project.

## Active recovery identity

- Recovery branch: `VSCODEX1807`
- Remote recovery branch: `origin/VSCODEX1807`
- Branch created at: `2026-04-18 18:07:46 -03`
- Current HEAD reference at creation: `0496003`
- Current live HEAD: `8c57fb4`
- Previous continuity base commit: `623b50a`
- Timezone for all continuity records: `America/Sao_Paulo`

## Current project state

- The live working line is baseline stabilization, service-worker hardening, and recovery-safe continuity
- The saved repo line to continue is not the Supabase/backend PR branch
- The app baseline is `v34`
- The repo now has a project-specific review guide and a local PWA/offline validation path
- The repo still requires logic-hardening work before new functional expansion

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
- published the active recovery branch to GitHub with upstream tracking enabled

## Exact next step

Close the current checkpoint cleanly, then move to Etapa 3:

1. commit and push this continuity checkpoint to `origin/VSCODEX1807`
2. start the logic-hardening line before backend expansion
3. first inspect `src/core/seed.js` `rankSnapshot`
4. then validate duplicate-event logic and persistence rollback paths

The latest validation already recorded for this session is:

1. `node --check sw.js` OK
2. `npm test` OK with `129 passed`
3. `npx playwright test tests/e2e/service-worker.spec.js --reporter=line` OK with `2 passed`
4. `npm run test:e2e` OK with no issues across all viewports
5. `npx playwright test tests/e2e/app.spec.js --reporter=line` OK with `23 passed`
