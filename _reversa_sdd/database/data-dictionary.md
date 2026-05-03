# Data Master — Dicionário de Dados

Gerado em: 2026-05-02T17:38:13Z

## Fontes

- 🟢 **CONFIRMADO** — DDL em `supabase/migrations/20260422190000_backend_canonical_schema.sql`.
- 🟢 **CONFIRMADO** — RPCs transacionais em `supabase/migrations/20260422194000_backend_transaction_rpcs.sql`.
- 🟢 **CONFIRMADO** — checkpoint guardado em `supabase/migrations/20260423090000_sync_checkpoint_guard.sql`.
- 🟢 **CONFIRMADO** — modelo local em `src/core/schema.js`, persistência em `src/core/storage.js` e mapper em `src/core/supabase.js`.

## Persistência Local Browser-Only

| Estrutura | Campo/Chave | Tipo | Regra |
|---|---|---|---|
| IndexedDB | `IDB_NAME` / `IDB_STORE_NAME` | object store chave/valor | backend primário local; criado em versão `1` |
| Cache em memória | `storageCache` | `Map<string, string>` | hidrata de IndexedDB e fallback localStorage |
| localStorage | `STORAGE_KEY` e chaves legadas | string JSON | fallback e compatibilidade de migração |
| Broadcast cross-tab | `STORAGE_BROADCAST_KEY` | string JSON | propaga saves entre abas |
| AppStore | `version` | number | `STORE_VERSION = 4` |
| AppStore | `activePeriod` | text `YYYY-MM` | período ativo; fallback `getInitialPeriodKey()` |
| AppStore | `preferences` | object | normalizado por `normalizeStorePreferences()` |
| AppStore | `periods` | object map | chave `YYYY-MM` para `PeriodData` |
| AppStore | `archives` | object map | períodos fechados/arquivados |

## Tabelas de Identidade e Unidade

### `units`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | obrigatório |
| `slug` | text | obrigatório, único |
| `timezone` | text | default `America/Sao_Paulo` |
| `active` | boolean | default `true` |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `users`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK, FK `auth.users(id)` com cascade |
| `email` | text | obrigatório, único |
| `full_name` | text | obrigatório |
| `auth_provider` | text | default `supabase` |
| `active` | boolean | default `true` |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `unit_members`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK `units(id)` cascade |
| `user_id` | uuid | FK `users(id)` cascade |
| `display_name` | text | obrigatório |
| `role` | text | check `admin`, `gestor`, `recepcao`, `professor`, `leitura` |
| `active` | boolean | default `true` |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |
| constraint | unique | `(unit_id, user_id)` |

## Núcleo por Período

### `periods`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK `units(id)` cascade |
| `period_key` | text | formato operacional `YYYY-MM` |
| `label` | text | label humano |
| `status` | text | check `open`, `closed` |
| `closed_at` | timestamptz | nullable |
| `closed_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |
| constraint | unique | `(unit_id, period_key)` |

### `period_settings`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade, único |
| `team_snapshot` | jsonb | default `[]` |
| `reception_snapshot` | jsonb | default `[]` |
| `professor_snapshot` | jsonb | default `[]` |
| `month_days` | integer | check entre 28 e 31 |
| `created_by_member_id`, `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `addon_types`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `name` | text | obrigatório |
| `sort_order` | integer | default `0` |
| `active` | boolean | default `true` |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |
| constraint | unique | `(period_id, name)` |

## Operação

### `student_attendances`

