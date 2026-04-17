# FASE 1 — Schema BD

Data: 2026-04-17  
Branch de trabalho: `backend/fase-1-schema`

## Objetivo

Tirar a modelagem do backend do estado puramente conceitual e transformar o mapa canônico de entidades em artefatos reais e versionados para Supabase/PostgreSQL.

## Entrega inicial desta fase

Foi criado o primeiro scaffold de banco em:

- `supabase/migrations/20260417132925_initial_schema.sql`

Esse arquivo inaugura a estrutura de backend com:

- tipos `enum` de domínio para roles, status e classificações operacionais
- tabelas principais do domínio
- chaves estrangeiras e índices iniciais
- gatilhos de `updated_at`
- políticas de RLS com separação entre leitura, operação e gestão

## Tabelas cobertas

- `units`
- `users`
- `unit_members`
- `periods`
- `period_settings`
- `addon_types`
- `student_attendances`
- `addon_sales`
- `pending_items`
- `shift_notes`
- `nps_period_metrics`
- `nps_mentions`
- `scale_days`
- `scale_professor_shifts`
- `events`
- `audit_events`

## Decisões desta primeira versão

- `users` referencia `auth.users`, preparando o caminho para a Fase 2 de autenticação.
- `unit_members` centraliza vínculo e role por unidade.
- A distinção de acesso ficou em três camadas:
  - acesso da unidade: pode ler
  - operação da unidade/período: pode trabalhar nos fluxos operacionais
  - gestão da unidade/período: pode alterar configurações sensíveis e exclusões
- Campos históricos preservam `snapshot` textual mesmo quando já existe FK futura para usuário ou tipo.

## Pontos que continuam deliberadamente em aberto

- estratégia final para `regional` versus `gestor` em cenários multi-unidade
- bootstrap do primeiro admin/unidade no ambiente Supabase real
- eventuais tabelas auxiliares como `shift_note_reads`, `pending_item_events` e `period_archives`
- functions/triggers transacionais para fechamento de mês, reset e importação de backup

## Próximos passos recomendados dentro da Fase 1

1. Revisar a migration no Supabase Studio/CLI e ajustar tipos/campos antes de popular dados reais.
2. Criar a migration seguinte com funções transacionais de fechamento/reset/import.
3. Adicionar seeds mínimos de unidade, usuário admin e período de exemplo para ambiente de desenvolvimento.
4. Validar as políticas de RLS com cenários de `admin`, `gestor`, `recepcao`, `professor` e `leitura`.
