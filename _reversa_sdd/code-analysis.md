# Análise de Código Reversa — Gestão interna de academias

Gerado em: 2026-05-02T17:05:27Z

## Escopo Atual

Este documento é incremental. No momento contém a análise detalhada do módulo `src/core`, incluindo `src/main.js` e `sw.js`, porque esses arquivos participam diretamente do bootstrap e da infraestrutura central.

## Módulo `src/core`

### Propósito

🟢 **CONFIRMADO** — `src/core` implementa o núcleo técnico do SPA: configuração global, estado raiz, geração de dados, schema/migração, persistência local, backup/importação, lifecycle mensal, integração Supabase, observabilidade e PWA.

Arquivos principais:

- `src/core/config.js`
- `src/core/env-bootstrap.js`
- `src/core/storage.js`
- `src/core/schema.js`
- `src/core/period-builder.js`
- `src/core/seed.js`
- `src/core/backup.js`
- `src/core/lifecycle.js`
- `src/core/supabase.js`
- `src/core/observability.js`
- `src/core/pwa.js`
- `src/main.js`
- `sw.js`

### Fluxo de Controle Principal

1. `index.html` carrega `src/core/env-bootstrap.js` antes de `config.js`.
2. `env-bootstrap.js` cria defaults seguros em `window.__APP_ENV__` e só tenta carregar `env.js` em runtime local.
3. `config.js` define constantes globais, `APP_DEFAULTS`, chaves de storage e variáveis globais `storage`, `currentPeriodKey`, `state`.
4. Módulos posteriores adicionam funções ao escopo global clássico.
5. `src/main.js` congela `APP_INTERNALS`, expõe `window.__APP_INTERNALS__` e inicializa o app no `DOMContentLoaded`.
6. `initializeApp()` hidrata storage, sincroniza estado, configura UI, renderiza todas as áreas, sincroniza controles de período e executa diagnóstico silencioso.
7. `src/core/pwa.js` registra `sw.js` depois do shell e gerencia atualização/offline.

### Algoritmos e Regras Centrais

#### Persistência local híbrida

🟢 **CONFIRMADO** — `src/core/storage.js` usa IndexedDB como persistência principal, `localStorage` como espelho/fallback e `Map` em memória como cache síncrono.

Componentes:

- `storageCache`: cache em memória por chave.
- `idbOpenPromise`: singleton de conexão IndexedDB.
- `storageOperationQueue`: fila serializada para gravações/remoções.
- `STORAGE_BROADCAST_KEY`: sinalização cross-tab via `localStorage`.

Regras:

- Gravações passam por `queueStorageOperation()` para evitar corrida.
- `persistStoredValue()` tenta IndexedDB primeiro; se funcionar, atualiza cache e espelho localStorage.
- Sem IndexedDB, tenta localStorage como backend primário.
- Quota e falhas locais geram toast/estado de erro em vez de exception não tratada.
- `hydrateStorageCache()` lê chaves conhecidas atuais e legadas.

#### Pipeline de schema e migração

🟢 **CONFIRMADO** — `prepareStoreCandidate()` em `backup.js` centraliza validação: clona, migra, sanitiza e força `STORE_VERSION`.

Regras:

- `STORE_VERSION = 4`.
- `migrateStore()` executa V0→V1→V2→V3→V4 de forma sequencial.
- Migrações V2/V3/V4 atualmente são bumps/placeholder; campos são completados por `normalizeData()`.
- `sanitizeStore()` aceita store multi-período e formato legado de período único.
- Store sem período ativo válido cai para `getInitialPeriodKey()`.
- Períodos inválidos são removidos.
- Anos são preenchidos com `seedYear()` se necessário.

#### Modelo mensal e bloqueio de período

🟢 **CONFIRMADO** — `src/core/lifecycle.js` implementa o ciclo mensal.

Regras:

- `storage.activePeriod` aponta para `currentPeriodKey`.
- Cada período vive em `storage.periods[YYYY-MM]`.
- `storage.archives[YYYY-MM]` torna o mês somente leitura.
- `LOCKED_CURRENT_PERIOD_*` lista ações/inputs bloqueados quando o mês está fechado ou quando Supabase está em modo somente leitura.
- `closePeriod()` exporta fechamento, marca archive e avança para o próximo mês.
- Se o próximo mês já contém dados, o usuário escolhe entre zerar ou preservar.
- `resetPeriod()` exporta backup antes de apagar dados do mês atual.

#### Backup e importação

🟢 **CONFIRMADO** — `backup.js` aceita três famílias de payload:

- `app-backup`: backup completo com `periods`, `archives`, `preferences`.
- `month-archive`: fechamento de mês único.
- Legado: payload com campos de `PeriodData` sem wrapper multi-período.

Regras:

- Import passa por `sanitizeDeep()`, `coerceImportedStore()` e `prepareStoreCandidate()`.
- Import de `month-archive` mescla apenas o período informado e marca archive.
- Import completo substitui o store inteiro após confirmação.
- Antes de aplicar import, `importBackup()` chama `exportBackup()` para gerar backup preventivo.
- Erros de leitura/validação/aplicação são capturados via `captureError()` quando Sentry está disponível.

#### Supabase local-first guardado

🟢 **CONFIRMADO** — `src/core/supabase.js` mantém o app operacional mesmo sem env, SDK, sessão ou permissões.

Regras:

- `isSupabaseEnabled()` exige env público e SDK browser.
- `getSupabaseClient()` cria singleton e vincula listener de auth.
- `refreshSupabaseBackendState()` resolve sessão, usuário, memberships, unidade ativa e permissão de escrita.
- Escrita remota só ocorre para roles `admin` e `gestor`.
- `loadStoreFromSupabase()` consulta tabelas por período e remonta `PeriodData` local com `mapSupabasePeriodToLocal()`.
- `saveStoreToSupabase()` envia `app-backup` para RPC `import_backup_transaction_guarded`.
- Checkpoint remoto impede sobrescrever backend já populado sem baseline local.
- Conflitos atualizam `conflictStatus` e não quebram store local.
- `queueSupabaseStoreSync()` debounces sync remota; eventos críticos podem syncar imediatamente.

#### Service Worker e cache

🟢 **CONFIRMADO** — `sw.js` cria cache versionado por hash do manifesto e hash de conteúdo dos assets.

Regras:

- CDNs são network-only.
- `env.js` nunca é servido de cache.
- Navegações e app shell usam network-first com fallback para `index.html`.
- Assets locais estáveis usam cache-first.
- Caches antigos com prefixo `wpm-` são limpos no `activate`.

### Funções Principais

