    // CAMADA DE ARMAZENAMENTO — IndexedDB, localStorage, cache, fila serializada e broadcast
    // ══════════════════════════════════════════

    const storageCache = new Map();
    let storageCacheHydrated = false;
    let idbOpenPromise = null;
    let storageOperationQueue = Promise.resolve();
    let storageBroadcastCounter = 0;

    function isQuotaExceededError(err) {
      return Boolean(err && (err.name === 'QuotaExceededError' || err.code === 22));
    }

    function readLocalStorageValue(key) {
      try {
        return localStorage.getItem(key);
      } catch (err) {
        console.error(`Falha ao ler localStorage (${key}):`, err);
        return null;
      }
    }

    function writeLocalStorageValue(key, value) {
      try {
        localStorage.setItem(key, value);
        return { ok: true, quota: false, error: null };
      } catch (err) {
        if (!isQuotaExceededError(err)) {
          console.error(`Falha ao gravar localStorage (${key}):`, err);
        }
        return { ok: false, quota: isQuotaExceededError(err), error: err };
      }
    }

    function deleteLocalStorageValue(key) {
      try {
        localStorage.removeItem(key);
        return { ok: true, error: null };
      } catch (err) {
        console.error(`Falha ao remover localStorage (${key}):`, err);
        return { ok: false, error: err };
      }
    }

    function canUseStorageBroadcast() {
      const probeKey = `${STORAGE_BROADCAST_KEY}__probe__`;
      const result = writeLocalStorageValue(probeKey, String(Date.now()));
      if (!result.ok) return false;
      deleteLocalStorageValue(probeKey);
      return true;
    }

    function queueStorageOperation(operation) {
      const nextOperation = storageOperationQueue
        .catch(() => undefined)
        .then(operation);
      storageOperationQueue = nextOperation.catch(() => undefined);
      return nextOperation;
    }

    const persistenceTechState = {
      modeLabel: 'híbrido / IndexedDB + cache + broadcast',
      status: 'pronto',
      backendLabel: 'IndexedDB',
      broadcastAvailable: canUseStorageBroadcast(),
      lastSuccessAt: null,
      lastOperationType: '—',
      storeVersion: STORE_VERSION,
      selfTest: {
        status: 'info',
        detail: 'Autoteste ainda não executado.'
      }
    };

    function updatePersistenceTechState(patch = {}, rerender = true) {
      Object.assign(persistenceTechState, patch);
      if (rerender) requestRender('settings');
      return persistenceTechState;
    }

    function normalizePersistenceOptions(input, defaultEventType = 'save') {
      if (typeof input === 'boolean') {
        return {
          silent: input,
          eventType: defaultEventType,
          broadcast: true
        };
      }
      return {
        silent: Boolean(input?.silent),
        eventType: String(input?.eventType || defaultEventType),
        broadcast: input?.broadcast !== false
      };
    }

    async function emitStorageBroadcast(eventType = 'save') {
      const payload = JSON.stringify({
        ts: Date.now(),
        seq: ++storageBroadcastCounter,
        type: String(eventType || 'save')
      });
      const result = writeLocalStorageValue(STORAGE_BROADCAST_KEY, payload);
      if (!result.ok) {
        console.warn('Falha ao emitir broadcast cross-tab de persistência.', result.error);
        return false;
      }
      return true;
    }

    function getKnownStorageKeys() {
      return [
        STORAGE_KEY,
        ...LEGACY_STORAGE_KEYS,
        LOCAL_SNAPSHOT_KEY,
        ...LEGACY_LOCAL_SNAPSHOT_KEYS,
        SYSTEM_REPORT_KEY,
        ...LEGACY_SYSTEM_REPORT_KEYS,
        FLOW_TEST_REPORT_KEY,
        ...LEGACY_FLOW_TEST_REPORT_KEYS,
        UI_KEY,
        ...LEGACY_UI_KEYS
      ];
    }

    async function withIndexedDbStore(mode, operation) {
      if (!('indexedDB' in window)) return null;
      if (!idbOpenPromise) {
        idbOpenPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open(IDB_NAME, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
              db.createObjectStore(IDB_STORE_NAME);
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }).catch(err => {
          idbOpenPromise = null;
          throw err;
        });
      }

      const db = await idbOpenPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, mode);
        const store = tx.objectStore(IDB_STORE_NAME);
        const request = operation(store);
        tx.oncomplete = () => resolve(request?.result ?? null);
        tx.onerror = () => reject(tx.error || request?.error);
        tx.onabort = () => reject(tx.error || request?.error);
      });
    }

    async function idbGetValue(key) {
      return withIndexedDbStore('readonly', store => store.get(key));
    }

    async function idbSetValue(key, value) {
      return withIndexedDbStore('readwrite', store => store.put(value, key));
    }

    async function idbDeleteValue(key) {
      return withIndexedDbStore('readwrite', store => store.delete(key));
    }

    async function hydrateStorageCache() {
      if (storageCacheHydrated) return;
      const keys = getKnownStorageKeys();
      await Promise.all(keys.map(async key => {
        let value = null;
        try {
          value = await idbGetValue(key);
        } catch {}
        if (typeof value === 'string') {
          storageCache.set(key, value);
          writeLocalStorageValue(key, value);
          return;
        }
        const fallback = readLocalStorageValue(key);
        if (fallback !== null) storageCache.set(key, fallback);
      }));
      storageCacheHydrated = true;
    }

    async function readPrimaryStoredValue(key, { updateCache = true } = {}) {
      let value = null;
      if ('indexedDB' in window) {
        try {
          value = await idbGetValue(key);
        } catch (err) {
          console.error(`Falha ao ler IndexedDB (${key}):`, err);
        }
      }
      if (typeof value !== 'string') {
        value = readLocalStorageValue(key);
      }
      if (updateCache) {
        if (value === null) storageCache.delete(key);
        else storageCache.set(key, value);
      }
      return value;
    }

    function readStoredValue(key) {
      if (storageCache.has(key)) return storageCache.get(key);
      const value = readLocalStorageValue(key);
      if (value !== null) storageCache.set(key, value);
      return value;
    }

    function readStoredJson(key, fallback = null) {
      try {
        const raw = readStoredValue(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    function readStoredJsonWithFallback(primaryKey, legacyKeys = [], fallback = null) {
      const keys = [primaryKey, ...legacyKeys];
      for (const key of keys) {
        const value = readStoredJson(key, null);
        if (value != null) return value;
      }
      return fallback;
    }

    // ─── writeStoredValue: atualiza cache síncrono e persiste em IndexedDB ──────
    // Mantém espelho em localStorage para compatibilidade e evento cross-tab.
    async function persistStoredValue(key, value, onQuotaMessage, options = {}) {
      return queueStorageOperation(async () => {
        const canUseIndexedDb = 'indexedDB' in window;
        const onPersisted = typeof options.onPersisted === 'function'
          ? options.onPersisted
          : null;

        if (canUseIndexedDb) {
          try {
            await idbSetValue(key, value);
          } catch (err) {
            if (isQuotaExceededError(err)) {
              showToast(onQuotaMessage || 'Armazenamento local cheio. Exporte um backup e limpe dados antigos em Configurações.', 'danger');
            } else {
              console.error('Falha ao persistir no IndexedDB:', err);
              showToast('Não foi possível persistir os dados localmente neste navegador.', 'danger');
            }
            return { ok: false, localPersisted: false, indexedDbPersisted: false };
          }

          storageCache.set(key, value);
          const localResult = writeLocalStorageValue(key, value);
          if (!localResult.ok && !localResult.quota) {
            console.warn(`Espelho localStorage não pôde ser atualizado após commit principal (${key}).`, localResult.error);
          }
          onPersisted?.();
          return { ok: true, localPersisted: localResult.ok, indexedDbPersisted: true };
        }

        const localResult = writeLocalStorageValue(key, value);
        if (!localResult.ok) {
          const message = localResult.quota
            ? (onQuotaMessage || 'Armazenamento local cheio. Exporte um backup e limpe dados antigos em Configurações.')
            : 'Não foi possível persistir os dados localmente neste navegador.';
          showToast(message, 'danger');
          return { ok: false, localPersisted: false, indexedDbPersisted: false };
        }

        storageCache.set(key, value);
        onPersisted?.();
        return { ok: true, localPersisted: true, indexedDbPersisted: false };
      });
    }

    async function persistStoredJson(key, value, onQuotaMessage, options = {}) {
      return persistStoredValue(key, JSON.stringify(value), onQuotaMessage, options);
    }

    async function writeStoredValue(key, value, onQuotaMessage) {
      return (await persistStoredValue(key, value, onQuotaMessage)).ok;
    }

    async function writeStoredJson(key, value, onQuotaMessage) {
      return (await persistStoredJson(key, value, onQuotaMessage)).ok;
    }

    async function removeStoredValue(key) {
      return queueStorageOperation(async () => {
        const canUseIndexedDb = 'indexedDB' in window;

        if (canUseIndexedDb) {
          try {
            await idbDeleteValue(key);
          } catch (err) {
            console.error('Falha ao remover chave do IndexedDB:', err);
            return false;
          }
        }

        const localResult = deleteLocalStorageValue(key);
        if (!localResult.ok) {
          console.error(`Espelho localStorage não pôde ser removido (${key}).`, localResult.error);
          if (!canUseIndexedDb) return false;
        }

        storageCache.delete(key);
        return true;
      });
    }

    async function removeStoredValues(keys = []) {
      const results = [];
      for (const key of keys) {
        results.push(await removeStoredValue(key));
      }
      return results.every(Boolean);
    }

    function hasStoredValue(key) {
      return readStoredValue(key) !== null;
    }

    function hasStoredValueWithFallback(primaryKey, legacyKeys = []) {
      return [primaryKey, ...legacyKeys].some(key => hasStoredValue(key));
    }
