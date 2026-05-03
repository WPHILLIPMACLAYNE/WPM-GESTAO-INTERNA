// Reconstructed Storage Adapter from Reversa Task 06.
// Local-first persistence with IndexedDB primary, localStorage mirror/fallback,
// synchronous cache reads, serialized mutations, and best-effort cross-tab broadcast.

import {
  IDB_NAME,
  IDB_STORE_NAME,
  LEGACY_STORAGE_KEYS,
  STORAGE_BROADCAST_KEY,
  STORAGE_KEY,
} from './config-global-state.js';

export const DEFAULT_PERSISTENCE_TECH_STATE = Object.freeze({
  mode: 'local-first',
  status: 'unknown',
  backend: 'unknown',
  broadcastAvailable: false,
  lastOperation: null,
  selfTest: {
    status: 'idle',
    detail: '',
  },
});

export function isQuotaExceededError(error) {
  return Boolean(
    error
      && (
        error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || error.code === 22
        || error.code === 1014
      ),
  );
}

export function normalizePersistenceOptions(options = {}) {
  if (typeof options === 'boolean') {
    return { updateCache: options, rerender: true, broadcast: true };
  }

  return {
    updateCache: options.updateCache !== false,
    rerender: options.rerender !== false,
    broadcast: options.broadcast !== false,
  };
}

export function createPersistenceResult({
  ok = false,
  localPersisted = false,
  indexedDbPersisted = false,
  error = null,
} = {}) {
  return {
    ok,
    localPersisted,
    indexedDbPersisted,
    error,
  };
}

