    // ══════════════════════════════════════════
    // BOOTSTRAP — initializeApp, APP_INTERNALS, DOMContentLoaded
    // ══════════════════════════════════════════

    const APP_INTERNALS = Object.freeze({
      config: {
        STORAGE_KEY,
        STORE_VERSION,
        APP_VERSION,
        UI_KEY,
        MONTH_NAMES,
        APP_DEFAULTS
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
        buildBackupPayload,
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
        renderStudents,
        renderAddons,
        renderPending,
        renderNps,
        renderScale,
        renderEvents,
        renderSettings
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
        renderDiagnosticsPanel,
        renderFlowSmokePanel,
        renderPeriodAudit
      }
    });

    window.__APP_INTERNALS__ = APP_INTERNALS;

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
        }
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      initializeApp().catch(err => {
        console.error('Falha ao inicializar a aplicação:', err);
        showToast('Falha ao inicializar os dados do aplicativo.', 'danger', 4500);
      });
    });
