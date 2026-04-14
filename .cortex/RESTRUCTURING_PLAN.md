# RESTRUCTURING_PLAN

## Principle

Preserve working behavior first.
Reduce ambiguity second.
Restructure only after the baseline is executable and documented.

## Phase 0 — CORTEX bootstrap

Status:
Completed in this repository.

Delivered:

- `.cortex/` operating layer
- architecture snapshot
- status snapshot
- regression map
- advisory backlog

No functional code changes were made in this phase.

## Phase 1 — Executable baseline lock

Goal:
Turn the current structural reading into a runnable baseline.

Actions:

1. Install dev dependencies.
2. Run unit/integration tests.
3. Run Playwright E2E.
4. Record actual results in `.cortex/CURRENT_STATUS.md`.

Exit criteria:

- executable pass/fail baseline is known
- blockers are classified as environment or code

## Phase 2 — Source-of-truth normalization

Goal:
Reduce confusion between current state and historical docs.

Actions:

1. Mark stale docs as historical or update them.
2. Keep `MODULE_MAP.md` aligned with `index.html`.
3. Capture canonical architecture language once.

Exit criteria:

- one coherent current-state narrative exists
- no critical doc still points maintainers to removed runtime files

## Phase 3 — Hardening inside the current architecture

Goal:
Lower regression risk without changing the runtime model.

Candidate targets:

1. service worker versioning strategy
2. security posture around CSP/CDN
3. NPS rank snapshot consistency
4. helper duplication mapping

Exit criteria:

- no change requires rethinking the whole app structure
- baseline remains green after each increment

## Phase 4 — Structural seam extraction

Goal:
Create clearer boundaries around the highest-centrality files.

Candidate targets:

1. `src/core/backup.js`
2. `src/core/lifecycle.js`
3. `src/ui/events-core.js`
4. `src/ui/render-dashboard.js`

Required method:

- one seam at a time
- preserve public runtime behavior
- revalidate after each extraction

## Phase 5 — Architecture modernization decision

Goal:
Decide whether the app should remain a classic-script SPA or move toward stronger module boundaries.

This phase should only begin after:

- executable baseline exists
- docs are aligned
- key regression surfaces are controlled

Current recommendation:
Do not start Phase 5 yet.

## Next safe step

Phase 1.
