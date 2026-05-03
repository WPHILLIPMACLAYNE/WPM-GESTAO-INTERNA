import { describe, expect, it, vi } from 'vitest';

import {
  cloneScaleForPeriod,
  createMonthlyLifecycle,
  getNextPeriodKey,
  periodHasMeaningfulData,
} from '../../src/reconstruction/monthly-lifecycle.js';
import { normalizeData } from '../../src/reconstruction/schema-migrations.js';

function buildPeriod(overrides = {}) {
  const period = {
    settings: {
      team: ['Ana'],
      receptionists: ['Ana'],
      professors: ['Caio'],
      addonTypes: ['Whey'],
      monthDays: 31,
    },
    students: [{ id: 's1', nome: 'Aluno', atendimento: 'Ana', feedback: 'Respondeu', avisoNps: 'Sim' }],
    pending: [],
    recados: [],
    nps: { score: 80, monthlyGoal: 75, semesterGoal: 80, mentions: [], rankSnapshot: {} },
    scale: [],
    events: [],
    addons: { Ana: { Whey: [1] } },
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
      '2026-04': buildPeriod({
        scale: [
          { id: 'old-1', date: '2026-04-30', professorShifts: [{ id: 'old-shift', name: 'Caio' }], receptionist: 'Ana' },
        ],
      }),
      '2026-05': buildPeriod(),
    },
    archives: {},
    ...overrides,
  };
}

