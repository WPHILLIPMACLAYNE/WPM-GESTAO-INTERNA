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

    /** @returns {Object|null} */
    function loadMigrationDryRunReport() {
      return readStoredJsonWithFallback(
        MIGRATION_DRY_RUN_REPORT_KEY,
        LEGACY_MIGRATION_DRY_RUN_REPORT_KEYS,
        null
      );
    }

    /** @param {Object|null} report @returns {Promise<Object|null>} */
    async function saveMigrationDryRunReport(report) {
      if (!report || typeof report !== 'object') return null;
      await writeStoredJson(MIGRATION_DRY_RUN_REPORT_KEY, report);
      await removeStoredValues(LEGACY_MIGRATION_DRY_RUN_REPORT_KEYS);
      return report;
    }

    /** @returns {Promise<void>} */
    async function clearMigrationDryRunReport() {
      await removeStoredValues([MIGRATION_DRY_RUN_REPORT_KEY, ...LEGACY_MIGRATION_DRY_RUN_REPORT_KEYS]);
      requestRender('settings');
      showSaveToast('✓ relatório de migração limpo');
    }

    /**
     * @param {PeriodData} period
     * @returns {Object}
     */
    function getMigrationEntityCounts(period) {
      normalizeData(period);
      const addonRows = Object.values(period.addons || {}).reduce((acc, byType) => {
        return acc + Object.values(byType || {}).reduce((sum, days) => {
          return sum + (Array.isArray(days) ? days.filter(value => Number(value || 0) > 0).length : 0);
        }, 0);
      }, 0);
      const addonVolume = Object.values(period.addons || {}).reduce((acc, byType) => {
        return acc + Object.values(byType || {}).reduce((sum, days) => {
          return sum + (Array.isArray(days) ? days.reduce((dayAcc, value) => dayAcc + Math.max(0, Number(value || 0)), 0) : 0);
        }, 0);
      }, 0);
      const professorShiftRows = (period.scale || []).reduce((acc, item) => acc + (Array.isArray(item?.professorShifts) ? item.professorShifts.length : 0), 0);
      return {
        recados: (period.recados || []).length,
        students: (period.students || []).length,
        pending: (period.pending || []).length,
        events: (period.events || []).length,
        scaleDays: (period.scale || []).length,
        professorShiftRows,
        npsMentions: (period.nps?.mentions || []).length,
        addonRows,
        addonVolume
      };
    }

    /**
     * @param {AppStore} storeRef
     * @returns {{periodCount: number, archiveCount: number, totals: Object, periods: Object}}
     */
    function buildMigrationStoreSnapshot(storeRef) {
      const candidate = prepareStoreCandidate(cloneSerializable(storeRef));
      const periods = Object.entries(candidate?.periods || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .reduce((acc, [periodKey, period]) => {
          acc[periodKey] = getMigrationEntityCounts(period);
          return acc;
        }, {});

      const totals = Object.values(periods).reduce((acc, item) => {
        Object.keys(item).forEach(key => {
          acc[key] = Number(acc[key] || 0) + Number(item[key] || 0);
        });
        return acc;
      }, {
        recados: 0,
        students: 0,
        pending: 0,
        events: 0,
        scaleDays: 0,
        professorShiftRows: 0,
        npsMentions: 0,
        addonRows: 0,
        addonVolume: 0
      });

      return {
        periodCount: Object.keys(periods).length,
        archiveCount: Object.keys(candidate?.archives || {}).length,
        totals,
        periods
      };
    }

    /**
     * @param {Object<string, Object>} left
     * @param {Object<string, Object>} right
     * @returns {{matches: boolean, mismatches: Array<Object>}}
     */
    function compareMigrationSnapshots(left, right) {
      const leftPeriods = left && typeof left === 'object' ? left : {};
      const rightPeriods = right && typeof right === 'object' ? right : {};
      const periodKeys = [...new Set([...Object.keys(leftPeriods), ...Object.keys(rightPeriods)])].sort();
      const mismatches = [];

      periodKeys.forEach(periodKey => {
        const leftCounts = leftPeriods[periodKey] || null;
        const rightCounts = rightPeriods[periodKey] || null;
        const entityKeys = [...new Set([
          ...Object.keys(leftCounts || {}),
          ...Object.keys(rightCounts || {})
        ])];

        entityKeys.forEach(entityKey => {
          const leftValue = Number(leftCounts?.[entityKey] || 0);
          const rightValue = Number(rightCounts?.[entityKey] || 0);
          if (leftValue === rightValue) return;
          mismatches.push({
            periodKey,
            entityKey,
            local: leftValue,
            remote: rightValue
          });
        });
      });

      return {
        matches: mismatches.length === 0,
        mismatches
      };
    }

    /**
     * @returns {Array<{periodKey: string, count: number}>}
     */
    function getLegacyRecadosSnapshot() {
      if (typeof getLegacyRecadoPeriodKeys !== 'function' || typeof readLegacyRecados !== 'function') return [];
      return getLegacyRecadoPeriodKeys().map(periodKey => ({
        periodKey,
        count: readLegacyRecados(periodKey).length
      }));
    }

    /**
     * @param {{cleanup?: boolean, eventType?: string}} [options]
     * @returns {Promise<AppStore>}
     */
    async function buildMigrationCandidateStore(options = {}) {
      const committedStore = typeof readStoredStore === 'function'
        ? await readStoredStore(STORAGE_KEY)
        : null;
      const inMemoryStore = typeof storage === 'object' && storage
        ? prepareStoreCandidate(cloneSerializable(storage))
        : null;
      const localStore = committedStore || inMemoryStore || getDefaultStore();
      const localClone = cloneSerializable(localStore);
      if (typeof migrateLegacyRecadosToStore === 'function') {
        await migrateLegacyRecadosToStore(localClone, {
          persist: false,
          cleanup: options.cleanup === true,
          eventType: String(options?.eventType || 'migration-dry-run')
        });
      }
      return localClone;
    }

    /**
     * @param {Object|null} report
     * @returns {'unavailable'|'empty'|'present'|'error'}
     */
    function getMigrationRemoteState(report) {
      const backend = report?.backend || {};
      if (backend.remoteError) return 'error';
      if (report?.remote) return 'present';
      if (backend.enabled && backend.sessionStatus === 'authenticated') return 'empty';
      return 'unavailable';
    }

    /**
     * @param {Object|null} report
     * @returns {{status: string, tone: string, canMigrate: boolean, reason: string|null, label: string, detail: string}}
     */
    function getMigrationReadiness(report) {
      if (!report || typeof report !== 'object') {
        return {
          status: 'pending',
          tone: 'info',
          canMigrate: false,
          reason: 'dry-run-missing',
          label: 'Dry-run pendente',
          detail: 'Execute o dry-run para validar a base local antes de liberar a migração.'
        };
      }

      const backend = report.backend || {};
      if (!backend.enabled || backend.sessionStatus !== 'authenticated') {
        return {
          status: 'blocked',
          tone: 'info',
          canMigrate: false,
          reason: 'backend-auth-required',
          label: 'Login necessário',
          detail: 'Faça login no backend com a unidade correta antes de migrar.'
        };
      }

      if (backend.writable !== true) {
        return {
          status: 'blocked',
          tone: 'warn',
          canMigrate: false,
          reason: 'backend-readonly',
          label: 'Perfil sem escrita',
          detail: 'A sessão atual não tem permissão de escrita para concluir a migração.'
        };
      }

      if (backend.remoteError) {
        return {
          status: 'blocked',
          tone: 'warn',
          canMigrate: false,
          reason: 'remote-compare-failed',
          label: 'Comparação remota falhou',
          detail: 'Corrija a leitura da base remota antes de migrar para evitar sobrescrita cega.'
        };
      }

      const remoteState = getMigrationRemoteState(report);
      if (remoteState === 'empty') {
        return {
          status: 'ready',
          tone: 'ok',
          canMigrate: true,
          reason: null,
          label: 'Primeira migração liberada',
          detail: 'O backend da unidade ainda está vazio. A primeira importação pode ser executada com backup local automático.'
        };
      }

      if (remoteState !== 'present') {
        return {
          status: 'blocked',
          tone: 'warn',
          canMigrate: false,
          reason: 'remote-compare-missing',
          label: 'Comparação remota ausente',
          detail: 'A migração assistida só é liberada depois de comparar a base local com a unidade remota.'
        };
      }

      const mismatchCount = Number(report.comparison?.mismatches?.length || 0);
      if (mismatchCount > 0) {
        return {
          status: 'blocked',
          tone: 'warn',
          canMigrate: false,
          reason: 'remote-mismatch',
          label: 'Divergências detectadas',
          detail: `${mismatchCount} divergência(s) entre local e remoto precisam ser revisadas antes da migração.`
        };
      }

      return {
        status: 'ready',
        tone: 'ok',
        canMigrate: true,
        reason: null,
        label: 'Pronto para migrar',
        detail: 'Dry-run local e comparação remota consistentes. O botão de migração já pode ser usado.'
      };
    }

    /**
     * @param {Object|null} report
     * @returns {void}
     */
    function syncMigrationActionState(report) {
      const actionButton = document.querySelector('[data-action="run-assisted-migration"]');
      if (!actionButton) return;
      const readiness = getMigrationReadiness(report);
      actionButton.disabled = readiness.canMigrate !== true;
      actionButton.title = readiness.canMigrate ? 'Executar migração assistida para o backend.' : readiness.detail;
      actionButton.setAttribute('aria-disabled', actionButton.disabled ? 'true' : 'false');
    }

    /**
     * @param {Object|null} report
     * @returns {Array<{label: string, status: string, detail: string}>}
     */
    function buildMigrationHomologationSteps(report) {
      const liveBackendState = typeof getSupabaseBackendState === 'function'
        ? getSupabaseBackendState()
        : { sessionStatus: 'offline', writable: false };
      const readiness = getMigrationReadiness(report);
      const remoteState = getMigrationRemoteState(report);
      const mismatchCount = Number(report?.comparison?.mismatches?.length || 0);
      const generatedAt = report?.generatedAt ? new Date(report.generatedAt).toLocaleString('pt-BR') : null;
      const localPeriods = Number(report?.local?.periodCount || 0);
      const localRecados = Number(report?.local?.totals?.recados || 0);

      return [
        {
          label: '1. Sessão backend',
          status: liveBackendState.sessionStatus === 'authenticated'
            ? liveBackendState.writable ? 'ok' : 'warn'
            : 'info',
          detail: liveBackendState.sessionStatus === 'authenticated'
            ? liveBackendState.writable
              ? 'Sessão autenticada com perfil gravável. Mantenha a homologação em uma única janela/dispositivo.'
              : 'Sessão autenticada, mas sem permissão de escrita. Ajuste o perfil antes de continuar.'
            : 'Faça login no backend com a unidade correta e perfil gravável.'
        },
        {
          label: '2. Dry-run local',
          status: report ? 'ok' : 'info',
          detail: report
            ? `Último dry-run em ${generatedAt}. Snapshot local com ${localPeriods} período(s) e ${localRecados} recado(s).`
            : 'Execute o dry-run para consolidar recados legados em clone e conferir as contagens locais.'
        },
        {
          label: '3. Situação remota',
          status: remoteState === 'error'
            ? 'bad'
            : remoteState === 'present' && mismatchCount > 0
              ? 'warn'
              : remoteState === 'present' || remoteState === 'empty'
                ? 'ok'
                : 'info',
          detail: remoteState === 'error'
            ? (report?.backend?.remoteError || 'Falha ao ler a base remota.')
            : remoteState === 'empty'
              ? 'Backend da unidade ainda vazio. Este é o cenário esperado para a primeira migração real.'
              : remoteState === 'present' && mismatchCount > 0
                ? `${mismatchCount} divergência(s) detectadas entre local e remoto. Não migrar até revisar.`
                : remoteState === 'present'
                  ? 'Contagens remotas consistentes com a base local. Cenário seguro para reimportação assistida.'
                  : 'A comparação remota ainda não foi executada com sessão autenticada.'
        },
        {
          label: '4. Migração assistida',
          status: readiness.canMigrate ? 'ok' : report ? 'warn' : 'info',
          detail: readiness.canMigrate
            ? 'O botão de migração já pode ser usado. O app gera backup local antes do envio transacional.'
            : report
              ? readiness.detail
              : 'A migração assistida só é liberada depois do preflight acima.'
        },
        {
          label: '5. Validação pós-migração',
          status: 'info',
          detail: 'Após migrar: recarregue do backend, confira meses fechados e valide amostra mínima de alunos, pendências, escala, eventos, NPS, addons e recados.'
        },
        {
          label: 'Referência operacional',
          status: 'info',
          detail: 'Procedimento detalhado no repositório: Docs/HOMOLOGACAO_MIGRACAO_REAL.md'
        }
      ];
    }

    /**
     * @param {boolean} [silent]
     * @returns {Promise<Object>}
     */
    async function runMigrationDryRun(silent = false) {
      const localClone = await buildMigrationCandidateStore();
      const legacyRecados = getLegacyRecadosSnapshot();
      const localSnapshot = buildMigrationStoreSnapshot(localClone);
      const backendStatus = typeof getSupabaseStatus === 'function'
        ? getSupabaseStatus()
        : { enabled: false, sessionStatus: 'offline' };
      const backendState = typeof getSupabaseBackendState === 'function'
        ? getSupabaseBackendState()
        : { sessionStatus: backendStatus.sessionStatus, source: 'local' };

      let remoteSnapshot = null;
      let comparison = null;
      let remoteError = null;
      let remoteState = 'unavailable';

      if (backendStatus.enabled
        && backendState.sessionStatus === 'authenticated'
        && typeof loadStoreFromSupabase === 'function') {
        remoteState = 'empty';
        try {
          const remoteStore = await loadStoreFromSupabase(localClone);
          if (remoteStore) {
            remoteSnapshot = buildMigrationStoreSnapshot(remoteStore);
            comparison = compareMigrationSnapshots(localSnapshot.periods, remoteSnapshot.periods);
            remoteState = 'present';
          }
        } catch (error) {
          remoteError = error?.message || 'Falha ao carregar a base remota para comparação.';
          remoteState = 'error';
        }
      }

      const report = {
        generatedAt: new Date().toISOString(),
        local: localSnapshot,
        remote: remoteSnapshot,
        comparison,
        legacyRecados: {
          periods: legacyRecados.length,
          total: legacyRecados.reduce((acc, item) => acc + Number(item.count || 0), 0),
          items: legacyRecados
        },
        backend: {
          enabled: Boolean(backendStatus.enabled),
          sessionStatus: backendState.sessionStatus || backendStatus.sessionStatus || 'offline',
          source: backendState.source || 'local',
          writable: backendState.writable === true,
          remoteState,
          remoteError
        }
      };

      await saveMigrationDryRunReport(report);
      requestRender('settings');
      if (!silent) {
        const mismatchCount = Number(report.comparison?.mismatches?.length || 0);
        const type = report.backend.remoteError
          ? 'warning'
          : mismatchCount > 0
            ? 'warning'
            : 'success';
        const remoteLabel = report.backend.remoteState === 'empty'
          ? 'backend remoto vazio'
          : report.remote
            ? `${report.remote.periodCount} período(s) remoto(s) comparados`
            : 'comparação remota indisponível';
        showToast(`Dry-run de migração concluído: ${report.local.periodCount} período(s) locais, ${remoteLabel}, ${mismatchCount} divergência(s).`, type, 5000);
      }
      return report;
    }

    /** @returns {void} */
    function renderMigrationDryRunPanel() {
      const host = document.getElementById('migrationDryRunList');
      if (!host) return;
      const report = loadMigrationDryRunReport();
      if (!report) {
        syncMigrationActionState(null);
        host.innerHTML = `<div class="summary-item summary-item--col1"><div><div class="name">Dry-run ainda não executado</div><div class="muted">Use "Executar dry-run" para comparar o store local com o backend e verificar recados legados antes de migrar.</div></div></div>`;
        return;
      }

      syncMigrationActionState(report);
      const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString('pt-BR') : 'agora';
      const mismatchCount = Number(report?.comparison?.mismatches?.length || 0);
      const local = report.local || { periodCount: 0, archiveCount: 0, totals: {} };
      const remote = report.remote;
      const legacy = report.legacyRecados || { periods: 0, total: 0, items: [] };
      const readiness = getMigrationReadiness(report);
      const remoteState = getMigrationRemoteState(report);
      const remoteTone = report.backend?.remoteError
        ? 'warn'
        : mismatchCount > 0
          ? 'warn'
          : remote
            ? 'ok'
            : remoteState === 'empty'
              ? 'ok'
              : 'info';
      const remoteLabel = report.backend?.remoteError
        ? 'Comparação remota falhou'
        : remote
          ? mismatchCount > 0
            ? 'Comparação com divergências'
            : 'Comparação remota consistente'
          : remoteState === 'empty'
            ? 'Backend vazio'
            : 'Sem comparação remota';

      host.innerHTML = `
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Último dry-run</div>
            <div class="muted">Executado em ${esc(generatedAt)}.</div>
            <div class="subtle-note">Recados legados são consolidados em clone antes da simulação; nada é alterado no estado real.</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Prontidão</div>
            <div class="muted"><span class="pill ${readiness.tone}">${esc(readiness.label)}</span></div>
          </div>
          <div>
            <div class="name">Sessão backend</div>
            <div class="muted">${esc(String(report.backend?.sessionStatus || 'offline'))}</div>
          </div>
          <div>
            <div class="name">Perfil gravável</div>
            <div class="muted">${report.backend?.writable ? 'Sim' : 'Não'}</div>
          </div>
          <div>
            <div class="name">Próximo passo</div>
            <div class="muted">${esc(readiness.detail)}</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Períodos locais</div>
            <div class="muted"><strong>${esc(String(local.periodCount || 0))}</strong></div>
          </div>
          <div>
            <div class="name">Arquivos fechados</div>
            <div class="muted"><strong>${esc(String(local.archiveCount || 0))}</strong></div>
          </div>
          <div>
            <div class="name">Recados legados</div>
            <div class="muted"><strong>${esc(String(legacy.total || 0))}</strong> em ${esc(String(legacy.periods || 0))} período(s)</div>
          </div>
          <div>
            <div class="name">Comparação remota</div>
            <div class="muted"><span class="pill ${remoteTone}">${esc(remoteLabel)}</span></div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div><div class="name">Alunos</div><div class="muted">${esc(String(local.totals?.students || 0))}</div></div>
          <div><div class="name">Pendências</div><div class="muted">${esc(String(local.totals?.pending || 0))}</div></div>
          <div><div class="name">Eventos</div><div class="muted">${esc(String(local.totals?.events || 0))}</div></div>
          <div><div class="name">Escala</div><div class="muted">${esc(String(local.totals?.scaleDays || 0))} dia(s) • ${esc(String(local.totals?.professorShiftRows || 0))} turno(s)</div></div>
        </div>
        <div class="summary-item summary-item--col4">
          <div><div class="name">Recados</div><div class="muted">${esc(String(local.totals?.recados || 0))}</div></div>
          <div><div class="name">Menções NPS</div><div class="muted">${esc(String(local.totals?.npsMentions || 0))}</div></div>
          <div><div class="name">Linhas de addon</div><div class="muted">${esc(String(local.totals?.addonRows || 0))}</div></div>
          <div><div class="name">Volume de addons</div><div class="muted">${esc(String(local.totals?.addonVolume || 0))}</div></div>
        </div>
        ${remote
          ? `
            <div class="summary-item summary-item--col1">
              <div>
                <div class="name">Resumo remoto</div>
                <div class="muted">${remote.periodCount} período(s) • ${remote.archiveCount} arquivo(s) • ${remote.totals?.students || 0} alunos • ${remote.totals?.pending || 0} pendências • ${remote.totals?.events || 0} eventos.</div>
              </div>
            </div>
          `
          : ''}
        ${legacy.items?.length
          ? `
            <div class="summary-item summary-item--col1">
              <div>
                <div class="name">Períodos com recados legados</div>
                <div class="muted">${legacy.items.map(item => `${item.periodKey} (${item.count})`).join(' • ')}</div>
              </div>
            </div>
          `
          : ''}
        ${report.backend?.remoteError
          ? `
            <div class="summary-item summary-item--col1">
              <div>
                <div class="name">Falha na comparação remota</div>
                <div class="muted">${esc(report.backend.remoteError)}</div>
              </div>
            </div>
          `
          : ''}
        ${mismatchCount
          ? `
            <div class="summary-item summary-item--col1">
              <div>
                <div class="name">Divergências detectadas</div>
                <div class="muted">${report.comparison.mismatches.slice(0, 8).map(item => `${item.periodKey} / ${item.entityKey}: local ${item.local} vs remoto ${item.remote}`).join(' • ')}${mismatchCount > 8 ? ` • +${mismatchCount - 8} item(ns)` : ''}</div>
              </div>
            </div>
          `
          : ''}
      `;
    }

    /** @returns {void} */
    function renderMigrationHomologationPanel() {
      const host = document.getElementById('migrationHomologationList');
      if (!host) return;
      const report = loadMigrationDryRunReport();
      const steps = buildMigrationHomologationSteps(report);
      host.innerHTML = steps.map(item => `
        <div class="summary-item summary-item--col2">
          <div><span class="pill ${item.status === 'ok' ? 'ok' : item.status === 'bad' ? 'bad' : item.status === 'warn' ? 'warn' : 'info'}">${item.status === 'ok' ? 'OK' : item.status === 'bad' ? 'Falha' : item.status === 'warn' ? 'Revisar' : 'Pendente'}</span></div>
          <div>
            <div class="name">${esc(item.label)}</div>
            <div class="muted">${esc(item.detail)}</div>
          </div>
        </div>
      `).join('');
    }

    /**
     * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, report?: Object}>}
     */
    async function runAssistedMigrationToSupabase() {
      const backendState = typeof getSupabaseBackendState === 'function'
        ? getSupabaseBackendState()
        : null;
      if (!backendState?.writable || backendState?.sessionStatus !== 'authenticated') {
        return { ok: false, skipped: true, reason: 'backend-unavailable' };
      }

      const preflightReport = await runMigrationDryRun(true);
      const readiness = getMigrationReadiness(preflightReport);
      if (!readiness.canMigrate) {
        return {
          ok: false,
          skipped: true,
          reason: readiness.reason || 'migration-not-ready',
          report: preflightReport
        };
      }

      const migrationStore = await buildMigrationCandidateStore({
        cleanup: true,
        eventType: 'migration-prepare'
      });
      const prepared = typeof saveStore === 'function'
        ? await saveStore(migrationStore, {
          silent: true,
          broadcast: false,
          eventType: 'migration-prepare',
          skipRemoteSync: true
        })
        : false;
      if (!prepared) {
        return { ok: false, skipped: true, reason: 'store-prepare-failed' };
      }

      const payload = await buildBackupPayload({
        persistCurrent: false,
        eventType: 'migration-backup',
        broadcast: false,
        skipRemoteSync: true
      });
      await saveLocalSnapshot(payload);

      const backendRuntime = globalThis.__APP_INTERNALS__?.backend
        || (typeof window !== 'undefined' ? window.__APP_INTERNALS__?.backend : null);
      const queueStoreSync = typeof window !== 'undefined' && typeof window.queueSupabaseStoreSync === 'function'
          ? window.queueSupabaseStoreSync
        : typeof backendRuntime?.queueSupabaseStoreSync === 'function'
          ? backendRuntime.queueSupabaseStoreSync
        : typeof queueSupabaseStoreSync === 'function'
          ? queueSupabaseStoreSync
          : null;
      const storeSnapshot = typeof readStoredStore === 'function'
        ? await readStoredStore(STORAGE_KEY)
        : prepareStoreCandidate(cloneSerializable(migrationStore));
      if (!storeSnapshot) {
        return { ok: false, skipped: true, reason: 'store-missing' };
      }
      if (!queueStoreSync) {
        return { ok: false, skipped: true, reason: 'sync-function-missing' };
      }
      const syncResult = await queueStoreSync(storeSnapshot, { immediate: true });
      if (!syncResult?.ok) return { ok: false, ...syncResult };

      const reloadFromSession = typeof window !== 'undefined' && typeof window.reloadAppFromSupabaseSession === 'function'
          ? window.reloadAppFromSupabaseSession
        : typeof backendRuntime?.reloadAppFromSupabaseSession === 'function'
          ? backendRuntime.reloadAppFromSupabaseSession
        : typeof reloadAppFromSupabaseSession === 'function'
          ? reloadAppFromSupabaseSession
          : null;
      if (reloadFromSession) {
        await reloadFromSession({ showToast: false });
      }

      const report = await runMigrationDryRun(true);
      return {
        ok: true,
        report
      };
    }
