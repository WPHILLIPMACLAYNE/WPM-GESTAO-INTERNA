// Reconstructed Domain Selectors from Reversa Task 08.
// Pure selector runtime: derived KPIs, filters, rankings, history, and bounded memoization.

import { MONTH_NAMES_PT_BR } from './config-global-state.js';
import { getRiskBand } from './domain-entities.js';
import { getAddonPeople, getReceptionists, sortNpsMentionsByRanking } from './lifecycle-normalization.js';
import { isValidPeriodKey } from './period-builder.js';

export const SELECTOR_CACHE_LIMIT = 120;

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function todayISO(baseDate = new Date()) {
  const date = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousPeriodKey(periodKey) {
  if (!isValidPeriodKey(periodKey)) return periodKey;
  const [year, month] = String(periodKey).split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1, 12));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getPeriodLabel(periodKey) {
  if (!isValidPeriodKey(periodKey)) return String(periodKey || '');
  const [year, month] = String(periodKey).split('-');
  const monthName = MONTH_NAMES_PT_BR[Number(month) - 1] || month;
  return `${monthName}/${year}`;
}

export function getShortPeriodLabel(periodKey) {
  if (!isValidPeriodKey(periodKey)) return String(periodKey || '');
  const [, month] = String(periodKey).split('-');
  return String(MONTH_NAMES_PT_BR[Number(month) - 1] || month).slice(0, 3);
}

export function isPastPeriodKey(periodKey, currentPeriodKey) {
  return isValidPeriodKey(periodKey) && isValidPeriodKey(currentPeriodKey) && String(periodKey) < String(currentPeriodKey);
}

export function compareByDateTime(left, right) {
  return `${left?.date || ''}T${left?.time || '00:00'}`.localeCompare(`${right?.date || ''}T${right?.time || '00:00'}`);
}

export function getNpsGoalProgress(score, goal) {
  const target = Number(goal || 0);
  if (!target) return 0;
  return clamp((Number(score || 0) / target) * 100, 0, 100);
}

