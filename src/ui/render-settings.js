    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — SETTINGS & DIAGNOSTICS — renderSettings, saveSettings, resizeMonth, renderBackupSummary, runSystemDiagnostics, importData, exportData
    // ══════════════════════════════════════════

    function renderSettings() {
      if (!state?.settings) return;
      document.getElementById('receptionistEditor').value = getReceptionists(state).join('\n');
      document.getElementById('professorEditor').value = getProfessors(state).join('\n');
      document.getElementById('addonTypeEditor').value = state.settings.addonTypes.join('\n');
      renderSettingsHealthBar();
      renderSettingsSupportPanels();
      renderBackupSummary();
      renderDiagnosticsPanel();
      renderPersistenceTechPanel();
      renderPeriodAudit();
      renderFlowSmokePanel();
    }

    async function saveSettings() {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const { receptionists, professors, addonTypes } = getSettingsFormData();
      if (!receptionists.length || !addonTypes.length) { showToast('Informe ao menos uma recepcionista e um tipo de addon.', 'warning'); return; }
      const old = structuredClone(state);
      state.settings.receptionists = receptionists;
      state.settings.professors = professors;
      state.settings.team = [...new Set([...receptionists, ...professors])];
      state.settings.addonTypes = addonTypes;
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
      if (saved) showToast('Configurações salvas com sucesso.');
    }

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

    function getBackupSummary(storeRef = storage) {
      const periods = Object.entries(storeRef.periods || {});
      const totals = periods.reduce((acc, [_, period]) => {
        const metrics = getPeriodMetrics(period);
        acc.recados += metrics.recados;
        acc.students += metrics.students;
        acc.pending += metrics.pending;
        acc.events += metrics.events;
        acc.scale += metrics.scale;
        acc.mentions += metrics.mentions;
        acc.addonVolume += metrics.addonVolume;
        return acc;
      }, { recados: 0, students: 0, pending: 0, events: 0, scale: 0, mentions: 0, addonVolume: 0 });
      return {
        periods: periods.length,
        archives: Object.keys(storeRef.archives || {}).length,
        ...totals
      };
    }

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
          UI_KEY,
          ...LEGACY_STORAGE_KEYS,
          ...LEGACY_LOCAL_SNAPSHOT_KEYS,
          ...LEGACY_SYSTEM_REPORT_KEYS,
          ...LEGACY_FLOW_TEST_REPORT_KEYS,
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
              <div class="value">${esc(APP_VERSION)}</div>
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
              <div class="settings-storage-fill" style="width:${Math.min(100, usage.ratio * 100)}%"></div>
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

    function isLegacyPeriodPayload(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      return ['settings', 'students', 'pending', 'recados', 'nps', 'scale', 'events', 'addons', 'escala', 'eventos'].some(key => key in payload);
    }

    function extractImportedPayload(source) {
      const cleanedRoot = sanitizeDeep(cloneSerializable(source));
      const payload = cleanedRoot?.payload && typeof cleanedRoot.payload === 'object' && !Array.isArray(cleanedRoot.payload)
        ? cleanedRoot.payload
        : cleanedRoot;
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    }

    function isMonthArchivePayload(payload) {
      return Boolean(
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        isValidPeriodKey(payload.periodKey) &&
        payload.data &&
        typeof payload.data === 'object' &&
        !Array.isArray(payload.data)
      );
    }

    function getMonthArchiveImportMeta(payload) {
      if (!isMonthArchivePayload(payload)) return null;
      const periodKey = String(payload.periodKey);
      return {
        periodKey,
        periodLabel: String(payload.periodLabel || '').trim() || getPeriodLabel(periodKey),
        exportedAt: String(payload?.meta?.exportedAt || '').trim()
      };
    }

    function buildArchiveEntryFromMonthArchivePayload(payload, existingArchive = null) {
      const meta = getMonthArchiveImportMeta(payload);
      if (!meta) return existingArchive || null;
      const exportedDate = meta.exportedAt ? new Date(meta.exportedAt) : null;
      const hasValidExportedDate = exportedDate && !Number.isNaN(exportedDate.getTime());
      const fallbackDate = existingArchive?.closedAt ? new Date(existingArchive.closedAt) : new Date();
      const normalizedDate = hasValidExportedDate ? exportedDate : fallbackDate;

      return {
        closedAt: normalizedDate.toISOString(),
        closedAtLabel: normalizedDate.toLocaleString('pt-BR'),
        label: meta.periodLabel || existingArchive?.label || getPeriodLabel(meta.periodKey)
      };
    }

    function buildStoreFromMonthArchivePayload(payload, baseStore = storage) {
      const meta = getMonthArchiveImportMeta(payload);
      if (!meta) return null;

      const baseCandidate = prepareStoreCandidate(cloneSerializable(baseStore)) || getDefaultStore();
      const nextStore = cloneSerializable(baseCandidate);
      nextStore.periods ||= {};
      nextStore.archives ||= {};
      nextStore.periods[meta.periodKey] = cloneSerializable(payload.data);
      normalizeData(nextStore.periods[meta.periodKey]);
      nextStore.archives[meta.periodKey] = buildArchiveEntryFromMonthArchivePayload(payload, nextStore.archives[meta.periodKey]);
      return prepareStoreCandidate(nextStore);
    }

    function getImportedPayloadDescriptor(source) {
      const payload = extractImportedPayload(source);
      if (!payload) return { kind: 'unknown' };
      if (isMonthArchivePayload(payload)) {
        const meta = getMonthArchiveImportMeta(payload);
        return {
          kind: 'month-archive',
          periodKey: meta.periodKey,
          periodLabel: meta.periodLabel
        };
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return {
          kind: 'full-backup',
          periodCount: Object.keys(payload.periods).filter(isValidPeriodKey).length
        };
      }
      if (isLegacyPeriodPayload(payload)) {
        return { kind: 'legacy-period' };
      }
      return { kind: 'unknown' };
    }

    function coerceImportedStore(source) {
      const payload = extractImportedPayload(source);
      if (!payload) return null;
      if (isMonthArchivePayload(payload)) {
        return buildStoreFromMonthArchivePayload(payload, storage);
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return prepareStoreCandidate(payload);
      }
      if (isLegacyPeriodPayload(payload)) {
        const initialKey = getInitialPeriodKey();
        return prepareStoreCandidate({
          version: getStoreVersion(payload),
          activePeriod: initialKey,
          periods: { [initialKey]: payload },
          archives: {}
        });
      }
      return null;
    }

    async function buildBackupPayload(options = {}) {
      const storeSnapshot = await getCommittedStoreSnapshot({
        persistCurrent: options?.persistCurrent !== false,
        eventType: String(options?.eventType || 'save'),
        broadcast: options?.broadcast === true
      });
      return buildBackupPayloadFromStore(storeSnapshot);
    }

    async function applyImportedStore(parsed, options = {}) {
      const normalized = coerceImportedStore(parsed);
      if (!normalized) throw new Error('Estrutura inválida ou incompatível com o schema atual.');
      const saved = await saveStore(normalized, {
        silent: true,
        eventType: String(options.eventType || 'import')
      });
      if (!saved) throw new Error('Falha ao persistir o backup importado.');
      const committedStore = await readStoredStore(STORAGE_KEY);
      if (!committedStore) throw new Error('Falha ao recarregar o store importado após persistir.');
      await syncAppState(committedStore);
      renderAll();
      syncPeriodControls();
      runSystemDiagnostics(true);
      return getBackupSummary(storage);
    }

    async function saveLocalSnapshot(payload = null) {
      const snapshotPayload = payload || await buildBackupPayload({
        persistCurrent: true,
        eventType: 'snapshot',
        broadcast: false
      });
      const snapshot = { savedAt: new Date().toISOString(), payload: snapshotPayload };
      const result = await persistStoredJson(
        LOCAL_SNAPSHOT_KEY,
        snapshot,
        'Armazenamento cheio. Não foi possível salvar o snapshot local.'
      );
      if (result.ok) {
        await removeStoredValues(LEGACY_LOCAL_SNAPSHOT_KEYS);
        requestRender('settings');
        showSaveToast('✓ snapshot local salvo');
      }
      return result.ok ? snapshot : null;
    }

    function restoreLocalSnapshot() {
      if (!assertWritableCurrentPeriod()) return;
      const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
      if (!snapshot) { showToast('Nenhum snapshot local foi salvo ainda.', 'info'); return; }
      showConfirm('Deseja restaurar o último snapshot local? Isso substituirá o estado atual.', async () => {
        try {
          const summary = await applyImportedStore(snapshot.payload || snapshot, { eventType: 'restore' });
          showToast(`Snapshot restaurado: ${summary.periods} períodos carregados.`);
        } catch {
          showToast('Snapshot local inválido ou corrompido.', 'danger');
        }
      });
    }

    function loadSystemReport() {
      return readStoredJsonWithFallback(SYSTEM_REPORT_KEY, LEGACY_SYSTEM_REPORT_KEYS, []);
    }

    function saveSystemReport(report) {
      writeStoredJson(SYSTEM_REPORT_KEY, report);
      removeStoredValues(LEGACY_SYSTEM_REPORT_KEYS);
      return report;
    }

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

    function renderPersistenceTechPanel() {
      const host = document.getElementById('persistenceTechList');
      if (!host) return;

      const statusPillClass = persistenceTechState.status === 'pronto'
        ? 'ok'
        : persistenceTechState.status === 'sincronizando'
          ? 'warn'
          : 'bad';
      const statusLabel = persistenceTechState.status === 'pronto'
        ? 'Pronto'
        : persistenceTechState.status === 'sincronizando'
          ? 'Sincronizando'
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
            <div class="muted">${esc(persistenceTechState.modeLabel)}</div>
          </div>
          <div>
            <div class="name">Status da persistência</div>
            <div class="muted"><span class="pill ${statusPillClass}">${statusLabel}</span></div>
          </div>
          <div>
            <div class="name">Backend principal</div>
            <div class="muted">${esc(persistenceTechState.backendLabel)}</div>
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

    async function downloadData() {
      const payload = await buildBackupPayload({
        persistCurrent: true,
        eventType: 'backup',
        broadcast: false
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const now = new Date();
      const ts = `${todayISO()}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
      a.download = `smartfit-recepcao-backup-${ts}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      await saveLocalSnapshot(payload);
      showSaveToast('✓ backup exportado com sucesso');
    }

    function importData(file) {
      if (!assertWritableCurrentPeriod()) return;
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { showToast('Arquivo muito grande (máximo: 50MB).', 'danger'); return; }
      if (!file.name.endsWith('.json')) { showToast('Formato inválido. Selecione um arquivo .json.', 'warning'); return; }
      const reader = new FileReader();
      reader.onerror = () => showToast('Erro ao ler o arquivo. Tente novamente.', 'danger');
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result);
          const descriptor = getImportedPayloadDescriptor(parsed);
          const importedStore = coerceImportedStore(parsed);
          if (!importedStore) throw new Error('Dados não reconhecidos');
          const confirmMessage = descriptor.kind === 'month-archive'
            ? `Confirmar importação do fechamento de ${descriptor.periodLabel}? Somente ${descriptor.periodLabel} será restaurado/atualizado e marcado como fechado. Um backup será gerado antes.`
            : 'Confirmar importação e substituir todos os dados atuais? Um backup será gerado antes.';
          showConfirm(confirmMessage, async () => {
            try {
              await downloadData();
              const summary = await applyImportedStore(parsed, { eventType: 'import' });
              const successMessage = descriptor.kind === 'month-archive'
                ? `Fechamento de ${descriptor.periodLabel} importado com sucesso. Demais períodos foram preservados.`
                : `Backup importado: ${summary.periods} períodos • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos.`;
              showToast(successMessage, 'success', 5000);
            } catch (err) {
              showToast('Erro ao aplicar backup: ' + (err.message || 'erro desconhecido'), 'danger');
            }
          });
        } catch (err) {
          showToast('Arquivo inválido. Importe um backup JSON gerado pelo app. Detalhe: ' + (err.message || 'erro desconhecido'), 'danger', 5000);
        }
      };
      reader.readAsText(file);
    }

    function resetDemoData() {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja restaurar o exemplo inicial? Isso substituirá os dados atuais.', async () => {
        const initialKey = getInitialPeriodKey();
        storage = normalizeStore({ activePeriod: initialKey, periods: seedYear(String(initialKey).split('-')[0]), archives: {} });
        currentPeriodKey = storage.activePeriod;
        state = storage.periods[currentPeriodKey];
        await saveData();
        renderAll();
        syncPeriodControls();
      });
    }
