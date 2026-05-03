import { describe, expect, it, vi } from 'vitest';

import { normalizeData } from '../../src/reconstruction/schema-migrations.js';
import {
  createSupabaseAdapter,
  isEmptySupabaseCheckpoint,
  normalizeSupabaseCheckpoint,
  selectActiveSupabaseMembership,
  shouldSyncSupabaseImmediately,
} from '../../src/reconstruction/supabase-adapter.js';

class FakeQuery {
  constructor(rows = [], error = null) {
    this.rows = Array.isArray(rows) ? rows : [];
    this.error = error;
    this.filters = [];
    this.orders = [];
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => row?.[column] === value);
    return this;
  }

  in(column, values) {
    const accepted = new Set(values);
    this.filters.push((row) => accepted.has(row?.[column]));
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  then(resolve, reject) {
    let data = [...this.rows];
    this.filters.forEach((filter) => {
      data = data.filter(filter);
    });
    this.orders.forEach(({ column, ascending }) => {
      data.sort((left, right) => {
        const delta = String(left?.[column] || '').localeCompare(String(right?.[column] || ''));
        return ascending ? delta : -delta;
      });
    });
    return Promise.resolve({ data, error: this.error }).then(resolve, reject);
  }
}

function createFakeClient({
  tables = {},
  session = { user: { id: 'user-admin', email: 'admin@wpm.local', user_metadata: { full_name: 'Ana Admin' } } },
  rpcHandler = async () => ({ data: null, error: null }),
  signInResult = null,
} = {}) {
  const rpc = vi.fn(rpcHandler);
  const signOut = vi.fn(async () => ({ error: null }));
  const signInWithPassword = vi.fn(async () => signInResult || ({ data: { session }, error: null }));
  const client = {
    from: vi.fn((table) => new FakeQuery(tables[table] || [])),
    rpc,
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      signInWithPassword,
      signOut,
      onAuthStateChange: vi.fn(),
    },
  };
  return client;
}

function buildStore() {
  const period = {
    settings: { team: ['Ana'], receptionists: ['Ana'], professors: ['Caio'], addonTypes: ['Whey'], monthDays: 31 },
    students: [{ id: 's1', nome: 'Aluno', atendimento: 'Ana', addon: 'Whey' }],
    pending: [],
    recados: [],
    nps: { score: 80, monthlyGoal: 75, semesterGoal: 80, mentions: [], rankSnapshot: {} },
    scale: [],
    events: [],
    addons: { Ana: { Whey: [1] } },
  };
  normalizeData(period);
  return {
    version: 4,
    activePeriod: '2026-05',
    preferences: { initializeMonthsWithTestData: false },
    periods: { '2026-05': period },
    archives: {},
  };
}

function createGlobalEnv(overrides = {}) {
  return {
    __APP_ENV__: {
      SUPABASE_URL: 'https://fake.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_UNIT_SLUG: '',
      ...overrides,
    },
  };
}

function membershipRows() {
  return [
    {
      id: 'member-reader',
      display_name: 'Leitor',
      role: 'professor',
      active: true,
      unit: { id: 'unit-b', name: 'B Unidade', slug: 'b', timezone: 'America/Sao_Paulo', active: true },
    },
    {
      id: 'member-front',
      display_name: 'Bia',
      role: 'recepcao',
      active: true,
      unit: { id: 'unit-a', name: 'A Unidade', slug: 'a', timezone: 'America/Sao_Paulo', active: true },
    },
    {
      id: 'member-admin',
      display_name: 'Ana',
      role: 'admin',
      active: true,
      unit: { id: 'unit-z', name: 'Z Unidade', slug: 'z', timezone: 'America/Sao_Paulo', active: true },
    },
  ];
}