| Função | Arquivo | Parâmetros | Retorno | Confiança |
|---|---|---|---|---|
| `initializeApp` | `src/main.js` | nenhum | `Promise<void>` | 🟢 |
| `exposeAppInternals` | `src/main.js` | nenhum | `Readonly<Object>` | 🟢 |
| `hydrateStorageCache` | `src/core/storage.js` | nenhum | `Promise<void>` | 🟢 |
| `persistStoredValue` | `src/core/storage.js` | `key`, `value`, `onQuotaMessage`, `options` | `Promise<PersistenceResult>` | 🟢 |
| `removeStoredValue` | `src/core/storage.js` | `key` | `Promise<boolean>` | 🟢 |
| `prepareStoreCandidate` | `src/core/backup.js` | `storeLike` | `AppStore|null` | 🟢 |
| `loadStore` | `src/core/backup.js` | `options` | `Promise<AppStore>` | 🟢 |
| `saveStore` | `src/core/backup.js` | `storeLike`, `options` | `Promise<boolean>` | 🟢 |
| `saveData` | `src/core/backup.js` | `options` | `Promise<boolean>` | 🟢 |
| `coerceImportedStore` | `src/core/backup.js` | `source` | `AppStore|null` | 🟢 |
| `applyImportedStore` | `src/core/backup.js` | `parsed`, `options` | `Promise<BackupSummary>` | 🟢 |
| `normalizeStore` | `src/core/schema.js` | `store` | `AppStore` | 🟢 |
| `sanitizeStore` | `src/core/schema.js` | `parsed` | `AppStore|null` | 🟢 |
| `normalizeData` | `src/core/lifecycle.js` | `data` | `void` | 🟢 |
| `closePeriod` | `src/core/lifecycle.js` | nenhum | `void` | 🟢 |
| `switchPeriod` | `src/core/lifecycle.js` | `key`, `options` | `Promise<void>` | 🟢 |
| `generatePeriodSeed` | `src/core/seed.js` | `periodKey`, `template` | `PeriodData` | 🟢 |
| `mapSupabasePeriodToLocal` | `src/core/supabase.js` | linhas remotas por domínio | `PeriodData` | 🟢 |
| `saveStoreToSupabase` | `src/core/supabase.js` | `storeLike` | `Promise<Object>` | 🟢 |
| `queueSupabaseStoreSync` | `src/core/supabase.js` | `storeLike`, `options` | `Promise<Object>` | 🟢 |
| `initSentry` | `src/core/observability.js` | nenhum | `boolean` | 🟢 |

### Estruturas de Dados Manipuladas

O núcleo manipula diretamente:

- `AppStore`
- `PeriodData`
- `PeriodSettings`
- `Student`
- `PendingItem`
- `Recado`
- `NpsData`
- `NpsMention`
- `ScaleEntry`
- `ProfessorShift`
- `EventItem`
- `ArchiveEntry`
- `StorePreferences`
- `PersistenceTechState`
- `supabaseBackendState`

Detalhes completos estão em `_reversa_sdd/data-dictionary.md`.

### Pontos de Complexidade

- `normalizeData()` é um migrador de período e normalizador de entidades em uma única função.
- `saveStore()` faz persistência local, broadcast e orquestra tentativa de sync remota.
- `mapSupabasePeriodToLocal()` reconstrói todo o modelo local a partir de múltiplas tabelas remotas.
- `closePeriod()` mistura export de fechamento, archive, criação/reset do próximo período e rollback parcial se persistência falhar.
- `sw.js` deriva cache por conteúdo, reduzindo risco de cache antigo preso.

### Lacunas

- 🔴 **LACUNA** — `STORE_VERSION = 4` possui comentário de placeholder para migração real futura; é preciso validar se algum campo incompatível já deveria ter transformação explícita.
- 🔴 **LACUNA** — Política de retenção de snapshots/backups locais não aparece como regra formal no core.
- 🟡 **INFERIDO** — `Legacy/` é fonte histórica da modularização, não runtime atual.

## Módulo `src/domain`

### Propósito

🟢 **CONFIRMADO** — `src/domain/selectors.js` centraliza seletores derivados e KPIs do estado operacional. Ele não persiste dados nem renderiza DOM; consome `state`, `storage`, `currentPeriodKey` e helpers globais para produzir objetos de dashboard, filtros, rankings e resumos.

Arquivo principal:

- `src/domain/selectors.js`

### Fluxo de Controle

1. Uma chamada de UI/diagnóstico pede um selector, por exemplo `selecionarIndicadoresDashboard()`.
2. O selector monta uma assinatura JSON com os pedaços de estado que afetam seu resultado.
3. `lerSelectorMemorizado()` compõe a chave com `currentPeriodKey`, nome do selector e assinatura.
4. Se a chave existe em `cacheSelectores`, retorna o valor memoizado.
5. Caso contrário, calcula, grava em cache e retorna.
6. Se o cache passar de 120 entradas, limpa tudo e reinsere o resultado atual.
7. `limparCacheSelectores()` é chamado em mutações relevantes no core antes de re-renderizar.

### Selectors e Algoritmos

#### Memoização por assinatura

🟢 **CONFIRMADO** — O cache é um `Map` global. A assinatura é `JSON.stringify(partes)`, suficiente para estruturas serializáveis de estado.

Risco/observação:

- 🟡 **INFERIDO** — A estratégia privilegia simplicidade sobre performance para estados muito grandes; arrays inteiros entram na assinatura de alguns selectors.

#### Addons

- `selecionarTotaisAddons()` soma matriz `state.addons[pessoa][tipo][dia]`.
- Inclui tipos atuais de `settings.addonTypes` e chaves históricas já existentes no grupo.
- Retorna `porPessoa`, `porPessoaTipo` e `totalGeral`.

#### Recepção

- `selecionarResumoRecepcionistas()` calcula total de alunos, feedbacks, NPS avisado, volume de addon, taxa de feedback, taxa de addon, taxa positiva e diferença contra taxa global.
- Depende de `getReceptionists(state)` e `selecionarTotaisAddons()`.

#### Pendências

- `selecionarResumoPendencias()` conta status `aberto`, `respondido`, `concluido`, ordena itens do dashboard e identifica a pendência aberta mais antiga.
- `selecionarPendenciasFiltradas()` filtra por busca textual normalizada e agrupa por status.

#### NPS

- `selecionarRankingNps()` ordena menções com `sortNpsMentionsByRanking()`, compara contra `rankSnapshot` e produz tendência `new`, `up`, `down` ou `stable`.
- Retorna ranking, total de citações, top e mapa posição por id.

#### Dashboard

- `selecionarHistoricoDashboard()` monta janela dos últimos meses a partir de `currentPeriodKey`.
- `selecionarDadosGraficosDashboard()` consolida histórico, atendimentos por recepcionista, distribuição de feedback e ranking de addons.
- `selecionarIndicadoresDashboard()` agrega todos os KPIs principais em um objeto único para renderização.

#### Escala e eventos

- `selecionarResumoEscala()` conta dias escalados, cobertura de recepção, professores lançados, trocas e fins de semana/atenção.
- `selecionarDadosEventosAgrupados()` agrupa eventos filtrados por dia, totaliza próximos/confirmados/concluídos e calcula próximo evento.

### Funções Principais

