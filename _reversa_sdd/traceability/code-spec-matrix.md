# Code/Spec Matrix

## Visao Geral

Esta matriz conecta os arquivos reais do projeto aos contratos executaveis gerados pelo Writer. A cobertura usa:

- 🟢 Coberto diretamente por SDD, OpenAPI ou user story.
- 🟡 Coberto parcialmente ou por contrato agregado.
- — Sem spec operacional propria; candidato a analise adicional se virar area de mudanca.

## Matriz Principal

| Arquivo | Spec correspondente | Cobertura |
|---------|---------------------|-----------|
| `index.html` | `sdd/app-shell.md`, `sdd/env-bootstrap.md`, `sdd/ui-render-events.md` | 🟢 |
| `manifest.webmanifest` | `sdd/service-worker-pwa.md` | 🟢 |
| `sw.js` | `sdd/service-worker-pwa.md` | 🟢 |
| `env.example.js` | `sdd/env-bootstrap.md`, `user-stories/fluxo-sincronizacao-supabase.md` | 🟢 |
| `env.js` | `sdd/env-bootstrap.md`, `sdd/supabase-adapter.md` | 🟢 |
| `src/main.js` | `sdd/app-shell.md`, `sdd/ui-render-events.md` | 🟢 |
| `src/types.js` | `sdd/schema-migrations.md`, `database/data-dictionary.md` | 🟡 |
| `src/core/config.js` | `sdd/config-global-state.md`, `sdd/env-bootstrap.md` | 🟢 |
| `src/core/env-bootstrap.js` | `sdd/env-bootstrap.md` | 🟢 |
| `src/core/storage.js` | `sdd/storage-adapter.md` | 🟢 |
| `src/core/schema.js` | `sdd/schema-migrations.md`, `sdd/storage-adapter.md` | 🟢 |
| `src/core/backup.js` | `sdd/backup-import.md`, `sdd/storage-adapter.md`, `user-stories/fluxo-fechamento-mensal.md` | 🟢 |
| `src/core/lifecycle.js` | `sdd/monthly-lifecycle.md`, `user-stories/fluxo-fechamento-mensal.md` | 🟢 |
| `src/core/period-builder.js` | `sdd/schema-migrations.md`, `sdd/monthly-lifecycle.md` | 🟢 |
| `src/core/seed.js` | `sdd/schema-migrations.md`, `sdd/domain-selectors.md` | 🟡 |
| `src/core/supabase.js` | `sdd/supabase-adapter.md`, `sdd/supabase-database-rpcs.md`, `user-stories/fluxo-sincronizacao-supabase.md` | 🟢 |
| `src/core/pwa.js` | `sdd/service-worker-pwa.md` | 🟢 |
| `src/core/observability.js` | `sdd/config-global-state.md`, `sdd/supabase-adapter.md` | 🟡 |
| `src/domain/selectors.js` | `sdd/domain-selectors.md`, `user-stories/fluxo-atendimento-addons.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/features/forms.js` | `sdd/features-business-actions.md`, `user-stories/fluxo-atendimento-addons.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/features/crud.js` | `sdd/features-business-actions.md`, `user-stories/fluxo-atendimento-addons.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/features/nps.js` | `sdd/features-business-actions.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/features/csv.js` | `sdd/features-business-actions.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/features/diagnostics.js` | `sdd/features-business-actions.md`, `sdd/supabase-adapter.md`, `user-stories/fluxo-sincronizacao-supabase.md` | 🟢 |
| `src/ui/render-core.js` | `sdd/ui-render-events.md`, `sdd/app-shell.md` | 🟢 |
| `src/ui/events-core.js` | `sdd/ui-render-events.md`, `sdd/supabase-adapter.md`, `user-stories/fluxo-sincronizacao-supabase.md` | 🟢 |
| `src/ui/events-students.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-atendimento-addons.md` | 🟢 |
| `src/ui/events-addons.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-atendimento-addons.md` | 🟢 |
| `src/ui/events-pending.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/events-nps.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/events-scale.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/render-dashboard.js` | `sdd/ui-render-events.md`, `sdd/domain-selectors.md` | 🟢 |
| `src/ui/render-students.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-atendimento-addons.md` | 🟢 |
| `src/ui/render-addons.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-atendimento-addons.md` | 🟢 |
| `src/ui/render-pending.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/render-nps.js` | `sdd/ui-render-events.md`, `sdd/domain-selectors.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/render-scale.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/render-events.js` | `sdd/ui-render-events.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `src/ui/render-settings.js` | `sdd/ui-render-events.md`, `sdd/supabase-adapter.md`, `sdd/backup-import.md` | 🟢 |
| `src/ui/back-to-top.js` | `sdd/ui-render-events.md` | 🟡 |
| `src/utils/helpers.js` | `sdd/config-global-state.md`, `sdd/domain-selectors.md`, `sdd/monthly-lifecycle.md` | 🟢 |

## Supabase

| Arquivo | Spec correspondente | Cobertura |
|---------|---------------------|-----------|
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | `sdd/supabase-database-rpcs.md`, `openapi/supabase-rpcs.yaml`, `database/data-dictionary.md` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `sdd/supabase-database-rpcs.md`, `openapi/supabase-rpcs.yaml` | 🟢 |
| `supabase/migrations/20260422203000_bootstrap_initial_admin.sql` | `sdd/supabase-database-rpcs.md`, `openapi/supabase-rpcs.yaml` | 🟢 |
| `supabase/migrations/20260422224500_fix_addon_sales_unique_index.sql` | `sdd/supabase-database-rpcs.md`, `database/business-rules.md` | 🟢 |
| `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` | `sdd/supabase-database-rpcs.md`, `sdd/supabase-adapter.md`, `user-stories/fluxo-sincronizacao-supabase.md` | 🟢 |
| `supabase/seed.sql` | `sdd/supabase-database-rpcs.md` | 🟡 |
| `supabase/config.toml` | `sdd/supabase-database-rpcs.md` | 🟡 |
| `supabase/.branches/_current_branch` | — | — |
| `supabase/.temp/cli-latest` | — | — |

## Testes e Verificacao

| Arquivo | Spec correspondente | Cobertura |
|---------|---------------------|-----------|
| `tests/e2e/workflows.spec.js` | Todas as user stories, `sdd/backup-import.md`, `sdd/monthly-lifecycle.md` | 🟢 |
| `tests/e2e/app.spec.js` | `sdd/app-shell.md`, `sdd/ui-render-events.md`, `sdd/service-worker-pwa.md` | 🟢 |
| `tests/e2e/service-worker.spec.js` | `sdd/service-worker-pwa.md` | 🟢 |
| `tests/e2e/post-deploy-smoke.spec.js` | `sdd/app-shell.md`, `sdd/service-worker-pwa.md` | 🟡 |
| `tests/e2e/visual.spec.js` | `sdd/ui-render-events.md` | 🟡 |
| `tests/e2e/visual-states.spec.js` | `sdd/ui-render-events.md`, user stories operacionais | 🟢 |
| `tests/helpers/load-real-app.js` | `sdd/app-shell.md` | 🟡 |
| `tests/helpers/fixed-browser-clock.js` | `sdd/config-global-state.md`, `sdd/ui-render-events.md` | 🟡 |
| `tests/helpers/pure-functions.js` | `sdd/domain-selectors.md`, `sdd/monthly-lifecycle.md` | 🟢 |
| `tests/integration/flows.test.js` | `sdd/domain-selectors.md`, `sdd/monthly-lifecycle.md`, user stories operacionais | 🟢 |
| `tests/unit/date-helpers.test.js` | `sdd/config-global-state.md`, `sdd/monthly-lifecycle.md` | 🟢 |
| `tests/unit/esc.test.js` | `sdd/ui-render-events.md` | 🟢 |
| `tests/unit/format.test.js` | `sdd/config-global-state.md`, `sdd/ui-render-events.md` | 🟡 |
| `tests/unit/nps.test.js` | `sdd/domain-selectors.md`, `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 🟢 |
| `tests/unit/period-metrics.test.js` | `sdd/monthly-lifecycle.md`, `sdd/domain-selectors.md` | 🟢 |
| `tests/unit/runtime-env.test.js` | `sdd/env-bootstrap.md`, `sdd/supabase-adapter.md`, `user-stories/fluxo-sincronizacao-supabase.md` | 🟢 |
| `tests/unit/security-config.test.js` | `sdd/env-bootstrap.md`, `sdd/service-worker-pwa.md`, `sdd/supabase-adapter.md` | 🟢 |
| `tests/unit/selectors-real.test.js` | `sdd/domain-selectors.md`, `sdd/schema-migrations.md` | 🟢 |
| `tests/unit/service-worker-config.test.js` | `sdd/service-worker-pwa.md` | 🟢 |
| `tests/unit/validation.test.js` | `sdd/features-business-actions.md`, user stories operacionais | 🟢 |
| `tests/unit/xss-entities.test.js` | `sdd/ui-render-events.md`, `sdd/features-business-actions.md` | 🟢 |
| `tests/e2e/*-snapshots/*.png` | `sdd/ui-render-events.md` | 🟡 |

