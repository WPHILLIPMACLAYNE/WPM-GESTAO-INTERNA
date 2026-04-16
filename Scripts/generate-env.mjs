#!/usr/bin/env node
/**
 * Scripts/generate-env.mjs
 * Gera env.js a partir de variáveis de processo (process.env).
 * Usado em build de CI/Vercel após injeção via Doppler ou GitHub Secrets.
 *
 * Uso:
 *   doppler run -- node Scripts/generate-env.mjs        # via Doppler CLI
 *   node Scripts/generate-env.mjs                       # CI já populou env
 *
 * Apenas variáveis browser-safe são exportadas. Credenciais privadas
 * (SERVICE_ROLE, AUTH_TOKEN, etc.) são intencionalmente ignoradas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const TARGET = path.join(ROOT, 'env.js');

const PUBLIC_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SENTRY_RELEASE',
  'APP_RUNTIME_OVERRIDE'
];

const env = {};
for (const key of PUBLIC_KEYS) {
  const raw = process.env[key];
  env[key] = raw && raw.trim() ? raw.trim() : null;
}

const banner = `/**\n * env.js — gerado por Scripts/generate-env.mjs.\n * NÃO editar manualmente. NÃO commitar.\n * Valores preenchidos a partir de process.env (Doppler/CI).\n */\n`;
const body = `window.__APP_ENV__ = Object.assign({}, window.__APP_ENV__ || {}, ${JSON.stringify(env, null, 2)});\n`;

fs.writeFileSync(TARGET, banner + body, 'utf8');
console.log(`[generate-env] env.js gerado com ${Object.values(env).filter(Boolean).length}/${PUBLIC_KEYS.length} chaves preenchidas.`);