| Função | Parâmetros | Retorno | Confiança |
|---|---|---|---|
| `limparCacheSelectores` | nenhum | `void` | 🟢 |
| `lerSelectorMemorizado` | `chave`, `assinatura`, `calcular` | qualquer valor selector | 🟢 |
| `selecionarTotaisAddons` | nenhum | `AddonTotals` | 🟢 |
| `selecionarResumoRecepcionistas` | nenhum | `ReceptionistSummary[]` | 🟢 |
| `selecionarResumoPendencias` | nenhum | `PendingSummary` | 🟢 |
| `selecionarPendenciasFiltradas` | nenhum | linhas + grupos por status | 🟢 |
| `selecionarRankingNps` | nenhum | `NpsRankingResult` | 🟢 |
| `selecionarDadosEventosAgrupados` | nenhum | resumo/lista/eventos por dia | 🟢 |
| `selecionarResumoEscala` | nenhum | resumo operacional de escala | 🟢 |
| `selecionarHistoricoDashboard` | `limite` | `DashboardHistoryPoint[]` | 🟢 |
| `selecionarDadosGraficosDashboard` | `limite` | datasets de gráficos | 🟢 |
| `selecionarIndicadoresDashboard` | nenhum | `DashboardIndicators` | 🟢 |

### Entidades Derivadas

- `AddonTotals`
- `ReceptionistSummary`
- `PendingSummary`
- `NpsRankingResult`
- `DashboardHistoryPoint`
- `DashboardIndicators`

### Pontos de Complexidade

- `selecionarIndicadoresDashboard()` orquestra múltiplos selectors e helpers, sendo o principal agregador da tela inicial.
- `selecionarRankingNps()` implementa comparação temporal por snapshot de posição.
- `selecionarLideresHistoricos()` percorre períodos passados e calcula líderes de addon/NPS sem depender do estado atual.

### Lacunas

- 🔴 **LACUNA** — Tipos `DashboardIndicators`, `DashboardHistoryPoint` e `PendingSummary` são usados/documentados em comentários, mas não aparecem completos em `src/types.js` no trecho analisado.

## Módulo `src/features`

### Propósito

🟢 **CONFIRMADO** — `src/features` implementa ações de negócio e operações transacionais acionadas pela UI: validação e salvamento de formulários, CRUD genérico, vínculo aluno-addon, ranking NPS, exportação CSV, autotestes e dry-run/migração assistida.

Arquivos principais:

- `src/features/forms.js`
- `src/features/crud.js`
- `src/features/nps.js`
- `src/features/csv.js`
- `src/features/diagnostics.js`

### Fluxos Principais

#### Salvamento CRUD

1. Evento de UI chama `saveStudent`, `savePending` ou `saveEventItem`.
2. Handler vem de `createCrudHandler(config)`.
3. Handler verifica `assertWritableCurrentPeriod()`.
4. Captura `previousState`.
5. Lê dados do DOM via `get*FormData()`.
6. Aplica validação e upsert puro via `apply*Save()`.
7. Se houver erro, chama `apresentarErroValidacao()`.
8. Se houver confirmação de duplicidade, pede confirmação.
9. Persiste via `saveData()`.
10. Em falha de persistência, restaura `previousState`.
11. Em sucesso, finaliza UI, renderiza UI local e agenda targets.

#### Vínculo aluno-addon

🟢 **CONFIRMADO** — Ao salvar aluno, `handleSaveStudent` remove o contador de addon do registro anterior e incrementa o contador do novo registro.

Regra:

- O dia usado vem de `student.inicio || student.ultimaVisita || getActivePeriodFallbackDate()`.
- O índice é clampado entre 1 e `state.settings.monthDays`.
- Delta nunca deixa o contador abaixo de zero.

#### Validação de formulários

Regras confirmadas:

- Aluno exige `nome`.
- Matrícula, quando preenchida, deve conter apenas dígitos.
- Pendência exige `nome` e `pendencia`.
- Data de pendência/evento, quando válida, deve pertencer ao período ativo.
- Evento exige `date` e `title`.
- Escala coleta turnos professorais de `scaleShiftDrafts` e remove linhas vazias.
- Configurações deduplicam recepcionistas, professores e tipos de addon.

#### NPS

- `registerMention()` cria nova menção ou incrementa menção existente case-insensitive.
- Ajuste, set, rename e remove capturam snapshot de ranking antes da mutação.
- Todas as mutações respeitam período fechado/read-only.
- Observações NPS são persistidas via `saveData()`.

#### CSV

- `downloadCsvFile()` gera CSV com BOM UTF-8.
- Pendências, escala e eventos são ordenados por `compareByDateTime`.
- Escala expande múltiplos `professorShifts` em múltiplas linhas.

#### Diagnósticos e Migração

🟢 **CONFIRMADO** — `diagnostics.js` inclui dois blocos maiores:

- Smoke tests de fluxo: backup JSON, CSVs, reset simulado, cobertura anual.
- Migração Supabase: snapshot de contagens locais/remotas, comparação por período/entidade, readiness, painel de homologação e migração assistida.

Regras de migração:

- Dry-run não altera o estado real.
- Recados legados são consolidados em clone.
- Migração exige backend autenticado e perfil gravável.
- Backend vazio libera primeira migração.
- Backend presente exige comparação consistente sem divergências.
- Migração assistida prepara store local, salva snapshot, sincroniza remoto e recarrega do Supabase quando possível.

### Funções Principais

| Função | Arquivo | Retorno | Confiança |
|---|---|---|---|
| `createCrudHandler` | `src/features/crud.js` | `function(): Promise<void>` | 🟢 |
| `getStudentAddonLink` | `src/features/crud.js` | link pessoa/tipo/dia ou `null` | 🟢 |
| `applyStudentAddonLink` | `src/features/crud.js` | `void` | 🟢 |
| `validateStudent` | `src/features/forms.js` | `ValidationResult` | 🟢 |
| `validatePending` | `src/features/forms.js` | `ValidationResult` | 🟢 |
| `validateEvent` | `src/features/forms.js` | `ValidationResult` | 🟢 |
| `applyStudentSave` | `src/features/forms.js` | `SaveResult` | 🟢 |
| `applyPendingSave` | `src/features/forms.js` | `SaveResult` | 🟢 |
| `applyEventSave` | `src/features/forms.js` | `SaveResult` | 🟢 |
| `registerMention` | `src/features/nps.js` | `void` | 🟢 |
| `downloadCsvFile` | `src/features/csv.js` | CSV string | 🟢 |
| `runFlowSmokeTests` | `src/features/diagnostics.js` | `FlowSmokeReportItem[]` | 🟢 |
| `runMigrationDryRun` | `src/features/diagnostics.js` | `Promise<Object>` | 🟢 |
| `getMigrationReadiness` | `src/features/diagnostics.js` | status de prontidão | 🟢 |
| `runAssistedMigrationToSupabase` | `src/features/diagnostics.js` | `Promise<Object>` | 🟢 |

### Pontos de Complexidade

- `createCrudHandler()` encapsula transação UI/estado/persistência/rollback para três entidades.
- `runMigrationDryRun()` combina store local, recados legados e comparação remota opcional.
- `getMigrationReadiness()` implementa gate operacional de migração.
- `runAssistedMigrationToSupabase()` orquestra preflight, preparação local, backup, sync remoto e reload.

### Lacunas

- 🟡 **INFERIDO** — `diagnostics.js` mistura lógica de domínio, renderização HTML de painéis e orquestração de migração; em documentação futura, vale separar responsabilidades conceituais.

## Módulo `src/ui`

### Escopo

