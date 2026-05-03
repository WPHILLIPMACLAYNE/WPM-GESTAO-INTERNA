import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

describe('Configuração de segurança', () => {
  it('meta CSP local nao usa unsafe-inline em script-src nem style-src', () => {
    const html = readFile('index.html');
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    expect(match?.[1]).toBeTruthy();

    const csp = match[1];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain('http://127.0.0.1:54321');
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('headers do Vercel reforcam CSP e anti-clickjacking', () => {
    const vercelConfig = JSON.parse(readFile('vercel.json'));
    const rootHeaders = vercelConfig.headers.find(entry => entry.source === '/(.*)');
    expect(rootHeaders).toBeTruthy();

    const headerMap = Object.fromEntries(rootHeaders.headers.map(header => [header.key, header.value]));
    expect(headerMap['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headerMap['Content-Security-Policy']).toContain("style-src 'self'");
    expect(headerMap['Content-Security-Policy']).not.toContain("'unsafe-inline'");
    expect(headerMap['X-Frame-Options']).toBe('DENY');
    expect(headerMap['X-Content-Type-Options']).toBe('nosniff');
  });

  it('cliente Supabase via CDN usa versao exata, SRI e CORS anonimo', () => {
    const html = readFile('index.html');
    const match = html.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+)"([^>]*)><\/script>/);
    expect(match?.[1]).toBe('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.104.0');
    expect(match?.[2]).toContain('crossorigin="anonymous"');
    expect(match?.[2]).toMatch(/integrity="sha384-[^"]+"/);
  });
});
