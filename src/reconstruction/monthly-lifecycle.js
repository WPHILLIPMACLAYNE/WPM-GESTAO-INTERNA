// Reconstructed Monthly Lifecycle from Reversa Task 10.
// Pure monthly close/reset/reopen workflow with archive rollback and read-only guards.

import { buildMonthArchivePayload } from './backup-import.js';
import { getPeriodLabel, getPreviousPeriodKey } from './domain-selectors.js';
import { normalizeData } from './lifecycle-normalization.js';
import {
  buildBootstrapPeriod,
  cloneSerializable,
  isValidPeriodKey,
  resetPeriodData,
} from './period-builder.js';
import { getDefaultStore, prepareStoreCandidate } from './schema-migrations.js';

export const LOCKED_CURRENT_PERIOD_ACTIONS = Object.freeze([
  'close-current-month',
  'reset-selected-month',
  'open-student-modal',
  'open-pending-modal',
  'add-person',
  'register-mention',
  'save-nps-observations',
  'open-scale-modal',
  'duplicate-previous-month-scale',
  'open-event-modal',
  'save-settings',
  'restore-local-snapshot',
  'reset-demo-data',
  'save-student',
  'save-pending',
  'save-scale-day',
  'save-event-item',
  'edit-student',
  'remove-student',
  'edit-pending',
  'remove-pending',
  'adjust-mention',
  'remove-mention',
  'edit-scale-day',
  'remove-scale-day',
  'edit-event-item',
  'duplicate-event-item',
  'remove-event-item',
]);

export const LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS = Object.freeze(['update-student-inline', 'update-addon', 'set-mention-count']);
export const LOCKED_CURRENT_PERIOD_INPUT_ACTIONS = Object.freeze(['update-nps-score', 'update-nps-goal']);
export const LOCKED_CURRENT_PERIOD_BLUR_ACTIONS = Object.freeze(['rename-person', 'rename-mention']);

export const LOCKED_CURRENT_PERIOD_CONTROL_IDS = Object.freeze([
  'monthDaysSelector',
  'importFile',
  'receptionistEditor',
  'professorEditor',
  'addonTypeEditor',
  'recadoFrom',
  'recadoTo',
  'recadoMessage',
  'student_nome',
  'student_matricula',
  'student_ultimaVisita',
  'student_horaVisita',
  'student_inicio',
  'student_avisoNps',
  'student_atendimento',
  'student_feedback',
  'student_addon',
  'student_observacoes',
  'pending_nome',
  'pending_matricula',
  'pending_hostess',
  'pending_data',
  'pending_status',
  'pending_desc',
  'pending_resposta',
  'npsMentionName',
  'npsMentionCount',
  'npsObservations',
  'scale_date',
  'scale_tone',
  'scale_receptionTime',
  'scale_receptionist',
  'scale_receptionSwap',
  'scale_note',
  'event_date',
  'event_time',
  'event_type',
  'event_status',
  'event_title',
  'event_place',
  'event_owner',
  'event_description',
  'settingsInitializeMonthsWithTestData',
]);

export function getNextPeriodKey(periodKey) {
  if (!isValidPeriodKey(periodKey)) return periodKey;
  const [year, month] = String(periodKey).split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1, 12));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function createArchiveEntry(periodKey, options = {}) {
  const closedAt = options.closedAt || new Date().toISOString();
  const closedDate = new Date(closedAt);
  return {
    closedAt,
    closedAtLabel: options.closedAtLabel || (Number.isNaN(closedDate.getTime()) ? closedAt : closedDate.toLocaleString('pt-BR')),
    label: options.label || getPeriodLabel(periodKey),
  };
}

export function periodHasMeaningfulData(period) {
  if (!period) return false;
  const data = cloneSerializable(period);
  normalizeData(data);
  return Boolean(
    data.recados.length
      || data.students.length
      || data.pending.length
      || data.scale.length
      || data.events.length
      || data.nps.score
      || data.nps.observations
      || data.nps.mentions.length
      || Object.values(data.addons || {}).some((group) => (
        Object.values(group || {}).some((days) => (
          (Array.isArray(days) ? days : []).some((value) => Number(value || 0) > 0)
        ))
      )),
  );
}

