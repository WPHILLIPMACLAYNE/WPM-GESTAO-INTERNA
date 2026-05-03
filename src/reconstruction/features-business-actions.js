// Reconstructed Features / Business Actions from Reversa Task 13.
// Executable contract for validation, transactional CRUD, NPS actions, CSV,
// smoke diagnostics, migration dry-run and assisted Supabase migration.

import { getBackupSummary, buildBackupPayloadFromStore } from './backup-import.js';
import {
  cloneSerializable,
  buildCleanPeriodFromTemplate,
} from './period-builder.js';
import { normalizeData } from './lifecycle-normalization.js';
import { getDefaultStore, prepareStoreCandidate } from './schema-migrations.js';
import {
  compareByDateTime,
  getPeriodLabel,
  normalizeSearchText,
} from './domain-selectors.js';

export const CSV_BOM = '\uFEFF';
export const FLOW_TEST_REPORT_KEY = 'wpm_flow_smoke_report_v1';
export const MIGRATION_DRY_RUN_REPORT_KEY = 'wpm_migration_dry_run_report_v1';

export function isNonEmptyString(value) {
  return String(value ?? '').trim().length > 0;
}

export function isValidNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized);
}

export function isPositiveNumber(value) {
  return isValidNumber(value) && Number(value) > 0;
}

export function isValidDateValue(value) {
  if (!isNonEmptyString(value)) return false;
  return Number.isFinite(new Date(`${String(value).trim()}T00:00:00`).getTime());
}

