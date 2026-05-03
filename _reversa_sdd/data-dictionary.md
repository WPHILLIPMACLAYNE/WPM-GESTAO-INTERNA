# Dicionário de Dados Reversa — Gestão interna de academias

Gerado em: 2026-05-02T17:05:27Z

## Fonte

🟢 **CONFIRMADO** — Tipos extraídos de `src/types.js` e normalização observada em `src/core/lifecycle.js`, `src/core/schema.js`, `src/core/backup.js` e `src/core/supabase.js`.

## AppStore

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `version` | number | sim | `STORE_VERSION`, atualmente `4` |
| `activePeriod` | string | sim | `YYYY-MM`; fallback `getInitialPeriodKey()` |
| `preferences` | StorePreferences | sim | `normalizeStorePreferences()` |
| `periods` | Object<string, PeriodData> | sim | mapa por `YYYY-MM` |
| `archives` | Object<string, ArchiveEntry> | sim | `{}` |

## StorePreferences

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `initializeMonthsWithTestData` | boolean | sim | `APP_RUNTIME === 'development'` se ausente |

## ArchiveEntry

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `closedAt` | string | sim | ISO timestamp |
| `closedAtLabel` | string | sim | `toLocaleString('pt-BR')` |
| `label` | string | sim | label humano do período |

## PeriodData

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `settings` | PeriodSettings | sim | defaults de `APP_DEFAULTS` |
| `students` | Student[] | sim | `[]` |
| `pending` | PendingItem[] | sim | `[]` |
| `recados` | Recado[] | sim | normalizado por helpers de recados |
| `nps` | NpsData | sim | score/metas clampados 0..100 |
| `scale` | ScaleEntry[] | sim | `[]`; aceita legado `escala` |
| `events` | EventItem[] | sim | `[]`; aceita legado `eventos` |
| `addons` | Object<string, Object<string, number[]>> | sim | matriz pessoa/tipo/dia |

## PeriodSettings

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `team` | string[] | sim | união/deduplicação de recepção/professores quando aplicável |
| `receptionists` | string[] | sim | `APP_DEFAULTS.receptionists` se vazio |
| `professors` | string[] | sim | `APP_DEFAULTS.professors` se vazio |
| `addonTypes` | string[] | sim | `APP_DEFAULTS.addonTypes` se vazio |
| `monthDays` | number | sim | dias reais do mês no builder; fallback 31 |

## Student

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | `crypto.randomUUID()` se ausente |
| `nome` | string | sim | `''` |
| `matricula` | string | sim | `normalizeNumericId()` |
| `ultimaVisita` | string | não | data ISO ou `''` |
| `horaVisita` | string | não | `horaVisita` ou legado `horario` |
| `inicio` | string | não | data ISO ou `''` |
| `avisoNps` | string | sim | `'Sim'`; tipos esperados: Sim/Não/Pendente |
| `atendimento` | string | sim | primeiro nome do time se ausente |
| `feedback` | string | sim | `'Pendente'` |
| `addon` | string | não | tipo de addon ou vazio |
| `observacoes` | string | não | `''` |

## PendingItem

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | `crypto.randomUUID()` se ausente |
| `nome` | string | sim | `''` |
| `matricula` | string | sim | `normalizeNumericId()` |
| `pendencia` | string | sim | `''` |
| `data` | string | não | data ISO ou `''` |
| `hostess` | string | sim | primeiro nome do time se ausente |
| `resposta` | string | não | `''` |
| `status` | string | sim | `'aberto'`; esperado aberto/respondido/concluido |

## NpsData e NpsMention

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `score` | number | sim | clamp 0..100 |
| `monthlyGoal` | number | sim | clamp 0..100; fallback 75 |
| `semesterGoal` | number | sim | clamp 0..100; fallback 80 |
| `observations` | string | não | `''` |
| `mentions` | NpsMention[] | sim | lista normalizada |
| `rankSnapshot` | Object<string, number> | sim | `normalizeNpsRankSnapshot()` |

