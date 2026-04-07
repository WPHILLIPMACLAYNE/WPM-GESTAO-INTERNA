# MODULE_MAP.md

## Premissas do Mapa

- O projeto **não usa `import`/`export` reais**. Todos os arquivos de `src/` são carregados por `<script>` tags clássicos em `index.html`.
- A coluna **Depende de** reflete **acoplamento por globais + ordem de carga**, não imports ESM.
- A ordem de carga atual é: `helpers.js` → `config.js` → `schema.js` → `storage.js` → `selectors.js` → `forms.js` → `nps.js` → `csv.js` → `diagnostics.js` → `render.js` → `crud.js` → `events.js` → `main.js`.

## Tabela Resumida

| Arquivo | Camada | Exports | Depende de | Status |
|---------|--------|---------|------------|--------|
| `src/utils/helpers.js` | Transversal | `esc`, `sanitizeHtml`, `sanitizeDeep`, `clamp`, `formatDate`, `formatPct`, datas, CSV, NPS helpers | nenhum | ✅ OK |
| `src/core/config.js` | 1-Config | chaves de storage, versões, `DOM`, `APP_DEFAULTS`, estado global | nenhum | ✅ OK |
| `src/core/schema.js` | 3-Schema | `normalizeStore`, `getDefaultStore`, `migrateStore*`, `sanitizeStore` | `config.js`, `storage.js`, `main.js` | ⚠ globais tardios |
| `src/core/storage.js` | 2-Persistência | IndexedDB/localStorage, fila serializada, broadcast, UI state, seed, reset | `config.js`, `helpers.js`, `render.js`, `main.js` | ⚠ mistura camadas |
| `src/domain/selectors.js` | 4-Domínio | KPIs, filtros, ranking, memoização, resumos | `helpers.js`, `config.js`, `storage.js` | ✅ OK |
| `src/features/forms.js` | 3-Schema | leitura/validação de forms, builders, `apply*Save` | `helpers.js`, `config.js`, `main.js` | ✅ OK |
| `src/features/crud.js` | 6-UI | `createCrudHandler`, helpers de vínculo de addon | `forms.js`, `render.js`, `main.js` | ✅ OK |
| `src/features/csv.js` | 4-Domínio | serialização e export CSV de pendências/escala/eventos | `helpers.js`, `selectors.js`, `config.js` | ⚠ utilidades duplicadas |
| `src/features/diagnostics.js` | 7-Diagnósticos | smoke tests, persistência de relatório, painel | `selectors.js`, `render.js`, `storage.js` | ✅ OK |
| `src/features/nps.js` | 6-UI | CRUD de menções e persistência de observações NPS | `render.js`, `main.js` | ✅ OK |
| `src/ui/render.js` | 5-Renderização | scheduler, patch DOM, renders de todas as abas e painéis | quase todo `src/` | ⚠ arquivo muito grande |
| `src/ui/events.js` | 6-UI | delegation, modais, atalhos, tooltips, DnD, a11y | `render.js`, `forms.js`, `nps.js`, `csv.js`, `main.js`, `storage.js` | ⚠ alto acoplamento |
| `src/main.js` | Orquestração transversal | bootstrap, load/save store, lifecycle mensal, `APP_INTERNALS` | todos os módulos anteriores | ⚠ núcleo centralizado |

## Detalhe Por Arquivo

### `src/utils/helpers.js`

- Responsabilidade: utilitários puros compartilhados para escape, sanitização, formatação, datas, CSV e helpers de NPS.
- Camada: transversal, apoiando principalmente Schema, Domínio, Renderização e Persistência.
- Depende de: nenhum módulo local; usa apenas APIs padrão do navegador/JS.
- Exports completos:
  - `esc`, `sanitizeHtml`, `sanitizeDeep`, `clamp`, `formatDate`, `formatPct`, `formatPctPrecise`, `normalizeSearchText`, `csvEscape`, `buildCsvContent`, `shortText`, `formatBytes`, `formatPersistenceTimestamp`, `getWeekdayLabel`, `suggestScaleTone`, `isValidPeriodKey`, `getPeriodLabel`, `getPreviousPeriodKey`, `getNextPeriodKey`, `getInitialPeriodKey`, `toneLabel`, `compareByDateTime`, `eventStatusClass`, `normalizeEventType`, `isDateInActivePeriod`, `getPeriodPrefix`, `getDefaultPeriodDate`, `getActivePeriodFallbackDate`, `getPeriodDisplayDate`, `formatRecadoDateTime`, `getNpsGoalProgress`, `getRiskBand`, `getNpsHistoryBandClass`
