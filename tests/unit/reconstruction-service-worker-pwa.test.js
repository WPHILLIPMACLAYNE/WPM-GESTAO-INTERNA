import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  APP_VERSION,
  PRECACHE_ASSET_PATHS,
  SW_CACHE_STRATEGY_VERSION,
  canRegisterServiceWorker,
  createPwaRegistrationRuntime,
  createServiceWorkerPwaContract,
  hashByteArray,
  hashCacheManifest,
  shouldCacheResponse,
  validateManifestContract,
} from '../../src/reconstruction/service-worker-pwa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8'));
}

function makeResponse(body, { ok = true, type = 'basic', status = 200 } = {}) {
  return {
    body,
    ok,
    type,
    status,
    clone() {
      return makeResponse(body, { ok, type, status });
    },
    async arrayBuffer() {
      return new TextEncoder().encode(String(body)).buffer;
    },
    async text() {
      return String(body);
    },
  };
}

function cacheKey(request) {
  return typeof request === 'string' ? request : request.url;
}

function createFakeCache(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async match(request, options = {}) {
      const key = cacheKey(request);
      if (!options.ignoreSearch) return store.get(key) || null;
      const normalizedKey = new URL(key, 'https://wpm.local/').origin
        + new URL(key, 'https://wpm.local/').pathname;
      for (const [storedKey, response] of store.entries()) {
        const normalizedStoredKey = new URL(storedKey, 'https://wpm.local/').origin
          + new URL(storedKey, 'https://wpm.local/').pathname;
        if (normalizedStoredKey === normalizedKey) return response;
      }
      return null;
    },
    async put(request, response) {
      store.set(cacheKey(request), response);
    },
  };
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(eventName, callback) {
      const callbacks = listeners.get(eventName) || [];
      callbacks.push(callback);
      listeners.set(eventName, callbacks);
    },
    emit(eventName) {
      (listeners.get(eventName) || []).forEach((callback) => callback());
    },
  };
}

