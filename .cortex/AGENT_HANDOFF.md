# AGENT_HANDOFF

Last updated: 2026-04-18 18:08:50 -03

## Current handoff

This repository already has a functioning CORTEX layer and it must now be maintained continuously.

Current state:

- baseline branch in use: `VSCODEX1807`
- current HEAD reference: `0496003`
- continuity source outside `.cortex/`: `Docs/RETOMADA_SEGURA.md`
- continuity source inside `.cortex/`: `CURRENT_STATUS.md` + `RETOMADA_MASTER.md` + `TASK_LEDGER.md`

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

## Next safe step

Stay on `VSCODEX1807`, validate the baseline, and record the actual results before starting hardening work.