NpsMention:

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | `crypto.randomUUID()` |
| `name` | string | sim | nome citado |
| `count` | number | sim | `Math.max(0, Number(...))` |

## ScaleEntry e ProfessorShift

ScaleEntry:

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | `crypto.randomUUID()` |
| `date` | string | sim | item sem date é filtrado |
| `rowTone` | string | sim | `green`, `red` ou `neutral` |
| `professorShifts` | ProfessorShift[] | sim | migra campos legados simples para array |
| `receptionTime` | string | não | `''` |
| `receptionist` | string | não | `''` |
| `receptionSwap` | string | não | `''` |
| `note` | string | não | `''` |

ProfessorShift:

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | `crypto.randomUUID()` |
| `time` | string | não | `time` ou legado `horario` |
| `name` | string | não | `name` ou legado `nome` |
| `swap` | string | não | `swap` ou legado `troca` |

## EventItem

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | `crypto.randomUUID()` |
| `date` | string | não | item com date ou title é preservado |
| `time` | string | não | `time` ou legado `hora` |
| `type` | string | sim | `'Evento'` |
| `title` | string | não | `title` ou legado `titulo` |
| `place` | string | não | `place` ou legado `local` |
| `owner` | string | não | `owner` ou legado `responsavel` |
| `status` | string | sim | `'Programado'` |
| `description` | string | não | `description` ou legado `descricao` |

## Recado

| Campo | Tipo | Obrigatório | Default/Regra |
|---|---|---:|---|
| `id` | string | sim | UUID quando normalizado por helpers |
| `from` | string | sim | remetente |
| `to` | string | sim | destinatário/audiência |
| `message`/`text` | string | sim | o core usa estruturas normalizadas por helper |
| `createdAt` | string | sim | ISO timestamp |
| `read` | boolean | sim | `false` quando vindo do Supabase |

## Supabase Backend State

| Campo | Tipo | Default/Regra |
|---|---|---|
| `enabled` | boolean | `false` |
| `hasEnv` | boolean | env pública presente |
| `hasSdk` | boolean | `window.supabase.createClient` disponível |
| `sessionStatus` | string | `offline`, `anonymous`, `authenticated` |
| `user` | object|null | snapshot seguro do usuário |
| `memberships` | object[] | memberships ativos por unidade |
| `activeUnit` | object|null | unidade escolhida por slug/role |
| `writable` | boolean | true apenas para `admin`/`gestor` |
| `source` | string | `local` ou `supabase` |
| `syncPolicy` | string | `local-first-guarded` |
| `syncStatus` | string | `idle`, `loading`, `queued`, `saving`, `error`, `conflict` |
| `conflictStatus` | string | `clear`, `baseline-missing`, `detected` |
| `lastRemoteCheckpoint` | object|null | checkpoint normalizado |

## AddonTotals

| Campo | Tipo | Regra |
|---|---|---|
| `porPessoa` | Object<string, number> | total de addons por pessoa |
| `porPessoaTipo` | Object<string, Object<string, number>> | total por pessoa e tipo |
| `totalGeral` | number | soma total de todos os grupos |

## ReceptionistSummary

| Campo | Tipo | Regra |
|---|---|---|
| `nome` | string | nome da recepcionista |
| `total` | number | alunos atendidos |
| `comFeedback` | number | alunos com feedback diferente de `Pendente` |
| `nps` | number | alunos com `avisoNps === 'Sim'` |
| `addon`/`addonVolume` | number | volume total de addons |
| `positivos` | number | feedback `Respondeu` |
| `taxaFeedback` | number | `comFeedback / total` |
| `taxaAddon` | number | `addon / total` |
| `taxaPositiva` | number | `positivos / comFeedback` |
| `diferencaTaxa` | number | taxa individual menos taxa global |

## NpsRankingResult

| Campo | Tipo | Regra |
|---|---|---|
| `ranking` | Array<NpsMention & extras> | ordenado por ranking NPS |
| `totalCitacoes` | number | soma de `count` |
| `top` | object|null | primeiro item do ranking |
| `mapaRanking` | Object<string, number> | posição por id de menção |

