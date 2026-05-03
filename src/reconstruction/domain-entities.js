// Reconstructed domain entities from Reversa Task 02.
// Pure helpers only: no storage, DOM, Supabase, or runtime globals beyond crypto/date.

export const STORE_VERSION = 4;

export const PERIOD_KEY_PATTERN = /^\d{4}-\d{2}$/;

export const NPS_NOTICE_STATUSES = Object.freeze(['Sim', 'Não', 'Pendente']);
export const FEEDBACK_STATUSES = Object.freeze(['Respondeu', 'Não respondeu', 'Pendente']);
export const PENDING_STATUSES = Object.freeze(['aberto', 'respondido', 'concluido']);
export const ROW_TONES = Object.freeze(['green', 'red', 'neutral']);
export const EVENT_STATUSES = Object.freeze(['Programado', 'Confirmado', 'Concluído', 'Cancelado']);

export const RISK_BANDS = Object.freeze([
  { min: 0, max: 20, label: '0..20', tone: 'risk-red' },
  { min: 21, max: 40, label: '21..40', tone: 'risk-orange' },
  { min: 41, max: 60, label: '41..60', tone: 'risk-yellow' },
  { min: 61, max: 80, label: '61..80', tone: 'risk-green-light' },
  { min: 81, max: 100, label: '81..100', tone: 'risk-green-dark' },
]);

export function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function asText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function uniqueTexts(values) {
  return [...new Set(asArray(values).map((value) => asText(value)).filter(Boolean))];
}

