# QUICK_REFERENCE

## Identity

- App: `WPM Gestão Interna`
- Current app version: `v34`
- Store version: `4`
- Main runtime entry: `index.html`
- Main bootstrap: `src/main.js`
- Main architecture map: `MODULE_MAP.md`

## Critical files

- Runtime contract: `index.html`
- Global config/state: `src/core/config.js`
- Storage layer: `src/core/storage.js`
- Backup/import/export: `src/core/backup.js`
- Period lifecycle: `src/core/lifecycle.js`
- Domain selectors: `src/domain/selectors.js`
- CRUD handlers: `src/features/crud.js`
- Dashboard render: `src/ui/render-dashboard.js`
- Global UI/event infra: `src/ui/events-core.js`
- PWA/cache: `sw.js`

## Runtime order contract

Do not reorder scripts in `index.html` without proving every dependent global still resolves in time.

High-risk late modules:

- `src/core/backup.js`
- `src/core/lifecycle.js`
- `src/main.js`

## Storage reference

- IndexedDB DB: `wpm-gestao-interna-db`
- Object store: `app_kv`
- Main local key: `recepcao-smartfit-dashboard-v34`
- Broadcast key: `recepcao-smartfit-dashboard-sync-v34`
- UI key: `controle_recepcao_app_ui_v34`

## Test surface present in repo

- Unit: `tests/unit/*.test.js`
- Integration: `tests/integration/*.test.js`
- E2E: `tests/e2e/*.spec.js`
- Visual snapshots: `tests/e2e/*snapshots`

## Current execution blocker

In this workspace, test commands are currently blocked by missing dev dependencies:

- `vitest` not installed
- `@playwright/test` not installed

## High-value context docs

- `MODULE_MAP.md`
- `MIGRATION_STATUS.md`
- `TECH_DEBT.md`
- `Docs/AUDITORIA_COMPLETA.md`
- `Docs/BUGS_CONHECIDOS.md`
- `Docs/DIAGNOSTICO_MOBILE.md`
- `Docs/MAPA_ENTIDADES.md`
- `Docs/PROXIMOS_PASSOS.md`

## Known doc drift

Treat these as historical unless reconfirmed in code:

- `QWEN.md`
- `Docs/DOCUMENTACAO.md`
- `Docs/AUDITORIA_2604.md`

## First safe commands

```bash
git status --short
git log --oneline --decorate -5
npm install
npm test
npx playwright test --reporter=list
```
