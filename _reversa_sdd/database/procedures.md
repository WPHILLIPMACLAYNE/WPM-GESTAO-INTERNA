# Data Master — Procedures, Funções e RPCs

Gerado em: 2026-05-02T17:38:13Z

## Funções de Infraestrutura

| Função | Tipo | Propósito |
|---|---|---|
| `set_updated_at()` | trigger function | atualiza `updated_at` em updates |
| `handle_auth_user_created()` | trigger function | cria/atualiza `public.users` quando `auth.users` recebe usuário |
| `period_label_from_key(text)` | SQL immutable | converte `YYYY-MM` para label `Mês/Ano` |
| `next_period_key(text)` | PL/pgSQL immutable | calcula próximo período mensal |

## Autorização e Resolução

| Função | Retorno | Propósito |
|---|---|---|
| `current_unit_role(uuid)` | text | role atual do usuário autenticado na unidade |
| `current_unit_member_id(uuid)` | uuid | membership atual na unidade |
| `has_unit_role(uuid, text[])` | boolean | helper para RLS |
| `require_unit_role(uuid, text[])` | uuid | exige role, lança `42501` se não autorizado |
| `resolve_member_id(uuid, text)` | uuid | encontra membro ativo por `display_name` |
| `resolve_addon_type_id(uuid, text)` | uuid | encontra addon do período por nome |

## Auditoria

| Função | Retorno | Propósito |
|---|---|---|
| `log_audit_event(...)` | uuid | insere linha em `audit_events` com unidade, período, ator, entidade e payload |

## Operações de Período

| Função | Retorno | Propósito |
|---|---|---|
| `clear_period_operational_data(uuid)` | void | remove dados operacionais do período preservando o registro do período |
| `apply_clean_period_template(uuid, uuid, uuid)` | void | aplica settings/addons/metas de um período fonte para um alvo limpo |
| `upsert_period_from_import(...)` | uuid | cria/atualiza período vindo de importação |
| `replace_period_from_payload(uuid, uuid, jsonb, uuid)` | void | substitui conteúdo operacional do período a partir de `PeriodData` local |
| `close_period_transaction(...)` | jsonb | fecha período, registra arquivo/payload e prepara próximo período quando aplicável |
| `import_backup_transaction(uuid, jsonb)` | jsonb | importa backup completo sem checkpoint guardado |

## Sync Guardada

| Função | Retorno | Propósito |
|---|---|---|
| `get_unit_sync_checkpoint(uuid)` | jsonb | calcula revisão por `maxUpdatedAt`, contagem de períodos e auditorias |
| `import_backup_transaction_guarded(uuid, jsonb, jsonb)` | jsonb | importa backup somente se checkpoint esperado bater com o estado remoto atual |

### Contrato do Checkpoint

```json
{
  "revision": "maxUpdatedAt:periodCount:rowCount:auditCount",
  "maxUpdatedAt": "timestamp UTC ou vazio",
  "periodCount": 0,
  "auditCount": 0
}
```

🟢 **CONFIRMADO** — `import_backup_transaction_guarded` retorna o resultado da importação com `previousCheckpoint` e `nextCheckpoint`.

## Bootstrap Administrativo

| Função | Retorno | Propósito |
|---|---|---|
| `bootstrap_unit_admin(...)` | table `boot_unit_id`, `boot_unit_member_id`, `boot_period_id` | cria/atualiza unidade, vínculo admin e período inicial |

🟢 **CONFIRMADO** — A execução é restrita a `service_role`, `postgres` ou `supabase_admin`, e recusa bootstrap se a unidade já tiver outro admin ativo.
