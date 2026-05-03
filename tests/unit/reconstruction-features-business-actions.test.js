import { describe, expect, it, vi } from 'vitest';

import {
  CSV_BOM,
  applyEventSave,
  applyPendingSave,
  applyStudentSave,
  buildCsvContent,
  buildMigrationStoreSnapshot,
  compareMigrationSnapshots,
  createBusinessActionsRuntime,
  getEventsCsvRows,
  getMigrationReadiness,
  getPendingCsvRows,
  getScaleCsvRows,
  normalizeNumericId,
  validateEvent,
  validatePending,
  validateStudent,
} from '../../src/reconstruction/features-business-actions.js';
import { normalizeData } from '../../src/reconstruction/schema-migrations.js';

function buildPeriod(overrides = {}) {
  const period = {
    settings: {
      team: ['Ana', 'Caio'],
      receptionists: ['Ana'],
      professors: ['Caio'],
      addonTypes: ['Whey', 'Creatina'],
      monthDays: 31,
    },
    students: [
      {
        id: 'student-1',
        nome: 'Aluno Um',
        matricula: '123',
        inicio: '2026-05-02',
        ultimaVisita: '',
        atendimento: 'Ana',
        feedback: 'Respondeu',
        avisoNps: 'Sim',
        addon: 'Whey',
        observacoes: '',
      },
    ],
    pending: [
      { id: 'pending-1', nome: 'Aluno', matricula: '123', pendencia: 'Contrato', data: '2026-05-03', hostess: 'Ana', resposta: '', status: 'aberto' },
    ],
    recados: [{ id: 'note-1', from: 'Ana', to: 'Todos', text: 'Aviso', createdAt: '2026-05-02T10:00:00.000Z' }],
    nps: {
      score: 80,
      monthlyGoal: 75,
      semesterGoal: 80,
      observations: '',
      mentions: [{ id: 'mention-1', name: 'Ana', count: 2 }],
      rankSnapshot: {},
    },
    scale: [
      {
        id: 'scale-1',
        date: '2026-05-02',
        rowTone: 'green',
        professorShifts: [
          { id: 'shift-1', time: '09:00', name: 'Caio', swap: '' },
          { id: 'shift-2', time: '10:00', name: 'Bia', swap: 'Leo' },
        ],
        receptionTime: '08:00',
        receptionist: 'Ana',
        receptionSwap: '',
        note: '',
      },
    ],
    events: [
      { id: 'event-1', date: '2026-05-04', time: '14:00', type: 'Evento', title: 'Aula', place: 'Sala', owner: 'Caio', status: 'Programado', description: '' },
    ],
    addons: { Ana: { Whey: [0, 1], Creatina: [0, 0] } },
    ...overrides,
  };
  normalizeData(period);
  return period;
}

function buildStorage(period = buildPeriod()) {
  return {
    version: 4,
    activePeriod: '2026-05',
    preferences: { initializeMonthsWithTestData: false },
    periods: { '2026-05': period },
    archives: {},
  };
}

