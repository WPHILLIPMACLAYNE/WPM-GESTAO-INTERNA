// Reconstructed Env Bootstrap from Reversa Task 04.
// Browser-safe runtime env contract for local-first operation.

export const APP_ENV_KEYS = Object.freeze([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_UNIT_SLUG',
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SENTRY_RELEASE',
  'APP_COMMIT',
  'APP_BUILD_TIME',
  'APP_RUNTIME_OVERRIDE',
]);

export const DEFAULT_APP_ENV = Object.freeze(
  Object.fromEntries(APP_ENV_KEYS.map((key) => [key, null])),
);

export const LOCAL_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

export function createDefaultAppEnv(overrides = {}) {
  return Object.assign({}, DEFAULT_APP_ENV, cleanPublicEnv(overrides));
}

export function cleanPublicEnv(env = {}) {
  const nextEnv = {};

  for (const key of APP_ENV_KEYS) {
    const value = env[key];
    nextEnv[key] = value === undefined ? null : value;
  }

  return nextEnv;
}

export function mergeAppEnv(existingEnv = {}, defaults = DEFAULT_APP_ENV) {
  return Object.assign({}, defaults, existingEnv || {});
}

export function isLocalRuntime(locationLike = globalThis.location) {
  if (!locationLike) return false;
  const protocol = locationLike.protocol || '';
  const hostname = locationLike.hostname || '';

  return protocol === 'file:' || LOCAL_HOSTNAMES.includes(hostname);
}

export function canLoadRuntimeEnvScript(locationLike = globalThis.location) {
  if (!locationLike) return false;
  return ['file:', 'http:', 'https:'].includes(locationLike.protocol || '');
}

export function shouldUseDocumentWrite(documentLike = globalThis.document) {
  return Boolean(documentLike && documentLike.readyState === 'loading');
}

export function buildEnvScriptTag(src = 'env.js') {
  return `<script src="${src}"><\\/script>`;
}

export function injectEnvScript(documentLike = globalThis.document, src = 'env.js') {
  if (!documentLike) return null;

  if (shouldUseDocumentWrite(documentLike) && typeof documentLike.write === 'function') {
    documentLike.write(buildEnvScriptTag(src));
    return { mode: 'document.write', src };
  }

  if (
    typeof documentLike.createElement === 'function'
    && documentLike.head
    && typeof documentLike.head.appendChild === 'function'
  ) {
    const script = documentLike.createElement('script');
    script.src = src;
    script.async = false;
    documentLike.head.appendChild(script);
    return { mode: 'head.appendChild', src, element: script };
  }

  return null;
}

export function bootstrapRuntimeEnv(globalLike = globalThis, options = {}) {
  const envKey = options.envKey || '__APP_ENV__';
  const envScript = options.envScript || 'env.js';
  const locationLike = options.location || globalLike.location;
  const documentLike = options.document || globalLike.document;
  const existingEnv = globalLike[envKey] || {};

  globalLike[envKey] = mergeAppEnv(existingEnv);

  const localRuntime = isLocalRuntime(locationLike);
  if (!canLoadRuntimeEnvScript(locationLike)) {
    return {
      env: globalLike[envKey],
      localRuntime,
      envScriptLoaded: false,
      loadMode: null,
    };
  }

  const injection = injectEnvScript(documentLike, envScript);

  return {
    env: globalLike[envKey],
    localRuntime,
    envScriptLoaded: Boolean(injection),
    loadMode: injection?.mode || null,
  };
}

export function normalizeRuntimeOverride(value) {
  return value === 'development' || value === 'production' ? value : null;
}

if (
  typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && !window.__RECONSTRUCTION_ENV_BOOTSTRAP_NO_AUTO_RUN__
) {
  bootstrapRuntimeEnv(window);
}
