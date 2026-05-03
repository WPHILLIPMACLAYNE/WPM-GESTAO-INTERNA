import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  USER_FLOW_IDS,
  createEmptyPeriod,
  createUserFlowsRuntime,
  periodHasMeaningfulData,
} from '../../src/reconstruction/user-flows.js';

function buildPeriod(overrides = {}) {
  const period = createEmptyPeriod('2026-05', {
    settings: {
      team: ['Wallace', 'Ana', 'Caio'],
      receptionists: ['Wallace', 'Ana'],
      professors: ['Caio'],
      addonTypes: ['Energy', 'Whey'],
    },
    nps: { monthlyGoal: 75, semesterGoal: 80 },
  });
  return {
    ...period,
    ...overrides,
    settings: { ...period.settings, ...(overrides.settings || {}) },
    nps: { ...period.nps, ...(overrides.nps || {}) },
    addons: overrides.addons || period.addons,
  };
}

function buildStorage(period = buildPeriod()) {
  return {
    version: 4,
    activePeriod: '2026-05',
    periods: { '2026-05': period },
    archives: {},
    preferences: {},
  };
}

describe('reconstruction user flows', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('declara as quatro user stories reconstruidas', () => {
    expect(USER_FLOW_IDS).toEqual(['US-WPM-001', 'US-WPM-002', 'US-WPM-003', 'US-WPM-004']);
  });

  it('executa fluxo de atendimento com addon, filtros e compensacao na edicao', async () => {
    const runtime = createUserFlowsRuntime({ storage: buildStorage(), currentPeriodKey: '2026-05' });

    const created = await runtime.saveStudent({
      id: 'student-1',
      nome: 'Alice Audit',
      rawMatricula: '12345',
      inicio: '2026-05-05',
      atendimento: 'Wallace',
      feedback: 'Respondeu',
      addon: 'Energy',
      observacoes: 'Lead quente',
    });

    expect(created).toMatchObject({ ok: true, entity: { id: 'student-1', nome: 'Alice Audit' } });
    expect(runtime.getState().students).toHaveLength(1);
    expect(runtime.getState().addons.Wallace.Energy[4]).toBe(1);
    expect(runtime.renders).toContainEqual(['hero', 'dashboard', 'students', 'addons']);
    expect(runtime.filterStudents({ search: 'alice' })).toHaveLength(1);
    expect(runtime.filterStudents({ atendimento: 'Wallace', feedback: 'Respondeu' })).toHaveLength(1);

    const edited = await runtime.saveStudent({
      id: 'student-1',
      nome: 'Alice Audit',
      rawMatricula: '12345',
      inicio: '2026-05-06',
      atendimento: 'Wallace',
      feedback: 'Respondeu',
      addon: 'Whey',
    }, created.entity);

    expect(edited).toMatchObject({ ok: true, entity: { id: 'student-1', addon: 'Whey' } });
    expect(runtime.getState().addons.Wallace.Energy[4]).toBe(0);
    expect(runtime.getState().addons.Wallace.Whey[5]).toBe(1);
  });

  it('bloqueia atendimento invalido e faz rollback se persistencia falhar', async () => {
    const saveData = vi.fn(async () => false);
    const runtime = createUserFlowsRuntime({ storage: buildStorage(), currentPeriodKey: '2026-05', saveData });

    await expect(runtime.saveStudent({ id: 'bad', nome: '', rawMatricula: '', atendimento: 'Wallace' }))
      .resolves.toMatchObject({ ok: false, validation: { nome: 'Preencha ao menos o nome do aluno.' } });
    await expect(runtime.saveStudent({ id: 'bad', nome: 'Aluno', rawMatricula: '12A', atendimento: 'Wallace' }))
      .resolves.toMatchObject({ ok: false, validation: { matricula: expect.any(String) } });

    const failed = await runtime.saveStudent({
      id: 'student-rollback',
      nome: 'Rollback',
      rawMatricula: '123',
      inicio: '2026-05-05',
      atendimento: 'Wallace',
      addon: 'Energy',
    });

    expect(failed).toMatchObject({ ok: false, rolledBack: true, reason: 'save-failed' });
    expect(runtime.getState().students).toHaveLength(0);
    expect(runtime.getState().addons.Wallace.Energy[4]).toBe(0);
    expect(runtime.toasts.at(-1)).toMatchObject({ type: 'danger' });
  });

  it('fecha mes aberto, baixa archive, abre proximo periodo e bloqueia mes fechado', async () => {
    const storage = buildStorage(buildPeriod({
      students: [{ id: 'student-1', nome: 'Alice' }],
    }));
    const runtime = createUserFlowsRuntime({
      storage,
      currentPeriodKey: '2026-05',
      now: '2026-05-31T20:00:00.000Z',
    });

    const result = await runtime.closeCurrentMonth();

    expect(result).toMatchObject({ ok: true, nextKey: '2026-06', activePeriod: '2026-06' });
    expect(runtime.downloads[0]).toMatchObject({
      filename: 'smartfit-fechamento-2026-05.json',
      payload: { meta: { kind: 'month-archive' }, periodKey: '2026-05' },
    });
    expect(storage.archives['2026-05']).toMatchObject({ closedAt: '2026-05-31T20:00:00.000Z', label: '2026-05' });
    expect(storage.activePeriod).toBe('2026-06');
    expect(runtime.isWritable('2026-05')).toBe(false);
    expect(periodHasMeaningfulData(storage.periods['2026-06'])).toBe(false);
  });

  it('reverte archive e periodo ativo quando fechamento falha ao persistir', async () => {
    const storage = buildStorage(buildPeriod({ students: [{ id: 'student-1', nome: 'Alice' }] }));
    const runtime = createUserFlowsRuntime({
      storage,
      currentPeriodKey: '2026-05',
      saveData: vi.fn(async () => false),
    });

    const result = await runtime.closeCurrentMonth();

    expect(result).toMatchObject({ ok: false, rolledBack: true });
    expect(storage.archives['2026-05']).toBeUndefined();
    expect(storage.activePeriod).toBe('2026-05');
    expect(runtime.currentPeriodKey).toBe('2026-05');
  });

  it('sincroniza Supabase com checkpoint, bloqueia baseline ausente e preserva reload explicito', async () => {
    const importGuarded = vi.fn(async () => ({
      nextCheckpoint: { revision: 'next', maxUpdatedAt: '2026-05-02T10:00:00Z', periodCount: 1, auditCount: 1 },
    }));
    const runtime = createUserFlowsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      supabaseEnabled: true,
      supabaseWritable: true,
      unitId: 'unit-1',
      source: 'local',
      importBackupTransactionGuarded: importGuarded,
      now: '2026-05-02T10:00:00Z',
    });

    const blocked = await runtime.syncStoreToSupabase({
      remoteCheckpoint: { revision: 'remote', maxUpdatedAt: 'x', periodCount: 1, auditCount: 0 },
      baselineCheckpoint: null,
    });

    expect(blocked).toMatchObject({ ok: false, conflict: true, reason: 'remote-baseline-missing' });
    expect(importGuarded).not.toHaveBeenCalled();

    const synced = await runtime.syncStoreToSupabase({
      remoteCheckpoint: { revision: 'base', maxUpdatedAt: 'x', periodCount: 1, auditCount: 0 },
      baselineCheckpoint: { revision: 'base', maxUpdatedAt: 'x', periodCount: 1, auditCount: 0 },
      eventType: 'close-month-backup',
    });

    expect(synced).toMatchObject({ ok: true, source: 'supabase', checkpoint: { revision: 'next' } });
    expect(importGuarded).toHaveBeenCalledWith(expect.objectContaining({
      p_unit_id: 'unit-1',
      p_payload: expect.objectContaining({ meta: { kind: 'app-backup', exportedAt: '2026-05-02T10:00:00Z' } }),
      p_expected_checkpoint: expect.objectContaining({ revision: 'base' }),
      immediate: true,
    }));

    const remoteStore = {
      version: 4,
      activePeriod: '2026-06',
      periods: { '2026-06': buildPeriod({ students: [{ id: 'remote', nome: 'Backend' }] }) },
      archives: { '2026-05': { closedAt: '2026-05-31T00:00:00Z', label: '2026-05' } },
      preferences: {},
    };
    runtime.reloadFromSupabase(remoteStore);
    expect(runtime.currentPeriodKey).toBe('2026-06');
    expect(runtime.getState().students[0]).toMatchObject({ nome: 'Backend' });
  });

  it('executa pendencias com Kanban e CSV', async () => {
    const runtime = createUserFlowsRuntime({ storage: buildStorage(), currentPeriodKey: '2026-05' });

    const saved = await runtime.savePending({
      id: 'pending-1',
      nome: 'Alice',
      rawMatricula: '123',
      pendencia: 'Contrato',
      data: '2026-05-03',
      hostess: 'Wallace',
      status: 'aberto',
    });
    expect(saved).toMatchObject({ ok: true, entity: { status: 'aberto' } });

    const moved = await runtime.updatePendingStatus('pending-1', 'respondido');
    expect(moved).toMatchObject({ ok: true, entity: { status: 'respondido' } });
    const csv = runtime.exportPendingCsv();
    expect(csv).toContain('Alice;123;Contrato;2026-05-03;Wallace;;respondido');
    await expect(runtime.savePending({ nome: '', pendencia: '' })).resolves.toMatchObject({ ok: false });
  });

  it('executa NPS com clamp, debounce de observacoes e mencao case-insensitive', async () => {
    vi.useFakeTimers();
    const runtime = createUserFlowsRuntime({
      storage: buildStorage(buildPeriod({ nps: { mentions: [{ id: 'mention-1', name: 'Wallace', count: 1 }] } })),
      currentPeriodKey: '2026-05',
    });

    await expect(runtime.updateNpsScore(172)).resolves.toMatchObject({ ok: true, score: 100 });
    const observationPromise = runtime.saveNpsObservations('Texto NPS', { debounceMs: 800 });
    vi.advanceTimersByTime(800);
    await expect(observationPromise).resolves.toMatchObject({ ok: true, observations: 'Texto NPS' });
    await expect(runtime.registerNpsMention('wallace', 2)).resolves.toMatchObject({ ok: true });

    expect(runtime.getState().nps.score).toBe(100);
    expect(runtime.getState().nps.observations).toBe('Texto NPS');
    expect(runtime.getState().nps.mentions).toHaveLength(1);
    expect(runtime.getState().nps.mentions[0]).toMatchObject({ name: 'Wallace', count: 3 });
    expect(runtime.getState().nps.rankSnapshot).toEqual({ 'mention-1': 1 });
  });

  it('valida escala e salva dia ordenado com ao menos um turno', async () => {
    const runtime = createUserFlowsRuntime({ storage: buildStorage(), currentPeriodKey: '2026-05' });

    await expect(runtime.saveScaleDay({ date: '2026-06-01', professorShifts: [{ time: '09:00', name: 'Caio' }] }))
      .resolves.toMatchObject({ ok: false, validation: { date: expect.any(String) } });
    await expect(runtime.saveScaleDay({ date: '2026-05-03', professorShifts: [] }))
      .resolves.toMatchObject({ ok: false, validation: { professorShifts: 'Adicione pelo menos uma linha de professor.' } });

    await runtime.saveScaleDay({ id: 'scale-2', date: '2026-05-10', professorShifts: [{ time: '10:00', name: 'Caio' }] });
    await runtime.saveScaleDay({ id: 'scale-1', date: '2026-05-05', professorShifts: [{ time: '09:00', name: 'Caio' }] });

    expect(runtime.getState().scale.map((day) => day.id)).toEqual(['scale-1', 'scale-2']);
  });

  it('trata eventos duplicados, confirmacao, duplicacao e rollback de exclusao', async () => {
    const runtime = createUserFlowsRuntime({ storage: buildStorage(), currentPeriodKey: '2026-05' });

    await runtime.saveEvent({ id: 'event-1', date: '2026-05-04', time: '14:00', title: 'Aula coletiva' });
    const duplicateBlocked = await runtime.saveEvent({ id: 'event-2', date: '2026-05-04', time: '14:00', title: 'aula coletiva' });
    expect(duplicateBlocked).toMatchObject({ ok: false, confirmationRequired: true });
    expect(runtime.confirmations).toHaveLength(1);

    await expect(runtime.saveEvent({ id: 'event-2', date: '2026-05-04', time: '14:00', title: 'Aula coletiva' }, { confirmDuplicate: true }))
      .resolves.toMatchObject({ ok: true });
    await expect(runtime.duplicateEvent('event-1')).resolves.toMatchObject({ ok: true, entity: { status: 'Programado' } });
    expect(runtime.getState().events).toHaveLength(3);

    const failingRuntime = createUserFlowsRuntime({
      storage: buildStorage(buildPeriod({ events: [{ id: 'event-1', date: '2026-05-04', title: 'Aula' }] })),
      currentPeriodKey: '2026-05',
      saveData: vi.fn(async () => false),
    });
    await expect(failingRuntime.deleteEvent('event-1')).resolves.toMatchObject({ ok: false, rolledBack: true });
    expect(failingRuntime.getState().events).toHaveLength(1);
  });

  it('bloqueia mutacoes quando periodo esta fechado ou sessao esta read-only', async () => {
    const storage = buildStorage();
    storage.archives['2026-05'] = { closedAt: '2026-05-31T00:00:00Z', label: '2026-05' };
    const runtime = createUserFlowsRuntime({ storage, currentPeriodKey: '2026-05' });

    await expect(runtime.savePending({ nome: 'Alice', pendencia: 'Contrato' }))
      .resolves.toMatchObject({ ok: false, reason: 'locked' });
    expect(runtime.toasts.at(-1)).toMatchObject({ type: 'warning' });

    const readonlyRuntime = createUserFlowsRuntime({ storage: buildStorage(), currentPeriodKey: '2026-05', supabaseReadonly: true });
    await expect(readonlyRuntime.saveEvent({ date: '2026-05-04', title: 'Evento' }))
      .resolves.toMatchObject({ ok: false, reason: 'locked' });
  });
});
