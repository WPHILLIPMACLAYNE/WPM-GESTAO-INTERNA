const APP_VERSION = 'v34';
const SW_CACHE_STRATEGY_VERSION = 'runtime-v2';
const APP_SCOPE_URL = new URL('./', self.location.href);
const APP_SCOPE_HREF = APP_SCOPE_URL.href;

const PRECACHE_ASSET_PATHS = [
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
  'src/types.js',
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
  'src/main.js'
];
const PRECACHE_ASSETS = PRECACHE_ASSET_PATHS.map((asset) => new URL(asset, APP_SCOPE_URL).href);
const DOCUMENT_FALLBACK_URL = new URL('index.html', APP_SCOPE_URL).href;
const MANIFEST_URL = new URL('manifest.json', APP_SCOPE_URL).href;

function hashCacheManifest(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// CDN URLs — network-only (não cachear)
function isCdnRequest(url) {
  return url.includes('cdn.jsdelivr.net');
}

const CACHE_MANIFEST_VERSION = hashCacheManifest([
  APP_VERSION,
  SW_CACHE_STRATEGY_VERSION,
  APP_SCOPE_HREF,
  ...PRECACHE_ASSET_PATHS
].join('|'));
const CACHE_NAME = `wpm-${APP_VERSION}-${CACHE_MANIFEST_VERSION}`;

function isAppScopeRequest(url) {
  return url.origin === APP_SCOPE_URL.origin && url.href.startsWith(APP_SCOPE_HREF);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isAppShellRequest(request, url) {
  if (!isAppScopeRequest(url)) return false;
  if (isNavigationRequest(request)) return true;
  if (url.href === MANIFEST_URL) return true;
  if (request.destination === 'script' || request.destination === 'style') return true;
  return false;
}

function isLocalEnvRequest(url) {
  return isAppScopeRequest(url) && url.pathname.endsWith('/env.js');
}

function shouldCacheResponse(response) {
  return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'default'));
}

async function putInCache(request, response, { storeDocumentFallback = false } = {}) {
  if (!shouldCacheResponse(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  if (storeDocumentFallback) {
    await cache.put(DOCUMENT_FALLBACK_URL, response.clone());
  }
}

async function networkFirst(request, { documentFallback = false } = {}) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    await putInCache(request, response, { storeDocumentFallback: documentFallback });
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: documentFallback });
    if (cached) return cached;
    if (documentFallback) {
      const fallback = await cache.match(DOCUMENT_FALLBACK_URL);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await putInCache(request, response);
  return response;
}

// Install: pre-cache de assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(async () => {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first para app shell, cache-first para assets locais estáveis.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const requestUrl = new URL(url);

  // CDN: network-only
  if (isCdnRequest(url)) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // env.js e um override local opcional; nunca servir cache antigo dele.
  if (isLocalEnvRequest(requestUrl)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isAppShellRequest(event.request, requestUrl)) {
    event.respondWith(
      networkFirst(event.request, { documentFallback: isNavigationRequest(event.request) })
        .catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  if (isAppScopeRequest(requestUrl)) {
    event.respondWith(
      cacheFirst(event.request)
        .catch(async () => {
          if (isNavigationRequest(event.request)) {
            const fallback = await caches.match(DOCUMENT_FALLBACK_URL);
            if (fallback) return fallback;
          }
          return new Response('', { status: 503 });
        })
    );
  }
});

// Mensagem de controle do app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
