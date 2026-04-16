/**
 * src/core/supabase.js
 * ------------------------------------------------------------------
 * Wrapper de inicialização do client Supabase para o WPM Gestão Interna.
 *
 * Carregado via <script> clássico, depois de:
 *   - env.js (define window.__APP_ENV__)
 *   - opcionalmente o SDK do Supabase via CDN (define window.supabase)
 *
 * Comportamento:
 *   - Se SUPABASE_URL ou SUPABASE_ANON_KEY ausentes → retorna null.
 *   - Se SDK do Supabase não estiver carregado → retorna null.
 *   - Se ambos presentes → cria e cacheia o client (singleton).
 *
 * O app continua funcionando 100% local-first quando o backend está
 * indisponível. Esta é a porta de entrada futura para Fase 3+ (migração).
 * ------------------------------------------------------------------
 */

    /** @type {any|null} */
    let __supabaseClientCache = null;
    /** @type {string|null} */
    let __supabaseInitErrorReason = null;

    /**
     * Lê env runtime do navegador, com fallback seguro.
     * @returns {{SUPABASE_URL: string|null, SUPABASE_ANON_KEY: string|null}}
     */
    function readSupabaseEnv() {
      const env = (typeof window !== 'undefined' && window.__APP_ENV__) || {};
      return {
        SUPABASE_URL: env.SUPABASE_URL || null,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || null
      };
    }

    /**
     * @returns {boolean} true quando env e SDK estão prontos.
     */
    function isSupabaseEnabled() {
      const env = readSupabaseEnv();
      const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
      const hasSdk = typeof window !== 'undefined'
        && window.supabase
        && typeof window.supabase.createClient === 'function';
      return hasEnv && hasSdk;
    }

    /**
     * Retorna o client singleton ou null em modo offline.
     * @returns {any|null}
     */
    function getSupabaseClient() {
      if (__supabaseClientCache) return __supabaseClientCache;
      if (!isSupabaseEnabled()) {
        const env = readSupabaseEnv();
        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
          __supabaseInitErrorReason = 'env-missing';
        } else {
          __supabaseInitErrorReason = 'sdk-missing';
        }
        return null;
      }
      try {
        const env = readSupabaseEnv();
        __supabaseClientCache = window.supabase.createClient(
          env.SUPABASE_URL,
          env.SUPABASE_ANON_KEY,
          {
            auth: { persistSession: true, autoRefreshToken: true },
            realtime: { params: { eventsPerSecond: 5 } }
          }
        );
        __supabaseInitErrorReason = null;
        return __supabaseClientCache;
      } catch (err) {
        __supabaseInitErrorReason = `init-error:${err && err.message ? err.message : 'unknown'}`;
        if (typeof console !== 'undefined') {
          console.warn('[supabase] falha ao criar client:', err);
        }
        return null;
      }
    }

    /**
     * Diagnóstico para painel de Configurações e testes.
     * @returns {{enabled: boolean, hasEnv: boolean, hasSdk: boolean, reason: string|null}}
     */
    function getSupabaseStatus() {
      const env = readSupabaseEnv();
      const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
      const hasSdk = typeof window !== 'undefined'
        && Boolean(window.supabase && typeof window.supabase.createClient === 'function');
      return {
        enabled: hasEnv && hasSdk,
        hasEnv,
        hasSdk,
        reason: __supabaseInitErrorReason
      };
    }

    /**
     * Reseta o cache do client (útil em testes).
     */
    function resetSupabaseClient() {
      __supabaseClientCache = null;
      __supabaseInitErrorReason = null;
    }
