import { describe, expect, it } from 'vitest';

import { buildBackupPayloadFromStore } from '../../src/reconstruction/backup-import.js';
import { normalizeData } from '../../src/reconstruction/schema-migrations.js';
import {
  WPM_SYNC_CONFLICT,
  createSupabaseRpcRuntime,
} from '../../src/reconstruction/supabase-database-rpcs.js';

function buildPeriod(overrides = {}) {
  const period = {
    settings: {
      team: ['Ana'],
      receptionists: ['Ana'],
      professors: ['Caio'],
      addonTypes: ['Whey', 'Creatina'],
      monthDays: 31,
    },
    students: [
      {
        id: 'student-1',
        nome: 'Aluno',
        matricula: '123',
        inicio: '2026-05-02',
        atendimento: 'Ana',
        feedback: 'Respondeu',
        avisoNps: 'Sim',
        addon: 'Whey',
      },
    ],
    pending: [],
    recados: [],
    nps: {
      score: 80,
      monthlyGoal: 77,
      semesterGoal: 83,
      mentions: [],
      rankSnapshot: {},
    },
    scale: [],
    events: [],
    addons: { Ana: { Whey: [1], Creatina: [0] } },
    ...overrides,
  };
  normalizeData(period);
  return period;
}

function buildStore(overrides = {}) {
  return {
    version: 4,
    activePeriod: '2026-05',
    preferences: { initializeMonthsWithTestData: false },
    periods: {
      '2026-05': buildPeriod(),
    },
    archives: {},
    ...overrides,
  };
}

function createRuntime(options = {}) {
  const runtime = createSupabaseRpcRuntime({
    actor: {
      userId: 'user-admin',
      authRole: 'authenticated',
      currentUser: 'authenticated',
    },
    clock: () => options.now || '2026-05-02T20:00:00.000Z',
    db: {
      units: [{ id: 'unit-1', slug: 'matriz', name: 'Matriz', active: true }],
      users: [{ id: 'user-admin' }, { id: 'user-front' }, { id: 'user-reader' }, { id: 'user-other' }],
      unitMembers: [
        { id: 'member-admin', unitId: 'unit-1', userId: 'user-admin', role: 'admin', displayName: 'Ana', active: true },
        { id: 'member-front', unitId: 'unit-1', userId: 'user-front', role: 'recepcao', displayName: 'Bia', active: true },
        { id: 'member-reader', unitId: 'unit-1', userId: 'user-reader', role: 'professor', displayName: 'Caio', active: true },
      ],
      periods: options.periods || [],
      auditEvents: [],
      addonSales: [],
      ...(options.db || {}),
    },
  });
  return runtime;
}

function upsertSeedPeriod(runtime, periodKey = '2026-05', data = buildPeriod(), archive = null) {
  return runtime.upsertPeriodFromImport('unit-1', periodKey, data, archive);
}

