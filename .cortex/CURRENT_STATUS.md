# CURRENT_STATUS

Snapshot date: 2026-04-14

## Repository state at bootstrap

- Branch: `agent/cortex-bootstrap-initial-audit`
- HEAD: `a21f6e45effbf58ec16c6824b2d36e766e485d95`
- Recent tag on HEAD: `v1.0-stable`
- Pre-bootstrap worktree state: clean

Recent visible progression from `git log --oneline -5`:

1. `a21f6e4` `test: atualiza snapshots mobile do dashboard pós-fix Bug 2 e Bug 3`
2. `e88daab` `fix: corrige cards mobile e gráfico cortado no Dashboard`
3. `a6e167b` `docs: diagnóstico mobile Bug 2 e Bug 3`
4. `87d85c7` `fix: correções pós-auditoria — SW, testes, bug lógico e resíduos`
5. `992ca8f` `docs: auditoria completa pós-estabilização`

## Current baseline reading

The codebase appears functionally mature and structurally fragile.

Evidence-backed positives:

- runtime split is already in place across `src/core`, `src/domain`, `src/features`, `src/ui`, `src/utils`
- mobile dashboard fixes documented in `Docs/DIAGNOSTICO_MOBILE.md` are reflected in current code and recent commits
- previously documented infra issues in scripts/config are already corrected in current files
- `APP_INTERNALS` exposure, backup flows, diagnostics, lifecycle, and service worker are all present in the codebase
- test assets and snapshots are present for unit, integration, E2E, and visual coverage

Evidence-backed constraints:

- runtime still depends on classic script ordering
- globals remain the main module interface
- docs are partially out of sync with the codebase
- executable validation is blocked in this workspace because dev dependencies are not installed

## Validation attempted during bootstrap

Attempted commands:

- `npm test`
- `npx playwright test --reporter=list`

Observed results:

- `npm test` failed with `sh: 1: vitest: not found`
- `npx playwright test --reporter=list` failed with `Cannot find package '@playwright/test'`

Meaning:

- the repository contains test definitions and configs
- this workspace does not currently contain the installed dev toolchain needed to execute them
- no new functional conclusion should be drawn from the failed commands beyond missing dependencies

## Documentation state

Current docs are valuable but not uniform. The repo now contains:

- historical migration narrative
- audit snapshots at different moments
- debt and bug registers
- architecture maps
- stage-by-stage split notes

Current source-of-truth priority for structure:

1. live code in `index.html`, `src/`, `sw.js`, configs
2. `MODULE_MAP.md`
3. recent git history
4. debt/audit docs
5. older general docs such as `QWEN.md` and `Docs/DOCUMENTACAO.md`

## Stable baseline to preserve

Preserve these before any structural or functional work:

- `APP_VERSION = v34`
- `STORE_VERSION = 4`
- current 30-script runtime order from `index.html`
- local-first persistence model
- exposed `window.__APP_INTERNALS__`
- current mobile dashboard fixes
- corrected local test script paths and Playwright server config

## Main unresolved pressures

- script-order coupling
- shared mutable globals
- storage/schema/lifecycle centrality
- doc drift between older audits and current code
- service worker/versioning still not tied to app version or commit hash
- security posture still includes CSP `unsafe-inline` and CDN dependencies
- seed `rankSnapshot` shape still appears inconsistent with `src/types.js`

## Confidence level

Moderate to high for structural state.

Lower for runtime pass/fail in this exact workspace because automated execution is currently blocked by missing dependencies.
