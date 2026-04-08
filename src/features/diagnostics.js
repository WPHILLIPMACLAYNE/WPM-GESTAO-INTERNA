    // ══════════════════════════════════════════
    // DIAGNOSTICS — smoke tests de fluxo (backup, CSV, reset)
    // ══════════════════════════════════════════
    // Dependências globais (providas por scripts carregados antes):
    //   normalizeStore                                      — core/schema.js
    //   getBackupSummary                                    — core/backup.js
    //   buildEmptyPeriodFromTemplate                        — core/period-builder.js
    //   normalizeData                                       — core/lifecycle.js
    //   getPeriodMetrics                                    — ui/render-settings.js
    //   getPeriodLabel, esc                                 — utils/helpers.js
    //   storage                                             — estado global
    //   buildCsvContent, getPendingCsvRows, getScaleCsvRows,
    //   getEventsCsvRows                                    — features/csv.js
    //   readStoredJsonWithFallback, writeStoredJson,
    //   removeStoredValues                                  — core/storage.js
    //   requestRender                                       — ui/render-core.js
    //   showSaveToast, showToast                            — ui/events-core.js

    /** Loads the saved flow smoke test report from storage. @returns {FlowSmokeReportItem[]} */
    function loadFlowSmokeReport() {
      return readStoredJsonWithFallback(FLOW_TEST_REPORT_KEY, LEGACY_FLOW_TEST_REPORT_KEYS, []);
    }

    /** Persists a flow smoke test report to storage. @param {FlowSmokeReportItem[]} report @returns {FlowSmokeReportItem[]} */
    function saveFlowSmokeReport(report) {
      writeStoredJson(FLOW_TEST_REPORT_KEY, report);
      removeStoredValues(LEGACY_FLOW_TEST_REPORT_KEYS);
      return report;
    }

    /** Removes all stored smoke test data. @returns {void} */
    function clearFlowSmokeTests() {
      removeStoredValues([FLOW_TEST_REPORT_KEY, ...LEGACY_FLOW_TEST_REPORT_KEYS]);
      requestRender('settings');
      showSaveToast('✓ relatório de autotestes limpo');
    }

    /** Renders the smoke test results panel in the DOM. @returns {void} */
    function renderFlowSmokePanel() {
      const host = document.getElementById('flowSmokeList');
      if (!host) return;
      const report = loadFlowSmokeReport();
      if (!report.length) {
        host.innerHTML = `<div class="summary-item summary-item--col1"><div><div class="name">Autotestes ainda não executados</div><div class="muted">Use "Executar autotestes" para validar backup, reset e CSVs sem alterar os dados reais.</div></div></div>`;
        return;
      }
      host.innerHTML = report.map(item => `
        <div class="summary-item summary-item--col2">
          <div><span class="pill ${item.status === 'ok' ? 'ok' : item.status === 'bad' ? 'bad' : item.status === 'warn' ? 'warn' : 'info'}">${item.status === 'ok' ? 'OK' : item.status === 'bad' ? 'Falha' : item.status === 'warn' ? 'Alerta' : 'Info'}</span></div>
          <div>
            <div class="name">${esc(item.label)}</div>
            <div class="muted">${esc(item.detail)}</div>
          </div>
        </div>
      `).join('');
    }

    /** Executes all flow smoke tests and saves the report. @param {boolean} [silent] @returns {FlowSmokeReportItem[]} */
    function runFlowSmokeTests(silent = false) {
      const clonedStore = normalizeStore(structuredClone(storage));
      const originalSummary = getBackupSummary(clonedStore);
      const payload = {
        version: clonedStore.version,
        activePeriod: clonedStore.activePeriod,
        periods: clonedStore.periods,
        archives: clonedStore.archives
      };
      const roundTripStore = normalizeStore(JSON.parse(JSON.stringify(payload)));
      const roundTripSummary = getBackupSummary(roundTripStore);
      const activePeriod = clonedStore.periods[clonedStore.activePeriod];
      const pendingCsv = buildCsvContent(getPendingCsvRows(activePeriod));
      const scaleCsv = buildCsvContent(getScaleCsvRows(activePeriod));
      const eventsCsv = buildCsvContent(getEventsCsvRows(activePeriod));
      const resetClone = normalizeStore(structuredClone(storage));
      const resetKey = resetClone.activePeriod;
      resetClone.periods[resetKey] = buildEmptyPeriodFromTemplate(resetClone.periods[resetKey], resetKey);
      normalizeData(resetClone.periods[resetKey]);
      const resetMetrics = getPeriodMetrics(resetClone.periods[resetKey]);
      const report = [
        {
          label: 'Round-trip de backup JSON',
          status: JSON.stringify(originalSummary) === JSON.stringify(roundTripSummary) ? 'ok' : 'bad',
          detail: `${originalSummary.periods} períodos comparados antes e depois da serialização.`
        },
        {
          label: 'Exportação CSV de pendências',
          status: pendingCsv.split('\n').length > 1 ? 'ok' : 'bad',
          detail: `${Math.max(0, pendingCsv.split('\n').length - 1)} linha(s) de dados prontas para exportação em ${getPeriodLabel(resetKey)}.`
        },
        {
          label: 'Exportação CSV de escala',
          status: scaleCsv.split('\n').length > 1 ? 'ok' : 'bad',
          detail: `${Math.max(0, scaleCsv.split('\n').length - 1)} linha(s) de escala preparadas para download.`
        },
        {
          label: 'Exportação CSV de eventos',
          status: eventsCsv.split('\n').length > 1 ? 'ok' : 'bad',
          detail: `${Math.max(0, eventsCsv.split('\n').length - 1)} linha(s) de agenda preparadas para download.`
        },
        {
          label: 'Reset do mês em simulação',
          status: resetMetrics.recados === 0 && resetMetrics.students === 0 && resetMetrics.pending === 0 && resetMetrics.events === 0 && resetMetrics.scale === 0 && resetMetrics.mentions === 0 && resetMetrics.addonVolume === 0 ? 'ok' : 'bad',
          detail: `${resetMetrics.recados} recados • ${resetMetrics.students} alunos • ${resetMetrics.pending} pendências • ${resetMetrics.events} eventos • ${resetMetrics.scale} registros de escala • ${resetMetrics.mentions} menções • ${resetMetrics.addonVolume} addons após reset simulado.`
        },
        {
          label: 'Cobertura anual mínima',
          status: Object.keys(clonedStore.periods || {}).length >= 12 ? 'ok' : 'warn',
          detail: `${Object.keys(clonedStore.periods || {}).length} períodos disponíveis para navegação/teste.`
        }
      ];
      saveFlowSmokeReport(report);
      requestRender('settings');
      if (!silent) {
        const failures = report.filter(item => item.status === 'bad').length;
        const warnings = report.filter(item => item.status === 'warn').length;
        const type = failures > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success';
        showToast(`Autotestes concluídos: ${report.length - failures - warnings} ok, ${warnings} alerta(s), ${failures} falha(s).`, type, 4500);
      }
      return report;
    }