- Status: `✅ OK`

### `src/core/config.js`

- Responsabilidade: declarar constantes do app, defaults, helper DOM e variáveis globais mutáveis compartilhadas.
- Camada: `1-Config`.
- Depende de: nenhum módulo local.
- Exports completos:
  - `todayISO`, `currentMonthDayISO`, `STORAGE_KEY`, `STORAGE_BROADCAST_KEY`, `STORE_VERSION`, `LEGACY_STORAGE_KEYS`, `APP_VERSION`, `LOCAL_SNAPSHOT_KEY`, `SYSTEM_REPORT_KEY`, `FLOW_TEST_REPORT_KEY`, `MONTH_NAMES`, `UI_KEY`, `IDB_NAME`, `IDB_STORE_NAME`, `LEGACY_LOCAL_SNAPSHOT_KEYS`, `LEGACY_SYSTEM_REPORT_KEYS`, `LEGACY_FLOW_TEST_REPORT_KEYS`, `LEGACY_UI_KEYS`, `DOM`, `APP_DEFAULTS`
- Status: `✅ OK`

### `src/core/schema.js`

- Responsabilidade: normalização de store, migrações de versão e sanitização do estado persistido.
- Camada: `3-Schema`.
- Depende de:
  - `src/core/config.js`
  - `src/core/storage.js`
  - `src/main.js`
- Exports completos:
  - `isValidPeriodKey`, `normalizeStore`, `seedYear`, `getDefaultStore`, `migrateStoreToV1`, `migrateStoreToV2`, `migrateStoreToV3`, `migrateStoreToV4`, `migrateStore`, `sanitizeStore`
- Status: `⚠ globais tardios`

### `src/core/storage.js`

- Responsabilidade: persistência híbrida, cache, broadcast, UI state, seed determinístico, builders de período limpo e reset.
- Camada: `2-Persistência`, com trechos de Schema e UI state.
- Depende de:
  - `src/core/config.js`
  - `src/utils/helpers.js`
  - `src/ui/render.js`
  - `src/main.js`
- Exports completos:
  - `isQuotaExceededError`, `readLocalStorageValue`, `writeLocalStorageValue`, `deleteLocalStorageValue`, `cloneSerializable`, `canUseStorageBroadcast`, `queueStorageOperation`, `updatePersistenceTechState`, `formatPersistenceTimestamp`, `normalizePersistenceOptions`, `emitStorageBroadcast`, `getKnownStorageKeys`, `withIndexedDbStore`, `idbGetValue`, `idbSetValue`, `idbDeleteValue`, `hydrateStorageCache`, `readPrimaryStoredValue`, `readStoredValue`, `readStoredJson`, `readStoredJsonWithFallback`, `persistStoredValue`, `persistStoredJson`, `writeStoredValue`, `writeStoredJson`, `removeStoredValue`, `removeStoredValues`, `hasStoredValue`, `hasStoredValueWithFallback`, `getStoreVersion`, `setStoreVersion`, `getUIState`, `sanitizeDeep`, `saveUIState`, `sanitizeUIState`, `setActiveTab`, `getReceptionists`, `getProfessors`, `getAllEmployees`, `totalAddonVolumeForPerson`, `getAddonPeople`, `getTotalAddonVolume`, `hydrateLegacyAddonsFromStudents`, `makeRng`, `pick`, `maybe`, `generatePeriodSeed`, `seedAddons`, `getInitialPeriodKey`, `buildCleanPeriodFromTemplate`, `buildEmptyPeriodFromTemplate`, `resetPeriodData`
- Status: `⚠ mistura camadas`

### `src/domain/selectors.js`

- Responsabilidade: memoização e derivação de KPIs, rankings, filtros e resumos operacionais.
- Camada: `4-Domínio/Seletores`.
- Depende de:
  - `src/utils/helpers.js`
  - `src/core/config.js`
  - `src/core/storage.js`
