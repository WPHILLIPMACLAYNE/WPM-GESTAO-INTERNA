/**
 * src/core/observability.js
 * ------------------------------------------------------------------
 * Bootstrap condicional do Sentry para o WPM Gestão Interna.
 *
 * Carregado via <script> clássico, depois de:
 *   - env.js (define window.__APP_ENV__)
 *   - opcionalmente o SDK do Sentry via CDN (define window.Sentry)
 *
 * Comportamento:
 *   - Se SENTRY_DSN ausente → no-op silencioso.
 *   - Se SDK do Sentry não estiver carregado → no-op silencioso.
 *   - Se ambos presentes → inicializa client com environment + release.
 *
 * captureError() / captureMessage() são SEMPRE seguros para chamar.
 * Quando Sentry está desativado, viram no-ops sem lançar exceção.
 * ------------------------------------------------------------------
 */

    /** @type {boolean} */
    let __sentryInitialized = false;
    /** @type {string|null} */
    let __sentryStatusReason = null;

    /**
     * Lê config Sentry do runtime, com fallback seguro.
     * @returns {{dsn: string|null, environment: string, release: string|null}}
     */
    function readSentryEnv() {
      const env = (typeof window !== 'undefined' && window.__APP_ENV__) || {};
      const fallbackEnvironment = (typeof APP_RUNTIME !== 'undefined' && APP_RUNTIME) || 'production';
      return {
        dsn: env.SENTRY_DSN || null,
        environment: env.SENTRY_ENVIRONMENT || fallbackEnvironment,
        release: env.SENTRY_RELEASE || null
      };
    }

    /**
     * Detecta se o SDK Sentry está carregado e exposto em window.Sentry.
     * @returns {boolean}
     */
    function isSentrySdkLoaded() {
      return typeof window !== 'undefined'
        && Boolean(window.Sentry && typeof window.Sentry.init === 'function');
    }

    /**
     * Inicializa o Sentry se DSN e SDK estiverem disponíveis.
     * Idempotente — chamadas extras são ignoradas.
     * @returns {boolean} true se já inicializado ou inicializou agora.
     */
    function initSentry() {
      if (__sentryInitialized) return true;
      const cfg = readSentryEnv();
      if (!cfg.dsn) {
        __sentryStatusReason = 'dsn-missing';
        return false;
      }
      if (!isSentrySdkLoaded()) {
        __sentryStatusReason = 'sdk-missing';
        return false;
      }
      try {
        window.Sentry.init({
          dsn: cfg.dsn,
          environment: cfg.environment,
          release: cfg.release || undefined,
          tracesSampleRate: cfg.environment === 'production' ? 0.1 : 1.0,
          beforeSend(event) {
            if (cfg.environment === 'development') return null;
            return event;
          }
        });
        __sentryInitialized = true;
        __sentryStatusReason = null;
        return true;
      } catch (err) {
        __sentryStatusReason = `init-error:${err && err.message ? err.message : 'unknown'}`;
        if (typeof console !== 'undefined') {
          console.warn('[observability] falha ao inicializar Sentry:', err);
        }
        return false;
      }
    }

    /**
     * Captura um erro. Sempre seguro de chamar.
     * @param {unknown} err
     * @param {Object} [context]
     */
    function captureError(err, context) {
      if (!__sentryInitialized && !initSentry()) return;
      try {
        window.Sentry.captureException(err, context ? { extra: context } : undefined);
      } catch {
        // noop
      }
    }

    /**
     * Captura uma mensagem (não-erro). Sempre seguro de chamar.
     * @param {string} message
     * @param {string} [level]
     */
    function captureMessage(message, level) {
      if (!__sentryInitialized && !initSentry()) return;
      try {
        window.Sentry.captureMessage(message, level || 'info');
      } catch {
        // noop
      }
    }

    /**
     * Diagnóstico para painel de Configurações e testes.
     * @returns {{initialized: boolean, hasDsn: boolean, hasSdk: boolean, reason: string|null}}
     */
    function getObservabilityStatus() {
      const cfg = readSentryEnv();
      return {
        initialized: __sentryInitialized,
        hasDsn: Boolean(cfg.dsn),
        hasSdk: isSentrySdkLoaded(),
        reason: __sentryStatusReason
      };
    }

    /**
     * Reseta estado interno (útil em testes).
     */
    function resetObservability() {
      __sentryInitialized = false;
      __sentryStatusReason = null;
    }

    // Tentativa inicial de bootstrap. Pode ser chamada novamente
    // depois do SDK carregar (ex.: após DOMContentLoaded).
    initSentry();
