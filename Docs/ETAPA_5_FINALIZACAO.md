# Etapa 5 — Finalização e Correção de Integração

**Data:** 5 de abril de 2026
**Projeto:** WPM Gestão Interna — SPA single-file, browser-only, script tags
**Arquitetura:** SPA de arquivo único com `<script>` tags sequenciais (sem ES modules, sem build step)

---

## Resumo

A Etapa 5 transformou um single-file monolítico de **~6829 linhas de JavaScript inline** em uma estrutura modular de **13 arquivos** organizados em 5 diretórios, mantendo a arquitetura de script tags sequenciais e **131/131 testes passando**.

### Números finais

| Métrica | Antes | Depois |
|---|---|---|
| JavaScript em módulos `src/` | 0 (inline) | 5571 linhas |
| `src/ui/render.js` | ~3546 | 3130 (-11.7%) |
| `src/main.js` | ~6829 inline | 1035 |
| `src/ui/events.js` | — | 569 |
| `src/features/` (5 módulos) | — | 741 |
| Arquivos JS no projeto | 1 (app.js backup) | 13 |
| Testes | 131/131 | **131/131** ✅ |

---

## Módulos extraídos

### Core (3 arquivos)

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `src/core/config.js` | 96 | Constantes, `DOM` helper, estado global (`state`, `storage`, `currentPeriodKey`, editing IDs) |
| `src/core/schema.js` | 135 | Migração de store, sanitização, validação |
| `src/core/storage.js` | 726 | IndexedDB, localStorage, cache, broadcast, persistência |

### Domain (1 arquivo)

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `src/domain/selectors.js` | 359 | Selectors memoizados com `cacheSelectores` |

### Features (5 módulos)

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `src/features/forms.js` | 312 | Form data getters, entity builders, validation, validação UI |
| `src/features/crud.js` | 182 | `createCrudHandler` (factory genérica com getters de collection), 3 handlers, student-addon link, aliases |
| `src/features/csv.js` | 65 | Exportação CSV (escape, build, download, row builders) |
| `src/features/nps.js` | 76 | CRUD de menções NPS + observações |
| `src/features/diagnostics.js` | 111 | Smoke tests de fluxo (backup, CSV, reset) |

### Utils (1 arquivo)

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `src/utils/helpers.js` | 236 | Funções puras: format, text, date, clamp, esc, etc. |

### UI (2 arquivos)

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `src/ui/events.js` | 569 | Delegação de eventos, DnD, tooltips, acessibilidade, atalhos |
| `src/ui/render.js` | 3130 | Render scheduler, patch DOM, todos os `render*`, recados, import/export, diagnostics |

### Bootstrap

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `src/main.js` | 1035 | Persistence, UI feedback, period lifecycle, `APP_INTERNALS`, `initializeApp` |

---

## Correções de integração final

Durante a extração, foram identificadas e corrigidas **9 falhas de integração** que impediam o app de abrir:

| # | Problema | Arquivo corrigido |
|---|---|---|
| 1 | `crud.js` carregado antes de `render.js` (dependia de funções de render) | `index.html` — reordenar scripts |
| 2 | `state`, `storage`, `currentPeriodKey` declarados em `main.js` (carregado por último) | `src/core/config.js` — mover para primeiro módulo |
| 3 | `DOM` helper nunca foi extraído (só existia no `app.js` original) | `src/core/config.js` — adicionar |
| 4 | Editing IDs (`editingStudentId`, etc.) inacessíveis a `forms.js`/`render.js` | `src/core/config.js` — mover declarações |
| 5 | `renderAll()` sem corpo (função cortada no final do arquivo) | `src/ui/render.js` — completar |
| 6 | `obterElementosFocaveis()`, `sincronizarLabelsComCampos()`, `atualizarRovingPendencias()` incompletas | `src/ui/events.js` — completar |
| 7 | Bloco corrompido em `main.js` com fragmentos de código misturado | `src/main.js` — reconstruir seção |
| 8 | `renamePerson` sem `async` (usava `await saveData()`) | `src/ui/render.js` — adicionar async |
| 9 | `collection: state.students` executado no topo de `crud.js` (`state` era undefined) | `src/features/crud.js` — trocar por getters |

### A correção crítica (item 9)

O erro de runtime `Cannot read properties of undefined (reading 'students')` acontecia porque os 3 handlers CRUD acessavam `state.students`, `state.pending`, `state.events` **no momento do carregamento do script**, antes de `state` ser populado por `syncAppState()`.

**Solução:** Trocar `collection: state.students` por `get collection() { return state.students; }` — adiando a resolução até o momento de uso real (pós-inicialização). A factory `createCrudHandler` foi ajustada para acessar `config.collection` via getter em vez de desestruturação estática.

---

## Ordem de carregamento final

```html
1. dompurify (CDN)
2. src/utils/helpers.js
3. src/core/config.js       ← state, storage, currentPeriodKey, editing IDs, DOM
4. src/core/schema.js
5. src/core/storage.js
6. src/domain/selectors.js
7. src/features/forms.js
8. src/features/nps.js
9. src/features/csv.js
10. src/features/diagnostics.js
11. src/ui/render.js         ← render scheduler, render*, patch DOM
12. src/features/crud.js     ← handlers CRUD (resolve collections via getter)
13. src/ui/events.js         ← event delegation (chama funções dos módulos acima)
14. src/main.js              ← persistence, period lifecycle, initializeApp, APP_INTERNALS
```

---

## Estado atual dos testes

- **Vitest:** 112/112 ✅
- **Playwright:** 19/19 ✅
- **Total:** 131/131 ✅
- **Erros JS no navegador:** 0

---

## Veredito

**Etapa 5: ENCERRADA ✅**

O `index.html` via `http://localhost:8000/` está operacional de ponta a ponta:
- App inicializa sem erros
- Todas as abas navegam (dashboard, students, pending, nps, scale, events, settings)
- Modais abrem e fecham
- Estado global acessível por todos os módulos
- `window.__APP_INTERNALS__` disponível para debug