- Exports completos:
  - `limparCacheSelectores`, `criarAssinaturaSelector`, `lerSelectorMemorizado`, `selecionarTotaisAddons`, `selecionarResumoRecepcionistas`, `itemsComFeedback`, `selecionarLideresHistoricos`, `selecionarResumoPendencias`, `selecionarPendenciasFiltradas`, `selecionarRankingNps`, `selecionarDadosEventosAgrupados`, `selecionarResumoEscala`, `getNpsGoalProgress`, `selecionarIndicadoresDashboard`, `totalAddonByPerson`, `totalNpsMentions`, `computeSummary`, `getOldestOpenPending`, `diffInDays`, `totalTipo`
- Status: `✅ OK`

### `src/features/forms.js`

- Responsabilidade: coletar dados dos formulários, validar payloads e construir entidades normalizadas.
- Camada: `3-Schema`.
- Depende de:
  - `src/utils/helpers.js`
  - `src/core/config.js`
  - `src/main.js`
- Exports completos:
  - `isNonEmptyString`, `isValidNumber`, `isPositiveNumber`, `isValidDateValue`, `createValidationResult`, `normalizeNumericId`, `validateStudent`, `validatePending`, `getStudentFormData`, `getPendingFormData`, `buildStudentEntity`, `buildPendingEntity`, `upsertStudent`, `upsertPending`, `createValidationFailureResult`, `createSaveSuccessResult`, `applyStudentSave`, `applyPendingSave`, `getEventFormData`, `getScaleFormData`, `getSettingsFormData`, `getMentionDraft`, `getNpsObservationsDraft`, `validateEvent`, `buildEventEntity`, `upsertEvent`, `applyEventSave`, `limparErrosValidacao`, `apresentarErroValidacao`
- Status: `✅ OK`

### `src/features/crud.js`

- Responsabilidade: encapsular handlers CRUD reutilizáveis para coleções do app.
- Camada: `6-UI/Eventos`.
- Depende de:
  - `src/features/forms.js`
  - `src/ui/render.js`
  - `src/main.js`
- Exports completos:
  - `getStudentAddonLink`, `applyStudentAddonLink`, `createCrudHandler`
- Status: `✅ OK`

### `src/features/csv.js`

- Responsabilidade: converter coleções para CSV e iniciar downloads.
- Camada: `4-Domínio` com finalidade de exportação.
- Depende de:
  - `src/utils/helpers.js`
  - `src/domain/selectors.js`
  - `src/core/config.js`
- Exports completos:
  - `csvEscape`, `buildCsvContent`, `downloadCsvFile`, `getPendingCsvRows`, `getScaleCsvRows`, `getEventsCsvRows`, `exportPendingCsv`, `exportScaleCsv`, `exportEventsCsv`, `list`
- Status: `⚠ utilidades duplicadas`

### `src/features/diagnostics.js`

- Responsabilidade: armazenar/limpar smoke tests e renderizar o painel de fluxo.
- Camada: `7-Diagnósticos`.
- Depende de:
  - `src/domain/selectors.js`
  - `src/ui/render.js`
  - `src/core/storage.js`
- Exports completos:
  - `loadFlowSmokeReport`, `saveFlowSmokeReport`, `clearFlowSmokeTests`, `renderFlowSmokePanel`, `runFlowSmokeTests`
- Status: `✅ OK`

### `src/features/nps.js`

- Responsabilidade: mutações do ranking de NPS e persistência de observações.
- Camada: `6-UI/Eventos`.
- Depende de:
  - `src/ui/render.js`
  - `src/main.js`
- Exports completos:
  - `registerMention`, `adjustMention`, `setMentionCount`, `renameMention`, `removeMention`, `saveNpsObservations`
- Status: `✅ OK`

### `src/ui/render.js`

- Responsabilidade: scheduler de render, patching incremental e renderização de todas as views, painéis e ferramentas de support UI.
- Camada: `5-Renderização`.
- Depende de:
  - `src/utils/helpers.js`
  - `src/core/config.js`
  - `src/core/storage.js`
  - `src/domain/selectors.js`
  - `src/features/forms.js`
  - `src/features/nps.js`
  - `src/features/csv.js`
  - `src/features/diagnostics.js`
  - `src/main.js`
