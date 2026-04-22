# AGENT_HANDOFF

Last updated: 2026-04-22 16:38:51 -03

## Current handoff

This repository already has a functioning CORTEX layer and it must now be maintained continuously.

Current state:

- baseline branch in use: `VSCODEX1807`
- current HEAD reference: `5eb1324`
- previous continuity base commit: `623b50a`
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
- `VSCODEX1807` now exists on GitHub and tracks `origin/VSCODEX1807`

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

Commit this continuity checkpoint, push `VSCODEX1807`, then continue Etapa 4:

1. address remaining `style-src 'unsafe-inline'` or document the exact blockers
2. add production CSP/clickjacking headers for the selected deploy platform
3. add XSS regression tests for aluno, pendência, evento, recado, NPS and configurações