function remoteTables() {
  return {
    unit_members: membershipRows(),
    periods: [
      { id: 'period-04', unit_id: 'unit-z', period_key: '2026-04', label: 'Abril/2026', status: 'closed', closed_at: '2026-04-30T20:00:00.000Z' },
      { id: 'period-05', unit_id: 'unit-z', period_key: '2026-05', label: 'Maio/2026', status: 'open', closed_at: null },
    ],
    period_settings: [
      { period_id: 'period-05', team_snapshot: ['Ana', 'Caio'], reception_snapshot: ['Ana'], professor_snapshot: ['Caio'], month_days: 31 },
    ],
    addon_types: [
      { period_id: 'period-05', name: 'Whey', sort_order: 1 },
    ],
    student_attendances: [
      {
        id: 'student-1',
        period_id: 'period-05',
        student_name: 'Aluno',
        membership_number: '123',
        last_visit_date: '2026-05-02',
        last_visit_time: '10:00',
        started_at_date: '2026-05-02',
        nps_notice_status: 'Sim',
        receptionist_name_snapshot: 'Ana',
        feedback_status: 'Respondeu',
        addon_type_snapshot: 'Whey',
        notes: 'ok',
      },
    ],
    addon_sales: [
      { period_id: 'period-05', sale_date: '2026-05-02', receptionist_name_snapshot: 'Ana', addon_type_snapshot: 'Whey', quantity: 2 },
      { period_id: 'period-05', sale_date: '2026-05-99', receptionist_name_snapshot: 'Ana', addon_type_snapshot: 'Whey', quantity: 99 },
    ],
    pending_items: [
      { id: 'pending-1', period_id: 'period-05', student_name: 'Aluno', membership_number: '123', description: 'Contrato', requested_at_date: '2026-05-03', assignee_name_snapshot: 'Ana', response: '', status: 'aberto' },
    ],
    shift_notes: [
      { id: 'note-1', period_id: 'period-05', from_name_snapshot: 'Ana', to_audience: 'Todos', message: 'Aviso', created_at: '2026-05-02T10:00:00.000Z' },
    ],
    nps_period_metrics: [
      { period_id: 'period-05', score: 88, monthly_goal: 80, semester_goal: 85, observations: 'Bom' },
    ],
    nps_mentions: [
      { id: 'mention-1', period_id: 'period-05', name_snapshot: 'Recepcao', count: 3, rank_position: 1 },
    ],
    scale_days: [
      { id: 'scale-1', period_id: 'period-05', scale_date: '2026-05-02', row_tone: 'green', reception_time: '08:00', receptionist_name_snapshot: 'Ana', reception_swap: '', note: '' },
    ],
    scale_professor_shifts: [
      { id: 'shift-1', scale_day_id: 'scale-1', time_label: '09:00', professor_name_snapshot: 'Caio', swap_name_snapshot: '', sort_order: 1 },
      { id: 'shift-out', scale_day_id: 'other-scale', time_label: '10:00', professor_name_snapshot: 'Outro', swap_name_snapshot: '', sort_order: 1 },
    ],
    events: [
      { id: 'event-1', period_id: 'period-05', event_date: '2026-05-04', event_time: '14:00', type: 'Evento', title: 'Aula', place: 'Sala', owner_name_snapshot: 'Caio', status: 'Programado', description: 'Desc' },
    ],
  };
}

