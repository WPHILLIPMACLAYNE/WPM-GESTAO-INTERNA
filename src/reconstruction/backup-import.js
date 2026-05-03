// Reconstructed Backup/Import from Reversa Task 09.
// Pure backup payloads, import coercion, granular preview, and guarded application.

import { APP_VERSION, LOCAL_SNAPSHOT_KEY, STORE_VERSION } from './config-global-state.js';
import { getPeriodLabel } from './domain-selectors.js';
import { normalizeData } from './lifecycle-normalization.js';
import {
  cloneSerializable,
  getInitialPeriodKey,
  getStoreVersion,
  isValidPeriodKey,
  setStoreVersion,
} from './period-builder.js';
import { getDefaultStore, prepareStoreCandidate } from './schema-migrations.js';

export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const BACKUP_SOURCE_APP_ID = 'wpm-gestao-interna';
export const BACKUP_INTEGRITY_ALGORITHM = 'canonical-sha256-v1';
export const LEGACY_BACKUP_INTEGRITY_ALGORITHM = 'canonical-fnv1a32-v1';

export function sanitizeDeep(value) {
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDeep(item)]));
  }
  if (typeof value === 'string') return value.replace(/\x00/g, '').trim();
  return value;
}

export function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function rotr32(value, shift) {
  return (value >>> shift) | (value << (32 - shift));
}

export function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = bytes.length + 1 + ((64 - ((bytes.length + 1 + 8) % 64)) % 64) + 8;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const w = new Uint32Array(64);

  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      w[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr32(w[index - 15], 7) ^ rotr32(w[index - 15], 18) ^ (w[index - 15] >>> 3);
      const s1 = rotr32(w[index - 2], 17) ^ rotr32(w[index - 2], 19) ^ (w[index - 2] >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + k[index] + w[index]) >>> 0;
      const s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return Array.from(h, value => value.toString(16).padStart(8, '0')).join('');
}

export function stripIntegrityEnvelope(payload) {
  const cloned = cloneSerializable(payload);
  if (isPlainObject(cloned?.meta)) {
    delete cloned.meta.integrity;
  }
  return cloned;
}

export function calculatePayloadIntegrityHash(payload, algorithm = BACKUP_INTEGRITY_ALGORITHM) {
  const canonical = canonicalJson(stripIntegrityEnvelope(payload));
  if (algorithm === LEGACY_BACKUP_INTEGRITY_ALGORITHM) return fnv1a32(canonical);
  return sha256Hex(canonical);
}

export function attachPayloadIntegrity(payload) {
  const next = cloneSerializable(payload);
  next.meta ||= {};
  next.meta.sourceAppId = next.meta.sourceAppId || BACKUP_SOURCE_APP_ID;
  next.meta.integrity = {
    algorithm: BACKUP_INTEGRITY_ALGORITHM,
    hash: calculatePayloadIntegrityHash(next),
  };
  return next;
}

export function verifyPayloadIntegrity(payload, options = {}) {
  const requireTrustedSource = options.requireTrustedSource !== false;
  const requireIntegrity = options.requireIntegrity !== false;
  const sourceAppId = String(payload?.meta?.sourceAppId || '');
  const integrity = payload?.meta?.integrity || null;

  if (requireTrustedSource && sourceAppId !== BACKUP_SOURCE_APP_ID) {
    return { ok: false, reason: 'untrusted-source', expected: BACKUP_SOURCE_APP_ID, received: sourceAppId };
  }

  if (!integrity) {
    return requireIntegrity
      ? { ok: false, reason: 'missing-integrity' }
      : { ok: true, reason: 'not-required' };
  }

  if (![BACKUP_INTEGRITY_ALGORITHM, LEGACY_BACKUP_INTEGRITY_ALGORITHM].includes(integrity.algorithm)) {
    return { ok: false, reason: 'unsupported-algorithm', expected: BACKUP_INTEGRITY_ALGORITHM, received: integrity.algorithm };
  }

  const expectedHash = calculatePayloadIntegrityHash(payload, integrity.algorithm);
  if (integrity.hash !== expectedHash) {
    return { ok: false, reason: 'hash-mismatch', expected: expectedHash, received: integrity.hash };
  }

  return { ok: true, reason: 'verified', hash: expectedHash };
}

