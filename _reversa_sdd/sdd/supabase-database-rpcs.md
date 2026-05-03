# Supabase Database / RPCs

## Visão Geral

🟢 O banco Supabase é a camada relacional remota do WPM Gestão Interna, modelando unidade, usuários, vínculos, períodos mensais, dados operacionais, auditoria e sincronização a partir do store local-first.

🟢 A superfície pública de escrita remota crítica é composta por RPCs `security definer` com `search_path = public`, validação explícita de role por unidade e grants para `authenticated` e/ou `service_role`.

🟢 O contrato operacional central é: o app persiste primeiro localmente, transforma o store em backup JSON e usa RPC guardada por checkpoint para substituir dados remotos sem sobrescrever divergências conhecidas.

🟢 As tabelas públicas principais têm RLS habilitado, e as policies consultam helpers de membership para isolar leitura/escrita por unidade e papel.

## Responsabilidades

- 🟢 Declarar schema canônico remoto para unidades, períodos e entidades operacionais.
- 🟢 Aplicar constraints de domínio diretamente no banco.
- 🟢 Manter `updated_at` via triggers para entidades mutáveis.
- 🟢 Sincronizar `auth.users` com `public.users`.
- 🟢 Resolver role e membership corrente via funções auxiliares.
- 🟢 Exigir autorização transacional com `require_unit_role(...)`.
- 🟢 Registrar auditoria de ações críticas em `audit_events`.
- 🟢 Fechar período mensal e preparar o próximo período aberto.
- 🟢 Resetar período aberto preservando metas NPS.
- 🟢 Importar arquivo de mês e backup completo a partir de JSON local.
- 🟢 Substituir dados operacionais de um período por payload `PeriodData`.
- 🟢 Vincular atendimento de aluno a venda derivada de addon.
- 🟢 Calcular checkpoint remoto por unidade.
- 🟢 Bloquear importação quando checkpoint esperado diverge do estado remoto.
- 🟢 Serializar importações por unidade com advisory lock.
- 🟢 Criar bootstrap administrativo inicial apenas por contexto privilegiado.

## Interface

### Migrations

| Arquivo | Papel | Confiança |
|---|---|---|
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | Schema, índices, triggers, helpers de RLS e policies. | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | RPCs transacionais de período, importação e vínculo de addon. | 🟢 |
| `supabase/migrations/20260422203000_bootstrap_initial_admin.sql` | RPC de bootstrap de unidade/admin/período inicial. | 🟢 |
| `supabase/migrations/20260422224500_fix_addon_sales_unique_index.sql` | Recriação do índice único normalizado de vendas de addons. | 🟢 |
| `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` | Checkpoint remoto e importação guardada. | 🟢 |
| `supabase/seed.sql` | Usuário/unidade/período de desenvolvimento local. | 🟢 |

### Tabelas Canônicas

| Grupo | Tabelas | Regra |
|---|---|---|
| Identidade e unidade | `units`, `users`, `unit_members` | Unidade ativa e vínculo ativo determinam acesso. 🟢 |
| Períodos | `periods`, `period_settings` | Cada período pertence a uma unidade e recebe dados operacionais. 🟢 |
| Operação comercial | `addon_types`, `student_attendances`, `addon_sales`, `pending_items` | Atendimentos, addons e pendências são persistidos por período. 🟢 |
| Recados e NPS | `shift_notes`, `nps_period_metrics`, `nps_mentions` | Métricas, menções e recados alimentam rotinas de gestão. 🟢 |
| Escala e eventos | `scale_days`, `scale_professor_shifts`, `events` | Agenda operacional mensal por período. 🟢 |
| Auditoria | `audit_events` | Ações críticas registram ator, entidade e payload. 🟢 |

### Helpers de Infraestrutura

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `set_updated_at()` | trigger | record | Atualiza `updated_at` em `before update`. 🟢 |
| `handle_auth_user_created()` | trigger | record | Cria/atualiza `public.users` após insert em `auth.users`. 🟢 |
| `period_label_from_key(text)` | `YYYY-MM` | text | Converte chave mensal para label. 🟢 |
| `next_period_key(text)` | `YYYY-MM` | `YYYY-MM` | Calcula mês seguinte. 🟢 |

