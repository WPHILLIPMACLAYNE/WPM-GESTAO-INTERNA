import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

describe('Configuração do service worker', () => {
  it('mantem metadados do cache ativo e evita cache name legado fixo', () => {
    const sw = readFile('sw.js');

    expect(sw).toContain("const META_CACHE_NAME = `wpm-meta-${APP_VERSION}`;");
    expect(sw).toContain('ACTIVE_CACHE_META_URL');
    expect(sw).toContain('buildPrecacheBundle()');
    expect(sw).not.toContain("CACHE_NAME = 'wpm-v1'");
  });

  it('deriva a revisao do precache a partir do conteudo dos assets', () => {
    const sw = readFile('sw.js');

    expect(sw).toContain('contentHash: hashByteArray(new Uint8Array(buffer))');
    expect(sw).toContain("entries.map(({ request, contentHash }) => `${request.url}:${contentHash}`)");
    expect(sw).toContain('const CACHE_NAME_FALLBACK');
    expect(sw).not.toContain("'src/types.js'");
  });
});