export function getPeriodMetrics(period) {
  const target = cloneSerializable(period || {});
  normalizeData(target);
  return {
    recados: target.recados.length,
    students: target.students.length,
    pending: target.pending.length,
    events: target.events.length,
    scale: target.scale.length,
    mentions: target.nps.mentions.length,
    addonVolume: Object.values(target.addons || {}).reduce((acc, byType) => (
      acc + Object.values(byType || {}).reduce((sum, days) => (
        sum + (Array.isArray(days) ? days : []).reduce((dayAcc, value) => dayAcc + Number(value || 0), 0)
      ), 0)
    ), 0),
  };
}

export function getBackupSummary(storeRef) {
  const store = storeRef && typeof storeRef === 'object' ? storeRef : { periods: {}, archives: {} };
  const periods = Object.entries(store.periods || {});
  const totals = periods.reduce((acc, [, period]) => {
    const metrics = getPeriodMetrics(period);
    acc.recados += metrics.recados;
    acc.students += metrics.students;
    acc.pending += metrics.pending;
    acc.events += metrics.events;
    acc.scale += metrics.scale;
    acc.mentions += metrics.mentions;
    acc.addonVolume += metrics.addonVolume;
    return acc;
  }, { recados: 0, students: 0, pending: 0, events: 0, scale: 0, mentions: 0, addonVolume: 0 });

  return {
    periods: periods.length,
    archives: Object.keys(store.archives || {}).length,
    ...totals,
  };
}

export function buildBackupPayloadFromStore(storeSnapshot, options = {}) {
  const prepared = prepareStoreCandidate(storeSnapshot, options) || getDefaultStore(options);
  return attachPayloadIntegrity({
    meta: {
      kind: 'app-backup',
      appVersion: APP_VERSION,
      sourceAppId: BACKUP_SOURCE_APP_ID,
      exportedAt: options.exportedAt || new Date().toISOString(),
    },
    version: prepared.version,
    activePeriod: prepared.activePeriod,
    preferences: cloneSerializable(prepared.preferences),
    periods: cloneSerializable(prepared.periods),
    archives: cloneSerializable(prepared.archives),
  });
}

export function buildMonthArchivePayload(storeSnapshot, periodKey, periodLabel = getPeriodLabel(periodKey), options = {}) {
  const prepared = prepareStoreCandidate(storeSnapshot, options) || getDefaultStore(options);
  const normalizedKey = String(periodKey || prepared.activePeriod);
  const period = cloneSerializable(prepared.periods?.[normalizedKey] || {});
  normalizeData(period);

  return attachPayloadIntegrity({
    meta: {
      kind: 'month-archive',
      appVersion: APP_VERSION,
      sourceAppId: BACKUP_SOURCE_APP_ID,
      exportedAt: options.exportedAt || new Date().toISOString(),
    },
    version: prepared.version || STORE_VERSION,
    periodKey: normalizedKey,
    periodLabel: periodLabel || getPeriodLabel(normalizedKey),
    data: period,
  });
}

export function buildLocalSnapshot(payload, options = {}) {
  return {
    savedAt: options.savedAt || new Date().toISOString(),
    payload: cloneSerializable(payload),
  };
}

export function validateImportFile(file) {
  if (!file) return { ok: false, reason: 'missing-file', message: 'Nenhum arquivo selecionado.' };
  if (Number(file.size || 0) > MAX_IMPORT_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'file-too-large', message: 'Arquivo muito grande (maximo: 50MB).' };
  }
  const type = String(file.type || '');
  const name = String(file.name || '');
  if (type !== 'application/json' && !name.toLowerCase().endsWith('.json')) {
    return { ok: false, reason: 'invalid-format', message: 'Formato invalido. Selecione um arquivo .json.' };
  }
  return { ok: true };
}

export function parseImportedJsonText(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error, reason: 'invalid-json' };
  }
}

export function extractImportedPayload(source) {
  const cleanedRoot = sanitizeDeep(cloneSerializable(source));
  const payload = isPlainObject(cleanedRoot?.payload) ? cleanedRoot.payload : cleanedRoot;
  return isPlainObject(payload) ? payload : null;
}

export function isLegacyPeriodPayload(payload) {
  if (!isPlainObject(payload)) return false;
  return ['settings', 'students', 'pending', 'recados', 'nps', 'scale', 'events', 'addons', 'escala', 'eventos']
    .some((key) => key in payload);
}

export function isMonthArchivePayload(payload) {
  return Boolean(
    isPlainObject(payload)
      && isValidPeriodKey(payload.periodKey)
      && isPlainObject(payload.data),
  );
}