### Autorização e Resolução

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `current_unit_role(uuid)` | `unit_id` | role|null | Busca role ativa do usuário autenticado. 🟢 |
| `current_unit_member_id(uuid)` | `unit_id` | uuid|null | Busca membership ativo do usuário. 🟢 |
| `has_unit_role(uuid, text[])` | unidade, roles | boolean | Base das policies RLS. 🟢 |
| `require_unit_role(uuid, text[])` | unidade, roles | member id | Lança `42501` se o ator não tem role exigida. 🟢 |
| `resolve_member_id(uuid, text)` | unidade, nome | uuid|null | Resolve membro ativo por `display_name`. 🟢 |
| `resolve_addon_type_id(uuid, text)` | período, nome | uuid|null | Resolve addon por nome no período. 🟢 |

### RPCs Transacionais

| RPC | Assinatura | Retorno | Autorização | Regra |
|---|---|---|---|---|
| `close_period_transaction` | `(uuid, jsonb, text, text, boolean)` | jsonb | `admin`, `gestor` | Fecha período, audita e cria/reseta próximo período. 🟢 |
| `reset_period_transaction` | `(uuid, jsonb)` | jsonb | `admin`, `gestor` | Limpa período aberto e recria métrica NPS base. 🟢 |
| `import_backup_transaction` | `(uuid, jsonb)` | jsonb | `admin`, `gestor` | Importa `month-archive`, `app-backup` ou `full-backup`. 🟢 |
| `link_student_attendance_addon_transaction` | `(uuid, date, integer)` | jsonb | `admin`, `gestor`, `recepcao` | Cria, atualiza ou remove venda derivada de atendimento. 🟢 |
| `get_unit_sync_checkpoint` | `(uuid)` | jsonb | membros ativos da unidade | Calcula revisão remota de leitura. 🟢 |
| `import_backup_transaction_guarded` | `(uuid, jsonb, jsonb)` | jsonb | `admin`, `gestor` | Importa somente se checkpoint remoto bate. 🟢 |
| `bootstrap_unit_admin` | `(uuid, text, text, text, text, text, integer)` | table | `service_role`/SQL admin | Cria/atualiza unidade, admin e período inicial. 🟢 |

### Contrato do Checkpoint

| Campo | Tipo | Regra |
|---|---|---|
| `revision` | string | Combina `maxUpdatedAt`, `periodCount`, `rowCount` e `auditCount`; vazio se não há dados. 🟢 |
| `maxUpdatedAt` | string | Maior timestamp observado nas tabelas operacionais e auditoria. 🟢 |
| `periodCount` | number | Quantidade de períodos da unidade. 🟢 |
| `auditCount` | number | Quantidade de eventos de auditoria da unidade. 🟢 |

## Regras de Negócio

- 🟢 Todas as tabelas públicas principais devem ter RLS habilitado.
- 🟢 Leitura operacional é permitida para membros ativos com roles `admin`, `gestor`, `recepcao`, `professor` ou `leitura`.
- 🟢 Escrita ampla de períodos, settings, addons, NPS, escala, eventos e auditoria é restrita a `admin` e `gestor`.
- 🟢 Escrita de atendimentos, vendas de addons e pendências também é permitida para `recepcao`.
- 🟢 Gestão de `unit_members` é restrita a `admin`.
- 🟢 `unit_members.role` aceita apenas `admin`, `gestor`, `recepcao`, `professor` e `leitura`.
- 🟢 `periods.status` aceita apenas `open` e `closed`.
- 🟢 `period_settings.month_days` deve ficar entre 28 e 31.
- 🟢 Status textuais de NPS, feedback, pendências, escala e eventos são validados por constraints.
- 🟢 `addon_sales.quantity` não pode ser negativo.
- 🟢 `addon_sales.source` deve ser `manual` ou `student_attendance`.
- 🟢 O índice `addon_sales_unique_entry_idx` normaliza data, recepcionista, addon, source e atendimento para evitar duplicidade operacional.
- 🟢 `close_period_transaction` recusa período inexistente ou já fechado.
- 🟢 `close_period_transaction` marca `closed_at`, `closed_by_member_id`, audita `close-month` e prepara próximo período.
- 🟢 Se o próximo período não existe, deve ser criado como `open` e receber template limpo do período fechado.
- 🟢 Se o próximo período existe e `p_reset_next_period` é verdadeiro, deve ser reaberto e resetado por template.
- 🟢 `reset_period_transaction` recusa período fechado.
- 🟢 `reset_period_transaction` preserva metas NPS existentes quando limpa a operação do período.
- 🟢 `import_backup_transaction` aceita `month-archive` com `periodKey` no formato `YYYY-MM`.
- 🟢 `import_backup_transaction` aceita `app-backup` e `full-backup` apenas quando `periods` é objeto JSON.
- 🟢 Em backup completo, períodos remotos ausentes no payload são removidos.
- 🟢 `replace_period_from_payload` limpa e reinsere dados operacionais do período inteiro.
- 🟢 `link_student_attendance_addon_transaction` remove venda derivada se o atendimento não tem addon.
- 🟢 `link_student_attendance_addon_transaction` usa `greatest(0, quantity)` para impedir quantidade negativa na venda derivada.
- 🟢 `import_backup_transaction_guarded` usa `pg_advisory_xact_lock(hashtextextended(p_unit_id::text, 0))` para serializar importações por unidade.
- 🟢 Se não há checkpoint esperado e o backend possui períodos ou auditorias, a importação guardada lança `WPM_SYNC_CONFLICT`.
- 🟢 Se há checkpoint esperado e ele difere do checkpoint atual, a importação guardada lança `WPM_SYNC_CONFLICT`.
- 🟢 Em sucesso, a importação guardada retorna o resultado da importação mais `previousCheckpoint` e `nextCheckpoint`.
- 🟢 `bootstrap_unit_admin` só pode executar com `auth.role() = service_role` ou usuário SQL `postgres`/`supabase_admin`.
- 🟢 `bootstrap_unit_admin` recusa unidade que já possui outro admin ativo.
- 🔴 O checkpoint não é hash completo do conteúdo; é uma revisão pragmática por timestamps e contagens.
- 🔴 `import_backup_transaction` pode apagar períodos remotos que não aparecem em um backup completo.

