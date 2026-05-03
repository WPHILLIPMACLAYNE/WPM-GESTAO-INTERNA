// Reconstructed Schema/Migrations from Reversa Task 07.
// AppStore migration and sanitization pipeline for local, backup, and remote stores.

import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  STORE_VERSION,
} from './config-global-state.js';
import { normalizeData } from './lifecycle-normalization.js';
import {
  buildBootstrapPeriod,
  cloneSerializable,
  getInitialPeriodKey,
  getStoreVersion,
  isValidPeriodKey,
  normalizePeriodKey,
  normalizeStorePreferences,
  seedYear,
  setStoreVersion,
} from './period-builder.js';

export { LEGACY_STORAGE_KEYS, STORAGE_KEY, STORE_VERSION };
export {
  buildBootstrapPeriod,
  cloneSerializable,
  getInitialPeriodKey,
  getStoreVersion,
  isValidPeriodKey,
  normalizeData,
  normalizePeriodKey,
  normalizeStorePreferences,
  seedYear,
  setStoreVersion,
};

export function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function normalizeStore(store, options = {}) {
  const next = isPlainObject(store) ? store : {};
  next.activePeriod = normalizePeriodKey(next.activePeriod);
  next.periods = isPlainObject(next.periods) ? next.periods : {};
  next.archives = isPlainObject(next.archives) ? next.archives : {};
  next.preferences = normalizeStorePreferences(next.preferences, options);

  Object.keys(next.periods).forEach((key) => {
    const period = next.periods[key];
    if (!isValidPeriodKey(key) || !isPlainObject(period)) {
      delete next.periods[key];
      return;
    }
    normalizeData(period);
  });

  if (!next.periods[next.activePeriod]) {
    const source = Object.values(next.periods)[0] || null;
    next.periods[next.activePeriod] = buildBootstrapPeriod(source, next.activePeriod, { ...options, storeRef: next });
  }

  return next;
}

export function getDefaultStore(options = {}) {
  const initialKey = getInitialPeriodKey(options.date);
  return sanitizeStore({
    version: STORE_VERSION,
    activePeriod: initialKey,
    preferences: normalizeStorePreferences(null, options),
    periods: seedYear(String(initialKey).split('-')[0], {
      ...options,
      withTestData: normalizeStorePreferences(null, options).initializeMonthsWithTestData,
    }),
    archives: {},
  }, options);
}

export function migrateStoreToV1(store) {
  if (!isPlainObject(store)) return null;
  return setStoreVersion(store, 1);
}

export function migrateStoreToV2(store) {
  if (!isPlainObject(store)) return null;
  return setStoreVersion(store, 2);
}

export function migrateStoreToV3(store) {
  if (!isPlainObject(store)) return null;
  return setStoreVersion(store, 3);
}

export function migrateStoreToV4(store) {
  if (!isPlainObject(store)) return null;
  // V4 is intentionally a schema milestone/bump with no incompatible transform.
  return setStoreVersion(store, 4);
}

export function migrateStore(store) {
  if (!isPlainObject(store)) return null;

  let nextStore = store;
  if (getStoreVersion(nextStore) > STORE_VERSION) return null;

  if (getStoreVersion(nextStore) < 1) nextStore = migrateStoreToV1(nextStore);
  if (getStoreVersion(nextStore) < 2) nextStore = migrateStoreToV2(nextStore);
  if (getStoreVersion(nextStore) < 3) nextStore = migrateStoreToV3(nextStore);
  if (getStoreVersion(nextStore) < 4) nextStore = migrateStoreToV4(nextStore);

  return getStoreVersion(nextStore) === STORE_VERSION ? nextStore : null;
}

export function sanitizeStore(parsed, options = {}) {
  if (!isPlainObject(parsed)) return null;

  if (isPlainObject(parsed.settings) && Array.isArray(parsed.students)) {
    const currentKey = getInitialPeriodKey(options.date);
    return normalizeStore(setStoreVersion({
      version: getStoreVersion(parsed),
      activePeriod: currentKey,
      periods: { [currentKey]: cloneSerializable(parsed) },
      archives: {},
      preferences: {},
    }, getStoreVersion(parsed)), options);
  }

  if (!isPlainObject(parsed.periods)) return null;

  const rawPeriods = Object.fromEntries(
    Object.entries(parsed.periods)
      .filter(([key, value]) => isValidPeriodKey(key) && isPlainObject(value))
      .map(([key, value]) => [key, cloneSerializable(value)]),
  );
  const store = normalizeStore({
    version: getStoreVersion(parsed),
    activePeriod: parsed.activePeriod,
    periods: rawPeriods,
    archives: isPlainObject(parsed.archives) ? cloneSerializable(parsed.archives) : {},
    preferences: isPlainObject(parsed.preferences) ? cloneSerializable(parsed.preferences) : {},
  }, options);

  const currentYear = String(store.activePeriod || getInitialPeriodKey(options.date)).split('-')[0];
  const template = store.periods[store.activePeriod] || Object.values(store.periods)[0] || null;
  Object.entries(seedYear(currentYear, { ...options, storeRef: store, template })).forEach(([key, period]) => {
    if (!store.periods[key]) store.periods[key] = period;
  });

  return setStoreVersion(store, getStoreVersion(parsed));
}

export function prepareStoreCandidate(storeLike, options = {}) {
  const cloned = cloneSerializable(storeLike);
  const migrated = migrateStore(cloned);
  if (!migrated) return null;

  const sanitized = sanitizeStore(migrated, options);
  if (!sanitized) return null;

  return setStoreVersion(sanitized, STORE_VERSION);
}

export async function readStoredStore(rawValue, options = {}) {
  if (typeof rawValue !== 'string') return null;

  try {
    return prepareStoreCandidate(JSON.parse(rawValue), options);
  } catch (error) {
    if (typeof options.preserveCorrupted === 'function') {
      await options.preserveCorrupted(`${STORAGE_KEY}_corrompido_${Date.now()}`, rawValue, error);
    }
    return null;
  }
}