export function clampNumber(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeNumericId(value) {
  return asText(value).replace(/\D/g, '');
}

export function normalizeStatus(value, allowed, fallback) {
  const text = asText(value);
  return allowed.includes(text) ? text : fallback;
}

export function getInitialPeriodKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function normalizePeriodKey(value, fallback = getInitialPeriodKey()) {
  const key = asText(value);
  return PERIOD_KEY_PATTERN.test(key) ? key : fallback;
}

export function createPeriodKey(value) {
  const key = normalizePeriodKey(value);
  return {
    key,
    prefix: key,
    label: labelPeriodKey(key),
  };
}

export function labelPeriodKey(periodKey) {
  const key = normalizePeriodKey(periodKey);
  const [year, month] = key.split('-');
  return `${month}/${year}`;
}

export function dateBelongsToPeriod(dateValue, periodKey) {
  const text = asText(dateValue);
  if (!text) return false;
  return text.startsWith(`${normalizePeriodKey(periodKey)}-`);
}

export function createValidationResult(errors = {}) {
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function createStorePreferences(input = {}, runtime = 'production') {
  return {
    initializeMonthsWithTestData:
      typeof input.initializeMonthsWithTestData === 'boolean'
        ? input.initializeMonthsWithTestData
        : runtime === 'development',
  };
}

export function createArchiveEntry(input = {}) {
  const closedAt = asText(input.closedAt) || new Date().toISOString();
  return {
    closedAt,
    closedAtLabel: asText(input.closedAtLabel) || new Date(closedAt).toLocaleString('pt-BR'),
    label: asText(input.label) || '',
  };
}

export function createPeriodSettings(input = {}, defaults = {}) {
  const receptionists = uniqueTexts(input.receptionists).length
    ? uniqueTexts(input.receptionists)
    : uniqueTexts(defaults.receptionists);
  const professors = uniqueTexts(input.professors).length
    ? uniqueTexts(input.professors)
    : uniqueTexts(defaults.professors);
  const addonTypes = uniqueTexts(input.addonTypes).length
    ? uniqueTexts(input.addonTypes)
    : uniqueTexts(defaults.addonTypes);
  const explicitTeam = uniqueTexts(input.team);

  return {
    team: explicitTeam.length ? explicitTeam : uniqueTexts([...receptionists, ...professors]),
    receptionists,
    professors,
    addonTypes,
    monthDays: clampNumber(input.monthDays, 28, 31, 31),
  };
}

export function validateSettings(settings) {
  const errors = {};
  if (!asArray(settings.receptionists).length) errors.receptionists = 'Informe ao menos uma recepcionista.';
  if (!asArray(settings.addonTypes).length) errors.addonTypes = 'Informe ao menos um tipo de addon.';
  return createValidationResult(errors);
}

export function createStudent(input = {}, context = {}) {
  const settings = context.settings || {};
  const defaultReceptionist = asArray(settings.receptionists)[0] || asArray(settings.team)[0] || '';

  return {
    id: asText(input.id) || createId(),
    nome: asText(input.nome),
    matricula: normalizeNumericId(input.matricula),
    ultimaVisita: asText(input.ultimaVisita),
    horaVisita: asText(input.horaVisita ?? input.horario),
    inicio: asText(input.inicio),
    avisoNps: normalizeStatus(input.avisoNps, NPS_NOTICE_STATUSES, 'Sim'),
    atendimento: asText(input.atendimento) || defaultReceptionist,
    feedback: normalizeStatus(input.feedback, FEEDBACK_STATUSES, 'Pendente'),
    addon: asText(input.addon),
    observacoes: asText(input.observacoes),
  };
}

export function validateStudent(student) {
  const errors = {};
  if (!asText(student.nome)) errors.nome = 'Informe o nome do aluno.';
  if (student.matricula !== normalizeNumericId(student.matricula)) {
    errors.matricula = 'Matrícula aceita apenas dígitos.';
  }
  return createValidationResult(errors);
}

export function createPendingItem(input = {}, context = {}) {
  const settings = context.settings || {};
  const defaultAssignee = asArray(settings.receptionists)[0] || asArray(settings.team)[0] || '';

  return {
    id: asText(input.id) || createId(),
    nome: asText(input.nome),
    matricula: normalizeNumericId(input.matricula),
    pendencia: asText(input.pendencia),
    data: asText(input.data),
    hostess: asText(input.hostess) || defaultAssignee,
    resposta: asText(input.resposta),
    status: normalizeStatus(input.status, PENDING_STATUSES, 'aberto'),
  };
}

export function validatePendingItem(item, periodKey) {
  const errors = {};
  if (!asText(item.nome)) errors.nome = 'Informe o nome do aluno.';
  if (!asText(item.pendencia)) errors.pendencia = 'Informe a descrição da pendência.';
  if (asText(item.data) && !dateBelongsToPeriod(item.data, periodKey)) {
    errors.data = 'A data precisa pertencer ao período ativo.';
  }
  if (item.matricula !== normalizeNumericId(item.matricula)) {
    errors.matricula = 'Matrícula aceita apenas dígitos.';
  }
  return createValidationResult(errors);
}

export function createNpsMention(input = {}) {
  return {
    id: asText(input.id) || createId(),
    name: asText(input.name),
    count: Math.max(0, Number(input.count) || 0),
  };
}

export function normalizeNpsRankSnapshot(input = {}) {
  return Object.fromEntries(
    Object.entries(input || {})
      .map(([key, value]) => [asText(key), Math.max(0, Number(value) || 0)])
      .filter(([key]) => Boolean(key)),
  );
}

export function createNpsData(input = {}) {
  return {
    score: clampNumber(input.score, 0, 100, 0),
    monthlyGoal: clampNumber(input.monthlyGoal, 0, 100, 75),
    semesterGoal: clampNumber(input.semesterGoal, 0, 100, 80),
    observations: asText(input.observations),
    mentions: asArray(input.mentions).map(createNpsMention),
    rankSnapshot: normalizeNpsRankSnapshot(input.rankSnapshot),
  };
}

export function createProfessorShift(input = {}) {
  return {
    id: asText(input.id) || createId(),
    time: asText(input.time ?? input.horario),
    name: asText(input.name ?? input.nome),
    swap: asText(input.swap ?? input.troca),
  };
}

export function createScaleEntry(input = {}) {
  const professorShifts = asArray(input.professorShifts).map(createProfessorShift);
  return {
    id: asText(input.id) || createId(),
    date: asText(input.date),
    rowTone: normalizeStatus(input.rowTone, ROW_TONES, 'neutral'),
    professorShifts,
    receptionTime: asText(input.receptionTime),
    receptionist: asText(input.receptionist),
    receptionSwap: asText(input.receptionSwap),
    note: asText(input.note),
  };
}

export function validateScaleEntry(entry) {
  const errors = {};
  if (!asText(entry.date)) errors.date = 'Informe a data da escala.';
  if (!asArray(entry.professorShifts).length) {
    errors.professorShifts = 'Informe ao menos um turno de professor.';
  }
  return createValidationResult(errors);
}

export function createEventItem(input = {}) {
  return {
    id: asText(input.id) || createId(),
    date: asText(input.date),
    time: asText(input.time ?? input.hora),
    type: asText(input.type) || 'Evento',
    title: asText(input.title ?? input.titulo),
    place: asText(input.place ?? input.local),
    owner: asText(input.owner ?? input.responsavel),
    status: normalizeStatus(input.status, EVENT_STATUSES, 'Programado'),
    description: asText(input.description ?? input.descricao),
  };
}

export function validateEventItem(event, periodKey) {
  const errors = {};
  if (!asText(event.date)) errors.date = 'Informe a data do evento.';
  if (!asText(event.title)) errors.title = 'Informe o título do evento.';
  if (asText(event.date) && !dateBelongsToPeriod(event.date, periodKey)) {
    errors.date = 'A data precisa pertencer ao período ativo.';
  }
  return createValidationResult(errors);
}

export function createRecado(input = {}) {
  const message = asText(input.message ?? input.text);
  return {
    id: asText(input.id) || createId(),
    from: asText(input.from ?? input.author),
    to: asText(input.to),
    message,
    text: message,
    author: asText(input.author ?? input.from),
    createdAt: asText(input.createdAt) || new Date().toISOString(),
    read: typeof input.read === 'boolean' ? input.read : false,
    readAt: input.readAt === null ? null : asText(input.readAt),
    periodKey: asText(input.periodKey),
  };
}

export function createAddonMatrix(input = {}) {
  return Object.fromEntries(
    Object.entries(input || {}).map(([person, byType]) => [
      asText(person),
      Object.fromEntries(
        Object.entries(byType || {}).map(([type, values]) => [
          asText(type),
          asArray(values).map((value) => Math.max(0, Number(value) || 0)),
        ]),
      ),
    ]),
  );
}

export function createPeriodData(input = {}, defaults = {}) {
  const settings = createPeriodSettings(input.settings, defaults);
  const context = { settings };

  return {
    settings,
    students: asArray(input.students).map((student) => createStudent(student, context)),
    pending: asArray(input.pending).map((item) => createPendingItem(item, context)),
    recados: asArray(input.recados).map(createRecado),
    nps: createNpsData(input.nps),
    scale: asArray(input.scale ?? input.escala)
      .map(createScaleEntry)
      .filter((entry) => asText(entry.date)),
    events: asArray(input.events ?? input.eventos)
      .map(createEventItem)
      .filter((event) => asText(event.date) || asText(event.title)),
    addons: createAddonMatrix(input.addons),
  };
}

export function createAppStore(input = {}, defaults = {}, runtime = 'production') {
  const activePeriod = normalizePeriodKey(input.activePeriod);
  const periods = Object.fromEntries(
    Object.entries(input.periods || {}).map(([periodKey, periodData]) => [
      normalizePeriodKey(periodKey, activePeriod),
      createPeriodData(periodData, defaults),
    ]),
  );

  if (!periods[activePeriod]) {
    periods[activePeriod] = createPeriodData({}, defaults);
  }

  return {
    version: STORE_VERSION,
    activePeriod,
    preferences: createStorePreferences(input.preferences, runtime),
    periods,
    archives: Object.fromEntries(
      Object.entries(input.archives || {}).map(([periodKey, archive]) => [
        normalizePeriodKey(periodKey, activePeriod),
        createArchiveEntry(archive),
      ]),
    ),
  };
}

export function createSupabaseBackendState(input = {}) {
  return {
    enabled: Boolean(input.enabled),
    hasEnv: Boolean(input.hasEnv),
    hasSdk: Boolean(input.hasSdk),
    sessionStatus: normalizeStatus(input.sessionStatus, ['offline', 'anonymous', 'authenticated'], 'offline'),
    user: input.user || null,
    memberships: asArray(input.memberships),
    activeUnit: input.activeUnit || null,
    writable: Boolean(input.writable),
    source: normalizeStatus(input.source, ['local', 'supabase'], 'local'),
    syncPolicy: asText(input.syncPolicy) || 'local-first-guarded',
    syncStatus: normalizeStatus(input.syncStatus, ['idle', 'loading', 'queued', 'saving', 'error', 'conflict'], 'idle'),
    conflictStatus: normalizeStatus(input.conflictStatus, ['clear', 'baseline-missing', 'detected'], 'clear'),
    lastRemoteCheckpoint: input.lastRemoteCheckpoint || null,
  };
}

export function getRiskBand(score) {
  const value = clampNumber(score, 0, 100, 0);
  return RISK_BANDS.find((band) => value >= band.min && value <= band.max) || RISK_BANDS[0];
}

export function createAddonTotals(addons = {}) {
  const porPessoa = {};
  const porPessoaTipo = {};
  let totalGeral = 0;

  for (const [person, byType] of Object.entries(createAddonMatrix(addons))) {
    porPessoa[person] = 0;
    porPessoaTipo[person] = {};

    for (const [type, values] of Object.entries(byType)) {
      const total = values.reduce((sum, value) => sum + value, 0);
      porPessoaTipo[person][type] = total;
      porPessoa[person] += total;
      totalGeral += total;
    }
  }

  return { porPessoa, porPessoaTipo, totalGeral };
}

export function createReceptionistSummary(input = {}) {
  const total = Math.max(0, Number(input.total) || 0);
  const comFeedback = Math.max(0, Number(input.comFeedback) || 0);
  const addon = Math.max(0, Number(input.addon ?? input.addonVolume) || 0);
  const positivos = Math.max(0, Number(input.positivos) || 0);

  return {
    nome: asText(input.nome),
    total,
    comFeedback,
    nps: Math.max(0, Number(input.nps) || 0),
    addon,
    addonVolume: addon,
    positivos,
    taxaFeedback: total ? comFeedback / total : 0,
    taxaAddon: total ? addon / total : 0,
    taxaPositiva: comFeedback ? positivos / comFeedback : 0,
    diferencaTaxa: Number(input.diferencaTaxa) || 0,
  };
}

export function createNpsRankingResult(input = {}) {
  const ranking = asArray(input.ranking).map((rawItem, index) => {
    const item = rawItem || {};
    return {
      ...createNpsMention(item),
      position: Math.max(1, Number(item.position) || index + 1),
      tendencia: {
        classe: normalizeStatus(
          item.tendencia?.classe,
          ['trend-stable', 'trend-new', 'trend-up', 'trend-down'],
          'trend-stable',
        ),
        rotulo: asText(item.tendencia?.rotulo),
      },
    };
  });

  return {
    ranking,
    totalCitacoes: Math.max(
      0,
      Number(input.totalCitacoes) || ranking.reduce((sum, item) => sum + item.count, 0),
    ),
    top: input.top || ranking[0] || null,
    mapaRanking: normalizeNpsRankSnapshot(input.mapaRanking),
  };
}

export function createDashboardHistoryPoint(input = {}) {
  const key = normalizePeriodKey(input.key);
  return {
    key,
    label: asText(input.label) || labelPeriodKey(key),
    shortLabel: asText(input.shortLabel) || labelPeriodKey(key).slice(0, 2),
    totalAlunos: Math.max(0, Number(input.totalAlunos) || 0),
    npsAtual: clampNumber(input.npsAtual, 0, 100, 0),
    metaMensal: clampNumber(input.metaMensal, 0, 100, 75),
    hasData: Boolean(input.hasData),
  };
}

export function createSaveResult(input = {}) {
  const ok = Boolean(input.ok);
  return {
    ok,
    validation: input.validation || createValidationResult(ok ? {} : { form: 'Operação inválida.' }),
    nextState: input.nextState || null,
    entity: input.entity || null,
  };
}

export function createFlowSmokeReportItem(input = {}) {
  return {
    label: asText(input.label),
    status: normalizeStatus(input.status, ['ok', 'bad', 'warn', 'info'], 'info'),
    detail: asText(input.detail),
  };
}

export function createMigrationSnapshot(input = {}) {
  const totals = input.totals || {};
  return {
    periodCount: Math.max(0, Number(input.periodCount) || 0),
    archiveCount: Math.max(0, Number(input.archiveCount) || 0),
    totals: {
      recados: Math.max(0, Number(totals.recados) || 0),
      students: Math.max(0, Number(totals.students) || 0),
      pending: Math.max(0, Number(totals.pending) || 0),
      events: Math.max(0, Number(totals.events) || 0),
      scaleDays: Math.max(0, Number(totals.scaleDays) || 0),
      professorShiftRows: Math.max(0, Number(totals.professorShiftRows) || 0),
      npsMentions: Math.max(0, Number(totals.npsMentions) || 0),
      addonRows: Math.max(0, Number(totals.addonRows) || 0),
      addonVolume: Math.max(0, Number(totals.addonVolume) || 0),
    },
    periods: input.periods || {},
  };
}