describe('reconstruction features business actions', () => {
  it('valida matricula, obrigatorios e datas dentro do periodo ativo', () => {
    expect(normalizeNumericId('ABC-123.45')).toBe('12345');
    expect(validateStudent({ nome: '', rawMatricula: '123', matricula: '123' })).toMatchObject({
      isValid: false,
      errors: { nome: expect.any(String) },
    });
    expect(validateStudent({ nome: 'Aluno', rawMatricula: '12A', matricula: '12' })).toMatchObject({
      isValid: false,
      errors: { matricula: expect.any(String) },
    });
    expect(validatePending({ nome: 'Aluno', pendencia: 'Contrato', data: '2026-06-01' }, { currentPeriodKey: '2026-05' })).toMatchObject({
      isValid: false,
      errors: { data: expect.any(String) },
    });
    expect(validateEvent({ date: '2026-05-02', title: 'Evento' }, { currentPeriodKey: '2026-05' })).toMatchObject({ isValid: true });
  });

  it('aplica saves puros de aluno, pendencia e evento sem persistir diretamente', () => {
    const period = buildPeriod();
    const studentResult = applyStudentSave(period, {
      id: 'student-2',
      nome: 'Novo',
      rawMatricula: '987',
      matricula: '987',
      inicio: '2026-05-05',
      atendimento: 'Ana',
      feedback: 'Pendente',
      avisoNps: 'Sim',
      addon: '',
    });

    expect(studentResult).toMatchObject({ ok: true, entity: { id: 'student-2', nome: 'Novo' } });
    expect(studentResult.nextState.students[0]).toMatchObject({ id: 'student-2' });

    const pendingResult = applyPendingSave(period, {
      id: 'pending-2',
      nome: 'Aluno',
      rawMatricula: '',
      matricula: '',
      pendencia: 'Biometria',
      data: '2026-05-06',
      hostess: 'Ana',
      status: 'aberto',
    }, null, { currentPeriodKey: '2026-05' });
    expect(pendingResult.nextState.pending[0]).toMatchObject({ id: 'pending-2', pendencia: 'Biometria' });

    const eventResult = applyEventSave(period, {
      id: 'event-2',
      date: '2026-05-01',
      time: '09:00',
      title: 'Antes',
      type: 'Evento',
      status: 'Programado',
    }, null, { currentPeriodKey: '2026-05' });
    expect(eventResult.nextState.events.map((item) => item.id)).toEqual(['event-2', 'event-1']);
  });

  it('executa CRUD transacional com rollback quando saveData falha', async () => {
    const renders = [];
    const toasts = [];
    const runtime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      saveData: vi.fn(async () => false),
      getPendingFormData: () => ({
        id: 'pending-2',
        nome: 'Aluno',
        rawMatricula: '',
        matricula: '',
        pendencia: 'Nova',
        data: '2026-05-10',
        hostess: 'Ana',
        status: 'aberto',
      }),
      clearSelectorCache: vi.fn(),
      requestRender: (target) => renders.push(target),
      showToast: (message, type) => toasts.push({ message, type }),
    });

    const result = await runtime.savePending();

    expect(result).toMatchObject({ ok: false, rolledBack: true, reason: 'save-failed' });
    expect(runtime.getState().pending).toHaveLength(1);
    expect(runtime.getState().pending[0]).toMatchObject({ id: 'pending-1' });
    expect(runtime.getStorage().periods['2026-05'].pending).toHaveLength(1);
    expect(renders).toContainEqual(['hero', 'dashboard', 'pending']);
    expect(toasts.at(-1)).toMatchObject({ type: 'danger' });
  });

  it('salva aluno ajustando contador de addon anterior e novo', async () => {
    const runtime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      saveData: vi.fn(async () => true),
      getStudentFormData: () => ({
        id: 'student-1',
        nome: 'Aluno Um',
        rawMatricula: '123',
        matricula: '123',
        inicio: '2026-05-03',
        atendimento: 'Ana',
        feedback: 'Respondeu',
        avisoNps: 'Sim',
        addon: 'Creatina',
      }),
    });

    const result = await runtime.saveStudent();
    const addons = runtime.getState().addons.Ana;

    expect(result).toMatchObject({ ok: true, entity: { addon: 'Creatina' } });
    expect(addons.Whey[1]).toBe(0);
    expect(addons.Creatina[2]).toBe(1);
  });

  it('exige confirmacao para evento duplicado antes de persistir', async () => {
    const confirmations = [];
    const saveData = vi.fn(async () => true);
    const runtime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      saveData,
      getEventFormData: () => ({
        id: 'event-2',
        date: '2026-05-04',
        time: '14:00',
        type: 'Evento',
        title: 'aula',
        status: 'Programado',
      }),
      showConfirm: (message, onConfirm) => {
        confirmations.push(message);
        return onConfirm();
      },
    });

    const result = await runtime.saveEventItem();

    expect(confirmations[0]).toMatch(/mesmo titulo/);
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true });
  });

  it('gerencia ranking NPS com soma case-insensitive, clamp e rename', async () => {
    const runtime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      saveData: vi.fn(async () => true),
      createId: () => 'mention-2',
    });

    await expect(runtime.registerMention({ name: 'ana', count: 3 })).resolves.toMatchObject({ ok: true });
    expect(runtime.getState().nps.mentions.find((item) => item.id === 'mention-1')).toMatchObject({ count: 5 });

    await expect(runtime.adjustMention('mention-1', -99)).resolves.toMatchObject({ ok: true, count: 0 });
    await expect(runtime.setMentionCount('mention-1', 4)).resolves.toMatchObject({ ok: true, count: 4 });
    await expect(runtime.renameMention('mention-1', 'Ana Paula')).resolves.toMatchObject({ ok: true, name: 'Ana Paula' });
    await expect(runtime.saveNpsObservations('Observacao')).resolves.toMatchObject({ ok: true });
    expect(runtime.getState().nps).toMatchObject({ observations: 'Observacao' });
    expect(runtime.getState().nps.rankSnapshot).toHaveProperty('mention-1');
  });

  it('gera CSV com BOM, ordenacao e expansao de turnos de escala', () => {
    const period = buildPeriod({
      pending: [
        { id: 'p2', nome: 'B', pendencia: 'Depois', data: '2026-05-10' },
        { id: 'p1', nome: 'A', pendencia: 'Antes', data: '2026-05-01' },
      ],
    });
    const pendingRows = getPendingCsvRows(period);
    const scaleRows = getScaleCsvRows(period);
    const eventRows = getEventsCsvRows(period);
    const csv = buildCsvContent([['Nome', 'Obs'], ['Ana', 'Nota; importante']]);

    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('"Nota; importante"');
    expect(pendingRows[1][0]).toBe('A');
    expect(scaleRows).toHaveLength(3);
    expect(eventRows[0]).toEqual(['Data', 'Hora', 'Tipo', 'Titulo', 'Local', 'Responsavel', 'Status', 'Descricao']);
  });

  it('executa smoke diagnostics em clone sem alterar estado real', () => {
    const runtime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      requestRender: vi.fn(),
    });

    const report = runtime.runFlowSmokeTests(true);

    expect(report).toHaveLength(6);
    expect(report.find((item) => item.label === 'Reset do mes em simulacao')).toMatchObject({ status: 'ok' });
    expect(runtime.getState().students).toHaveLength(1);
    expect(runtime.getState().pending).toHaveLength(1);
  });

  it('calcula snapshot e readiness de migracao assistida', () => {
    const local = buildMigrationStoreSnapshot(buildStorage());
    const remote = buildMigrationStoreSnapshot(buildStorage(buildPeriod({ students: [] })));
    const comparison = compareMigrationSnapshots(local.periods, remote.periods);

    expect(local.totals.students).toBe(1);
    expect(comparison.matches).toBe(false);
    expect(getMigrationReadiness({
      local,
      remote,
      comparison,
      backend: { enabled: true, sessionStatus: 'authenticated', writable: true },
    })).toMatchObject({ canMigrate: false, reason: 'remote-mismatch' });
    expect(getMigrationReadiness({
      local,
      remote: null,
      comparison: null,
      backend: { enabled: true, sessionStatus: 'authenticated', writable: true, remoteState: 'empty' },
    })).toMatchObject({ canMigrate: true });
  });

  it('bloqueia ou executa migracao assistida conforme dry-run e sync', async () => {
    const blockedRuntime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      getSupabaseStatus: () => ({ enabled: true, sessionStatus: 'authenticated' }),
      getSupabaseBackendState: () => ({ sessionStatus: 'authenticated', writable: false, source: 'local' }),
    });
    await expect(blockedRuntime.runAssistedMigrationToSupabase()).resolves.toMatchObject({
      ok: false,
      skipped: true,
      reason: 'backend-unavailable',
    });

    const queueSupabaseStoreSync = vi.fn(async () => ({ ok: true }));
    const saveLocalSnapshot = vi.fn(async () => true);
    const reloadAppFromSupabaseSession = vi.fn(async () => true);
    const readyRuntime = createBusinessActionsRuntime({
      storage: buildStorage(),
      currentPeriodKey: '2026-05',
      getSupabaseStatus: () => ({ enabled: true, sessionStatus: 'authenticated' }),
      getSupabaseBackendState: () => ({ sessionStatus: 'authenticated', writable: true, source: 'local' }),
      loadStoreFromSupabase: vi.fn(async () => null),
      saveStore: vi.fn(async () => true),
      queueSupabaseStoreSync,
      saveLocalSnapshot,
      reloadAppFromSupabaseSession,
    });

    await expect(readyRuntime.runAssistedMigrationToSupabase()).resolves.toMatchObject({ ok: true });
    expect(saveLocalSnapshot).toHaveBeenCalledTimes(1);
    expect(queueSupabaseStoreSync).toHaveBeenCalledWith(expect.any(Object), { immediate: true });
    expect(reloadAppFromSupabaseSession).toHaveBeenCalledWith({ showToast: false });
  });
});
