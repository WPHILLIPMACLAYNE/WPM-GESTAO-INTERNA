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

function restoreGlobal(name, snapshot) {
  if (snapshot.exists) {
    globalThis[name] = snapshot.value;
    return;
  }
  delete globalThis[name];
}

function collectAppScripts(html) {
  return [...html.matchAll(/<script src="([^"]+)"/g)]
    .map(match => match[1])
    .filter(src => !src.startsWith('http'));
}

export async function loadRealApp() {
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

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Node = window.Node;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.Blob = window.Blob;
  globalThis.FileReader = window.FileReader;
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.requestAnimationFrame = cb => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  globalThis.structuredClone = globalThis.structuredClone || window.structuredClone || structuredClone;
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  window.crypto = crypto.webcrypto;
  window.structuredClone = globalThis.structuredClone;
  window.DOMPurify = { sanitize: value => value };

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
