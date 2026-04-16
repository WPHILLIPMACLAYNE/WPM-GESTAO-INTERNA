#!/usr/bin/env node
/**
 * Scripts/setup-env.mjs
 * Cria env.js a partir de env.example.js se ainda não existir.
 * Idempotente: nunca sobrescreve valores existentes.
 *
 * Uso: npm run setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const EXAMPLE = path.join(ROOT, 'env.example.js');
const TARGET = path.join(ROOT, 'env.js');

if (!fs.existsSync(EXAMPLE)) {
  console.error(`[setup-env] arquivo template ausente: ${EXAMPLE}`);
  process.exit(1);
}

if (fs.existsSync(TARGET)) {
  console.log(`[setup-env] env.js já existe — preservando valores atuais.`);
  process.exit(0);
}

fs.copyFileSync(EXAMPLE, TARGET);
console.log(`[setup-env] env.js criado a partir de env.example.js.`);
console.log(`[setup-env] edite os valores em env.js conforme necessário (NÃO comitar).`);
