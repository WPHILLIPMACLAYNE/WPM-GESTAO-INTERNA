// Reconstructed Service Worker/PWA contract from Reversa Task 15.
// Testable mirror of sw.js cache rules and src/core/pwa.js registration behavior.

export const APP_VERSION = 'v34';
export const SW_CACHE_STRATEGY_VERSION = 'runtime-v2';

export const PRECACHE_ASSET_PATHS = Object.freeze([
  'index.html',
  'styles.css',
  'manifest.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'icons/icon-maskable-512.svg',
  'src/core/env-bootstrap.js',
  'src/utils/helpers.js',
  'src/core/config.js',
  'src/core/observability.js',
  'src/core/supabase.js',
  'src/core/period-builder.js',
  'src/core/seed.js',
  'src/core/schema.js',
  'src/core/storage.js',
  'src/core/backup.js',
  'src/core/lifecycle.js',
  'src/domain/selectors.js',
  'src/features/forms.js',
  'src/features/nps.js',
  'src/features/csv.js',
  'src/features/diagnostics.js',
  'src/features/crud.js',
  'src/ui/render-core.js',
  'src/ui/render-dashboard.js',
  'src/ui/render-students.js',
  'src/ui/render-pending.js',
  'src/ui/render-nps.js',
  'src/ui/render-scale.js',
  'src/ui/render-events.js',
  'src/ui/render-settings.js',
  'src/ui/render-addons.js',
  'src/ui/events-core.js',
  'src/ui/events-students.js',
  'src/ui/events-pending.js',
  'src/ui/events-addons.js',
  'src/ui/events-scale.js',
  'src/ui/events-nps.js',
  'src/ui/back-to-top.js',
  'src/core/pwa.js',
  'src/main.js',
]);

