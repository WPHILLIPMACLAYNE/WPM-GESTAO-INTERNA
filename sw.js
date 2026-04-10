const CACHE_NAME = 'wpm-2026-04-10';

const PRECACHE_ASSETS = [
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable-512.svg',
  '/src/utils/helpers.js',
  '/src/core/config.js',
  '/src/core/period-builder.js',
  '/src/core/seed.js',
  '/src/core/schema.js',
  '/src/core/storage.js',
  '/src/core/backup.js',
  '/src/core/lifecycle.js',
  '/src/domain/selectors.js',
  '/src/features/forms.js',
  '/src/features/nps.js',
  '/src/features/csv.js',
  '/src/features/diagnostics.js',
  '/src/features/crud.js',
  '/src/types.js',
  '/src/ui/render-core.js',
  '/src/ui/render-dashboard.js',
  '/src/ui/render-students.js',
  '/src/ui/render-pending.js',
  '/src/ui/render-nps.js',
  '/src/ui/render-scale.js',
  '/src/ui/render-events.js',
  '/src/ui/render-settings.js',
  '/src/ui/render-addons.js',
  '/src/ui/events-core.js',
  '/src/ui/events-students.js',
  '/src/ui/events-pending.js',
  '/src/ui/events-addons.js',
  '/src/ui/events-scale.js',
  '/src/ui/events-nps.js',
  '/src/main.js'
];

// CDN URLs — network-only (não cachear)
function isCdnRequest(url) {
  return url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com');
}

// Install: pre-cache de assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
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
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first para assets locais, network-only para CDN
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // CDN: network-only
  if (isCdnRequest(url)) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Assets locais: cache-first com fallback para network
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          });
      })
      .catch(() => {
        // Offline e não cacheado: notificar o app
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 503 });
      })
  );
});

// Mensagem de controle do app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