Cada item de `ranking` recebe:

- `position`: posição atual.
- `tendencia.classe`: `trend-stable`, `trend-new`, `trend-up`, `trend-down`.
- `tendencia.rotulo`: texto curto da variação.

## DashboardHistoryPoint

| Campo | Tipo | Regra |
|---|---|---|
| `key` | string | período `YYYY-MM` |
| `label` | string | label completo do período |
| `shortLabel` | string | abreviação de mês |
| `totalAlunos` | number | tamanho de `students` |
| `npsAtual` | number | score clampado 0..100 |
| `metaMensal` | number | meta mensal clampada |
| `hasData` | boolean | período existe no store |

## ValidationResult

| Campo | Tipo | Regra |
|---|---|---|
| `isValid` | boolean | começa `true`; validações mudam para `false` |
| `errors` | Object<string, string> | mensagens por campo/grupo |

## SaveResult

| Campo | Tipo | Regra |
|---|---|---|
| `ok` | boolean | sucesso/falha da validação/aplicação |
| `validation` | ValidationResult | presente quando `ok=false` por validação |
| `nextState` | PeriodData | novo estado proposto quando `ok=true` |
| `entity` | Student/PendingItem/EventItem | entidade salva |

## FlowSmokeReportItem

| Campo | Tipo | Regra |
|---|---|---|
| `label` | string | nome do teste |
| `status` | string | `ok`, `bad`, `warn`, `info` |
| `detail` | string | evidência textual |

## Migration Snapshot

| Campo | Tipo | Regra |
|---|---|---|
| `periodCount` | number | quantidade de períodos |
| `archiveCount` | number | quantidade de arquivos fechados |
| `totals` | object | totais por entidade |
| `periods` | Object<string, object> | contagens por período |

Entidades contadas:

- `recados`
- `students`
- `pending`
- `events`
- `scaleDays`
- `professorShiftRows`
- `npsMentions`
- `addonRows`
- `addonVolume`

## UI_BINDINGS

| Campo | Tipo | Regra |
|---|---|---|
| `id`/`selector` | string | identifica controle DOM ou seletor delegado |
| `stateKey` | string | chave persistida em `state.ui` |
| `event` | string | tipo de evento observado |
| `target`/`targets` | string/string[] | área(s) enviadas a `requestRender()` |
| `read`/`write` | function | conversão entre DOM e estado |

Uso: controles de filtro e visão são sincronizados com `state.ui` e renderizados por alvo lógico.

## estadoRenderizacao

| Campo | Tipo | Regra |
|---|---|---|
| `sujas` | Set<string> | áreas pendentes de renderização |
| `agendado` | boolean | impede múltiplos `requestAnimationFrame` simultâneos |
| `emExecucao` | boolean | indica ciclo de render em andamento |
| `hashes` | Map<string,string> | cache de HTML por alvo/fragmento |

## estadoEventos

| Campo | Tipo | Regra |
|---|---|---|
| `uiInicializado` | boolean | evita registrar listeners delegados mais de uma vez |
| `dndPendenciasInicializado` | boolean | evita duplicar listeners globais de drag/drop |
| `acessibilidadeInicializada` | boolean | controla inicialização de preferências acessíveis |
| `atalhosInicializados` | boolean | controla atalhos globais |
| `tooltipsInicializados` | boolean | controla eventos de tooltip |

## estadoAcessibilidade

| Campo | Tipo | Regra |
|---|---|---|
| `reducedMotion` | boolean | preferência de movimento reduzido |
| `highContrast` | boolean | preferência de contraste alto |
| `visibleFocus` | boolean | estilo de foco visível |
| `liveMessage` | string | última mensagem anunciada ao leitor de tela |

## Dashboard Chart Registry

| Campo | Tipo | Regra |
|---|---|---|
| `DASHBOARD_CHART_IDS` | string[] | ids de canvas/containers controlados pelo dashboard |
| `dashboardChartInstances` | Map/Object | instâncias Chart.js ativas por id |
| `chartData` | object | séries derivadas por selectors de domínio |