export function hashCacheManifest(input) {
  let hash = 2166136261;
  for (let index = 0; index < String(input).length; index += 1) {
    hash ^= String(input).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashByteArray(bytes) {
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createReloadRequest(url, RequestCtor = globalThis.Request) {
  if (typeof RequestCtor === 'function') {
    return new RequestCtor(url, { cache: 'reload' });
  }
  return { url, cache: 'reload' };
}

export function shouldCacheResponse(response) {
  return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'default'));
}

function getRequestUrl(request) {
  return typeof request === 'string' ? request : request?.url || '';
}

function getRequestMethod(request) {
  return String(request?.method || 'GET').toUpperCase();
}

function cloneResponse(response) {
  return typeof response?.clone === 'function' ? response.clone() : response;
}

async function readResponseBytes(response) {
  if (typeof response?.arrayBuffer === 'function') {
    return new Uint8Array(await response.clone().arrayBuffer());
  }
  if (typeof response?.text === 'function') {
    return new TextEncoder().encode(await response.clone().text());
  }
  return new TextEncoder().encode(String(response?.body || ''));
}

export function createServiceWorkerPwaContract({
  scopeHref = 'https://wpm.local/',
  appVersion = APP_VERSION,
  strategyVersion = SW_CACHE_STRATEGY_VERSION,
  precacheAssetPaths = PRECACHE_ASSET_PATHS,
  RequestCtor = globalThis.Request,
} = {}) {
  const appScopeUrl = new URL('./', scopeHref);
  const appScopeHref = appScopeUrl.href;
  const cachePrefix = `wpm-${appVersion}-`;
  const metaCacheName = `wpm-meta-${appVersion}`;
  const activeCacheMetaUrl = new URL('__meta__/active-cache', appScopeUrl).href;
  const precacheAssetUrls = precacheAssetPaths.map((asset) => new URL(asset, appScopeUrl).href);
  const documentFallbackUrl = new URL('index.html', appScopeUrl).href;
  const manifestUrl = new URL('manifest.json', appScopeUrl).href;
  const cacheNameFallback = `${cachePrefix}${hashCacheManifest([
    appVersion,
    strategyVersion,
    appScopeHref,
    ...precacheAssetPaths,
  ].join('|'))}`;

  function isCdnRequest(url) {
    return String(url || '').includes('cdn.jsdelivr.net');
  }

  function isAppScopeRequest(url) {
    const requestUrl = url instanceof URL ? url : new URL(String(url || ''), appScopeUrl);
    return requestUrl.origin === appScopeUrl.origin && requestUrl.href.startsWith(appScopeHref);
  }

  function isNavigationRequest(request) {
    return request?.mode === 'navigate' || request?.destination === 'document';
  }

  function isAppShellRequest(request, url) {
    const requestUrl = url instanceof URL ? url : new URL(getRequestUrl(request), appScopeUrl);
    if (!isAppScopeRequest(requestUrl)) return false;
    if (isNavigationRequest(request)) return true;
    if (requestUrl.href === manifestUrl) return true;
    return request?.destination === 'script' || request?.destination === 'style';
  }

  function isLocalEnvRequest(url) {
    const requestUrl = url instanceof URL ? url : new URL(String(url || ''), appScopeUrl);
    return isAppScopeRequest(requestUrl) && requestUrl.pathname.endsWith('/env.js');
  }

  async function fetchPrecacheEntry(url, fetchAsset) {
    const request = createReloadRequest(url, RequestCtor);
    const response = await fetchAsset(request);
    if (!shouldCacheResponse(response)) {
      throw new Error(`Failed to fetch precache asset: ${url}`);
    }
    return {
      request,
      response,
      contentHash: hashByteArray(await readResponseBytes(response)),
    };
  }

  async function buildPrecacheBundle({ fetchAsset } = {}) {
    if (typeof fetchAsset !== 'function') {
      throw new TypeError('buildPrecacheBundle requires fetchAsset');
    }
    const entries = await Promise.all(precacheAssetUrls.map((url) => fetchPrecacheEntry(url, fetchAsset)));
    const revision = hashCacheManifest([
      appVersion,
      strategyVersion,
      ...entries.map(({ request, contentHash }) => `${request.url}:${contentHash}`),
    ].join('|'));

    return {
      cacheName: `${cachePrefix}${revision}`,
      entries,
      revision,
    };
  }

  async function putInCache(cache, request, response, { storeDocumentFallback = false } = {}) {
    if (!shouldCacheResponse(response)) return false;
    await cache.put(request, cloneResponse(response));
    if (storeDocumentFallback) {
      await cache.put(documentFallbackUrl, cloneResponse(response));
    }
    return true;
  }

  async function networkFirst(request, { fetchFn, cache, documentFallback = false } = {}) {
    if (typeof fetchFn !== 'function') throw new TypeError('networkFirst requires fetchFn');
    if (!cache) throw new TypeError('networkFirst requires cache');
    try {
      const response = await fetchFn(request);
      await putInCache(cache, request, response, { storeDocumentFallback: documentFallback });
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: documentFallback });
      if (cached) return cached;
      if (documentFallback) {
        const fallback = await cache.match(documentFallbackUrl);
        if (fallback) return fallback;
      }
      throw error;
    }
  }

  async function cacheFirst(request, { fetchFn, cache } = {}) {
    if (typeof fetchFn !== 'function') throw new TypeError('cacheFirst requires fetchFn');
    if (!cache) throw new TypeError('cacheFirst requires cache');
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetchFn(request);
    await putInCache(cache, request, response);
    return response;
  }

  function selectFetchStrategy(request) {
    if (getRequestMethod(request) !== 'GET') return 'ignore';
    const url = getRequestUrl(request);
    const requestUrl = new URL(url, appScopeUrl);
    if (isCdnRequest(url)) return 'network-only-cdn';
    if (isLocalEnvRequest(requestUrl)) return 'network-only-env';
    if (isAppShellRequest(request, requestUrl)) return 'network-first-shell';
    if (isAppScopeRequest(requestUrl)) return 'cache-first-local';
    return 'pass-through';
  }

  function cleanupCacheNames(keys, activeCacheName) {
    return keys
      .filter((key) => key !== metaCacheName)
      .filter((key) => key !== activeCacheName)
      .filter((key) => key.startsWith(cachePrefix) || key.startsWith('wpm-'));
  }

  return {
    appVersion,
    strategyVersion,
    appScopeHref,
    cachePrefix,
    metaCacheName,
    activeCacheMetaUrl,
    cacheNameFallback,
    precacheAssetPaths,
    precacheAssetUrls,
    documentFallbackUrl,
    manifestUrl,
    isCdnRequest,
    isAppScopeRequest,
    isNavigationRequest,
    isAppShellRequest,
    isLocalEnvRequest,
    shouldCacheResponse,
    fetchPrecacheEntry,
    buildPrecacheBundle,
    putInCache,
    networkFirst,
    cacheFirst,
    selectFetchStrategy,
    cleanupCacheNames,
  };
}

