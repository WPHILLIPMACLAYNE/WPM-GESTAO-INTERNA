import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  AUXILIARY_BODY_SCRIPTS,
  REQUIRED_CHART_CANVAS_IDS,
  REQUIRED_CSP_DIRECTIVES,
  REQUIRED_LOCAL_SCRIPT_ORDER,
  REQUIRED_MOUNT_IDS,
  REQUIRED_VIEW_IDS,
  extractHtmlLang,
  extractIds,
  extractLinkTags,
  extractScripts,
  extractTitle,
  getCdnScripts,
  getHttpEquivMeta,
  getLocalScriptSources,
  normalizeShellText,
  parseCsp,
  validateAppShell,
  validateCsp,
  validateScriptOrder,
} from '../../src/reconstruction/app-shell.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

describe('reconstruction app shell', () => {
  it('valida o contrato estrutural completo do index real', () => {
    const html = readFile('index.html');
    const result = validateAppShell(html);

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(extractHtmlLang(html)).toBe('pt-BR');
    expect(normalizeShellText(extractTitle(html))).toBe('WPM Gestao Interna - v34');
  });

  it('mantem CSP sem unsafe-inline e com fontes essenciais', () => {
    const html = readFile('index.html');
    const cspMeta = getHttpEquivMeta(html, 'Content-Security-Policy');
    const csp = parseCsp(cspMeta.content);
    const validation = validateCsp(cspMeta.content);

    expect(validation).toMatchObject({ ok: true });
    Object.keys(REQUIRED_CSP_DIRECTIVES).forEach((directive) => {
      expect(csp).toHaveProperty(directive);
    });
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['style-src']).not.toContain("'unsafe-inline'");
    expect(csp['frame-ancestors']).toContain("'none'");
    expect(csp['connect-src']).toEqual(expect.arrayContaining([
      'http://127.0.0.1:54321',
      'http://localhost:54321',
      'https://*.supabase.co',
      'wss://*.supabase.co',
    ]));
  });

  it('preserva links PWA, stylesheet runtime e fallback noscript', () => {
    const html = readFile('index.html');
    const links = extractLinkTags(html);

    expect(links).toContainEqual(expect.objectContaining({ rel: 'manifest', href: 'manifest.json' }));
    expect(links).toContainEqual(expect.objectContaining({ rel: 'apple-touch-icon', href: 'icons/icon-192.svg' }));
    expect(links).toContainEqual(expect.objectContaining({
      rel: 'stylesheet',
      href: 'styles.css',
      'data-runtime-stylesheet': '',
    }));
    expect(html).toMatch(/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/i);
    expect(fs.existsSync(path.join(ROOT_DIR, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT_DIR, 'icons/icon-192.svg'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT_DIR, 'styles.css'))).toBe(true);
  });

  it('carrega CDNs esperadas com versao fixa e atributos de seguranca', () => {
    const html = readFile('index.html');
    const cdn = getCdnScripts(html);

    expect(cdn.dompurify).toMatchObject({
      src: 'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js',
      attrs: expect.objectContaining({ integrity: expect.any(String), crossorigin: 'anonymous' }),
    });
    expect(cdn.chart).toMatchObject({
      src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
      attrs: expect.objectContaining({ integrity: expect.any(String), crossorigin: 'anonymous' }),
    });
    expect(cdn.supabase).toMatchObject({
      src: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.104.0',
      attrs: expect.objectContaining({ integrity: expect.stringMatching(/^sha384-/), crossorigin: 'anonymous' }),
    });
  });

  it('preserva ordem de scripts classicos e main antes dos auxiliares finais', () => {
    const html = readFile('index.html');
    const scriptOrder = validateScriptOrder(html);
    const localSources = getLocalScriptSources(html);

    expect(scriptOrder).toMatchObject({ ok: true, failures: [] });
    expect(localSources.slice(0, REQUIRED_LOCAL_SCRIPT_ORDER.length)).toEqual(REQUIRED_LOCAL_SCRIPT_ORDER);
    expect(localSources.slice(-AUXILIARY_BODY_SCRIPTS.length)).toEqual(AUXILIARY_BODY_SCRIPTS);
    expect(localSources.indexOf('src/core/env-bootstrap.js')).toBeLessThan(localSources.indexOf('src/core/config.js'));
    expect(localSources.indexOf('src/core/lifecycle.js')).toBeLessThan(localSources.indexOf('src/main.js'));
    expect(localSources.indexOf('src/main.js')).toBeLessThan(localSources.indexOf('src/ui/back-to-top.js'));
    extractScripts(html).filter((script) => script.src.startsWith('src/')).forEach((script) => {
      expect(fs.existsSync(path.join(ROOT_DIR, script.src))).toBe(true);
    });
  });

  it('expoe tabs, pontos de montagem, canvases e modais criticos', () => {
    const html = readFile('index.html');
    const ids = extractIds(html);
    const required = [
      ...REQUIRED_VIEW_IDS,
      ...REQUIRED_MOUNT_IDS,
      ...REQUIRED_CHART_CANVAS_IDS,
      'studentTableBody',
      'pendingTableBody',
      'pendingKanban',
      'npsRankingList',
      'scaleBoard',
      'scaleTableBody',
      'eventsCalendar',
      'eventsList',
      'eventsTableBody',
      'teamSuggestions',
      'saveToast',
      'appLiveRegion',
      'appLiveRegionUrgente',
    ];

    required.forEach((id) => {
      expect(ids, `missing id ${id}`).toContain(id);
    });
    REQUIRED_VIEW_IDS.forEach((view) => {
      expect(html).toContain(`data-tab="${view}"`);
      expect(html).toContain(`aria-controls="${view}"`);
    });
  });
});
