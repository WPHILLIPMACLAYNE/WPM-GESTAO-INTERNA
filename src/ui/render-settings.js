    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — SETTINGS & DIAGNOSTICS — renderSettings, saveSettings, resizeMonth, renderBackupSummary, runSystemDiagnostics
    // ══════════════════════════════════════════

    /** @returns {void} */
    function renderSettings() {
      if (!state?.settings) return;
      document.getElementById('receptionistEditor').value = getReceptionists(state).join('\n');
      document.getElementById('professorEditor').value = getProfessors(state).join('\n');
      document.getElementById('addonTypeEditor').value = state.settings.addonTypes.join('\n');
      const seedToggle = document.getElementById('settingsInitializeMonthsWithTestData');
      if (seedToggle) seedToggle.checked = shouldInitializeMonthsWithTestData(storage);
      renderSettingsHealthBar();
      renderSettingsSupportPanels();
      renderBackupSummary();
      renderDiagnosticsPanel();
      renderPersistenceTechPanel();
      renderSupabasePanel();
      renderMigrationDryRunPanel();
      renderMigrationHomologationPanel();
      renderPeriodAudit();
      renderFlowSmokePanel();
      if (typeof setSettingsPanel === 'function') {
        setSettingsPanel(document.getElementById('settings')?.dataset.settingsPanel || 'all');
      }
    }

    /** @returns {Promise<void>} */
    async function saveSettings() {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const { receptionists, professors, addonTypes, initializeMonthsWithTestData } = getSettingsFormData();
      if (!receptionists.length || !addonTypes.length) { showToast('Informe ao menos uma recepcionista e um tipo de addon.', 'warning'); return; }
      const old = structuredClone(state);
      state.settings.receptionists = receptionists;
      state.settings.professors = professors;
      state.settings.team = [...new Set([...receptionists, ...professors])];
      state.settings.addonTypes = addonTypes;
      storage.preferences = normalizeStorePreferences({
        ...storage.preferences,
        initializeMonthsWithTestData
      });
      normalizeData(state);
      const removedNames = new Set(getReceptionists(old).filter(name => !getReceptionists(state).includes(name)));
      removedNames.forEach(oldName => {
        state.students = state.students.map(s => s.atendimento === oldName ? { ...s, atendimento: getReceptionists(state)[0] } : s);
        state.pending = state.pending.map(p => p.hostess === oldName ? { ...p, hostess: getReceptionists(state)[0] } : p);
      });
      if (removedNames.size) {
        state.nps.mentions = state.nps.mentions.filter(m => !removedNames.has(m.name));
      }
      const saved = await saveData();
      populateStudentFilters();
      requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
      if (saved) {
        const nextMode = initializeMonthsWithTestData ? 'Novos meses usarão a massa de teste determinística.' : 'Novos meses começarão vazios.';
        showToast(`Configurações salvas com sucesso. ${nextMode}`);
      }
    }

    /** @param {number|string} days @returns {void} */
    function resizeMonth(days) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'addons'] })) return;
      const newDays = Number(days);
      const oldDays = state.settings.monthDays;

      if (newDays < oldDays) {
        const hasDataInLostDays = Object.values(state.addons || {}).some(group =>
          Object.values(group || {}).some(arr =>
            Array.isArray(arr) && arr.slice(newDays).some(v => Number(v || 0) > 0)
          )
        );
        if (hasDataInLostDays) {
          showConfirm(
            `Há dados de addons nos dias ${newDays + 1} a ${oldDays} que serão perdidos. Deseja continuar?`,
            () => doResizeMonth(newDays)
          );
          return;
        }
      }

      doResizeMonth(newDays);
    }

    /** @param {number} days @returns {void} */
    function doResizeMonth(days) {
      state.settings.monthDays = days;
      Object.keys(state.addons || {}).forEach(person => {
        const knownTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(state.addons[person] || {})])];
        knownTypes.forEach(type => {
          const old = state.addons[person]?.[type] || [];
          state.addons[person][type] = Array.from({ length: state.settings.monthDays }, (_, i) => Number(old[i] || 0));
        });
      });
      saveData();
      requestRender(['hero', 'dashboard', 'addons']);
    }

    /** @param {PeriodData} period @returns {PeriodMetrics} */
    function getPeriodMetrics(period) {
      normalizeData(period);
      return {
        recados: period.recados.length,
        students: period.students.length,
        pending: period.pending.length,
        events: period.events.length,
        scale: period.scale.length,
        mentions: period.nps.mentions.length,
        addonVolume: Object.values(period.addons || {}).reduce((acc, byType) => acc + Object.values(byType || {}).reduce((sum, days) => sum + (days || []).reduce((dayAcc, value) => dayAcc + Number(value || 0), 0), 0), 0)
      };
    }

    /** @returns {{ bytes: number, quotaBytes: number, ratio: number, keyCount: number, status: string, error?: boolean }} */
    function getSettingsStorageUsage() {
      const quotaBytes = 5 * 1024 * 1024;
      try {
        const relevantKeys = [];
        const knownKeys = new Set([
          STORAGE_KEY,
          STORAGE_BROADCAST_KEY,
          LOCAL_SNAPSHOT_KEY,
          SYSTEM_REPORT_KEY,
          FLOW_TEST_REPORT_KEY,
          MIGRATION_DRY_RUN_REPORT_KEY,
          UI_KEY,
          ...LEGACY_STORAGE_KEYS,
          ...LEGACY_LOCAL_SNAPSHOT_KEYS,
          ...LEGACY_SYSTEM_REPORT_KEYS,
          ...LEGACY_FLOW_TEST_REPORT_KEYS,
          ...LEGACY_MIGRATION_DRY_RUN_REPORT_KEYS,
          ...LEGACY_UI_KEYS
        ]);
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (!key) continue;
          if (key.startsWith('wpm_') || knownKeys.has(key)) relevantKeys.push(key);
        }
        const bytes = relevantKeys.reduce((acc, key) => {
          const raw = localStorage.getItem(key);
          return acc + new Blob([JSON.stringify({ key, value: raw ?? '' })]).size;
        }, 0);
        return {
          bytes,
          quotaBytes,
          ratio: quotaBytes ? Math.min(1, bytes / quotaBytes) : 0,
          keyCount: relevantKeys.length,
          status: bytes / quotaBytes >= 0.8 ? 'warn' : 'ok'
        };
      } catch (error) {
        console.error('Falha ao calcular uso do armazenamento local:', error);
        return {
          bytes: 0,
          quotaBytes,
          ratio: 0,
          keyCount: 0,
          status: 'info',
          error: true
        };
      }
    }

    /** @returns {{ summary: BackupSummary, monthsWithData: number, totalRecords: number, emptyMonths: number, storageUsage: Object, lastBackupLabel: string }} */
    function getSettingsMetaSnapshot() {
      const summary = getBackupSummary(storage);
      const periodEntries = Object.entries(storage.periods || {});
      const monthsWithData = periodEntries.filter(([, period]) => periodHasMeaningfulData(period)).length;
      const totalRecords = periodEntries.reduce((acc, [, period]) => {
        const metrics = getPeriodMetrics(period);
        return acc + metrics.students + metrics.pending + metrics.events;
      }, 0);
      const emptyMonths = periodEntries.filter(([key, period]) => key !== currentPeriodKey && !periodHasMeaningfulData(period) && loadRecados(key).length === 0).length;
      const storageUsage = getSettingsStorageUsage();
      let lastBackupLabel = 'Não rastreado';
      try {
        const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
        if (snapshot?.savedAt) lastBackupLabel = new Date(snapshot.savedAt).toLocaleString('pt-BR');
      } catch (error) {
        console.error('Falha ao ler snapshot local:', error);
      }
      return {
        summary,
        monthsWithData,
        totalRecords,
        emptyMonths,
        storageUsage,
        lastBackupLabel
      };
    }

    /** @returns {void} */
    function renderSettingsHealthBar() {
      const host = document.getElementById('settingsHealthBar');
      if (!host) return;
      const meta = getSettingsMetaSnapshot();
      const storageStatusLabel = meta.storageUsage.error
        ? 'Leitura local indisponível'
        : meta.storageUsage.status === 'warn'
          ? 'Espelho local próximo do limite'
          : 'Espelho local OK';
      const storagePill = meta.storageUsage.error
        ? 'info'
        : meta.storageUsage.status === 'warn'
          ? 'warn'
          : 'ok';
      aplicarHtmlSeMudou(host, `
        <span class="settings-health-item"><span class="pill ${storagePill}">${esc(storageStatusLabel)}</span></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Meses com dados</span><strong>${meta.monthsWithData}</strong></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Último backup/snapshot</span><strong>${esc(meta.lastBackupLabel)}</strong></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Total de registros</span><strong>${meta.totalRecords}</strong></span>
      `);
    }

    /** @returns {void} */
    function renderSettingsSupportPanels() {
      const meta = getSettingsMetaSnapshot();
      const aboutHost = document.getElementById('settingsAboutPanel');
      const storageHost = document.getElementById('settingsStorageUsage');
      const maintenanceHost = document.getElementById('settingsMaintenanceList');

      if (aboutHost) {
        aplicarHtmlSeMudou(aboutHost, `
          <div class="settings-about-grid">
            <div class="settings-about-item">
              <div class="name">Versão</div>
              <div class="value">${esc(APP_RELEASE_LABEL)}</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Commit</div>
              <div class="value">${esc(APP_COMMIT || 'local')}</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Build</div>
              <div class="value">${esc(APP_BUILD_TIME || 'runtime local')}</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Autor</div>
              <div class="value">Wallace Phillip Maclayne</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Tecnologia</div>
              <div class="value">HTML/CSS/JS + persistência local híbrida (IndexedDB + localStorage)</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Descrição</div>
              <div class="value">SPA single-file para operação interna da recepção, com controle mensal independente por período.</div>
            </div>
          </div>
        `);
      }

      if (storageHost) {
        const usage = meta.storageUsage;
        const toneClass = usage.error ? 'info' : usage.status === 'warn' ? 'warn' : 'ok';
        const usageLabel = usage.error ? 'Leitura indisponível' : usage.status === 'warn' ? 'Espelho local próximo do limite estimado' : 'Espelho local em faixa confortável';
        aplicarHtmlSeMudou(storageHost, `
          <div class="settings-storage-box">
            <div class="settings-storage-top">
              <span class="pill ${toneClass}">${esc(usageLabel)}</span>
              <span class="muted">${esc(formatBytes(usage.bytes))} de ${esc(formatBytes(usage.quotaBytes))}</span>
            </div>
            <div class="settings-storage-bar" aria-hidden="true">
              <div class="settings-storage-fill" data-style-width-pct="${Math.min(100, usage.ratio * 100)}"></div>
            </div>
            <div class="settings-storage-meta">
              <span>Uso estimado do espelho local <strong>${usage.error ? '—' : `${(usage.ratio * 100).toFixed(1)}%`}</strong></span>
              <span>Chaves monitoradas <strong>${usage.keyCount}</strong></span>
              <span>Escopo <strong>localStorage monitorado do app</strong></span>
            </div>
            <div class="settings-storage-foot">Estimativa local de 5 MB para o espelho em localStorage. A persistência principal do app usa IndexedDB; este painel mostra somente as chaves locais auxiliares e de compatibilidade desta versão.</div>
          </div>
        `);
      }

      if (maintenanceHost) {
        aplicarHtmlSeMudou(maintenanceHost, `
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Exportação consolidada</div>
              <div class="muted">O backup JSON já inclui todos os períodos carregados, arquivos fechados e snapshots necessários para restauração.</div>
            </div>
          </div>
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Limpeza de meses vazios</div>
              <div class="muted">${meta.emptyMonths} período(s) sem massa operacional nem recados podem ser removidos com segurança.</div>
            </div>
          </div>
        `);
      }
    }

    // CSV export movido para src/features/csv.js

    // Smoke tests de fluxo movidos para src/features/diagnostics.js

    /** @returns {FlowSmokeReportItem[]} */
    function loadSystemReport() {
      return readStoredJsonWithFallback(SYSTEM_REPORT_KEY, LEGACY_SYSTEM_REPORT_KEYS, []);
    }

    /** @param {FlowSmokeReportItem[]} report @returns {FlowSmokeReportItem[]} */
    function saveSystemReport(report) {
      writeStoredJson(SYSTEM_REPORT_KEY, report);
      removeStoredValues(LEGACY_SYSTEM_REPORT_KEYS);
      return report;
    }

    /** @param {boolean} [silent] @returns {FlowSmokeReportItem[]} */
    function runSystemDiagnostics(silent = false) {
      const periodEntries = Object.entries(storage.periods || {});
      const currentMetrics = getPeriodMetrics(state);
      const receptionists = new Set(getReceptionists(state));
      const employees = getAllEmployees(state);
      const mentionNames = new Set((state.nps.mentions || []).map(item => item.name).filter(Boolean));
      const report = [
        {
          label: 'Estrutura principal do armazenamento',
          status: storage.activePeriod && storage.periods?.[storage.activePeriod] ? 'ok' : 'bad',
          detail: storage.activePeriod && storage.periods?.[storage.activePeriod] ? `Período ativo ${getPeriodLabel(storage.activePeriod)} disponível.` : 'Período ativo ausente no armazenamento.'
        },
        {
          label: 'Atendimentos vinculados a recepcionistas',
          status: state.students.every(item => receptionists.has(item.atendimento)) ? 'ok' : 'bad',
          detail: `${state.students.filter(item => receptionists.has(item.atendimento)).length}/${state.students.length} registros válidos no período ativo.`
        },
        {
          label: 'Pendências vinculadas a recepcionistas',
          status: state.pending.every(item => receptionists.has(item.hostess)) ? 'ok' : 'bad',
          detail: `${state.pending.filter(item => receptionists.has(item.hostess)).length}/${state.pending.length} pendências com hostess válida.`
        },
        {
          label: 'Cobertura de NPS do período ativo',
          status: employees.every(name => mentionNames.has(name)) ? 'ok' : 'warn',
          detail: `${mentionNames.size}/${employees.length} funcionários aparecem nas citações do NPS.`
        },
        {
          label: 'Massa de teste do período ativo',
          status: currentMetrics.students >= 30 && currentMetrics.pending >= 20 && currentMetrics.events >= 10 && currentMetrics.scale > 0 ? 'ok' : 'warn',
          detail: `${currentMetrics.students} alunos • ${currentMetrics.pending} pendências • ${currentMetrics.events} eventos • ${currentMetrics.scale} turnos de escala.`
        },
        {
          label: 'Cobertura anual carregada',
          status: periodEntries.length >= 12 ? 'ok' : 'warn',
          detail: `${periodEntries.length} períodos disponíveis no armazenamento atual.`
        },
        {
          label: 'Snapshot local disponível',
          status: hasStoredValueWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS) ? 'ok' : 'info',
          detail: hasStoredValueWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS) ? 'Existe um snapshot local pronto para restauração rápida.' : 'Nenhum snapshot local salvo ainda.'
        }
      ];
      saveSystemReport(report);
      if (!silent) {
        const failures = report.filter(item => item.status === 'bad').length;
        const warnings = report.filter(item => item.status === 'warn').length;
        const type = failures > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success';
        showToast(`Validação concluída: ${report.length - failures - warnings} ok, ${warnings} alerta(s), ${failures} falha(s).`, type, 4500);
      }
      requestRender('settings');
      return report;
    }

    /** @returns {void} */
    function renderBackupSummary() {
      const host = document.getElementById('backupSummaryList');
      if (!host) return;
      const summary = getBackupSummary();
      let snapshotText = 'Nenhum snapshot local salvo.';
      try {
        const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
        if (snapshot?.savedAt) snapshotText = `Último snapshot local em ${new Date(snapshot.savedAt).toLocaleString('pt-BR')}.`;
      } catch {}
      host.innerHTML = `
        <div class="summary-item summary-item--backup">
          <div>
            <div class="name">Backup ativo</div>
            <div class="muted">${esc(getPeriodLabel())} • ${esc(APP_VERSION)}</div>
          </div>
          <div class="metric"><strong>${summary.periods}</strong><span>Períodos</span></div>
          <div class="metric"><strong>${summary.archives}</strong><span>Arquivos</span></div>
          <div class="metric"><strong>${summary.students + summary.pending + summary.events}</strong><span>Itens principais</span></div>
        </div>
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Resumo consolidado</div>
            <div class="muted">${summary.recados} recados • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos • ${summary.scale} turnos • ${summary.mentions} citações de NPS • volume de addons ${summary.addonVolume}.</div>
            <div class="subtle-note">${esc(snapshotText)}</div>
          </div>
        </div>
      `;
    }

    /** @returns {void} */
    function renderDiagnosticsPanel() {
      const host = document.getElementById('diagnosticSummaryList');
      if (!host) return;
      const report = loadSystemReport();
      if (!report.length) {
        host.innerHTML = `<div class="summary-item summary-item--col1"><div><div class="name">Validação ainda não executada</div><div class="muted">Use o botão Validar sistema para gerar um relatório rápido da base atual.</div></div></div>`;
        return;
      }
      host.innerHTML = report.map(item => `
        <div class="summary-item summary-item--diagnostic">
          <div><span class="pill ${item.status === 'ok' ? 'ok' : item.status === 'bad' ? 'bad' : item.status === 'warn' ? 'warn' : 'info'}">${item.status === 'ok' ? 'OK' : item.status === 'bad' ? 'Falha' : item.status === 'warn' ? 'Alerta' : 'Info'}</span></div>
          <div>
            <div class="name">${esc(item.label)}</div>
            <div class="muted">${esc(item.detail)}</div>
          </div>
        </div>
      `).join('');
    }

    /** @returns {void} */
    function renderPersistenceTechPanel() {
      const host = document.getElementById('persistenceTechList');
      if (!host) return;
      const backendState = typeof getSupabaseBackendState === 'function'
        ? getSupabaseBackendState()
        : null;
      const effectiveModeLabel = backendState?.sessionStatus === 'authenticated'
        ? 'híbrido / Supabase + IndexedDB + cache + broadcast'
        : persistenceTechState.modeLabel;
      const effectiveBackendLabel = backendState?.sessionStatus === 'authenticated'
        ? backendState?.source === 'supabase'
          ? 'Supabase com espelho local'
          : 'IndexedDB (fallback local)'
        : persistenceTechState.backendLabel;

      const statusPillClass = persistenceTechState.status === 'pronto'
        ? 'ok'
        : persistenceTechState.status === 'sincronizando'
          ? 'warn'
          : persistenceTechState.status === 'fila'
            ? 'info'
          : 'bad';
      const statusLabel = persistenceTechState.status === 'pronto'
        ? 'Pronto'
        : persistenceTechState.status === 'sincronizando'
          ? 'Sincronizando'
          : persistenceTechState.status === 'fila'
            ? 'Na fila'
          : 'Erro';
      const selfTestClass = persistenceTechState.selfTest.status === 'ok'
        ? 'ok'
        : persistenceTechState.selfTest.status === 'bad'
          ? 'bad'
          : 'info';
      const selfTestLabel = persistenceTechState.selfTest.status === 'ok'
        ? 'OK'
        : persistenceTechState.selfTest.status === 'bad'
          ? 'Falha'
          : 'Info';

      host.innerHTML = `
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Painel técnico de persistência</div>
            <div class="muted">Somente leitura; o autoteste é executado sob demanda.</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Modo de persistência</div>
            <div class="muted">${esc(effectiveModeLabel)}</div>
          </div>
          <div>
            <div class="name">Status da persistência</div>
            <div class="muted"><span class="pill ${statusPillClass}">${statusLabel}</span></div>
          </div>
          <div>
            <div class="name">Backend principal</div>
            <div class="muted">${esc(effectiveBackendLabel)}</div>
          </div>
          <div>
            <div class="name">Broadcast cross-tab</div>
            <div class="muted">${persistenceTechState.broadcastAvailable ? 'ativo' : 'indisponível'}</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Última gravação bem-sucedida</div>
            <div class="muted">${esc(formatPersistenceTimestamp(persistenceTechState.lastSuccessAt))}</div>
          </div>
          <div>
            <div class="name">Último tipo de operação</div>
            <div class="muted">${esc(persistenceTechState.lastOperationType)}</div>
          </div>
          <div>
            <div class="name">Versão do payload/store</div>
            <div class="muted">${esc(String(persistenceTechState.storeVersion || STORE_VERSION))}</div>
          </div>
          <div>
            <div class="name">Autoteste de persistência</div>
            <div class="muted"><span class="pill ${selfTestClass}">${selfTestLabel}</span> ${esc(persistenceTechState.selfTest.detail)}</div>
          </div>
        </div>
      `;
    }

    /**
     * @param {string} status
     * @returns {string}
     */
    function getSupabasePillClass(status) {
      if (status === 'authenticated' || status === 'idle') return 'ok';
      if (status === 'loading' || status === 'saving' || status === 'queued') return 'warn';
      if (status === 'anonymous' || status === 'offline') return 'info';
      if (status === 'conflict') return 'warn';
      return 'bad';
    }

    /**
     * @param {string} status
     * @returns {string}
     */
    function getSupabaseSessionLabel(status) {
      if (status === 'authenticated') return 'Autenticado';
      if (status === 'anonymous') return 'Anônimo';
      if (status === 'offline') return 'Offline';
      if (status === 'sdk-missing') return 'SDK ausente';
      if (status === 'error') return 'Erro';
      return 'Indefinido';
    }

    /**
     * @param {string} status
     * @returns {string}
     */
    function getSupabaseSyncLabel(status) {
      if (status === 'loading') return 'Carregando';
      if (status === 'saving') return 'Sincronizando';
      if (status === 'queued') return 'Na fila';
      if (status === 'conflict') return 'Conflito';
      if (status === 'error') return 'Erro';
      return 'Ocioso';
    }

    /** @returns {void} */
    function renderSupabasePanel() {
      const host = document.getElementById('supabaseAuthPanel');
      if (!host) return;

      const status = typeof getSupabaseStatus === 'function'
        ? getSupabaseStatus()
        : {
          enabled: false,
          hasEnv: false,
          hasSdk: false,
          reason: 'unavailable',
          unitSlug: null,
          sessionStatus: 'offline'
        };
      const backendState = typeof getSupabaseBackendState === 'function'
        ? getSupabaseBackendState()
        : {
          sessionStatus: status.sessionStatus,
          source: 'local',
          syncStatus: 'idle',
          conflictStatus: 'clear',
          syncPolicy: 'local-first-guarded',
          writable: false,
          memberships: [],
          activeUnit: null,
          user: null,
          lastSyncAt: null,
          lastError: null
        };

      let helperText = 'Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `env.js` para habilitar autenticação e leitura remota.';
      if (status.hasEnv && !status.hasSdk) {
        helperText = 'O contrato de ambiente existe, mas o SDK do Supabase não foi carregado neste runtime.';
      } else if (backendState.syncStatus === 'conflict') {
        helperText = 'O backend mudou desde a última leitura deste dispositivo. Recarregue do backend antes de tentar sincronizar novamente.';
      } else if (backendState.sessionStatus === 'authenticated') {
        helperText = backendState.source === 'supabase'
          ? 'A base ativa está vindo do backend com espelho local preservado.'
          : 'Sessão autenticada, mas o app está usando fallback local neste momento.';
      } else if (status.enabled) {
        helperText = 'Backend pronto. Faça login para carregar a unidade remota e ativar a sincronização híbrida.';
      }

      const membershipCount = Array.isArray(backendState.memberships) ? backendState.memberships.length : 0;
      const activeUnitLabel = backendState.activeUnit?.unitName || 'Nenhuma unidade ativa';
      const roleLabel = backendState.activeUnit?.role || '—';
      const sourceLabel = backendState.source === 'supabase' ? 'Supabase' : 'Local';
      const lastSyncLabel = backendState.lastSyncAt ? new Date(backendState.lastSyncAt).toLocaleString('pt-BR') : 'Ainda não sincronizado';
      const sessionPill = getSupabasePillClass(backendState.sessionStatus);
      const syncPill = getSupabasePillClass(backendState.syncStatus);
      const sourcePill = backendState.source === 'supabase' ? 'ok' : 'info';
      const authBlock = backendState.sessionStatus === 'authenticated'
        ? `
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Sessão atual</div>
              <div class="muted">${esc(backendState.user?.fullName || backendState.user?.email || 'Usuário autenticado')}</div>
              <div class="subtle-note">${esc(backendState.user?.email || '')}</div>
            </div>
          </div>
        `
        : `
          <div class="summary-item summary-item--col1">
            <div class="settings-about-grid">
              <label class="settings-about-item" for="supabaseEmailInput">
                <div class="name">E-mail</div>
                <input id="supabaseEmailInput" class="input" type="email" placeholder="dev.admin@wpm.local" autocomplete="username" />
              </label>
              <label class="settings-about-item" for="supabasePasswordInput">
                <div class="name">Senha</div>
                <input id="supabasePasswordInput" class="input" type="password" placeholder="••••••••" autocomplete="current-password" />
              </label>
            </div>
          </div>
        `;
      const actionButtons = backendState.sessionStatus === 'authenticated'
        ? `
          <button class="btn btn-success" data-action="supabase-reload">Recarregar do backend</button>
          <button class="btn btn-ghost" data-action="supabase-sync-now" ${backendState.writable ? '' : 'disabled aria-disabled="true" title="Perfil somente leitura no backend"'}>Sincronizar agora</button>
          <button class="btn btn-ghost" data-action="supabase-sign-out">Sair</button>
        `
        : `
          <button class="btn btn-success" data-action="supabase-sign-in" ${status.enabled ? '' : 'disabled aria-disabled="true"'}>Entrar no backend</button>
        `;

      host.innerHTML = `
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Autenticação e sincronização remota</div>
            <div class="muted">${esc(helperText)}</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Ambiente</div>
            <div class="muted"><span class="pill ${status.hasEnv ? 'ok' : 'info'}">${status.hasEnv ? 'Configurado' : 'Ausente'}</span></div>
          </div>
          <div>
            <div class="name">SDK</div>
            <div class="muted"><span class="pill ${status.hasSdk ? 'ok' : 'info'}">${status.hasSdk ? 'Carregado' : 'Ausente'}</span></div>
          </div>
          <div>
            <div class="name">Sessão</div>
            <div class="muted"><span class="pill ${sessionPill}">${esc(getSupabaseSessionLabel(backendState.sessionStatus))}</span></div>
          </div>
          <div>
            <div class="name">Sync remoto</div>
            <div class="muted"><span class="pill ${syncPill}">${esc(getSupabaseSyncLabel(backendState.syncStatus))}</span></div>
          </div>
        </div>
        ${authBlock}
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Fonte ativa</div>
            <div class="muted"><span class="pill ${sourcePill}">${esc(sourceLabel)}</span></div>
          </div>
          <div>
            <div class="name">Unidade</div>
            <div class="muted">${esc(activeUnitLabel)}</div>
          </div>
          <div>
            <div class="name">Perfil</div>
            <div class="muted">${esc(roleLabel)}${backendState.writable ? '' : ' • somente leitura'}</div>
          </div>
          <div>
            <div class="name">Última sync</div>
            <div class="muted">${esc(lastSyncLabel)}</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Memberships visíveis</div>
            <div class="muted">${esc(String(membershipCount))}</div>
          </div>
          <div>
            <div class="name">Slug preferido</div>
            <div class="muted">${esc(status.unitSlug || 'automático')}</div>
          </div>
          <div>
            <div class="name">Estratégia atual</div>
            <div class="muted">${backendState.syncPolicy === 'local-first-guarded' ? 'local-first com checkpoint remoto' : backendState.source === 'supabase' ? 'leitura remota + espelho local' : 'local-first com fallback pronto'}</div>
          </div>
          <div>
            <div class="name">Último erro</div>
            <div class="muted">${esc(backendState.lastError || 'Nenhum')}</div>
          </div>
        </div>
      `;

      const actionsHost = document.getElementById('supabaseAuthActions');
      if (actionsHost) actionsHost.innerHTML = actionButtons;
    }

    /** @returns {void} */
    function renderPeriodAudit() {
      const host = document.getElementById('periodAuditList');
      if (!host) return;
      const entries = Object.entries(storage.periods || {}).sort(([a], [b]) => a.localeCompare(b));
      host.innerHTML = entries.map(([key, period]) => {
        const metrics = getPeriodMetrics(period);
        const isEmpty = !periodHasMeaningfulData(period) && loadRecados(key).length === 0;
        const coverageOk = !isEmpty && metrics.students >= 30 && metrics.pending >= 20 && metrics.events >= 10 && metrics.scale > 0;
        const [year, month] = String(key).split('-');
        const monthName = MONTH_NAMES[Math.max(0, Number(month || 1) - 1)] || month;
        return `
          <div class="summary-item summary-item--audit settings-period-card ${isEmpty ? 'is-empty' : ''}">
            <div class="settings-period-head">
              <div class="settings-period-title">
                <div class="settings-period-month">${esc(monthName)}</div>
                <div class="settings-period-year">${esc(year)}</div>
                <div class="settings-period-meta">Ref. ${esc(String(key))}</div>
              </div>
              <div class="settings-period-status"><span class="pill ${isEmpty ? 'info' : coverageOk ? 'ok' : 'warn'}">${isEmpty ? 'Vazio' : coverageOk ? 'Completo' : 'Revisar'}</span></div>
            </div>
            <div class="settings-period-kpis">
              <div class="settings-period-kpi"><strong>${metrics.students}</strong><span>Alunos</span></div>
              <div class="settings-period-kpi"><strong>${metrics.pending}</strong><span>Pend.</span></div>
              <div class="settings-period-kpi"><strong>${metrics.events}</strong><span>Eventos</span></div>
              <div class="settings-period-kpi"><strong>${metrics.scale}</strong><span>Escala</span></div>
            </div>
            <div class="settings-period-foot">
              <span class="settings-period-chip">NPS ${metrics.mentions}</span>
              <span class="settings-period-chip">Addons ${metrics.addonVolume}</span>
              ${isEmpty ? '<span class="settings-period-chip">Sem massa operacional</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    /** @returns {Promise<void>} */
    async function clearEmptyMonths() {
      const removable = Object.entries(storage.periods || {})
        .filter(([key, period]) => key !== currentPeriodKey && !periodHasMeaningfulData(period) && loadRecados(key).length === 0)
        .map(([key]) => key);
      if (!removable.length) {
        showToast('Nenhum mês vazio encontrado para limpeza.', 'info');
        return;
      }
      showConfirm(`Remover ${removable.length} período(s) vazio(s) do armazenamento local? Essa ação mantém o mês ativo e ignora meses com recados.`, async () => {
        removable.forEach(key => {
          delete storage.periods[key];
        });
        const saved = await saveStore(storage);
        requestRender('settings');
        if (saved) showToast(`✓ ${removable.length} período(s) vazio(s) removido(s).`, 'success');
      });
    }

    /** @returns {void} */
    function resetDemoData() {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja restaurar o exemplo inicial? Isso substituirá os dados atuais.', async () => {
        const initialKey = getInitialPeriodKey();
        storage = normalizeStore({
          activePeriod: initialKey,
          preferences: normalizeStorePreferences(storage?.preferences),
          periods: seedYear(String(initialKey).split('-')[0], { withTestData: true }),
          archives: {}
        });
        currentPeriodKey = storage.activePeriod;
        state = storage.periods[currentPeriodKey];
        await saveData();
        renderAll();
        syncPeriodControls();
      });
    }
