    // CAMADA DE SELECTORS — derivados com memoização previsível
    // ══════════════════════════════════════════

    const cacheSelectores = new Map();

    /** Clears the selector memoization cache. @returns {void} */
    function limparCacheSelectores() {
      cacheSelectores.clear();
    }

    /** Builds a JSON signature from the given parts. @param {...*} partes @returns {string} */
    function criarAssinaturaSelector(...partes) {
      return JSON.stringify(partes);
    }

    /** Returns a memoized selector value, computing it if stale. @param {string} chave @param {string} assinatura @param {function(): *} calcular @returns {*} */
    function lerSelectorMemorizado(chave, assinatura, calcular) {
      const chaveCompleta = `${currentPeriodKey}::${chave}::${assinatura}`;
      if (cacheSelectores.has(chaveCompleta)) return cacheSelectores.get(chaveCompleta);
      const valor = calcular();
      cacheSelectores.set(chaveCompleta, valor);
      if (cacheSelectores.size > 120) {
        cacheSelectores.clear();
        cacheSelectores.set(chaveCompleta, valor);
      }
      return valor;
    }

    /** Computes addon totals per person and type. @returns {AddonTotals} */
    function selecionarTotaisAddons() {
      const pessoasAddon = getAddonPeople(state);
      const assinatura = criarAssinaturaSelector(pessoasAddon, state.settings.addonTypes, state.addons);
      return lerSelectorMemorizado('totais_addons', assinatura, () => {
        const porPessoa = {};
        const porPessoaTipo = {};
        let totalGeral = 0;

        pessoasAddon.forEach(nome => {
          porPessoaTipo[nome] = {};
          const grupo = state.addons[nome] || {};
          const knownTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(grupo)])];
          let totalPessoa = 0;
          knownTypes.forEach(tipo => {
            const totalTipo = (grupo[tipo] || []).reduce((acc, valor) => acc + Number(valor || 0), 0);
            porPessoaTipo[nome][tipo] = totalTipo;
            totalPessoa += totalTipo;
          });
          porPessoa[nome] = totalPessoa;
          totalGeral += totalPessoa;
        });

        return { porPessoa, porPessoaTipo, totalGeral };
      });
    }

    /** Computes summary stats for each receptionist. @returns {ReceptionistSummary[]} */
    function selecionarResumoRecepcionistas() {
      const recepcionistas = getReceptionists(state);
      const assinatura = criarAssinaturaSelector(recepcionistas, state.students, state.addons, state.settings.addonTypes);
      return lerSelectorMemorizado('resumo_recepcionistas', assinatura, () => {
        const alunos = state.students;
        const totaisAddons = selecionarTotaisAddons();
        const taxaFeedbackGlobal = alunos.length ? alunos.filter(aluno => aluno.feedback !== 'Pendente').length / alunos.length : 0;
        return recepcionistas.map(nome => {
          const itens = alunos.filter(aluno => aluno.atendimento === nome);
          const total = itens.length;
          const comFeedback = itemsComFeedback(itens);
          const nps = itens.filter(aluno => aluno.avisoNps === 'Sim').length;
          const addon = totaisAddons.porPessoa[nome] || 0;
          const positivos = itens.filter(aluno => aluno.feedback === 'Respondeu').length;
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
            diferencaTaxa: taxaFeedback - taxaFeedbackGlobal
          };
        });
      });
    }

    /** Counts students that have responded to feedback. @param {Student[]} itens @returns {number} */
    function itemsComFeedback(itens) {
      return itens.filter(item => item.feedback !== 'Pendente').length;
    }

    /** Returns top addon/NPS leaders from past periods. @param {number} [limite] @returns {Array} */
    function selecionarLideresHistoricos(limite = 6) {
      const periods = storage?.periods || {};
      const keys = Object.keys(periods).filter(k => k && k !== currentPeriodKey);
      const assinatura = criarAssinaturaSelector('hist_leaders', keys, currentPeriodKey);
      return lerSelectorMemorizado('lideres_historicos', assinatura, () => {
        return keys
          .sort((a, b) => b.localeCompare(a))
          .map(key => {
            const period = periods[key];
            if (!period) return null;

            // Líder de addons: somar todos os tipos por pessoa
            let addonLeader = null;
            try {
              const addons = period.addons || {};
              const tipos = period.settings?.addonTypes || [];
              let melhor = null;
              Object.keys(addons).forEach(nome => {
                const grupo = addons[nome] || {};
                let total = 0;
                (tipos.length ? tipos : Object.keys(grupo)).forEach(tipo => {
                  total += (grupo[tipo] || []).reduce((acc, v) => acc + Number(v || 0), 0);
                });
                if (total > 0 && (!melhor || total > melhor.total || (total === melhor.total && nome.localeCompare(melhor.name, 'pt-BR') < 0))) {
                  melhor = { name: nome, total };
                }
              });
              addonLeader = melhor;
            } catch (_) { /* período legado sem addons */ }

            // Líder de NPS: somar count das mentions
            let npsLeader = null;
            try {
              const mentions = Array.isArray(period?.nps?.mentions) ? period.nps.mentions : [];
              let melhor = null;
              mentions.forEach(m => {
                const count = Number(m?.count || 0);
                const nome = String(m?.name || '');
                if (count > 0 && (!melhor || count > melhor.total || (count === melhor.total && nome.localeCompare(melhor.name, 'pt-BR') < 0))) {
                  melhor = { name: nome, total: count };
                }
              });
              npsLeader = melhor;
            } catch (_) { /* período legado sem nps */ }

            if (!addonLeader && !npsLeader) return null;

            return {
              key,
              label: getPeriodLabel(key),
              addonLeader,
              npsLeader
            };
          })
          .filter(Boolean)
          .slice(0, limite);
      });
    }

    /** Computes pending items summary with counts and oldest open. @returns {PendingSummary} */
    function selecionarResumoPendencias() {
      const assinatura = criarAssinaturaSelector(state.pending);
      return lerSelectorMemorizado('resumo_pendencias', assinatura, () => {
        const contagens = {
          aberto: state.pending.filter(item => item.status === 'aberto').length,
          respondido: state.pending.filter(item => item.status === 'respondido').length,
          concluido: state.pending.filter(item => item.status === 'concluido').length
        };
        const ordemStatus = { aberto: 0, respondido: 1, concluido: 2 };
        const itensDashboard = state.pending.slice().sort((a, b) => {
          const ranking = (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9);
          if (ranking !== 0) return ranking;
          return String(b.data || '').localeCompare(String(a.data || ''));
        }).slice(0, 4);
        const maisAntigaAberta = state.pending
          .filter(item => item.status === 'aberto' && item.data)
          .slice()
          .sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;
        return {
          contagens,
          itensDashboard,
          total: state.pending.length,
          abertas: contagens.aberto,
          concluidas: contagens.concluido,
          maisAntigaAberta
        };
      });
    }

    /** Returns filtered pending items grouped by status. @returns {{linhas: PendingItem[], grupos: {aberto: PendingItem[], respondido: PendingItem[], concluido: PendingItem[]}}} */
    function selecionarPendenciasFiltradas() {
      const { query } = getPendingViewFilters();
      const assinatura = criarAssinaturaSelector(state.pending, query);
      return lerSelectorMemorizado('pendencias_filtradas', assinatura, () => {
        const linhas = state.pending.filter(item => normalizeSearchText([item.nome, item.matricula, item.pendencia, item.resposta, item.hostess].join(' ')).includes(query));
        return {
          linhas,
          grupos: {
            aberto: linhas.filter(item => item.status === 'aberto'),
            respondido: linhas.filter(item => item.status === 'respondido'),
            concluido: linhas.filter(item => item.status === 'concluido')
          }
        };
      });
    }

    /** Computes NPS mention ranking with trends. @returns {NpsRankingResult} */
    function selecionarRankingNps() {
      const assinatura = criarAssinaturaSelector(state.nps.mentions, state.nps.rankSnapshot, state.nps.score, state.nps.monthlyGoal, state.nps.semesterGoal);
      return lerSelectorMemorizado('ranking_nps', assinatura, () => {
        const itens = sortNpsMentionsByRanking(state.nps.mentions);
        const snapshot = state.nps.rankSnapshot || {};
        const haSnapshot = Object.keys(snapshot).length > 0;
        const ranking = itens.map((item, indice) => {
          const posicao = indice + 1;
          const anterior = snapshot[item.id];
          let tendencia = { classe: 'trend-stable', rotulo: '— estável' };
          if (haSnapshot) {
            if (anterior == null) tendencia = { classe: 'trend-new', rotulo: 'novo' };
            else if (anterior > posicao) tendencia = { classe: 'trend-up', rotulo: `↑ ${anterior - posicao}` };
            else if (anterior < posicao) tendencia = { classe: 'trend-down', rotulo: `↓ ${posicao - anterior}` };
          }
          return { ...item, position: posicao, tendencia };
        });
        const totalCitacoes = ranking.reduce((acc, item) => acc + Number(item.count || 0), 0);
        const mapaRanking = {};
        ranking.forEach(item => { mapaRanking[item.id] = item.position; });
        return {
          ranking,
          totalCitacoes,
          top: ranking[0] || null,
          mapaRanking
        };
      });
    }

    /** Returns events filtered and grouped by day. @returns {Object} */
    function selecionarDadosEventosAgrupados() {
      const filtros = getEventViewFilters();
      const assinatura = criarAssinaturaSelector(state.events, filtros, currentPeriodKey);
      return lerSelectorMemorizado('dados_eventos_agrupados', assinatura, () => {
        const lista = getEventsFilteredList();
        const porDia = new Map();
        lista.forEach(item => {
          const dia = Number(String(item.date || '').slice(-2));
          if (!Number.isFinite(dia)) return;
          if (!porDia.has(dia)) porDia.set(dia, []);
          porDia.get(dia).push(item);
        });
        const proximos = lista.filter(item => `${item.date || ''}T${item.time || '00:00'}` >= `${todayISO()}T00:00` && item.status !== 'Cancelado').length;
        return {
          lista,
          porDia,
          total: lista.length,
          proximos,
          confirmados: lista.filter(item => item.status === 'Confirmado').length,
          concluidos: lista.filter(item => item.status === 'Concluído').length,
          proximo: getUpcomingEvent(lista)
        };
      });
    }

    /** Computes scale overview with coverage stats. @returns {Object} */
    function selecionarResumoEscala() {
      const filtros = getScaleViewFilters();
      const assinatura = criarAssinaturaSelector(state.scale, filtros, currentPeriodKey);
      return lerSelectorMemorizado('resumo_escala', assinatura, () => {
        const lista = getScaleFilteredList();
        const fimDeSemanaOuAtencao = lista.filter(item => {
          const diaSemana = new Date(`${item.date}T00:00:00`).getDay();
          return diaSemana === 0 || diaSemana === 6 || item.rowTone === 'red';
        }).length;
        const recepcaoCoberta = lista.filter(item => item.receptionist).length;
        const professoresLancados = lista.reduce((acc, item) => acc + (item.professorShifts || []).filter(shift => shift.name).length, 0);
        const trocasOuAtencao = lista.reduce((acc, item) => acc + (item.professorShifts || []).filter(shift => shift.swap).length + (item.receptionSwap ? 1 : 0), 0);
        return {
          lista,
          diasEscalados: lista.length,
          recepcaoCoberta,
          professoresLancados,
          trocasOuAtencao,
          fimDeSemanaOuAtencao
        };
      });
    }

    /** @param {string} key @returns {string} */
    function getShortPeriodLabel(key) {
      const [_, month] = String(key || '').split('-');
      const monthIndex = Math.max(0, Number(month || 1) - 1);
      return String(MONTH_NAMES[monthIndex] || month || '').slice(0, 3);
    }

    /** @param {number} [limite=6] @returns {string[]} */
    function getDashboardHistoryPeriodKeys(limite = 6) {
      const safeLimit = clamp(Number(limite || 6), 1, 12);
      const keys = [];
      let cursor = currentPeriodKey;
      while (keys.length < safeLimit && isValidPeriodKey(cursor)) {
        keys.push(cursor);
        cursor = getPreviousPeriodKey(cursor);
      }
      return keys.reverse();
    }

    /**
     * @param {string} key
     * @param {PeriodData|null|undefined} period
     * @returns {DashboardHistoryPoint}
     */
    function buildDashboardHistoryPoint(key, period) {
      const fallbackGoal = clamp(Number(state?.nps?.monthlyGoal ?? 75), 0, 100);
      return {
        key,
        label: getPeriodLabel(key),
        shortLabel: getShortPeriodLabel(key),
        totalAlunos: Array.isArray(period?.students) ? period.students.length : 0,
        npsAtual: clamp(Number(period?.nps?.score ?? 0), 0, 100),
        metaMensal: clamp(Number(period?.nps?.monthlyGoal ?? fallbackGoal), 0, 100),
        hasData: Boolean(period)
      };
    }

    /**
     * Retorna a série histórica dos últimos meses do dashboard.
     * @param {number} [limite=6]
     * @returns {DashboardHistoryPoint[]}
     */
    function selecionarHistoricoDashboard(limite = 6) {
      const keys = getDashboardHistoryPeriodKeys(limite);
      const assinatura = criarAssinaturaSelector(
        'dashboard_historico',
        keys.map(key => {
          const period = storage?.periods?.[key];
          return [
            key,
            Array.isArray(period?.students) ? period.students.length : 0,
            Number(period?.nps?.score ?? 0),
            Number(period?.nps?.monthlyGoal ?? state?.nps?.monthlyGoal ?? 75)
          ];
        })
      );
      return lerSelectorMemorizado(`dashboard_historico_${limite}`, assinatura, () => (
        keys.map(key => buildDashboardHistoryPoint(key, storage?.periods?.[key] || null))
      ));
    }

    /**
     * Retorna os datasets consolidados para os gráficos do dashboard.
     * @param {number} [limite=6]
     * @returns {{
     *   historico: DashboardHistoryPoint[],
     *   atendimentosPorRecepcionista: Array<{label: string, value: number}>,
     *   feedbackDistribuicao: Array<{label: string, value: number, color: string}>,
     *   addonRanking: Array<{label: string, value: number}>,
     *   metaMensalAtual: number
     * }}
     */
    function selecionarDadosGraficosDashboard(limite = 6) {
      const historico = selecionarHistoricoDashboard(limite);
      const resumoRecepcionistas = selecionarResumoRecepcionistas();
      const totaisAddons = selecionarTotaisAddons();
      const assinatura = criarAssinaturaSelector(
        'dashboard_graficos',
        historico,
        resumoRecepcionistas.map(item => [item.nome, item.total]),
        totaisAddons.porPessoa,
        state.students.map(item => item.feedback),
        state.nps.monthlyGoal
      );
      return lerSelectorMemorizado(`dashboard_graficos_${limite}`, assinatura, () => {
        const feedbackDistribuicao = [
          { label: 'Respondeu', value: state.students.filter(item => item.feedback === 'Respondeu').length, color: '#22c55e' },
          { label: 'Pendente', value: state.students.filter(item => item.feedback === 'Pendente').length, color: '#FFC20F' },
          { label: 'Não respondeu', value: state.students.filter(item => item.feedback === 'Não respondeu').length, color: '#ef4444' }
        ];

        const addonRankingBase = Object.entries(totaisAddons.porPessoa || {})
          .filter(([nome]) => nome)
          .sort((a, b) => (b[1] || 0) - (a[1] || 0) || a[0].localeCompare(b[0], 'pt-BR'));

        const addonRanking = (addonRankingBase.some(([, total]) => Number(total || 0) > 0)
          ? addonRankingBase
          : getAddonPeople(state).map(nome => [nome, totaisAddons.porPessoa?.[nome] || 0]))
          .slice(0, 5)
          .map(([label, value]) => ({ label, value: Number(value || 0) }));

        return {
          historico,
          atendimentosPorRecepcionista: resumoRecepcionistas.map(item => ({
            label: item.nome,
            value: item.total
          })),
          feedbackDistribuicao,
          addonRanking,
          metaMensalAtual: clamp(Number(state.nps.monthlyGoal ?? 75), 0, 100)
        };
      });
    }

    /** Aggregates all dashboard KPIs into a single object. @returns {DashboardIndicators} */
    function selecionarIndicadoresDashboard() {
      const assinatura = criarAssinaturaSelector(
        state.students,
        state.pending,
        state.scale,
        state.events,
        state.nps,
        state.settings,
        state.addons,
        storage.archives?.[currentPeriodKey] || null
      );
      return lerSelectorMemorizado('indicadores_dashboard', assinatura, () => {
        const alunos = state.students;
        const resumoRecepcionistas = selecionarResumoRecepcionistas();
        const resumoPendencias = selecionarResumoPendencias();
        const totaisAddons = selecionarTotaisAddons();
        const rankingNps = selecionarRankingNps();
        const scoreAtual = clamp(Number(state.nps.score || 0), 0, 100);
        const metaMensal = clamp(Number(state.nps.monthlyGoal ?? 75), 0, 100);
        const metaSemestral = clamp(Number(state.nps.semesterGoal ?? 80), 0, 100);
        const destaqueFeedback = resumoRecepcionistas.slice().sort((a, b) => b.taxaPositiva - a.taxaPositiva || b.taxaFeedback - a.taxaFeedback || b.total - a.total)[0] || null;
        const liderAddonNome = Object.keys(totaisAddons.porPessoa).slice().sort((a, b) => (totaisAddons.porPessoa[b] || 0) - (totaisAddons.porPessoa[a] || 0))[0] || '';
        const proximaEscala = [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).find(item => String(item.date || '') >= todayISO()) || [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null;
        const proximoEvento = getUpcomingEvent(state.events);
        const comFeedback = alunos.filter(aluno => aluno.feedback !== 'Pendente').length;
        const positivos = alunos.filter(aluno => aluno.feedback === 'Respondeu').length;
        const percentualMetaMensal = getNpsGoalProgress(scoreAtual, metaMensal);
        const percentualMetaSemestral = getNpsGoalProgress(scoreAtual, metaSemestral);

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
          percentualMetaMensal,
          percentualMetaSemestral,
          maisAntigaAberta: resumoPendencias.maisAntigaAberta
        };
      });
    }

    /** Returns total addon count for a given person. @param {string} person @returns {number} */
    function totalAddonByPerson(person) {
      return selecionarTotaisAddons().porPessoa[person] || 0;
    }

    /** Returns the total number of NPS mentions. @returns {number} */
    function totalNpsMentions() {
      return selecionarRankingNps().totalCitacoes;
    }

    /** Alias for selecionarResumoRecepcionistas. @returns {ReceptionistSummary[]} */
    function computeSummary() {
      return selecionarResumoRecepcionistas();
    }

    /** Returns the oldest open pending item or null. @returns {PendingItem|null} */
    function getOldestOpenPending() {
      return selecionarResumoPendencias().maisAntigaAberta;
    }

    /** Calculates days elapsed since the given date string. @param {string} dateStr @returns {number} */
    function diffInDays(dateStr) {
      if (!dateStr) return 0;
      const base = new Date(dateStr + 'T00:00:00');
      const now = new Date();
      const diff = Math.floor((now - base) / 86400000);
      return Number.isFinite(diff) ? Math.max(0, diff) : 0;
    }
