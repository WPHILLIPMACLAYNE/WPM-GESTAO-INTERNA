# CORTEX PROTOCOL

## Definition

CORTEX is a Project Evolution Operating System for AI-built software.
It is a non-intrusive operating layer that preserves continuity, enforces safety, records memory, audits structure, and guides progressive evolution.

## Core purpose

CORTEX exists to make project state recoverable across agent changes.
It turns repository files into durable operational memory so a new capable agent can resume safely without depending on chat history.

## Operating loop

Observe -> Verify -> Record -> Score -> Compare -> Prioritize -> Isolate -> Execute -> Review -> Learn -> Handoff

## Mandatory laws

### Law 1 - Repository is memory
Repository files and CORTEX files are the source of truth.
Chat memory is never the source of truth.

### Law 2 - Every agent is replaceable
Continuity must survive agent changes.

### Law 3 - Branch isolation is mandatory
Every new meaningful task happens in a new isolated branch created from the last stable branch.

### Law 4 - Verify before changing
Before touching anything, verify:
- git remote
- current branch
- last stable branch
- latest relevant commits
- project phase
- active risks

### Law 5 - Repeated regressions become guardrails
If a regression repeats, it must become a protection rule.

### Law 6 - Repeated successes become standards
If a good pattern works repeatedly, it must become an operational standard.

### Law 7 - Unknown state means advisory only
If the project state is unclear, do not implement features.
Audit, document, and stabilize first.

## Default boundaries

By default, CORTEX operates around the project before it operates inside the project.

It should first:
- inspect repository state;
- inspect branching reality;
- document what exists;
- document what is unsafe;
- define the next safe step;
- preserve continuity for the next agent.

## First-run procedure

1. Determine whether `.cortex/` already exists.
2. If not, install the standard CORTEX template set.
3. Inspect project structure.
4. Populate `PROJECT_CONTEXT.md` with observed state.
5. Populate `CURRENT_STATUS.md` with current phase and safe next step.
6. Produce `AUDIT_MATRIX.md`.
7. Produce `RESTRUCTURING_PLAN.md`.
8. Produce `IMPROVEMENT_BACKLOG.md`.
9. Update `AGENT_HANDOFF.md` for future agents.

## Evidence standard

Recommendations should point back to observable evidence from the target repository:
- files;
- branches;
- commits;
- configuration;
- tests;
- runtime notes;
- repeated failure patterns.

If evidence is weak, mark the conclusion as tentative.

## Knowledge ladder

- Observation
- Signal
- Pattern
- Rule
- DNA

### Escalation rules
- one important incident -> Observation
- two similar incidents -> Signal
- three confirmed repetitions -> Pattern
- validated pattern with operational value -> Rule
- repeatedly useful rule -> DNA

## CSEI score

CORTEX Structural Evolution Index dimensions:
- Structure
- Clarity
- Safety
- Verification
- Continuity
- Recoverability
- Regression Pressure

All dimensions are scored 0-5.

Formula:

```text
Base Score =
(Structure + Clarity + Safety + Verification + Continuity + Recoverability) / 6

RegressionPressure = Regression Pressure score

CSEI =
round((Base Score * 20) * (1 - (RegressionPressure * 0.08)))
```

## Default authority boundaries

By default CORTEX can:
- read the repo;
- create `.cortex/` files;
- write audit docs;
- propose plans;
- define guardrails;
- create branches;
- recommend next steps.

By default CORTEX cannot:
- merge to main;
- force push;
- run destructive database commands;
- rewrite production infrastructure;
- silently change functional core logic.

## End state of a good session

A correct CORTEX session leaves the repository safer and easier to resume than before.
At minimum, the next agent should be able to answer:
- what this project is;
- where it stands now;
- what is stable;
- what is risky;
- what should happen next;
- what should not be touched yet.