## Fluxo Principal

1. 🟢 O app local monta payload `app-backup` a partir do store browser.
2. 🟢 O adapter Supabase identifica unidade ativa e role gravável.
3. 🟢 O adapter lê o checkpoint remoto atual via `get_unit_sync_checkpoint`.
4. 🟢 Se existe baseline local conhecido, o adapter envia esse checkpoint como `p_expected_checkpoint`.
5. 🟢 O banco entra em `import_backup_transaction_guarded`.
6. 🟢 A RPC exige role `admin` ou `gestor`.
7. 🟢 A RPC adquire advisory lock por unidade.
8. 🟢 A RPC calcula `v_current_checkpoint`.
9. 🟢 A RPC compara checkpoint atual com `p_expected_checkpoint`.
10. 🟢 Se há divergência, a RPC lança `WPM_SYNC_CONFLICT` e não importa.
11. 🟢 Se a revisão bate, a RPC chama `import_backup_transaction`.
12. 🟢 A importação valida `meta.kind`.
13. 🟢 Para cada período do payload, `upsert_period_from_import` cria/atualiza o registro mensal.
14. 🟢 `replace_period_from_payload` substitui settings, addons, atendimentos, pendências, recados, NPS, escala e eventos do período.
15. 🟢 A importação registra auditoria `backup-import`.
16. 🟢 A RPC guardada calcula novo checkpoint.
17. 🟢 A RPC retorna contadores de importação e checkpoints anterior/seguinte.

## Fluxos Alternativos

- **Fechamento mensal:** 🟢 `close_period_transaction` fecha o período corrente, grava auditoria e prepara o próximo mês por template.
- **Reset de mês:** 🟢 `reset_period_transaction` limpa operação de período aberto e restaura métricas NPS base.
- **Arquivo de mês:** 🟢 `import_backup_transaction` com `meta.kind = month-archive` importa um único período fechado.
- **Backup completo:** 🟢 `import_backup_transaction` com `app-backup` ou `full-backup` substitui o conjunto remoto de períodos conforme payload.
- **Atendimento com addon:** 🟢 `link_student_attendance_addon_transaction` cria ou atualiza uma venda `source = student_attendance`.
- **Atendimento sem addon:** 🟢 a mesma RPC remove venda derivada anterior do atendimento.
- **Primeiro sync com backend preenchido:** 🟢 importação guardada sem checkpoint esperado lança conflito e orienta recarregar do backend.
- **Checkpoint divergente:** 🟢 importação guardada lança conflito e bloqueia overwrite remoto.
- **Bootstrap inicial:** 🟢 `bootstrap_unit_admin` cria unidade, vínculo admin e período inicial quando executado por contexto privilegiado.
- **Bootstrap conflitante:** 🟢 se a unidade já possui outro admin ativo, a RPC recusa a operação.

