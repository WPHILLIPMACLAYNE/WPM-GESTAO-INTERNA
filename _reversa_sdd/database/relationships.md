# Data Master — Relacionamentos

Gerado em: 2026-05-02T17:38:13Z

## Visão Geral

🟢 **CONFIRMADO** — O backend Supabase organiza dados por unidade (`units`) e período (`periods`). A camada local browser-only mantém a mesma noção por `AppStore.periods[YYYY-MM]`, mas como documento JSON em IndexedDB/localStorage.

## Cardinalidades Principais

| Origem | Relação | Destino | Cardinalidade | Regra de exclusão |
|---|---|---|---|---|
| `auth.users` | possui perfil | `users` | 1:1 | cascade no perfil |
| `units` | possui membros | `unit_members` | 1:N | cascade |
| `users` | participa de unidades | `unit_members` | 1:N | cascade |
| `units` + `users` | associação | `unit_members` | N:M via tabela de junção | unique `(unit_id, user_id)` |
| `units` | possui períodos | `periods` | 1:N | cascade |
| `periods` | possui configurações | `period_settings` | 1:1 | cascade |
| `periods` | possui tipos de addon | `addon_types` | 1:N | cascade |
| `periods` | possui atendimentos | `student_attendances` | 1:N | cascade |
| `periods` | possui vendas de addon | `addon_sales` | 1:N | cascade |
| `periods` | possui pendências | `pending_items` | 1:N | cascade |
| `periods` | possui recados | `shift_notes` | 1:N | cascade |
| `periods` | possui métricas NPS | `nps_period_metrics` | 1:1 | cascade |
| `periods` | possui menções NPS | `nps_mentions` | 1:N | cascade |
| `periods` | possui dias de escala | `scale_days` | 1:N | cascade |
| `scale_days` | possui turnos de professores | `scale_professor_shifts` | 1:N | cascade |
| `periods` | possui eventos | `events` | 1:N | cascade |
| `units` | possui auditoria | `audit_events` | 1:N | cascade |

## Relacionamentos por Snapshot

🟢 **CONFIRMADO** — Várias tabelas combinam FK opcional para `unit_members` com snapshot textual. Isso preserva histórico mesmo se o membro for removido/inativado.

| Tabela | FK opcional | Snapshot |
|---|---|---|
| `student_attendances` | `receptionist_member_id` | `receptionist_name_snapshot` |
| `addon_sales` | `receptionist_member_id`, `addon_type_id` | `receptionist_name_snapshot`, `addon_type_snapshot` |
| `pending_items` | `assignee_member_id` | `assignee_name_snapshot` |
| `shift_notes` | `from_member_id`, `to_member_id` | `from_name_snapshot`, `to_audience` |
| `nps_mentions` | `employee_member_id` | `name_snapshot` |
| `scale_days` | `receptionist_member_id` | `receptionist_name_snapshot` |
| `scale_professor_shifts` | `professor_member_id` | `professor_name_snapshot`, `swap_name_snapshot` |
| `events` | `owner_member_id` | `owner_name_snapshot` |

## Mapeamento Local para Remoto

| Local `PeriodData` | Tabela Supabase | Observação |
|---|---|---|
| `settings.team`, `settings.receptionists`, `settings.professors`, `settings.monthDays` | `period_settings` | snapshots JSONB e dias do mês |
| `settings.addonTypes[]` | `addon_types` | nomes ordenados por `sort_order` |
| `students[]` | `student_attendances` | campos `nome`, `matricula`, visita, NPS, feedback, addon |
| `addons[recepcionista][tipo][dia]` | `addon_sales` | linhas diárias com `source = 'manual'` |
| `pending[]` | `pending_items` | status local `aberto/respondido/concluido` |
| `recados[]` | `shift_notes` | mensagem com remetente e audiência |
| `nps` | `nps_period_metrics` | score, metas e observações |
| `nps.mentions[]` | `nps_mentions` | contador e posição de ranking |
| `scale[]` | `scale_days` | dia da escala e recepção |
| `scale[].professorShifts[]` | `scale_professor_shifts` | turnos vinculados ao dia |
| `events[]` | `events` | eventos/calendário |
| ações transacionais | `audit_events` | log por RPC |

## Índices de Relacionamento

🟢 **CONFIRMADO** — Há índices nos FKs e nos campos usados por filtros operacionais: `period_id`, `unit_id`, `membership_number`, status/data de pendências, datas/eventos, tipo/status de eventos, ranking NPS e auditoria.
