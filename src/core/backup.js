    // ══════════════════════════════════════════
    // BACKUP & PERSISTÊNCIA DE ALTO NÍVEL
    // ══════════════════════════════════════════

    const BACKUP_SOURCE_APP_ID = 'wpm-gestao-interna';
    const BACKUP_INTEGRITY_ALGORITHM = 'canonical-sha256-v1';
    const LEGACY_BACKUP_INTEGRITY_ALGORITHM = 'canonical-fnv1a32-v1';

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
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
      if (isPlainObject(value)) {
        return `{${Object.keys(value)
          .sort()
          .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
          .join(',')}}`;
      }
      return JSON.stringify(value);
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

    /** @param {number} value @param {number} shift @returns {number} */
    function rotr32(value, shift) {
      return (value >>> shift) | (value << (32 - shift));
    }

    /** @param {string} text @returns {string} */
    function sha256Hex(text) {
      const bytes = new TextEncoder().encode(text);
      const bitLength = bytes.length * 8;
      const paddedLength = bytes.length + 1 + ((64 - ((bytes.length + 1 + 8) % 64)) % 64) + 8;
      const data = new Uint8Array(paddedLength);
      data.set(bytes);
      data[bytes.length] = 0x80;
      const view = new DataView(data.buffer);
      view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
      view.setUint32(paddedLength - 4, bitLength >>> 0);
      const h = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
      ];
      const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ];
      const w = new Uint32Array(64);
      for (let offset = 0; offset < data.length; offset += 64) {
        for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4);
        for (let index = 16; index < 64; index += 1) {
          const s0 = rotr32(w[index - 15], 7) ^ rotr32(w[index - 15], 18) ^ (w[index - 15] >>> 3);
          const s1 = rotr32(w[index - 2], 17) ^ rotr32(w[index - 2], 19) ^ (w[index - 2] >>> 10);
          w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let index = 0; index < 64; index += 1) {
          const s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
          const ch = (e & f) ^ (~e & g);
          const temp1 = (hh + s1 + ch + k[index] + w[index]) >>> 0;
          const s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const temp2 = (s0 + maj) >>> 0;
          hh = g; g = f; f = e; e = (d + temp1) >>> 0;
          d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
      }
      return Array.from(h, value => value.toString(16).padStart(8, '0')).join('');
    }

    /** @param {Object} payload @returns {Object} */
    function stripIntegrityEnvelope(payload) {
      const cloned = cloneSerializable(payload);
      if (isPlainObject(cloned?.meta)) delete cloned.meta.integrity;
      return cloned;
    }

    /** @param {Object} payload @returns {string} */
    function calculatePayloadIntegrityHash(payload, algorithm = BACKUP_INTEGRITY_ALGORITHM) {
      const canonical = canonicalJson(stripIntegrityEnvelope(payload));
      if (algorithm === LEGACY_BACKUP_INTEGRITY_ALGORITHM) return fnv1a32(canonical);
      return sha256Hex(canonical);
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
      if (![BACKUP_INTEGRITY_ALGORITHM, LEGACY_BACKUP_INTEGRITY_ALGORITHM].includes(integrity.algorithm)) {
        return { ok: false, reason: 'unsupported-algorithm', message: 'Algoritmo de integridade não suportado.' };
      }

      const expectedHash = calculatePayloadIntegrityHash(payload, integrity.algorithm);
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
