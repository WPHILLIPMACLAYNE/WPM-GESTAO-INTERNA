# LEARNING_LEDGER

Last updated: 2026-04-18 18:08:50 -03

## 2026-04-14

### L-001

Finding:
The current runtime is not the old single-file app narrative still present in some docs.

Evidence:

- `index.html` loads 30 local script files
- `src/` currently contains 31 files including `src/types.js`
- `Docs/SEPARACAO_EVENTOS_UI.md` and `Docs/SEPARACAO_MAIN_LIFECYCLE_BACKUP.md` document later splits

Operational consequence:
Any future work must treat script order and global availability as live contracts.

### L-002

Finding:
The repository contains documentation drift across time.

Evidence:

- `QWEN.md` and `Docs/DOCUMENTACAO.md` still describe the system as single-file in major sections
- `MODULE_MAP.md` matches the present split more closely
- old audits mention risks already corrected in current code

Operational consequence:
Use live code first, then use docs as dated evidence.

### L-003

Finding:
Several audit-noted issues are already fixed in the current branch tip.

Evidence:

- `package.json` uses `Scripts/responsive-test.mjs` and `Scripts/visual-check.mjs`
- `playwright.config.js` uses a local HTTP server
- `src/core/config.js` now formats local dates without `toISOString().slice(...)`
- `src/features/crud.js` now compares event duplicate time against `entity.time`
- `styles.css` contains explicit Bug 2 and Bug 3 mobile fixes
- recent commits `87d85c7`, `e88daab`, `a21f6e4`

Operational consequence:
Do not reopen closed problems because of stale docs.

### L-004

Finding:
Executable validation is currently blocked by environment state, not by an observed app regression.

Evidence:

- `npm test` returned `vitest: not found`
- `npx playwright test --reporter=list` returned missing `@playwright/test`

Operational consequence:
The next safe step is dependency restoration and revalidation, not source surgery.

### L-005

Finding:
Structural fragility still centers on the runtime contract, not on syntax.

Evidence:

- classic `<script>` loading in `index.html`
- shared globals in `src/core/config.js`
- `APP_INTERNALS` aggregation in `src/main.js`
- debt records in `TECH_DEBT.md`

Operational consequence:
Any restructuring must be regression-led and order-aware.

### L-006

Finding:
The dashboard mobile regressions documented on 2026-04-10 were followed by code fixes and snapshot updates.

Evidence:

- `Docs/DIAGNOSTICO_MOBILE.md`
- `styles.css` mobile override blocks
- commits `e88daab` and `a21f6e4`

Operational consequence:
Dashboard mobile is a known regression hotspot and should stay in every verification checklist.

### L-007

Finding:
`sw.js` improved versus older audits, but its cache version is still independent from `APP_VERSION`.

Evidence:

- older docs cite `wpm-v1`
- current `sw.js` uses `wpm-2026-04-10`
- current `APP_VERSION` is `v34`

Operational consequence:
Cache invalidation is less risky than before, but still not aligned to a canonical release identifier.

### L-008

Finding:
There is at least one remaining type/semantic mismatch candidate in NPS ranking state.

Evidence:

- `src/core/seed.js` initializes `rankSnapshot` with `Object.fromEntries(mentions.map(item => [item.name, item.count]))`
- `src/types.js` documents `rankSnapshot` as `{ [mentionId]: position }`

Operational consequence:
Treat NPS ranking history as a targeted validation candidate before deeper refactors.

## 2026-04-18

### L-009

Finding:
The original `.cortex/` install was useful as a bootstrap snapshot, but not strong enough as a live continuity system.

Evidence:

- recovery of the interrupted work depended on reading multiple scattered documents
- `CURRENT_STATUS.md` and `AGENT_HANDOFF.md` were still framed as one-time bootstrap outputs
- no dedicated task ledger existed inside `.cortex/`

Operational consequence:
`.cortex/` must be maintained as a living handoff layer after every completed task, not only during initial installation.

### L-010

Finding:
The most useful split inside `.cortex/` is between living continuity files and slower-moving reference files.

Evidence:

- `CURRENT_STATUS.md`, `AGENT_HANDOFF.md`, and `Docs/RETOMADA_SEGURA.md` are needed at every resume
- files such as `PROJECT_CONTEXT.md`, `AUDIT_MATRIX.md`, and `RESTRUCTURING_PLAN.md` remain valuable but do not need per-task churn

Operational consequence:
Future maintenance should update a small mandatory core on every task and touch the broader reference set only when stable facts actually change.

### L-011

Finding:
Recovery continuity gets stronger when work happens on a predictable timestamped recovery branch rather than directly on `main`.

Evidence:

- the active recovery branch is now `VSCODEX1807`
- the user explicitly wants session-loss recovery to depend on persisted repo state, not editor memory

Operational consequence:
For interrupted-session work, prefer the active `VSCODEXHHMM` branch and treat it as the primary continuity track until the work is safely committed and handed off.
