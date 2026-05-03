# Data Master — Regras de Negócio no Banco

Gerado em: 2026-05-02T17:38:13Z

## Regras de Acesso

🟢 **CONFIRMADO** — Todas as tabelas públicas principais usam RLS.

| Regra | Implementação |
|---|---|
| Leitura por membros da unidade | policies consultam `has_unit_role(...)` com roles `admin`, `gestor`, `recepcao`, `professor`, `leitura` |
| Escrita administrativa | `admin` e `gestor` gerenciam períodos, settings e dados amplos |
| Escrita de recepção | `recepcao` também gerencia atendimentos, addons e pendências |
| Administração de membros | apenas `admin` gerencia `unit_members` |
| Bootstrap inicial | `bootstrap_unit_admin` só executa com `service_role` ou SQL administrativo |

## Roles

| Role | Prioridade | Capacidade observada |
|---|---:|---|
| `admin` | 1 | gestão completa da unidade e membros |
| `gestor` | 2 | escrita operacional e sync |
| `recepcao` | 3 | escrita em atendimentos/addons/pendências |
| `professor` | 4 | leitura operacional |
| `leitura` | 5 | leitura operacional |

## Constraints de Domínio

| Tabela | Campo | Regra |
|---|---|---|
| `unit_members` | `role` | valores permitidos: `admin`, `gestor`, `recepcao`, `professor`, `leitura` |
| `periods` | `status` | `open` ou `closed` |
| `period_settings` | `month_days` | entre 28 e 31 |
| `student_attendances` | `nps_notice_status` | `Sim`, `Não`, `Pendente` |
| `student_attendances` | `feedback_status` | `Respondeu`, `Não respondeu`, `Pendente` |
| `addon_sales` | `quantity` | inteiro `>= 0` |
| `addon_sales` | `source` | `manual` ou `student_attendance` |
| `pending_items` | `status` | `aberto`, `respondido`, `concluido` |
| `nps_mentions` | `count` | inteiro `>= 0` |
| `nps_mentions` | `rank_position` | nulo ou positivo |
| `scale_days` | `row_tone` | `green`, `red`, `neutral` |
| `events` | `status` | `Programado`, `Confirmado`, `Concluído`, `Cancelado` |

## Triggers

| Trigger | Tabelas | Ação |
|---|---|---|
| `set_updated_at_*` | unidades, usuários, membros, períodos e quase todas as entidades operacionais | antes de update, define `updated_at = timezone('utc', now())` |
| `on_auth_user_created` | `auth.users` | após insert, cria/atualiza perfil em `public.users` |

## Regras Transacionais

| Regra | Evidência |
|---|---|
| Importação de backup troca o período inteiro | `replace_period_from_payload` limpa dados operacionais e reinsere settings, addons, alunos, pendências, recados, NPS, escala e eventos |
| Fechamento de período exige `admin`/`gestor` | `close_period_transaction` usa `require_unit_role(..., ['admin','gestor'])` |
| Reset/template limpa operação do período alvo | `apply_clean_period_template` chama `clear_period_operational_data` e copia settings/addons/metas |
| Sync guardada usa lock por unidade | `import_backup_transaction_guarded` chama `pg_advisory_xact_lock(hashtextextended(p_unit_id::text, 0))` |
| Conflito remoto bloqueia overwrite | checkpoint atual precisa bater com `p_expected_checkpoint`; senão levanta `WPM_SYNC_CONFLICT` |

## Regras Local-First

🟢 **CONFIRMADO** — O app salva primeiro localmente e só sincroniza com Supabase se ambiente, SDK, sessão, unidade ativa e papel gravável permitirem.

| Estado | Regra |
|---|---|
| Sem env/SDK/sessão | app continua em IndexedDB/localStorage |
| Role não gravável | backend fica sem escrita remota |
| Primeiro sync com backend já populado | conflito `baseline-missing`; exige recarregar do backend |
| Checkpoint divergente | conflito `detected`; exige recarregar do backend |
| Sucesso remoto | checkpoint remoto é memorizado em `lastRemoteCheckpoint` |
