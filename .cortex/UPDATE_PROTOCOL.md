# UPDATE_PROTOCOL

Last updated: 2026-04-18 18:08:50 -03

## Purpose

Make `.cortex/` a living continuity layer that survives editor crashes, interrupted chats, and agent switches.

## Recovery branch rule

When safe recovery continuity is needed, create and use a branch in this format:

- `VSCODEXHHMM`
- timezone: Sao Paulo (`America/Sao_Paulo`)

Active recovery branch for the current session:

- `VSCODEX1807`
- created at `2026-04-18 18:07:46 -03`

## Mandatory update set

After every completed task, update:

1. `Docs/RETOMADA_SEGURA.md`
2. `.cortex/CURRENT_STATUS.md`
3. `.cortex/AGENT_HANDOFF.md` if the next safe step or guardrails changed
4. `.cortex/TASK_LEDGER.md`
5. `.cortex/RETOMADA_MASTER.md`

## Reference update set

Update only when the underlying facts materially change:

- `.cortex/PROJECT_CONTEXT.md`
- `.cortex/QUICK_REFERENCE.md`
- `.cortex/IMPROVEMENT_BACKLOG.md`
- `.cortex/LEARNING_LEDGER.md`
- `.cortex/REGRESSION_MAP.md`
- `.cortex/RESTRUCTURING_PLAN.md`
- `.cortex/AUDIT_MATRIX.md`
- `.cortex/OPERATOR_PROFILE.md`
- `.cortex/PLANOS_ABC.md`

## Minimum task checkpoint

Every completed task should leave:

- date and time
- branch
- HEAD hash
- task description
- files touched
- validation executed
- open risks or pending items
- exact next step
- Sao Paulo timestamp on the file itself when applicable

## Working rule

If a task is safe to commit, commit it in a small unit.

If a task is not yet safe to commit, the checkpoint still must be written before stopping.

If a task takes more than 7 minutes and finishes in a correct/validated state, it must be committed on the active `VSCODEX` branch.

## Resume order

When work resumes after interruption, read in this order:

1. `Docs/RETOMADA_SEGURA.md`
2. `.cortex/CURRENT_STATUS.md`
3. `.cortex/RETOMADA_MASTER.md`
4. `.cortex/TASK_LEDGER.md`
5. `.cortex/AGENT_HANDOFF.md`
6. live code and `git status`
