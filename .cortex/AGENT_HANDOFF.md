# AGENT_HANDOFF

## What was done

Installed the initial CORTEX documentation layer only.

No functional source files were changed.
No architecture rewrite was started.
This snapshot was built from repository evidence, not from assumptions.

## Critical context for the next agent

This repository is already operationally modularized, but not architecturally decoupled.

Key reality:

- the app is still a browser-only classic-script runtime
- script order in `index.html` is a hard dependency
- `storage`, `state`, and lifecycle flows remain globally shared
- several older docs are now historical and must not be treated as current truth without code verification

## Immediate guardrails

Do not start by rewriting source architecture.
Do not convert the runtime to ESM or a build pipeline as a first move.
Do not change `index.html` script order casually.
Do not touch persistence or month lifecycle without targeted regression checks.
Do not assume an audit finding is still live unless the current code confirms it.

## What is already fixed in live code

Compared with older audit notes, the current repo already reflects fixes for:

- broken local test script paths in `package.json`
- outdated absolute Playwright base path
- `todayISO()` UTC drift issue
- event duplicate time comparison bug
- dashboard mobile Bug 2 / Bug 3 fixes
- versioned service worker cache name compared with older `wpm-v1`

## What is still live risk

- classic script/global coupling
- doc drift
- CSP/CDN hardening gap
- service worker version not coupled to `APP_VERSION` or commit
- potential semantic mismatch in `rankSnapshot`

## If you need the next safe step

Take this order:

1. Restore dev dependencies without changing app code.
2. Run executable baseline checks.
3. Reconcile historical docs against current live code.
4. Only then propose or make scoped hardening changes.

## Suggested validation sequence

Use this before any functional edit:

1. `npm install`
2. `npm test`
3. `npx playwright test --reporter=list`
4. `git diff --stat`

If those pass, the repo has an executable baseline.
If they fail, document whether the failure is environmental, test drift, or code regression.

## Files that matter first

- `index.html`
- `src/core/config.js`
- `src/core/storage.js`
- `src/core/backup.js`
- `src/core/lifecycle.js`
- `src/features/crud.js`
- `src/ui/render-dashboard.js`
- `src/ui/events-core.js`
- `MODULE_MAP.md`
- `TECH_DEBT.md`

## Working rule

Treat continuity as the primary objective. The first useful contribution after this bootstrap is baseline validation and doc-source alignment, not structural ambition.
