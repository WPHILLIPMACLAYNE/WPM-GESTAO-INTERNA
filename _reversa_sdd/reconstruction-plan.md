# Reconstruction Plan — Gestao interna de academias

**Stack:** Vanilla JavaScript SPA browser-only, IndexedDB/localStorage, Supabase opcional, PWA/service worker, Vitest e Playwright.
**Gerado em:** 2026-05-02T19:05:35Z
**Status:** 18 tarefas | 18 concluidas | 0 pendentes

---

## Alertas de pre-voo

> Revise estes pontos antes de iniciar. Alertas criticos bloqueiam ou ampliam a tarefa associada.

- RESOLVIDO NA TAREFA 10 **Reabertura de mes fechado foi adicionada como comando operacional com autorizacao e motivo obrigatorios no modulo reconstruido.**
- RESOLVIDO NA TAREFA 09 **Backups/imports combinam confirmacao manual, preview granular e integridade por hash/identidade no modulo reconstruido.**
- RESOLVIDO NA TAREFA 11 **Importacao completa remota preserva preview granular e guardas de checkpoint/integridade no contrato reconstruido.**

---

## Tarefas

### Tarefa 01 — Schema do Banco de Dados
**Status:** done
**Le:** `_reversa_sdd/erd-complete.md`, `_reversa_sdd/data-dictionary.md`, `_reversa_sdd/database/data-dictionary.md`, `_reversa_sdd/database/relationships.md`
**Constroi:** migrations Supabase, schema remoto, tipos e contratos de persistencia canonica.
**Pronto quando:** Todas as tabelas do ERD existem com tipos, constraints, foreign keys, indices e relacoes corretas.
**Resultado:** `supabase/reconstruction/001_canonical_schema.sql`

---

### Tarefa 02 — Entidades de Dominio
**Status:** done
**Le:** `_reversa_sdd/domain.md`, `_reversa_sdd/data-dictionary.md`
**Constroi:** entidades, value objects, validacoes de dominio e contratos do `AppStore`.
**Pronto quando:** Todas as entidades do dominio estao representadas com campos, defaults e regras operacionais descritas.
**Resultado:** `src/reconstruction/domain-entities.js`

---

### Tarefa 03 — Maquinas de Estado
**Status:** done
**Le:** `_reversa_sdd/state-machines.md`
**Constroi:** implementacao dos fluxos de estado de periodo, pendencia, evento, feedback, aviso NPS, escala, sync e fonte do store.
**Pronto quando:** Todos os estados e transicoes documentados estao implementados ou cobertos por testes.
**Resultado:** `src/reconstruction/state-machines.js`

---

### Tarefa 04 — Env Bootstrap
**Status:** done
**Le:** `_reversa_sdd/sdd/env-bootstrap.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/env-bootstrap.js`, `env.example.js`, contrato de `window.__APP_ENV__`.
**Pronto quando:** Defaults de ambiente e carregamento local/externo funcionam antes do restante do app.
**Resultado:** `src/reconstruction/env-bootstrap.js`, `env.reconstruction.example.js`

---

### Tarefa 05 — Config/Estado Global
**Status:** done
**Le:** `_reversa_sdd/sdd/config-global-state.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/config.js`, constantes, estado global, chaves de storage e helpers DOM.
**Pronto quando:** Constantes, store global e defaults seed/demo batem com a spec, sem tratar `APP_DEFAULTS` como dado real de producao.
**Resultado:** `src/reconstruction/config-global-state.js`

---

### Tarefa 06 — Storage Adapter
**Status:** done
**Le:** `_reversa_sdd/sdd/storage-adapter.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/storage.js`, IndexedDB, localStorage, cache em memoria, fila e broadcast cross-tab.
**Pronto quando:** Leitura, escrita, fallback, cache e notificacoes de storage funcionam conforme contrato local-first.
**Resultado:** `src/reconstruction/storage-adapter.js`

---

### Tarefa 07 — Schema/Migrations
**Status:** done
**Le:** `_reversa_sdd/sdd/schema-migrations.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/schema.js`, `src/core/period-builder.js`, normalizacao e migracoes do store.
**Pronto quando:** Stores antigos sao normalizados, V4 e tratado como bump/marco sem mudanca incompatível, e dados invalidos sao saneados.
**Resultado:** `src/reconstruction/schema-migrations.js`, `src/reconstruction/period-builder.js`, `src/reconstruction/lifecycle-normalization.js`

---

### Tarefa 08 — Domain Selectors
**Status:** done
**Le:** `_reversa_sdd/sdd/domain-selectors.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/domain/selectors.js`, KPIs, rankings, filtros e historico memoizado.
**Pronto quando:** Selectors retornam resultados consistentes para dashboard, NPS, rankings e periodos.
**Resultado:** `src/reconstruction/domain-selectors.js`

---

### Tarefa 09 — Backup/Import
**Status:** done
**Le:** `_reversa_sdd/sdd/backup-import.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/backup.js`, export/import, snapshot, restore, preparo de candidatos e guardas de importacao.
**Pronto quando:** Backups manuais e importacoes respeitam confirmacao, preview granular antes de substituicao/remocao e validacao de integridade/autenticidade.
**Resultado:** `src/reconstruction/backup-import.js`
**Resolucao do alerta:** O modulo reconstruido exige preview granular aceito e hash/identidade confiavel antes de aplicar backup completo destrutivo.