🟢 **CONFIRMADO** — `src/ui` concentra a camada visual e interativa do SPA: renderização de seções, delegação de eventos, modais, toasts, acessibilidade, filtros de visão, quadros operacionais, gráficos Chart.js, recados, formulários e painéis de configuração.

Arquivos analisados:

- `src/ui/render-core.js`
- `src/ui/events-core.js`
- `src/ui/back-to-top.js`
- `src/ui/events-addons.js`
- `src/ui/events-nps.js`
- `src/ui/events-pending.js`
- `src/ui/events-scale.js`
- `src/ui/events-students.js`
- `src/ui/render-addons.js`
- `src/ui/render-dashboard.js`
- `src/ui/render-events.js`
- `src/ui/render-nps.js`
- `src/ui/render-pending.js`
- `src/ui/render-scale.js`
- `src/ui/render-settings.js`
- `src/ui/render-students.js`

### Fluxo de Controle

🟢 **CONFIRMADO** — A inicialização do app chama controles estáticos, bindings de UI e renderização inicial. Depois disso, a UI opera em dois circuitos principais:

1. Eventos do DOM são centralizados em `bindUIEvents()` e distribuídos por `dispatchUiBinding()` para handlers declarados em objetos de binding.
2. Mudanças de estado chamam `requestRender()`, que agenda renderização por `requestAnimationFrame` e processa apenas áreas marcadas como sujas.

O mapa `RENDER_MAP` conecta alvos lógicos a funções específicas:

- `hero`
- `dashboard`
- `students`
- `addons`
- `pending`
- `scale`
- `nps`
- `events`
- `settings`
- `backup`
- `diagnostics`
- `support`

### Render Scheduler

🟢 **CONFIRMADO** — `requestRender(alvos)` normaliza os alvos, adiciona cada alvo ao conjunto `estadoRenderizacao.sujas` e agenda `executarRenderAgendado()` quando não há render pendente.

`executarRenderAgendado()`:

- percorre a fila de áreas sujas;
- executa `renderSection(alvo)` para cada área;
- registra falhas com `console.error`;
- chama `syncCurrentPeriodLockUI()` ao final;
- reagenda se novas áreas forem marcadas durante a renderização.

Esse desenho reduz renders redundantes e evita redesenhar toda a página após cada evento simples.

### Patching DOM e Foco

🟢 **CONFIRMADO** — `aplicarHtmlSeMudou()`, `aplicarPatchPorChave()`, `aplicarPatchLinhas()` e `aplicarPatchCards()` atualizam HTML somente quando o hash muda e tentam preservar foco/seleção por seletor reconstruído de `id`, `data-*`, `name`, classe ou tag.

Regra importante:

- `aplicarPatchLinhas()` usa `innerHTML` para linhas de tabela e registra no comentário que as linhas já chegam escapadas e controladas pela aplicação.

### Eventos e Acessibilidade

🟢 **CONFIRMADO** — `events-core.js` evita binding duplicado por flags em `estadoEventos` e agrupa:

- modais (`openModal`, `closeModal`);
- toasts e live regions (`showToast`, `showSaveToast`, `anunciarAoLeitor`);
- confirmação (`showConfirm`, `_resolveConfirm`);
- atalhos globais;
- sincronização entre abas via `storage`;
- navegação por abas com teclado;
- foco do modal e fechamento por backdrop;
- tooltips;
- controles Supabase e migração assistida.

`estadoAcessibilidade` mantém preferências de movimento reduzido, alto contraste, foco visível e anúncios.

### Renderizadores Operacionais

🟢 **CONFIRMADO** — Os renderizadores combinam selectors de domínio, filtros de visão e helpers de formatação/escape:

- `renderStudents()` monta tabela de alunos, filtros, campos inline e ações de edição/remoção.
- `renderPending()` monta tabela e kanban de pendências, incluindo restauração de foco após drag/drop.
- `renderAddons()` monta totais e matriz de vendas por pessoa/tipo/dia.
- `renderScale()` monta tabela, quadro mensal, cobertura operacional e edição de turnos.
- `renderNps()` monta score, metas, ranking, tendência e histórico.
- `renderEvents()` monta calendário mensal, lista, cards de resumo e tabela.
- `renderSettings()` monta configurações, saúde local, backup, diagnóstico, persistência e painel Supabase.

### Dashboard, Gráficos e Recados

🟢 **CONFIRMADO** — `render-dashboard.js` concentra:

- hero operacional;
- KPIs do dashboard;
- montagem/destruição de gráficos Chart.js;
- fallback de gráficos vazios;
- recados por período;
- migração de recados legados de `localStorage`;
- badge e painel de recados.

O ciclo de gráficos usa registry `dashboardChartInstances` para destruir instâncias antigas antes de renderizar novas, evitando sobreposição de canvas.

### Regras de Negócio na UI

- Render targets válidos são limitados a `AREAS_RENDERIZACAO`.
- Bindings de eventos devem ser idempotentes por `estadoEventos`.
- Filtros de visão são persistidos em `state.ui` por `saveUIState()`.
- Modais preservam o foco de retorno quando fechados.
- Pendências podem mudar de status por drag/drop ou teclado, desde que o período não esteja bloqueado.
- Observações NPS usam autosave com debounce de 800ms.
- Escala permite múltiplos turnos de professor por dia via `scaleShiftDrafts`.
- Recados legados são normalizados, mesclados e migrados para o store por período.

### Funções Principais

| Função | Arquivo | Retorno | Confiança |
|---|---|---|---|
| `renderAll` | `src/ui/render-core.js` | `void` | 🟢 |
| `requestRender` | `src/ui/render-core.js` | `void` | 🟢 |
| `executarRenderAgendado` | `src/ui/render-core.js` | `void` | 🟢 |
| `aplicarPatchPorChave` | `src/ui/render-core.js` | `void` | 🟢 |
| `bindUIEvents` | `src/ui/events-core.js` | `void` | 🟢 |
| `dispatchUiBinding` | `src/ui/events-core.js` | `void` | 🟢 |
| `openModal` | `src/ui/events-core.js` | `void` | 🟢 |
| `showToast` | `src/ui/events-core.js` | `void` | 🟢 |
| `renderDashboardCharts` | `src/ui/render-dashboard.js` | `void` | 🟢 |
| `renderStudents` | `src/ui/render-students.js` | `void` | 🟢 |
| `renderPending` | `src/ui/render-pending.js` | `void` | 🟢 |
| `renderScale` | `src/ui/render-scale.js` | `void` | 🟢 |
| `renderNps` | `src/ui/render-nps.js` | `void` | 🟢 |
| `renderEvents` | `src/ui/render-events.js` | `void` | 🟢 |
| `renderSettings` | `src/ui/render-settings.js` | `void` | 🟢 |

### Pontos de Complexidade

- `src/ui` tem 4.557 linhas e mistura renderização, estado visual, acessibilidade e orquestração de ações.
- `events-core.js` é um hub amplo para eventos, Supabase, migração, atalhos, modal, toast e acessibilidade.
- `render-dashboard.js` acumula dashboard, gráficos e módulo de recados com migração legada.
- Renderizadores dependem fortemente de funções globais carregadas por scripts, sem import/export explícito.
- O patching DOM preserva foco, mas exige que HTML renderizado mantenha chaves/seletores estáveis.

