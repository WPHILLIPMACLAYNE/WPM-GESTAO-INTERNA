# Detective — Domínio e Regras de Negócio

Gerado em: 2026-05-02T17:42:27Z

## Fontes

- 🟢 **CONFIRMADO** — Código em `src/core`, `src/domain`, `src/features`, `src/ui` e `src/core/supabase.js`.
- 🟢 **CONFIRMADO** — Migrations Supabase em `supabase/migrations/`.
- 🟢 **CONFIRMADO** — Arqueologia Git: commits de PWA, hardening, sync guardado, migração assistida, mobile tables, deploy observability e docs.
- 🟡 **INFERIDO** — Motivações de produto foram deduzidas por nomes de módulos, mensagens de commit, textos de UI e regras persistidas.

## Glossário

| Termo | Significado | Confiança |
|---|---|---|
| Unidade | Academia/filial operacional no backend Supabase. | 🟢 |
| Período | Mês operacional no formato `YYYY-MM`; é a unidade de apuração e fechamento. | 🟢 |
| Recepcionista | Pessoa que registra atendimento, pendências e vendas de addon. | 🟢 |
| Professor | Pessoa escalada em turnos e também parte do time rastreável. | 🟢 |
| Aluno/Atendimento | Registro de contato com aluno, matrícula, visita, início, NPS, feedback e addon. | 🟢 |
| Pendência | Tarefa operacional vinculada a aluno, com responsável, resposta e status. | 🟢 |
| Addon | Produto/serviço adicional vendido por recepcionista e tipo. | 🟢 |
| NPS | Indicador com score, metas, observações e menções por funcionário. | 🟢 |
| Recado | Mensagem interna por período/turno, vinda de `recados` local e `shift_notes` remoto. | 🟢 |
| Escala | Planejamento de recepção e turnos de professores por dia. | 🟢 |
| Evento/Ação | Item de calendário operacional com tipo, dono, status e descrição. | 🟢 |
| Arquivo de fechamento | JSON baixado ao fechar o mês, usado como evidência/export. | 🟢 |
| Checkpoint remoto | Revisão Supabase usada para impedir overwrite de backend divergente. | 🟢 |

## Regras Principais

| Regra | Evidência | Confiança |
|---|---|---|
| O mês ativo é o centro de edição; períodos fechados viram somente leitura. | `storage.archives`, `isPeriodLocked()`, `LOCKED_CURRENT_PERIOD_*`. | 🟢 |
| Fechar mês exporta JSON, arquiva o período e abre o próximo mês. | `closePeriod()`. | 🟢 |
| Reset de mês sempre exporta backup antes de apagar operação. | `resetPeriod()`. | 🟢 |
| O próximo mês pode ser iniciado limpo ou preservado se já houver dados. | `periodHasMeaningfulData()` dentro de `closePeriod()`. | 🟢 |
| Dados locais são a base de continuidade mesmo quando Supabase falha. | `saveStore()`, IndexedDB/localStorage e fallback em `src/core/supabase.js`. | 🟢 |
| Sync remota só grava para roles `admin` e `gestor`. | `SUPABASE_WRITABLE_ROLES` e RLS/RPC. | 🟢 |
| Sessões Supabase sem permissão ficam em modo somente leitura na UI. | `isBackendReadOnlyMode()`, `syncCurrentPeriodLockUI()`. | 🟢 |
| Backend remoto já populado sem baseline local bloqueia sync. | `remote-baseline-missing`. | 🟢 |
| Checkpoint divergente bloqueia overwrite remoto. | `import_backup_transaction_guarded()`, erro `WPM_SYNC_CONFLICT`. | 🟢 |
| Matrícula aceita apenas dígitos quando informada. | `normalizeNumericId()` e validações de aluno/pendência. | 🟢 |
| Pendência exige nome e descrição; data, se informada, precisa estar no período ativo. | `validatePending()`. | 🟢 |
| Evento exige data e título; data precisa pertencer ao período ativo. | `validateEvent()`. | 🟢 |
| Aluno exige ao menos nome. | `validateStudent()`. | 🟢 |
| Addon de aluno ajusta contador ao salvar/editar atendimento. | `handleSaveStudent` documentado em `code-analysis.md`. | 🟢 |
| NPS preserva snapshot de ranking antes de alterações para mostrar tendência. | `captureNpsRankSnapshot()`, `registerMention()`, `adjustMention()`. | 🟢 |
| Escala exige ao menos um turno de professor ao salvar dia. | `render-scale.js` `saveScaleDay()`. | 🟢 |
| Configurações exigem ao menos uma recepcionista e um tipo de addon. | `saveSettings()`. | 🟢 |
| Reduzir dias do mês pode descartar addons em dias removidos e pede confirmação. | `updateMonthDays()`. | 🟢 |

## Regras Derivadas de Indicadores

| Indicador | Regra |
|---|---|
| Resumo de recepcionistas | total de alunos, feedbacks não pendentes, avisos NPS, addons, feedback positivo e taxas. |
| Pendências | ordem operacional prioriza `aberto`, depois `respondido`, depois `concluido`; identifica aberta mais antiga. |
| NPS | ranking ordenado por menções; tendência compara posição atual com snapshot anterior. |
| Addons | matriz pessoa/tipo/dia soma volume por recepcionista e tipo. |
| Histórico | líderes passados de addon/NPS são calculados apenas de períodos anteriores. |
| Escala | cobertura considera recepção preenchida e turnos de professores. |
| Eventos | dashboards separam programados, confirmados e concluídos. |

## Arqueologia Git

| Commit/linha histórica | Decisão revelada | Confiança |
|---|---|---|
| `feat(sync): guard supabase store import by checkpoint` | Sincronização remota precisa de proteção contra overwrite por múltiplos dispositivos. | 🟢 |
| `feat: finalize assisted migration and monthly close flow` | Migração assistida e fechamento mensal são fluxos centrais de operação. | 🟢 |
| `fix(logic): harden nps ranking and event persistence` | Ranking NPS e persistência de eventos já tiveram risco de regressão relevante. | 🟢 |
| `feat(pwa): harden app shell caching and update flow` | App deve funcionar como PWA/offline shell com atualização controlada. | 🟢 |
| `fix(security): remove inline scripts from app shell` e `fix(security): concluir hardening CSP` | CSP e remoção de inline scripts foram decisões explícitas de segurança. | 🟢 |
| `feat(ui): adapt operational tables for mobile` | Tabelas operacionais precisam ser úteis em mobile, não apenas desktop. | 🟢 |
| `feat(deploy): add release smoke and observability` | Publicação precisa de smoke/release observability. | 🟢 |

## Lacunas

| Lacuna | Impacto | Confiança |
|---|---|---|
| Não há fonte externa de negócio validando nomes reais de status e papéis. | As regras são fortes no código, mas precisam validação humana para contrato formal. | 🔴 |
| Não há logs de produção no repositório, apenas docs/backlogs e changelogs de dependências. | Eventos recorrentes reais não foram inferidos por logs. | 🔴 |
| Leitura individual de recados pode permanecer local/visual. | Decisão humana confirmou que não precisa sincronizar no backend por usuário agora. | 🟢 |
