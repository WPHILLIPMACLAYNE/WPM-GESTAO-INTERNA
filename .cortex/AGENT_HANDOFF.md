# AGENT_HANDOFF

Last updated: 2026-05-03 10:55:37 -03

## Current handoff

This repository already has a functioning CORTEX layer and it must now be maintained continuously.

Current state:

- baseline branch in use: `main`
- current HEAD reference: `d1abdc4`
- previous continuity base commit: `1d34d0b`
- continuity source outside `.cortex/`: `Docs/RETOMADA_SEGURA.md`
- continuity source inside `.cortex/`: `CURRENT_STATUS.md` + `RETOMADA_MASTER.md` + `TASK_LEDGER.md`
- local executable baseline validated successfully in this session
- visual Playwright suites now freeze browser time to keep snapshots stable
- project-specific review guidance now lives in `Docs/GUIA_CODE_REVIEW_PROJETO.md`
- service worker cache identity now derives from version + precache manifest hash
- service worker registration and precache scope are now safe for root or subpath deploys
- service worker now uses network-first app-shell fetching plus offline shell coverage
- Etapa 3 logic hardening is complete in `eaa4559`
- NPS `rankSnapshot` now uses `mentionId -> position` and legacy invalid snapshots are normalized
- duplicate-event confirmation now happens before persistence and uses normalized title/date/time comparison
- CRUD/event rollback paths now restore in-memory state after persistence failure
- Etapa 4 security hardening started in `5eb1324`
- `script-src` no longer includes `'unsafe-inline'`
- DOMPurify/Chart.js keep CDN loading but now require SRI
- app-shell inline scripts were extracted to `src/core/env-bootstrap.js`, `src/ui/back-to-top.js`, and `src/core/pwa.js`
- Playwright HTTP validation now uses isolated port `4173`
- post-Reversa integration has already landed on `main`
- local post-merge homologation passed against disposable Supabase local
- GitHub Pages and Vercel both answer `200`, but both published artifacts currently lack Supabase runtime env
- the next blocker is deploy configuration, not app bootstrap logic
- `src/core/env-bootstrap.js` now loads optional `env.js` in published HTTP/HTTPS runtimes
- `vercel.json` now generates `env.js` via `npm run build:env`
- commit `d1abdc4` is pushed to `origin/main`
- Vercel now serves `/env.js` with HTTP `200`, but the deploy still lacks Supabase public env values, so `hasEnv=false`
- Vercel production env is now configured and redeployed; published app reports `hasEnv=true`
- remote Supabase `public.units` is still empty, and dev local credentials do not exist remotely
- no real migration was executed in this checkpoint

## What must happen after each completed task

1. update `Docs/RETOMADA_SEGURA.md`
2. update `.cortex/CURRENT_STATUS.md`
3. update `.cortex/AGENT_HANDOFF.md` if the next safe step changed
4. update `.cortex/RETOMADA_MASTER.md`
5. append a task entry to `.cortex/TASK_LEDGER.md`
6. update any affected reference artifact if a stable fact changed

## Immediate guardrails

Do not:

- rewrite the runtime architecture as a first move
- reorder `index.html` scripts casually
- touch persistence, backup, or month lifecycle without targeted regression thinking
- trust old audit language over live code
- end a task without leaving a persistent checkpoint

## Current safe interpretation

The app is stable enough to evolve, but only with:

- branch-safe work
- small reversible steps
- validation-led changes
- continuity artifacts updated at task boundaries

## If resuming after interruption

Read in this order:

1. `Docs/RETOMADA_SEGURA.md`
2. `.cortex/CURRENT_STATUS.md`
3. `.cortex/RETOMADA_MASTER.md`
4. `.cortex/TASK_LEDGER.md`
5. `.cortex/QUICK_REFERENCE.md`

Then inspect `git status`, current branch, and recent commits before editing anything.

## Recovery confirmation rule

If a future session reconstructs the context from the persisted recovery files and confirms the active recovery branch and ledger state correctly, it should start its first confirmation reply with:

`AHAA, CONSEGUI!`

## Next safe step

Bootstrap the remote backend before dry-run:

1. define/approve unit name, unit slug, admin e-mail and display name
2. create/confirm the remote Auth admin user
3. run `public.bootstrap_unit_admin(...)` once via administrative SQL/service_role
4. authenticate in the real unit
5. run only `Executar dry-run` in `Configuracoes` -> `Migracao assistida`
6. do not click `Migrar para o backend` before human preview review