export function cloneScaleForPeriod(previousScale = [], targetPeriodKey, createId = null) {
  const [targetYear, targetMonth] = String(targetPeriodKey).split('-');
  const targetMonthDays = new Date(Number(targetYear), Number(targetMonth), 0).getDate();
  let skippedDays = 0;
  const makeId = typeof createId === 'function'
    ? createId
    : () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  const scale = (Array.isArray(previousScale) ? previousScale : []).reduce((list, item) => {
    const day = Number(String(item?.date || '').split('-')[2]);
    if (!Number.isInteger(day) || day < 1 || day > targetMonthDays) {
      skippedDays += 1;
      return list;
    }
    list.push({
      ...cloneSerializable(item),
      id: makeId(),
      date: `${targetPeriodKey}-${String(day).padStart(2, '0')}`,
      professorShifts: (item.professorShifts || []).map((shift) => ({ ...cloneSerializable(shift), id: makeId() })),
    });
    return list;
  }, []);

  scale.sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')));
  return { scale, skippedDays };
}

export function createMonthlyLifecycle(initialContext = {}) {
  let storage = prepareStoreCandidate(initialContext.storage, initialContext) || getDefaultStore(initialContext);
  let currentPeriodKey = initialContext.currentPeriodKey || storage.activePeriod;
  let state = storage.periods[currentPeriodKey] || Object.values(storage.periods || {})[0] || {};
  let backendState = initialContext.backendState || null;
  normalizeData(state);

  function getContext() {
    return { storage, currentPeriodKey, state, backendState };
  }

  function setContext(nextContext = {}) {
    storage = prepareStoreCandidate(nextContext.storage || storage, nextContext) || storage;
    currentPeriodKey = nextContext.currentPeriodKey || storage.activePeriod || currentPeriodKey;
    state = nextContext.state || storage.periods[currentPeriodKey] || state;
    backendState = nextContext.backendState === undefined ? backendState : nextContext.backendState;
    normalizeData(state);
    return getContext();
  }

  function isPeriodLocked(key = currentPeriodKey) {
    return Boolean(storage?.archives?.[String(key || '')]);
  }

  function isCurrentPeriodLocked() {
    return isPeriodLocked(currentPeriodKey);
  }

  function getCurrentPeriodLockMessage(key = currentPeriodKey) {
    return `${getPeriodLabel(key)} esta fechado. Acao bloqueada.`;
  }

  function isBackendReadOnlyMode() {
    return Boolean(
      backendState
        && backendState.source === 'supabase'
        && backendState.sessionStatus === 'authenticated'
        && backendState.writable === false,
    );
  }

  function getBackendReadonlyMessage() {
    const roleLabel = backendState?.activeUnit?.role || 'leitura';
    return `Sessao Supabase em modo somente leitura (${roleLabel}).`;
  }

  function canMutateCurrentPeriod(options = {}) {
    if (!isCurrentPeriodLocked() && !isBackendReadOnlyMode()) {
      return { ok: true, blocked: false, reason: null };
    }

    const reason = isBackendReadOnlyMode() ? 'backend-readonly' : 'period-locked';
    const message = options.message || (reason === 'backend-readonly' ? getBackendReadonlyMessage() : getCurrentPeriodLockMessage());
    return { ok: false, blocked: true, reason, message };
  }

  function assertWritableCurrentPeriod(options = {}) {
    return canMutateCurrentPeriod(options);
  }

  function buildCurrentPeriodLockUiState() {
    const locked = isCurrentPeriodLocked() || isBackendReadOnlyMode();
    const hint = isBackendReadOnlyMode()
      ? getBackendReadonlyMessage()
      : locked
        ? `${getPeriodLabel(currentPeriodKey)} fechado. Somente leitura.`
        : '';

    return {
      locked,
      hint,
      actions: [...LOCKED_CURRENT_PERIOD_ACTIONS],
      changeActions: [...LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS],
      inputActions: [...LOCKED_CURRENT_PERIOD_INPUT_ACTIONS],
      blurActions: [...LOCKED_CURRENT_PERIOD_BLUR_ACTIONS],
      controlIds: [...LOCKED_CURRENT_PERIOD_CONTROL_IDS],
    };
  }

  function ensurePeriod(key, template = state, options = {}) {
    const normalizedKey = String(key);
    storage.periods ||= {};
    if (!storage.periods[normalizedKey]) {
      storage.periods[normalizedKey] = buildBootstrapPeriod(template || state, normalizedKey, { ...options, storeRef: storage });
    }
    normalizeData(storage.periods[normalizedKey]);
    return storage.periods[normalizedKey];
  }

  async function persist(callback, options = {}) {
    storage.activePeriod = currentPeriodKey;
    storage.periods[currentPeriodKey] = state;
    if (typeof callback !== 'function') return true;
    return Boolean(await callback(storage, options));
  }

  async function switchPeriod(key, options = {}) {
    const normalizedKey = String(key);
    ensurePeriod(normalizedKey, options.template || state, options);
    currentPeriodKey = normalizedKey;
    storage.activePeriod = normalizedKey;
    state = storage.periods[normalizedKey];
    normalizeData(state);
    const saved = await persist(options.saveStore, { eventType: options.eventType || 'switch-period' });
    return { ok: saved, currentPeriodKey, state };
  }

  function changePeriodFromControls(month, year, options = {}) {
    const targetMonth = String(month || '1').padStart(2, '0');
    const targetYear = String(year || new Date().getFullYear());
    return switchPeriod(`${targetYear}-${targetMonth}`, options);
  }

  async function closePeriod(options = {}) {
    const writable = assertWritableCurrentPeriod({ message: `${getPeriodLabel(currentPeriodKey)} ja esta fechado.` });
    if (!writable.ok) return { ok: false, reason: writable.reason, message: writable.message };

    const closingKey = currentPeriodKey;
    const closingLabel = getPeriodLabel(closingKey);
    const committedStore = typeof options.getCommittedStoreSnapshot === 'function'
      ? await options.getCommittedStoreSnapshot({ persistCurrent: true, eventType: 'close-month-backup', broadcast: false })
      : storage;
    const archivePayload = buildMonthArchivePayload(committedStore, closingKey, closingLabel, options);
    if (typeof options.downloadMonthArchive === 'function') {
      await options.downloadMonthArchive(archivePayload, `smartfit-fechamento-${closingKey}.json`);
    }

    const previousArchive = storage.archives?.[closingKey] || null;
    storage.archives ||= {};
    storage.archives[closingKey] = createArchiveEntry(closingKey, {
      label: closingLabel,
      closedAt: options.closedAt,
      closedAtLabel: options.closedAtLabel,
    });

    const nextKey = getNextPeriodKey(closingKey);
    const existingNextPeriod = storage.periods?.[nextKey] || null;
    let nextPeriodStrategy = 'created';

    if (!existingNextPeriod) {
      storage.periods[nextKey] = buildBootstrapPeriod(state, nextKey, { ...options, storeRef: storage });
    } else if (periodHasMeaningfulData(existingNextPeriod)) {
      if (options.nextPeriodMode === 'reset') {
        resetPeriodData(storage, nextKey, state);
        nextPeriodStrategy = 'reset-existing';
      } else {
        ensurePeriod(nextKey, state, options);
        nextPeriodStrategy = 'preserved-existing';
      }
    } else {
      resetPeriodData(storage, nextKey, state);
      nextPeriodStrategy = 'reset-empty';
    }

    normalizeData(storage.periods[nextKey]);

    const saveCurrentKey = currentPeriodKey;
    const saveCurrentState = state;
    currentPeriodKey = closingKey;
    state = storage.periods[closingKey];
    const saved = await persist(options.saveStore, { eventType: options.eventType || 'close-month' });
    if (!saved) {
      if (previousArchive) storage.archives[closingKey] = previousArchive;
      else delete storage.archives[closingKey];
      currentPeriodKey = saveCurrentKey;
      state = saveCurrentState;
      return { ok: false, reason: 'save-failed', currentPeriodKey, archivePayload };
    }

    await switchPeriod(nextKey, { ...options, eventType: 'switch-after-close' });
    return {
      ok: true,
      closedPeriodKey: closingKey,
      nextPeriodKey: nextKey,
      nextPeriodStrategy,
      archivePayload,
      archive: storage.archives[closingKey],
      currentPeriodKey,
    };
  }

  async function reopenPeriod(key = currentPeriodKey, options = {}) {
    const targetKey = String(key || currentPeriodKey);
    if (!isPeriodLocked(targetKey)) {
      return { ok: false, reason: 'not-locked', message: `${getPeriodLabel(targetKey)} ja esta aberto.` };
    }
    if (options.authorized !== true) {
      return { ok: false, reason: 'authorization-required', message: 'Reabertura exige autorizacao explicita.' };
    }
    const reason = String(options.reason || '').trim();
    if (!reason) {
      return { ok: false, reason: 'reason-required', message: 'Informe o motivo da reabertura.' };
    }

    const previousArchive = storage.archives[targetKey];
    delete storage.archives[targetKey];
    storage.reopenAudit ||= [];
    const auditEntry = {
      periodKey: targetKey,
      reopenedAt: options.reopenedAt || new Date().toISOString(),
      reopenedBy: String(options.reopenedBy || 'operador'),
      reason,
      previousArchive: cloneSerializable(previousArchive),
    };
    storage.reopenAudit.push(auditEntry);

    if (options.activate !== false) {
      ensurePeriod(targetKey, state, options);
      currentPeriodKey = targetKey;
      storage.activePeriod = targetKey;
      state = storage.periods[targetKey];
    }

    const saved = await persist(options.saveStore, { eventType: options.eventType || 'reopen-month' });
    if (!saved) {
      storage.archives[targetKey] = previousArchive;
      storage.reopenAudit = storage.reopenAudit.filter((item) => item !== auditEntry);
      return { ok: false, reason: 'save-failed' };
    }

    return { ok: true, periodKey: targetKey, auditEntry, currentPeriodKey };
  }

  async function resetPeriod(options = {}) {
    const writable = assertWritableCurrentPeriod({ message: `${getPeriodLabel(currentPeriodKey)} esta fechado e nao pode ser resetado.` });
    if (!writable.ok) return { ok: false, reason: writable.reason, message: writable.message };

    if (typeof options.exportBackup === 'function') {
      await options.exportBackup();
    }

    resetPeriodData(storage, currentPeriodKey, state);
    state = storage.periods[currentPeriodKey];
    const saved = await persist(options.saveStore, { eventType: options.eventType || 'reset' });
    return { ok: saved, periodKey: currentPeriodKey, state };
  }

  async function duplicatePreviousMonthScale(options = {}) {
    const writable = assertWritableCurrentPeriod();
    if (!writable.ok) return { ok: false, reason: writable.reason, message: writable.message };

    const previousKey = getPreviousPeriodKey(currentPeriodKey);
    const previous = storage.periods?.[previousKey];
    if (!previous || !Array.isArray(previous.scale) || !previous.scale.length) {
      return { ok: false, reason: 'missing-previous-scale', previousKey };
    }
    if (state.scale?.length && options.replaceExisting !== true) {
      return { ok: false, reason: 'replace-confirmation-required', previousKey };
    }

    const { scale, skippedDays } = cloneScaleForPeriod(previous.scale, currentPeriodKey, options.createId);
    state.scale = scale;
    const saved = await persist(options.saveStore, { eventType: options.eventType || 'duplicate-scale' });
    return { ok: saved, previousKey, periodKey: currentPeriodKey, skippedDays, copied: scale.length };
  }

  async function syncAppState(storeLike = null, options = {}) {
    storage = prepareStoreCandidate(storeLike || storage, options) || getDefaultStore(options);
    currentPeriodKey = storage.activePeriod;
    state = storage.periods[currentPeriodKey];
    normalizeData(state);
    return state;
  }

  return {
    getContext,
    setContext,
    isPeriodLocked,
    isCurrentPeriodLocked,
    getCurrentPeriodLockMessage,
    isBackendReadOnlyMode,
    getBackendReadonlyMessage,
    canMutateCurrentPeriod,
    assertWritableCurrentPeriod,
    buildCurrentPeriodLockUiState,
    periodHasMeaningfulData,
    ensurePeriod,
    switchPeriod,
    changePeriodFromControls,
    closePeriod,
    closeCurrentMonth: closePeriod,
    reopenPeriod,
    resetPeriod,
    resetSelectedMonth: resetPeriod,
    duplicatePreviousMonthScale,
    syncAppState,
  };
}
