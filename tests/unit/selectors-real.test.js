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

    app.window.__APP_INTERNALS__.domain.limparCacheSelectores();
    const third = app.window.__APP_INTERNALS__.domain.selecionarRankingNps();
    expect(third).not.toBe(first);
  });
});
