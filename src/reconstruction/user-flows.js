// Reconstructed User Flows contract from Reversa Task 18.
// Executable orchestration for the four documented user stories.

export const USER_FLOW_IDS = Object.freeze([
  'US-WPM-001',
  'US-WPM-002',
  'US-WPM-003',
  'US-WPM-004',
]);

export const CRITICAL_SUPABASE_EVENTS = Object.freeze([
  'import',
  'restore',
  'reset',
  'close',
  'recovery',
  'close-month-backup',
]);

export const PENDING_STATUSES = Object.freeze(['aberto', 'respondido', 'concluido']);

export function cloneSerializable(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function normalizeNumericId(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function clamp(value, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function getNextPeriodKey(periodKey) {
  const [year, month] = String(periodKey).split('-').map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isDateInPeriod(value, periodKey) {
  if (!value) return false;
  return String(value).startsWith(`${String(periodKey).slice(0, 7)}-`);
}

export function periodHasMeaningfulData(period = {}) {
  if ((period.students || []).length > 0) return true;
  if ((period.pending || []).length > 0) return true;
  if ((period.recados || []).length > 0) return true;
  if ((period.scale || []).length > 0) return true;
  if ((period.events || []).length > 0) return true;
  if (Number(period.nps?.score || 0) > 0) return true;
  if (String(period.nps?.observations || '').trim()) return true;
  if ((period.nps?.mentions || []).length > 0) return true;
  return Object.values(period.addons || {}).some((byType) => (
    Object.values(byType || {}).some((days) => (days || []).some((value) => Number(value) > 0))
  ));
}

export function createEmptyPeriod(periodKey, template = {}) {
  const month = Number(String(periodKey).slice(5, 7));
  const year = Number(String(periodKey).slice(0, 4));
  const monthDays = new Date(year, month, 0).getDate();
  const settings = {
    monthDays,
    team: template.settings?.team || [],
    receptionists: template.settings?.receptionists || [],
    professors: template.settings?.professors || [],
    addonTypes: template.settings?.addonTypes || [],
  };
  const addons = {};
  for (const person of settings.receptionists.length ? settings.receptionists : settings.team) {
    addons[person] = {};
    for (const addonType of settings.addonTypes) addons[person][addonType] = Array(monthDays).fill(0);
  }
  return {
    settings,
    students: [],
    pending: [],
    recados: [],
    nps: { score: 0, monthlyGoal: template.nps?.monthlyGoal ?? 75, semesterGoal: template.nps?.semesterGoal ?? 80, observations: '', mentions: [], rankSnapshot: {} },
    scale: [],
    events: [],
    addons,
  };
}

export function buildMonthArchivePayload(periodKey, period, options = {}) {
  return {
    meta: {
      kind: 'month-archive',
      appVersion: options.appVersion || 'reconstruction',
      exportedAt: options.now || new Date().toISOString(),
    },
    version: options.version || 4,
    periodKey,
    periodLabel: options.periodLabel || periodKey,
    data: cloneSerializable(period),
  };
}

export function getStudentAddonLink(student, period, periodKey) {
  if (!student?.addon || !student?.atendimento || !period?.addons?.[student.atendimento]?.[student.addon]) return null;
  const rawDate = student.inicio || student.ultimaVisita || `${periodKey}-01`;
  const day = Number(String(rawDate).split('-')[2] || 1);
  const monthDays = Number(period.settings?.monthDays || 31);
  return {
    person: student.atendimento,
    addon: student.addon,
    index: Math.min(monthDays, Math.max(1, day)) - 1,
  };
}

export function applyStudentAddonDelta(period, student, periodKey, delta) {
  const link = getStudentAddonLink(student, period, periodKey);
  if (!link) return null;
  const days = period.addons[link.person][link.addon];
  days[link.index] = Math.max(0, Number(days[link.index] || 0) + Number(delta || 0));
  return { ...link, value: days[link.index] };
}

function upsertById(items = [], entity) {
  const index = items.findIndex((item) => item.id === entity.id);
  if (index >= 0) return items.map((item, itemIndex) => (itemIndex === index ? entity : item));
  return [entity, ...items];
}

function removeById(items = [], id) {
  return items.filter((item) => item.id !== id);
}

function compareEventDateTime(left, right) {
  return `${left.date || ''}T${left.time || ''}`.localeCompare(`${right.date || ''}T${right.time || ''}`);
}

function buildCsv(rows) {
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(';')).join('\n');
}

export function createUserFlowsRuntime(options = {}) {
  const storage = options.storage || {
    version: 4,
    activePeriod: options.currentPeriodKey || '2026-05',
    periods: {},
    archives: {},
    preferences: {},
  };
  let currentPeriodKey = options.currentPeriodKey || storage.activePeriod;
  storage.periods[currentPeriodKey] ||= createEmptyPeriod(currentPeriodKey);
  storage.archives ||= {};
  const renders = [];
  const toasts = [];
  const downloads = [];
  const confirmations = [];
  let pendingNpsObservationTimer = null;

  function getState(periodKey = currentPeriodKey) {
    storage.periods[periodKey] ||= createEmptyPeriod(periodKey, storage.periods[currentPeriodKey]);
    return storage.periods[periodKey];
  }

  function isWritable(periodKey = currentPeriodKey) {
    return !storage.archives?.[periodKey] && options.supabaseReadonly !== true;
  }

  function assertWritable(action = 'mutacao') {
    if (isWritable()) return true;
    showToast(`Periodo fechado ou somente leitura: ${action} bloqueada.`, 'warning');
    return false;
  }

  function requestRender(targets) {
    renders.push(targets);
    options.requestRender?.(targets);
  }

  function showToast(message, type = 'info') {
    toasts.push({ message, type });
    options.showToast?.(message, type);
  }

  async function saveData(force = false) {
    if (typeof options.saveData === 'function') return options.saveData(force, storage);
    return true;
  }

  async function withRollback(mutator, rollbackTargets, failureMessage) {
    const previousStorage = cloneSerializable(storage);
    const previousPeriodKey = currentPeriodKey;
    const result = await mutator();
    const persisted = await saveData(result?.force === true);
    if (!persisted) {
      Object.keys(storage).forEach((key) => delete storage[key]);
      Object.assign(storage, previousStorage);
      currentPeriodKey = previousPeriodKey;
      requestRender(rollbackTargets);
      showToast(failureMessage, 'danger');
      return { ok: false, rolledBack: true, reason: 'save-failed' };
    }
    return { ok: true, ...result };
  }

  async function saveStudent(formData = {}, existingStudent = null) {
    if (!assertWritable('atendimento')) return { ok: false, reason: 'locked' };
    const period = getState();
    const matricula = normalizeNumericId(formData.rawMatricula ?? formData.matricula);
    if (String(formData.rawMatricula ?? formData.matricula ?? '') && matricula !== String(formData.rawMatricula ?? formData.matricula)) {
      return { ok: false, validation: { matricula: 'O numero da matricula deve conter apenas digitos.' } };
    }
    if (!String(formData.nome || '').trim()) {
      return { ok: false, validation: { nome: 'Preencha ao menos o nome do aluno.' } };
    }
    const entity = {
      id: existingStudent?.id || formData.id || `student-${Date.now()}`,
      nome: String(formData.nome || '').trim(),
      matricula,
      ultimaVisita: formData.ultimaVisita || '',
      horaVisita: formData.horaVisita || '',
      inicio: formData.inicio || '',
      avisoNps: formData.avisoNps || 'Pendente',
      atendimento: formData.atendimento || '',
      feedback: formData.feedback || 'Pendente',
      addon: formData.addon || '',
      observacoes: formData.observacoes || '',
    };
    const result = await withRollback(async () => {
      if (existingStudent) applyStudentAddonDelta(period, existingStudent, currentPeriodKey, -1);
      period.students = upsertById(period.students || [], entity);
      applyStudentAddonDelta(period, entity, currentPeriodKey, 1);
      requestRender(['hero', 'dashboard', 'students', 'addons']);
      return { entity };
    }, ['hero', 'dashboard', 'students', 'addons'], 'Falha ao salvar atendimento.');
    return result.ok ? { ...result, entity } : result;
  }

  async function deleteStudent(studentId) {
    if (!assertWritable('atendimento')) return { ok: false, reason: 'locked' };
    const period = getState();
    const existing = (period.students || []).find((student) => student.id === studentId);
    if (!existing) return { ok: false, reason: 'not-found' };
    return withRollback(async () => {
      applyStudentAddonDelta(period, existing, currentPeriodKey, -1);
      period.students = removeById(period.students, studentId);
      requestRender(['hero', 'dashboard', 'students', 'addons']);
      return { entity: existing };
    }, ['hero', 'dashboard', 'students', 'addons'], 'Falha ao excluir atendimento.');
  }

  function filterStudents({ search = '', atendimento = '', feedback = '' } = {}) {
    const query = normalizeSearchText(search);
    return (getState().students || []).filter((student) => {
      const haystack = normalizeSearchText([student.nome, student.matricula, student.atendimento, student.observacoes, student.addon].join(' '));
      return (!query || haystack.includes(query))
        && (!atendimento || student.atendimento === atendimento)
        && (!feedback || student.feedback === feedback);
    });
  }

  async function closeCurrentMonth({ resetNext = null } = {}) {
    if (!assertWritable('fechamento mensal')) return { ok: false, reason: 'locked' };
    const period = getState();
    const archivePayload = buildMonthArchivePayload(currentPeriodKey, period, { version: storage.version, now: options.now });
    downloads.push({ filename: `smartfit-fechamento-${currentPeriodKey}.json`, payload: archivePayload });
    options.downloadJson?.(`smartfit-fechamento-${currentPeriodKey}.json`, archivePayload);
    const previousArchive = cloneSerializable(storage.archives[currentPeriodKey]);
    const nextKey = getNextPeriodKey(currentPeriodKey);
    const nextHadData = periodHasMeaningfulData(storage.periods[nextKey]);
    const shouldResetNext = resetNext ?? !nextHadData;
    const result = await withRollback(async () => {
      storage.archives[currentPeriodKey] = {
        closedAt: options.now || new Date().toISOString(),
        closedAtLabel: options.closedAtLabel || currentPeriodKey,
        label: currentPeriodKey,
      };
      if (!storage.periods[nextKey] || shouldResetNext) {
        storage.periods[nextKey] = createEmptyPeriod(nextKey, period);
      }
      storage.activePeriod = nextKey;
      currentPeriodKey = nextKey;
      requestRender('all');
      return { force: true, archivePayload, nextKey, previousArchive, resetNext: shouldResetNext };
    }, 'all', 'Falha ao fechar o mes. Tente novamente.');
    return result.ok ? { ...result, nextHadData, activePeriod: currentPeriodKey } : result;
  }

  async function syncStoreToSupabase({ remoteCheckpoint = null, baselineCheckpoint = storage.__supabaseLastRemoteCheckpoint, eventType = 'save' } = {}) {
    if (!options.supabaseEnabled) return { ok: true, skipped: true, reason: 'supabase-disabled' };
    if (!options.supabaseWritable) return { ok: true, skipped: true, reason: 'role-readonly' };
    const remoteHasData = Number(remoteCheckpoint?.periodCount || 0) > 0 || Number(remoteCheckpoint?.auditCount || 0) > 0;
    if (remoteHasData && !baselineCheckpoint && options.source !== 'supabase') {
      return { ok: false, conflict: true, reason: 'remote-baseline-missing' };
    }
    const payload = { meta: { kind: 'app-backup', exportedAt: options.now || new Date().toISOString() }, periods: cloneSerializable(storage.periods), archives: cloneSerializable(storage.archives) };
    const response = await options.importBackupTransactionGuarded?.({
      p_unit_id: options.unitId,
      p_payload: payload,
      p_expected_checkpoint: baselineCheckpoint || remoteCheckpoint || null,
      immediate: CRITICAL_SUPABASE_EVENTS.includes(eventType),
    });
    if (response?.conflict || response?.kind === 'sync-conflict') return { ok: false, conflict: true, reason: 'remote-conflict' };
    storage.__supabaseLastRemoteCheckpoint = response?.nextCheckpoint || remoteCheckpoint || baselineCheckpoint || null;
    return { ok: true, source: 'supabase', checkpoint: storage.__supabaseLastRemoteCheckpoint };
  }

  function reloadFromSupabase(remoteStore) {
    Object.keys(storage).forEach((key) => delete storage[key]);
    Object.assign(storage, cloneSerializable(remoteStore), { source: 'supabase' });
    currentPeriodKey = storage.activePeriod;
    requestRender('all');
    return { ok: true, storage };
  }

  async function savePending(formData = {}) {
    if (!assertWritable('pendencia')) return { ok: false, reason: 'locked' };
    const matricula = normalizeNumericId(formData.rawMatricula ?? formData.matricula);
    if (!formData.nome || !formData.pendencia) return { ok: false, validation: { required: 'Preencha ao menos nome e pendencia.' } };
    if (formData.data && !isDateInPeriod(formData.data, currentPeriodKey)) return { ok: false, validation: { data: 'A data da pendencia deve pertencer ao periodo ativo.' } };
    const entity = { id: formData.id || `pending-${Date.now()}`, nome: formData.nome, matricula, pendencia: formData.pendencia, data: formData.data || '', hostess: formData.hostess || '', resposta: formData.resposta || '', status: formData.status || 'aberto' };
    return withRollback(async () => {
      const period = getState();
      period.pending = upsertById(period.pending || [], entity);
      requestRender(['hero', 'dashboard', 'pending']);
      return { entity };
    }, ['hero', 'dashboard', 'pending'], 'Falha ao salvar pendencia.');
  }

  async function updatePendingStatus(id, status) {
    if (!assertWritable('pendencia')) return { ok: false, reason: 'locked' };
    if (!PENDING_STATUSES.includes(status)) return { ok: false, reason: 'invalid-status' };
    const period = getState();
    const pending = (period.pending || []).find((item) => item.id === id);
    if (!pending || pending.status === status) return { ok: false, reason: 'noop' };
    return withRollback(async () => {
      pending.status = status;
      requestRender(['hero', 'dashboard', 'pending']);
      return { entity: pending };
    }, ['hero', 'dashboard', 'pending'], 'Falha ao atualizar pendencia.');
  }

  function exportPendingCsv() {
    const rows = [['Nome', 'Matricula', 'Pendencia', 'Data', 'Responsavel', 'Resposta', 'Status']];
    for (const item of getState().pending || []) {
      rows.push([item.nome, item.matricula, item.pendencia, item.data, item.hostess, item.resposta, item.status]);
    }
    const csv = buildCsv(rows);
    downloads.push({ filename: `pendencias-${currentPeriodKey}.csv`, payload: csv });
    return csv;
  }

  async function updateNpsScore(score) {
    if (!assertWritable('nps')) return { ok: false, reason: 'locked' };
    return withRollback(async () => {
      getState().nps.score = clamp(score);
      requestRender(['hero', 'dashboard', 'nps']);
      return { score: getState().nps.score };
    }, ['hero', 'dashboard', 'nps'], 'Falha ao salvar NPS.');
  }

  async function saveNpsObservations(text, { debounceMs = 800, immediate = false } = {}) {
    if (!assertWritable('nps')) return { ok: false, reason: 'locked' };
    if (pendingNpsObservationTimer) clearTimeout(pendingNpsObservationTimer);
    if (!immediate) {
      return new Promise((resolve) => {
        pendingNpsObservationTimer = setTimeout(async () => {
          const result = await saveNpsObservations(text, { immediate: true });
          resolve(result);
        }, debounceMs);
      });
    }
    return withRollback(async () => {
      getState().nps.observations = String(text || '');
      requestRender(['dashboard', 'nps']);
      return { observations: getState().nps.observations };
    }, ['dashboard', 'nps'], 'Falha ao salvar observacoes NPS.');
  }

  async function registerNpsMention(name, count = 1) {
    if (!assertWritable('nps')) return { ok: false, reason: 'locked' };
    if (!String(name || '').trim()) {
      showToast('Informe o nome do funcionario citado.', 'warning');
      return { ok: false, validation: { name: 'Informe o nome do funcionario citado.' } };
    }
    return withRollback(async () => {
      const nps = getState().nps;
      nps.rankSnapshot = Object.fromEntries((nps.mentions || []).map((mention, index) => [mention.id || mention.name, index + 1]));
      const normalizedName = normalizeSearchText(name);
      const existing = (nps.mentions || []).find((mention) => normalizeSearchText(mention.name) === normalizedName);
      if (existing) existing.count = Math.max(0, Number(existing.count || 0) + Number(count || 0));
      else nps.mentions = [{ id: `mention-${Date.now()}`, name: String(name).trim(), count: Math.max(0, Number(count || 0)) }, ...(nps.mentions || [])];
      requestRender(['hero', 'dashboard', 'nps']);
      return { mentions: nps.mentions };
    }, ['hero', 'dashboard', 'nps'], 'Falha ao salvar mencao NPS.');
  }

  async function saveScaleDay(formData = {}) {
    if (!assertWritable('escala')) return { ok: false, reason: 'locked' };
    const shifts = (formData.professorShifts || []).filter((shift) => shift.time || shift.name || shift.swap);
    if (!formData.date) return { ok: false, validation: { date: 'Preencha a data da escala.' } };
    if (!isDateInPeriod(formData.date, currentPeriodKey)) return { ok: false, validation: { date: 'A data da escala deve pertencer ao periodo ativo.' } };
    if (shifts.length === 0) return { ok: false, validation: { professorShifts: 'Adicione pelo menos uma linha de professor.' } };
    const entity = { id: formData.id || `scale-${Date.now()}`, date: formData.date, rowTone: formData.rowTone || 'neutral', professorShifts: shifts, receptionTime: formData.receptionTime || '', receptionist: formData.receptionist || '', receptionSwap: formData.receptionSwap || '', note: formData.note || '' };
    return withRollback(async () => {
      const period = getState();
      period.scale = upsertById(period.scale || [], entity).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      requestRender(['dashboard', 'scale']);
      return { entity };
    }, ['dashboard', 'scale'], 'Falha ao salvar escala.');
  }

  async function saveEvent(formData = {}, { confirmDuplicate = false } = {}) {
    if (!assertWritable('evento')) return { ok: false, reason: 'locked' };
    if (!formData.date || !formData.title) return { ok: false, validation: { required: 'Preencha ao menos data e titulo.' } };
    if (!isDateInPeriod(formData.date, currentPeriodKey)) return { ok: false, validation: { date: 'A data do evento deve pertencer ao periodo ativo.' } };
    const period = getState();
    const entity = { id: formData.id || `event-${Date.now()}`, date: formData.date, time: formData.time || '', type: formData.type || 'Evento', title: String(formData.title).trim(), place: formData.place || '', owner: formData.owner || '', status: formData.status || 'Programado', description: formData.description || '' };
    const duplicate = (period.events || []).some((event) => event.id !== entity.id && event.date === entity.date && event.time === entity.time && normalizeSearchText(event.title) === normalizeSearchText(entity.title));
    if (duplicate && !confirmDuplicate) {
      confirmations.push({ type: 'event-duplicate', entity });
      return { ok: false, confirmationRequired: true, entity };
    }
    return withRollback(async () => {
      period.events = upsertById(period.events || [], entity).sort(compareEventDateTime);
      requestRender(['dashboard', 'events']);
      return { entity };
    }, ['dashboard', 'events'], 'Falha ao salvar evento.');
  }

  async function duplicateEvent(id) {
    const source = (getState().events || []).find((event) => event.id === id);
    if (!source) return { ok: false, reason: 'not-found' };
    return saveEvent({ ...source, id: `event-copy-${Date.now()}`, title: `${source.title} (copia)`, status: 'Programado' }, { confirmDuplicate: true });
  }

  async function deleteEvent(id) {
    if (!assertWritable('evento')) return { ok: false, reason: 'locked' };
    return withRollback(async () => {
      getState().events = removeById(getState().events || [], id);
      requestRender(['dashboard', 'events']);
      return { id };
    }, ['dashboard', 'events'], 'Falha ao excluir evento.');
  }

  return {
    storage,
    get currentPeriodKey() { return currentPeriodKey; },
    get renders() { return renders; },
    get toasts() { return toasts; },
    get downloads() { return downloads; },
    get confirmations() { return confirmations; },
    getState,
    isWritable,
    saveStudent,
    deleteStudent,
    filterStudents,
    closeCurrentMonth,
    syncStoreToSupabase,
    reloadFromSupabase,
    savePending,
    updatePendingStatus,
    exportPendingCsv,
    updateNpsScore,
    saveNpsObservations,
    registerNpsMention,
    saveScaleDay,
    saveEvent,
    duplicateEvent,
    deleteEvent,
  };
}
