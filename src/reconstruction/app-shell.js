// Reconstructed App Shell contract from Reversa Task 14.
// Structural parser/validator for index.html, CSP, classic script order and DOM IDs.

export const APP_SHELL_TITLE = 'WPM Gestao Interna';
export const APP_SHELL_VERSION_TITLE = 'WPM Gestao Interna - v34';

export const REQUIRED_LOCAL_SCRIPT_ORDER = Object.freeze([
  'src/core/env-bootstrap.js',
  'src/utils/helpers.js',
  'src/core/config.js',
  'src/core/observability.js',
  'src/core/supabase.js',
  'src/core/period-builder.js',
  'src/core/seed.js',
  'src/core/schema.js',
  'src/core/storage.js',
  'src/domain/selectors.js',
  'src/features/forms.js',
  'src/features/nps.js',
  'src/features/csv.js',
  'src/features/diagnostics.js',
  'src/ui/render-core.js',
  'src/ui/render-dashboard.js',
  'src/ui/render-students.js',
  'src/ui/render-pending.js',
  'src/ui/render-nps.js',
  'src/ui/render-scale.js',
  'src/ui/render-events.js',
  'src/ui/render-settings.js',
  'src/ui/render-addons.js',
  'src/features/crud.js',
  'src/ui/events-core.js',
  'src/ui/events-students.js',
  'src/ui/events-pending.js',
  'src/ui/events-addons.js',
  'src/ui/events-scale.js',
  'src/ui/events-nps.js',
  'src/core/backup.js',
  'src/core/lifecycle.js',
  'src/main.js',
]);

export const AUXILIARY_BODY_SCRIPTS = Object.freeze([
  'src/ui/back-to-top.js',
  'src/core/pwa.js',
]);

export const REQUIRED_VIEW_IDS = Object.freeze([
  'dashboard',
  'students',
  'addons',
  'pending',
  'nps',
  'scale',
  'events',
  'settings',
]);

export const REQUIRED_MOUNT_IDS = Object.freeze([
  'main-content',
  'periodMonthSelect',
  'periodYearInput',
  'monthStatusBadge',
  'closeMonthBtn',
  'dashboardCards',
  'summaryList',
  'addonsOverview',
  'pendingOverview',
  'supabaseAuthPanel',
  'appValidationFeedback',
  'studentModal',
  'pendingModal',
  'scaleModal',
  'eventModal',
  'confirmModal',
]);

export const REQUIRED_CHART_CANVAS_IDS = Object.freeze([
  'dashboardStudentsEvolutionChart',
  'dashboardReceptionistsChart',
  'dashboardFeedbackDistributionChart',
  'dashboardNpsTrendChart',
  'dashboardAddonRankingChart',
]);

export const REQUIRED_CSP_DIRECTIVES = Object.freeze({
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
  'style-src': ["'self'"],
  'connect-src': [
    "'self'",
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'ws://127.0.0.1:54321',
    'ws://localhost:54321',
    'https://*.supabase.co',
    'wss://*.supabase.co',
  ],
  'worker-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
});

export function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function normalizeShellText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2022\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractAttributes(tagSource = '') {
  const attrs = {};
  const attrPattern = /([^\s=<>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = attrPattern.exec(String(tagSource || '')))) {
    const [, name, doubleQuoted, singleQuoted, bare] = match;
    if (!name || name === '<script' || name === '<meta' || name === '<link' || name === '<html') continue;
    attrs[name.toLowerCase()] = decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? bare ?? '');
  }
  return attrs;
}

export function extractHtmlLang(html) {
  const match = String(html || '').match(/<html\b([^>]*)>/i);
  return match ? extractAttributes(match[1]).lang || '' : '';
}

export function extractTitle(html) {
  const match = String(html || '').match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

export function extractMetaTags(html) {
  return [...String(html || '').matchAll(/<meta\b([^>]*)>/gi)].map((match) => extractAttributes(match[1]));
}

export function extractLinkTags(html) {
  return [...String(html || '').matchAll(/<link\b([^>]*)>/gi)].map((match) => extractAttributes(match[1]));
}

export function extractScripts(html) {
  return [...String(html || '').matchAll(/<script\b([^>]*)><\/script>/gi)].map((match) => ({
    src: extractAttributes(match[1]).src || '',
    attrs: extractAttributes(match[1]),
    index: match.index,
  }));
}

export function extractIds(html) {
  return [...String(html || '').matchAll(/\bid=(?:"([^"]+)"|'([^']+)')/gi)]
    .map((match) => match[1] || match[2])
    .filter(Boolean);
}

export function getMetaByName(html, name) {
  return extractMetaTags(html).find((meta) => meta.name === name) || null;
}

export function getHttpEquivMeta(html, httpEquiv) {
  return extractMetaTags(html).find((meta) => meta['http-equiv'] === httpEquiv) || null;
}

export function parseCsp(content = '') {
  return String(content || '').split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, directive) => {
      const [name, ...values] = directive.split(/\s+/);
      acc[name] = values;
      return acc;
    }, {});
}

