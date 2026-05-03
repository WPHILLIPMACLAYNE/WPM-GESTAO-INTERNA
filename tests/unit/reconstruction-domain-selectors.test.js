import { describe, expect, it } from 'vitest';

import { normalizeData } from '../../src/reconstruction/schema-migrations.js';
import { createDomainSelectors, SELECTOR_CACHE_LIMIT } from '../../src/reconstruction/domain-selectors.js';

function buildPeriod(overrides = {}) {
  const period = {
    settings: {
      team: ['Ana', 'Bia'],
      receptionists: ['Ana', 'Bia'],
      professors: ['Caio'],
      addonTypes: ['Whey', 'Plano'],
      monthDays: 31,
    },
    students: [
      { id: 's1', nome: 'Aluno Um', matricula: '1', atendimento: 'Ana', feedback: 'Respondeu', avisoNps: 'Sim', addon: 'Whey', inicio: '2026-05-03' },
      { id: 's2', nome: 'Aluno Dois', matricula: '2', atendimento: 'Ana', feedback: 'Pendente', avisoNps: 'Não', addon: '', inicio: '2026-05-04' },
      { id: 's3', nome: 'Aluno Tres', matricula: '3', atendimento: 'Bia', feedback: 'Não respondeu', avisoNps: 'Sim', addon: 'Plano', inicio: '2026-05-05' },
    ],
    pending: [
      { id: 'p1', nome: 'Maria Silva', matricula: '10', pendencia: 'Contrato', data: '2026-05-02', hostess: 'Ana', resposta: '', status: 'aberto' },
      { id: 'p2', nome: 'Joao Lima', matricula: '11', pendencia: 'Pagamento', data: '2026-05-03', hostess: 'Bia', resposta: 'Resolvido', status: 'respondido' },
      { id: 'p3', nome: 'Clara', matricula: '12', pendencia: 'Cadastro', data: '2026-05-01', hostess: 'Ana', resposta: '', status: 'concluido' },
    ],
    nps: {
      score: 82,
      monthlyGoal: 75,
      semesterGoal: 80,
      observations: '',
      mentions: [
        { id: 'n1', name: 'Recepcao', count: 10 },
        { id: 'n2', name: 'Limpeza', count: 4 },
        { id: 'n3', name: 'Aulas', count: 7 },
      ],
      rankSnapshot: { n1: 2, n2: 1 },
    },
    scale: [
      { id: 'e1', date: '2026-05-02', rowTone: 'green', professorShifts: [{ id: 'ps1', time: '08:00', name: 'Caio', swap: '' }], receptionTime: '07:00', receptionist: 'Ana', receptionSwap: '', note: '' },
      { id: 'e2', date: '2026-05-04', rowTone: 'red', professorShifts: [{ id: 'ps2', time: '09:00', name: '', swap: 'Troca' }], receptionTime: '', receptionist: '', receptionSwap: 'Cobrir', note: '' },
    ],
    events: [
      { id: 'ev1', date: '2026-05-02', time: '10:00', type: 'Evento', title: 'Aulao', place: 'Sala 1', owner: 'Ana', status: 'Confirmado', description: '' },
      { id: 'ev2', date: '2026-05-06', time: '09:00', type: 'Campanha', title: 'Renovacao', place: 'Recepcao', owner: 'Bia', status: 'Programado', description: '' },
      { id: 'ev3', date: '2026-05-07', time: '09:00', type: 'Evento', title: 'Cancelado', place: '', owner: '', status: 'Cancelado', description: '' },
    ],
    addons: {
      Ana: { Whey: [1, 2, 0], Plano: [0, 1] },
      Bia: { Whey: [0, 0], Plano: [3] },
    },
    ...overrides,
  };

  normalizeData(period);
  return period;
}

function buildRuntime(overrides = {}) {
  const current = buildPeriod(overrides.state || {});
  const april = buildPeriod({
    students: [{ id: 'old', nome: 'Antigo', atendimento: 'Ana', feedback: 'Respondeu', avisoNps: 'Sim' }],
    addons: { Ana: { Whey: [5] }, Bia: { Plano: [1] } },
    nps: { score: 70, monthlyGoal: 75, semesterGoal: 80, mentions: [{ id: 'old-nps', name: 'Ana', count: 3 }], rankSnapshot: {} },
  });
  const march = buildPeriod({
    students: [],
    addons: { Bia: { Plano: [4] } },
    nps: { score: 60, monthlyGoal: 75, semesterGoal: 80, mentions: [{ id: 'old-nps-2', name: 'Bia', count: 5 }], rankSnapshot: {} },
  });
  const storage = {
    activePeriod: '2026-05',
    archives: {},
    periods: {
      '2026-03': march,
      '2026-04': april,
      '2026-05': current,
      '2026-06': buildPeriod(),
    },
  };

  return createDomainSelectors({
    state: current,
    storage,
    currentPeriodKey: '2026-05',
    today: '2026-05-03',
    now: new Date('2026-05-10T12:00:00Z'),
    ...overrides,
  });
}