export function canRegisterServiceWorker({ protocol = 'https:', navigatorLike = globalThis.navigator } = {}) {
  return Boolean(
    navigatorLike
    && 'serviceWorker' in navigatorLike
    && (protocol === 'http:' || protocol === 'https:')
  );
}

export function createPwaRegistrationRuntime({
  locationLike,
  navigatorLike,
  windowLike,
  showToast,
  setTimeoutFn = globalThis.setTimeout,
  consoleLike = console,
  captureError,
} = {}) {
  const serviceWorker = navigatorLike?.serviceWorker;
  const hadControllerAtBoot = Boolean(serviceWorker?.controller);
  let reloadingForUpdate = false;

  function toast(message, duration) {
    if (typeof showToast === 'function') showToast(message, duration);
  }

  function register() {
    if (!canRegisterServiceWorker({ protocol: locationLike?.protocol, navigatorLike })) {
      consoleLike?.log?.('[PWA] Service worker indisponivel (file:// ou sem suporte)');
      return null;
    }

    const swUrl = new URL('sw.js', locationLike?.href || 'https://wpm.local/').href;
    const registrationPromise = serviceWorker.register(swUrl).then((registration) => {
      registration.addEventListener?.('updatefound', () => {
        const nextWorker = registration.installing;
        nextWorker?.addEventListener?.('statechange', () => {
          if (nextWorker.state === 'installed' && hadControllerAtBoot) {
            toast('Nova vers\u00e3o detectada. Aplicando atualiza\u00e7\u00e3o...', 2600);
          }
        });
      });

      windowLike?.addEventListener?.('online', () => {
        registration.update?.().catch((error) => {
          if (typeof captureError === 'function') {
            captureError(error, { feature: 'pwa', stage: 'service-worker-update' });
          }
          consoleLike?.log?.('[PWA] Falha ao verificar atualizacao do service worker');
        });
      });

      return registration;
    }).catch((error) => {
      if (typeof captureError === 'function') {
        captureError(error, { feature: 'pwa', stage: 'service-worker-register', swUrl });
      }
      consoleLike?.log?.('[PWA] Service worker indisponivel (file:// ou sem suporte)');
      return null;
    });

    serviceWorker.addEventListener?.('controllerchange', () => {
      if (!hadControllerAtBoot || reloadingForUpdate) return;
      reloadingForUpdate = true;
      toast('Aplicativo atualizado. Recarregando...', 1200);
      setTimeoutFn(() => {
        locationLike.reload?.();
      }, 900);
    });

    windowLike?.addEventListener?.('online', () => toast('Conex\u00e3o restaurada', 2000));
    windowLike?.addEventListener?.('offline', () => toast('Modo offline \u2014 dados locais', 3000));

    return registrationPromise;
  }

  return { register };
}

export function validateManifestContract(manifest = {}) {
  const requiredIcons = new Set(['icons/icon-192.svg', 'icons/icon-512.svg', 'icons/icon-maskable-512.svg']);
  const iconSources = new Set((manifest.icons || []).map((icon) => icon.src));
  const normalizedName = String(manifest.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const failures = [];

  if (normalizedName !== 'WPM Gestao Interna') failures.push('manifest-name');
  if (manifest.short_name !== 'WPM') failures.push('manifest-short-name');
  if (manifest.start_url !== './index.html') failures.push('manifest-start-url');
  if (manifest.scope !== './') failures.push('manifest-scope');
  if (manifest.display !== 'standalone') failures.push('manifest-display');
  if (manifest.background_color !== '#0a0a0c') failures.push('manifest-background-color');
  if (manifest.theme_color !== '#FFC20F') failures.push('manifest-theme-color');
  requiredIcons.forEach((src) => {
    if (!iconSources.has(src)) failures.push(`manifest-icon:${src}`);
  });
  if (!(manifest.icons || []).some((icon) => icon.src === 'icons/icon-maskable-512.svg' && icon.purpose === 'maskable')) {
    failures.push('manifest-maskable-icon');
  }

  return { ok: failures.length === 0, failures };
}
