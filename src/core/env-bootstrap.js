/**
 * Runtime environment bootstrap.
 *
 * Keeps safe defaults available before config.js and loads the optional
 * browser-safe env.js override in local and deployed runtimes.
 */
(function bootstrapRuntimeEnv() {
  window.__APP_ENV__ = Object.assign({
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    SUPABASE_UNIT_SLUG: null,
    SENTRY_DSN: null,
    SENTRY_ENVIRONMENT: null,
    SENTRY_RELEASE: null,
    APP_COMMIT: null,
    APP_BUILD_TIME: null,
    APP_RUNTIME_OVERRIDE: null
  }, window.__APP_ENV__ || {});

  const canLoadRuntimeEnv = ['file:', 'http:', 'https:'].includes(window.location.protocol);
  if (!canLoadRuntimeEnv) return;

  if (document.currentScript && document.readyState === 'loading') {
    document.write('<script src="env.js"><\/script>');
    return;
  }

  const script = document.createElement('script');
  script.src = 'env.js';
  script.async = false;
  document.head.appendChild(script);
})();