export function createStorageAdapter(options = {}) {
  const globalLike = options.globalLike || globalThis;
  const indexedDB = options.indexedDB ?? globalLike.indexedDB ?? null;
  const localStorage = options.localStorage ?? globalLike.localStorage ?? null;
  const showToast = typeof options.showToast === 'function' ? options.showToast : () => {};
  const requestRender = typeof options.requestRender === 'function' ? options.requestRender : () => {};
  const storageKey = options.storageKey || STORAGE_KEY;
  const legacyStorageKeys = options.legacyStorageKeys || LEGACY_STORAGE_KEYS;
  const broadcastKey = options.broadcastKey || STORAGE_BROADCAST_KEY;
  const idbName = options.idbName || IDB_NAME;
  const idbStoreName = options.idbStoreName || IDB_STORE_NAME;

  const storageCache = new Map();
  let storageCacheHydrated = false;
  let idbOpenPromise = null;
  let storageOperationQueue = Promise.resolve();
  let storageBroadcastCounter = 0;
  let persistenceTechState = {
    ...DEFAULT_PERSISTENCE_TECH_STATE,
    backend: indexedDB ? 'indexedDB' : 'localStorage',
    broadcastAvailable: false,
  };

  function updatePersistenceTechState(patch = {}, renderOptions = {}) {
    persistenceTechState = {
      ...persistenceTechState,
      ...patch,
      selfTest: {
        ...persistenceTechState.selfTest,
        ...(patch.selfTest || {}),
      },
    };

    if (renderOptions.rerender !== false) {
      requestRender('settings');
    }

    return getPersistenceTechState();
  }

  function getPersistenceTechState() {
    return {
      ...persistenceTechState,
      selfTest: { ...persistenceTechState.selfTest },
    };
  }

  function readLocalStorageValue(key) {
    try {
      return localStorage ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  function writeLocalStorageValue(key, value) {
    try {
      if (!localStorage) return false;
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (isQuotaExceededError(error)) throw error;
      return false;
    }
  }

  function deleteLocalStorageValue(key) {
    try {
      if (!localStorage) return false;
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function canUseStorageBroadcast() {
    if (!localStorage) {
      updatePersistenceTechState({ broadcastAvailable: false }, { rerender: false });
      return false;
    }

    try {
      const probeKey = `${broadcastKey}:probe`;
      localStorage.setItem(probeKey, '1');
      localStorage.removeItem(probeKey);
      updatePersistenceTechState({ broadcastAvailable: true }, { rerender: false });
      return true;
    } catch {
      updatePersistenceTechState({ broadcastAvailable: false }, { rerender: false });
      return false;
    }
  }

  function getKnownStorageKeys() {
    return [...new Set([storageKey, ...legacyStorageKeys])];
  }

  function openIndexedDb() {
    if (!indexedDB) return Promise.resolve(null);
    if (idbOpenPromise) return idbOpenPromise;

    idbOpenPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(idbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(idbStoreName)) {
          db.createObjectStore(idbStoreName);
        }
      };

      request.onsuccess = () => {
        updatePersistenceTechState({ backend: 'indexedDB', status: 'ready' }, { rerender: false });
        resolve(request.result);
      };

      request.onerror = () => {
        idbOpenPromise = null;
        updatePersistenceTechState({ backend: 'localStorage', status: 'idb-error' }, { rerender: false });
        reject(request.error || new Error('IndexedDB open failed'));
      };

      request.onblocked = () => {
        updatePersistenceTechState({ status: 'idb-blocked' }, { rerender: false });
      };
    }).catch((error) => {
      idbOpenPromise = null;
      throw error;
    });

    return idbOpenPromise;
  }

  async function withIndexedDbStore(mode, callback) {
    const db = await openIndexedDb();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(idbStoreName, mode);
      const store = transaction.objectStore(idbStoreName);
      let callbackResult;

      transaction.oncomplete = () => resolve(callbackResult);
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));

      try {
        callbackResult = callback(store);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  async function idbGetValue(key) {
    if (!indexedDB) return null;
    return withIndexedDbStore('readonly', (store) => requestToPromise(store.get(key)));
  }

  async function idbSetValue(key, value) {
    if (!indexedDB) return false;
    await withIndexedDbStore('readwrite', (store) => requestToPromise(store.put(value, key)));
    return true;
  }

  async function idbDeleteValue(key) {
    if (!indexedDB) return false;
    await withIndexedDbStore('readwrite', (store) => requestToPromise(store.delete(key)));
    return true;
  }

  function queueStorageOperation(operation) {
    storageOperationQueue = storageOperationQueue
      .catch(() => undefined)
      .then(operation);

    return storageOperationQueue;
  }

  async function hydrateStorageCache() {
    if (storageCacheHydrated) return;

    for (const key of getKnownStorageKeys()) {
      const value = await readPrimaryStoredValue(key, { updateCache: true });
      if (typeof value === 'string') {
        storageCache.set(key, value);
      }
    }

    storageCacheHydrated = true;
  }

  async function readPrimaryStoredValue(key, optionsArg = {}) {
    const opts = normalizePersistenceOptions(optionsArg);

    try {
      const idbValue = await idbGetValue(key);
      if (typeof idbValue === 'string') {
        if (opts.updateCache) storageCache.set(key, idbValue);
        try {
          writeLocalStorageValue(key, idbValue);
        } catch {
          // Mirror failure is tolerated after IndexedDB read succeeds.
        }
        return idbValue;
      }
    } catch {
      updatePersistenceTechState({ backend: 'localStorage', status: 'idb-read-error' }, { rerender: false });
    }

    const localValue = readLocalStorageValue(key);
    if (typeof localValue === 'string' && opts.updateCache) {
      storageCache.set(key, localValue);
    }

    return localValue;
  }

  function readStoredValue(key) {
    if (storageCache.has(key)) return storageCache.get(key);
    const value = readLocalStorageValue(key);
    if (typeof value === 'string') storageCache.set(key, value);
    return value;
  }

  function readStoredJson(key, fallback = null) {
    const value = readStoredValue(key);
    if (typeof value !== 'string') return fallback;

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function readStoredJsonWithFallback(primaryKey, legacyKeys = [], fallback = null) {
    const keys = [primaryKey, ...legacyKeys];
    for (const key of keys) {
      if (hasStoredValue(key)) {
        return readStoredJson(key, fallback);
      }
    }
    return fallback;
  }

  function hasStoredValue(key) {
    return typeof readStoredValue(key) === 'string';
  }

  function hasStoredValueWithFallback(primaryKey, legacyKeys = []) {
    return [primaryKey, ...legacyKeys].some((key) => hasStoredValue(key));
  }

  async function persistStoredValue(key, value, onQuotaMessage = null, optionsArg = {}) {
    const opts = normalizePersistenceOptions(optionsArg);

    return queueStorageOperation(async () => {
      let indexedDbPersisted = false;
      let localPersisted = false;

      try {
        if (indexedDB) {
          await idbSetValue(key, value);
          indexedDbPersisted = true;
          if (opts.updateCache) storageCache.set(key, value);

          try {
            localPersisted = writeLocalStorageValue(key, value);
          } catch (error) {
            if (!isQuotaExceededError(error)) {
              console.warn('localStorage mirror failed after IndexedDB commit', error);
            }
          }
        } else {
          localPersisted = writeLocalStorageValue(key, value);
          if (localPersisted && opts.updateCache) storageCache.set(key, value);
        }

        const ok = indexedDbPersisted || localPersisted;
        updatePersistenceTechState(
          {
            status: ok ? 'saved' : 'error',
            backend: indexedDbPersisted ? 'indexedDB' : 'localStorage',
            lastOperation: { type: 'write', key, ok, at: new Date().toISOString() },
          },
          { rerender: opts.rerender },
        );

        if (ok && opts.broadcast) await emitStorageBroadcast('write');
        return createPersistenceResult({ ok, localPersisted, indexedDbPersisted });
      } catch (error) {
        const quota = isQuotaExceededError(error);
        const message = quota
          ? 'Armazenamento local cheio. Exporte um backup e limpe dados antigos.'
          : 'Falha ao salvar dados locais.';

        if (typeof onQuotaMessage === 'function') onQuotaMessage(message, error);
        showToast(message, quota ? 'warning' : 'error');
        updatePersistenceTechState(
          {
            status: quota ? 'quota-exceeded' : 'error',
            lastOperation: { type: 'write', key, ok: false, at: new Date().toISOString() },
          },
          { rerender: opts.rerender },
        );

        return createPersistenceResult({ ok: false, localPersisted, indexedDbPersisted, error });
      }
    });
  }

  async function persistStoredJson(key, value, onQuotaMessage = null, optionsArg = {}) {
    return persistStoredValue(key, JSON.stringify(value), onQuotaMessage, optionsArg);
  }

  async function writeStoredValue(key, value, onQuotaMessage = null) {
    const result = await persistStoredValue(key, value, onQuotaMessage);
    return result.ok;
  }

  async function writeStoredJson(key, value, onQuotaMessage = null) {
    const result = await persistStoredJson(key, value, onQuotaMessage);
    return result.ok;
  }

  async function removeStoredValue(key, optionsArg = {}) {
    const opts = normalizePersistenceOptions(optionsArg);

    return queueStorageOperation(async () => {
      let ok = true;
      try {
        if (indexedDB) {
          await idbDeleteValue(key);
        }
      } catch {
        ok = false;
      }

      deleteLocalStorageValue(key);
      storageCache.delete(key);

      updatePersistenceTechState(
        {
          status: ok ? 'removed' : 'remove-error',
          lastOperation: { type: 'remove', key, ok, at: new Date().toISOString() },
        },
        { rerender: opts.rerender },
      );

      if (ok && opts.broadcast) await emitStorageBroadcast('remove');
      return ok;
    });
  }

  async function removeStoredValues(keys = []) {
    let ok = true;
    for (const key of keys) {
      ok = (await removeStoredValue(key)) && ok;
    }
    return ok;
  }

  async function emitStorageBroadcast(type) {
    if (!canUseStorageBroadcast()) return false;

    try {
      const payload = {
        ts: new Date().toISOString(),
        seq: ++storageBroadcastCounter,
        type,
      };
      localStorage.setItem(broadcastKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('storage broadcast failed', error);
      updatePersistenceTechState({ broadcastAvailable: false }, { rerender: false });
      return false;
    }
  }

  canUseStorageBroadcast();

  return {
    storageCache,
    hydrateStorageCache,
    readPrimaryStoredValue,
    readStoredValue,
    readStoredJson,
    readStoredJsonWithFallback,
    hasStoredValue,
    hasStoredValueWithFallback,
    persistStoredValue,
    persistStoredJson,
    writeStoredValue,
    writeStoredJson,
    removeStoredValue,
    removeStoredValues,
    emitStorageBroadcast,
    canUseStorageBroadcast,
    getKnownStorageKeys,
    getPersistenceTechState,
    updatePersistenceTechState,
    queueStorageOperation,
    isQuotaExceededError,
  };
}

export const defaultStorageAdapter = createStorageAdapter();
