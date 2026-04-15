# START HERE

> Mandatory entrypoint for any LLM, coding agent, CLI harness, or assistant using CORTEX.

## What this repository is

This repository is the official CORTEX source package.
It contains the protocol, modes, templates, adapters, and installer used to apply CORTEX to another repository.

If you are validating the package manually before handing it to an agent, see [`docs/installing.md`](docs/installing.md).

Your job is to apply CORTEX to a target project **autonomously, safely, and non-intrusively**.

## Default posture

Act as a senior project evolution operator.

Default behavior:
- advisory first;
- verify before acting;
- branch safety always;
- install `.cortex/` into the target project;
- generate audit and restructuring artifacts;
- do not change functional code unless explicitly authorized.

## Mandatory read order

Read these files in order before touching a target repository:

1. `PROTOCOL.md`
2. `MODES.md`
3. `MANIFEST.yaml`

Then inspect the target repository.

## Required first-run sequence

1. Identify the target repository state.
2. Determine whether `.cortex/` already exists.
3. Locate the latest confirmed stable branch.
4. Create a new isolated branch from that stable branch.
5. Install `.cortex/` using `cortex init` (or `python -m cli init`, or `scripts/install_cortex.py`).
6. Install git hooks using `cortex hooks install` for branch protection.
7. Populate or update the initial CORTEX files.
8. Produce the first audit and restructuring outputs.
9. Run `cortex score` to compute the initial CSEI.
10. Record the next safe step in `.cortex/CURRENT_STATUS.md`.

## Branch law

- Never start work directly on `main`.
- Never branch from an unknown or unstable branch.
- Always base new work on the last stable branch.
- Never merge to `main` unless the operator explicitly owns that action.

## First-application output

The target project should end up with:
- `.cortex/PROJECT_CONTEXT.md`
- `.cortex/CURRENT_STATUS.md`
- `.cortex/AGENT_HANDOFF.md`
- `.cortex/QUICK_REFERENCE.md`
- `.cortex/PLANOS_ABC.md`
- `.cortex/LEARNING_LEDGER.md`
- `.cortex/REGRESSION_MAP.md`
- `.cortex/IMPROVEMENT_BACKLOG.md`
- `.cortex/AUDIT_MATRIX.md`
- `.cortex/RESTRUCTURING_PLAN.md`
- `.cortex/OPERATOR_PROFILE.md`

## Hard boundary

If repository state is unclear, stay in Advisory Mode.
Audit, document, and stabilize first.
Do not silently escalate authority.

## First instruction template

If the operator provides no further detail, assume this instruction:

```text
Apply CORTEX to this project in Advisory Mode. Verify the repository state, identify the last stable branch, create a new isolated branch from it, install .cortex/, generate the first audit and restructuring artifacts, and finish with the next safe step documented in .cortex/CURRENT_STATUS.md.
```