describe('reconstruction domain selectors', () => {
  it('memoiza por periodo e assinatura e limita crescimento do cache', () => {
    const selectors = buildRuntime();

    const first = selectors.selecionarRankingNps();
    const second = selectors.selecionarRankingNps();
    expect(second).toBe(first);

    for (let index = 0; index <= SELECTOR_CACHE_LIMIT + 5; index += 1) {
      selectors.lerSelectorMemorizado(`manual-${index}`, String(index), () => index);
    }

    expect(selectors.cacheSelectores.size).toBeLessThanOrEqual(SELECTOR_CACHE_LIMIT);
  });

  it('calcula totais de addons e indicadores principais do dashboard', () => {
    const selectors = buildRuntime();
    const totais = selectors.selecionarTotaisAddons();
    const indicadores = selectors.selecionarIndicadoresDashboard();

    expect(totais.totalGeral).toBe(7);
    expect(totais.porPessoa).toEqual({ Ana: 4, Bia: 3 });
    expect(indicadores.totalAlunos).toBe(3);
    expect(indicadores.totalPendencias).toBe(3);
    expect(indicadores.npsAtual).toBe(82);
    expect(indicadores.liderAddonNome).toBe('Ana');
    expect(indicadores.percentualMetaMensal).toBe(100);
    expect(indicadores.proximoEvento?.id).toBe('ev2');
  });

  it('calcula resumo de recepcionistas com taxas de feedback e addon', () => {
    const selectors = buildRuntime();
    const resumo = selectors.selecionarResumoRecepcionistas();

    expect(resumo.find((item) => item.nome === 'Ana')).toMatchObject({
      total: 2,
      comFeedback: 1,
      addon: 4,
      positivos: 1,
    });
    expect(resumo.find((item) => item.nome === 'Bia')).toMatchObject({
      total: 1,
      comFeedback: 1,
      addon: 3,
      positivos: 0,
    });
  });

  it('ordena ranking NPS e calcula tendencias contra snapshot', () => {
    const selectors = buildRuntime();
    const ranking = selectors.selecionarRankingNps();

    expect(ranking.totalCitacoes).toBe(21);
    expect(ranking.ranking.map((item) => item.id)).toEqual(['n1', 'n3', 'n2']);
    expect(ranking.ranking[0].tendencia.classe).toBe('trend-up');
    expect(ranking.ranking[1].tendencia.classe).toBe('trend-new');
    expect(ranking.ranking[2].tendencia.classe).toBe('trend-down');
    expect(selectors.totalNpsMentions()).toBe(21);
  });

  it('resume e filtra pendencias por busca textual normalizada', () => {
    const selectors = buildRuntime({ pendingFilters: { query: 'contrato' } });
    const resumo = selectors.selecionarResumoPendencias();
    const filtradas = selectors.selecionarPendenciasFiltradas();

    expect(resumo.contagens).toEqual({ aberto: 1, respondido: 1, concluido: 1 });
    expect(resumo.maisAntigaAberta?.id).toBe('p1');
    expect(filtradas.linhas.map((item) => item.id)).toEqual(['p1']);
    expect(filtradas.grupos.aberto).toHaveLength(1);
    expect(selectors.getOldestOpenPending()?.id).toBe('p1');
  });

  it('agrupa eventos, resume escala e monta historico/graficos', () => {
    const selectors = buildRuntime({ eventFilters: { statusFilter: 'Confirmado' } });
    const eventos = selectors.selecionarDadosEventosAgrupados();
    const escala = selectors.selecionarResumoEscala();
    const historico = selectors.selecionarHistoricoDashboard(3);
    const graficos = selectors.selecionarDadosGraficosDashboard(3);

    expect(eventos.total).toBe(1);
    expect(eventos.porDia.get(2)).toHaveLength(1);
    expect(eventos.confirmados).toBe(1);
    expect(escala).toMatchObject({ diasEscalados: 2, recepcaoCoberta: 1, professoresLancados: 1, trocasOuAtencao: 2 });
    expect(historico.map((item) => item.key)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(graficos.historico).toHaveLength(3);
    expect(graficos.addonRanking[0]).toEqual({ label: 'Ana', value: 4 });
  });

  it('retorna lideres historicos apenas de periodos anteriores', () => {
    const selectors = buildRuntime();
    const lideres = selectors.selecionarLideresHistoricos();

    expect(lideres.map((item) => item.key)).toEqual(['2026-04', '2026-03']);
    expect(lideres[0].addonLeader).toEqual({ name: 'Ana', total: 5 });
    expect(lideres[1].npsLeader).toEqual({ name: 'Bia', total: 5 });
  });
});
