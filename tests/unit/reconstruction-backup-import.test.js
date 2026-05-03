import { describe, expect, it, vi } from 'vitest';

import {
  applyImportedStore,
  attachPayloadIntegrity,
  buildBackupPayloadFromStore,
  buildImportPreview,
  buildMonthArchivePayload,
  coerceImportedStore,
  extractImportedPayload,
  getBackupSummary,
  getImportedPayloadDescriptor,
  parseImportedJsonText,
  validateImportFile,
  verifyPayloadIntegrity,
} from '../../src/reconstruction/backup-import.js';
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
    students: [{ id: 's1', nome: 'Aluno', matricula: '123', atendimento: 'Ana', feedback: 'Respondeu', avisoNps: 'Sim' }],
    pending: [{ id: 'p1', nome: 'Aluno', matricula: '123', pendencia: 'Contrato', data: '2026-05-02', hostess: 'Ana', status: 'aberto' }],
    recados: [{ id: 'r1', from: 'Ana', to: 'Todos', text: 'Aviso', createdAt: '2026-05-02T10:00:00Z' }],
    nps: { score: 80, monthlyGoal: 75, semesterGoal: 80, mentions: [{ id: 'n1', name: 'Recepcao', count: 2 }], rankSnapshot: {} },
    scale: [{ id: 'e1', date: '2026-05-02', professorShifts: [{ id: 'ps1', name: 'Caio' }], receptionist: 'Ana' }],
    events: [{ id: 'ev1', date: '2026-05-03', title: 'Evento', status: 'Programado' }],
    addons: { Ana: { Whey: [1, 2] } },
    ...overrides,
  };
  normalizeData(period);
  return period;
}

function buildStore(overrides = {}) {
  const store = {
    version: 4,
    activePeriod: '2026-05',
    preferences: { initializeMonthsWithTestData: false },
    periods: {
      '2026-05': buildPeriod(),
      '2026-04': buildPeriod({ students: [], pending: [], events: [], scale: [], addons: { Ana: { Whey: [1] } } }),
    },
    archives: {},
    ...overrides,
  };
  return store;
}