---

### Tarefa 10 — Monthly Lifecycle
**Status:** done
**Le:** `_reversa_sdd/sdd/monthly-lifecycle.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/lifecycle.js`, fechamento, reset, troca de mes, lock e reabertura de periodo.
**Pronto quando:** Fechamento mensal, bloqueio, arquivo de fechamento e reabertura autorizada de mes fechado funcionam conforme decisao humana.
**Resultado:** `src/reconstruction/monthly-lifecycle.js`
**Resolucao do alerta:** `reopenPeriod()` remove o archive somente com `authorized=true` e motivo informado, registrando auditoria da reabertura.

---

### Tarefa 11 — Supabase Database/RPCs
**Status:** done
**Le:** `_reversa_sdd/sdd/supabase-database-rpcs.md`, `_reversa_sdd/dependencies.md`
**Constroi:** migrations Supabase, RLS, triggers, RPCs transacionais, auditoria e checkpoint.
**Pronto quando:** RPCs transacionais e schema remoto refletem o modelo canonico e respeitam preview/guardas para importacao completa.
**Resultado:** `src/reconstruction/supabase-database-rpcs.js`, `tests/unit/reconstruction-supabase-database-rpcs.test.js`
**Resolucao do alerta:** `importBackupTransactionGuarded()` combina role, checkpoint, lock por unidade, preview aceito e integridade/autenticidade antes de substituir/remover periodos remotos.

---

### Tarefa 12 — Supabase Adapter
**Status:** done
**Le:** `_reversa_sdd/sdd/supabase-adapter.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/core/supabase.js`, auth, memberships, mapeamento local/remoto e sync guardada.
**Pronto quando:** Sync opcional funciona com checkpoint; conflito remoto exige recarregar do backend antes de sincronizar, sem merge manual nesta fase.
**Resultado:** `src/reconstruction/supabase-adapter.js`, `tests/unit/reconstruction-supabase-adapter.test.js`

---

### Tarefa 13 — Features Business Actions
**Status:** done
**Le:** `_reversa_sdd/sdd/features-business-actions.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/features/forms.js`, `crud.js`, `nps.js`, `csv.js`, `diagnostics.js`.
**Pronto quando:** Validacoes, CRUD, CSV, NPS e diagnosticos executam as regras de negocio sem quebrar persistencia.
**Resultado:** `src/reconstruction/features-business-actions.js`, `tests/unit/reconstruction-features-business-actions.test.js`

---

### Tarefa 14 — App Shell
**Status:** done
**Le:** `_reversa_sdd/sdd/app-shell.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `index.html`, `styles.css`, ordem dos scripts, CDNs, CSP e elementos DOM publicos.
**Pronto quando:** Shell estatico carrega todos os modulos na ordem correta e preserva o contrato DOM usado pela UI.
**Resultado:** `src/reconstruction/app-shell.js`, `tests/unit/reconstruction-app-shell.test.js`

---

### Tarefa 15 — Service Worker/PWA
**Status:** done
**Le:** `_reversa_sdd/sdd/service-worker-pwa.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `sw.js`, `manifest.webmanifest`, registro PWA e cache app-shell.
**Pronto quando:** App abre offline depois do primeiro carregamento online; offline frio permanece fora do escopo atual.
**Resultado:** `src/reconstruction/service-worker-pwa.js`, `tests/unit/reconstruction-service-worker-pwa.test.js`

---

### Tarefa 16 — UI Render/Eventos
**Status:** done
**Le:** `_reversa_sdd/sdd/ui-render-events.md`, `_reversa_sdd/dependencies.md`
**Constroi:** `src/ui/*.js`, renderizadores, handlers, dialogs, toasts e estados visuais.
**Pronto quando:** Views e eventos cobrem dashboard, alunos, addons, pendencias, NPS, escala, eventos, ajustes, backups e sync.
**Resultado:** `src/reconstruction/ui-render-events.js`, `tests/unit/reconstruction-ui-render-events.test.js`

---

### Tarefa 17 — Camada de API
**Status:** done
**Le:** `_reversa_sdd/openapi/supabase-rpcs.yaml`
**Constroi:** contratos RPC, clientes, parametros, respostas e erros da API Supabase.
**Pronto quando:** Todos os endpoints/RPCs respondem conforme contratos OpenAPI e erros esperados.
**Resultado:** `src/reconstruction/supabase-rpc-api.js`, `tests/unit/reconstruction-supabase-rpc-api.test.js`

---

### Tarefa 18 — Fluxos de Usuario
**Status:** done
**Le:** `_reversa_sdd/user-stories/fluxo-atendimento-addons.md`, `_reversa_sdd/user-stories/fluxo-fechamento-mensal.md`, `_reversa_sdd/user-stories/fluxo-sincronizacao-supabase.md`, `_reversa_sdd/user-stories/fluxo-pendencias-nps-escala-eventos.md`
**Constroi:** integracao end-to-end, fluxos completos de usuario e testes Playwright/Vitest relacionados.
**Pronto quando:** Todas as user stories passam com criterios de aceitacao e cobrem os fluxos operacionais principais.
**Resultado:** `src/reconstruction/user-flows.js`, `tests/unit/reconstruction-user-flows.test.js`
