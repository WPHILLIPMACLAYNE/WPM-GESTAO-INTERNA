import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function captureGlobal(name) {
  return Object.prototype.hasOwnProperty.call(globalThis, name)
    ? { exists: true, value: globalThis[name] }
    : { exists: false, value: undefined };
}

function setMutableProperty(target, name, value) {
  Object.defineProperty(target, name, {
    configurable: true,
    writable: true,
    value
  });
}

function restoreGlobal(name, snapshot) {
  if (snapshot.exists) {
    setMutableProperty(globalThis, name, snapshot.value);
    return;
  }
  delete globalThis[name];
}

function collectAppScripts(html) {
  return [...html.matchAll(/<script src="([^"]+)"/g)]
    .map(match => match[1])
    .filter(src => !src.startsWith('http'))
    .filter(src => src !== 'env.js')
    .filter(src => fs.existsSync(path.join(ROOT_DIR, src)));
}

export async function loadRealApp(options = {}) {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const scripts = collectAppScripts(html);
  const bundle = scripts
    .map(src => fs.readFileSync(path.join(ROOT_DIR, src), 'utf8'))
    .join('\n\n');

  const window = new Window({ url: 'http://localhost/' });
  const previousGlobals = {
    window: captureGlobal('window'),
    document: captureGlobal('document'),
    localStorage: captureGlobal('localStorage'),
    sessionStorage: captureGlobal('sessionStorage'),
    HTMLElement: captureGlobal('HTMLElement'),
    Node: captureGlobal('Node'),
    CustomEvent: captureGlobal('CustomEvent'),
    Blob: captureGlobal('Blob'),
    FileReader: captureGlobal('FileReader'),
    Event: captureGlobal('Event'),
    MouseEvent: captureGlobal('MouseEvent'),
    KeyboardEvent: captureGlobal('KeyboardEvent'),
    requestAnimationFrame: captureGlobal('requestAnimationFrame'),
    cancelAnimationFrame: captureGlobal('cancelAnimationFrame'),
    structuredClone: captureGlobal('structuredClone')
  };

  const requestAnimationFrame = cb => setTimeout(cb, 0);
  const cancelAnimationFrame = id => clearTimeout(id);
  const structuredCloneImpl = globalThis.structuredClone || window.structuredClone || structuredClone;

  setMutableProperty(globalThis, 'window', window);
  setMutableProperty(globalThis, 'document', window.document);
  setMutableProperty(globalThis, 'localStorage', window.localStorage);
  setMutableProperty(globalThis, 'sessionStorage', window.sessionStorage);
  setMutableProperty(globalThis, 'HTMLElement', window.HTMLElement);
  setMutableProperty(globalThis, 'Node', window.Node);
  setMutableProperty(globalThis, 'CustomEvent', window.CustomEvent);
  setMutableProperty(globalThis, 'Blob', window.Blob);
  setMutableProperty(globalThis, 'FileReader', window.FileReader);
  setMutableProperty(globalThis, 'Event', window.Event);
  setMutableProperty(globalThis, 'MouseEvent', window.MouseEvent);
  setMutableProperty(globalThis, 'KeyboardEvent', window.KeyboardEvent);
  setMutableProperty(globalThis, 'requestAnimationFrame', requestAnimationFrame);
  setMutableProperty(globalThis, 'cancelAnimationFrame', cancelAnimationFrame);
  setMutableProperty(globalThis, 'structuredClone', structuredCloneImpl);
  setMutableProperty(window, 'requestAnimationFrame', requestAnimationFrame);
  setMutableProperty(window, 'cancelAnimationFrame', cancelAnimationFrame);
  setMutableProperty(window, 'crypto', crypto.webcrypto);
  setMutableProperty(window, 'structuredClone', structuredCloneImpl);
  setMutableProperty(window, 'DOMPurify', { sanitize: value => value });
  setMutableProperty(window, '__APP_ENV__', Object.assign({
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    SENTRY_DSN: null,
    SENTRY_ENVIRONMENT: null,
    SENTRY_RELEASE: null,
    APP_RUNTIME_OVERRIDE: null
  }, window.__APP_ENV__ || {}, options.appEnv || {}));

  window.document.write(html);
  window.eval(bundle);
  await new Promise(resolve => setTimeout(resolve, 120));

  return {
    window,
    async setStore(store) {
      await window.syncAppState(store);
      await window.saveData({ silent: true, broadcast: false, eventType: 'unit-test-seed' });
      await new Promise(resolve => setTimeout(resolve, 20));
    },
    cleanup() {
      window.close();
      Object.entries(previousGlobals).forEach(([name, snapshot]) => restoreGlobal(name, snapshot));
    }
  };
}