export function normalizeNumericId(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function createValidationResult() {
  return { isValid: true, errors: {} };
}

export function isDateInPeriod(value, periodKey) {
  if (!isValidDateValue(value)) return false;
  return String(value).startsWith(`${String(periodKey || '').slice(0, 7)}-`);
}

export function validateStudent(data = {}) {
  const result = createValidationResult();
  if (isNonEmptyString(data.rawMatricula) && data.matricula !== data.rawMatricula) {
    result.isValid = false;
    result.errors.matricula = 'O numero da matricula deve conter apenas digitos.';
  }
  if (!isNonEmptyString(data.nome)) {
    result.isValid = false;
    result.errors.nome = 'Preencha ao menos o nome do aluno.';
  }
  return result;
}

export function validatePending(data = {}, options = {}) {
  const result = createValidationResult();
  if (isNonEmptyString(data.rawMatricula) && data.matricula !== data.rawMatricula) {
    result.isValid = false;
    result.errors.matricula = 'O numero da matricula deve conter apenas digitos.';
  }
  if (!isNonEmptyString(data.nome) || !isNonEmptyString(data.pendencia)) {
    result.isValid = false;
    result.errors.required = 'Preencha ao menos nome e pendencia.';
  }
  if (isNonEmptyString(data.data) && isValidDateValue(data.data) && !isDateInPeriod(data.data, options.currentPeriodKey)) {
    result.isValid = false;
    result.errors.data = `A data da pendencia deve pertencer a ${getPeriodLabel(options.currentPeriodKey)}.`;
  }
  return result;
}

export function validateEvent(data = {}, options = {}) {
  const result = createValidationResult();
  if (!isNonEmptyString(data.date) || !isNonEmptyString(data.title)) {
    result.isValid = false;
    result.errors.required = 'Preencha ao menos data e titulo.';
  }
  if (isNonEmptyString(data.date) && !isDateInPeriod(data.date, options.currentPeriodKey)) {
    result.isValid = false;
    result.errors.date = `A data do evento/acao deve pertencer a ${getPeriodLabel(options.currentPeriodKey)}.`;
  }
  return result;
}

export function buildStudentEntity(formData = {}, existingStudent = null) {
  return {
    id: existingStudent?.id || formData.id,
    nome: String(formData.nome || '').trim(),
    matricula: String(formData.matricula || ''),
    ultimaVisita: String(formData.ultimaVisita || ''),
    horaVisita: String(formData.horaVisita || ''),
    inicio: String(formData.inicio || ''),
    avisoNps: String(formData.avisoNps || 'Pendente'),
    atendimento: String(formData.atendimento || ''),
    feedback: String(formData.feedback || 'Pendente'),
    addon: String(formData.addon || ''),
    observacoes: String(formData.observacoes || ''),
  };
}

export function buildPendingEntity(formData = {}, existingPending = null) {
  return {
    id: existingPending?.id || formData.id,
    nome: String(formData.nome || '').trim(),
    matricula: String(formData.matricula || ''),
    pendencia: String(formData.pendencia || '').trim(),
    data: String(formData.data || ''),
    hostess: String(formData.hostess || ''),
    resposta: String(formData.resposta || ''),
    status: String(formData.status || 'aberto'),
  };
}

export function buildEventEntity(formData = {}, existingEvent = null) {
  return {
    id: existingEvent?.id || formData.id,
    date: String(formData.date || ''),
    time: String(formData.time || ''),
    type: String(formData.type || 'Evento'),
    title: String(formData.title || '').trim(),
    place: String(formData.place || ''),
    owner: String(formData.owner || ''),
    status: String(formData.status || 'Programado'),
    description: String(formData.description || ''),
  };
}

export function upsertById(items = [], entity) {
  const list = Array.isArray(items) ? items : [];
  const index = list.findIndex((item) => item.id === entity.id);
  if (index >= 0) return list.map((item, itemIndex) => (itemIndex === index ? entity : item));
  return [entity, ...list];
}

export function applyStudentSave(store, formData, existingStudent = null) {
  const validation = validateStudent(formData);
  if (!validation.isValid) return { ok: false, validation };
  const entity = buildStudentEntity(formData, existingStudent);
  const nextState = { ...store, students: upsertById(store.students, entity) };
  normalizeData(nextState);
  return { ok: true, nextState, entity };
}

export function applyPendingSave(store, formData, existingPending = null, options = {}) {
  const validation = validatePending(formData, options);
  if (!validation.isValid) return { ok: false, validation };
  const entity = buildPendingEntity(formData, existingPending);
  const nextState = { ...store, pending: upsertById(store.pending, entity) };
  normalizeData(nextState);
  return { ok: true, nextState, entity };
}

export function applyEventSave(store, formData, existingEvent = null, options = {}) {
  const validation = validateEvent(formData, options);
  if (!validation.isValid) return { ok: false, validation };
  const entity = buildEventEntity(formData, existingEvent);
  const events = upsertById(store.events, entity).slice().sort(compareByDateTime);
  const nextState = { ...store, events };
  normalizeData(nextState);
  return { ok: true, nextState, entity };
}

export function getStudentAddonLink(student, period, options = {}) {
  if (!student || !student.addon || !student.atendimento || !period) return null;
  const fallbackDate = options.fallbackDate || `${options.currentPeriodKey || ''}-01`;
  const rawDate = student.inicio || student.ultimaVisita || fallbackDate;
  const day = Number(String(rawDate).split('-')[2] || 0);
  if (!day) return null;
  const monthDays = Number(period.settings?.monthDays || 31);
  const index = Math.min(monthDays, Math.max(1, day)) - 1;
  if (!period.addons?.[student.atendimento]?.[student.addon]) return null;
  return { person: student.atendimento, type: student.addon, index };
}

export function applyStudentAddonLink(period, student, delta, options = {}) {
  const link = getStudentAddonLink(student, period, options);
  if (!link) return null;
  const values = period.addons[link.person][link.type];
  values[link.index] = Math.max(0, Number(values[link.index] || 0) + Number(delta || 0));
  return { ...link, value: values[link.index] };
}

export function hasDuplicateEvent(entity, collection = []) {
  return (Array.isArray(collection) ? collection : []).some((entry) => (
    entry.id !== entity.id
    && String(entry.date || '') === String(entity.date || '')
    && String(entry.time || '') === String(entity.time || '')
    && normalizeSearchText(entry.title) === normalizeSearchText(entity.title)
  ));
}

export function csvEscape(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsvContent(rows = [], options = {}) {
  const csv = (Array.isArray(rows) ? rows : []).map((row) => row.map(csvEscape).join(';')).join('\n');
  return options.bom === false ? csv : `${CSV_BOM}${csv}`;
}

export function getPendingCsvRows(period = {}) {
  const list = (period.pending || []).slice().sort((left, right) => (
    `${left?.data || ''}T00:00`.localeCompare(`${right?.data || ''}T00:00`)
  ));
  return [
    ['Nome', 'Matricula', 'Pendencia', 'Solicitacao', 'Hostess', 'Resposta', 'Status'],
    ...list.map((item) => [
      item.nome || '',
      item.matricula || '',
      item.pendencia || '',
      item.data || '',
      item.hostess || '',
      item.resposta || '',
      item.status || '',
    ]),
  ];
}

export function getScaleCsvRows(period = {}) {
  const rows = [['Data', 'Professor', 'Horario professor', 'Troca professor', 'Recepcao', 'Horario recepcao', 'Troca recepcao', 'Tom da linha', 'Observacao']];
  (period.scale || []).slice().sort(compareByDateTime).forEach((item) => {
    const shifts = item.professorShifts?.length ? item.professorShifts : [{ time: '', name: '', swap: '' }];
    shifts.forEach((shift) => {
      rows.push([
        item.date || '',
        shift.name || '',
        shift.time || '',
        shift.swap || '',
        item.receptionist || '',
        item.receptionTime || '',
        item.receptionSwap || '',
        item.rowTone || '',
        item.note || '',
      ]);
    });
  });
  return rows;
}

export function getEventsCsvRows(period = {}) {
  const list = (period.events || []).slice().sort(compareByDateTime);
  return [
    ['Data', 'Hora', 'Tipo', 'Titulo', 'Local', 'Responsavel', 'Status', 'Descricao'],
    ...list.map((item) => [
      item.date || '',
      item.time || '',
      item.type || '',
      item.title || '',
      item.place || '',
      item.owner || '',
      item.status || '',
      item.description || '',
    ]),
  ];
}

export function getMigrationEntityCounts(period) {
  const normalized = cloneSerializable(period || {});
  normalizeData(normalized);
  const addonRows = Object.values(normalized.addons || {}).reduce((acc, byType) => (
    acc + Object.values(byType || {}).reduce((sum, days) => (
      sum + (Array.isArray(days) ? days.filter((value) => Number(value || 0) > 0).length : 0)
    ), 0)
  ), 0);
  const addonVolume = Object.values(normalized.addons || {}).reduce((acc, byType) => (
    acc + Object.values(byType || {}).reduce((sum, days) => (
      sum + (Array.isArray(days) ? days.reduce((dayAcc, value) => dayAcc + Math.max(0, Number(value || 0)), 0) : 0)
    ), 0)
  ), 0);
  const professorShiftRows = (normalized.scale || []).reduce((acc, item) => (
    acc + (Array.isArray(item?.professorShifts) ? item.professorShifts.length : 0)
  ), 0);
  return {
    recados: (normalized.recados || []).length,
    students: (normalized.students || []).length,
    pending: (normalized.pending || []).length,
    events: (normalized.events || []).length,
    scaleDays: (normalized.scale || []).length,
    professorShiftRows,
    npsMentions: (normalized.nps?.mentions || []).length,
    addonRows,
    addonVolume,
  };
}

export function buildMigrationStoreSnapshot(storeRef) {
  const candidate = prepareStoreCandidate(cloneSerializable(storeRef), {
    defaults: { initializeMonthsWithTestData: false },
  }) || getDefaultStore({ defaults: { initializeMonthsWithTestData: false } });
  const periods = Object.entries(candidate.periods || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce((acc, [periodKey, period]) => {
      acc[periodKey] = getMigrationEntityCounts(period);
      return acc;
    }, {});
  const totals = Object.values(periods).reduce((acc, item) => {
    Object.keys(item).forEach((key) => {
      acc[key] = Number(acc[key] || 0) + Number(item[key] || 0);
    });
    return acc;
  }, {
    recados: 0,
    students: 0,
    pending: 0,
    events: 0,
    scaleDays: 0,
    professorShiftRows: 0,
    npsMentions: 0,
    addonRows: 0,
    addonVolume: 0,
  });
  return {
    periodCount: Object.keys(periods).length,
    archiveCount: Object.keys(candidate.archives || {}).length,
    totals,
    periods,
  };
}

export function compareMigrationSnapshots(left, right) {
  const leftPeriods = left && typeof left === 'object' ? left : {};
  const rightPeriods = right && typeof right === 'object' ? right : {};
  const periodKeys = [...new Set([...Object.keys(leftPeriods), ...Object.keys(rightPeriods)])].sort();
  const mismatches = [];
  periodKeys.forEach((periodKey) => {
    const leftCounts = leftPeriods[periodKey] || null;
    const rightCounts = rightPeriods[periodKey] || null;
    const entityKeys = [...new Set([...Object.keys(leftCounts || {}), ...Object.keys(rightCounts || {})])];
    entityKeys.forEach((entityKey) => {
      const local = Number(leftCounts?.[entityKey] || 0);
      const remote = Number(rightCounts?.[entityKey] || 0);
      if (local !== remote) mismatches.push({ periodKey, entityKey, local, remote });
    });
  });
  return { matches: mismatches.length === 0, mismatches };
}

export function getMigrationRemoteState(report) {
  const backend = report?.backend || {};
  if (backend.remoteError) return 'error';
  if (report?.remote) return 'present';
  if (backend.enabled && backend.sessionStatus === 'authenticated') return 'empty';
  return 'unavailable';
}

export function getMigrationReadiness(report) {
  if (!report || typeof report !== 'object') {
    return {
      status: 'pending',
      tone: 'info',
      canMigrate: false,
      reason: 'dry-run-missing',
      label: 'Dry-run pendente',
      detail: 'Execute o dry-run para validar a base local antes de liberar a migracao.',
    };
  }
  const backend = report.backend || {};
  if (!backend.enabled || backend.sessionStatus !== 'authenticated') {
    return {
      status: 'blocked',
      tone: 'info',
      canMigrate: false,
      reason: 'backend-auth-required',
      label: 'Login necessario',
      detail: 'Faca login no backend com a unidade correta antes de migrar.',
    };
  }
  if (backend.writable !== true) {
    return {
      status: 'blocked',
      tone: 'warn',
      canMigrate: false,
      reason: 'backend-readonly',
      label: 'Perfil sem escrita',
      detail: 'A sessao atual nao tem permissao de escrita para concluir a migracao.',
    };
  }
  if (backend.remoteError) {
    return {
      status: 'blocked',
      tone: 'warn',
      canMigrate: false,
      reason: 'remote-compare-failed',
      label: 'Comparacao remota falhou',
      detail: 'Corrija a leitura da base remota antes de migrar para evitar sobrescrita cega.',
    };
  }
  const remoteState = getMigrationRemoteState(report);
  if (remoteState === 'empty') {
    return {
      status: 'ready',
      tone: 'ok',
      canMigrate: true,
      reason: null,
      label: 'Primeira migracao liberada',
      detail: 'O backend da unidade ainda esta vazio.',
    };
  }
  if (remoteState !== 'present') {
    return {
      status: 'blocked',
      tone: 'warn',
      canMigrate: false,
      reason: 'remote-compare-missing',
      label: 'Comparacao remota ausente',
      detail: 'A migracao assistida so e liberada depois de comparar a base local com a unidade remota.',
    };
  }
  const mismatchCount = Number(report.comparison?.mismatches?.length || 0);
  if (mismatchCount > 0) {
    return {
      status: 'blocked',
      tone: 'warn',
      canMigrate: false,
      reason: 'remote-mismatch',
      label: 'Divergencias detectadas',
      detail: `${mismatchCount} divergencia(s) entre local e remoto precisam ser revisadas antes da migracao.`,
    };
  }
  return {
    status: 'ready',
    tone: 'ok',
    canMigrate: true,
    reason: null,
    label: 'Pronto para migrar',
    detail: 'Dry-run local e comparacao remota consistentes.',
  };
}

function getValidationErrors(validation, kind) {
  const errors = [];
  if (kind === 'student') {
    if (validation.errors.nome) errors.push({ id: 'student_nome', message: validation.errors.nome });
    if (validation.errors.matricula) errors.push({ id: 'student_matricula', message: validation.errors.matricula });
  }
  if (kind === 'pending') {
    if (validation.errors.required) {
      errors.push({ id: 'pending_nome', message: validation.errors.required });
      errors.push({ id: 'pending_desc', message: validation.errors.required });
    }
    if (validation.errors.matricula) errors.push({ id: 'pending_matricula', message: validation.errors.matricula });
    if (validation.errors.data) errors.push({ id: 'pending_data', message: validation.errors.data });
  }
  if (kind === 'event') {
    if (validation.errors.date) errors.push({ id: 'event_date', message: validation.errors.date });
    if (validation.errors.required) errors.push({ id: 'event_title', message: validation.errors.required });
  }
  return errors;
}

export function createBusinessActionsRuntime(options = {}) {
  let currentPeriodKey = options.currentPeriodKey || options.storage?.activePeriod || '2026-01';
  let state = cloneSerializable(options.state || options.storage?.periods?.[currentPeriodKey] || {});
  normalizeData(state);
  let storage = cloneSerializable(options.storage || {
    version: 4,
    activePeriod: currentPeriodKey,
    preferences: { initializeMonthsWithTestData: false },
    periods: { [currentPeriodKey]: state },
    archives: {},
  });
  storage.activePeriod = currentPeriodKey;
  storage.periods ||= {};
  storage.periods[currentPeriodKey] = state;
  let migrationDryRunReport = null;
  let flowSmokeReport = [];

  function getState() {
    return state;
  }

  function getStorage() {
    return storage;
  }

  function setState(nextState) {
    state = cloneSerializable(nextState);
    normalizeData(state);
    storage.activePeriod = currentPeriodKey;
    storage.periods[currentPeriodKey] = state;
  }

  function assertWritable(args = {}) {
    if (typeof options.assertWritableCurrentPeriod === 'function') {
      return options.assertWritableCurrentPeriod(args) !== false;
    }
    if (storage.archives?.[currentPeriodKey]) return false;
    if (options.backendState?.writable === false && options.backendState?.source === 'supabase') return false;
    return true;
  }

  function requestRender(targets) {
    if (typeof options.requestRender === 'function') options.requestRender(targets);
  }

  function showToast(message, type = 'info') {
    if (typeof options.showToast === 'function') options.showToast(message, type);
  }

  function showConfirm(message, onConfirm) {
    if (typeof options.showConfirm === 'function') return options.showConfirm(message, onConfirm);
    onConfirm();
    return true;
  }

  function presentValidation(errors = []) {
    if (typeof options.presentValidation === 'function') options.presentValidation(errors);
    else if (errors[0]) showToast(errors[0].message, 'warning');
  }

  async function saveData(args = {}) {
    if (typeof options.saveData === 'function') return options.saveData(args);
    return true;
  }

  function createCrudHandler(config) {
    return async function handleSave() {
      if (!assertWritable({ rerender: config.renderTargets })) return { ok: false, skipped: true, reason: 'readonly' };
      const collection = state[config.collectionKey] || [];
      const previousState = cloneSerializable(state);
      const previousStorage = cloneSerializable(storage);
      const formData = config.getFormData();
      const existing = collection.find((item) => item.id === formData.id) || null;
      const previousEntity = existing ? cloneSerializable(existing) : null;
      const result = config.applySave(state, formData, existing, { currentPeriodKey });
      if (!result.ok) {
        presentValidation(config.getValidationErrors(result.validation));
        return { ok: false, validation: result.validation };
      }

      const commitSave = async () => {
        setState(result.nextState);
        if (typeof config.onBeforeSave === 'function') {
          config.onBeforeSave(result.entity, previousEntity, state);
        }
        const saved = await saveData({ eventType: config.eventType || 'save' });
        if (!saved) {
          state = previousState;
          storage = previousStorage;
          if (typeof options.clearSelectorCache === 'function') options.clearSelectorCache();
          requestRender(config.renderTargets);
          if (typeof config.onAfterSave === 'function') config.onAfterSave(result.entity, previousEntity, state, 'rollback');
          showToast(`Falha ao salvar ${config.name}. Tente novamente.`, 'danger');
          return { ok: false, rolledBack: true, reason: 'save-failed' };
        }
        storage.activePeriod = currentPeriodKey;
        storage.periods[currentPeriodKey] = state;
        if (typeof config.onAfterSave === 'function') config.onAfterSave(result.entity, previousEntity, state, 'saved');
        if (typeof config.finalizeUI === 'function') config.finalizeUI(result.entity);
        if (typeof config.renderUI === 'function') config.renderUI(result.entity);
        requestRender(config.renderTargets);
        return { ok: true, entity: result.entity };
      };

      const duplicateMessage = typeof config.duplicateCheck === 'function'
        ? config.duplicateCheck(result.entity, collection)
        : null;
      if (duplicateMessage) {
        let confirmedResult = { ok: false, skipped: true, reason: 'confirmation-required' };
        showConfirm(duplicateMessage, () => {
          confirmedResult = commitSave();
        });
        return confirmedResult && typeof confirmedResult.then === 'function'
          ? confirmedResult
          : confirmedResult;
      }
      return commitSave();
    };
  }

  const saveStudent = createCrudHandler({
    name: 'atendimento',
    collectionKey: 'students',
    getFormData: options.getStudentFormData || (() => ({})),
    applySave: applyStudentSave,
    getValidationErrors: (validation) => getValidationErrors(validation, 'student'),
    onBeforeSave: (entity, previous, stateRef) => {
      if (previous) applyStudentAddonLink(stateRef, previous, -1, { currentPeriodKey });
      applyStudentAddonLink(stateRef, entity, 1, { currentPeriodKey });
    },
    renderTargets: ['hero', 'dashboard', 'students', 'addons'],
  });

  const savePending = createCrudHandler({
    name: 'pendencia',
    collectionKey: 'pending',
    getFormData: options.getPendingFormData || (() => ({})),
    applySave: applyPendingSave,
    getValidationErrors: (validation) => getValidationErrors(validation, 'pending'),
    renderTargets: ['hero', 'dashboard', 'pending'],
  });

  const saveEventItem = createCrudHandler({
    name: 'evento',
    collectionKey: 'events',
    getFormData: options.getEventFormData || (() => ({})),
    applySave: applyEventSave,
    getValidationErrors: (validation) => getValidationErrors(validation, 'event'),
    duplicateCheck: (entity, collection) => (
      hasDuplicateEvent(entity, collection)
        ? 'Ja existe um evento com o mesmo titulo, data e horario. Deseja salvar mesmo assim?'
        : null
    ),
    renderTargets: ['dashboard', 'events'],
  });

  async function persistNps(targets = ['hero', 'dashboard', 'nps']) {
    normalizeData(state);
    storage.periods[currentPeriodKey] = state;
    const saved = await saveData({ eventType: 'nps' });
    requestRender(targets);
    return saved;
  }

  function captureNpsRankSnapshot() {
    if (typeof options.captureNpsRankSnapshot === 'function') {
      options.captureNpsRankSnapshot(state);
      return;
    }
    state.nps ||= {};
    state.nps.rankSnapshot = Object.fromEntries(
      (state.nps.mentions || [])
        .slice()
        .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
        .map((item, index) => [item.id, index + 1]),
    );
  }

  async function registerMention(draft = null) {
    if (!assertWritable()) return { ok: false, skipped: true, reason: 'readonly' };
    const mention = draft || (typeof options.getMentionDraft === 'function' ? options.getMentionDraft() : {});
    const name = String(mention.name || '').trim();
    const count = Math.max(1, Number(mention.count || 1));
    if (!name) {
      showToast('Informe o nome do funcionario citado.', 'warning');
      return { ok: false, reason: 'name-required' };
    }
    captureNpsRankSnapshot();
    const existing = state.nps.mentions.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.count = Number(existing.count || 0) + count;
    else state.nps.mentions.push({ id: options.createId?.('mention') || `mention-${Date.now()}`, name, count });
    await persistNps();
    return { ok: true };
  }

  async function adjustMention(id, delta) {
    if (!assertWritable()) return { ok: false, skipped: true, reason: 'readonly' };
    const item = state.nps.mentions.find((mention) => mention.id === id);
    if (!item) return { ok: false, skipped: true, reason: 'missing' };
    captureNpsRankSnapshot();
    item.count = Math.max(0, Number(item.count || 0) + Number(delta || 0));
    await persistNps();
    return { ok: true, count: item.count };
  }

  async function setMentionCount(id, value) {
    if (!assertWritable({ rerender: ['hero', 'dashboard', 'nps'] })) return { ok: false, skipped: true, reason: 'readonly' };
    const item = state.nps.mentions.find((mention) => mention.id === id);
    if (!item) return { ok: false, skipped: true, reason: 'missing' };
    captureNpsRankSnapshot();
    item.count = Math.max(0, Number(value || 0));
    await persistNps();
    return { ok: true, count: item.count };
  }

  async function renameMention(id, nextNameRaw) {
    if (!assertWritable({ rerender: ['hero', 'dashboard', 'nps'] })) return { ok: false, skipped: true, reason: 'readonly' };
    const item = state.nps.mentions.find((mention) => mention.id === id);
    if (!item) return { ok: false, skipped: true, reason: 'missing' };
    const nextName = String(nextNameRaw || '').trim();
    if (!nextName || nextName === item.name) {
      requestRender('nps');
      return { ok: false, skipped: true, reason: 'unchanged' };
    }
    captureNpsRankSnapshot();
    item.name = nextName;
    await persistNps();
    return { ok: true, name: item.name };
  }

  async function removeMention(id) {
    if (!assertWritable()) return { ok: false, skipped: true, reason: 'readonly' };
    let result = { ok: false, skipped: true, reason: 'confirmation-required' };
    showConfirm('Deseja remover este nome do ranking de NPS?', async () => {
      captureNpsRankSnapshot();
      state.nps.mentions = state.nps.mentions.filter((item) => item.id !== id);
      await persistNps();
      result = { ok: true };
    });
    return result;
  }

  async function saveNpsObservations(text = null) {
    if (!assertWritable({ rerender: ['nps'] })) return { ok: false, skipped: true, reason: 'readonly' };
    state.nps.observations = text == null && typeof options.getNpsObservationsDraft === 'function'
      ? options.getNpsObservationsDraft()
      : String(text || '');
    const saved = await persistNps(['nps']);
    if (saved) showToast('Observacoes de NPS salvas.', 'success');
    return { ok: Boolean(saved) };
  }

  function exportPendingCsv() {
    return buildCsvContent(getPendingCsvRows(state));
  }

  function exportScaleCsv() {
    return buildCsvContent(getScaleCsvRows(state));
  }

  function exportEventsCsv() {
    return buildCsvContent(getEventsCsvRows(state));
  }

  function runFlowSmokeTests(silent = false) {
    const clonedStore = prepareStoreCandidate(cloneSerializable(storage), {
      defaults: { initializeMonthsWithTestData: false },
    }) || getDefaultStore({ defaults: { initializeMonthsWithTestData: false } });
    const originalSummary = getBackupSummary(clonedStore);
    const roundTripStore = prepareStoreCandidate(JSON.parse(JSON.stringify(clonedStore)), {
      defaults: { initializeMonthsWithTestData: false },
    });
    const roundTripSummary = getBackupSummary(roundTripStore);
    const activePeriod = clonedStore.periods[clonedStore.activePeriod];
    const pendingCsv = buildCsvContent(getPendingCsvRows(activePeriod), { bom: false });
    const scaleCsv = buildCsvContent(getScaleCsvRows(activePeriod), { bom: false });
    const eventsCsv = buildCsvContent(getEventsCsvRows(activePeriod), { bom: false });
    const resetClone = prepareStoreCandidate(cloneSerializable(storage), {
      defaults: { initializeMonthsWithTestData: false },
    });
    resetClone.periods[resetClone.activePeriod] = buildCleanPeriodFromTemplate(resetClone.periods[resetClone.activePeriod], resetClone.activePeriod);
    const resetMetrics = getMigrationEntityCounts(resetClone.periods[resetClone.activePeriod]);
    flowSmokeReport = [
      {
        label: 'Round-trip de backup JSON',
        status: JSON.stringify(originalSummary) === JSON.stringify(roundTripSummary) ? 'ok' : 'bad',
        detail: `${originalSummary.periods} periodos comparados antes e depois da serializacao.`,
      },
      {
        label: 'Exportacao CSV de pendencias',
        status: pendingCsv.split('\n').length > 1 ? 'ok' : 'bad',
        detail: `${Math.max(0, pendingCsv.split('\n').length - 1)} linha(s) de dados prontas.`,
      },
      {
        label: 'Exportacao CSV de escala',
        status: scaleCsv.split('\n').length > 1 ? 'ok' : 'bad',
        detail: `${Math.max(0, scaleCsv.split('\n').length - 1)} linha(s) de escala preparadas.`,
      },
      {
        label: 'Exportacao CSV de eventos',
        status: eventsCsv.split('\n').length > 1 ? 'ok' : 'bad',
        detail: `${Math.max(0, eventsCsv.split('\n').length - 1)} linha(s) de agenda preparadas.`,
      },
      {
        label: 'Reset do mes em simulacao',
        status: resetMetrics.recados === 0 && resetMetrics.students === 0 && resetMetrics.pending === 0 && resetMetrics.events === 0 && resetMetrics.scaleDays === 0 && resetMetrics.npsMentions === 0 && resetMetrics.addonVolume === 0 ? 'ok' : 'bad',
        detail: `${resetMetrics.students} alunos, ${resetMetrics.pending} pendencias e ${resetMetrics.addonVolume} addons apos reset simulado.`,
      },
      {
        label: 'Cobertura anual minima',
        status: Object.keys(clonedStore.periods || {}).length >= 12 ? 'ok' : 'warn',
        detail: `${Object.keys(clonedStore.periods || {}).length} periodos disponiveis.`,
      },
    ];
    if (typeof options.saveFlowSmokeReport === 'function') options.saveFlowSmokeReport(flowSmokeReport);
    requestRender('settings');
    if (!silent) {
      const failures = flowSmokeReport.filter((item) => item.status === 'bad').length;
      const warnings = flowSmokeReport.filter((item) => item.status === 'warn').length;
      showToast(`Autotestes concluidos: ${flowSmokeReport.length - failures - warnings} ok, ${warnings} alerta(s), ${failures} falha(s).`, failures ? 'danger' : warnings ? 'warning' : 'success');
    }
    return flowSmokeReport;
  }

  async function runMigrationDryRun(silent = false) {
    const localStore = typeof options.buildMigrationCandidateStore === 'function'
      ? await options.buildMigrationCandidateStore({ cleanup: false, eventType: 'migration-dry-run' })
      : cloneSerializable(storage);
    const localSnapshot = buildMigrationStoreSnapshot(localStore);
    const backendStatus = typeof options.getSupabaseStatus === 'function'
      ? options.getSupabaseStatus()
      : { enabled: false, sessionStatus: 'offline' };
    const backendState = typeof options.getSupabaseBackendState === 'function'
      ? options.getSupabaseBackendState()
      : { sessionStatus: backendStatus.sessionStatus, source: 'local', writable: false };
    let remoteSnapshot = null;
    let comparison = null;
    let remoteError = null;
    let remoteState = 'unavailable';
    if (backendStatus.enabled && backendState.sessionStatus === 'authenticated' && typeof options.loadStoreFromSupabase === 'function') {
      remoteState = 'empty';
      try {
        const remoteStore = await options.loadStoreFromSupabase(localStore);
        if (remoteStore) {
          remoteSnapshot = buildMigrationStoreSnapshot(remoteStore);
          comparison = compareMigrationSnapshots(localSnapshot.periods, remoteSnapshot.periods);
          remoteState = 'present';
        }
      } catch (error) {
        remoteError = error?.message || 'Falha ao carregar a base remota para comparacao.';
        remoteState = 'error';
      }
    }
    migrationDryRunReport = {
      generatedAt: options.now?.() || new Date().toISOString(),
      local: localSnapshot,
      remote: remoteSnapshot,
      comparison,
      legacyRecados: options.legacyRecados || { periods: 0, total: 0, items: [] },
      backend: {
        enabled: Boolean(backendStatus.enabled),
        sessionStatus: backendState.sessionStatus || backendStatus.sessionStatus || 'offline',
        source: backendState.source || 'local',
        writable: backendState.writable === true,
        remoteState,
        remoteError,
      },
    };
    if (typeof options.saveMigrationDryRunReport === 'function') await options.saveMigrationDryRunReport(migrationDryRunReport);
    requestRender('settings');
    if (!silent) {
      const mismatchCount = Number(migrationDryRunReport.comparison?.mismatches?.length || 0);
      showToast(`Dry-run de migracao concluido: ${migrationDryRunReport.local.periodCount} periodo(s) locais, ${mismatchCount} divergencia(s).`, migrationDryRunReport.backend.remoteError || mismatchCount ? 'warning' : 'success');
    }
    return migrationDryRunReport;
  }

  function loadMigrationDryRunReport() {
    return migrationDryRunReport;
  }

  async function runAssistedMigrationToSupabase() {
    const backendState = typeof options.getSupabaseBackendState === 'function'
      ? options.getSupabaseBackendState()
      : null;
    if (!backendState?.writable || backendState?.sessionStatus !== 'authenticated') {
      return { ok: false, skipped: true, reason: 'backend-unavailable' };
    }
    const preflightReport = await runMigrationDryRun(true);
    const readiness = getMigrationReadiness(preflightReport);
    if (!readiness.canMigrate) {
      return { ok: false, skipped: true, reason: readiness.reason || 'migration-not-ready', report: preflightReport };
    }
    const migrationStore = typeof options.buildMigrationCandidateStore === 'function'
      ? await options.buildMigrationCandidateStore({ cleanup: true, eventType: 'migration-prepare' })
      : cloneSerializable(storage);
    if (typeof options.saveStore === 'function') {
      const prepared = await options.saveStore(migrationStore, {
        silent: true,
        broadcast: false,
        eventType: 'migration-prepare',
        skipRemoteSync: true,
      });
      if (!prepared) return { ok: false, skipped: true, reason: 'store-prepare-failed' };
    }
    const payload = buildBackupPayloadFromStore(migrationStore);
    if (typeof options.saveLocalSnapshot === 'function') await options.saveLocalSnapshot(payload);
    if (typeof options.queueSupabaseStoreSync !== 'function') return { ok: false, skipped: true, reason: 'sync-function-missing' };
    const syncResult = await options.queueSupabaseStoreSync(migrationStore, { immediate: true });
    if (!syncResult?.ok) return { ok: false, ...syncResult };
    if (typeof options.reloadAppFromSupabaseSession === 'function') {
      await options.reloadAppFromSupabaseSession({ showToast: false });
    }
    const report = await runMigrationDryRun(true);
    return { ok: true, report };
  }

  return {
    getState,
    getStorage,
    setState,
    createCrudHandler,
    saveStudent,
    savePending,
    saveEventItem,
    registerMention,
    adjustMention,
    setMentionCount,
    renameMention,
    removeMention,
    saveNpsObservations,
    exportPendingCsv,
    exportScaleCsv,
    exportEventsCsv,
    runFlowSmokeTests,
    runMigrationDryRun,
    loadMigrationDryRunReport,
    getMigrationReadiness,
    runAssistedMigrationToSupabase,
  };
}