## Dependências

- `src/core/supabase.js` — cliente browser, leitura remota, payload de sync e chamada das RPCs.
- `src/core/backup.js` — estrutura JSON `app-backup`, `full-backup` e `month-archive`.
- `src/core/schema.js` — normalização local que alimenta o payload remoto.
- `src/core/storage.js` — persistência local anterior à escrita remota.
- `_reversa_sdd/database/data-dictionary.md` — contrato de tabelas e campos.
- `_reversa_sdd/database/business-rules.md` — rules de banco, RLS e constraints.
- `_reversa_sdd/database/procedures.md` — catálogo de funções e RPCs.
- `supabase/migrations/20260422190000_backend_canonical_schema.sql` — schema/RLS.
- `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` — transações.
- `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` — checkpoint.
- `supabase/migrations/20260422203000_bootstrap_initial_admin.sql` — bootstrap.
- Supabase Auth — `auth.uid()` e `auth.role()` usados por helpers e bootstrap.
- PostgreSQL — RLS, triggers, `jsonb`, `security definer`, advisory locks e constraints.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Segurança | Todas as mutações críticas devem validar role por unidade dentro da RPC. | `require_unit_role(...)` em RPCs | 🟢 |
| Isolamento | Tabelas públicas devem filtrar acesso por membership ativo. | RLS + `has_unit_role(...)` | 🟢 |
| Integridade | Importação guardada não deve sobrescrever backend divergente. | `import_backup_transaction_guarded` | 🟢 |
| Atomicidade | Fechamento, reset e importação devem ocorrer dentro de transações SQL. | RPCs PL/pgSQL | 🟢 |
| Concorrência | Importação completa deve serializar por unidade. | `pg_advisory_xact_lock(...)` | 🟢 |
| Auditabilidade | Ações críticas devem gravar `audit_events`. | `log_audit_event(...)` | 🟢 |
| Consistência | Vendas derivadas de atendimento devem ser idempotentes por vínculo. | `link_student_attendance_addon_transaction` + índice único | 🟢 |
| Operação local-first | Backend deve aceitar payload JSON compatível com o store local. | `replace_period_from_payload(...)` | 🟢 |
| Manutenibilidade | Migrations devem separar schema, RPCs, bootstrap e checkpoint. | arquivos de migration por tema | 🟢 |

> Inferido do SQL e das specs de Data Master. Validar em Supabase real porque grants, RLS e `security definer` dependem de runtime Auth.

## Critérios de Aceitação

```gherkin
Dado um usuário admin autenticado em uma unidade ativa
Quando import_backup_transaction_guarded receber checkpoint esperado igual ao checkpoint atual
Então deve importar o payload
E deve retornar previousCheckpoint e nextCheckpoint

Dado um usuário gestor autenticado
Quando close_period_transaction for chamada para um período aberto
Então o período deve ficar closed
E um evento de auditoria close-month deve ser registrado
E o próximo período deve existir como open

Dado um período fechado
Quando reset_period_transaction for chamada
Então a RPC deve falhar
E não deve limpar dados operacionais do período

Dado um backup completo sem um período remoto existente
Quando import_backup_transaction processar o payload
Então o período remoto ausente deve ser excluído
E o contador deletedPeriods deve aumentar

Dado um backend remoto com dados e nenhum checkpoint local esperado
Quando import_backup_transaction_guarded for chamada
Então deve lançar WPM_SYNC_CONFLICT
E não deve executar import_backup_transaction

Dado um checkpoint esperado divergente
Quando import_backup_transaction_guarded comparar com o checkpoint atual
Então deve lançar WPM_SYNC_CONFLICT
E orientar recarregar do backend

Dado um atendimento com addon preenchido
Quando link_student_attendance_addon_transaction for chamada
Então deve criar ou atualizar uma addon_sale source student_attendance
E registrar auditoria attendance-addon-link

Dado um atendimento sem addon
Quando link_student_attendance_addon_transaction for chamada
Então deve remover a venda derivada anterior
E retornar saleAction deleted

Dado uma chamada de bootstrap com usuário authenticated comum
Quando bootstrap_unit_admin for executada
Então deve falhar com erro de permissão

Dado uma chamada de bootstrap por service_role
Quando a unidade não tiver outro admin ativo
Então deve criar ou atualizar unidade, vínculo admin e período inicial
```

## Cenários de Borda

