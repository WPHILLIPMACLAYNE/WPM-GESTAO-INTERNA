# OPERATOR_PROFILE

## Scope of this profile

This is an evidence-based operating profile of the project and its likely maintainership style, derived from repository artifacts only. It is not a personality profile.

## Product operation profile

Observed from `index.html`, `Docs/DOCUMENTACAO.md`, `Docs/MAPA_ENTIDADES.md`, and the current UI structure:

- single-unit internal operations focus
- month-based operating cadence
- reception-heavy workflow with manager/admin oversight
- roles already contemplated in docs: `admin`, `gestor`, `recepcao`, `professor`, `leitura`
- local-first/offline-capable usage model
- strong need for continuity during real operational use

## Engineering profile

Observed from commit history, audits, and file layout:

- documentation-heavy maintenance style
- audit-first and regression-aware habits
- incremental modularization instead of full rewrites
- preference for preserving behavior while extracting structure
- reliance on browser-native runtime over build tooling

## What maintainers appear to value

Evidence suggests priority on:

- preserving current functionality
- traceable changes
- month-bound data integrity
- recoverability through backup/import/export
- visual stability of the dashboard
- practical diagnostics available inside the app

## Current operating constraints

- shared globals are still the runtime interface
- script order is part of the architecture
- old and new docs coexist
- visual and behavioral regressions have already happened in mobile dashboard flows
- environment setup is required before tests can be trusted in a fresh workspace

## Best collaboration mode for this repo

Recommended mode for future agents:

- advisory-first
- evidence-first
- branch-safe
- small-step
- validation-led

Avoid:

- speculative architecture rewrites
- broad source reordering
- persistence or lifecycle edits without rollback validation
- treating old docs as current without code confirmation