describe('reconstruction monthly lifecycle', () => {
  it('calcula proximo periodo e detecta dados operacionais', () => {
    expect(getNextPeriodKey('2026-12')).toBe('2027-01');
    expect(periodHasMeaningfulData(buildPeriod())).toBe(true);
    expect(periodHasMeaningfulData(buildPeriod({ students: [], pending: [], scale: [], events: [], nps: { score: 0, mentions: [] }, addons: {} }))).toBe(false);
  });

  it('fecha mes atual, gera month-archive, registra archive e avanca para o proximo mes', async () => {
    const saveStore = vi.fn(async () => true);
    const downloadMonthArchive = vi.fn(async () => true);
    const lifecycle = createMonthlyLifecycle({ storage: buildStore(), currentPeriodKey: '2026-05' });

    const result = await lifecycle.closePeriod({
      saveStore,
      downloadMonthArchive,
      closedAt: '2026-05-31T20:00:00.000Z',
      nextPeriodMode: 'preserve',
    });
    const { storage, currentPeriodKey } = lifecycle.getContext();

    expect(result.ok).toBe(true);
    expect(result.closedPeriodKey).toBe('2026-05');
    expect(result.nextPeriodKey).toBe('2026-06');
    expect(currentPeriodKey).toBe('2026-06');
    expect(storage.archives['2026-05']).toMatchObject({ closedAt: '2026-05-31T20:00:00.000Z', label: 'Maio/2026' });
    expect(storage.periods['2026-06']).toBeTruthy();
    expect(downloadMonthArchive).toHaveBeenCalledWith(expect.objectContaining({ periodKey: '2026-05' }), 'smartfit-fechamento-2026-05.json');
    expect(saveStore).toHaveBeenCalled();
  });

  it('reverte archive quando persistencia do fechamento falha', async () => {
    const lifecycle = createMonthlyLifecycle({ storage: buildStore(), currentPeriodKey: '2026-05' });

    const result = await lifecycle.closePeriod({
      saveStore: vi.fn(async () => false),
      downloadMonthArchive: vi.fn(async () => true),
      closedAt: '2026-05-31T20:00:00.000Z',
    });
    const { storage, currentPeriodKey } = lifecycle.getContext();

    expect(result).toMatchObject({ ok: false, reason: 'save-failed' });
    expect(storage.archives['2026-05']).toBeUndefined();
    expect(currentPeriodKey).toBe('2026-05');
  });

  it('bloqueia mutacoes em mes fechado e backend somente leitura', () => {
    const lifecycle = createMonthlyLifecycle({
      storage: buildStore({ archives: { '2026-05': { closedAt: '2026-05-31T20:00:00.000Z', closedAtLabel: '31/05/2026', label: 'Maio/2026' } } }),
      currentPeriodKey: '2026-05',
    });

    expect(lifecycle.canMutateCurrentPeriod()).toMatchObject({ ok: false, reason: 'period-locked' });
    expect(lifecycle.buildCurrentPeriodLockUiState()).toMatchObject({ locked: true });

    lifecycle.setContext({
      storage: buildStore(),
      currentPeriodKey: '2026-05',
      backendState: { source: 'supabase', sessionStatus: 'authenticated', writable: false, activeUnit: { role: 'auditor' } },
    });

    expect(lifecycle.canMutateCurrentPeriod()).toMatchObject({ ok: false, reason: 'backend-readonly' });
  });

  it('reabre mes fechado somente com autorizacao e motivo, registrando auditoria', async () => {
    const lifecycle = createMonthlyLifecycle({
      storage: buildStore({ archives: { '2026-05': { closedAt: '2026-05-31T20:00:00.000Z', closedAtLabel: '31/05/2026', label: 'Maio/2026' } } }),
      currentPeriodKey: '2026-05',
    });

    await expect(lifecycle.reopenPeriod('2026-05', { saveStore: vi.fn(async () => true) })).resolves.toMatchObject({ ok: false, reason: 'authorization-required' });
    await expect(lifecycle.reopenPeriod('2026-05', { authorized: true, saveStore: vi.fn(async () => true) })).resolves.toMatchObject({ ok: false, reason: 'reason-required' });

    const result = await lifecycle.reopenPeriod('2026-05', {
      authorized: true,
      reason: 'Correcao autorizada',
      reopenedBy: 'gestor',
      reopenedAt: '2026-06-02T10:00:00.000Z',
      saveStore: vi.fn(async () => true),
    });
    const { storage } = lifecycle.getContext();

    expect(result.ok).toBe(true);
    expect(storage.archives['2026-05']).toBeUndefined();
    expect(storage.reopenAudit[0]).toMatchObject({
      periodKey: '2026-05',
      reopenedBy: 'gestor',
      reason: 'Correcao autorizada',
    });
  });

  it('reseta periodo aberto depois de exportar backup, preservando configuracoes', async () => {
    const exportBackup = vi.fn(async () => true);
    const saveStore = vi.fn(async () => true);
    const lifecycle = createMonthlyLifecycle({ storage: buildStore(), currentPeriodKey: '2026-05' });

    const result = await lifecycle.resetPeriod({ exportBackup, saveStore });
    const { state } = lifecycle.getContext();

    expect(result.ok).toBe(true);
    expect(exportBackup).toHaveBeenCalledTimes(1);
    expect(saveStore).toHaveBeenCalledTimes(1);
    expect(state.students).toEqual([]);
    expect(state.settings.receptionists).toEqual(['Ana']);
  });

  it('duplica escala do mes anterior e ignora dias inexistentes no mes alvo', async () => {
    let id = 0;
    const { scale, skippedDays } = cloneScaleForPeriod([
      { id: 'a', date: '2026-01-31', professorShifts: [{ id: 's', name: 'Caio' }], receptionist: 'Ana' },
      { id: 'b', date: '2026-01-28', professorShifts: [{ id: 's2', name: 'Bia' }], receptionist: 'Bia' },
    ], '2026-02', () => `new-${id += 1}`);

    expect(skippedDays).toBe(1);
    expect(scale).toHaveLength(1);
    expect(scale[0]).toMatchObject({ id: 'new-1', date: '2026-02-28' });
    expect(scale[0].professorShifts[0].id).toBe('new-2');

    const lifecycle = createMonthlyLifecycle({
      storage: buildStore({
        activePeriod: '2026-05',
        periods: {
          '2026-04': buildPeriod({ scale: [{ id: 'apr', date: '2026-04-02', professorShifts: [{ id: 'shift', name: 'Caio' }], receptionist: 'Ana' }] }),
          '2026-05': buildPeriod({ scale: [] }),
        },
      }),
      currentPeriodKey: '2026-05',
    });
    const result = await lifecycle.duplicatePreviousMonthScale({
      saveStore: vi.fn(async () => true),
      createId: () => `copy-${id += 1}`,
    });

    expect(result).toMatchObject({ ok: true, copied: 1, skippedDays: 0 });
    expect(lifecycle.getContext().state.scale[0].date).toBe('2026-05-02');
  });
});