## Artefatos Legados e Operacionais

| Arquivo | Spec correspondente | Cobertura |
|---------|---------------------|-----------|
| `Legacy/**` | `flowcharts/legacy.md`, `flowcharts/legacy-importPayload.md`, `flowcharts/legacy-loadStore.md` | 🟡 |
| `Docs/**` | — | — |
| `Scripts/**` | — | — |
| `package.json` | `dependencies.md`, `sdd/app-shell.md`, `sdd/service-worker-pwa.md` | 🟡 |
| `package-lock.json` | `dependencies.md` | 🟡 |
| `playwright.config.*` | `sdd/ui-render-events.md` | 🟡 |
| `vitest.config.*` | `sdd/features-business-actions.md`, `sdd/domain-selectors.md` | 🟡 |
| `.github/workflows/**` | `deployment.md` | 🟡 |

## Lacunas e Candidatos a Analise Adicional

| Area | Motivo | Prioridade |
|------|--------|------------|
| `src/core/observability.js` | Cobertura existe por contrato agregado, mas nao ha SDD proprio de observabilidade/eventos. | Media |
| `src/ui/back-to-top.js` | Comportamento pequeno coberto por UI geral, sem contrato dedicado. | Baixa |
| `Docs/**` | Documentacao operacional fora do runtime, nao coberta como especificacao executavel. | Baixa |
| `Scripts/**` | Scripts auxiliares nao foram alvo direto do Writer. | Media se usados em release |
| `supabase/.branches/**` e `.temp/**` | Estado local da CLI, sem relevancia funcional para reimplementacao. | Baixa |
| Snapshots PNG | Evidenciam estados visuais, mas nao substituem contrato textual. | Baixa |

## Cobertura Estimada

| Categoria | Cobertura |
|-----------|-----------|
| Runtime `src/core` | 🟢 Alta |
| Runtime `src/domain` | 🟢 Alta |
| Runtime `src/features` | 🟢 Alta |
| Runtime `src/ui` | 🟢 Alta |
| Supabase SQL/RPC | 🟢 Alta |
| Testes de comportamento | 🟢 Alta |
| Testes visuais/snapshots | 🟡 Media |
| Scripts/docs auxiliares | 🟡 Parcial |

Estimativa geral: **aprox. 90% de cobertura executavel para o runtime principal e banco remoto**, com lacunas concentradas em scripts auxiliares, documentacao operacional externa e microcomportamentos visuais.
