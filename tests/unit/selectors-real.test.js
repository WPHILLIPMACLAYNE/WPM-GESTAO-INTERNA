import { afterEach, describe, expect, it } from 'vitest';
import { loadRealApp } from '../helpers/load-real-app.js';

let cleanup = () => {};

afterEach(() => {
  cleanup();
  cleanup = () => {};
});

async function createSeededApp(periodKey = '2026-07') {
  const app = await loadRealApp();
  cleanup = app.cleanup;

  const store = {
    version: app.window.__APP_INTERNALS__.config.STORE_VERSION,
    activePeriod: periodKey,
    periods: {
      [periodKey]: app.window.generatePeriodSeed(periodKey)
    },
    archives: {}
  };

  await app.setStore(store);
  return app;
}

describe('Seletores reais do app modularizado', () => {
  it('bootstrap em localhost ativa seed por padrão e respeita o toggle para meses novos', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const storageKey = app.window.__APP_INTERNALS__.config.STORAGE_KEY;
    await app.window.initializeApp();
    let currentStore = app.window.__APP_INTERNALS__.persistence.readStoredJson(storageKey);
    if (!currentStore) {
      currentStore = await app.window.__APP_INTERNALS__.persistence.loadStore();
    }

    expect(app.window.__APP_INTERNALS__.config.APP_RUNTIME).toBe('development');
    expect(app.window.__APP_INTERNALS__.config.DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA).toBe(true);
    expect(currentStore.preferences.initializeMonthsWithTestData).toBe(true);
    expect(currentStore.periods[currentStore.activePeriod].students).toHaveLength(30);

    await app.setStore({
      version: app.window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: '2026-04',
      preferences: { initializeMonthsWithTestData: false },
      periods: {
        '2026-04': app.window.buildCleanPeriodFromTemplate(null, '2026-04')
      },
      archives: {}
    });

    await app.window.__APP_INTERNALS__.actions.switchPeriod('2026-05', { silent: true });
    let nextStore = app.window.__APP_INTERNALS__.persistence.readStoredJson(storageKey);
    expect(nextStore.preferences.initializeMonthsWithTestData).toBe(false);
    expect(nextStore.periods['2026-05'].students).toHaveLength(0);
    expect(nextStore.periods['2026-05'].pending).toHaveLength(0);

    nextStore.preferences.initializeMonthsWithTestData = true;
    await app.setStore(nextStore);
    await app.window.__APP_INTERNALS__.actions.switchPeriod('2027-01', { silent: true });
    nextStore = app.window.__APP_INTERNALS__.persistence.readStoredJson(storageKey);
    expect(nextStore.preferences.initializeMonthsWithTestData).toBe(true);
    expect(nextStore.periods['2027-01'].students).toHaveLength(30);
    expect(nextStore.periods['2027-01'].pending).toHaveLength(20);
    expect(nextStore.periods['2027-01'].events).toHaveLength(10);
  });

  it('generatePeriodSeed() cria a massa determinística esperada por mês', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const july = app.window.generatePeriodSeed('2026-07');
    const august = app.window.generatePeriodSeed('2026-08');
    const julyAgain = app.window.generatePeriodSeed('2026-07');

    expect(july.students).toHaveLength(30);
    expect(july.pending).toHaveLength(20);
    expect(july.nps.mentions).toHaveLength(11);
    expect(july.scale).toHaveLength(31);
    expect(july.events).toHaveLength(10);
    expect(july.settings.monthDays).toBe(31);

    expect(august.students).toHaveLength(30);
    expect(august.pending).toHaveLength(20);
    expect(august.events).toHaveLength(10);

    expect(july).not.toBe(julyAgain);
    expect(july.students.every(student => String(student.inicio).startsWith('2026-07-'))).toBe(true);
    expect(august.students.every(student => String(student.inicio).startsWith('2026-08-'))).toBe(true);
    expect(july.pending.every(item => String(item.data).startsWith('2026-07-'))).toBe(true);
    expect(august.events.every(item => String(item.date).startsWith('2026-08-'))).toBe(true);

    const mentionIds = july.nps.mentions.map(item => item.id).sort();
    const snapshotIds = Object.keys(july.nps.rankSnapshot).sort();
    const expectedSnapshot = Object.fromEntries(
      july.nps.mentions
        .slice()
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
        .map((item, index) => [item.id, index + 1])
    );
    expect(snapshotIds).toEqual(mentionIds);
    expect(july.nps.rankSnapshot).toEqual(expectedSnapshot);
  });

  it('selecionarTotaisAddons() e selecionarIndicadoresDashboard() derivam KPIs consistentes', async () => {
    const app = await createSeededApp('2026-07');
    const period = app.window.__APP_INTERNALS__.persistence
      .readStoredJson(app.window.__APP_INTERNALS__.config.STORAGE_KEY)
      .periods['2026-07'];

    const totais = app.window.__APP_INTERNALS__.domain.selecionarTotaisAddons();
    const indicadores = app.window.__APP_INTERNALS__.domain.selecionarIndicadoresDashboard();

    const totalBruto = Object.values(period.addons || {}).reduce((acc, byType) => (
      acc + Object.values(byType || {}).reduce((typeAcc, days) => (
        typeAcc + (days || []).reduce((dayAcc, value) => dayAcc + Number(value || 0), 0)
      ), 0)
    ), 0);

    expect(indicadores.totalAlunos).toBe(30);
    expect(indicadores.totalPendencias).toBe(20);
    expect(indicadores.npsAtual).toBe(period.nps.score);
    expect(totais.totalGeral).toBe(totalBruto);
    expect(Object.keys(totais.porPessoa)).toHaveLength(period.settings.receptionists.length);
  });

  it('selecionarHistoricoDashboard() consolida a janela cronológica dos últimos 6 meses', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    await app.setStore({
      version: app.window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: '2026-07',
      periods: {
        '2026-05': app.window.generatePeriodSeed('2026-05'),
        '2026-07': app.window.generatePeriodSeed('2026-07')
      },
      archives: {}
    });
    await app.window.__APP_INTERNALS__.actions.switchPeriod('2026-07', { silent: true });

    const historico = app.window.__APP_INTERNALS__.domain.selecionarHistoricoDashboard();

    expect(historico).toHaveLength(6);
    expect(historico.map(item => item.key)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07'
    ]);
    expect(historico.at(-1).key).toBe('2026-07');
    expect(historico.find(item => item.key === '2026-05')?.totalAlunos).toBe(30);
    expect(historico.find(item => item.key === '2026-07')?.totalAlunos).toBe(30);
  });

  it('selecionarPendenciasFiltradas() usa o estado de UI real para filtrar por busca', async () => {
    const app = await createSeededApp('2026-07');
    const period = app.window.__APP_INTERNALS__.persistence
      .readStoredJson(app.window.__APP_INTERNALS__.config.STORAGE_KEY)
      .periods['2026-07'];
    const target = period.pending[0];
    const query = app.window.normalizeSearchText(String(target.nome).split(' ')[0]);

    await app.window.writeStoredJson(
      app.window.__APP_INTERNALS__.config.UI_KEY,
      { pendingSearch: query }
    );
    app.window.__APP_INTERNALS__.domain.limparCacheSelectores();

    const filtered = app.window.__APP_INTERNALS__.domain.selecionarPendenciasFiltradas();

    expect(filtered.linhas.length).toBeGreaterThan(0);
    expect(filtered.linhas.length).toBeLessThan(period.pending.length);
    expect(filtered.linhas.some(item => item.id === target.id)).toBe(true);
  });

  it('selecionarRankingNps() ordena o ranking e memoiza por assinatura', async () => {
    const app = await createSeededApp('2026-07');

    const first = app.window.__APP_INTERNALS__.domain.selecionarRankingNps();
    const second = app.window.__APP_INTERNALS__.domain.selecionarRankingNps();

    expect(second).toBe(first);
    expect(first.ranking.length).toBeGreaterThan(0);
    expect(first.ranking[0].count).toBeGreaterThanOrEqual(first.ranking.at(-1).count);
    expect(first.totalCitacoes).toBe(
      first.ranking.reduce((acc, item) => acc + Number(item.count || 0), 0)
    );
    expect(first.ranking.every(item => item.tendencia.classe === 'trend-stable')).toBe(true);

    app.window.__APP_INTERNALS__.domain.limparCacheSelectores();
    const third = app.window.__APP_INTERNALS__.domain.selecionarRankingNps();
    expect(third).not.toBe(first);
  });

  it('normalizeData() corrige rankSnapshot legado sem ids de menção', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const legacyPeriod = app.window.generatePeriodSeed('2026-07');
    legacyPeriod.nps.rankSnapshot = Object.fromEntries(
      legacyPeriod.nps.mentions.map(item => [item.name, item.count])
    );

    await app.setStore({
      version: app.window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: '2026-07',
      periods: { '2026-07': legacyPeriod },
      archives: {}
    });

    const ranking = app.window.__APP_INTERNALS__.domain.selecionarRankingNps();
    const normalizedStore = app.window.__APP_INTERNALS__.persistence
      .readStoredJson(app.window.__APP_INTERNALS__.config.STORAGE_KEY);
    const normalizedSnapshot = normalizedStore.periods['2026-07'].nps.rankSnapshot;

    expect(Object.keys(normalizedSnapshot).sort()).toEqual(
      legacyPeriod.nps.mentions.map(item => item.id).sort()
    );
    expect(ranking.ranking.every(item => item.tendencia.classe === 'trend-stable')).toBe(true);
  });
});
