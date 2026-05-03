import { describe, expect, it, vi } from 'vitest';

import {
  STORE_VERSION,
  migrateStore,
  normalizeData,
  prepareStoreCandidate,
  readStoredStore,
  sanitizeStore,
  seedYear,
} from '../../src/reconstruction/schema-migrations.js';

const noSeedOptions = {
  date: new Date('2026-05-02T12:00:00Z'),
  defaults: { initializeMonthsWithTestData: false },
};

describe('reconstruction schema migrations', () => {
  it('migra store legado single-period para AppStore V4 normalizado', () => {
    const store = prepareStoreCandidate({
      settings: { team: ['Ana'], addonTypes: ['Whey'], monthDays: 31 },
      students: [
        {
          nome: 'Aluno teste',
          matricula: 'A-123',
          atendimento: 'Ana',
          addon: 'Whey',
          inicio: '2026-05-03',
        },
      ],
    }, noSeedOptions);

    expect(store.version).toBe(STORE_VERSION);
    expect(store.activePeriod).toBe('2026-05');
    expect(store.periods['2026-05'].students[0].matricula).toBe('123');
    expect(store.periods['2026-05'].addons.Ana.Whey[2]).toBe(1);
  });

  it('descarta periodos invalidos e completa os 12 meses do ano ativo', () => {
    const store = prepareStoreCandidate({
      version: 3,
      activePeriod: '2026-07',
      preferences: { initializeMonthsWithTestData: false },
      periods: {
        invalido: { students: [{}] },
        '2026-07': {
          settings: { receptionists: ['Bia'], addonTypes: ['Plano'] },
          escala: [{ data: '2026-07-02' }],
          eventos: [{ titulo: 'Acao comercial' }],
        },
      },
    }, noSeedOptions);

    expect(store.version).toBe(STORE_VERSION);
    expect(store.periods.invalido).toBeUndefined();
    expect(Object.keys(store.periods)).toHaveLength(12);
    expect(store.periods['2026-07'].scale[0].date).toBe('2026-07-02');
    expect(store.periods['2026-07'].events[0].title).toBe('Acao comercial');
  });

  it('rejeita versao futura sem downgrade', () => {
    expect(migrateStore({ version: STORE_VERSION + 1, periods: {} })).toBeNull();
  });

  it('preserva JSON corrompido via callback antes de retornar null', async () => {
    const preserveCorrupted = vi.fn();

    await expect(readStoredStore('{', { preserveCorrupted })).resolves.toBeNull();

    expect(preserveCorrupted).toHaveBeenCalledTimes(1);
    expect(preserveCorrupted.mock.calls[0][0]).toContain('_corrompido_');
    expect(preserveCorrupted.mock.calls[0][1]).toBe('{');
  });

  it('expõe normalizacao de PeriodData para campos legados', () => {
    const period = {
      settings: {},
      students: [],
      pending: [],
      escala: [{ data: '2026-05-04', professor: 'Joao' }],
      eventos: [{ titulo: 'Evento legado' }],
      nps: { score: 900, mentions: [{ nome: 'Recepcao', citacoes: 2 }] },
    };

    normalizeData(period);

    expect(period.nps.score).toBe(100);
    expect(period.nps.mentions[0]).toMatchObject({ name: 'Recepcao', count: 2 });
    expect(period.scale[0]).toMatchObject({ date: '2026-05-04' });
    expect(period.events[0]).toMatchObject({ title: 'Evento legado' });
  });

  it('seedYear cria 12 periodos e sanitizeStore preserva a versao informada', () => {
    expect(Object.keys(seedYear(2026, { withTestData: false, defaults: { initializeMonthsWithTestData: false } }))).toHaveLength(12);
    expect(sanitizeStore({ version: 4, activePeriod: '2026-01', periods: { '2026-01': {} } }).version).toBe(4);
  });
});