### Lacunas

- 🟡 **INFERIDO** — A camada UI atua como cola entre domínio, features e core; uma separação futura por controladores de tela reduziria acoplamento.
- 🟡 **INFERIDO** — A migração de recados em `render-dashboard.js` é comportamento de persistência localizado em arquivo de renderização, o que aumenta risco de regressão visual afetar dados.

## Módulo `src/utils`

### Escopo

🟢 **CONFIRMADO** — `src/utils/helpers.js` é o módulo utilitário global do SPA. Ele é carregado antes de `main.js` e expõe funções no escopo browser clássico para sanitização, escape, clone, formatação, CSV, datas, períodos, estilos runtime compatíveis com CSP, ordenação e regras auxiliares de NPS/eventos.

Arquivo analisado:

- `src/utils/helpers.js` — 438 linhas.

### Segurança e Sanitização

🟢 **CONFIRMADO** — `esc(value)` faz escape HTML manual de caracteres perigosos:

- `&`
- `<`
- `>`
- `"`
- `'`
- `/`

`sanitizeHtml(html)` usa `DOMPurify.sanitize()` quando disponível, com listas explícitas de tags e atributos permitidos. Quando `DOMPurify` não existe, registra aviso e usa `esc(html)` como fallback.

`sanitizeDeep(value)` remove bytes nulos de strings, aplica `trim()` e percorre recursivamente arrays e objetos.

### Runtime Style e CSP

🟢 **CONFIRMADO** — O módulo evita depender de `style=""` inline em HTML renderizado. `applyRuntimeStyleData(root)` lê atributos `data-style-*` e aplica estilos dinâmicos por uma stylesheet dedicada marcada com `data-runtime-stylesheet`.

Fluxo:

1. Elementos renderizados recebem atributos como `data-style-width-pct`, `data-style-height-px` ou `data-style-left-pct`.
2. `applyRuntimeStyleData()` encontra esses elementos.
3. `setRuntimeStyle()` obtém uma `CSSStyleRule` via `ensureRuntimeStyleRule()`.
4. A regra é criada/recuperada no stylesheet runtime.
5. Largura, altura e posição são clampadas antes de entrar na regra CSS.

Essa lógica mantém compatibilidade com política `style-src 'self'`.

### Formatação, CSV e Texto

🟢 **CONFIRMADO** — Helpers de apresentação:

- `formatDate()` converte `YYYY-MM-DD` em `DD/MM/YYYY`.
- `formatPct()` e `formatPctPrecise()` formatam percentuais em pt-BR.
- `normalizeSearchText()` remove acentos e normaliza busca.
- `csvEscape()` escapa campos com aspas, ponto e vírgula ou vírgula.
- `buildCsvContent()` monta CSV separado por `;`.
- `shortText()` trunca texto longo com reticências.
- `formatBytes()` exibe B, KB ou MB.
- `formatPersistenceTimestamp()` exibe timestamps em `pt-BR`.

### Períodos e Datas Operacionais

🟢 **CONFIRMADO** — O módulo centraliza manipulação de períodos no formato `YYYY-MM`:

- `isValidPeriodKey()` valida ano/mês.
- `getPeriodLabel()` gera label como `Janeiro/2026`.
- `getPreviousPeriodKey()` e `getNextPeriodKey()` navegam entre meses.
- `isPastPeriodKey()` compara períodos válidos por ordem lexicográfica.
- `getInitialPeriodKey()` usa o mês corrente do navegador.
- `getPeriodPrefix()` retorna prefixo `YYYY-MM`.
- `getDefaultPeriodDate()` retorna primeiro dia do período ativo.
- `getActivePeriodFallbackDate()` usa hoje se hoje pertence ao período ativo, senão o primeiro dia.

Também inclui `getWeekdayLabel()`, `suggestScaleTone()`, `compareByDateTime()`, `eventStatusClass()`, `normalizeEventType()`, `isDateInActivePeriod()`, `getPeriodDisplayDate()` e `formatRecadoDateTime()`.

### NPS

🟢 **CONFIRMADO** — Regras auxiliares de NPS:

- `getNpsGoalProgress(score, goal)` calcula progresso percentual limitado a 100%.
- `sortNpsMentionsByRanking()` ordena menções por maior `count` e desempata por nome em `pt-BR`.
- `buildNpsRankSnapshot()` grava posições atuais por `id`.
- `normalizeNpsRankSnapshot()` remove ids inválidos e reconstrói snapshot quando há snapshot antigo sem correspondência.
- `getRiskBand(score)` classifica score em faixas: crítica, atenção, moderada, boa e excelente.
- `getNpsHistoryBandClass(score)` converte score em classe visual de histórico.

### Funções Principais

| Função | Arquivo | Retorno | Confiança |
|---|---|---|---|
| `esc` | `src/utils/helpers.js` | `string` | 🟢 |
| `sanitizeHtml` | `src/utils/helpers.js` | `string` | 🟢 |
| `applyRuntimeStyleData` | `src/utils/helpers.js` | `void` | 🟢 |
| `sanitizeDeep` | `src/utils/helpers.js` | valor sanitizado | 🟢 |
| `cloneSerializable` | `src/utils/helpers.js` | clone profundo | 🟢 |
| `clamp` | `src/utils/helpers.js` | `number` | 🟢 |
| `buildCsvContent` | `src/utils/helpers.js` | `string` | 🟢 |
| `normalizeSearchText` | `src/utils/helpers.js` | `string` | 🟢 |
| `isValidPeriodKey` | `src/utils/helpers.js` | `boolean` | 🟢 |
| `getPreviousPeriodKey` | `src/utils/helpers.js` | `string` | 🟢 |
| `getNextPeriodKey` | `src/utils/helpers.js` | `string` | 🟢 |
| `compareByDateTime` | `src/utils/helpers.js` | `number` | 🟢 |
| `normalizeEventType` | `src/utils/helpers.js` | `string` | 🟢 |
| `sortNpsMentionsByRanking` | `src/utils/helpers.js` | `NpsMention[]` | 🟢 |
| `normalizeNpsRankSnapshot` | `src/utils/helpers.js` | `Object<string, number>` | 🟢 |
| `getRiskBand` | `src/utils/helpers.js` | `RiskBand` | 🟢 |

### Pontos de Complexidade

- O módulo depende de globais como `DOMPurify`, `document`, `Element`, `currentPeriodKey`, `MONTH_NAMES` e `todayISO`.
- `sanitizeHtml()` permite um conjunto amplo de tags/atributos, incluindo `data-*`, `aria-*`, formulários e SVG.
- O runtime style cria regras CSS dinâmicas e mantém cache por `data-runtime-style-id`.
- Regras de período usam timezone/localidade em pontos diferentes: datas UTC para dia da semana e navegador para mês inicial.

### Lacunas

- 🟡 **INFERIDO** — Por estar no escopo global, alterações de assinatura em helpers podem causar regressões amplas em UI, features e core.
- 🟡 **INFERIDO** — `sanitizeHtml()` depende de DOMPurify externo; quando ausente, o fallback preserva segurança por escape, mas perde HTML permitido.

