// Reconstructed Supabase Adapter from Reversa Task 12.
// Local-first Supabase integration contract with injectable browser/client runtime.

import { buildBackupPayloadFromStore } from './backup-import.js';
import {
  cloneSerializable,
  getInitialPeriodKey,
  getPeriodMonthDays,
  normalizeStorePreferences,
} from './period-builder.js';
import { normalizeData, seedAddons } from './lifecycle-normalization.js';
import { prepareStoreCandidate } from './schema-migrations.js';

export const SUPABASE_WRITABLE_ROLES = Object.freeze(['admin', 'gestor']);
export const SUPABASE_ROLE_PRIORITY = Object.freeze({
  admin: 1,
  gestor: 2,
  recepcao: 3,
  professor: 4,
  leitura: 5,
});

export const SUPABASE_IMMEDIATE_SYNC_EVENTS = Object.freeze([
  'import',
  'restore',
  'reset',
  'close',
  'recovery',
  'close-month-backup',
]);

export function createInitialSupabaseBackendState() {
  return {
    enabled: false,
    hasEnv: false,
    hasSdk: false,
    sessionStatus: 'offline',
    user: null,
    memberships: [],
    activeUnit: null,
    writable: false,
    source: 'local',
    syncPolicy: 'local-first-guarded',
    syncStatus: 'idle',
    conflictStatus: 'clear',
    lastSyncAt: null,
    lastRemoteCheckpoint: null,
    lastError: null,
  };
}

export function normalizeSupabaseRole(value) {
  return String(value || '').trim().toLowerCase();
}

export function isSupabaseRoleWritable(role) {
  return SUPABASE_WRITABLE_ROLES.includes(normalizeSupabaseRole(role));
}

export function normalizeSupabaseCheckpoint(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== 'object') return null;
  return {
    revision: String(raw.revision || raw.maxUpdatedAt || raw.max_updated_at || ''),
    maxUpdatedAt: String(raw.maxUpdatedAt || raw.max_updated_at || ''),
    periodCount: Number(raw.periodCount ?? raw.period_count ?? 0),
    auditCount: Number(raw.auditCount ?? raw.audit_count ?? 0),
  };
}

export function isEmptySupabaseCheckpoint(value) {
  const checkpoint = normalizeSupabaseCheckpoint(value);
  return !checkpoint || (
    checkpoint.periodCount === 0
    && checkpoint.auditCount === 0
    && !checkpoint.revision
  );
}

export function isSupabaseSyncConflictError(error) {
  const message = String(error?.message || error?.details || error?.hint || '');
  return error?.code === 'WPM01'
    || error?.code === 'WPM_SYNC_CONFLICT'
    || /WPM_SYNC_CONFLICT|checkpoint remoto divergente|recarregue do backend/i.test(message);
}

export function snapshotSupabaseUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    id: String(user.id || ''),
    email: String(user.email || ''),
    fullName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''),
  };
}

export function snapshotSupabaseMembership(rawMembership) {
  if (!rawMembership || typeof rawMembership !== 'object') return null;
  const rawUnit = Array.isArray(rawMembership.unit) ? rawMembership.unit[0] : rawMembership.unit;
  if (!rawUnit || typeof rawUnit !== 'object') return null;
  return {
    membershipId: String(rawMembership.id || ''),
    displayName: String(rawMembership.display_name || rawMembership.displayName || ''),
    role: normalizeSupabaseRole(rawMembership.role),
    active: rawMembership.active !== false,
    unitId: String(rawUnit.id || rawMembership.unit_id || ''),
    unitName: String(rawUnit.name || ''),
    unitSlug: String(rawUnit.slug || ''),
    unitTimezone: String(rawUnit.timezone || 'America/Sao_Paulo'),
    unitActive: rawUnit.active !== false,
  };
}

export function selectActiveSupabaseMembership(memberships, preferredSlug = null) {
  const activeMemberships = (Array.isArray(memberships) ? memberships : [])
    .filter((item) => item?.active && item?.unitActive)
    .sort((left, right) => {
      const roleDelta = (SUPABASE_ROLE_PRIORITY[left.role] || 99) - (SUPABASE_ROLE_PRIORITY[right.role] || 99);
      if (roleDelta !== 0) return roleDelta;
      return String(left.unitName || '').localeCompare(String(right.unitName || ''));
    });
  if (!activeMemberships.length) return null;
  if (preferredSlug) {
    const preferred = activeMemberships.find((item) => item.unitSlug === preferredSlug);
    if (preferred) return preferred;
  }
  return activeMemberships[0];
}

