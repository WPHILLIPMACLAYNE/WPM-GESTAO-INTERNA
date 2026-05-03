# Inventário Reversa — Gestão interna de academias

Gerado em: 2026-05-02T17:05:27Z

## Resumo Executivo

O projeto é uma SPA browser-only em HTML/CSS/JavaScript ES2022, sem bundler no runtime. O `index.html` funciona como app shell e carrega scripts clássicos em ordem fixa. A persistência principal é IndexedDB com espelho/fallback em `localStorage`; há backend Supabase opcional via SDK CDN e migrations SQL em `supabase/migrations/`.

Confiança: 🟢 **CONFIRMADO** — evidenciado por `README.md`, `index.html`, `src/core/storage.js`, `src/core/supabase.js`, `package.json` e `supabase/config.toml`.

## Estrutura de Pastas

Diretórios principais identificados, excluindo `node_modules`, `.git`, `.reversa`, `_reversa_sdd`, `dist`, `build`, `coverage`, `__pycache__` e `.cache`:

- `.github/workflows` — CI GitHub Actions.
- `.cortex` — documentação operacional e continuidade do projeto.
- `Docs` — auditorias, runbooks, mapas e documentação do sistema.
- `Legacy` — versão monolítica anterior (`SISTEMA_FINALIZADO.html` e `app.js`).
- `Scripts` — scripts auxiliares de ambiente, responsividade e visual check.
- `adapters` — instruções para uso com agentes/CLIs.
- `icons` — ícones SVG do PWA.
- `src/core` — configuração, storage, schema, lifecycle, backup, Supabase, PWA e observabilidade.
- `src/domain` — seletores e derivações puras de estado.
- `src/features` — fluxos de negócio e operações de CRUD, CSV, formulários, NPS e diagnósticos.
- `src/ui` — renderização e eventos de UI por domínio.
- `src/utils` — helpers compartilhados.
- `supabase/migrations` — schema canônico, RPCs e guards de checkpoint.
- `tests/unit`, `tests/integration`, `tests/e2e`, `tests/helpers` — Vitest, Playwright e utilitários de teste.
- `test-results`, `playwright-report` — artefatos de execução visual/E2E, não módulos de domínio.

## Linguagens e Arquivos

Contagem por extensão:

| Extensão | Quantidade | Observação |
|---|---:|---|
| `.png` | 187 | snapshots e evidências visuais |
| `.md` | 70 | documentação operacional e técnica |
| `.js` | 63 | runtime principal, testes e scripts |
| `.json` | 7 | configs, manifest e metadados |
| `.sql` | 6 | Supabase migrations e seed |
| `.mjs` | 4 | scripts Node auxiliares |
| `.svg` | 3 | ícones PWA |
| `.html` | 3 | app shell, legado e relatório Playwright |
| `.yml` | 1 | GitHub Actions |
| `.yaml` | 1 | manifest de agente |
| `.txt` | 1 | relatório base |
| `.toml` | 1 | config Supabase |
| `.css` | 1 | stylesheet principal |

Linguagem primária: JavaScript.

## Tecnologias e Frameworks

- HTML5/CSS custom/JavaScript ES2022 modular por script clássico.
- PWA com `manifest.json`, `sw.js` e registro em `src/core/pwa.js`.
- IndexedDB + `localStorage` em `src/core/storage.js`.
- Supabase opcional em `src/core/supabase.js` e `supabase/migrations/`.
- Chart.js via CDN em `index.html`.
- DOMPurify via CDN em `index.html`.
- Sentry opcional via ambiente em `src/core/observability.js`.
- Vitest para testes unitários/integrados.
- Playwright para E2E, visual regression e smoke pós-deploy.
- GitHub Actions em `.github/workflows/ci.yml`.
- Vercel headers em `vercel.json`.

## Pontos de Entrada

Aplicação:

- `index.html` — app shell, CSP, CDNs, ordem de scripts, DOM principal.
- `src/core/env-bootstrap.js` — defaults de `window.__APP_ENV__` e carregamento local opcional de `env.js`.
- `src/main.js` — expõe `APP_INTERNALS` e inicializa a aplicação no `DOMContentLoaded`.
- `src/core/pwa.js` — registra Service Worker e eventos de online/offline.
- `sw.js` — Service Worker.

Configuração:

- `env.example.js` — contrato público de ambiente.
- `env.js` — ambiente local ignorado pelo Git; existe no workspace atual.
- `jsconfig.json` — `checkJs` para `src/**/*.js`.
- `vitest.config.js` — Vitest com `happy-dom` e coverage `v8`.
- `playwright.config.js` — servidor estático local na porta `4173`.
- `vercel.json` — headers de segurança para deploy.
- `supabase/config.toml` — stack local Supabase.

CI/CD:

- `.github/workflows/ci.yml` — unit tests, coverage, E2E, validação estrutural e responsividade.

Scripts npm:

- `npm run setup`
- `npm run build:env`
- `npm test`
- `npm run test:coverage`
- `npm run smoke:deploy`
- `npm run test:e2e`
- `npm run test:visual`
- `npm run test:all`

## Banco de Dados — Sinais Superficiais

Arquivos encontrados para análise posterior pelo Data Master:

- `supabase/migrations/20260422190000_backend_canonical_schema.sql`
- `supabase/migrations/20260422194000_backend_transaction_rpcs.sql`
- `supabase/migrations/20260422203000_bootstrap_initial_admin.sql`
- `supabase/migrations/20260422224500_fix_addon_sales_unique_index.sql`
- `supabase/migrations/20260423090000_sync_checkpoint_guard.sql`
- `supabase/seed.sql`

Persistência local:

- `src/core/storage.js` — IndexedDB, cache, fila serializada, fallback localStorage e broadcast.
- `src/core/schema.js` — normalização/sanitização/migração de store.
- `src/core/backup.js` — export/import/snapshot e restore.

## Cobertura de Testes

Frameworks:

- Vitest com `happy-dom` para `tests/unit/*.test.js` e `tests/integration/*.test.js`.
- Playwright Chromium para `tests/e2e/*.spec.js`.

Arquivos de teste detectados: 18.

Distribuição:

- Unitários: 11 arquivos.
- Integração: 1 arquivo.
- E2E/visual/smoke: 6 arquivos.

## Módulos Identificados

- `core` — bootstrap, configuração, persistência, schema, lifecycle, backup, Supabase, PWA e observabilidade.
- `domain` — seletores e cálculos derivados.
- `features` — CRUD, formulários, CSV, NPS e diagnósticos.
- `ui` — renderizadores e eventos por área do produto.
- `utils` — helpers compartilhados e utilitários de sanitização/formatação.
- `supabase` — migrations, seed e config local do backend opcional.
- `legacy` — artefatos monolíticos usados como referência histórica.
- `tests` — unidade, integração, E2E, visual regression e helpers.

## Observações de Risco Inicial

- 🟢 **CONFIRMADO**: A ordem de scripts em `index.html` é parte do contrato de runtime.
- 🟢 **CONFIRMADO**: `src/core/storage.js` centraliza persistência local e deve ser tratado como módulo crítico.
- 🟢 **CONFIRMADO**: Supabase é opcional; o app possui fallback local-first.
- 🟡 **INFERIDO**: `Legacy/` é referência histórica para reconstrução/validação, não runtime principal.
- 🟡 **INFERIDO**: `test-results` e `playwright-report` devem ser ignorados por agentes de domínio, salvo quando a tarefa envolver auditoria visual.