## Módulo `supabase`

### Escopo

🟢 **CONFIRMADO** — O diretório `supabase` contém a configuração local Supabase, seed de desenvolvimento e cinco migrações SQL que definem o backend canônico do WPM Gestão Interna.

Arquivos analisados:

- `supabase/config.toml`
- `supabase/seed.sql`
- `supabase/migrations/20260422190000_backend_canonical_schema.sql`
- `supabase/migrations/20260422194000_backend_transaction_rpcs.sql`
- `supabase/migrations/20260422203000_bootstrap_initial_admin.sql`
- `supabase/migrations/20260422224500_fix_addon_sales_unique_index.sql`
- `supabase/migrations/20260423090000_sync_checkpoint_guard.sql`

### Configuração Local

🟢 **CONFIRMADO** — `supabase/config.toml` define:

- `project_id = "wpm-gestao-interna"`
- API local na porta `54321`
- Postgres local na porta `54322`
- Studio na porta `54323`
- Inbucket na porta `54324`
- Postgres major version `17`
- seed habilitado via `./seed.sql`
- auth local com `site_url = "http://127.0.0.1:3000"`

### Modelo Canônico

🟢 **CONFIRMADO** — O schema remoto normaliza o store browser-only em tabelas relacionais:

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

As tabelas usam UUIDs, timestamps UTC, FKs com cascade/set null e triggers `set_updated_at` nos principais registros mutáveis.

### Papéis e RLS

🟢 **CONFIRMADO** — As funções auxiliares de autorização são:

- `current_unit_role(p_unit_id)`
- `current_unit_member_id(p_unit_id)`
- `has_unit_role(p_unit_id, p_roles)`
- `require_unit_role(p_unit_id, p_roles)`

Papéis existentes:

- `admin`
- `gestor`
- `recepcao`
- `professor`
- `leitura`

RLS está habilitado em todas as tabelas de negócio. Regra geral:

- todos os membros ativos da unidade podem ler dados operacionais;
- `admin` e `gestor` gerenciam períodos, configurações, addons, NPS, escala, eventos e auditoria;
- `recepcao` também gerencia atendimentos, vendas de addon e pendências;
- `professor` participa de recados/shift notes;
- `leitura` é leitura operacional;
- `audit_events` só pode ser lido por `admin`/`gestor`.

### RPCs Transacionais

🟢 **CONFIRMADO** — `20260422194000_backend_transaction_rpcs.sql` concentra operações críticas:

- `close_period_transaction()` fecha mês, audita e cria/resetta próximo período com template limpo.
- `reset_period_transaction()` limpa mês aberto e preserva metas NPS.
- `import_backup_transaction()` importa `month-archive`, `app-backup` ou `full-backup`.
- `replace_period_from_payload()` converte payload JSON local em tabelas relacionais.
- `link_student_attendance_addon_transaction()` cria/atualiza/remove venda derivada de atendimento.
- `apply_clean_period_template()` copia configurações, catálogo de addons e metas para próximo mês.
- `log_audit_event()` registra operações críticas.

`grant execute` libera as RPCs principais para `authenticated` e `service_role`, mas cada função sensível chama `require_unit_role()` internamente.

### Checkpoint de Sincronização

🟢 **CONFIRMADO** — `20260423090000_sync_checkpoint_guard.sql` adiciona:

- `get_unit_sync_checkpoint(p_unit_id)`
- `import_backup_transaction_guarded(p_unit_id, p_payload, p_expected_checkpoint)`

`get_unit_sync_checkpoint()` calcula uma revisão por unidade combinando `maxUpdatedAt`, contagem de períodos, contagem de linhas tocadas e contagem de auditoria.

`import_backup_transaction_guarded()`:

1. exige papel `admin` ou `gestor`;
2. usa `pg_advisory_xact_lock()` por unidade;
3. compara checkpoint esperado com checkpoint atual;
4. bloqueia import se houver divergência com erro `WPM_SYNC_CONFLICT`;
5. retorna checkpoint anterior e próximo checkpoint após import.

### Bootstrap e Seed

🟢 **CONFIRMADO** — `bootstrap_unit_admin()` cria/atualiza uma unidade, vínculo admin e período inicial. A função é restrita a `service_role`, `postgres` ou `supabase_admin`, recusa bootstrap se a unidade já tiver outro admin ativo e valida `p_period_key` no formato `YYYY-MM`.

`seed.sql` cria um usuário local:

- email: `dev.admin@wpm.local`
- senha documentada no seed: `Admin123!`
- unidade: `WPM Unidade Local`
- slug: `wpm-unidade-local`

### Regras de Domínio no Banco

- `periods.status` só aceita `open` ou `closed`.
- `period_settings.month_days` deve ficar entre `28` e `31`.
- `student_attendances.nps_notice_status` só aceita `Sim`, `Não` ou `Pendente`.
- `student_attendances.feedback_status` só aceita `Respondeu`, `Não respondeu` ou `Pendente`.
- `addon_sales.quantity` não pode ser negativa.
- `addon_sales.source` só aceita `manual` ou `student_attendance`.
- `pending_items.status` só aceita `aberto`, `respondido` ou `concluido`.
- `nps_mentions.count` não pode ser negativo.
- `nps_mentions.rank_position` deve ser nulo ou positivo.
- `scale_days.row_tone` só aceita `green`, `red` ou `neutral`.
- `events.status` só aceita `Programado`, `Confirmado`, `Concluído` ou `Cancelado`.

### Índice Único de Addons

🟢 **CONFIRMADO** — `addon_sales_unique_entry_idx` normaliza `NULL`, snapshots vazios e nomes em lower/trim para impedir duplicidade por:

- período;
- data;
- recepcionista;
- tipo de addon;
- origem;
- atendimento vinculado.

A migração `20260422224500_fix_addon_sales_unique_index.sql` derruba e recria esse índice, mantendo a mesma regra em uma etapa corretiva.

### Funções Principais

| Função | Arquivo | Retorno | Confiança |
|---|---|---|---|
| `set_updated_at` | `backend_canonical_schema.sql` | trigger | 🟢 |
| `handle_auth_user_created` | `backend_canonical_schema.sql` | trigger | 🟢 |
| `current_unit_role` | `backend_canonical_schema.sql` | `text` | 🟢 |
| `has_unit_role` | `backend_canonical_schema.sql` | `boolean` | 🟢 |
| `require_unit_role` | `backend_transaction_rpcs.sql` | `uuid` | 🟢 |
| `replace_period_from_payload` | `backend_transaction_rpcs.sql` | `void` | 🟢 |
| `close_period_transaction` | `backend_transaction_rpcs.sql` | `jsonb` | 🟢 |
| `reset_period_transaction` | `backend_transaction_rpcs.sql` | `jsonb` | 🟢 |
| `import_backup_transaction` | `backend_transaction_rpcs.sql` | `jsonb` | 🟢 |
| `link_student_attendance_addon_transaction` | `backend_transaction_rpcs.sql` | `jsonb` | 🟢 |
| `bootstrap_unit_admin` | `bootstrap_initial_admin.sql` | table ids | 🟢 |
| `get_unit_sync_checkpoint` | `sync_checkpoint_guard.sql` | `jsonb` | 🟢 |
| `import_backup_transaction_guarded` | `sync_checkpoint_guard.sql` | `jsonb` | 🟢 |