Regra: instâncias antigas são destruídas antes de montar novos gráficos para evitar canvas sobreposto e vazamento visual.

## Recado

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | gerado por `createRecadoId()` |
| `message`/`text` | string | conteúdo sanitizado do recado |
| `author` | string | autor/responsável quando informado |
| `createdAt` | string | timestamp de publicação |
| `readAt` | string|null | preenchido quando marcado como lido |
| `periodKey` | string | período associado |

Observação: o módulo de recados no dashboard também lê chaves legadas do `localStorage`, normaliza coleções e mescla dados ao store por período.

## Runtime Style Dataset

| Campo/Atributo | Tipo | Regra |
|---|---|---|
| `data-runtime-style-id` | string | id gerado para associar elemento a regra CSS runtime |
| `data-style-width-pct` | number | largura percentual clampada entre 0 e 100 |
| `data-style-height-px` | number | altura em pixels, com mínimo 0 |
| `data-style-left-pct` | number | posição esquerda percentual clampada entre 0 e 100 |
| `data-style-left-offset-px` | number | offset positivo aplicado em `calc()` |

## RiskBand

| Campo | Tipo | Regra |
|---|---|---|
| `label` | string | descrição textual da faixa NPS |
| `tone` | string | classe visual associada à faixa |

Faixas confirmadas:

- `0..20`: `risk-red`
- `21..40`: `risk-orange`
- `41..60`: `risk-yellow`
- `61..80`: `risk-green-light`
- `81..100`: `risk-green-dark`

## PeriodKey

| Campo | Tipo | Regra |
|---|---|---|
| `key` | string | formato obrigatório `YYYY-MM` |
| `prefix` | string | prefixo `YYYY-MM` usado para datas do período |
| `label` | string | label exibido como `Mês/Ano` |

Regra: comparação de períodos válidos pode ser feita por `localeCompare`, pois o formato `YYYY-MM` preserva ordenação cronológica.

## CsvContent

| Campo | Tipo | Regra |
|---|---|---|
| `rows` | Array<Array<string>> | linhas e colunas brutas antes do escape |
| `delimiter` | string | fixo `;` |
| `escapedValue` | string | valores com aspas, vírgula ou ponto e vírgula são envolvidos por aspas |

Regra: quebras de linha internas são substituídas por espaço antes da exportação.

## Supabase — Unit

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | nome da unidade |
| `slug` | text | único |
| `timezone` | text | padrão `America/Sao_Paulo` |
| `active` | boolean | padrão `true` |
| `created_at`/`updated_at` | timestamptz | UTC |

## Supabase — UnitMember

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK `units`, cascade |
| `user_id` | uuid | FK `users`, cascade |
| `display_name` | text | nome operacional |
| `role` | text | `admin`, `gestor`, `recepcao`, `professor`, `leitura` |
| `active` | boolean | controla acesso |

Regra: `(unit_id, user_id)` é único.

## Supabase — Period

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK `units`, cascade |
| `period_key` | text | período `YYYY-MM` |
| `label` | text | label humano |
| `status` | text | `open` ou `closed` |
| `closed_at` | timestamptz|null | preenchido no fechamento |
| `closed_by_member_id` | uuid|null | membro que fechou |

Regra: `(unit_id, period_key)` é único.

## Supabase — PeriodSettings

| Campo | Tipo | Regra |
|---|---|---|
| `period_id` | uuid | único por período |
| `team_snapshot` | jsonb | snapshot da equipe |
| `reception_snapshot` | jsonb | snapshot de recepção |
| `professor_snapshot` | jsonb | snapshot de professores |
| `month_days` | integer | entre 28 e 31 |

## Supabase — StudentAttendance