export function hasOrderedSubsequence(haystack = [], needle = []) {
  let cursor = 0;
  for (const item of haystack) {
    if (item === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return needle.length === 0;
}

export function missingItems(available = [], required = []) {
  const set = new Set(available);
  return required.filter((item) => !set.has(item));
}

export function validateCsp(cspContent = '', requiredDirectives = REQUIRED_CSP_DIRECTIVES) {
  const parsed = parseCsp(cspContent);
  const failures = [];
  Object.entries(requiredDirectives).forEach(([directive, requiredValues]) => {
    const values = parsed[directive] || [];
    if (!values.length) {
      failures.push(`missing-csp:${directive}`);
      return;
    }
    requiredValues.forEach((value) => {
      if (!values.includes(value)) failures.push(`missing-csp-value:${directive}:${value}`);
    });
  });
  ['script-src', 'style-src'].forEach((directive) => {
    if ((parsed[directive] || []).includes("'unsafe-inline'")) {
      failures.push(`unsafe-inline:${directive}`);
    }
  });
  return { ok: failures.length === 0, parsed, failures };
}

export function getCdnScripts(html) {
  const scripts = extractScripts(html).filter((script) => /^https?:\/\//.test(script.src));
  return {
    dompurify: scripts.find((script) => script.src.includes('dompurify@3.2.6')) || null,
    chart: scripts.find((script) => script.src.includes('chart.js@4.4.7')) || null,
    supabase: scripts.find((script) => script.src.includes('@supabase/supabase-js@2.104.0')) || null,
    scripts,
  };
}

export function getLocalScriptSources(html) {
  return extractScripts(html)
    .map((script) => script.src)
    .filter((src) => src && !/^https?:\/\//.test(src));
}

export function validateScriptOrder(html, requiredOrder = REQUIRED_LOCAL_SCRIPT_ORDER) {
  const localSources = getLocalScriptSources(html);
  const failures = [];
  const missing = missingItems(localSources, [...requiredOrder, ...AUXILIARY_BODY_SCRIPTS]);
  if (missing.length) failures.push(...missing.map((src) => `missing-script:${src}`));
  if (!hasOrderedSubsequence(localSources, requiredOrder)) failures.push('local-script-order');
  if (localSources.at(-2) !== 'src/ui/back-to-top.js' || localSources.at(-1) !== 'src/core/pwa.js') {
    failures.push('auxiliary-body-scripts-last');
  }
  if (localSources.indexOf('src/core/env-bootstrap.js') > localSources.indexOf('src/core/config.js')) {
    failures.push('env-bootstrap-after-config');
  }
  if (localSources.indexOf('src/main.js') < localSources.indexOf('src/core/lifecycle.js')) {
    failures.push('main-before-lifecycle');
  }
  return { ok: failures.length === 0, localSources, failures };
}

export function validateAppShell(html, options = {}) {
  const failures = [];
  const ids = extractIds(html);
  const links = extractLinkTags(html);
  const metas = extractMetaTags(html);
  const cspMeta = getHttpEquivMeta(html, 'Content-Security-Policy');
  const csp = validateCsp(cspMeta?.content || '');
  const scriptOrder = validateScriptOrder(html, options.requiredScriptOrder || REQUIRED_LOCAL_SCRIPT_ORDER);
  const cdn = getCdnScripts(html);
  const requiredIds = [
    ...REQUIRED_VIEW_IDS,
    ...REQUIRED_MOUNT_IDS,
    ...REQUIRED_CHART_CANVAS_IDS,
    ...(options.requiredIds || []),
  ];

  if (extractHtmlLang(html) !== 'pt-BR') failures.push('lang');
  if (normalizeShellText(extractTitle(html)) !== APP_SHELL_VERSION_TITLE) failures.push('title');
  if (!getMetaByName(html, 'viewport')?.content?.includes('width=device-width')) failures.push('viewport');
  if (!normalizeShellText(getMetaByName(html, 'description')?.content).includes('WPM Gestao Interna')) failures.push('description');
  if (!getMetaByName(html, 'theme-color')?.content) failures.push('theme-color');
  if (!links.some((link) => link.rel === 'manifest' && link.href === 'manifest.json')) failures.push('manifest-link');
  if (!links.some((link) => link.rel === 'apple-touch-icon' && link.href === 'icons/icon-192.svg')) failures.push('apple-icon');
  if (!links.some((link) => link.rel === 'stylesheet' && link.href === 'styles.css' && Object.hasOwn(link, 'data-runtime-stylesheet'))) failures.push('runtime-stylesheet');
  if (!/<noscript\b[\s\S]*JavaScript[\s\S]*<\/noscript>/i.test(String(html || ''))) failures.push('noscript');

  failures.push(...csp.failures);
  failures.push(...scriptOrder.failures);
  failures.push(...missingItems(ids, requiredIds).map((id) => `missing-id:${id}`));

  if (!cdn.dompurify || cdn.dompurify.attrs.integrity === undefined || cdn.dompurify.attrs.crossorigin !== 'anonymous') {
    failures.push('cdn-dompurify');
  }
  if (!cdn.chart || cdn.chart.attrs.integrity === undefined || cdn.chart.attrs.crossorigin !== 'anonymous') {
    failures.push('cdn-chart');
  }
  if (!cdn.supabase || cdn.supabase.attrs.integrity === undefined || cdn.supabase.attrs.crossorigin !== 'anonymous') {
    failures.push('cdn-supabase');
  }

  return {
    ok: failures.length === 0,
    failures,
    details: {
      ids,
      links,
      metas,
      csp: csp.parsed,
      localScripts: scriptOrder.localSources,
      cdn,
    },
  };
}
