    // ══════════════════════════════════════════
    // BACKUP & PERSISTÊNCIA DE ALTO NÍVEL
    // ══════════════════════════════════════════

    /**
     * Validates, migrates and sanitizes a store-like object.
     * @param {Object} storeLike
     * @returns {AppStore|null}
     */
    function prepareStoreCandidate(storeLike) {
      if (!storeLike || typeof storeLike !== 'object' || Array.isArray(storeLike)) return null;
      const migrated = migrateStore(cloneSerializable(storeLike));
      const sanitized = sanitizeStore(migrated);
      if (!sanitized) return null;
      return setStoreVersion(sanitized, STORE_VERSION);
    }

    /**
     * Reads and prepares a stored store from persistence by key.
     * @param {string} key
     * @returns {Promise<AppStore|null>}
     */
    async function readStoredStore(key) {
      const raw = await readPrimaryStoredValue(key);
      if (!raw) return null;
      try {
        return prepareStoreCandidate(JSON.parse(raw));
      } catch {
        const backupKey = `${key}_corrompido_${Date.now()}`;
        await writeStoredValue(backupKey, raw || '', 'Armazenamento cheio — não foi possível preservar backup do dado corrompido.');
        return null;
      }
    }

    /**
     * Loads the store from primary or legacy keys, falling back to defaults.
     * @returns {Promise<AppStore>}
     */
    async function loadLocalStore() {
      const currentStore = await readStoredStore(STORAGE_KEY);
      if (currentStore) {
        await saveStore(currentStore, { silent: true, broadcast: false, skipRemoteSync: true });
        return currentStore;
      }

      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyStore = await readStoredStore(legacyKey);
        if (legacyStore) {
          await saveStore(legacyStore, { silent: true, broadcast: false, skipRemoteSync: true });
          return legacyStore;
        }
      }

      const defaultStore = getDefaultStore();
      await saveStore(defaultStore, { silent: true, broadcast: false, skipRemoteSync: true });
      return defaultStore;
    }

    /**
     * Loads the store, preferring Supabase when authenticated and available.
     * @param {{skipRemote?: boolean}} [options]
     * @returns {Promise<AppStore>}
     */
    async function loadStore(options = {}) {
      const localStore = await loadLocalStore();
      if (options?.skipRemote || typeof loadStoreFromSupabase !== 'function') {
        return localStore;
      }

      const remoteStore = await loadStoreFromSupabase(localStore);
      if (!remoteStore) return localStore;

      await saveStore(remoteStore, {
        silent: true,
        broadcast: false,
        skipRemoteSync: true,
        eventType: 'remote-load'
      });
      return remoteStore;
    }

    /**
     * Persists a store-like object to storage with optional broadcast.
     * @param {Object} storeLike
     * @param {boolean|Object} [options]
     * @returns {Promise<boolean>}
     */
    async function saveStore(storeLike, options = false) {
      const { silent, eventType, broadcast, skipRemoteSync } = normalizePersistenceOptions(options, 'save');
      updatePersistenceTechState({
        status: 'sincronizando',
        broadcastAvailable: canUseStorageBroadcast()
      });
      try {
        const storeToSave = prepareStoreCandidate(storeLike) || getDefaultStore();
        const result = await persistStoredJson(
          STORAGE_KEY,
          storeToSave,
          'Armazenamento local cheio. Exporte um backup e limpe dados antigos em Configurações.'
        );
        if (!result.ok) {
          updatePersistenceTechState({
            status: 'erro',
            storeVersion: storeToSave.version || STORE_VERSION
          });
          return false;
        }
        await removeStoredValues(LEGACY_STORAGE_KEYS);
        if (broadcast) await emitStorageBroadcast(eventType);
        updatePersistenceTechState({
          status: 'pronto',
          lastSuccessAt: new Date().toISOString(),
          lastOperationType: eventType,
          storeVersion: storeToSave.version || STORE_VERSION,
          broadcastAvailable: canUseStorageBroadcast()
        });
        const shouldTryRemoteSync = !skipRemoteSync
          && typeof queueSupabaseStoreSync === 'function'
          && typeof getSupabaseStatus === 'function'
          && typeof getSupabaseBackendState === 'function'
          && getSupabaseStatus().enabled
          && getSupabaseBackendState().sessionStatus === 'authenticated'
          && Boolean(getSupabaseBackendState().activeUnit?.unitId)
          && getSupabaseBackendState().writable === true;
        if (shouldTryRemoteSync) {
          const immediate = typeof shouldSyncSupabaseImmediately === 'function'
            ? shouldSyncSupabaseImmediately(eventType)
            : false;
          const syncPromise = queueSupabaseStoreSync(storeToSave, {
            immediate,
            delayMs: 900
          });
          if (immediate) {
            const syncResult = await syncPromise;
            if (!syncResult?.ok && !syncResult?.skipped) {
              updatePersistenceTechState({
                status: 'erro',
                broadcastAvailable: canUseStorageBroadcast()
              });
              if (!silent) {
                showToast('Store local salvo, mas a sincronização com o backend falhou.', 'warning', 4500);
              }
              return false;
            }
          } else {
            syncPromise.catch(error => {
              console.warn('[supabase] falha no agendamento de sincronização remota:', error);
            });
          }
        }
        if (!silent) showSaveToast();
        return true;
      } catch (err) {
        console.error('Falha ao salvar store principal:', err);
        updatePersistenceTechState({
          status: 'erro',
          broadcastAvailable: canUseStorageBroadcast()
        });
        showToast('Não foi possível salvar os dados do aplicativo.', 'danger');
        return false;
      }
    }

    /**
     * Saves the current period state into the store and persists it.
     * @param {boolean|Object} [options]
     * @returns {Promise<boolean>}
     */
    async function saveData(options = false) {
      try {
        storage.activePeriod = currentPeriodKey;
        storage.periods[currentPeriodKey] = state;
        limparCacheSelectores();
        return await saveStore(storage, options);
      } catch (err) {
        console.error('Falha crítica ao salvar dados:', err);
        showToast('Erro crítico ao salvar dados. Exporte um backup imediatamente.', 'danger', 6000);
        return false;
      }
    }

    /**
     * Handles a storage broadcast event from another tab.
     * @param {string} rawValue
     * @returns {Promise<void>}
     */
    async function consumeStorageBroadcast(rawValue) {
      if (!rawValue) return;
      updatePersistenceTechState({
        status: 'sincronizando',
        broadcastAvailable: canUseStorageBroadcast()
      });
      let payload = null;
      try {
        payload = JSON.parse(rawValue);
        if (!payload || typeof payload !== 'object') return;
      } catch {
        updatePersistenceTechState({ status: 'erro' });
        return;
      }

      const nextStore = await readStoredStore(STORAGE_KEY);
      if (!nextStore) {
        updatePersistenceTechState({ status: 'erro' });
        return;
      }
      await syncAppState(nextStore);
      updatePersistenceTechState({
        status: 'pronto',
        lastSuccessAt: payload?.ts ? new Date(payload.ts).toISOString() : persistenceTechState.lastSuccessAt,
        lastOperationType: String(payload?.type || persistenceTechState.lastOperationType || 'save'),
        storeVersion: nextStore.version || STORE_VERSION,
        broadcastAvailable: canUseStorageBroadcast()
      });
      renderAll();
      syncPeriodControls();
      showSaveToast('✓ dados sincronizados de outra aba');
    }

    /**
     * Returns a committed store snapshot, optionally persisting current state first.
     * @param {Object} [options]
     * @returns {Promise<AppStore>}
     */
    async function getCommittedStoreSnapshot(options = {}) {
      const persistCurrent = options?.persistCurrent === true;
      const eventType = String(options?.eventType || 'save');
      const broadcast = options?.broadcast === true;
      const skipRemoteSync = options?.skipRemoteSync === true;
      const candidate = prepareStoreCandidate(storage) || getDefaultStore();

      if (persistCurrent) {
        const saved = await saveStore(candidate, {
          silent: true,
          eventType,
          broadcast,
          skipRemoteSync
        });
        if (!saved) throw new Error('Falha ao persistir o estado atual antes de gerar o backup.');
      }

      return await readStoredStore(STORAGE_KEY) || candidate;
    }

    /**
     * Builds an exportable backup payload from a store snapshot.
     * @param {AppStore} storeSnapshot
     * @returns {Object}
     */
    function buildBackupPayloadFromStore(storeSnapshot) {
      return {
        meta: {
          kind: 'app-backup',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString()
        },
        version: storeSnapshot.version,
        activePeriod: storeSnapshot.activePeriod,
        preferences: cloneSerializable(storeSnapshot.preferences),
        periods: cloneSerializable(storeSnapshot.periods),
        archives: cloneSerializable(storeSnapshot.archives)
      };
    }

    /**
     * Builds a single-month archive payload for export.
     * @param {AppStore} storeSnapshot
     * @param {string} periodKey
     * @param {string} periodLabel
     * @returns {Object}
     */
    function buildMonthArchivePayload(storeSnapshot, periodKey, periodLabel) {
      const period = cloneSerializable(storeSnapshot?.periods?.[periodKey] || state);
      normalizeData(period);
      return {
        meta: {
          kind: 'month-archive',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString()
        },
        version: storeSnapshot?.version || STORE_VERSION,
        periodKey,
        periodLabel,
        data: period
      };
    }

    /**
     * Runs a write/read/delete round-trip to verify persistence is working.
     * @returns {Promise<boolean>}
     */
    async function runPersistenceSelfTest() {
      const tempKey = `${STORAGE_KEY}__selftest__${Date.now()}`;
      const tempValue = JSON.stringify({ probe: true, ts: Date.now() });
      updatePersistenceTechState({
        status: 'sincronizando',
        selfTest: {
          status: 'info',
          detail: 'Executando autoteste de persistência...'
        },
        broadcastAvailable: canUseStorageBroadcast()
      });

      try {
        const writeResult = await persistStoredValue(tempKey, tempValue, 'Não foi possível gravar o valor temporário do autoteste.');
        if (!writeResult.ok) throw new Error('Falha ao gravar o valor temporário.');

        const roundTrip = await readPrimaryStoredValue(tempKey, { updateCache: false });
        if (roundTrip !== tempValue) throw new Error('Leitura divergente após a gravação de teste.');

        const removed = await removeStoredValue(tempKey);
        if (!removed) throw new Error('Falha ao remover o valor temporário.');

        updatePersistenceTechState({
          status: 'pronto',
          selfTest: {
            status: 'ok',
            detail: 'Valor temporário gravado, lido e removido com sucesso.'
          },
          broadcastAvailable: canUseStorageBroadcast()
        });
        showToast('Autoteste de persistência concluído com sucesso.', 'success');
        return true;
      } catch (err) {
        await removeStoredValue(tempKey).catch(() => false);
        updatePersistenceTechState({
          status: 'erro',
          selfTest: {
            status: 'bad',
            detail: err?.message || 'Falha desconhecida no autoteste de persistência.'
          },
          broadcastAvailable: canUseStorageBroadcast()
        });
        showToast('Autoteste de persistência falhou.', 'danger');
        return false;
      }
    }

    /**
     * Computes aggregate metrics across all periods in a store.
     * @param {AppStore} [storeRef]
     * @returns {BackupSummary}
     */
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

    /**
     * Checks if a payload matches the legacy single-period format.
     * @param {Object} payload
     * @returns {boolean}
     */
    function isLegacyPeriodPayload(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      return ['settings', 'students', 'pending', 'recados', 'nps', 'scale', 'events', 'addons', 'escala', 'eventos'].some(key => key in payload);
    }

    /**
     * Extracts and sanitizes a payload from an imported source object.
     * @param {Object} source
     * @returns {Object|null}
     */
    function extractImportedPayload(source) {
      const cleanedRoot = sanitizeDeep(cloneSerializable(source));
      const payload = cleanedRoot?.payload && typeof cleanedRoot.payload === 'object' && !Array.isArray(cleanedRoot.payload)
        ? cleanedRoot.payload
        : cleanedRoot;
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    }

    /**
     * Checks if a payload is a valid month-archive structure.
     * @param {Object} payload
     * @returns {boolean}
     */
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

    /**
     * Extracts import metadata from a month-archive payload.
     * @param {Object} payload
     * @returns {Object|null}
     */
    function getMonthArchiveImportMeta(payload) {
      if (!isMonthArchivePayload(payload)) return null;
      const periodKey = String(payload.periodKey);
      return {
        periodKey,
        periodLabel: String(payload.periodLabel || '').trim() || getPeriodLabel(periodKey),
        exportedAt: String(payload?.meta?.exportedAt || '').trim()
      };
    }

    /**
     * Builds an archive entry from a month-archive payload.
     * @param {Object} payload
     * @param {ArchiveEntry|null} [existingArchive]
     * @returns {ArchiveEntry|null}
     */
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

    /**
     * Merges a month-archive payload into a base store, returning a new store.
     * @param {Object} payload
     * @param {AppStore} [baseStore]
     * @returns {AppStore|null}
     */
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

    /**
     * Determines the kind and metadata of an imported payload.
     * @param {Object} source
     * @returns {{kind: string, periodKey?: string, periodLabel?: string, periodCount?: number}}
     */
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

    /**
     * Coerces any recognized import format into a valid AppStore.
     * @param {Object} source
     * @returns {AppStore|null}
     */
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

    /**
     * Builds a full backup payload, persisting current state by default.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async function buildBackupPayload(options = {}) {
      const storeSnapshot = await getCommittedStoreSnapshot({
        persistCurrent: options?.persistCurrent !== false,
        eventType: String(options?.eventType || 'save'),
        broadcast: options?.broadcast === true,
        skipRemoteSync: options?.skipRemoteSync === true
      });
      return buildBackupPayloadFromStore(storeSnapshot);
    }

    /**
     * Applies an imported store, persisting and syncing the app state.
     * @param {Object} parsed
     * @param {Object} [options]
     * @returns {Promise<BackupSummary>}
     */
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

    /**
     * Saves a local snapshot for quick restore.
     * @param {Object} [payload]
     * @returns {Promise<Object|null>}
     */
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

    /**
     * Prompts the user to restore the last saved local snapshot.
     * @returns {void}
     */
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

    /**
     * Exports a full backup as a downloadable JSON file.
     * @returns {Promise<void>}
     */
    async function exportBackup() {
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

    const downloadData = exportBackup;

    /**
     * Reads and imports a backup JSON file selected by the user.
     * @param {File} file
     * @returns {void}
     */
    function importBackup(file) {
      if (!assertWritableCurrentPeriod()) return;
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { showToast('Arquivo muito grande (máximo: 50MB).', 'danger'); return; }
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) { showToast('Formato inválido. Selecione um arquivo .json.', 'warning'); return; }
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
              await exportBackup();
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

    const importData = importBackup;