describe('reconstruction backup import', () => {
  it('gera backup completo com meta, resumo e integridade verificavel', () => {
    const payload = buildBackupPayloadFromStore(buildStore(), { exportedAt: '2026-05-02T19:00:00.000Z' });

    expect(payload.meta).toMatchObject({
      kind: 'app-backup',
      appVersion: 'v34',
      sourceAppId: 'wpm-gestao-interna',
      exportedAt: '2026-05-02T19:00:00.000Z',
      integrity: expect.objectContaining({
        algorithm: 'canonical-sha256-v1',
        hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    });
    expect(verifyPayloadIntegrity(payload)).toMatchObject({ ok: true, reason: 'verified' });
    expect(getBackupSummary(payload)).toMatchObject({ periods: 12, students: 1, pending: 1, events: 1, scale: 1 });
  });

  it('valida arquivo de importacao por tamanho e formato', () => {
    expect(validateImportFile(null)).toMatchObject({ ok: false, reason: 'missing-file' });
    expect(validateImportFile({ name: 'backup.txt', type: 'text/plain', size: 10 })).toMatchObject({ ok: false, reason: 'invalid-format' });
    expect(validateImportFile({ name: 'backup.json', type: '', size: 51 * 1024 * 1024 })).toMatchObject({ ok: false, reason: 'file-too-large' });
    expect(validateImportFile({ name: 'backup.json', type: '', size: 10 })).toMatchObject({ ok: true });
  });

  it('extrai wrapper payload, parseia JSON e classifica formatos reconhecidos', () => {
    const payload = buildBackupPayloadFromStore(buildStore());
    const wrapped = { payload };

    expect(parseImportedJsonText(JSON.stringify(wrapped))).toMatchObject({ ok: true });
    expect(parseImportedJsonText('{')).toMatchObject({ ok: false, reason: 'invalid-json' });
    expect(extractImportedPayload(wrapped)).toEqual(payload);
    expect(getImportedPayloadDescriptor(wrapped)).toMatchObject({ kind: 'full-backup', periodCount: 12, hasIntegrity: true });

    const monthArchive = buildMonthArchivePayload(buildStore(), '2026-05', 'Maio/2026');
    expect(getImportedPayloadDescriptor(monthArchive)).toMatchObject({ kind: 'month-archive', periodKey: '2026-05' });
    expect(getImportedPayloadDescriptor(buildPeriod())).toMatchObject({ kind: 'legacy-period' });
  });

  it('mescla month-archive preservando demais periodos e marcando archive', () => {
    const baseStore = buildStore();
    const archivedPeriod = buildPeriod({ students: [{ id: 'new', nome: 'Novo', atendimento: 'Ana' }] });
    const monthArchive = buildMonthArchivePayload({
      ...baseStore,
      periods: { ...baseStore.periods, '2026-04': archivedPeriod },
    }, '2026-04', 'Abril/2026', { exportedAt: '2026-05-02T19:00:00.000Z' });

    const coerced = coerceImportedStore(monthArchive, baseStore);

    expect(coerced.periods['2026-05'].students[0].id).toBe('s1');
    expect(coerced.periods['2026-04'].students[0].id).toBe('new');
    expect(coerced.archives['2026-04']).toMatchObject({ label: 'Abril/2026' });
  });

  it('encapsula payload legado no periodo inicial informado', () => {
    const legacy = buildPeriod();
    const coerced = coerceImportedStore(legacy, buildStore(), { currentPeriodKey: '2026-08' });

    expect(coerced.activePeriod).toBe('2026-08');
    expect(coerced.periods['2026-08'].students).toHaveLength(1);
  });

  it('gera preview granular e bloqueia backup completo destrutivo sem aceite', async () => {
    const baseStore = buildStore();
    const imported = buildBackupPayloadFromStore({
      ...buildStore(),
      activePeriod: '2026-06',
      periods: {
        '2026-06': buildPeriod({ students: [{ id: 'june', nome: 'Junho', atendimento: 'Ana' }] }),
      },
      archives: {},
    });
    const preview = buildImportPreview(imported, baseStore);

    expect(preview.requiresGranularPreview).toBe(true);
    expect(preview.periodChanges.find((item) => item.periodKey === '2026-04')?.action).toBe('replaced');
    expect(preview.periodChanges.find((item) => item.periodKey === '2026-06')?.action).toBe('replaced');

    await expect(applyImportedStore(imported, {
      baseStore,
      preview,
      saveStore: vi.fn(),
    })).rejects.toThrow(/preview granular/);
  });

  it('bloqueia backup completo com hash adulterado', async () => {
    const baseStore = buildStore();
    const imported = buildBackupPayloadFromStore(buildStore());
    imported.periods['2026-05'].students.push({ id: 'evil', nome: 'Alterado' });

    await expect(applyImportedStore(imported, {
      baseStore,
      previewAccepted: true,
      saveStore: vi.fn(),
    })).rejects.toThrow(/hash-mismatch/);
  });

  it('aplica importacao valida com backup preventivo e callbacks de sincronizacao', async () => {
    const baseStore = buildStore();
    const imported = attachPayloadIntegrity(buildBackupPayloadFromStore({
      ...baseStore,
      periods: {
        ...baseStore.periods,
        '2026-05': buildPeriod({ students: [{ id: 'new', nome: 'Novo', atendimento: 'Ana' }] }),
      },
    }));
    let persisted = null;
    const runtime = {
      baseStore,
      previewAccepted: true,
      exportPreventiveBackup: vi.fn(async () => true),
      saveStore: vi.fn(async (store) => {
        persisted = store;
        return true;
      }),
      readStoredStore: vi.fn(async () => persisted),
      syncAppState: vi.fn(async () => true),
      renderAll: vi.fn(),
      syncPeriodControls: vi.fn(),
      runSystemDiagnostics: vi.fn(),
    };

    const summary = await applyImportedStore(imported, runtime);

    expect(summary.students).toBe(1);
    expect(runtime.exportPreventiveBackup).toHaveBeenCalledTimes(1);
    expect(runtime.saveStore).toHaveBeenCalledTimes(1);
    expect(runtime.syncAppState).toHaveBeenCalledWith(persisted);
    expect(runtime.renderAll).toHaveBeenCalledTimes(1);
    expect(runtime.syncPeriodControls).toHaveBeenCalledTimes(1);
    expect(runtime.runSystemDiagnostics).toHaveBeenCalledWith(true);
  });
});
