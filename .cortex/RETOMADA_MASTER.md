# RETOMADA_MASTER

Last updated: 2026-05-03 10:55:37 -03

## Purpose

This is the master recovery guide for interrupted-session work on the active `VSCODEX` branch.

If work is resumed after VS Code closes, chat context is lost, or an agent changes, this file should provide the shortest safe path back into the project.

## Active recovery identity

- Recovery branch: `main`
- Remote recovery branch: `origin/main`
- Branch created at: not applicable for this checkpoint
- Current HEAD reference at creation: `1d34d0b`
- Current live HEAD: `d1abdc4`
- Previous continuity base commit: `1d34d0b`
- Timezone for all continuity records: `America/Sao_Paulo`

## Current project state

- The live working line is post-Reversa `main`, remote-runtime deploy enablement, and homologation-safe Supabase dry-run
- The saved repo line to continue is no longer the old `VSCODEX1807` branch
- The app baseline is `v34`
- The repo now has a project-specific review guide and a local PWA/offline validation path
- The repo completed Etapa 3 and started Etapa 4 security hardening before backend expansion
- The local post-merge Supabase homologation passed, but published deploys still need browser-safe `env.js` before real-unit authentication

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
- validated the published URLs as reachable but blocked for remote functional homologation because runtime Supabase env was missing
- pushed remote-runtime hotfix `d1abdc4` to load optional `env.js` in deployed HTTP/HTTPS runtimes and generate it on Vercel
- verified Vercel serves `/env.js` with HTTP `200`, but Supabase public env values are still absent
- configured Vercel production public Supabase env vars and redeployed production
- verified published runtime has `hasEnv=true` and smoke passes against `https://wpm-gestao-interna.vercel.app/`
- confirmed remote Supabase still has no units, so real dry-run awaits initial unit/admin bootstrap

## Exact next step

Close the current checkpoint cleanly, then continue deploy homologation:

1. define/approve real remote bootstrap data
2. create/confirm remote Auth admin user
3. run `public.bootstrap_unit_admin(...)` once via administrative SQL/service_role
4. authenticate in the real unit and run only the migration dry-run

The latest validation already recorded for this session is:

1. `npx vitest run tests/unit/reconstruction-env-bootstrap.test.js tests/unit/runtime-env.test.js tests/unit/reconstruction-app-shell.test.js tests/unit/reconstruction-service-worker-pwa.test.js` OK with `44 passed`
2. `git diff --check` OK
3. `npm run smoke:deploy` OK with `1 passed` against local HTTP runtime
4. `DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy` OK with `1 passed`
