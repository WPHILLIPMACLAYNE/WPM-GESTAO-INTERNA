# IMPROVEMENT_BACKLOG

Last updated: 2026-04-18 18:08:50 -03

Status key:

- `NOW` = safe next work
- `NEXT` = useful after baseline validation
- `LATER` = structural work after proof and sequencing

## NOW

### BL-000 Keep CORTEX live after every completed task

Why:
Continuity currently depends too much on the active editor/session.

Evidence:

- recent work recovery depended on scattered docs and git history
- `.cortex/` existed as a static bootstrap snapshot rather than a living handoff layer

Safe outcome:
Every finished task leaves a persistent checkpoint in both `Docs/RETOMADA_SEGURA.md` and `.cortex/`.

### BL-000A Make the recovery branch protocol explicit

Why:
Continuity is stronger when the recovery branch naming rule is predictable and timestamp-based.

Evidence:

- recovery work was previously happening on `main`
- the project now needs a stable branch convention for interrupted-session recovery

Safe outcome:
Future interrupted work can resume on a known `VSCODEXHHMM` branch with updated continuity artifacts.

### BL-001 Restore executable validation environment

Why:
Current workspace cannot run Vitest or Playwright due to missing packages.

Evidence:

- `npm test` -> `vitest: not found`
- `npx playwright test --reporter=list` -> missing `@playwright/test`

Safe outcome:
Get a real pass/fail baseline without changing functional code.

### BL-002 Normalize authoritative project docs

Why:
Structural docs disagree across time.

Evidence:

- `QWEN.md` and `Docs/DOCUMENTACAO.md` still lean on older single-file language
- `MODULE_MAP.md` matches the current split better

Safe outcome:
Reduce maintenance errors caused by stale architectural descriptions.

## NEXT

### BL-003 Align service worker cache naming with release identity

Why:
Current cache versioning is better than older `wpm-v1`, but still not tied to `APP_VERSION` or commit.

Evidence:

- `sw.js` uses `wpm-2026-04-10`
- `src/core/config.js` uses `APP_VERSION = v34`

Safe outcome:
Lower deploy/rollback cache ambiguity.

### BL-004 Validate `rankSnapshot` semantics

Why:
Current seed shape appears inconsistent with the documented type.

Evidence:

- `src/core/seed.js`
- `src/types.js`

Safe outcome:
Prevent silent NPS ranking-history drift.

### BL-005 Review CSP and CDN posture

Why:
Security hardening is still incomplete.

Evidence:

- `index.html` still uses `unsafe-inline`
- CDN scripts remain external
- `frame-ancestors` still lives in a meta CSP

Safe outcome:
Harden without changing product behavior.

## LATER

### BL-006 Reduce global coupling in state and lifecycle

Why:
Most structural fragility still comes from shared globals.

Evidence:

- `TECH_DEBT.md`
- `MODULE_MAP.md`
- `src/core/config.js`
- `src/core/lifecycle.js`

Safe outcome:
Better seam definition with less order sensitivity.

### BL-007 Split high-centrality files further

Why:
A few files still carry disproportionate responsibility.

Evidence:

- `src/ui/render-dashboard.js`
- `src/ui/events-core.js`
- `src/core/backup.js`
- `src/core/lifecycle.js`

Safe outcome:
Lower blast radius per change.

### BL-008 Evaluate future runtime modernization only after stabilization

Why:
Deeper architecture change is not the current safe move.

Evidence:

- current runtime still depends on classic scripts
- audits and debt logs repeatedly flag order-coupling risk

Safe outcome:
Make modernization a deliberate phase, not an incidental refactor.
