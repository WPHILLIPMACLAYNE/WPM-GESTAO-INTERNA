/**
 * env.example.js
 * ------------------------------------------------------------------
 * Template do contrato de ambiente runtime do WPM Gestão Interna.
 *
 * Este arquivo é COMMITADO e serve de referência. Para uso real:
 *
 *   1. Local dev:
 *        npm run setup            # copia este arquivo para env.js
 *        # depois edite env.js manualmente OU use Doppler:
 *        doppler run -- node Scripts/generate-env.mjs
 *
 *   2. Vercel/CI:
 *        Variáveis injetadas via process.env por Doppler/GitHub Secrets
 *        e o build executa Scripts/generate-env.mjs para produzir env.js.
 *
 * REGRAS DE OURO:
 *
 *   - SOMENTE valores PÚBLICOS browser-safe podem entrar aqui
 *     (URL pública do Supabase, ANON_KEY, DSN público do Sentry).
 *   - NUNCA colocar SERVICE_ROLE_KEY, MAILGUN_API_KEY, SENTRY_AUTH_TOKEN
 *     ou qualquer credencial de servidor neste arquivo.
 *   - env.js é GITIGNORED — não commitar valores reais.
 *   - Se algum valor faltar, o app continua funcionando em modo
 *     local-first (IndexedDB/localStorage), apenas sem backend remoto.
 * ------------------------------------------------------------------
 */
window.__APP_ENV__ = Object.assign({}, window.__APP_ENV__ || {}, {
  // ── Supabase (frontend client) ─────────────────────────────────
  // URL do projeto: https://<project-ref>.supabase.co
  SUPABASE_URL: null,
  // Chave anônima (publishable). NUNCA a service_role aqui.
  SUPABASE_ANON_KEY: null,
  // Opcional: força a unidade preferida quando o usuário tiver mais de um vínculo.
  SUPABASE_UNIT_SLUG: null,

  // ── Sentry (frontend monitoring) ───────────────────────────────
  // DSN público do projeto JavaScript do Sentry.
  SENTRY_DSN: null,
  // Ambiente reportado ao Sentry: development | staging | production
  SENTRY_ENVIRONMENT: null,
  // Release tag opcional (commit SHA recomendado em CI).
  SENTRY_RELEASE: null,

  // ── App ────────────────────────────────────────────────────────
  // Commit SHA público do deploy atual.
  APP_COMMIT: null,
  // Timestamp ISO público gerado no build/deploy.
  APP_BUILD_TIME: null,
  // Permite forçar runtime em testes/preview. null = autodetectar.
  APP_RUNTIME_OVERRIDE: null
});