describe('reconstruction Supabase database RPCs', () => {
  it('aplica papeis de leitura/escrita e resolve membro por nome', () => {
    const runtime = createRuntime();

    expect(runtime.currentUnitRole('unit-1')).toBe('admin');
    expect(runtime.currentUnitMemberId('unit-1')).toBe('member-admin');
    expect(runtime.hasUnitRole('unit-1', ['admin'])).toBe(true);
    expect(runtime.resolveMemberId('unit-1', 'ana')).toBe('member-admin');

    runtime.setActor({ userId: 'user-reader' });
    expect(runtime.currentUnitRole('unit-1')).toBe('professor');
    expect(() => runtime.requireUnitRole('unit-1', ['admin', 'gestor'])).toThrow(/Permissao insuficiente/);

    runtime.setActor({ userId: null });
    expect(() => runtime.requireUnitRole('unit-1')).toThrow(/nao autenticado/);
  });

  it('importa backup completo somente com checkpoint, preview e integridade validos', async () => {
    const runtime = createRuntime();
    const payload = buildBackupPayloadFromStore(buildStore());

    await expect(runtime.importBackupTransactionGuarded('unit-1', payload, null, { previewAccepted: true })).resolves.toMatchObject({
      ok: true,
      kind: 'full-backup',
      previousCheckpoint: { revision: '', periodCount: 0, auditCount: 0 },
    });

    const nextCheckpoint = runtime.getUnitSyncCheckpoint('unit-1');
    expect(nextCheckpoint.periodCount).toBeGreaterThan(0);
    expect(nextCheckpoint.revision).not.toBe('');

    await expect(runtime.importBackupTransactionGuarded('unit-1', payload, null, { previewAccepted: true })).rejects.toMatchObject({
      code: WPM_SYNC_CONFLICT,
    });

    runtime.logAuditEvent('unit-1', null, 'member-admin', 'manual-change', 'store');
    await expect(runtime.importBackupTransactionGuarded('unit-1', payload, nextCheckpoint, { previewAccepted: true })).rejects.toMatchObject({
      code: WPM_SYNC_CONFLICT,
    });
  });

  it('bloqueia importacao destrutiva sem aceite de preview ou com hash adulterado', async () => {
    const runtime = createRuntime();
    upsertSeedPeriod(runtime, '2025-12', buildPeriod({ students: [{ id: 'old', nome: 'Antigo' }] }));
    const checkpoint = runtime.getUnitSyncCheckpoint('unit-1');
    const payload = buildBackupPayloadFromStore(buildStore());

    await expect(runtime.importBackupTransactionGuarded('unit-1', payload, checkpoint)).rejects.toMatchObject({
      code: 'WPM_IMPORT_GUARD',
      guard: expect.objectContaining({ reason: 'preview-required' }),
    });

    const tampered = buildBackupPayloadFromStore(buildStore());
    tampered.periods['2026-05'].students.push({ id: 'evil', nome: 'Alterado' });

    await expect(runtime.importBackupTransactionGuarded('unit-1', tampered, checkpoint, { previewAccepted: true })).rejects.toMatchObject({
      code: 'WPM_IMPORT_GUARD',
      guard: expect.objectContaining({ reason: 'hash-mismatch' }),
    });
  });

  it('fecha periodo, cria proximo mes e recusa segundo fechamento', () => {
    const runtime = createRuntime();
    upsertSeedPeriod(runtime);

    const result = runtime.closePeriodTransaction('unit-1', { periodKey: '2026-05' });
    const db = runtime.getDatabase();

    expect(result).toMatchObject({ ok: true, periodKey: '2026-05', nextPeriodKey: '2026-06', nextAction: 'created' });
    expect(db.periods.find((period) => period.periodKey === '2026-05')).toMatchObject({ status: 'closed' });
    expect(db.periods.find((period) => period.periodKey === '2026-06')).toMatchObject({ status: 'open' });
    expect(db.auditEvents.at(-1)).toMatchObject({ eventType: 'close-month', entityType: 'period' });
    expect(() => runtime.closePeriodTransaction('unit-1', { periodKey: '2026-05' })).toThrow(/ja esta fechado/);
  });

  it('reseta somente periodo aberto preservando metas de NPS', () => {
    const runtime = createRuntime();
    upsertSeedPeriod(runtime, '2026-05', buildPeriod({
      students: [{ id: 'keep-out', nome: 'Limpar' }],
      nps: { score: 20, monthlyGoal: 91, semesterGoal: 94, mentions: [], rankSnapshot: {} },
    }));
    upsertSeedPeriod(runtime, '2026-04', buildPeriod(), { closedAt: '2026-04-30T20:00:00.000Z', label: 'Abril/2026' });

    const result = runtime.resetPeriodTransaction('unit-1', { periodKey: '2026-05' });
    const opened = runtime.getDatabase().periods.find((period) => period.periodKey === '2026-05');

    expect(result).toMatchObject({ ok: true, monthlyGoal: 91, semesterGoal: 94 });
    expect(opened.data.students).toEqual([]);
    expect(opened.data.nps).toMatchObject({ monthlyGoal: 91, semesterGoal: 94 });
    expect(() => runtime.resetPeriodTransaction('unit-1', { periodKey: '2026-04' })).toThrow(/fechado/);
  });

  it('sincroniza venda de adicional derivada do atendimento do aluno', () => {
    const runtime = createRuntime();
    const period = upsertSeedPeriod(runtime);

    runtime.setActor({ userId: 'user-front' });
    const created = runtime.linkStudentAttendanceAddonTransaction('unit-1', 'student-1', '2026-05-03', 2);
    expect(created).toMatchObject({ ok: true, saleAction: 'created', quantity: 2 });
    expect(runtime.getDatabase().addonSales[0]).toMatchObject({
      periodId: period.id,
      attendanceId: 'student-1',
      addonTypeSnapshot: 'Whey',
      quantity: 2,
    });

    period.data.students[0].addon = 'Creatina';
    const updated = runtime.linkStudentAttendanceAddonTransaction('unit-1', 'student-1', null, 3);
    expect(updated).toMatchObject({ saleAction: 'updated', quantity: 3 });
    expect(runtime.getDatabase().addonSales[0]).toMatchObject({ addonTypeSnapshot: 'Creatina', quantity: 3 });

    period.data.students[0].addon = '';
    expect(runtime.linkStudentAttendanceAddonTransaction('unit-1', 'student-1')).toMatchObject({ saleAction: 'deleted' });
    expect(runtime.getDatabase().addonSales).toEqual([]);
  });

  it('executa bootstrap inicial somente como service_role e bloqueia segundo admin', () => {
    const runtime = createSupabaseRpcRuntime({
      actor: { userId: 'user-admin', authRole: 'authenticated', currentUser: 'authenticated' },
      clock: () => '2026-05-02T20:00:00.000Z',
      db: {
        users: [{ id: 'user-admin' }, { id: 'user-other' }],
      },
    });

    expect(() => runtime.bootstrapUnitAdmin({
      userId: 'user-admin',
      unitName: 'Matriz',
      unitSlug: 'matriz',
      displayName: 'Ana',
    })).toThrow(/service_role/);

    runtime.setActor({ authRole: 'service_role', currentUser: 'service_role' });
    expect(() => runtime.bootstrapUnitAdmin({
      userId: 'user-admin',
      unitName: 'Matriz',
      unitSlug: 'matriz',
      displayName: 'Ana',
      monthDays: 40,
    })).toThrow(/28 e 31/);

    const result = runtime.bootstrapUnitAdmin({
      userId: 'user-admin',
      unitName: 'Matriz',
      unitSlug: 'matriz',
      displayName: 'Ana',
      periodKey: '2026-05',
      monthDays: 31,
    });

    expect(result).toMatchObject({
      bootUnitId: expect.any(String),
      bootUnitMemberId: expect.any(String),
      bootPeriodId: expect.any(String),
    });
    expect(runtime.getDatabase().unitMembers[0]).toMatchObject({ role: 'admin', active: true });
    expect(runtime.getDatabase().periods[0]).toMatchObject({ periodKey: '2026-05', status: 'open' });

    expect(() => runtime.bootstrapUnitAdmin({
      userId: 'user-other',
      unitName: 'Matriz',
      unitSlug: 'matriz',
      displayName: 'Outra',
      periodKey: '2026-05',
    })).toThrow(/outro admin ativo/);
  });
});