Registra alunos/atendimentos do período.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `student_name` | text | obrigatório |
| `membership_number` | text | matrícula, nullable |
| `last_visit_date` | date | nullable |
| `last_visit_time` | text | nullable |
| `started_at_date` | date | obrigatório |
| `nps_notice_status` | text | check `Sim`, `Não`, `Pendente` |
| `receptionist_member_id` | uuid | FK `unit_members(id)` set null |
| `receptionist_name_snapshot` | text | snapshot local |
| `feedback_status` | text | check `Respondeu`, `Não respondeu`, `Pendente` |
| `addon_type_id` | uuid | FK `addon_types(id)` set null |
| `addon_type_snapshot` | text | snapshot local |
| `notes` | text | default vazio |
| `created_by_member_id`, `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `addon_sales`

Registra vendas manuais de addon e vendas derivadas de atendimentos.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `sale_date` | date | obrigatório |
| `receptionist_member_id` | uuid | FK `unit_members(id)` set null |
| `receptionist_name_snapshot` | text | snapshot local |
| `addon_type_id` | uuid | FK `addon_types(id)` set null |
| `addon_type_snapshot` | text | snapshot local |
| `quantity` | integer | check `>= 0` |
| `source` | text | check `manual`, `student_attendance` |
| `student_attendance_id` | uuid | FK `student_attendances(id)` set null |
| `created_by_member_id`, `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |
| índice único | expression index | evita duplicidade por período, data, recepcionista, addon, origem e atendimento |

### `pending_items`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `student_name` | text | obrigatório |
| `membership_number` | text | nullable |
| `description` | text | obrigatório |
| `requested_at_date` | date | obrigatório |
| `assignee_member_id` | uuid | FK `unit_members(id)` set null |
| `assignee_name_snapshot` | text | snapshot local |
| `response` | text | default vazio |
| `status` | text | check `aberto`, `respondido`, `concluido` |
| `created_by_member_id`, `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `shift_notes`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `from_member_id`, `to_member_id` | uuid | FK `unit_members(id)` set null |
| `from_name_snapshot` | text | obrigatório |
| `to_audience` | text | obrigatório |
| `message` | text | obrigatório |
| `created_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at` | timestamptz | default UTC |

## NPS

### `nps_period_metrics`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade, único |
| `score` | numeric(5,2) | obrigatório |
| `monthly_goal` | numeric(5,2) | obrigatório |
| `semester_goal` | numeric(5,2) | obrigatório |
| `observations` | text | default vazio |
| `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `nps_mentions`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `employee_member_id` | uuid | FK `unit_members(id)` set null |
| `name_snapshot` | text | obrigatório |
| `count` | integer | check `>= 0` |
| `rank_position` | integer | nullable ou `> 0` |
| `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

## Escala e Eventos

### `scale_days`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `scale_date` | date | obrigatório |
| `row_tone` | text | check `green`, `red`, `neutral` |
| `reception_time` | text | nullable |
| `receptionist_member_id` | uuid | FK `unit_members(id)` set null |
| `receptionist_name_snapshot` | text | snapshot local |
| `reception_swap` | text | nullable |
| `note` | text | default vazio |
| `created_by_member_id`, `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |
| constraint | unique | `(period_id, scale_date)` |

### `scale_professor_shifts`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `scale_day_id` | uuid | FK `scale_days(id)` cascade |
| `time_label` | text | obrigatório |
| `professor_member_id` | uuid | FK `unit_members(id)` set null |
| `professor_name_snapshot` | text | snapshot local |
| `swap_name_snapshot` | text | nullable |
| `sort_order` | integer | default `0` |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

### `events`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `period_id` | uuid | FK `periods(id)` cascade |
| `event_date` | date | obrigatório |
| `event_time` | text | nullable |
| `type` | text | obrigatório |
| `title` | text | obrigatório |
| `place` | text | default vazio |
| `owner_member_id` | uuid | FK `unit_members(id)` set null |
| `owner_name_snapshot` | text | snapshot local |
| `status` | text | check `Programado`, `Confirmado`, `Concluído`, `Cancelado` |
| `description` | text | default vazio |
| `created_by_member_id`, `updated_by_member_id` | uuid | FK `unit_members(id)` set null |
| `created_at`, `updated_at` | timestamptz | default UTC; `updated_at` por trigger |

## Auditoria

### `audit_events`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK `units(id)` cascade |
| `period_id` | uuid | FK `periods(id)` set null |
| `actor_member_id` | uuid | FK `unit_members(id)` set null |
| `event_type` | text | obrigatório |
| `entity_type` | text | obrigatório |
| `entity_id` | uuid | nullable |
| `payload` | jsonb | default `{}` |
| `created_at` | timestamptz | default UTC |