| Campo | Tipo | Regra |
|---|---|---|
| `student_name` | text | obrigatório |
| `membership_number` | text|null | matrícula |
| `last_visit_date`/`last_visit_time` | date/text | última visita |
| `started_at_date` | date | data de início/atendimento |
| `nps_notice_status` | text | `Sim`, `Não`, `Pendente` |
| `receptionist_member_id` | uuid|null | membro resolvido |
| `receptionist_name_snapshot` | text|null | nome histórico |
| `feedback_status` | text | `Respondeu`, `Não respondeu`, `Pendente` |
| `addon_type_id` | uuid|null | tipo resolvido |
| `addon_type_snapshot` | text|null | tipo histórico |

## Supabase — AddonSale

| Campo | Tipo | Regra |
|---|---|---|
| `period_id` | uuid | FK período |
| `sale_date` | date | dia da venda |
| `receptionist_member_id` | uuid|null | membro resolvido |
| `receptionist_name_snapshot` | text|null | nome histórico |
| `addon_type_id` | uuid|null | tipo resolvido |
| `addon_type_snapshot` | text|null | tipo histórico |
| `quantity` | integer | mínimo 0 |
| `source` | text | `manual` ou `student_attendance` |
| `student_attendance_id` | uuid|null | origem quando derivada |

Regra: índice único normaliza nulos/snapshots para impedir duplicidade operacional.

## Supabase — PendingItem

| Campo | Tipo | Regra |
|---|---|---|
| `student_name` | text | obrigatório |
| `membership_number` | text|null | matrícula |
| `description` | text | pendência |
| `requested_at_date` | date | data solicitada |
| `assignee_member_id` | uuid|null | responsável resolvido |
| `assignee_name_snapshot` | text|null | nome histórico |
| `response` | text | resposta |
| `status` | text | `aberto`, `respondido`, `concluido` |

## Supabase — ShiftNote

| Campo | Tipo | Regra |
|---|---|---|
| `from_member_id` | uuid|null | origem resolvida |
| `from_name_snapshot` | text | origem histórica |
| `to_member_id` | uuid|null | destino resolvido |
| `to_audience` | text | destinatário textual, padrão conceitual `Todos` |
| `message` | text | recado |

## Supabase — NPS

| Campo | Tipo | Regra |
|---|---|---|
| `nps_period_metrics.score` | numeric(5,2) | clampado 0..100 na importação |
| `monthly_goal` | numeric(5,2) | padrão 75 |
| `semester_goal` | numeric(5,2) | padrão 80 |
| `observations` | text | observações |
| `nps_mentions.count` | integer | mínimo 0 |
| `nps_mentions.rank_position` | integer|null | positivo quando presente |

## Supabase — Scale

| Campo | Tipo | Regra |
|---|---|---|
| `scale_days.scale_date` | date | único por período |
| `row_tone` | text | `green`, `red`, `neutral` |
| `reception_time` | text|null | turno recepção |
| `receptionist_member_id` | uuid|null | recepcionista resolvido |
| `scale_professor_shifts.time_label` | text | horário do professor |
| `professor_member_id` | uuid|null | professor resolvido |
| `sort_order` | integer | ordem do turno |

## Supabase — Event

| Campo | Tipo | Regra |
|---|---|---|
| `event_date` | date | data |
| `event_time` | text|null | hora |
| `type` | text | tipo livre importado |
| `title` | text | obrigatório |
| `place` | text | local |
| `owner_member_id` | uuid|null | responsável resolvido |
| `status` | text | `Programado`, `Confirmado`, `Concluído`, `Cancelado` |
| `description` | text | descrição |

## Supabase — AuditEvent

| Campo | Tipo | Regra |
|---|---|---|
| `unit_id` | uuid | unidade auditada |
| `period_id` | uuid|null | período quando aplicável |
| `actor_member_id` | uuid|null | ator |
| `event_type` | text | tipo de operação |
| `entity_type` | text | entidade afetada |
| `entity_id` | uuid|null | registro afetado |
| `payload` | jsonb | detalhes |

## Supabase SyncCheckpoint

| Campo | Tipo | Regra |
|---|---|---|
| `revision` | string | composição de timestamp/contagens |
| `maxUpdatedAt` | string | maior timestamp observado |
| `periodCount` | integer | total de períodos da unidade |
| `auditCount` | integer | total de eventos de auditoria |

