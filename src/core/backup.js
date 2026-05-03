    // ══════════════════════════════════════════
    // BACKUP & PERSISTÊNCIA DE ALTO NÍVEL
    // ══════════════════════════════════════════

    const BACKUP_SOURCE_APP_ID = 'wpm-gestao-interna';
    const BACKUP_INTEGRITY_ALGORITHM = 'canonical-fnv1a32-v1';

    /** @param {unknown} value @returns {boolean} */
    function isPlainObject(value) {
      return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }

    /** @param {unknown} value @returns {unknown} */
    function canonicalize(value) {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (isPlainObject(value)) {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, canonicalize(value[key])])
        );
      }
      return value;
    }

    /** @param {unknown} value @returns {string} */
    function canonicalJson(value) {
      return JSON.stringify(canonicalize(value));
    }

    /** @param {string} text @returns {string} */
    function fnv1a32(text) {
      let hash = 0x811c9dc5;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    }

    /** @param {Object} payload @returns {Object} */
    function stripIntegrityEnvelope(payload) {
      const cloned = cloneSerializable(payload);
      if (isPlainObject(cloned?.meta)) delete cloned.meta.integrity;
      return cloned;
    }

    /** @param {Object} payload @returns {string} */
    function calculatePayloadIntegrityHash(payload) {
      return fnv1a32(canonicalJson(stripIntegrityEnvelope(payload)));
    }

    /** @param {Object} payload @returns {Object} */
    function attachPayloadIntegrity(payload) {
      const next = cloneSerializable(payload);
      next.meta ||= {};
      next.meta.sourceAppId ||= BACKUP_SOURCE_APP_ID;
      next.meta.integrity = {
        algorithm: BACKUP_INTEGRITY_ALGORITHM,
        hash: calculatePayloadIntegrityHash(next)
      };
      return next;
    }

    /** @param {Object} payload @param {Object} [options] @returns {{ok: boolean, reason: string, hash?: string, message?: string}} */
    function verifyPayloadIntegrity(payload, options = {}) {
      const requireTrustedSource = options.requireTrustedSource !== false;
      const requireIntegrity = options.requireIntegrity !== false;
      const sourceAppId = String(payload?.meta?.sourceAppId || '');
      const integrity = payload?.meta?.integrity || null;

      if (requireTrustedSource && sourceAppId !== BACKUP_SOURCE_APP_ID) {
        return { ok: false, reason: 'untrusted-source', message: 'Backup de origem não confiável.' };
      }
      if (!integrity) {
        return requireIntegrity
          ? { ok: false, reason: 'missing-integrity', message: 'Backup completo sem integridade verificável.' }
          : { ok: true, reason: 'not-required' };
      }
      if (integrity.algorithm !== BACKUP_INTEGRITY_ALGORITHM) {
        return { ok: false, reason: 'unsupported-algorithm', message: 'Algoritmo de integridade não suportado.' };
      }

      const expectedHash = calculatePayloadIntegrityHash(payload);
      if (integrity.hash !== expectedHash) {
        return { ok: false, reason: 'hash-mismatch', message: 'Hash de integridade do backup não confere.' };
      }
      return { ok: true, reason: 'verified', hash: expectedHash };
    }

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
     * @param {Object} [options]
     * @returns {Object}
     */
    function buildBackupPayloadFromStore(storeSnapshot, options = {}) {
      return attachPayloadIntegrity({
        meta: {
          kind: 'app-backup',
          appVersion: APP_VERSION,
          sourceAppId: BACKUP_SOURCE_APP_ID,
          exportedAt: options.exportedAt || new Date().toISOString()
        },
        version: storeSnapshot.version,
        activePeriod: storeSnapshot.activePeriod,
        preferences: cloneSerializable(storeSnapshot.preferences),
        periods: cloneSerializable(storeSnapshot.periods),
        archives: cloneSerializable(storeSnapshot.archives),
        reopenAudit: cloneSerializable(storeSnapshot.reopenAudit || [])
      });
    }

    /**
     * Builds a single-month archive payload for export.
     * @param {AppStore} storeSnapshot
     * @param {string} periodKey
     * @param {string} periodLabel
     * @param {Object} [options]
     * @returns {Object}
     */
    function buildMonthArchivePayload(storeSnapshot, periodKey, periodLabel, options = {}) {
      const period = cloneSerializable(storeSnapshot?.periods?.[periodKey] || state);
      normalizeData(period);
      return attachPayloadIntegrity({
        meta: {
          kind: 'month-archive',
          appVersion: APP_VERSION,
          sourceAppId: BACKUP_SOURCE_APP_ID,
          exportedAt: options.exportedAt || new Date().toISOString()
        },
        version: storeSnapshot?.version || STORE_VERSION,
        periodKey,
        periodLabel,
        data: period
      });
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
          periodLabel: meta.periodLabel,
          hasIntegrity: Boolean(payload?.meta?.integrity)
        };
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return {
          kind: 'full-backup',
          periodCount: Object.keys(payload.periods).filter(isValidPeriodKey).length,
          hasIntegrity: Boolean(payload?.meta?.integrity)
        };
      }
      if (isLegacyPeriodPayload(payload)) {
        return { kind: 'legacy-period', hasIntegrity: Boolean(payload?.meta?.integrity) };
      }
      return { kind: 'unknown' };
    }

    /**
     * Coerces any recognized import format into a valid AppStore.
     * @param {Object} source
     * @param {AppStore} [baseStore]
     * @returns {AppStore|null}
     */
    function coerceImportedStore(source, baseStore = storage) {
      const payload = extractImportedPayload(source);
      if (!payload) return null;
      if (isMonthArchivePayload(payload)) {
        return buildStoreFromMonthArchivePayload(payload, baseStore);
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
     * Summarizes per-period impact of an import candidate.
     * @param {string} periodKey
     * @param {PeriodData|null} beforePeriod
     * @param {PeriodData|null} afterPeriod
     * @returns {Object}
     */
    function summarizePeriodDiff(periodKey, beforePeriod, afterPeriod) {
      const before = beforePeriod ? getPeriodMetrics(beforePeriod) : null;
      const after = afterPeriod ? getPeriodMetrics(afterPeriod) : null;
      let action = 'unchanged';
      if (!beforePeriod && afterPeriod) action = 'added';
      else if (beforePeriod && !afterPeriod) action = 'removed';
      else if (canonicalJson(before) !== canonicalJson(after) || canonicalJson(beforePeriod) !== canonicalJson(afterPeriod)) action = 'replaced';
      return {
        periodKey,
        label: getPeriodLabel(periodKey),
        action,
        before,
        after
      };
    }

    /**
     * Builds a granular preview for an import candidate before applying it.
     * @param {Object} source
     * @param {AppStore} [baseStore]
     * @returns {Object}
     */
    function buildImportPreview(source, baseStore = storage) {
      const descriptor = getImportedPayloadDescriptor(source);
      const beforeStore = prepareStoreCandidate(baseStore) || getDefaultStore();
      const targetStore = coerceImportedStore(source, beforeStore);
      if (!targetStore) {
        return {
          ok: false,
          descriptor,
          reason: 'invalid-store',
          periodChanges: [],
          destructiveChanges: [],
          summaryBefore: getBackupSummary(beforeStore),
          summaryAfter: null,
          targetStore: null,
          requiresGranularPreview: false
        };
      }

      const periodKeys = [...new Set([
        ...Object.keys(beforeStore.periods || {}),
        ...Object.keys(targetStore.periods || {})
      ])].filter(isValidPeriodKey).sort();
      const periodChanges = periodKeys.map(key => summarizePeriodDiff(
        key,
        beforeStore.periods?.[key] || null,
        targetStore.periods?.[key] || null
      ));
      const destructiveChanges = periodChanges.filter(change => change.action === 'removed' || change.action === 'replaced');
      return {
        ok: true,
        descriptor,
        targetStore,
        summaryBefore: getBackupSummary(beforeStore),
        summaryAfter: getBackupSummary(targetStore),
        periodChanges,
        destructiveChanges,
        requiresGranularPreview: descriptor.kind === 'full-backup' && destructiveChanges.length > 0
      };
    }

    /**
     * Validates import guardrails before destructive application.
     * @param {Object} source
     * @param {Object} preview
     * @param {Object} [options]
     * @returns {{ok: boolean, reason?: string, message?: string}}
     */
    function validateImportGuards(source, preview, options = {}) {
      if (!preview?.ok) return { ok: false, reason: preview?.reason || 'invalid-preview', message: 'Preview de importação inválido.' };
      const descriptor = preview.descriptor || getImportedPayloadDescriptor(source);
      const payload = extractImportedPayload(source);
      const destructiveFullBackup = descriptor.kind === 'full-backup' && preview.requiresGranularPreview;

      if (destructiveFullBackup && options.previewAccepted !== true) {
        return {
          ok: false,
          reason: 'preview-required',
          message: 'Importação completa exige preview granular confirmado antes de substituir/remover períodos.'
        };
      }
      if (descriptor.kind === 'full-backup') {
        const integrity = verifyPayloadIntegrity(payload, {
          requireIntegrity: options.requireIntegrity !== false,
          requireTrustedSource: options.requireTrustedSource !== false
        });
        if (!integrity.ok) return integrity;
      }
      return { ok: true };
    }

    /** @param {Object} preview @returns {string} */
    function formatImportPreviewMessage(preview) {
      if (!preview?.requiresGranularPreview) return '';
      const previewLines = preview.destructiveChanges
        .slice(0, 8)
        .map(change => `${change.label}: ${change.action === 'removed' ? 'será removido' : 'será substituído'}`)
        .join('\n');
      return `\n\nImpacto detectado:\n${previewLines}${preview.destructiveChanges.length > 8 ? '\n...' : ''}`;
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
      return buildBackupPayloadFromStore(storeSnapshot, options);
    }

    /**
     * Applies an imported store, persisting and syncing the app state.
     * @param {Object} parsed
     * @param {Object} [options]
     * @returns {Promise<BackupSummary>}
     */
    async function applyImportedStore(parsed, options = {}) {
      const baseStore = options.baseStore || storage;
      const preview = options.preview || buildImportPreview(parsed, baseStore);
      const guard = validateImportGuards(parsed, preview, options);
      if (!guard.ok) throw new Error(guard.message || `Import guard failed: ${guard.reason}`);
      const normalized = preview.targetStore || coerceImportedStore(parsed, baseStore);
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
      const payload = snapshot.payload || snapshot;
      const preview = buildImportPreview(payload, storage);
      showConfirm(`Deseja restaurar o último snapshot local? Isso substituirá o estado atual.${formatImportPreviewMessage(preview)}`, async () => {
        try {
          const summary = await applyImportedStore(payload, {
            eventType: 'restore',
            preview,
            previewAccepted: true
          });
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
      const importContext = {
        feature: 'backup-import',
        fileName: file.name || 'backup.json',
        fileSize: file.size || 0,
        fileType: file.type || 'application/json'
      };
      reader.onerror = () => {
        if (typeof captureError === 'function') {
          captureError(reader.error || new Error('Falha ao ler arquivo de importação'), {
            ...importContext,
            stage: 'read-file'
          });
        }
        showToast('Erro ao ler o arquivo. Tente novamente.', 'danger');
      };
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result);
          const descriptor = getImportedPayloadDescriptor(parsed);
          const preview = buildImportPreview(parsed, storage);
          if (!preview.ok) throw new Error('Dados não reconhecidos');
          const confirmMessage = descriptor.kind === 'month-archive'
            ? `Confirmar importação do fechamento de ${descriptor.periodLabel}? Somente ${descriptor.periodLabel} será restaurado/atualizado e marcado como fechado. Um backup será gerado antes.`
            : `Confirmar importação e substituir todos os dados atuais? Um backup será gerado antes.${formatImportPreviewMessage(preview)}`;
          showConfirm(confirmMessage, async () => {
            try {
              await exportBackup();
              const summary = await applyImportedStore(parsed, {
                eventType: 'import',
                preview,
                previewAccepted: true
              });
              const successMessage = descriptor.kind === 'month-archive'
                ? `Fechamento de ${descriptor.periodLabel} importado com sucesso. Demais períodos foram preservados.`
                : `Backup importado: ${summary.periods} períodos • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos.`;
              showToast(successMessage, 'success', 5000);
            } catch (err) {
              if (typeof captureError === 'function') {
                captureError(err, {
                  ...importContext,
                  stage: 'apply'
                });
              }
              showToast('Erro ao aplicar backup: ' + (err.message || 'erro desconhecido'), 'danger');
            }
          });
        } catch (err) {
          if (typeof captureError === 'function') {
            captureError(err, {
              ...importContext,
              stage: 'validate'
            });
          }
          showToast('Arquivo inválido. Importe um backup JSON gerado pelo app. Detalhe: ' + (err.message || 'erro desconhecido'), 'danger', 5000);
        }
      };
      reader.readAsText(file);
    }

    const importData = importBackup;