export function getMonthArchiveImportMeta(payload) {
  if (!isMonthArchivePayload(payload)) return null;
  const periodKey = String(payload.periodKey);
  return {
    periodKey,
    periodLabel: String(payload.periodLabel || '').trim() || getPeriodLabel(periodKey),
    exportedAt: String(payload?.meta?.exportedAt || '').trim(),
  };
}

export function buildArchiveEntryFromMonthArchivePayload(payload, existingArchive = null) {
  const meta = getMonthArchiveImportMeta(payload);
  if (!meta) return existingArchive || null;

  const exportedDate = meta.exportedAt ? new Date(meta.exportedAt) : null;
  const hasValidExportedDate = exportedDate && !Number.isNaN(exportedDate.getTime());
  const fallbackDate = existingArchive?.closedAt ? new Date(existingArchive.closedAt) : new Date();
  const normalizedDate = hasValidExportedDate ? exportedDate : fallbackDate;

  return {
    closedAt: normalizedDate.toISOString(),
    closedAtLabel: normalizedDate.toLocaleString('pt-BR'),
    label: meta.periodLabel || existingArchive?.label || getPeriodLabel(meta.periodKey),
  };
}

export function buildStoreFromMonthArchivePayload(payload, baseStore = null, options = {}) {
  const meta = getMonthArchiveImportMeta(payload);
  if (!meta) return null;

  const baseCandidate = prepareStoreCandidate(cloneSerializable(baseStore), options) || getDefaultStore(options);
  const nextStore = cloneSerializable(baseCandidate);
  nextStore.periods ||= {};
  nextStore.archives ||= {};
  nextStore.periods[meta.periodKey] = cloneSerializable(payload.data);
  normalizeData(nextStore.periods[meta.periodKey]);
  nextStore.archives[meta.periodKey] = buildArchiveEntryFromMonthArchivePayload(payload, nextStore.archives[meta.periodKey]);
  return prepareStoreCandidate(nextStore, options);
}

export function getImportedPayloadDescriptor(source) {
  const payload = extractImportedPayload(source);
  if (!payload) return { kind: 'unknown' };

  if (isMonthArchivePayload(payload)) {
    const meta = getMonthArchiveImportMeta(payload);
    return {
      kind: 'month-archive',
      periodKey: meta.periodKey,
      periodLabel: meta.periodLabel,
      hasIntegrity: Boolean(payload?.meta?.integrity),
    };
  }

  if (isPlainObject(payload.periods)) {
    return {
      kind: 'full-backup',
      periodCount: Object.keys(payload.periods).filter(isValidPeriodKey).length,
      hasIntegrity: Boolean(payload?.meta?.integrity),
    };
  }

  if (isLegacyPeriodPayload(payload)) {
    return { kind: 'legacy-period', hasIntegrity: Boolean(payload?.meta?.integrity) };
  }

  return { kind: 'unknown' };
}

export function coerceImportedStore(source, baseStore = null, options = {}) {
  const payload = extractImportedPayload(source);
  if (!payload) return null;

  if (isMonthArchivePayload(payload)) {
    return buildStoreFromMonthArchivePayload(payload, baseStore, options);
  }

  if (isPlainObject(payload.periods)) {
    return prepareStoreCandidate(payload, options);
  }

  if (isLegacyPeriodPayload(payload)) {
    const initialKey = options.currentPeriodKey || getInitialPeriodKey(options.date);
    return prepareStoreCandidate({
      version: getStoreVersion(payload),
      activePeriod: initialKey,
      periods: { [initialKey]: payload },
      archives: {},
    }, options);
  }

  return null;
}

export function summarizePeriodDiff(periodKey, beforePeriod, afterPeriod) {
  const beforeMetrics = beforePeriod ? getPeriodMetrics(beforePeriod) : null;
  const afterMetrics = afterPeriod ? getPeriodMetrics(afterPeriod) : null;
  let action = 'unchanged';
  if (!beforePeriod && afterPeriod) action = 'added';
  else if (beforePeriod && !afterPeriod) action = 'removed';
  else if (canonicalJson(beforeMetrics) !== canonicalJson(afterMetrics) || canonicalJson(beforePeriod) !== canonicalJson(afterPeriod)) action = 'replaced';

  return {
    periodKey,
    label: getPeriodLabel(periodKey),
    action,
    before: beforeMetrics,
    after: afterMetrics,
  };
}

