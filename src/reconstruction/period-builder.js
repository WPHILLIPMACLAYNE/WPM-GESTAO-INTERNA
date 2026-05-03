// Reconstructed period-builder from Reversa Task 07.
// Version helpers, store preferences, and deterministic period seeding.

import {
  APP_DEFAULTS,
  createAppStorePreferenceDefaults,
  detectAppRuntime,
} from './config-global-state.js';
import { normalizeData, seedAddons, uniqueTexts } from './lifecycle-normalization.js';

export const PERIOD_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function cloneSerializable(value) {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function getStoreVersion(store) {
  const version = Number(store?.version);
  return Number.isInteger(version) && version > 0 ? version : 0;
}

export function setStoreVersion(store, version) {
  if (!store || typeof store !== 'object') return store;
  store.version = Number(version) || 0;
  return store;
}

export function isValidPeriodKey(value) {
  return PERIOD_KEY_PATTERN.test(String(value || ''));
}

export function getInitialPeriodKey(date = new Date()) {
  const source = date instanceof Date ? date : new Date(date);
  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function normalizePeriodKey(value, fallback = getInitialPeriodKey()) {
  const key = String(value || '').trim();
  return isValidPeriodKey(key) ? key : fallback;
}

export function getPeriodMonthDays(periodKey) {
  const key = normalizePeriodKey(periodKey);
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function getPreferenceDefaults(globalLike = globalThis) {
  return createAppStorePreferenceDefaults(detectAppRuntime(globalLike));
}

export function normalizeStorePreferences(preferences = null, options = {}) {
  const defaults = options.defaults || getPreferenceDefaults(options.globalLike);
  const source = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  return {
    initializeMonthsWithTestData: source.initializeMonthsWithTestData == null
      ? defaults.initializeMonthsWithTestData
      : Boolean(source.initializeMonthsWithTestData),
  };
}

export function shouldInitializeMonthsWithTestData(storeRef = null, options = {}) {
  return normalizeStorePreferences(storeRef?.preferences, options).initializeMonthsWithTestData;
}

export function buildCleanPeriodFromTemplate(template = null, key = getInitialPeriodKey()) {
  const periodKey = normalizePeriodKey(key);
  const source = cloneSerializable(template || {});
  normalizeData(source);

  const receptionists = uniqueTexts(source?.settings?.receptionists).length
    ? uniqueTexts(source.settings.receptionists)
    : [...APP_DEFAULTS.receptionists];
  const professors = uniqueTexts(source?.settings?.professors).length
    ? uniqueTexts(source.settings.professors)
    : [...APP_DEFAULTS.professors];
  const addonTypes = uniqueTexts(source?.settings?.addonTypes).length
    ? uniqueTexts(source.settings.addonTypes)
    : [...APP_DEFAULTS.addonTypes];

  const clean = {
    settings: {
      team: [...receptionists],
      receptionists,
      professors,
      addonTypes,
      monthDays: getPeriodMonthDays(periodKey),
    },
    students: [],
    pending: [],
    recados: [],
    nps: {
      score: 0,
      monthlyGoal: Number(source?.nps?.monthlyGoal ?? 75),
      semesterGoal: Number(source?.nps?.semesterGoal ?? 80),
      observations: '',
      mentions: [],
      rankSnapshot: {},
    },
    scale: [],
    events: [],
    addons: {},
  };

  seedAddons(clean);
  normalizeData(clean);
  return clean;
}

export function generatePeriodSeed(key = getInitialPeriodKey(), template = null) {
  const seeded = buildCleanPeriodFromTemplate(template, key);
  const defaultStudents = Array.isArray(APP_DEFAULTS.studentNames) ? APP_DEFAULTS.studentNames : [];
  const defaultPending = Array.isArray(APP_DEFAULTS.pendingItems) ? APP_DEFAULTS.pendingItems : [];
  const defaultEvents = Array.isArray(APP_DEFAULTS.events) ? APP_DEFAULTS.events : [];
  const defaultScale = Array.isArray(APP_DEFAULTS.scale) ? APP_DEFAULTS.scale : [];

  seeded.students = defaultStudents.map((name, index) => ({
    id: `seed-student-${key}-${index + 1}`,
    nome: name,
    matricula: String(1000 + index),
    ultimaVisita: `${key}-${String(Math.min(28, index + 1)).padStart(2, '0')}`,
    horaVisita: '',
    inicio: `${key}-${String(Math.min(28, index + 1)).padStart(2, '0')}`,
    avisoNps: 'Sim',
    atendimento: seeded.settings.receptionists[index % Math.max(1, seeded.settings.receptionists.length)] || '',
    feedback: 'Pendente',
    addon: '',
    observacoes: '',
  }));
  seeded.pending = cloneSerializable(defaultPending);
  seeded.events = cloneSerializable(defaultEvents);
  seeded.scale = cloneSerializable(defaultScale);
  normalizeData(seeded);
  return seeded;
}

export function buildBootstrapPeriod(template = null, key = getInitialPeriodKey(), options = {}) {
  const withTestData = typeof options.withTestData === 'boolean'
    ? options.withTestData
    : shouldInitializeMonthsWithTestData(options.storeRef, options);

  return withTestData ? generatePeriodSeed(key, template) : buildCleanPeriodFromTemplate(template, key);
}

export function buildEmptyPeriodFromTemplate(template = null, key = getInitialPeriodKey()) {
  return buildCleanPeriodFromTemplate(template, key);
}

export function resetPeriodData(store, key, template = null) {
  if (!store || typeof store !== 'object') return null;
  store.periods ||= {};
  const periodKey = normalizePeriodKey(key);
  store.periods[periodKey] = buildCleanPeriodFromTemplate(template, periodKey);
  normalizeData(store.periods[periodKey]);
  return store.periods[periodKey];
}

export function seedYear(year, options = {}) {
  const normalizedYear = String(Number(year) || new Date().getFullYear()).padStart(4, '0');
  const periods = {};
  for (let month = 1; month <= 12; month += 1) {
    const key = `${normalizedYear}-${String(month).padStart(2, '0')}`;
    periods[key] = buildBootstrapPeriod(options.template || null, key, options);
  }
  return periods;
}