export function groupSupabaseRows(rows, key) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const groupKey = String(row?.[key] || '');
    if (!groupKey) return;
    if (!map.has(groupKey)) map.set(groupKey, []);
    map.get(groupKey).push(row);
  });
  return map;
}

function fallbackId(prefix, source, index) {
  return String(source?.id || `${prefix}-${index + 1}`);
}

export function mapSupabasePeriodToLocal(
  periodKey,
  settingsRow,
  addonTypeRows,
  studentRows,
  addonSaleRows,
  pendingRows,
  noteRows,
  metricsRow,
  mentionRows,
  scaleDayRows,
  shiftRows,
  eventRows,
) {
  const monthDays = Math.max(28, Math.min(31, Number(settingsRow?.month_days || getPeriodMonthDays(periodKey))));
  const receptionists = [
    ...(Array.isArray(settingsRow?.reception_snapshot) ? settingsRow.reception_snapshot : []),
    ...studentRows.map((item) => item?.receptionist_name_snapshot).filter(Boolean),
    ...pendingRows.map((item) => item?.assignee_name_snapshot).filter(Boolean),
    ...scaleDayRows.map((item) => item?.receptionist_name_snapshot).filter(Boolean),
    ...noteRows.map((item) => item?.from_name_snapshot).filter(Boolean),
  ];
  const professors = [
    ...(Array.isArray(settingsRow?.professor_snapshot) ? settingsRow.professor_snapshot : []),
    ...shiftRows.map((item) => item?.professor_name_snapshot).filter(Boolean),
  ];
  const team = [
    ...(Array.isArray(settingsRow?.team_snapshot) ? settingsRow.team_snapshot : []),
    ...receptionists,
    ...professors,
    ...mentionRows.map((item) => item?.name_snapshot).filter(Boolean),
  ];
  const addonTypes = (Array.isArray(addonTypeRows) ? addonTypeRows : [])
    .slice()
    .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean);

  const period = {
    settings: {
      team: [...new Set(team.filter(Boolean))],
      receptionists: [...new Set(receptionists.filter(Boolean))],
      professors: [...new Set(professors.filter(Boolean))],
      addonTypes: [...new Set(addonTypes.filter(Boolean))],
      monthDays,
    },
    students: (Array.isArray(studentRows) ? studentRows : []).map((item, index) => ({
      id: fallbackId('student', item, index),
      nome: String(item?.student_name || ''),
      matricula: String(item?.membership_number || ''),
      ultimaVisita: String(item?.last_visit_date || ''),
      horaVisita: String(item?.last_visit_time || ''),
      inicio: String(item?.started_at_date || ''),
      avisoNps: String(item?.nps_notice_status || 'Pendente'),
      atendimento: String(item?.receptionist_name_snapshot || ''),
      feedback: String(item?.feedback_status || 'Pendente'),
      addon: String(item?.addon_type_snapshot || ''),
      observacoes: String(item?.notes || ''),
    })),
    pending: (Array.isArray(pendingRows) ? pendingRows : []).map((item, index) => ({
      id: fallbackId('pending', item, index),
      nome: String(item?.student_name || ''),
      matricula: String(item?.membership_number || ''),
      pendencia: String(item?.description || ''),
      data: String(item?.requested_at_date || ''),
      hostess: String(item?.assignee_name_snapshot || ''),
      resposta: String(item?.response || ''),
      status: String(item?.status || 'aberto'),
    })),
    recados: (Array.isArray(noteRows) ? noteRows : []).map((item, index) => ({
      id: fallbackId('note', item, index),
      from: String(item?.from_name_snapshot || ''),
      to: String(item?.to_audience || 'Todos'),
      text: String(item?.message || ''),
      createdAt: String(item?.created_at || ''),
      read: false,
    })),
    nps: {
      score: Number(metricsRow?.score || 0),
      monthlyGoal: Number(metricsRow?.monthly_goal || 75),
      semesterGoal: Number(metricsRow?.semester_goal || 80),
      observations: String(metricsRow?.observations || ''),
      mentions: (Array.isArray(mentionRows) ? mentionRows : []).map((item, index) => ({
        id: fallbackId('mention', item, index),
        name: String(item?.name_snapshot || ''),
        count: Math.max(0, Number(item?.count || 0)),
      })),
      rankSnapshot: Object.fromEntries(
        (Array.isArray(mentionRows) ? mentionRows : [])
          .filter((item) => item?.rank_position)
          .map((item) => [String(item.id || ''), Number(item.rank_position || 0)]),
      ),
    },
    scale: [],
    events: (Array.isArray(eventRows) ? eventRows : [])
      .slice()
      .sort((left, right) => {
        const dateDelta = String(left?.event_date || '').localeCompare(String(right?.event_date || ''));
        if (dateDelta !== 0) return dateDelta;
        return String(left?.event_time || '').localeCompare(String(right?.event_time || ''));
      })
      .map((item, index) => ({
        id: fallbackId('event', item, index),
        date: String(item?.event_date || ''),
        time: String(item?.event_time || ''),
        type: String(item?.type || 'Evento'),
        title: String(item?.title || ''),
        place: String(item?.place || ''),
        owner: String(item?.owner_name_snapshot || ''),
        status: String(item?.status || 'Programado'),
        description: String(item?.description || ''),
      })),
    addons: {},
  };

  seedAddons(period);

  const shiftsByDayId = groupSupabaseRows(shiftRows, 'scale_day_id');
  period.scale = (Array.isArray(scaleDayRows) ? scaleDayRows : [])
    .slice()
    .sort((left, right) => String(left?.scale_date || '').localeCompare(String(right?.scale_date || '')))
    .map((item, index) => ({
      id: fallbackId('scale', item, index),
      date: String(item?.scale_date || ''),
      rowTone: String(item?.row_tone || 'neutral'),
      professorShifts: (shiftsByDayId.get(String(item?.id || '')) || [])
        .slice()
        .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
        .map((shift, shiftIndex) => ({
          id: fallbackId('shift', shift, shiftIndex),
          time: String(shift?.time_label || ''),
          name: String(shift?.professor_name_snapshot || ''),
          swap: String(shift?.swap_name_snapshot || ''),
        })),
      receptionTime: String(item?.reception_time || ''),
      receptionist: String(item?.receptionist_name_snapshot || ''),
      receptionSwap: String(item?.reception_swap || ''),
      note: String(item?.note || ''),
    }));

  (Array.isArray(addonSaleRows) ? addonSaleRows : []).forEach((item) => {
    const receptionist = String(item?.receptionist_name_snapshot || '').trim();
    const addonType = String(item?.addon_type_snapshot || '').trim();
    const saleDate = String(item?.sale_date || '').trim();
    if (!receptionist || !addonType || !saleDate) return;
    const index = Number(String(saleDate).split('-')[2]) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= monthDays) return;
    if (!period.addons[receptionist]) period.addons[receptionist] = {};
    if (!Array.isArray(period.addons[receptionist][addonType])) {
      period.addons[receptionist][addonType] = Array.from({ length: monthDays }, () => 0);
    }
    period.addons[receptionist][addonType][index] += Math.max(0, Number(item?.quantity || 0));
  });

  normalizeData(period);
  return period;
}