- Exports completos:
  - `getStudentViewFilters`, `getPendingViewFilters`, `getEventViewFilters`, `getScaleViewFilters`, `renderSection`, `renderSections`, `normalizarAlvosRender`, `requestRender`, `limparFilaRender`, `executarRenderAgendado`, `applyUIStateToControls`, `initUIBindings`, `resetViewFilters`, `criarAssinaturaHtml`, `criarNoRenderizado`, `escaparSeletorCss`, `obterSeletorFoco`, `capturarEstadoFoco`, `restaurarEstadoFoco`, `aplicarHtmlSeMudou`, `aplicarPatchPorChave`, `aplicarPatchLinhas`, `aplicarPatchCards`, `aplicarPatchItensKanban`, `aplicarPatchBlocosAgrupados`, `getUpcomingScale`, `getUpcomingEvent`, `toneLabel`, `eventStatusClass`, `normalizeSearchText`, `getScaleFilteredList`, `getEventsFilteredList`, `getScaleSummaryText`, `getEventSummaryText`, `suggestScaleTone`, `normalizeEventType`, `getCurrentPeriodDateInfo`, `renderEventsCalendar`, `renderDashboardInsights`, `renderHero`, `renderDashboard`, `createRecadoId`, `getRecadosStorageKey`, `sanitizeRecado`, `normalizeRecadosCollection`, `mergeRecadosCollections`, `areRecadosCollectionsEqual`, `readLegacyRecados`, `clearLegacyRecadosStorageKey`, `getLegacyRecadoPeriodKeys`, `ensureRecadosPeriod`, `getStoreRecados`, `migrateLegacyRecadosToStore`, `loadRecados`, `saveRecados`, `formatPctPrecise`, `getUnreadRecadosCount`, `syncRecadosSelects`, `renderFeedbackSummary`, `renderHeroRecadosBadge`, `renderRecadosPanel`, `publishRecado`, `markRecadoAsRead`, `removeRecado`, `bindRecadosModule`, `installDashboardEnhancements`, `renderStudents`, `updateStudentInline`, `populateStudentFilters`, `clearStudentForm`, `finalizeStudentSaveUI`, `renderStudentSaveUI`, `editStudent`, `removeStudent`, `renderAddons`, `updateAddon`, `addPerson`, `renamePerson`, `buildPendingMeta`, `studentStatusPill`, `npsPill`, `pendingPill`, `updatePendingStatus`, `limparEstadoDropPendencias`, `bindPendingDnD`, `positionTooltip`, `bindTooltips`, `renderPending`, `clearPendingForm`, `finalizePendingSaveUI`, `renderPendingSaveUI`, `editPending`, `removePending`, `getRiskBand`, `getSortedMentions`, `getRankMap`, `captureNpsRankSnapshot`, `trendBadge`, `getNpsHistoryBandClass`, `getNpsHistoryRows`, `renderNps`, `updateNpsScore`, `updateNpsGoal`, `renderScaleShiftRows`, `addScaleShiftRow`, `removeScaleShiftRow`, `clearScaleForm`, `openScaleModal`, `editScaleDay`, `saveScaleDay`, `removeScaleDay`, `renderScale`, `clearEventForm`, `finalizeEventSaveUI`, `renderEventSaveUI`, `openEventModal`, `editEventItem`, `removeEventItem`, `duplicateEventItem`, `renderEvents`, `renderSettings`, `saveSettings`, `resizeMonth`, `doResizeMonth`, `getPeriodMetrics`, `getBackupSummary`, `formatBytes`, `getSettingsStorageUsage`, `getSettingsMetaSnapshot`, `renderSettingsHealthBar`, `renderSettingsSupportPanels`, `isLegacyPeriodPayload`, `extractImportedPayload`, `isMonthArchivePayload`, `getMonthArchiveImportMeta`, `buildArchiveEntryFromMonthArchivePayload`, `buildStoreFromMonthArchivePayload`, `getImportedPayloadDescriptor`, `coerceImportedStore`, `buildBackupPayload`, `applyImportedStore`, `saveLocalSnapshot`, `restoreLocalSnapshot`, `loadSystemReport`, `saveSystemReport`, `runSystemDiagnostics`, `renderBackupSummary`, `renderDiagnosticsPanel`, `renderPersistenceTechPanel`, `renderPeriodAudit`, `clearEmptyMonths`, `downloadData`, `importData`, `resetDemoData`, `renderAll`, `register`, `show`, `hide`, `professorSlotsFilled`, `UI_BINDINGS`, `UI_CONTROL_IDS`, `AREAS_RENDERIZACAO`, `RENDER_MAP`, `RECADOS_STORAGE_PREFIX`