- 🟢 **Período inexistente no fechamento:** `close_period_transaction` lança exceção e não audita sucesso.
- 🟢 **Período já fechado:** fechamento repetido é recusado.
- 🟢 **Período fechado no reset:** reset é recusado.
- 🟢 **`month-archive` sem `periodKey` válido:** importação lança erro de formato.
- 🟢 **Backup completo sem objeto `periods`:** importação lança erro de payload inválido.
- 🟢 **`kind` não suportado:** importação lança erro explícito.
- 🟢 **Backend com dados sem baseline:** importação guardada lança `WPM_SYNC_CONFLICT`.
- 🟢 **Checkpoint esperado stale:** importação guardada lança `WPM_SYNC_CONFLICT`.
- 🟢 **Atendimento sem addon:** venda derivada é removida em vez de mantida órfã.
- 🟢 **Quantidade negativa em venda derivada:** quantidade é normalizada para zero.
- 🟢 **Bootstrap sem `p_user_id`, nome, slug ou display:** operação é recusada.
- 🟢 **Bootstrap com `p_month_days` fora de 28..31:** operação é recusada.
- 🟢 **Bootstrap em unidade com outro admin ativo:** operação é recusada.
- 🟡 **`security definer` mal mantido no futuro:** novas RPCs devem preservar `set search_path = public` e validação de role.
- 🔴 **Revisão por timestamps/contagens:** alterações que preservem contagem e timestamp máximo podem escapar de comparação forte.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Schema canônico remoto | Must | Base de toda persistência Supabase. |
| RLS por unidade/role | Must | Sem isolamento, dados de unidades podem vazar. |
| `require_unit_role` em RPCs | Must | Grants amplos exigem verificação interna. |
| `import_backup_transaction_guarded` | Must | Caminho crítico da sync local-first. |
| `get_unit_sync_checkpoint` | Must | Contrato de conflito remoto. |
| `replace_period_from_payload` | Must | Transforma store local em tabelas. |
| `close_period_transaction` | Must | Fluxo operacional mensal crítico. |
| `import_backup_transaction` | Must | Motor de importação usado pela RPC guardada. |
| `link_student_attendance_addon_transaction` | Should | Mantém consistência entre atendimento e addon derivado. |
| `reset_period_transaction` | Should | Fluxo administrativo importante, mas menos frequente. |
| `bootstrap_unit_admin` | Should | Necessário para provisionamento inicial. |
| Índice único de addon sales | Should | Reduz duplicidade operacional. |
| Auditoria detalhada | Should | Ajuda diagnóstico e rastreabilidade. |
| Helpers `period_label_from_key` e `next_period_key` | Could | Conveniência centralizada para período mensal. |

> Prioridade inferida pelo caminho de sincronização, fechamento mensal e controle de acesso remoto.

## Rastreabilidade de Código

| Arquivo | Função / Objeto | Cobertura |
|---|---|---|
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | tabelas canônicas públicas | 🟢 |
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | `set_updated_at`, triggers `set_updated_at_*` | 🟢 |
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | `handle_auth_user_created`, trigger `on_auth_user_created` | 🟢 |
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | `current_unit_role`, `current_unit_member_id`, `has_unit_role` | 🟢 |
| `supabase/migrations/20260422190000_backend_canonical_schema.sql` | RLS enable + policies por tabela | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `require_unit_role` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `log_audit_event` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `clear_period_operational_data` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `apply_clean_period_template` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `upsert_period_from_import` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `replace_period_from_payload` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `close_period_transaction` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `reset_period_transaction` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `import_backup_transaction` | 🟢 |
| `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` | `link_student_attendance_addon_transaction` | 🟢 |
| `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` | `get_unit_sync_checkpoint` | 🟢 |
| `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` | `import_backup_transaction_guarded` | 🟢 |
| `supabase/migrations/20260422203000_bootstrap_initial_admin.sql` | `bootstrap_unit_admin` | 🟢 |
| `supabase/migrations/20260422224500_fix_addon_sales_unique_index.sql` | `addon_sales_unique_entry_idx` | 🟢 |
| `_reversa_sdd/database/procedures.md` | catálogo Data Master de RPCs | 🟢 |
| `_reversa_sdd/database/business-rules.md` | RLS, constraints e regras transacionais | 🟢 |
| `_reversa_sdd/sdd/supabase-adapter.md` | consumo browser das RPCs/checkpoints | 🟢 |
