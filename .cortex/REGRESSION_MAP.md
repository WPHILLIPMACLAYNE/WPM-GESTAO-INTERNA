# REGRESSION_MAP

## High-pressure zones

| Area | Why it regresses easily | Evidence | Guardrail |
|---|---|---|---|
| Script order / bootstrap | globals resolve by load order, not imports | `index.html`, `src/main.js`, `MODULE_MAP.md` | never reorder scripts without rerunning full baseline |
| Storage and schema | state shape, versioning, fallback, and migration all meet here | `src/core/config.js`, `src/core/schema.js`, `src/core/storage.js`, `src/core/backup.js` | snapshot before change; verify load/import/save/reset |
| Monthly lifecycle | period switching, closing, reset, archives, and seed policy converge here | `src/core/lifecycle.js`, `Docs/SEPARACAO_MAIN_LIFECYCLE_BACKUP.md` | test month switch, close month, reset month, archive continuity |
| CRUD rollback and collection sync | UI state, domain state, and persistence meet in one flow | `src/features/crud.js` | simulate persistence failure before changing handler flow |
| Dashboard mobile layout | already had real regressions and targeted fixes | `Docs/DIAGNOSTICO_MOBILE.md`, `styles.css`, recent commits | keep mobile visual checks in any dashboard change |
| Dashboard render complexity | render aggregation is broad and user-visible | `src/ui/render-dashboard.js`, `MODULE_MAP.md` | isolate changes; verify charts, summary cards, recados |
| Global UI event infra | one event layer fans out to multiple domains | `src/ui/events-core.js`, `Docs/SEPARACAO_EVENTOS_UI.md` | verify click, input, modal, tab, DnD, tooltip paths |
| Service worker / cache | stale assets can mimic regressions after deploy | `sw.js`, older audit notes | validate cache strategy against release ID before touching |
| Documentation | stale docs can drive wrong maintenance choices | `QWEN.md`, `Docs/DOCUMENTACAO.md`, `MODULE_MAP.md` | trust code first; date every doc-derived conclusion |
| Test tooling | false confidence if configs/scripts drift from repo reality | `package.json`, `vitest.config.js`, `playwright.config.js` | re-run tools after restoring dependencies |

## Specific regression checks to keep

Before touching runtime structure:

1. App boots without console errors.
2. `window.__APP_INTERNALS__` is present.
3. Month switch and reset still preserve intended data boundaries.
4. Backup export/import still restores a coherent store.
5. Dashboard mobile still renders summary cards and feedback chart correctly.
6. Pendências DnD still updates status correctly.
7. NPS notes autosave still behaves with the current debounce path.
8. Service worker still precaches the exact live asset set.

## Known pressure multipliers

- touching `src/core/config.js`
- touching `src/core/storage.js`
- touching `src/core/backup.js`
- touching `src/core/lifecycle.js`
- touching `src/ui/render-dashboard.js`
- touching `src/ui/events-core.js`
- touching `index.html`
- touching `sw.js`

## Safe default

Prefer small, reversible changes with immediate validation. In this repository, broad structural edits have a higher regression surface than feature-local changes.