- Status: `⚠ arquivo muito grande`

### `src/ui/events.js`

- Responsabilidade: delegação de eventos, modais, atalhos, acessibilidade, tooltips e drag-and-drop.
- Camada: `6-UI/Eventos`.
- Depende de:
  - `src/ui/render.js`
  - `src/features/forms.js`
  - `src/features/nps.js`
  - `src/features/csv.js`
  - `src/features/diagnostics.js`
  - `src/main.js`
  - `src/core/storage.js`
- Exports completos:
  - `openModal`, `closeModal`, `openStudentModal`, `openPendingModal`, `bindUIEvents`, `obterElementosFocaveis`, `obterModalAtivo`, `limparErroValidacaoCampo`, `sincronizarLabelsComCampos`, `configurarRotulosAcessiveisEstaticos`, `obterTicketsPendencia`, `atualizarRovingPendencias`, `focarPendenciaPorIndice`, `agendarRetornoFocoPendencia`, `restaurarFocoPendenteSeNecessario`, `moverPendenciaPorTeclado`, `bindAcessibilidade`, `initializeStaticControls`, `bindTabKeyboardNavigation`, `bindModalBackdropClose`, `bindGlobalKeyboardShortcuts`, `bindStorageSync`
- Status: `⚠ alto acoplamento`

### `src/main.js`

- Responsabilidade: bootstrap da aplicação, ciclo de vida mensal, persistência de alto nível e exposição do `APP_INTERNALS`.
- Camada: orquestração transversal entre Persistência, Renderização e UI.
- Depende de:
  - `src/utils/helpers.js`
  - `src/core/config.js`
  - `src/core/schema.js`
  - `src/core/storage.js`
  - `src/domain/selectors.js`
  - `src/features/forms.js`
  - `src/features/nps.js`
  - `src/features/csv.js`
  - `src/features/diagnostics.js`
  - `src/ui/render.js`
  - `src/features/crud.js`
  - `src/ui/events.js`
- Exports completos:
  - `prepareStoreCandidate`, `readStoredStore`, `loadStore`, `saveStore`, `anunciarAoLeitor`, `showSaveToast`, `showToast`, `showConfirm`, `_resolveConfirm`, `saveData`, `consumeStorageBroadcast`, `getCommittedStoreSnapshot`, `buildBackupPayloadFromStore`, `buildMonthArchivePayload`, `runPersistenceSelfTest`, `shortText`, `slugify`, `renderEllipsisCell`, `normalizeData`, `getPeriodLabel`, `getNextPeriodKey`, `getPreviousPeriodKey`, `isPeriodLocked`, `isCurrentPeriodLocked`, `getCurrentPeriodLockMessage`, `canMutateCurrentPeriod`, `assertWritableCurrentPeriod`, `syncCurrentPeriodLockUI`, `periodHasMeaningfulData`, `formatScaleBoardDay`, `ensurePeriod`, `syncPeriodControls`, `switchPeriod`, `changePeriodFromControls`, `closeCurrentMonth`, `resetSelectedMonth`, `duplicatePreviousMonthScale`, `syncAppState`, `initializeForms`, `initializeSavedUIState`, `renderInitialViews`, `initializeApp`, `syncDisableState`, `finishClose`, `doDuplicate`, `LOCKED_CURRENT_PERIOD_ACTIONS`, `LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS`, `LOCKED_CURRENT_PERIOD_INPUT_ACTIONS`, `LOCKED_CURRENT_PERIOD_BLUR_ACTIONS`, `LOCKED_CURRENT_PERIOD_CONTROL_IDS`, `APP_INTERNALS`, `__APP_INTERNALS__`
- Status: `⚠ núcleo centralizado`