describe('reconstruction service worker pwa', () => {
  it('preserva constantes, hash deterministico e manifesto real instalavel', () => {
    const manifest = readJson('manifest.json');
    const validation = validateManifestContract(manifest);

    expect(APP_VERSION).toBe('v34');
    expect(SW_CACHE_STRATEGY_VERSION).toBe('runtime-v2');
    expect(PRECACHE_ASSET_PATHS).toContain('index.html');
    expect(PRECACHE_ASSET_PATHS).toContain('src/core/pwa.js');
    expect(PRECACHE_ASSET_PATHS).toContain('src/main.js');
    expect(hashCacheManifest('same')).toBe(hashCacheManifest('same'));
    expect(hashCacheManifest('same')).not.toBe(hashCacheManifest('changed'));
    expect(hashByteArray(new Uint8Array([1, 2, 3]))).not.toBe(hashByteArray(new Uint8Array([1, 2, 4])));
    expect(validation).toEqual({ ok: true, failures: [] });
  });

  it('classifica requests como cdn, env, app shell, asset local ou pass-through', () => {
    const contract = createServiceWorkerPwaContract({ scopeHref: 'https://wpm.local/app/' });

    expect(contract.selectFetchStrategy({ method: 'POST', url: 'https://wpm.local/app/index.html' })).toBe('ignore');
    expect(contract.selectFetchStrategy({ method: 'GET', url: 'https://cdn.jsdelivr.net/npm/chart.js' })).toBe('network-only-cdn');
    expect(contract.selectFetchStrategy({ method: 'GET', url: 'https://wpm.local/app/env.js' })).toBe('network-only-env');
    expect(contract.selectFetchStrategy({
      method: 'GET',
      mode: 'navigate',
      destination: 'document',
      url: 'https://wpm.local/app/dashboard',
    })).toBe('network-first-shell');
    expect(contract.selectFetchStrategy({
      method: 'GET',
      destination: 'script',
      url: 'https://wpm.local/app/src/main.js',
    })).toBe('network-first-shell');
    expect(contract.selectFetchStrategy({
      method: 'GET',
      destination: 'image',
      url: 'https://wpm.local/app/icons/icon-192.svg',
    })).toBe('cache-first-local');
    expect(contract.selectFetchStrategy({
      method: 'GET',
      destination: 'image',
      url: 'https://other.local/app/icons/icon-192.svg',
    })).toBe('pass-through');
  });

  it('monta precache com cache reload e revisao derivada do conteudo', async () => {
    const contract = createServiceWorkerPwaContract({
      scopeHref: 'https://wpm.local/',
      precacheAssetPaths: ['index.html', 'styles.css'],
      RequestCtor: null,
    });
    const seenRequests = [];
    const fetchAsset = vi.fn(async (request) => {
      seenRequests.push(request);
      return makeResponse(`body:${request.url}`);
    });

    const first = await contract.buildPrecacheBundle({ fetchAsset });
    const second = await contract.buildPrecacheBundle({
      fetchAsset: async (request) => makeResponse(`changed:${request.url}`),
    });

    expect(first.entries).toHaveLength(2);
    expect(first.cacheName).toMatch(/^wpm-v34-[a-f0-9]{8}$/);
    expect(second.cacheName).toMatch(/^wpm-v34-[a-f0-9]{8}$/);
    expect(first.cacheName).not.toBe(second.cacheName);
    expect(seenRequests.map((request) => request.cache)).toEqual(['reload', 'reload']);
    expect(seenRequests.map((request) => request.url)).toEqual([
      'https://wpm.local/index.html',
      'https://wpm.local/styles.css',
    ]);
  });

  it('recusa respostas invalidas para cache e precache', async () => {
    const contract = createServiceWorkerPwaContract({ precacheAssetPaths: ['index.html'] });

    expect(shouldCacheResponse(makeResponse('ok', { type: 'basic' }))).toBe(true);
    expect(shouldCacheResponse(makeResponse('ok', { type: 'default' }))).toBe(true);
    expect(shouldCacheResponse(makeResponse('opaque', { type: 'opaque' }))).toBe(false);
    expect(shouldCacheResponse(makeResponse('fail', { ok: false, status: 404 }))).toBe(false);
    await expect(contract.buildPrecacheBundle({
      fetchAsset: async () => makeResponse('missing', { ok: false, status: 404 }),
    })).rejects.toThrow(/Failed to fetch precache asset/);
  });

  it('aplica network-first com fallback de documento offline', async () => {
    const contract = createServiceWorkerPwaContract({ scopeHref: 'https://wpm.local/' });
    const cache = createFakeCache({
      'https://wpm.local/index.html': makeResponse('cached app shell'),
    });
    const request = { method: 'GET', url: 'https://wpm.local/dashboard?tab=nps' };

    const onlineResponse = await contract.networkFirst(request, {
      cache,
      documentFallback: true,
      fetchFn: async () => makeResponse('fresh app shell'),
    });
    const offlineResponse = await contract.networkFirst(request, {
      cache,
      documentFallback: true,
      fetchFn: async () => {
        throw new Error('offline');
      },
    });

    expect(await onlineResponse.text()).toBe('fresh app shell');
    expect(await cache.store.get('https://wpm.local/index.html').text()).toBe('fresh app shell');
    expect(await offlineResponse.text()).toBe('fresh app shell');
  });

  it('aplica cache-first para assets locais e limpa caches wpm antigos', async () => {
    const contract = createServiceWorkerPwaContract({ scopeHref: 'https://wpm.local/' });
    const request = { method: 'GET', url: 'https://wpm.local/icons/icon-192.svg' };
    const cache = createFakeCache();
    const fetchFn = vi.fn(async () => makeResponse('icon'));

    const first = await contract.cacheFirst(request, { cache, fetchFn });
    const second = await contract.cacheFirst(request, { cache, fetchFn });

    expect(await first.text()).toBe('icon');
    expect(await second.text()).toBe('icon');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(contract.cleanupCacheNames([
      contract.metaCacheName,
      contract.cacheNameFallback,
      'wpm-v33-old',
      'wpm-v34-old',
      'third-party-cache',
    ], contract.cacheNameFallback)).toEqual(['wpm-v33-old', 'wpm-v34-old']);
  });

  it('registra service worker so em http/https e trata online/offline/controllerchange', async () => {
    const registration = createEventTarget();
    registration.scope = 'https://wpm.local/';
    registration.update = vi.fn(async () => undefined);
    registration.installing = createEventTarget();
    registration.installing.state = 'installed';

    const serviceWorker = createEventTarget();
    serviceWorker.controller = {};
    serviceWorker.register = vi.fn(async () => registration);
    const windowLike = createEventTarget();
    const reload = vi.fn();
    const toasts = [];

    expect(canRegisterServiceWorker({
      protocol: 'file:',
      navigatorLike: { serviceWorker },
    })).toBe(false);
    expect(canRegisterServiceWorker({
      protocol: 'https:',
      navigatorLike: { serviceWorker },
    })).toBe(true);

    const runtime = createPwaRegistrationRuntime({
      locationLike: { protocol: 'https:', href: 'https://wpm.local/index.html', reload },
      navigatorLike: { serviceWorker },
      windowLike,
      showToast: (message, duration) => toasts.push({ message, duration }),
      setTimeoutFn: (callback) => callback(),
      consoleLike: { log: vi.fn() },
    });

    await runtime.register();
    windowLike.emit('online');
    windowLike.emit('offline');
    registration.emit('updatefound');
    registration.installing.emit('statechange');
    serviceWorker.emit('controllerchange');
    serviceWorker.emit('controllerchange');

    expect(serviceWorker.register).toHaveBeenCalledWith('https://wpm.local/sw.js');
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toasts.map((toast) => toast.duration)).toEqual(expect.arrayContaining([2000, 3000, 2600, 1200]));
  });
});
