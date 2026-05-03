    // ══════════════════════════════════════════
    // BOOTSTRAP — initializeApp, APP_INTERNALS, DOMContentLoaded
    // ══════════════════════════════════════════

    /** @type {Readonly<Object>} Frozen map of all internal modules exposed for testing/diagnostics. */
    const APP_INTERNALS = Object.freeze({
      runtime: APP_RUNTIME,
      config: {
        STORAGE_KEY,
        STORE_VERSION,
        APP_VERSION,
        APP_COMMIT,
        APP_BUILD_TIME,
        APP_RELEASE_LABEL,
        APP_RUNTIME,
        UI_KEY,
        MONTH_NAMES,
        APP_DEFAULTS,
        DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA
      },
      persistence: {
        hydrateStorageCache,
        readStoredValue,
        readStoredJson,
        readStoredJsonWithFallback,
        writeStoredValue,
        writeStoredJson,
        removeStoredValue,
        removeStoredValues,
        prepareStoreCandidate,
        readStoredStore,
        loadStore,
        saveStore,
        saveData,
        buildBackupPayloadFromStore,
        buildBackupPayload,
        buildImportPreview,
        validateImportGuards,
        attachPayloadIntegrity,
        verifyPayloadIntegrity,
        calculatePayloadIntegrityHash,
        applyImportedStore,
        saveLocalSnapshot,
        restoreLocalSnapshot,
        exportBackup,
        importBackup
      },
      schema: {
        sanitizeDeep,
        sanitizeUIState,
        normalizeData,
        normalizeStore,
        migrateStore,
        sanitizeStore,
        buildCleanPeriodFromTemplate,
        buildEmptyPeriodFromTemplate
      },
      domain: {
        limparCacheSelectores,
        getReceptionists,
        getProfessors,
        getAllEmployees,
        getStudentViewFilters,
        getPendingViewFilters,
        getEventViewFilters,
        getScaleViewFilters,
        selecionarTotaisAddons,
        selecionarResumoRecepcionistas,
        selecionarResumoPendencias,
        selecionarPendenciasFiltradas,
        selecionarRankingNps,
        selecionarHistoricoDashboard,
        selecionarDadosGraficosDashboard,
        selecionarDadosEventosAgrupados,
        selecionarResumoEscala,
        selecionarIndicadoresDashboard,
        getScaleFilteredList,
        getEventsFilteredList,
        computeSummary,
        getPeriodMetrics,
        getBackupSummary,
        periodHasMeaningfulData
      },
      actions: {
        applyStudentSave,
        applyPendingSave,
        applyEventSave,
        switchPeriod,
        closePeriod,
        closeCurrentMonth,
        reopenPeriod,
        reopenSelectedMonth,
        resetPeriod,
        resetSelectedMonth,
        resetPeriodData,
        saveSettings,
        resizeMonth,
        saveLocalSnapshot,
        restoreLocalSnapshot,
        applyImportedStore,
        exportBackup,
        importBackup
      },
      rendering: {
        AREAS_RENDERIZACAO,
        estadoRenderizacao,
        requestRender,
        limparFilaRender,
        renderSection,
        renderSections,
        renderAll,
        renderHero,
        renderDashboard,
        renderDashboardCharts,
        renderStudents,
        renderAddons,
        renderPending,
        renderNps,
        renderScale,
        renderEvents,
        renderSettings,
        aplicarPatchLinhas
      },
      ui: {
        DOM,
        bindUIEvents,
        initUIBindings,
        initializeStaticControls,
        bindTabKeyboardNavigation,
        bindModalBackdropClose,
        bindGlobalKeyboardShortcuts,
        bindStorageSync
      },
      diagnostics: {
        runSystemDiagnostics,
        runFlowSmokeTests,
        loadMigrationDryRunReport,
        getMigrationReadiness,
        runMigrationDryRun,
        clearMigrationDryRunReport,
        renderMigrationDryRunPanel,
        renderMigrationHomologationPanel,
        runAssistedMigrationToSupabase,
        renderDiagnosticsPanel,
        renderFlowSmokePanel,
        renderPeriodAudit
      },
      backend: {
        getSupabaseClient,
        isSupabaseEnabled,
        getSupabaseStatus,
        getSupabaseBackendState,
        getSupabaseRpcOperation,
        validateSupabaseRpcParams,
        callSupabaseRpc,
        refreshSupabaseBackendState,
        loadStoreFromSupabase,
        saveStoreToSupabase,
        queueSupabaseStoreSync,
        syncCurrentStoreToSupabase,
        reloadAppFromSupabaseSession,
        signInSupabasePassword,
        updateSupabasePassword,
        requestSupabasePasswordRecovery,
        signOutSupabase,
        resetSupabaseClient
      },
      observability: {
        initSentry,
        captureError,
        captureMessage,
        getObservabilityStatus,
        resetObservability
      }
    });

    /** @returns {Readonly<Object>} */
    function exposeAppInternals() {
      window.__APP_INTERNALS__ = APP_INTERNALS;
      globalThis.__APP_INTERNALS__ = APP_INTERNALS;
      return APP_INTERNALS;
    }

    exposeAppInternals();

    /**
     * Bootstraps the entire application: hydrates storage, syncs state, binds UI and renders.
     * @returns {Promise<void>}
     */
    async function initializeApp() {
      try {
        await hydrateStorageCache();
        await syncAppState();
        initializeStaticControls();
        initUIBindings();
        bindUIEvents();
        bindPendingDnD();
        bindTooltips();
        bindAcessibilidade();
        bindTabKeyboardNavigation();
        bindModalBackdropClose();
        bindGlobalKeyboardShortcuts();
        bindStorageSync();

        const uiState = sanitizeUIState(getUIState());
        applyUIStateToControls(uiState);

        if (!estadoEventos.formulariosInicializados) {
          estadoEventos.formulariosInicializados = true;
          populateStudentFilters();
          clearStudentForm();
          clearPendingForm();
          clearScaleForm();
          clearEventForm();
          sincronizarLabelsComCampos();
        }

        renderAll();
        syncPeriodControls();
        runSystemDiagnostics(true);
        applyUIStateToControls(uiState);
        setActiveTab(uiState.activeTab || 'dashboard', true);
      } catch (err) {
        console.error('Falha ao inicializar a aplicação:', err);
        if (typeof captureError === 'function') {
          captureError(err, {
            feature: 'bootstrap',
            stage: 'initializeApp',
            appVersion: APP_VERSION,
            appCommit: APP_COMMIT,
            runtime: APP_RUNTIME
          });
        }
        showToast('Falha ao inicializar os dados do aplicativo. Tente recarregar a página ou restaurar um backup.', 'danger', 8000);
        try {
          storage = getDefaultStore();
          currentPeriodKey = storage.activePeriod;
          state = storage.periods[currentPeriodKey];
          await saveData({ silent: true, eventType: 'recovery' });
          renderAll();
          syncPeriodControls();
          showToast('Dados de exemplo restaurados. Importe um backup para recuperar seus dados.', 'warning', 6000);
        } catch (recoveryErr) {
          console.error('Recovery falhou:', recoveryErr);
          if (typeof captureError === 'function') {
            captureError(recoveryErr, {
              feature: 'bootstrap',
              stage: 'initializeApp-recovery',
              appVersion: APP_VERSION,
              appCommit: APP_COMMIT,
              runtime: APP_RUNTIME
            });
          }
        }
      } finally {
        exposeAppInternals();
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      initializeApp().catch(err => {
        console.error('Falha ao inicializar a aplicação:', err);
        if (typeof captureError === 'function') {
          captureError(err, {
            feature: 'bootstrap',
            stage: 'DOMContentLoaded',
            appVersion: APP_VERSION,
            appCommit: APP_COMMIT,
            runtime: APP_RUNTIME
          });
        }
        showToast('Falha ao inicializar os dados do aplicativo.', 'danger', 4500);
      });
    });
