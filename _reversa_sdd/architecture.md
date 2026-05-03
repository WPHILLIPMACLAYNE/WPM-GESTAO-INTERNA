# Architect — Visao Arquitetural

Gerado em: 2026-05-02T17:46:12Z

## Sumario Executivo

O WPM Gestao Interna e uma SPA browser-only para operacao mensal de recepcao de academias. O runtime principal e estatico: `index.html` carrega CSS, CDNs e scripts JavaScript classicos em ordem fixa, sem bundler. O estado do produto vive em um `AppStore` local-first, persistido em IndexedDB com fallback/espelho localStorage, e pode ser sincronizado opcionalmente com Supabase por SDK browser e RPCs transacionais.

Confianca: CONFIRMADO por `index.html`, `README.md`, `src/core/storage.js`, `src/core/supabase.js`, `supabase/migrations/*`, `package.json` e artefatos Reversa anteriores.

## Drivers Arquiteturais

| Driver | Decisao arquitetural |
|---|---|
| Operacao continua sem backend | Local-first com IndexedDB/localStorage e fallback quando Supabase esta ausente. |
| Publicacao estatica | SPA sem bundler, adequada para GitHub Pages/Vercel. |
| Mes operacional fechado | `storage.archives` bloqueia edicao e gera arquivo de fechamento. |
| Multiusuario remoto | Supabase com unidades, membros, RLS e roles. |
| Evitar overwrite remoto | Sync guardada por checkpoint e lock transacional por unidade. |
| UX operacional mobile | UI modular por dominios e testes visuais/responsivos. |
| Hardening web | CSP, remocao de scripts inline, PWA cache versionado e smoke de deploy. |

## Containers

| Container | Tecnologia | Responsabilidade | Criticidade |
|---|---|---|---|
| App Shell | `index.html`, `styles.css`, scripts classicos | Carregar UI, CDNs, CSP e ordem de modulos. | Alta |
| Core SPA | `src/core/*`, `src/main.js` | Bootstrap, store, schema, lifecycle, backup, Supabase, PWA, observabilidade. | Alta |
| Domain/Features/UI | `src/domain`, `src/features`, `src/ui` | Regras derivadas, mutacoes de negocio e render/eventos. | Alta |
| Persistencia Local | IndexedDB, localStorage, cache em memoria | Store local-first, fallback e broadcast cross-tab. | Alta |
| Backend Supabase | Auth, Postgres, RLS, RPCs | Sincronizacao remota opcional e modelo relacional canonico. | Alta quando habilitado |
| Service Worker | `sw.js` | Cache app shell/assets e controle offline/update. | Media/Alta |
| Test/CI | Vitest, Playwright, GitHub Actions | Unitarios, e2e, visual, coverage e smoke. | Alta para release |

## Componentes Principais

| Componente | Arquivos | Responsabilidade |
|---|---|---|
| Env Bootstrap | `src/core/env-bootstrap.js` | Defaults de `window.__APP_ENV__` e carregamento local de `env.js`. |
| Config/Estado Global | `src/core/config.js` | Constantes, chaves, defaults, estado global e helpers DOM. |
| Storage | `src/core/storage.js` | IndexedDB/localStorage/cache/fila/broadcast. |
| Schema | `src/core/schema.js` | Sanitizacao, migracao e normalizacao do store. |
| Backup | `src/core/backup.js` | Export/import, snapshot, restore e preparo de candidatos. |
| Lifecycle | `src/core/lifecycle.js` | Periodos, fechamento, reset, lock e troca de mes. |
| Supabase Adapter | `src/core/supabase.js` | Auth, memberships, mapeamento remoto-local, sync guardada. |
| Selectors | `src/domain/selectors.js` | KPIs, rankings, filtros e historico memoizado. |
| Features | `src/features/*.js` | Validacoes, CRUD, CSV, NPS e diagnosticos. |
| UI Render/Eventos | `src/ui/*.js` | Renderizacao por dominio e handlers acessiveis. |
| Utils | `src/utils/helpers.js` | Sanitizacao, datas, CSV, ordenacao, helpers NPS/eventos. |

## Integracoes Externas

| Integracao | Protocolo/Formato | Direcao | Observacao |
|---|---|---|---|
| Supabase JS CDN | HTTPS/JS CDN | browser -> CDN | SDK opcional para Auth/PostgREST/RPC. |
| Supabase Auth | HTTPS | browser -> Supabase | Login por senha, sessao persistida. |
| Supabase PostgREST | HTTPS/JSON | browser -> Supabase | Leitura de tabelas por periodo. |
| Supabase RPC | HTTPS/JSON | browser -> Supabase | Import, fechamento, reset e checkpoint guardado. |
| Chart.js CDN | HTTPS/JS CDN | browser -> CDN | Graficos de dashboard. |
| DOMPurify CDN | HTTPS/JS CDN | browser -> CDN | Sanitizacao HTML defensiva. |
| Sentry opcional | HTTPS | browser -> Sentry | Observabilidade condicional por ambiente. |
| GitHub Actions | YAML/CI | repo -> CI | Testes, coverage, e2e e validacoes. |

## Dados

O modelo local `AppStore` agrega periodos por `YYYY-MM`; cada periodo contem settings, alunos, pendencias, recados, NPS, escala, eventos e matriz de addons. O modelo remoto Supabase normaliza esse documento em 16 tabelas publicas principais com FKs, RLS, triggers `updated_at`, RPCs transacionais e auditoria.

O ERD completo esta em `_reversa_sdd/erd-complete.md`.

## Dividas Tecnicas e Riscos

| Risco | Evidencia | Severidade |
|---|---|---|
| Ordem de scripts e globais sao contrato de runtime. | SPA sem bundler/import runtime. | Alta |
| `normalizeData()` concentra migracao e normalizacao de varias entidades. | `code-analysis.md`. | Media/Alta |
| Checkpoint remoto nao e hash completo do conteudo. | `sync_checkpoint_guard.sql`. | Media |
| Supabase CDN esta sem SRI no estado documentado. | `dependencies.md`. | Media |
| Leitura individual de recados nao esta claramente modelada no backend. | `domain.md` e `code-analysis.md`. | Media |
| Retencao de backups/snapshots locais nao aparece formalizada. | `code-analysis.md`. | Media |
| Arquitetura por globais exige cuidado em refactors. | `index.html` + scripts classicos. | Alta |

## Decisoes Relacionadas

- ADR 001: persistencia local-first no navegador.
- ADR 002: periodo mensal com fechamento e bloqueio.
- ADR 003: Supabase com RBAC e sync guardada por checkpoint.
- ADR 004: PWA, CSP forte e observabilidade de release.