describe('reconstruction Supabase adapter', () => {
  it('normaliza checkpoints e seleciona membership por slug ou prioridade', () => {
    expect(normalizeSupabaseCheckpoint({ revision: 'r1', period_count: 1, audit_count: 2 })).toMatchObject({
      revision: 'r1',
      periodCount: 1,
      auditCount: 2,
    });
    expect(isEmptySupabaseCheckpoint({ revision: '', periodCount: 0, auditCount: 0 })).toBe(true);
    expect(selectActiveSupabaseMembership(membershipRows().map((item) => ({
      membershipId: item.id,
      role: item.role,
      active: item.active,
      unitId: item.unit.id,
      unitName: item.unit.name,
      unitSlug: item.unit.slug,
      unitActive: item.unit.active,
    })), 'a')).toMatchObject({ unitSlug: 'a', role: 'recepcao' });
    expect(shouldSyncSupabaseImmediately('close-month-backup')).toBe(true);
    expect(shouldSyncSupabaseImmediately('typing')).toBe(false);
  });

  it('fica offline sem env ou sem SDK e cria client singleton quando habilitado', () => {
    const offline = createSupabaseAdapter({ globalLike: { __APP_ENV__: {} } });
    expect(offline.isSupabaseEnabled()).toBe(false);
    expect(offline.getSupabaseClient()).toBeNull();
    expect(offline.getSupabaseStatus()).toMatchObject({ enabled: false, reason: 'env-missing', sessionStatus: 'offline' });

    const client = createFakeClient();
    const factory = vi.fn(() => client);
    const adapter = createSupabaseAdapter({ globalLike: createGlobalEnv(), clientFactory: factory });

    expect(adapter.isSupabaseEnabled()).toBe(true);
    expect(adapter.getSupabaseClient()).toBe(client);
    expect(adapter.getSupabaseClient()).toBe(client);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('atualiza estado autenticado, unidade ativa e permissao de escrita', async () => {
    const client = createFakeClient({ tables: { unit_members: membershipRows() } });
    const adapter = createSupabaseAdapter({
      globalLike: createGlobalEnv({ SUPABASE_UNIT_SLUG: 'a' }),
      clientFactory: () => client,
    });

    const state = await adapter.refreshSupabaseBackendState();

    expect(state).toMatchObject({
      sessionStatus: 'authenticated',
      writable: false,
      activeUnit: { unitId: 'unit-a', unitSlug: 'a', role: 'recepcao' },
    });
    expect(state.memberships).toHaveLength(3);
  });

  it('reconstroi store remoto com archives, tabelas operacionais e checkpoint', async () => {
    const checkpoints = [
      { revision: 'loaded', maxUpdatedAt: '2026-05-02T20:00:00.000Z', periodCount: 2, auditCount: 1 },
    ];
    const client = createFakeClient({
      tables: remoteTables(),
      rpcHandler: async (fn) => {
        if (fn === 'get_unit_sync_checkpoint') return { data: checkpoints[0], error: null };
        return { data: null, error: null };
      },
    });
    const adapter = createSupabaseAdapter({
      globalLike: createGlobalEnv({ SUPABASE_UNIT_SLUG: 'z' }),
      clientFactory: () => client,
      now: () => '2026-05-02T20:00:00.000Z',
    });

    const store = await adapter.loadStoreFromSupabase(buildStore());

    expect(store.activePeriod).toBe('2026-05');
    expect(store.archives['2026-04']).toMatchObject({ label: 'Abril/2026' });
    expect(store.periods['2026-05'].students[0]).toMatchObject({ nome: 'Aluno', addon: 'Whey' });
    expect(store.periods['2026-05'].pending[0]).toMatchObject({ pendencia: 'Contrato' });
    expect(store.periods['2026-05'].nps).toMatchObject({ score: 88, monthlyGoal: 80, semesterGoal: 85 });
    expect(store.periods['2026-05'].scale[0].professorShifts).toHaveLength(1);
    expect(store.periods['2026-05'].addons.Ana.Whey[1]).toBe(2);
    expect(adapter.getSupabaseBackendState()).toMatchObject({
      source: 'supabase',
      syncStatus: 'idle',
      lastRemoteCheckpoint: { revision: 'loaded', periodCount: 2, auditCount: 1 },
    });
  });

  it('sincroniza via RPC guardada quando backend esta vazio e memoriza novo checkpoint', async () => {
    const emptyCheckpoint = { revision: '', maxUpdatedAt: '', periodCount: 0, auditCount: 0 };
    const syncedCheckpoint = { revision: 'synced', maxUpdatedAt: '2026-05-02T20:00:00.000Z', periodCount: 12, auditCount: 1 };
    const rpc = vi.fn(async (fn, params) => {
      if (fn === 'get_unit_sync_checkpoint') {
        return {
          data: rpc.mock.calls.filter((call) => call[0] === 'get_unit_sync_checkpoint').length === 1
            ? emptyCheckpoint
            : syncedCheckpoint,
          error: null,
        };
      }
      if (fn === 'import_backup_transaction_guarded') {
        expect(params).toMatchObject({
          p_unit_id: 'unit-z',
          p_expected_checkpoint: emptyCheckpoint,
          p_preview_accepted: true,
        });
        expect(params.p_payload.meta.kind).toBe('app-backup');
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    });
    const client = createFakeClient({ tables: { unit_members: membershipRows() }, rpcHandler: rpc });
    const adapter = createSupabaseAdapter({
      globalLike: createGlobalEnv({ SUPABASE_UNIT_SLUG: 'z' }),
      clientFactory: () => client,
      now: () => '2026-05-02T20:00:00.000Z',
    });

    const result = await adapter.saveStoreToSupabase(buildStore());

    expect(result).toMatchObject({ ok: true, checkpoint: syncedCheckpoint });
    expect(adapter.getSupabaseBackendState()).toMatchObject({ source: 'supabase', syncStatus: 'idle' });
    expect(client.rpc).toHaveBeenCalledWith('import_backup_transaction_guarded', expect.any(Object));
  });

  it('bloqueia overwrite quando remoto tem dados sem baseline local', async () => {
    const populatedCheckpoint = { revision: 'remote', maxUpdatedAt: '2026-05-01T20:00:00.000Z', periodCount: 1, auditCount: 0 };
    const client = createFakeClient({
      tables: { unit_members: membershipRows() },
      rpcHandler: async (fn) => {
        if (fn === 'get_unit_sync_checkpoint') return { data: populatedCheckpoint, error: null };
        return { data: { ok: true }, error: null };
      },
    });
    const adapter = createSupabaseAdapter({
      globalLike: createGlobalEnv({ SUPABASE_UNIT_SLUG: 'z' }),
      clientFactory: () => client,
    });

    const result = await adapter.saveStoreToSupabase(buildStore());

    expect(result).toMatchObject({ ok: false, skipped: true, conflict: true, reason: 'remote-baseline-missing' });
    expect(client.rpc).not.toHaveBeenCalledWith('import_backup_transaction_guarded', expect.any(Object));
    expect(adapter.getSupabaseBackendState()).toMatchObject({ syncStatus: 'conflict', conflictStatus: 'baseline-missing' });
  });

  it('marca conflito detectado quando a RPC retorna divergencia de checkpoint', async () => {
    const emptyCheckpoint = { revision: '', maxUpdatedAt: '', periodCount: 0, auditCount: 0 };
    const client = createFakeClient({
      tables: { unit_members: membershipRows() },
      rpcHandler: async (fn) => {
        if (fn === 'get_unit_sync_checkpoint') return { data: emptyCheckpoint, error: null };
        if (fn === 'import_backup_transaction_guarded') {
          return { data: null, error: new Error('WPM_SYNC_CONFLICT: checkpoint remoto divergente; recarregue do backend antes de sincronizar.') };
        }
        return { data: null, error: null };
      },
    });
    const adapter = createSupabaseAdapter({
      globalLike: createGlobalEnv({ SUPABASE_UNIT_SLUG: 'z' }),
      clientFactory: () => client,
    });

    const result = await adapter.saveStoreToSupabase(buildStore());

    expect(result).toMatchObject({ ok: false, conflict: true, reason: 'remote-conflict' });
    expect(adapter.getSupabaseBackendState()).toMatchObject({ syncStatus: 'conflict', conflictStatus: 'detected' });
  });

  it('recarrega store remoto e limpa estado ao sair da sessao', async () => {
    let persisted = null;
    const client = createFakeClient({
      tables: remoteTables(),
      rpcHandler: async (fn) => {
        if (fn === 'get_unit_sync_checkpoint') return { data: { revision: 'loaded', periodCount: 2, auditCount: 1 }, error: null };
        return { data: null, error: null };
      },
    });
    const adapter = createSupabaseAdapter({
      globalLike: createGlobalEnv({ SUPABASE_UNIT_SLUG: 'z' }),
      clientFactory: () => client,
      loadStore: vi.fn(async () => buildStore()),
      saveStore: vi.fn(async (store) => {
        persisted = store;
        return true;
      }),
      syncAppState: vi.fn(async () => true),
      renderAll: vi.fn(),
      syncPeriodControls: vi.fn(),
    });

    await expect(adapter.reloadAppFromSupabaseSession({ showToast: false })).resolves.toBe(true);
    expect(persisted.periods['2026-05'].students[0].nome).toBe('Aluno');

    await expect(adapter.signOutSupabase()).resolves.toMatchObject({ ok: true });
    expect(adapter.getSupabaseBackendState()).toMatchObject({
      sessionStatus: 'anonymous',
      activeUnit: null,
      writable: false,
      source: 'local',
      lastRemoteCheckpoint: null,
    });
  });
});