export function diffInDays(dateStr, baseDate = new Date()) {
  if (!dateStr) return 0;
  const base = new Date(`${dateStr}T00:00:00`);
  const now = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const diff = Math.floor((now - base) / 86400000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

export function createSelectorContext(overrides = {}) {
  const state = overrides.state && typeof overrides.state === 'object' ? overrides.state : {};
  const storage = overrides.storage && typeof overrides.storage === 'object'
    ? overrides.storage
    : { activePeriod: overrides.currentPeriodKey || '', periods: {}, archives: {} };

  return {
    state: {
      settings: {},
      students: [],
      pending: [],
      recados: [],
      nps: {},
      scale: [],
      events: [],
      addons: {},
      ...state,
    },
    storage: {
      activePeriod: overrides.currentPeriodKey || storage.activePeriod || '',
      periods: {},
      archives: {},
      ...storage,
    },
    currentPeriodKey: overrides.currentPeriodKey || storage.activePeriod || '',
    pendingFilters: overrides.pendingFilters || {},
    eventFilters: overrides.eventFilters || {},
    scaleFilters: overrides.scaleFilters || {},
    today: overrides.today || todayISO(),
    now: overrides.now || new Date(),
  };
}

export function createDomainSelectors(initialContext = {}) {
  let context = createSelectorContext(initialContext);
  const cacheSelectores = new Map();

  function setContext(nextContext = {}) {
    context = createSelectorContext({ ...context, ...nextContext });
    limparCacheSelectores();
    return context;
  }

  function getContext() {
    return context;
  }

  function getState() {
    return context.state;
  }

  function getStorage() {
    return context.storage;
  }

  function limparCacheSelectores() {
    cacheSelectores.clear();
  }

  function criarAssinaturaSelector(...partes) {
    return JSON.stringify(partes);
  }

  function lerSelectorMemorizado(chave, assinatura, calcular) {
    const chaveCompleta = `${context.currentPeriodKey}::${chave}::${assinatura}`;
    if (cacheSelectores.has(chaveCompleta)) return cacheSelectores.get(chaveCompleta);

    const valor = calcular();
    cacheSelectores.set(chaveCompleta, valor);
    if (cacheSelectores.size > SELECTOR_CACHE_LIMIT) {
      cacheSelectores.clear();
      cacheSelectores.set(chaveCompleta, valor);
    }
    return valor;
  }

  function selecionarTotaisAddons() {
    const state = getState();
    const pessoasAddon = getAddonPeople(state);
    const assinatura = criarAssinaturaSelector(pessoasAddon, state.settings?.addonTypes, state.addons);

    return lerSelectorMemorizado('totais_addons', assinatura, () => {
      const porPessoa = {};
      const porPessoaTipo = {};
      let totalGeral = 0;

      pessoasAddon.forEach((nome) => {
        porPessoaTipo[nome] = {};
        const grupo = state.addons?.[nome] || {};
        const knownTypes = [...new Set([...(state.settings?.addonTypes || []), ...Object.keys(grupo)])];
        let totalPessoa = 0;

        knownTypes.forEach((tipo) => {
          const totalTipo = (Array.isArray(grupo[tipo]) ? grupo[tipo] : [])
            .reduce((acc, valor) => acc + Number(valor || 0), 0);
          porPessoaTipo[nome][tipo] = totalTipo;
          totalPessoa += totalTipo;
        });

        porPessoa[nome] = totalPessoa;
        totalGeral += totalPessoa;
      });

      return { porPessoa, porPessoaTipo, totalGeral };
    });
  }

  function itemsComFeedback(itens = []) {
    return itens.filter((item) => item.feedback !== 'Pendente').length;
  }

  function selecionarResumoRecepcionistas() {
    const state = getState();
    const recepcionistas = getReceptionists(state);
    const assinatura = criarAssinaturaSelector(recepcionistas, state.students, state.addons, state.settings?.addonTypes);

    return lerSelectorMemorizado('resumo_recepcionistas', assinatura, () => {
      const alunos = Array.isArray(state.students) ? state.students : [];
      const totaisAddons = selecionarTotaisAddons();
      const taxaFeedbackGlobal = alunos.length ? alunos.filter((aluno) => aluno.feedback !== 'Pendente').length / alunos.length : 0;

      return recepcionistas.map((nome) => {
        const itens = alunos.filter((aluno) => aluno.atendimento === nome);
        const total = itens.length;
        const comFeedback = itemsComFeedback(itens);
        const nps = itens.filter((aluno) => aluno.avisoNps === 'Sim').length;
        const addon = totaisAddons.porPessoa[nome] || 0;
        const positivos = itens.filter((aluno) => aluno.feedback === 'Respondeu').length;
        const taxaFeedback = total ? comFeedback / total : 0;
        const taxaAddon = total ? addon / total : 0;
        const taxaPositiva = comFeedback ? positivos / comFeedback : 0;

        return {
          nome,
          total,
          comFeedback,
          nps,
          addon,
          addonVolume: addon,
          positivos,
          taxaFeedback,
          taxaAddon,
          taxaPositiva,
          diferencaTaxa: taxaFeedback - taxaFeedbackGlobal,
        };
      });
    });
  }

  function selecionarLideresHistoricos(limite = 6) {
    const storage = getStorage();
    const periods = storage.periods || {};
    const keys = Object.keys(periods).filter((key) => isPastPeriodKey(key, context.currentPeriodKey));
    const assinatura = criarAssinaturaSelector('hist_leaders', keys, context.currentPeriodKey);

    return lerSelectorMemorizado('lideres_historicos', assinatura, () => keys
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const period = periods[key];
        if (!period) return null;

        let addonLeader = null;
        const addons = period.addons || {};
        const tipos = period.settings?.addonTypes || [];
        Object.keys(addons).forEach((nome) => {
          const grupo = addons[nome] || {};
          const total = (tipos.length ? tipos : Object.keys(grupo)).reduce((acc, tipo) => (
            acc + (Array.isArray(grupo[tipo]) ? grupo[tipo] : []).reduce((sum, value) => sum + Number(value || 0), 0)
          ), 0);
          if (total > 0 && (!addonLeader || total > addonLeader.total || (total === addonLeader.total && nome.localeCompare(addonLeader.name, 'pt-BR') < 0))) {
            addonLeader = { name: nome, total };
          }
        });

        let npsLeader = null;
        (Array.isArray(period?.nps?.mentions) ? period.nps.mentions : []).forEach((mention) => {
          const count = Number(mention?.count || 0);
          const nome = String(mention?.name || '');
          if (count > 0 && (!npsLeader || count > npsLeader.total || (count === npsLeader.total && nome.localeCompare(npsLeader.name, 'pt-BR') < 0))) {
            npsLeader = { name: nome, total: count };
          }
        });

        if (!addonLeader && !npsLeader) return null;
        return { key, label: getPeriodLabel(key), addonLeader, npsLeader };
      })
      .filter(Boolean)
      .slice(0, limite));
  }

  function selecionarResumoPendencias() {
    const state = getState();
    const pending = Array.isArray(state.pending) ? state.pending : [];
    const assinatura = criarAssinaturaSelector(pending);

    return lerSelectorMemorizado('resumo_pendencias', assinatura, () => {
      const contagens = {
        aberto: pending.filter((item) => item.status === 'aberto').length,
        respondido: pending.filter((item) => item.status === 'respondido').length,
        concluido: pending.filter((item) => item.status === 'concluido').length,
      };
      const ordemStatus = { aberto: 0, respondido: 1, concluido: 2 };
      const itensDashboard = pending
        .slice()
        .sort((left, right) => {
          const ranking = (ordemStatus[left.status] ?? 9) - (ordemStatus[right.status] ?? 9);
          if (ranking !== 0) return ranking;
          return String(right.data || '').localeCompare(String(left.data || ''));
        })
        .slice(0, 4);
      const maisAntigaAberta = pending
        .filter((item) => item.status === 'aberto' && item.data)
        .slice()
        .sort((left, right) => String(left.data).localeCompare(String(right.data)))[0] || null;

      return {
        contagens,
        itensDashboard,
        total: pending.length,
        abertas: contagens.aberto,
        concluidas: contagens.concluido,
        maisAntigaAberta,
      };
    });
  }

  function selecionarPendenciasFiltradas() {
    const state = getState();
    const pending = Array.isArray(state.pending) ? state.pending : [];
    const query = normalizeSearchText(context.pendingFilters?.query);
    const assinatura = criarAssinaturaSelector(pending, query);

    return lerSelectorMemorizado('pendencias_filtradas', assinatura, () => {
      const linhas = pending.filter((item) => normalizeSearchText([
        item.nome,
        item.matricula,
        item.pendencia,
        item.resposta,
        item.hostess,
      ].join(' ')).includes(query));

      return {
        linhas,
        grupos: {
          aberto: linhas.filter((item) => item.status === 'aberto'),
          respondido: linhas.filter((item) => item.status === 'respondido'),
          concluido: linhas.filter((item) => item.status === 'concluido'),
        },
      };
    });
  }

  function selecionarRankingNps() {
    const state = getState();
    const nps = state.nps || {};
    const assinatura = criarAssinaturaSelector(nps.mentions, nps.rankSnapshot, nps.score, nps.monthlyGoal, nps.semesterGoal);

    return lerSelectorMemorizado('ranking_nps', assinatura, () => {
      const itens = sortNpsMentionsByRanking(Array.isArray(nps.mentions) ? nps.mentions : []);
      const snapshot = nps.rankSnapshot || {};
      const haSnapshot = Object.keys(snapshot).length > 0;
      const ranking = itens.map((item, indice) => {
        const posicao = indice + 1;
        const anterior = snapshot[item.id];
        let tendencia = { classe: 'trend-stable', rotulo: '- estavel' };

        if (haSnapshot) {
          if (anterior == null) tendencia = { classe: 'trend-new', rotulo: 'novo' };
          else if (anterior > posicao) tendencia = { classe: 'trend-up', rotulo: `up ${anterior - posicao}` };
          else if (anterior < posicao) tendencia = { classe: 'trend-down', rotulo: `down ${posicao - anterior}` };
        }

        return { ...item, position: posicao, tendencia };
      });
      const totalCitacoes = ranking.reduce((acc, item) => acc + Number(item.count || 0), 0);
      const mapaRanking = {};
      ranking.forEach((item) => { mapaRanking[item.id] = item.position; });

      return {
        ranking,
        totalCitacoes,
        top: ranking[0] || null,
        mapaRanking,
      };
    });
  }

  function getEventsFilteredList() {
    const state = getState();
    const filters = context.eventFilters || {};
    const query = normalizeSearchText(filters.query);
    const typeFilter = String(filters.typeFilter || '');
    const statusFilter = String(filters.statusFilter || '');
    const events = Array.isArray(state.events) ? state.events : [];

    return events
      .filter((item) => {
        const matchesQuery = !query || normalizeSearchText([
          item.date,
          item.time,
          item.type,
          item.title,
          item.place,
          item.owner,
          item.status,
          item.description,
        ].join(' ')).includes(query);
        const matchesType = !typeFilter || String(item.type || '') === typeFilter;
        const matchesStatus = !statusFilter || String(item.status || '') === statusFilter;
        return matchesQuery && matchesType && matchesStatus;
      })
      .sort(compareByDateTime);
  }

  function getUpcomingEvent(list = getState().events) {
    const cutoff = `${context.today}T00:00`;
    return (Array.isArray(list) ? list : [])
      .filter((item) => `${item.date || ''}T${item.time || '00:00'}` >= cutoff && item.status !== 'Cancelado')
      .sort(compareByDateTime)[0] || null;
  }

  function selecionarDadosEventosAgrupados() {
    const state = getState();
    const filtros = context.eventFilters || {};
    const assinatura = criarAssinaturaSelector(state.events, filtros, context.currentPeriodKey);

    return lerSelectorMemorizado('dados_eventos_agrupados', assinatura, () => {
      const lista = getEventsFilteredList();
      const porDia = new Map();
      lista.forEach((item) => {
        const dia = Number(String(item.date || '').slice(-2));
        if (!Number.isFinite(dia)) return;
        if (!porDia.has(dia)) porDia.set(dia, []);
        porDia.get(dia).push(item);
      });

      return {
        lista,
        porDia,
        total: lista.length,
        proximos: lista.filter((item) => `${item.date || ''}T${item.time || '00:00'}` >= `${context.today}T00:00` && item.status !== 'Cancelado').length,
        confirmados: lista.filter((item) => item.status === 'Confirmado').length,
        concluidos: lista.filter((item) => item.status === 'Concluído').length,
        proximo: getUpcomingEvent(lista),
      };
    });
  }

  function getScaleFilteredList() {
    const state = getState();
    const filters = context.scaleFilters || {};
    const query = normalizeSearchText(filters.query);
    const toneFilter = String(filters.toneFilter || '');
    const personFilter = normalizeSearchText(filters.personFilter);
    const scale = Array.isArray(state.scale) ? state.scale : [];

    return scale
      .filter((item) => {
        const people = [
          item.receptionist,
          ...(Array.isArray(item.professorShifts) ? item.professorShifts.map((shift) => shift.name) : []),
        ].join(' ');
        const searchable = normalizeSearchText([
          item.date,
          item.rowTone,
          item.receptionTime,
          item.receptionist,
          item.receptionSwap,
          item.note,
          ...(Array.isArray(item.professorShifts) ? item.professorShifts.flatMap((shift) => [shift.time, shift.name, shift.swap]) : []),
        ].join(' '));
        return (!query || searchable.includes(query))
          && (!toneFilter || item.rowTone === toneFilter)
          && (!personFilter || normalizeSearchText(people).includes(personFilter));
      })
      .sort(compareByDateTime);
  }

  function selecionarResumoEscala() {
    const state = getState();
    const filtros = context.scaleFilters || {};
    const assinatura = criarAssinaturaSelector(state.scale, filtros, context.currentPeriodKey);

    return lerSelectorMemorizado('resumo_escala', assinatura, () => {
      const lista = getScaleFilteredList();
      const fimDeSemanaOuAtencao = lista.filter((item) => {
        const diaSemana = new Date(`${item.date}T00:00:00`).getDay();
        return diaSemana === 0 || diaSemana === 6 || item.rowTone === 'red';
      }).length;
      const recepcaoCoberta = lista.filter((item) => item.receptionist).length;
      const professoresLancados = lista.reduce((acc, item) => acc + (item.professorShifts || []).filter((shift) => shift.name).length, 0);
      const trocasOuAtencao = lista.reduce((acc, item) => (
        acc + (item.professorShifts || []).filter((shift) => shift.swap).length + (item.receptionSwap ? 1 : 0)
      ), 0);

      return {
        lista,
        diasEscalados: lista.length,
        recepcaoCoberta,
        professoresLancados,
        trocasOuAtencao,
        fimDeSemanaOuAtencao,
      };
    });
  }

  function getDashboardHistoryPeriodKeys(limite = 6) {
    const safeLimit = clamp(Number(limite || 6), 1, 12);
    const keys = [];
    let cursor = context.currentPeriodKey;
    while (keys.length < safeLimit && isValidPeriodKey(cursor)) {
      keys.push(cursor);
      cursor = getPreviousPeriodKey(cursor);
    }
    return keys.reverse();
  }

  function buildDashboardHistoryPoint(key, period) {
    const state = getState();
    const fallbackGoal = clamp(Number(state?.nps?.monthlyGoal ?? 75), 0, 100);
    return {
      key,
      label: getPeriodLabel(key),
      shortLabel: getShortPeriodLabel(key),
      totalAlunos: Array.isArray(period?.students) ? period.students.length : 0,
      npsAtual: clamp(Number(period?.nps?.score ?? 0), 0, 100),
      metaMensal: clamp(Number(period?.nps?.monthlyGoal ?? fallbackGoal), 0, 100),
      hasData: Boolean(period),
    };
  }

  function selecionarHistoricoDashboard(limite = 6) {
    const storage = getStorage();
    const keys = getDashboardHistoryPeriodKeys(limite);
    const assinatura = criarAssinaturaSelector(
      'dashboard_historico',
      keys.map((key) => {
        const period = storage?.periods?.[key];
        return [
          key,
          Array.isArray(period?.students) ? period.students.length : 0,
          Number(period?.nps?.score ?? 0),
          Number(period?.nps?.monthlyGoal ?? getState()?.nps?.monthlyGoal ?? 75),
        ];
      }),
    );

    return lerSelectorMemorizado(`dashboard_historico_${limite}`, assinatura, () => (
      keys.map((key) => buildDashboardHistoryPoint(key, storage?.periods?.[key] || null))
    ));
  }

  function selecionarDadosGraficosDashboard(limite = 6) {
    const state = getState();
    const historico = selecionarHistoricoDashboard(limite);
    const resumoRecepcionistas = selecionarResumoRecepcionistas();
    const totaisAddons = selecionarTotaisAddons();
    const assinatura = criarAssinaturaSelector(
      'dashboard_graficos',
      historico,
      resumoRecepcionistas.map((item) => [item.nome, item.total]),
      totaisAddons.porPessoa,
      (state.students || []).map((item) => item.feedback),
      state.nps?.monthlyGoal,
    );

    return lerSelectorMemorizado(`dashboard_graficos_${limite}`, assinatura, () => {
      const students = Array.isArray(state.students) ? state.students : [];
      const feedbackDistribuicao = [
        { label: 'Respondeu', value: students.filter((item) => item.feedback === 'Respondeu').length, color: '#22c55e' },
        { label: 'Pendente', value: students.filter((item) => item.feedback === 'Pendente').length, color: '#FFC20F' },
        { label: 'Não respondeu', value: students.filter((item) => item.feedback === 'Não respondeu').length, color: '#ef4444' },
      ];

      const addonRankingBase = Object.entries(totaisAddons.porPessoa || {})
        .filter(([nome]) => nome)
        .sort((left, right) => (right[1] || 0) - (left[1] || 0) || left[0].localeCompare(right[0], 'pt-BR'));
      const addonRanking = (addonRankingBase.some(([, total]) => Number(total || 0) > 0)
        ? addonRankingBase
        : getAddonPeople(state).map((nome) => [nome, totaisAddons.porPessoa?.[nome] || 0]))
        .slice(0, 5)
        .map(([label, value]) => ({ label, value: Number(value || 0) }));

      return {
        historico,
        atendimentosPorRecepcionista: resumoRecepcionistas.map((item) => ({ label: item.nome, value: item.total })),
        feedbackDistribuicao,
        addonRanking,
        metaMensalAtual: clamp(Number(state.nps?.monthlyGoal ?? 75), 0, 100),
      };
    });
  }

  function selecionarIndicadoresDashboard() {
    const state = getState();
    const storage = getStorage();
    const assinatura = criarAssinaturaSelector(
      state.students,
      state.pending,
      state.scale,
      state.events,
      state.nps,
      state.settings,
      state.addons,
      storage.archives?.[context.currentPeriodKey] || null,
    );

    return lerSelectorMemorizado('indicadores_dashboard', assinatura, () => {
      const alunos = Array.isArray(state.students) ? state.students : [];
      const resumoRecepcionistas = selecionarResumoRecepcionistas();
      const resumoPendencias = selecionarResumoPendencias();
      const totaisAddons = selecionarTotaisAddons();
      const rankingNps = selecionarRankingNps();
      const scoreAtual = clamp(Number(state.nps?.score || 0), 0, 100);
      const metaMensal = clamp(Number(state.nps?.monthlyGoal ?? 75), 0, 100);
      const metaSemestral = clamp(Number(state.nps?.semesterGoal ?? 80), 0, 100);
      const destaqueFeedback = resumoRecepcionistas
        .slice()
        .sort((left, right) => right.taxaPositiva - left.taxaPositiva || right.taxaFeedback - left.taxaFeedback || right.total - left.total)[0] || null;
      const liderAddonNome = Object.keys(totaisAddons.porPessoa)
        .slice()
        .sort((left, right) => (totaisAddons.porPessoa[right] || 0) - (totaisAddons.porPessoa[left] || 0) || left.localeCompare(right, 'pt-BR'))[0] || '';
      const proximaEscala = (Array.isArray(state.scale) ? state.scale : [])
        .slice()
        .sort(compareByDateTime)
        .find((item) => String(item.date || '') >= context.today)
        || (Array.isArray(state.scale) ? state.scale : []).slice().sort(compareByDateTime)[0]
        || null;
      const proximoEvento = getUpcomingEvent(state.events);
      const comFeedback = alunos.filter((aluno) => aluno.feedback !== 'Pendente').length;
      const positivos = alunos.filter((aluno) => aluno.feedback === 'Respondeu').length;

      return {
        totalAlunos: alunos.length,
        mediaFeedback: alunos.length ? comFeedback / alunos.length : 0,
        feedbackPositivo: comFeedback ? positivos / comFeedback : 0,
        npsAtual: scoreAtual,
        faixaNps: getRiskBand(scoreAtual),
        pendenciasAbertas: resumoPendencias.abertas,
        pendenciasConcluidas: resumoPendencias.concluidas,
        totalPendencias: resumoPendencias.total,
        proximaEscala,
        proximoEvento,
        resumoRecepcionistas,
        resumoPendencias,
        totaisAddons,
        rankingNps,
        destaqueFeedback,
        liderAddonNome,
        liderAddonTotal: liderAddonNome ? (totaisAddons.porPessoa[liderAddonNome] || 0) : 0,
        itemNpsTopo: rankingNps.top,
        metaMensal,
        metaSemestral,
        percentualMetaMensal: getNpsGoalProgress(scoreAtual, metaMensal),
        percentualMetaSemestral: getNpsGoalProgress(scoreAtual, metaSemestral),
        maisAntigaAberta: resumoPendencias.maisAntigaAberta,
      };
    });
  }

  function totalAddonByPerson(person) {
    return selecionarTotaisAddons().porPessoa[person] || 0;
  }

  function totalNpsMentions() {
    return selecionarRankingNps().totalCitacoes;
  }

  function computeSummary() {
    return selecionarResumoRecepcionistas();
  }

  function getOldestOpenPending() {
    return selecionarResumoPendencias().maisAntigaAberta;
  }

  return {
    cacheSelectores,
    setContext,
    getContext,
    limparCacheSelectores,
    criarAssinaturaSelector,
    lerSelectorMemorizado,
    selecionarTotaisAddons,
    selecionarResumoRecepcionistas,
    itemsComFeedback,
    selecionarLideresHistoricos,
    selecionarResumoPendencias,
    selecionarPendenciasFiltradas,
    selecionarRankingNps,
    selecionarDadosEventosAgrupados,
    selecionarResumoEscala,
    getShortPeriodLabel,
    getDashboardHistoryPeriodKeys,
    buildDashboardHistoryPoint,
    selecionarHistoricoDashboard,
    selecionarDadosGraficosDashboard,
    selecionarIndicadoresDashboard,
    totalAddonByPerson,
    totalNpsMentions,
    computeSummary,
    getOldestOpenPending,
    diffInDays: (dateStr) => diffInDays(dateStr, context.now),
  };
}
