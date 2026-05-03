// Reconstructed Config/Global State from Reversa Task 05.
// Classic-script contract expressed as ESM so it can be tested and reused.

export const APP_VERSION = 'v34';
export const STORE_VERSION = 4;

export const STORAGE_KEY = 'recepcao-smartfit-dashboard-v34';
export const STORAGE_BROADCAST_KEY = 'recepcao-smartfit-dashboard-sync-v34';
export const LEGACY_STORAGE_KEYS = Object.freeze([
  'recepcao-smartfit-dashboard-v33',
  'recepcao-smartfit-dashboard-v24',
]);

export const LOCAL_SNAPSHOT_KEY = 'recepcao-smartfit-dashboard-snapshot-v34';
export const SYSTEM_REPORT_KEY = 'recepcao-smartfit-dashboard-system-report-v34';
export const FLOW_TEST_REPORT_KEY = 'recepcao-smartfit-dashboard-flowtests-v34';
export const MIGRATION_DRY_RUN_REPORT_KEY = 'recepcao-smartfit-dashboard-migration-dry-run-v34';
export const UI_KEY = 'recepcao-smartfit-dashboard-ui-v34';

export const IDB_NAME = 'wpm-gestao-interna-db';
export const IDB_STORE_NAME = 'app_kv';

export const MONTH_NAMES_PT_BR = Object.freeze([
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]);

export const LOCAL_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1', '::1', '[::1]']);
export const VALID_APP_RUNTIMES = Object.freeze(['development', 'production']);

export const APP_DEFAULTS = Object.freeze({
  receptionists: Object.freeze([]),
  professors: Object.freeze([]),
  addonTypes: Object.freeze([]),
  studentNames: Object.freeze([]),
  pendingItems: Object.freeze([]),
  events: Object.freeze([]),
  scale: Object.freeze([]),
  notes: Object.freeze([]),
  seedOnly: true,
});

export function readAppEnv(globalLike = globalThis) {
  try {
    return globalLike?.__APP_ENV__ && typeof globalLike.__APP_ENV__ === 'object'
      ? globalLike.__APP_ENV__
      : {};
  } catch {
    return {};
  }
}

export function cleanString(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function normalizeRuntimeOverride(value) {
  return VALID_APP_RUNTIMES.includes(value) ? value : null;
}

export function detectAppRuntime(globalLike = globalThis) {
  const env = readAppEnv(globalLike);
  const override = normalizeRuntimeOverride(env.APP_RUNTIME_OVERRIDE);
  if (override) return override;

  try {
    const protocol = globalLike?.location?.protocol || '';
    const hostname = globalLike?.location?.hostname || '';
    if ((protocol === 'http:' || protocol === 'https:') && LOCAL_HOSTNAMES.includes(hostname)) {
      return 'development';
    }
  } catch {
    return 'production';
  }

  return 'production';
}

export function resolveReleaseMetadata(globalLike = globalThis) {
  const env = readAppEnv(globalLike);
  const commit = cleanString(env.APP_COMMIT, 'local');
  const buildTime = cleanString(env.APP_BUILD_TIME, null);
  const releaseLabel = commit && commit !== 'local'
    ? `${APP_VERSION} (${commit.slice(0, 7)})`
    : APP_VERSION;

  return {
    APP_COMMIT: commit,
    APP_BUILD_TIME: buildTime,
    APP_RELEASE_LABEL: releaseLabel,
    APP_RUNTIME: detectAppRuntime(globalLike),
  };
}

export function createAppStorePreferenceDefaults(appRuntime) {
  return Object.freeze({
    initializeMonthsWithTestData: appRuntime === 'development',
  });
}

export function createDomHelper(documentLike = globalThis.document) {
  return Object.freeze({
    byId(id) {
      return documentLike?.getElementById ? documentLike.getElementById(id) : null;
    },

    html(id, markup) {
      const element = this.byId(id);
      if (element) element.innerHTML = markup;
      return element;
    },

    text(id, value) {
      const element = this.byId(id);
      if (element) element.textContent = value;
      return element;
    },

    value(id, fallback = '') {
      const element = this.byId(id);
      return element && 'value' in element ? element.value : fallback;
    },

    setValue(id, value) {
      const element = this.byId(id);
      if (element && 'value' in element) element.value = value;
      return element;
    },
  });
}

export function formatDateToLocalISO(dateLike = new Date()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(offsetDays = 0, baseDate = new Date()) {
  const date = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Number(offsetDays || 0));
  return formatDateToLocalISO(date);
}

export function currentMonthDayISO(day = 1, baseDate = new Date()) {
  const date = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(1);
  date.setDate(Math.max(1, Number(day) || 1));
  return formatDateToLocalISO(date);
}

export function createEditingState(overrides = {}) {
  return {
    editingStudentId: overrides.editingStudentId ?? null,
    editingPendingId: overrides.editingPendingId ?? null,
    editingScaleId: overrides.editingScaleId ?? null,
    editingEventId: overrides.editingEventId ?? null,
  };
}

export function createGlobalState(overrides = {}) {
  return {
    storage: overrides.storage ?? null,
    currentPeriodKey: overrides.currentPeriodKey ?? '',
    state: overrides.state ?? null,
    ...createEditingState(overrides),
  };
}

export function createConfig(globalLike = globalThis, documentLike = globalLike?.document) {
  const release = resolveReleaseMetadata(globalLike);

  return Object.freeze({
    STORAGE_KEY,
    STORAGE_BROADCAST_KEY,
    STORE_VERSION,
    LEGACY_STORAGE_KEYS,
    APP_VERSION,
    LOCAL_SNAPSHOT_KEY,
    SYSTEM_REPORT_KEY,
    FLOW_TEST_REPORT_KEY,
    MIGRATION_DRY_RUN_REPORT_KEY,
    UI_KEY,
    IDB_NAME,
    IDB_STORE_NAME,
    MONTH_NAMES_PT_BR,
    APP_DEFAULTS,
    APP_STORE_PREFERENCE_DEFAULTS: createAppStorePreferenceDefaults(release.APP_RUNTIME),
    DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA: release.APP_RUNTIME === 'development',
    DOM: createDomHelper(documentLike),
    ...release,
  });
}

export function exposeConfigInternals(globalLike = globalThis, config = createConfig(globalLike)) {
  globalLike.__APP_INTERNALS__ = Object.assign({}, globalLike.__APP_INTERNALS__, {
    config,
  });
  return globalLike.__APP_INTERNALS__;
}