### Pontos de Complexidade

- `replace_period_from_payload()` é o maior adaptador local-remoto: converte `settings`, `students`, `pending`, `recados`, `nps`, `scale`, `events` e `addons` para tabelas.
- `import_backup_transaction()` pode apagar períodos remotos que não existem no backup completo.
- O modelo combina FK relacional com snapshots textuais para preservar nomes históricos mesmo quando membro/tipo não resolve.
- `security definer` exige cuidado contínuo com `search_path`, grants e checks internos.
- O checkpoint remoto depende de contagens e timestamps, não de hash completo do conteúdo.

### Lacunas

- 🟡 **INFERIDO** — O schema remoto ainda não representa leitura individual de recados; comentário em `shift_notes` indica etapa posterior.
- 🟡 **INFERIDO** — Como `import_backup_transaction()` substitui períodos, o guard de checkpoint é o principal freio contra sobrescrita remota acidental.

## Módulo `Legacy`

### Escopo

🟢 **CONFIRMADO** — A pasta `Legacy` contém o snapshot histórico da aplicação antes da modularização atual:

- `Legacy/SISTEMA_FINALIZADO.html` — HTML/CSS/JS monolítico, 12.882 linhas.
- `Legacy/app.js` — JavaScript extraído do monólito, 6.829 linhas.

O `index.html` atual carrega scripts em `src/` e não carrega arquivos de `Legacy`. Portanto, este módulo é referência histórica e fonte de rastreabilidade, não runtime ativo.

### Papel Arquitetural

🟢 **CONFIRMADO** — O comentário inicial de `Legacy/app.js` documenta a arquitetura original em oito camadas dentro de um único script:

1. constantes/configuração;
2. armazenamento/persistência;
3. schema/migração/sanitização;
4. lógica de domínio/selectors;
5. transições de estado/ações;
6. renderização;
7. controladores de UI/eventos;
8. diagnósticos/helpers de teste.

Essas camadas correspondem, no estado atual, aos módulos `src/core`, `src/domain`, `src/features`, `src/ui` e `src/utils`.

### Legado de Persistência

🟢 **CONFIRMADO** — O legado usa as mesmas famílias de chaves que o runtime atual ainda reconhece para migração:

- `recepcao-smartfit-dashboard-v34`
- `recepcao-smartfit-dashboard-sync-v34`
- `recepcao-smartfit-dashboard-v33`
- `recepcao-smartfit-dashboard-v24`
- `controle_recepcao_app_snapshot_v34`
- `controle_recepcao_app_snapshot_v33`
- `controle_recepcao_app_report_v34`
- `controle_recepcao_app_report_v33`
- `controle_recepcao_app_flowtests_v34`
- `controle_recepcao_app_flowtests_v33`
- `controle_recepcao_app_ui_v34`
- `controle_recepcao_app_ui_v33`

O armazenamento original já combinava IndexedDB, cache em memória, espelho `localStorage` e broadcast cross-tab.

### Migração e Compatibilidade

🟢 **CONFIRMADO** — `Legacy/app.js` contém as mesmas famílias de compatibilidade que depois foram separadas em módulos:

- `migrateStoreToV1..V4()`
- `sanitizeStore()`
- `prepareStoreCandidate()`
- `loadStore()`
- `saveStore()`
- `isLegacyPeriodPayload()`
- `isMonthArchivePayload()`
- `buildStoreFromMonthArchivePayload()`
- `coerceImportedStore()`
- `applyImportedStore()`
- `migrateLegacyRecadosToStore()` via `syncAppState()`

Formato legado aceito para período único:

- `settings`
- `students`
- `pending`
- `recados`
- `nps`
- `scale`
- `events`
- `addons`
- aliases antigos `escala` e `eventos`

### Funcionalidades Embutidas no Monólito

🟢 **CONFIRMADO** — O monólito inclui, no mesmo arquivo, funcionalidades que hoje estão distribuídas:

- seed determinístico anual e mensal;
- persistência local híbrida;
- geração/importação/exportação de backup;
- fechamento e reset de mês;
- store multi-período com `archives`;
- CRUD de alunos, pendências e eventos;
- controle de addons por pessoa/tipo/dia;
- recados por período e migração de recados legados;
- ranking NPS e snapshots;
- escala com múltiplos turnos;
- calendário de eventos;
- render scheduler;
- modais, toasts e live regions;
- drag-and-drop de pendências;
- autotestes de fluxo e diagnóstico de sistema.

### Diferenças Relevantes Para o Estado Atual

🟢 **CONFIRMADO** — A aplicação atual evoluiu a partir desse legado:

- `SISTEMA_FINALIZADO.html` foi separado em `index.html`, `styles.css` e JS modular.
- O estado atual não usa `Legacy/app.js`; usa scripts sequenciais em `src/`.
- O service worker atual pré-cacheia `src/**/*.js`, não a pasta `Legacy`.
- As chaves antigas de storage continuam relevantes apenas para migração/limpeza.
- O legado permitia atributo `style` em `sanitizeHtml()`; o helper atual move estilos dinâmicos para runtime stylesheet, compatível com CSP.

### Funções Principais

| Função | Arquivo | Retorno | Confiança |
|---|---|---|---|
| `loadStore` | `Legacy/app.js` | `Promise<AppStore>` | 🟢 |
| `saveStore` | `Legacy/app.js` | `Promise<boolean>` | 🟢 |
| `normalizeData` | `Legacy/app.js` | `void` | 🟢 |
| `migrateStore` | `Legacy/app.js` | `AppStore|null` | 🟢 |
| `prepareStoreCandidate` | `Legacy/app.js` | `AppStore|null` | 🟢 |
| `generatePeriodSeed` | `Legacy/app.js` | `PeriodData` | 🟢 |
| `buildCleanPeriodFromTemplate` | `Legacy/app.js` | `PeriodData` | 🟢 |
| `buildBackupPayload` | `Legacy/app.js` | `Promise<Object>` | 🟢 |
| `coerceImportedStore` | `Legacy/app.js` | `AppStore|null` | 🟢 |
| `applyImportedStore` | `Legacy/app.js` | `Promise<BackupSummary>` | 🟢 |
| `runFlowSmokeTests` | `Legacy/app.js`/`SISTEMA_FINALIZADO.html` | `FlowSmokeReportItem[]` | 🟢 |
| `initializeApp` | `Legacy/app.js`/`SISTEMA_FINALIZADO.html` | `Promise<void>` | 🟢 |

### Pontos de Complexidade

- A versão legada mistura todo o ciclo do app em um script de 6.829 linhas.
- `SISTEMA_FINALIZADO.html` mistura estrutura, CSS e JS em um único artefato de 12.882 linhas.
- O legado é útil como baseline comportamental, mas arriscado como fonte runtime por estar duplicado/desatualizado em relação a `src/`.
- Os formatos antigos de backup e storage ainda precisam permanecer documentados porque o app atual aceita importações e chaves legadas.

### Lacunas