export function buildImportPreview(source, baseStore = null, options = {}) {
  const descriptor = getImportedPayloadDescriptor(source);
  const targetStore = coerceImportedStore(source, baseStore, options);
  const beforeStore = prepareStoreCandidate(baseStore, options) || getDefaultStore(options);
  if (!targetStore) {
    return {
      ok: false,
      descriptor,
      reason: 'invalid-store',
      periodChanges: [],
      summaryBefore: getBackupSummary(beforeStore),
      summaryAfter: null,
    };
  }

  const periodKeys = [...new Set([
    ...Object.keys(beforeStore.periods || {}),
    ...Object.keys(targetStore.periods || {}),
  ])].filter(isValidPeriodKey).sort();
  const periodChanges = periodKeys.map((key) => summarizePeriodDiff(
    key,
    beforeStore.periods?.[key] || null,
    targetStore.periods?.[key] || null,
  ));
  const destructiveChanges = periodChanges.filter((change) => change.action === 'removed' || change.action === 'replaced');

  return {
    ok: true,
    descriptor,
    targetStore,
    summaryBefore: getBackupSummary(beforeStore),
    summaryAfter: getBackupSummary(targetStore),
    periodChanges,
    destructiveChanges,
    requiresGranularPreview: descriptor.kind === 'full-backup' && destructiveChanges.length > 0,
  };
}

export function validateImportGuards(source, preview, options = {}) {
  if (!preview?.ok) return { ok: false, reason: preview?.reason || 'invalid-preview' };
  const descriptor = preview.descriptor || getImportedPayloadDescriptor(source);
  const payload = extractImportedPayload(source);
  const isDestructiveFullBackup = descriptor.kind === 'full-backup';

  if (isDestructiveFullBackup && preview.requiresGranularPreview && options.previewAccepted !== true) {
    return {
      ok: false,
      reason: 'preview-required',
      message: 'Importacao completa exige preview granular confirmado antes de substituir/remover periodos.',
    };
  }

  if (isDestructiveFullBackup) {
    const integrity = verifyPayloadIntegrity(payload, {
      requireIntegrity: options.requireIntegrity !== false,
      requireTrustedSource: options.requireTrustedSource !== false,
    });
    if (!integrity.ok) return integrity;
  }

  return { ok: true };
}

export async function buildBackupPayload(getCommittedStoreSnapshot, options = {}) {
  const storeSnapshot = typeof getCommittedStoreSnapshot === 'function'
    ? await getCommittedStoreSnapshot({
      persistCurrent: options.persistCurrent !== false,
      eventType: String(options.eventType || 'save'),
      broadcast: options.broadcast === true,
      skipRemoteSync: options.skipRemoteSync === true,
    })
    : options.storeSnapshot;
  return buildBackupPayloadFromStore(storeSnapshot, options);
}

export async function saveLocalSnapshot(persistSnapshot, payload, options = {}) {
  if (typeof persistSnapshot !== 'function') return null;
  const snapshot = buildLocalSnapshot(payload, options);
  const saved = await persistSnapshot(LOCAL_SNAPSHOT_KEY, snapshot);
  return saved ? snapshot : null;
}

export async function applyImportedStore(source, runtime = {}) {
  const baseStore = runtime.baseStore || null;
  const preview = runtime.preview || buildImportPreview(source, baseStore, runtime);
  const guard = validateImportGuards(source, preview, runtime);
  if (!guard.ok) {
    throw new Error(guard.message || `Import guard failed: ${guard.reason}`);
  }

  const normalized = preview.targetStore || coerceImportedStore(source, baseStore, runtime);
  if (!normalized) throw new Error('Estrutura invalida ou incompativel com o schema atual.');

  if (typeof runtime.exportPreventiveBackup === 'function') {
    await runtime.exportPreventiveBackup();
  }

  if (typeof runtime.saveStore !== 'function') {
    throw new Error('saveStore callback ausente.');
  }

  const saved = await runtime.saveStore(normalized, {
    silent: true,
    eventType: String(runtime.eventType || 'import'),
  });
  if (!saved) throw new Error('Falha ao persistir o backup importado.');

  const committedStore = typeof runtime.readStoredStore === 'function'
    ? await runtime.readStoredStore()
    : normalized;
  if (!committedStore) throw new Error('Falha ao recarregar o store importado apos persistir.');

  if (typeof runtime.syncAppState === 'function') await runtime.syncAppState(committedStore);
  if (typeof runtime.renderAll === 'function') runtime.renderAll();
  if (typeof runtime.syncPeriodControls === 'function') runtime.syncPeriodControls();
  if (typeof runtime.runSystemDiagnostics === 'function') runtime.runSystemDiagnostics(true);

  return getBackupSummary(committedStore);
}