Regra: import guardado falha com `WPM_SYNC_CONFLICT` quando checkpoint remoto diverge do esperado.

## Legacy Storage Keys

| Chave | Tipo | Regra |
|---|---|---|
| `recepcao-smartfit-dashboard-v34` | store atual legado/monolito | store principal v34 |
| `recepcao-smartfit-dashboard-sync-v34` | broadcast | sincronização cross-tab |
| `recepcao-smartfit-dashboard-v33` | store legado | fallback de migração |
| `recepcao-smartfit-dashboard-v24` | store legado | fallback de migração |
| `controle_recepcao_app_snapshot_v34` | snapshot local | restauração rápida |
| `controle_recepcao_app_snapshot_v33` | snapshot legado | fallback |
| `controle_recepcao_app_report_v34` | diagnóstico | relatório de sistema |
| `controle_recepcao_app_report_v33` | diagnóstico legado | fallback |
| `controle_recepcao_app_flowtests_v34` | autoteste | smoke tests de fluxo |
| `controle_recepcao_app_flowtests_v33` | autoteste legado | fallback |
| `controle_recepcao_app_ui_v34` | UI state | aba/filtros persistidos |
| `controle_recepcao_app_ui_v33` | UI state legado | fallback |

## Legacy Period Payload

| Campo | Tipo | Regra |
|---|---|---|
| `settings` | object | configurações do período |
| `students` | array | alunos/atendimentos |
| `pending` | array | pendências |
| `recados` | array | recados |
| `nps` | object | score, metas, menções |
| `scale` | array | escala atual |
| `events` | array | eventos atual |
| `addons` | object | vendas por pessoa/tipo/dia |
| `escala` | array | alias antigo aceito |
| `eventos` | array | alias antigo aceito |

Regra: payload de período único legado é encapsulado no mês inicial atual durante coerção/importação.

## Legacy Month Archive Payload

| Campo | Tipo | Regra |
|---|---|---|
| `meta.kind` | string | `month-archive` |
| `meta.exportedAt` | ISO datetime | data de exportação |
| `version` | number | versão do store |
| `periodKey` | string | período `YYYY-MM` |
| `periodLabel` | string | label humano |
| `data` | PeriodData | dados do período fechado |

Regra: importação de `month-archive` preserva demais períodos e marca o período importado como fechado em `archives`.

## Test Harness — loadRealApp

| Campo | Tipo | Regra |
|---|---|---|
| `window` | Happy DOM Window | ambiente browser simulado |
| `setStore(store)` | async function | sincroniza store e salva em modo silencioso |
| `cleanup()` | function | fecha window e restaura globais |
| `appEnv` | object | sobrescreve `window.__APP_ENV__` |

Regra: scripts locais do `index.html` são carregados em ordem; CDN e `env.js` são ignorados.

## Test Store Seed

| Campo | Tipo | Regra |
|---|---|---|
| `version` | number | `STORE_VERSION` do app |
| `activePeriod` | string | período alvo |
| `periods` | Object<string, PeriodData> | períodos seedados |
| `archives` | object | arquivos fechados |

Uso: E2E cria stores vazios ou com massa determinística antes dos fluxos.

## Visual Snapshot

| Campo | Tipo | Regra |
|---|---|---|
| `spec` | string | spec Playwright dono |
| `viewport` | string | desktop/laptop/tablet/mobile conforme cenário |
| `state` | string | estado visual renderizado |
| `png` | file | snapshot esperado |

Regra: 120 snapshots PNG protegem regressão visual de abas e estados principais.

## Supabase Test Mock

| Campo | Tipo | Regra |
|---|---|---|
| `createClient()` | function | retorna client mockado |
| `auth.getSession()` | function | retorna sessão autenticada falsa |
| `from('unit_members')` | function | retorna membership admin |
| `rpc(fn, params)` | mock | simula RPCs de checkpoint/import |

Uso: `runtime-env.test.js` valida sync e conflitos sem rede real.