- 🟡 **INFERIDO** — `Legacy` deve permanecer somente como referência histórica; qualquer correção operacional deve ocorrer em `src/`.
- 🟡 **INFERIDO** — Se a pasta `Legacy` for publicada junto do app, pode confundir auditorias ou usuários técnicos, embora não seja carregada pelo `index.html` atual.

## Módulo `tests`

### Escopo

🟢 **CONFIRMADO** — A suíte de testes cobre o SPA em quatro camadas:

- Unitários Vitest em `tests/unit`.
- Integração Vitest em `tests/integration`.
- Helpers compartilhados em `tests/helpers`.
- E2E/visual Playwright em `tests/e2e`.

Arquivos de teste ativos:

- 12 arquivos Vitest (`tests/unit/*.test.js` + `tests/integration/*.test.js`).
- 6 arquivos Playwright (`tests/e2e/*.spec.js`).
- 3 helpers de teste.
- 120 snapshots PNG de regressão visual.
- 230 ocorrências de `test()`/`it()` mapeadas por busca textual.

### Configuração Vitest

🟢 **CONFIRMADO** — `vitest.config.js` define:

- ambiente `happy-dom`;
- includes `tests/unit/*.test.js` e `tests/integration/*.test.js`;
- cobertura V8;
- cobertura sobre `src/**/*.js`;
- exclusão de `node_modules/` e `tests/`;
- timeout de 10s.

### Configuração Playwright

🟢 **CONFIRMADO** — `playwright.config.js` define:

- `testDir = ./tests/e2e`;
- execução não paralela (`fullyParallel: false`);
- `workers: 1`;
- servidor local `python3 -m http.server 4173 --bind 127.0.0.1`;
- projeto Chromium;
- trace em primeira retentativa;
- screenshot somente em falha.

### Helpers

🟢 **CONFIRMADO** — `tests/helpers/load-real-app.js` lê o `index.html`, coleta scripts locais em ordem, ignora CDN/env.js, concatena os módulos e executa o app em `happy-dom`. O helper injeta globais como `window`, `document`, `localStorage`, `requestAnimationFrame`, `crypto.webcrypto` e `DOMPurify` mockado.

`tests/helpers/pure-functions.js` contém funções puras extraídas/espelhadas do app para testar:

- escape/sanitização;
- formatação;
- datas/períodos;
- NPS;
- validação;
- métricas de período.

`tests/helpers/fixed-browser-clock.js` estabiliza relógio de navegador para cenários visuais/E2E.

### Cobertura Unitária

🟢 **CONFIRMADO** — Unitários cobrem:

- `esc()` e proteção contra HTML ativo;
- formatadores e datas;
- validação de aluno/pendência/evento;
- métricas de período;
- NPS, metas e ranking;
- service worker config;
- segurança de config;
- selectors reais do app modularizado;
- XSS por entidade;
- runtime env, Supabase fallback/sync, migração assistida e observabilidade.

`runtime-env.test.js` é o ponto mais amplo de integração unitária com app real: valida defaults de `window.__APP_ENV__`, Supabase offline, criação de client, sync remoto, checkpoint guardado, conflitos, dry-run de migração, recados legados e Sentry condicional.

### Integração

🟢 **CONFIRMADO** — `tests/integration/flows.test.js` simula fluxos puros:

- cadastro de aluno;
- cadastro e status de pendência;
- NPS e ranking;
- navegação entre períodos;
- backup/importação com sanitização;
- métricas e detecção de período com dados.

Essa camada não depende do DOM real; ela valida contrato de negócio por helpers.

### E2E Funcional

🟢 **CONFIRMADO** — `tests/e2e/workflows.spec.js` executa fluxos reais no navegador:

- renderização das 8 abas sem erro de console;
- CRUD de alunos com validação, filtros, edição inline e persistência após reload;
- CRUD de pendências com busca, kanban, persistência e CSV;
- CRUD de eventos com criar, editar, duplicar, excluir e reload;
- rollback de evento quando persistência falha;
- confirmação de duplicata antes de salvar evento;
- NPS com debounce de observações;
- backup/export/reset/import;
- isolamento entre períodos.

`tests/e2e/app.spec.js` cobre estrutura, acessibilidade básica, responsividade, modais, abas, topbar, canvases de dashboard e ausência de overflow.

### Service Worker e Pós-Deploy

🟢 **CONFIRMADO** — `tests/e2e/service-worker.spec.js` valida:

- registro no escopo atual;
- script ativo/controlador em `sw.js`;
- cache versionado `wpm-v34-[hash]`;
- ausência de cache legado `wpm-v1`;
- app shell disponível offline após primeiro carregamento.

`tests/e2e/post-deploy-smoke.spec.js` valida bootstrap em URL alvo, presença de Chart.js, service worker, export de backup, rejeição de import inválido e troca mínima de período.

### Visual Regression

🟢 **CONFIRMADO** — `visual.spec.js` e `visual-states.spec.js` mantêm snapshots para:

- dashboard com/sem dados;
- alunos com tabela, filtros, busca e modais;
- pendências cheias, busca e estado dragging;
- NPS com score, sem score e observações;
- escala parcial/completa;
- addons vazio/preenchido;
- eventos com/sem dados e modal aberto;
- configurações padrão, pós-diagnóstico e pós-autotestes;
- múltiplos viewports: desktop, laptop, tablet e mobile.

### Scripts de Execução

🟢 **CONFIRMADO** — `package.json` expõe:

- `npm test` → `vitest run`;
- `npm run test:coverage`;
- `npm run smoke:deploy`;
- `npm run test:e2e`;
- `npm run test:visual`;
- `npm run test:all`.

### Funções/Contratos Principais

| Função/Contrato | Arquivo | Retorno | Confiança |
|---|---|---|---|
| `loadRealApp` | `tests/helpers/load-real-app.js` | app harness | 🟢 |
| `pure-functions` | `tests/helpers/pure-functions.js` | helpers puros | 🟢 |
| `seedEmptyStore` | `tests/e2e/workflows.spec.js` | estado vazio E2E | 🟢 |
| `seedStoreWithPeriods` | `tests/e2e/workflows.spec.js` | store multi-período E2E | 🟢 |
| `waitForServiceWorkerControl` | `tests/e2e/service-worker.spec.js` | controle SW | 🟢 |
| `installWritableSupabaseMock` | `tests/unit/runtime-env.test.js` | mock Supabase | 🟢 |

### Pontos de Complexidade

- A suíte mistura testes puros com testes que carregam o app real por concatenação dos scripts do `index.html`.
- E2E usa `file://` em alguns specs e servidor HTTP em outros, então comportamento de service worker depende do spec correto.
- Snapshots visuais são numerosos e podem ser sensíveis a fonte, viewport, relógio e ambiente gráfico.
- Muitos testes acessam `window.__APP_INTERNALS__`, o que torna esse contrato público para a suíte.

### Lacunas

- 🟡 **INFERIDO** — Não há indicação nesta leitura de testes SQL diretos das migrations Supabase; a validação Supabase é majoritariamente por adapter/mock no runtime.
- 🟡 **INFERIDO** — Snapshots visuais cobrem muito estado de tela, mas não substituem auditoria manual de UX quando houver mudança estrutural grande.
