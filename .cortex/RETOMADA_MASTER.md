# RETOMADA_MASTER

Last updated: 2026-04-18 18:08:50 -03

## Purpose

This is the master recovery guide for interrupted-session work on the active `VSCODEX` branch.

If work is resumed after VS Code closes, chat context is lost, or an agent changes, this file should provide the shortest safe path back into the project.

## Active recovery identity

- Recovery branch: `VSCODEX1807`
- Branch created at: `2026-04-18 18:07:46 -03`
- Current HEAD reference at creation: `0496003`
- Timezone for all continuity records: `America/Sao_Paulo`

## Current project state

- The live working line is baseline stabilization and recovery-safe continuity
- The saved repo line to continue is not the Supabase/backend PR branch
- The app baseline is `v34`
- The repo still requires validation-first work before new functional expansion

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

## Latest completed continuity work

- converted `.cortex/` into a living continuity layer
- created `VSCODEX1807` as the active recovery branch
- established the timestamped recovery-branch rule `VSCODEXHHMM`
- synchronized the continuity protocol across the main recovery files

## Exact next step

Validate the executable baseline on `VSCODEX1807`:

1. `node --check src/main.js`
2. `npm test`
3. `npx playwright test --reporter=line`

Then record the exact result with Sao Paulo timestamp in all living continuity files before moving to the next task.
