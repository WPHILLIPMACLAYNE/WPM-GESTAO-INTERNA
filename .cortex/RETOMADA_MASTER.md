# RETOMADA_MASTER

Last updated: 2026-04-22 16:26:40 -03

## Purpose

This is the master recovery guide for interrupted-session work on the active `VSCODEX` branch.

If work is resumed after VS Code closes, chat context is lost, or an agent changes, this file should provide the shortest safe path back into the project.

## Active recovery identity

- Recovery branch: `VSCODEX1807`
- Remote recovery branch: `origin/VSCODEX1807`
- Branch created at: `2026-04-18 18:07:46 -03`
- Current HEAD reference at creation: `0496003`
- Current live HEAD: `eaa4559`
- Previous continuity base commit: `623b50a`
- Timezone for all continuity records: `America/Sao_Paulo`

## Current project state

- The live working line is baseline stabilization, service-worker hardening, and recovery-safe continuity
- The saved repo line to continue is not the Supabase/backend PR branch
- The app baseline is `v34`
- The repo now has a project-specific review guide and a local PWA/offline validation path
- The repo completed the Etapa 3 logic-hardening line and should move to security hardening before backend expansion

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
- published the active recovery branch to GitHub with upstream tracking enabled

## Exact next step

Close the current checkpoint cleanly, then move to Etapa 4:

1. commit this continuity checkpoint and push to `origin/VSCODEX1807`
2. start the security-hardening line before backend expansion
3. run `npm audit --audit-level=moderate`
4. plan SRI/local hosting for CDN libraries and CSP cleanup

The latest validation already recorded for this session is:

1. `node --check src/utils/helpers.js src/core/seed.js src/core/lifecycle.js src/domain/selectors.js src/features/crud.js src/ui/render-events.js` OK
2. `npx vitest run tests/unit/selectors-real.test.js --reporter=dot` OK with `7 passed`
3. `npx playwright test tests/e2e/workflows.spec.js -g "eventos fazem rollback" --reporter=line` OK with `1 passed`
4. `npm test -- --run --reporter=dot` OK with `130 passed`
5. `npx playwright test tests/e2e/workflows.spec.js --reporter=line` OK with `8 passed`