async function runQuery(query) {
  const result = await query;
  if (result?.error) throw result.error;
  return Array.isArray(result?.data) ? result.data : [];
}

function applyQueryStep(query, method, args) {
  if (query && typeof query[method] === 'function') return query[method](...args);
  return query;
}

async function selectRows(client, table, selectClause, steps = []) {
  let query = client.from(table).select(selectClause);
  steps.forEach(([method, ...args]) => {
    query = applyQueryStep(query, method, args);
  });
  return runQuery(query);
}

export function shouldSyncSupabaseImmediately(eventType) {
  return SUPABASE_IMMEDIATE_SYNC_EVENTS.includes(String(eventType || ''));
}

export function buildSupabaseBackupPayload(storeLike, options = {}) {
  return buildBackupPayloadFromStore(storeLike, {
    ...options,
    exportedAt: options.exportedAt || new Date().toISOString(),
    defaults: { initializeMonthsWithTestData: false },
  });
}

export function createSupabaseAdapter(options = {}) {
  const globalLike = options.globalLike || globalThis;
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const setTimeoutFn = options.setTimeout || globalLike.setTimeout?.bind(globalLike);
  const clearTimeoutFn = options.clearTimeout || globalLike.clearTimeout?.bind(globalLike);
  let clientCache = null;
  let initErrorReason = null;
  let sessionCache = null;
  let authListenerBound = false;
  let syncTimer = null;
  let pendingSyncStore = null;
  let syncPromise = null;
  let lastRemoteCheckpoint = null;
  let state = createInitialSupabaseBackendState();

  function notifyStateChanged() {
    if (typeof options.onStateChanged === 'function') options.onStateChanged(getSupabaseBackendState());
  }

  function updateSupabaseBackendState(patch = {}, rerender = true) {
    state = { ...state, ...patch };
    if (rerender) notifyStateChanged();
    return getSupabaseBackendState();
  }

  function getSupabaseBackendState() {
    return Object.freeze({
      ...state,
      user: state.user ? { ...state.user } : null,
      activeUnit: state.activeUnit ? { ...state.activeUnit } : null,
      lastRemoteCheckpoint: state.lastRemoteCheckpoint ? cloneSerializable(state.lastRemoteCheckpoint) : null,
      memberships: Array.isArray(state.memberships) ? state.memberships.map((item) => ({ ...item })) : [],
    });
  }

  function rememberSupabaseRemoteCheckpoint(value) {
    const checkpoint = normalizeSupabaseCheckpoint(value);
    lastRemoteCheckpoint = checkpoint ? cloneSerializable(checkpoint) : null;
    updateSupabaseBackendState({
      conflictStatus: 'clear',
      lastRemoteCheckpoint: checkpoint ? cloneSerializable(checkpoint) : null,
    }, false);
  }

  async function readSupabaseSyncCheckpoint(client, unitId) {
    if (!client?.rpc || !unitId) return null;
    const { data, error } = await client.rpc('get_unit_sync_checkpoint', { p_unit_id: unitId });
    if (error) throw error;
    return normalizeSupabaseCheckpoint(data);
  }

  function readSupabaseEnv() {
    const env = globalLike.__APP_ENV__ || {};
    return {
      SUPABASE_URL: env.SUPABASE_URL || null,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || null,
      SUPABASE_UNIT_SLUG: env.SUPABASE_UNIT_SLUG || null,
    };
  }

  function getCreateClient() {
    if (typeof options.clientFactory === 'function') return options.clientFactory;
    const sdk = globalLike.supabase;
    return typeof sdk?.createClient === 'function' ? sdk.createClient.bind(sdk) : null;
  }

  function isSupabaseEnabled() {
    const env = readSupabaseEnv();
    return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && getCreateClient());
  }

  function bindSupabaseAuthListener(client) {
    if (authListenerBound || !client?.auth || typeof client.auth.onAuthStateChange !== 'function') return;
    authListenerBound = true;
    client.auth.onAuthStateChange(async (event, session) => {
      sessionCache = session || null;
      updateSupabaseBackendState({
        sessionStatus: session?.user ? 'authenticated' : 'anonymous',
        user: snapshotSupabaseUser(session?.user || null),
        lastError: null,
      });
      if (event === 'SIGNED_OUT') {
        lastRemoteCheckpoint = null;
        updateSupabaseBackendState({
          memberships: [],
          activeUnit: null,
          writable: false,
          source: 'local',
          syncStatus: 'idle',
          conflictStatus: 'clear',
          lastRemoteCheckpoint: null,
        });
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
        await refreshSupabaseBackendState({ forceSession: false });
      }
    });
  }

  function getSupabaseClient() {
    if (clientCache) return clientCache;
    const env = readSupabaseEnv();
    const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
    const createClient = getCreateClient();
    if (!hasEnv || !createClient) {
      initErrorReason = hasEnv ? 'sdk-missing' : 'env-missing';
      updateSupabaseBackendState({
        enabled: false,
        hasEnv,
        hasSdk: Boolean(createClient),
        sessionStatus: hasEnv ? 'sdk-missing' : 'offline',
      }, false);
      return null;
    }
    try {
      clientCache = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: 5 } },
      });
      initErrorReason = null;
      bindSupabaseAuthListener(clientCache);
      updateSupabaseBackendState({
        enabled: true,
        hasEnv: true,
        hasSdk: true,
        sessionStatus: state.sessionStatus === 'offline' ? 'anonymous' : state.sessionStatus,
      }, false);
      return clientCache;
    } catch (error) {
      initErrorReason = `init-error:${error?.message || 'unknown'}`;
      updateSupabaseBackendState({
        enabled: false,
        hasEnv: true,
        hasSdk: true,
        sessionStatus: 'error',
        lastError: initErrorReason,
      }, false);
      return null;
    }
  }

  async function getSupabaseSession(sessionOptions = {}) {
    const client = getSupabaseClient();
    if (!client?.auth || typeof client.auth.getSession !== 'function') return null;
    if (!sessionOptions.force && sessionCache) return sessionCache;
    const { data, error } = await client.auth.getSession();
    if (error) {
      updateSupabaseBackendState({
        sessionStatus: 'error',
        lastError: error.message || 'Falha ao ler sessao Supabase.',
      });
      return null;
    }
    sessionCache = data?.session || null;
    return sessionCache;
  }

  async function refreshSupabaseBackendState(refreshOptions = {}) {
    const env = readSupabaseEnv();
    const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
    const hasSdk = Boolean(getCreateClient());
    if (!hasEnv || !hasSdk) {
      lastRemoteCheckpoint = null;
      return updateSupabaseBackendState({
        enabled: false,
        hasEnv,
        hasSdk,
        sessionStatus: !hasEnv ? 'offline' : 'sdk-missing',
        user: null,
        memberships: [],
        activeUnit: null,
        writable: false,
        source: 'local',
        conflictStatus: 'clear',
        lastRemoteCheckpoint: null,
      });
    }

    const client = getSupabaseClient();
    if (!client) return getSupabaseBackendState();

    const session = await getSupabaseSession({ force: refreshOptions.forceSession === true });
    if (!session?.user) {
      lastRemoteCheckpoint = null;
      return updateSupabaseBackendState({
        enabled: true,
        hasEnv: true,
        hasSdk: true,
        sessionStatus: 'anonymous',
        user: null,
        memberships: [],
        activeUnit: null,
        writable: false,
        source: 'local',
        conflictStatus: 'clear',
        lastRemoteCheckpoint: null,
        lastError: null,
      });
    }

    try {
      const membershipRows = await selectRows(
        client,
        'unit_members',
        'id, display_name, role, active, unit:units(id, name, slug, timezone, active)',
      );
      const memberships = membershipRows.map(snapshotSupabaseMembership).filter(Boolean);
      const activeMembership = selectActiveSupabaseMembership(memberships, readSupabaseEnv().SUPABASE_UNIT_SLUG);
      return updateSupabaseBackendState({
        enabled: true,
        hasEnv: true,
        hasSdk: true,
        sessionStatus: 'authenticated',
        user: snapshotSupabaseUser(session.user),
        memberships,
        activeUnit: activeMembership,
        writable: isSupabaseRoleWritable(activeMembership?.role),
        source: state.source || 'local',
        lastError: activeMembership ? null : 'Usuario autenticado sem vinculo ativo em unit_members.',
      });
    } catch (error) {
      return updateSupabaseBackendState({
        enabled: true,
        hasEnv: true,
        hasSdk: true,
        sessionStatus: 'error',
        user: snapshotSupabaseUser(session.user),
        memberships: [],
        activeUnit: null,
        writable: false,
        source: 'local',
        conflictStatus: 'clear',
        lastError: error?.message || 'Falha ao carregar memberships do usuario.',
      });
    }
  }

  async function loadStoreFromSupabase(fallbackStore = null) {
    const client = getSupabaseClient();
    if (!client) return null;
    const backendState = await refreshSupabaseBackendState();
    if (!backendState.activeUnit?.unitId) return null;

    updateSupabaseBackendState({ syncStatus: 'loading', lastError: null });

    try {
      const periodRows = await selectRows(
        client,
        'periods',
        'id, period_key, label, status, closed_at',
        [
          ['eq', 'unit_id', backendState.activeUnit.unitId],
          ['order', 'period_key', { ascending: true }],
        ],
      );
      if (!periodRows.length) {
        const emptyCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
        rememberSupabaseRemoteCheckpoint(emptyCheckpoint);
        updateSupabaseBackendState({ syncStatus: 'idle', source: 'local', conflictStatus: 'clear' });
        return null;
      }

      const periodIds = periodRows.map((item) => item.id).filter(Boolean);
      const [
        settingsRows,
        addonTypeRows,
        studentRows,
        addonSaleRows,
        pendingRows,
        noteRows,
        metricRows,
        mentionRows,
        scaleDayRows,
        shiftRows,
        eventRows,
      ] = await Promise.all([
        selectRows(client, 'period_settings', 'period_id, team_snapshot, reception_snapshot, professor_snapshot, month_days', [['in', 'period_id', periodIds]]),
        selectRows(client, 'addon_types', 'period_id, name, sort_order', [['in', 'period_id', periodIds]]),
        selectRows(client, 'student_attendances', 'id, period_id, student_name, membership_number, last_visit_date, last_visit_time, started_at_date, nps_notice_status, receptionist_name_snapshot, feedback_status, addon_type_snapshot, notes', [['in', 'period_id', periodIds]]),
        selectRows(client, 'addon_sales', 'period_id, sale_date, receptionist_name_snapshot, addon_type_snapshot, quantity', [['in', 'period_id', periodIds]]),
        selectRows(client, 'pending_items', 'id, period_id, student_name, membership_number, description, requested_at_date, assignee_name_snapshot, response, status', [['in', 'period_id', periodIds]]),
        selectRows(client, 'shift_notes', 'id, period_id, from_name_snapshot, to_audience, message, created_at', [['in', 'period_id', periodIds]]),
        selectRows(client, 'nps_period_metrics', 'period_id, score, monthly_goal, semester_goal, observations', [['in', 'period_id', periodIds]]),
        selectRows(client, 'nps_mentions', 'id, period_id, name_snapshot, count, rank_position', [['in', 'period_id', periodIds]]),
        selectRows(client, 'scale_days', 'id, period_id, scale_date, row_tone, reception_time, receptionist_name_snapshot, reception_swap, note', [['in', 'period_id', periodIds]]),
        selectRows(client, 'scale_professor_shifts', 'id, scale_day_id, time_label, professor_name_snapshot, swap_name_snapshot, sort_order'),
        selectRows(client, 'events', 'id, period_id, event_date, event_time, type, title, place, owner_name_snapshot, status, description', [['in', 'period_id', periodIds]]),
      ]);

      const settingsByPeriod = new Map(settingsRows.map((item) => [String(item.period_id || ''), item]));
      const metricsByPeriod = new Map(metricRows.map((item) => [String(item.period_id || ''), item]));
      const addonTypesByPeriod = groupSupabaseRows(addonTypeRows, 'period_id');
      const studentsByPeriod = groupSupabaseRows(studentRows, 'period_id');
      const addonSalesByPeriod = groupSupabaseRows(addonSaleRows, 'period_id');
      const pendingByPeriod = groupSupabaseRows(pendingRows, 'period_id');
      const notesByPeriod = groupSupabaseRows(noteRows, 'period_id');
      const mentionsByPeriod = groupSupabaseRows(mentionRows, 'period_id');
      const scaleDaysByPeriod = groupSupabaseRows(scaleDayRows, 'period_id');
      const eventsByPeriod = groupSupabaseRows(eventRows, 'period_id');
      const scaleDayIds = scaleDayRows.map((item) => String(item?.id || '')).filter(Boolean);
      const filteredShifts = shiftRows.filter((item) => scaleDayIds.includes(String(item?.scale_day_id || '')));
      const periods = {};
      const archives = {};

      periodRows.forEach((periodRow) => {
        const periodId = String(periodRow.id || '');
        const periodKey = String(periodRow.period_key || '');
        periods[periodKey] = mapSupabasePeriodToLocal(
          periodKey,
          settingsByPeriod.get(periodId) || null,
          addonTypesByPeriod.get(periodId) || [],
          studentsByPeriod.get(periodId) || [],
          addonSalesByPeriod.get(periodId) || [],
          pendingByPeriod.get(periodId) || [],
          notesByPeriod.get(periodId) || [],
          metricsByPeriod.get(periodId) || null,
          mentionsByPeriod.get(periodId) || [],
          scaleDaysByPeriod.get(periodId) || [],
          filteredShifts,
          eventsByPeriod.get(periodId) || [],
        );
        if (String(periodRow.status || '') === 'closed') {
          const closedAt = String(periodRow.closed_at || now());
          archives[periodKey] = {
            closedAt,
            closedAtLabel: closedAt,
            label: String(periodRow.label || periodKey),
          };
        }
      });

      const fallbackCandidate = prepareStoreCandidate(cloneSerializable(fallbackStore || null), {
        defaults: { initializeMonthsWithTestData: false },
      });
      const preferredActivePeriod = fallbackCandidate?.periods?.[fallbackCandidate.activePeriod]
        ? fallbackCandidate.activePeriod
        : periodRows.find((item) => String(item.status || '') === 'open')?.period_key
          || periodRows.at(-1)?.period_key
          || getInitialPeriodKey();
      const remoteStore = prepareStoreCandidate({
        version: 4,
        activePeriod: preferredActivePeriod,
        preferences: normalizeStorePreferences(fallbackCandidate?.preferences, {
          defaults: { initializeMonthsWithTestData: false },
        }),
        periods,
        archives,
      }, { defaults: { initializeMonthsWithTestData: false } });

      const checkpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
      rememberSupabaseRemoteCheckpoint(checkpoint);
      updateSupabaseBackendState({
        source: 'supabase',
        syncStatus: 'idle',
        conflictStatus: 'clear',
        lastSyncAt: now(),
        lastError: null,
      });
      return remoteStore;
    } catch (error) {
      updateSupabaseBackendState({
        source: 'local',
        syncStatus: 'error',
        conflictStatus: 'clear',
        lastError: error?.message || 'Falha ao carregar store remoto.',
      });
      return null;
    }
  }

  async function saveStoreToSupabase(storeLike) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, skipped: true, reason: 'supabase-disabled' };
    const backendState = await refreshSupabaseBackendState();
    if (!backendState.activeUnit?.unitId) return { ok: false, skipped: true, reason: 'unit-missing' };
    if (!backendState.writable) return { ok: false, skipped: true, reason: 'role-readonly' };

    updateSupabaseBackendState({ syncStatus: 'saving', conflictStatus: 'clear', lastError: null });

    try {
      const payload = buildSupabaseBackupPayload(storeLike, { exportedAt: now() });
      const currentCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
      if (!lastRemoteCheckpoint && !isEmptySupabaseCheckpoint(currentCheckpoint) && backendState.source !== 'supabase') {
        updateSupabaseBackendState({
          source: 'local',
          syncStatus: 'conflict',
          conflictStatus: 'baseline-missing',
          lastRemoteCheckpoint: normalizeSupabaseCheckpoint(currentCheckpoint),
          lastError: 'Backend ja possui dados. Recarregue do backend antes de sincronizar este dispositivo.',
        });
        return { ok: false, skipped: true, conflict: true, reason: 'remote-baseline-missing' };
      }

      const expectedCheckpoint = lastRemoteCheckpoint
        ? cloneSerializable(lastRemoteCheckpoint)
        : normalizeSupabaseCheckpoint(currentCheckpoint);
      const { data, error } = await client.rpc('import_backup_transaction_guarded', {
        p_unit_id: backendState.activeUnit.unitId,
        p_payload: payload,
        p_expected_checkpoint: expectedCheckpoint,
        p_preview_accepted: true,
      });
      if (error) throw error;

      const nextCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
      rememberSupabaseRemoteCheckpoint(nextCheckpoint);
      updateSupabaseBackendState({
        source: 'supabase',
        syncStatus: 'idle',
        conflictStatus: 'clear',
        lastSyncAt: now(),
        lastError: null,
      });
      return { ok: true, data, checkpoint: getSupabaseBackendState().lastRemoteCheckpoint };
    } catch (error) {
      if (isSupabaseSyncConflictError(error)) {
        updateSupabaseBackendState({
          source: 'local',
          syncStatus: 'conflict',
          conflictStatus: 'detected',
          lastError: error?.message || 'Conflito remoto detectado. Recarregue do backend antes de sincronizar.',
        });
        return { ok: false, conflict: true, reason: 'remote-conflict', error };
      }
      updateSupabaseBackendState({
        source: 'local',
        syncStatus: 'error',
        conflictStatus: 'clear',
        lastError: error?.message || 'Falha ao sincronizar store com Supabase.',
      });
      return { ok: false, error };
    }
  }

  async function queueSupabaseStoreSync(storeLike, queueOptions = {}) {
    if (syncTimer && clearTimeoutFn) {
      clearTimeoutFn(syncTimer);
      syncTimer = null;
    }
    pendingSyncStore = cloneSerializable(storeLike);
    updateSupabaseBackendState({ syncStatus: queueOptions.immediate === true ? 'saving' : 'queued' });

    const runSync = async () => {
      const payload = pendingSyncStore;
      pendingSyncStore = null;
      syncPromise = saveStoreToSupabase(payload);
      return syncPromise.finally(() => {
        syncPromise = null;
      });
    };

    if (queueOptions.immediate === true || !setTimeoutFn) return runSync();

    return new Promise((resolve) => {
      syncTimer = setTimeoutFn(async () => {
        syncTimer = null;
        resolve(await runSync());
      }, Math.max(250, Number(queueOptions.delayMs || 900)));
    });
  }

  async function syncCurrentStoreToSupabase(syncOptions = {}) {
    const storeSnapshot = typeof options.getCurrentStore === 'function'
      ? options.getCurrentStore()
      : null;
    const prepared = prepareStoreCandidate(cloneSerializable(storeSnapshot), {
      defaults: { initializeMonthsWithTestData: false },
    });
    if (!prepared) return { ok: false, skipped: true, reason: 'store-invalid' };
    const result = await queueSupabaseStoreSync(prepared, { immediate: true });
    if (syncOptions.showToast !== false && typeof options.showToast === 'function') {
      if (result?.ok) options.showToast('Sincronizacao com o backend concluida.', 'success');
      else if (result?.conflict) options.showToast('Conflito remoto detectado. Recarregue do backend antes de sincronizar novamente.', 'warning');
      else if (!result?.skipped) options.showToast('Falha ao sincronizar o estado atual com o backend.', 'warning');
    }
    return result;
  }

  async function reloadAppFromSupabaseSession(reloadOptions = {}) {
    try {
      const localCandidate = typeof options.loadStore === 'function'
        ? await options.loadStore({ skipRemote: true })
        : null;
      const remoteStore = await loadStoreFromSupabase(localCandidate);
      if (!remoteStore) return false;
      if (typeof options.saveStore === 'function') {
        await options.saveStore(remoteStore, {
          silent: true,
          broadcast: false,
          skipRemoteSync: true,
          eventType: 'remote-load',
        });
      }
      if (typeof options.syncAppState === 'function') await options.syncAppState(remoteStore);
      if (typeof options.renderAll === 'function') options.renderAll();
      if (typeof options.syncPeriodControls === 'function') options.syncPeriodControls();
      if (reloadOptions.showToast !== false && typeof options.showToast === 'function') {
        options.showToast('Base remota carregada com sucesso.', 'success');
      }
      return true;
    } catch (error) {
      updateSupabaseBackendState({
        syncStatus: 'error',
        lastError: error?.message || 'Falha ao aplicar store remoto.',
      });
      return false;
    }
  }

  async function signInSupabasePassword(email, password, signInOptions = {}) {
    const client = getSupabaseClient();
    if (!client?.auth || typeof client.auth.signInWithPassword !== 'function') {
      return { ok: false, error: 'Supabase Auth indisponivel neste runtime.' };
    }
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail || !String(password || '').trim()) {
      return { ok: false, error: 'Informe e-mail e senha.' };
    }
    updateSupabaseBackendState({ syncStatus: 'loading', lastError: null });
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password: String(password || ''),
    });
    if (error) {
      updateSupabaseBackendState({
        syncStatus: 'error',
        lastError: error.message || 'Falha ao autenticar.',
      });
      return { ok: false, error: error.message || 'Falha ao autenticar.' };
    }
    sessionCache = data?.session || null;
    await refreshSupabaseBackendState({ forceSession: false });
    if (signInOptions.reload !== false) await reloadAppFromSupabaseSession({ showToast: false });
    return { ok: true };
  }

  async function signOutSupabase() {
    const client = getSupabaseClient();
    if (!client?.auth || typeof client.auth.signOut !== 'function') {
      return { ok: false, error: 'Supabase Auth indisponivel neste runtime.' };
    }
    const { error } = await client.auth.signOut();
    if (error) {
      updateSupabaseBackendState({
        syncStatus: 'error',
        lastError: error.message || 'Falha ao encerrar sessao.',
      });
      return { ok: false, error: error.message || 'Falha ao encerrar sessao.' };
    }
    sessionCache = null;
    lastRemoteCheckpoint = null;
    updateSupabaseBackendState({
      sessionStatus: 'anonymous',
      user: null,
      memberships: [],
      activeUnit: null,
      writable: false,
      source: 'local',
      syncStatus: 'idle',
      conflictStatus: 'clear',
      lastRemoteCheckpoint: null,
      lastError: null,
    });
    return { ok: true };
  }

  function getSupabaseStatus() {
    const env = readSupabaseEnv();
    const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
    const hasSdk = Boolean(getCreateClient());
    return {
      enabled: hasEnv && hasSdk,
      hasEnv,
      hasSdk,
      reason: initErrorReason,
      unitSlug: env.SUPABASE_UNIT_SLUG,
      sessionStatus: state.sessionStatus,
    };
  }

  function resetSupabaseClient() {
    if (syncTimer && clearTimeoutFn) clearTimeoutFn(syncTimer);
    clientCache = null;
    initErrorReason = null;
    sessionCache = null;
    authListenerBound = false;
    syncTimer = null;
    pendingSyncStore = null;
    syncPromise = null;
    lastRemoteCheckpoint = null;
    state = createInitialSupabaseBackendState();
  }

  return {
    readSupabaseEnv,
    isSupabaseEnabled,
    getSupabaseClient,
    getSupabaseSession,
    refreshSupabaseBackendState,
    getSupabaseBackendState,
    loadStoreFromSupabase,
    saveStoreToSupabase,
    queueSupabaseStoreSync,
    syncCurrentStoreToSupabase,
    reloadAppFromSupabaseSession,
    signInSupabasePassword,
    signOutSupabase,
    getSupabaseStatus,
    resetSupabaseClient,
    updateSupabaseBackendState,
    rememberSupabaseRemoteCheckpoint,
    readSupabaseSyncCheckpoint,
    buildSupabaseBackupPayload,
    shouldSyncSupabaseImmediately,
  };
}
