    // Date/period helpers já existem em src/utils/helpers.js (cópias removidas)

    /** @returns {ScaleEntry|null} */
    function getUpcomingScale() {
      const sorted = [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      if (!sorted.length) return null;
      const today = todayISO();
      return sorted.find(item => String(item.date || '') >= today) || sorted[0];
    }

    /** @param {EventItem[]} [source] @returns {EventItem|null} */
    function getUpcomingEvent(source = state.events) {
      const sorted = [...(Array.isArray(source) ? source : [])].sort(compareByDateTime);
      if (!sorted.length) return null;
      const nowKey = `${todayISO()}T00:00`;
      return sorted.find(item => `${item.date || ''}T${item.time || '00:00'}` >= nowKey && item.status !== 'Cancelado') || sorted[0];
    }

    /** @param {ScaleEntry|null} item @returns {string} */
    function getScaleSummaryText(item) {
      if (!item) return 'Nenhuma escala cadastrada no período.';
      const profs = item.professorShifts.filter(shift => shift.name).map(shift => shift.name);
      const professorText = profs.length ? profs.join(' • ') : 'Sem professor definido';
      const receptionText = item.receptionist || 'Sem recepcionista definido';
      return `Prof.: ${professorText} • Recepção: ${receptionText}`;
    }

    /** @param {EventItem|null} item @returns {string} */
    function getEventSummaryText(item) {
      if (!item) return 'Nenhum evento ou ação programado neste período.';
      return `${item.type || 'Agenda'} • ${getPeriodDisplayDate(item.date)}${item.time ? ` • ${item.time}` : ''}`;
    }

    const DASHBOARD_CHART_IDS = Object.freeze([
      'dashboardStudentsEvolutionChart',
      'dashboardReceptionistsChart',
      'dashboardFeedbackDistributionChart',
      'dashboardNpsTrendChart',
      'dashboardAddonRankingChart'
    ]);
    const dashboardChartInstances = new Map();
    let dashboardChartsThemeConfigured = false;

    /** @param {string} name @param {string} fallback @returns {string} */
    function getDashboardChartToken(name, fallback) {
      const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    }

    /** @returns {{ label: string, grid: string, primary: string, success: string, blue: string, purple: string, tooltipBg: string, tooltipText: string }} */
    function getDashboardChartTheme() {
      return {
        label: getDashboardChartToken('--text-muted', '#8a8998'),
        grid: 'rgba(255,255,255,0.06)',
        primary: getDashboardChartToken('--primary', '#FFC20F'),
        success: getDashboardChartToken('--ok', '#22c55e'),
        blue: getDashboardChartToken('--chart-blue', '#38bdf8'),
        purple: getDashboardChartToken('--chart-purple', '#8b5cf6'),
        tooltipBg: 'rgba(10, 10, 10, 0.94)',
        tooltipText: '#f5f5f5'
      };
    }

    /** @returns {void} */
    function ensureDashboardChartDefaults() {
      if (!window.Chart || dashboardChartsThemeConfigured) return;
      const theme = getDashboardChartTheme();
      const fontFamily = window.getComputedStyle(document.body).fontFamily || "'Montserrat', system-ui, sans-serif";
      window.Chart.defaults.color = theme.label;
      window.Chart.defaults.borderColor = theme.grid;
      window.Chart.defaults.font.family = fontFamily;
      window.Chart.defaults.font.size = 12;
      window.Chart.defaults.responsive = true;
      window.Chart.defaults.maintainAspectRatio = false;
      window.Chart.defaults.animation = false;
      window.Chart.defaults.plugins.legend.labels.color = theme.label;
      window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
      window.Chart.defaults.plugins.legend.labels.boxWidth = 10;
      window.Chart.defaults.plugins.legend.labels.boxHeight = 10;
      window.Chart.defaults.plugins.tooltip.backgroundColor = theme.tooltipBg;
      window.Chart.defaults.plugins.tooltip.titleColor = theme.tooltipText;
      window.Chart.defaults.plugins.tooltip.bodyColor = theme.tooltipText;
      dashboardChartsThemeConfigured = true;
    }

    /** @param {string} chartId @returns {void} */
    function destroyDashboardChart(chartId) {
      const instance = dashboardChartInstances.get(chartId);
      if (!instance) return;
      instance.destroy();
      dashboardChartInstances.delete(chartId);
    }

    /** @returns {void} */
    function destroyDashboardCharts() {
      DASHBOARD_CHART_IDS.forEach(destroyDashboardChart);
    }

    /** @param {string} chartId @returns {{ canvas: HTMLCanvasElement|null, empty: HTMLElement|null }} */
    function getDashboardChartNodes(chartId) {
      const canvas = document.getElementById(chartId);
      const shell = canvas?.closest('.dashboard-chart-shell') || null;
      const empty = shell?.querySelector('.dashboard-chart-empty') || null;
      return {
        canvas: canvas && typeof canvas.getContext === 'function' ? canvas : null,
        empty
      };
    }

    /** @param {string} chartId @param {string} message @returns {void} */
    function setDashboardChartFallback(chartId, message) {
      const { canvas, empty } = getDashboardChartNodes(chartId);
      destroyDashboardChart(chartId);
      if (canvas) canvas.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = message;
      }
    }

    /** @param {string} chartId @returns {HTMLCanvasElement|null} */
    function prepareDashboardChartCanvas(chartId) {
      const { canvas, empty } = getDashboardChartNodes(chartId);
      if (!canvas) return null;
      canvas.hidden = false;
      if (empty) {
        empty.hidden = true;
        empty.textContent = '';
      }
      return canvas;
    }

    /** @returns {boolean} */
    function isDashboardVisible() {
      const dashboardView = document.getElementById('dashboard');
      return Boolean(dashboardView && !dashboardView.hidden);
    }

    /**
     * @param {{ label: string, grid: string }} theme
     * @param {Object} [yOverrides]
     * @param {Object} [xOverrides]
     * @returns {Object}
     */
    function buildDashboardCartesianScales(theme, yOverrides = {}, xOverrides = {}) {
      return {
        x: {
          ticks: { color: theme.label, maxRotation: 0, minRotation: 0 },
          grid: { color: theme.grid, drawBorder: false },
          border: { display: false },
          ...xOverrides
        },
        y: {
          beginAtZero: true,
          ticks: { color: theme.label, precision: 0 },
          grid: { color: theme.grid, drawBorder: false },
          border: { display: false },
          ...yOverrides
        }
      };
    }

    /** @param {*} context @returns {CanvasGradient|string} */
    function getAddonRankingGradient(context) {
      const { chart } = context;
      const { ctx, chartArea } = chart;
      if (!chartArea) return 'rgba(255,194,15,0.85)';
      const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
      gradient.addColorStop(0, 'rgba(255,194,15,0.24)');
      gradient.addColorStop(0.45, 'rgba(255,194,15,0.56)');
      gradient.addColorStop(1, 'rgba(255,194,15,0.96)');
      return gradient;
    }

    /**
     * @param {string} chartId
     * @param {Object} config
     * @returns {void}
     */
    function mountDashboardChart(chartId, config) {
      const canvas = prepareDashboardChartCanvas(chartId);
      if (!canvas) return;
      if (!window.Chart) {
        setDashboardChartFallback(chartId, 'Chart.js indisponível no momento.');
        return;
      }
      ensureDashboardChartDefaults();
      destroyDashboardChart(chartId);
      const context = canvas.getContext('2d');
      if (!context) {
        setDashboardChartFallback(chartId, 'Canvas indisponível neste navegador.');
        return;
      }
      dashboardChartInstances.set(chartId, new window.Chart(context, config));
    }

    /** @returns {void} */
    function renderDashboardCharts() {
      const visualSection = document.getElementById('dashboardVisualSection');
      if (!visualSection) {
        destroyDashboardCharts();
        return;
      }

      const chartData = selecionarDadosGraficosDashboard(6);
      visualSection.dataset.periodKey = currentPeriodKey;
      visualSection.dataset.historyWindow = chartData.historico.map(item => item.key).join(',');
      if (!isDashboardVisible()) return;

      const theme = getDashboardChartTheme();
      const historyLabels = chartData.historico.map(item => item.shortLabel);
      const historyTitles = chartData.historico.map(item => item.label);

      mountDashboardChart('dashboardStudentsEvolutionChart', {
        type: 'line',
        data: {
          labels: historyLabels,
          datasets: [{
            label: 'Alunos novos',
            data: chartData.historico.map(item => item.totalAlunos),
            borderColor: theme.primary,
            backgroundColor: 'rgba(255,194,15,0.14)',
            tension: 0.32,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointBackgroundColor: theme.primary,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            fill: false
          }]
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          scales: buildDashboardCartesianScales(theme),
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: items => historyTitles[items[0]?.dataIndex] || '',
                label: context => `${context.parsed.y} aluno${context.parsed.y === 1 ? '' : 's'}`
              }
            }
          }
        }
      });

      mountDashboardChart('dashboardReceptionistsChart', {
        type: 'bar',
        data: {
          labels: chartData.atendimentosPorRecepcionista.map(item => item.label),
          datasets: [{
            label: 'Atendimentos',
            data: chartData.atendimentosPorRecepcionista.map(item => item.value),
            backgroundColor: chartData.atendimentosPorRecepcionista.map((_, index) => {
              const palette = [theme.primary, theme.success, theme.blue, theme.purple];
              return palette[index % palette.length];
            }),
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 46
          }]
        },
        options: {
          scales: buildDashboardCartesianScales(theme),
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => `${context.parsed.y} atendimento${context.parsed.y === 1 ? '' : 's'}`
              }
            }
          }
        }
      });

      const totalFeedback = chartData.feedbackDistribuicao.reduce((acc, item) => acc + item.value, 0);
      if (!totalFeedback) {
        setDashboardChartFallback('dashboardFeedbackDistributionChart', 'Sem feedbacks registrados neste período.');
      } else {
        mountDashboardChart('dashboardFeedbackDistributionChart', {
          type: 'doughnut',
          data: {
            labels: chartData.feedbackDistribuicao.map(item => item.label),
            datasets: [{
              data: chartData.feedbackDistribuicao.map(item => item.value),
              backgroundColor: chartData.feedbackDistribuicao.map(item => item.color),
              borderColor: 'rgba(0,0,0,0)',
              hoverOffset: 6,
              cutout: '64%'
            }]
          },
          options: {
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: context => `${context.label}: ${context.parsed} (${formatPct(context.parsed / totalFeedback)})`
                }
              }
            }
          }
        });
      }

      mountDashboardChart('dashboardNpsTrendChart', {
        type: 'line',
        data: {
          labels: historyLabels,
          datasets: [
            {
              label: 'NPS',
              data: chartData.historico.map(item => item.npsAtual),
              borderColor: theme.primary,
              backgroundColor: 'rgba(255,194,15,0.18)',
              tension: 0.34,
              borderWidth: 3,
              pointRadius: 4,
              pointHoverRadius: 5,
              pointBackgroundColor: theme.primary,
              fill: true
            },
            {
              label: 'Meta mensal',
              data: historyLabels.map(() => chartData.metaMensalAtual),
              borderColor: 'rgba(255,255,255,0.55)',
              borderDash: [6, 6],
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          scales: buildDashboardCartesianScales(theme, { min: 0, max: 100, ticks: { color: theme.label, stepSize: 20 } }),
          plugins: {
            legend: {
              position: 'top',
              align: 'start'
            },
            tooltip: {
              callbacks: {
                title: items => historyTitles[items[0]?.dataIndex] || '',
                label: context => `${context.dataset.label}: ${context.parsed.y} pts`
              }
            }
          }
        }
      });

      const hasAddonSales = chartData.addonRanking.some(item => item.value > 0);
      if (!chartData.addonRanking.length || !hasAddonSales) {
        setDashboardChartFallback('dashboardAddonRankingChart', 'Nenhuma venda de addon registrada no período.');
      } else {
        mountDashboardChart('dashboardAddonRankingChart', {
          type: 'bar',
          data: {
            labels: chartData.addonRanking.map(item => item.label),
            datasets: [{
              label: 'Addons vendidos',
              data: chartData.addonRanking.map(item => item.value),
              backgroundColor: getAddonRankingGradient,
              borderRadius: 10,
              borderSkipped: false,
              maxBarThickness: 28
            }]
          },
          options: {
            indexAxis: 'y',
            scales: buildDashboardCartesianScales(
              theme,
              {
                ticks: { color: theme.label, precision: 0 },
                grid: { display: false },
                border: { display: false }
              },
              {
                beginAtZero: true,
                ticks: { color: theme.label, precision: 0 },
                grid: { color: theme.grid, drawBorder: false },
                border: { display: false }
              }
            ),
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: context => `${context.parsed.x} addon${context.parsed.x === 1 ? '' : 's'}`
                }
              }
            }
          }
        });
      }
    }

    // ══════════════════════════════════════════

    /** @param {DashboardIndicators} indicadores @returns {void} */
    function renderDashboardInsights(indicadores) {
      const bestFeedback = indicadores.destaqueFeedback;
      const addonLeaderName = indicadores.liderAddonNome;
      const addonLeaderTotal = indicadores.liderAddonTotal;
      const topMention = indicadores.itemNpsTopo;
      const totalMentions = indicadores.rankingNps.totalCitacoes;
      const oldest = indicadores.maisAntigaAberta;
      const monthlyGoal = indicadores.metaMensal;
      const semesterGoal = indicadores.metaSemestral;
      const score = indicadores.npsAtual;
      const monthlyPct = indicadores.percentualMetaMensal;
      const semesterPct = indicadores.percentualMetaSemestral;

      aplicarHtmlSeMudou(document.getElementById('dashboardInsights'), `
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Destaque em feedback</div><div class="insight-badge">TOP</div></div>
          <div class="insight-value">${bestFeedback ? esc(bestFeedback.nome) : 'Sem dados'}</div>
          <div class="insight-meta">${bestFeedback ? `${formatPct(bestFeedback.taxaPositiva)} de feedback positivo em ${bestFeedback.total} atendimento${bestFeedback.total === 1 ? '' : 's'}.` : 'Cadastre atendimentos com feedback para gerar o destaque.'}</div>
          <div class="progress-track"><div class="progress-fill" data-style-width-pct="${bestFeedback ? Math.round(bestFeedback.taxaPositiva * 100) : 0}"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Líder de addons</div><div class="insight-badge">${addonLeaderTotal}</div></div>
          <div class="insight-value">${addonLeaderName ? esc(addonLeaderName) : 'Sem dados'}</div>
          <div class="insight-meta">${addonLeaderName ? `Maior volume acumulado nas vendas complementares deste mês.` : 'A contagem automática aparece quando o addon é marcado no novo atendimento.'}</div>
          <div class="progress-track"><div class="progress-fill" data-style-width-pct="${Math.min(100, addonLeaderTotal * 8)}"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Líder NPS</div><div class="insight-badge">${topMention ? topMention.count : 0}</div></div>
          <div class="insight-value">${topMention ? esc(topMention.name) : 'Nenhuma citação registrada'}</div>
          <div class="insight-meta">${topMention ? `#1 • ${topMention.count} ${topMention.count === 1 ? 'citação' : 'citações'} no mês.` : 'Nenhuma citação registrada'}</div>
          <div class="progress-track"><div class="progress-fill" data-style-width-pct="${topMention && totalMentions ? Math.round((topMention.count / totalMentions) * 100) : 0}"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Urgência operacional</div><div class="insight-badge">${oldest ? `${diffInDays(oldest.data)}d` : 'OK'}</div></div>
          <div class="insight-value">${oldest ? esc(oldest.nome) : 'Sem pendência crítica'}</div>
          <div class="insight-meta">${oldest ? `Aberta desde ${formatDate(oldest.data)} • ${esc(oldest.hostess || 'Sem responsável')}` : 'Nenhuma pendência aberta exigindo escalonamento imediato.'}</div>
          <div class="progress-track"><div class="progress-fill" data-style-width-pct="${Math.min(100, oldest ? diffInDays(oldest.data) * 12 : 0)}"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Meta NPS</div><div class="insight-badge">${score}</div></div>
          <div class="insight-value">Mensal ${monthlyGoal} • Semestral ${semesterGoal}</div>
          <div class="insight-meta">${score >= monthlyGoal ? 'Meta mensal alcançada.' : `Faltam ${Math.max(0, monthlyGoal - score)} pts para a meta mensal.`} ${score >= semesterGoal ? 'Meta semestral alcançada.' : `Semestral: faltam ${Math.max(0, semesterGoal - score)} pts.`}</div>
          <div class="progress-track"><div class="progress-fill" data-style-width-pct="${Math.max(monthlyPct, semesterPct)}"></div></div>
        </div>
      `);
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — DASHBOARD & HERO — renderHero, renderDashboard
    // ══════════════════════════════════════════

    /** @returns {void} */
    function renderHero() {
      syncPeriodControls();
      const indicadores = selecionarIndicadoresDashboard();
      const students = indicadores.totalAlunos;
      const pendingOpen = indicadores.pendenciasAbertas;
      const addons = indicadores.totaisAddons.totalGeral;
      const currentNps = indicadores.npsAtual;
      aplicarHtmlSeMudou(document.getElementById('heroSummary'), `
        <div class="mini-stat">
          <div class="label">Período ativo</div>
          <div class="value mini-stat-value--period">${esc(getPeriodLabel())}</div>
          <div class="hint">${storage.archives[currentPeriodKey] ? 'Mês já fechado anteriormente' : 'Base ativa para lançamento atual'}</div>
        </div>
        <div class="mini-stat">
          <div class="label">Atendimentos no mês</div>
          <div class="value">${students}</div>
          <div class="hint">Registros cadastrados na operação atual</div>
        </div>
        <div class="mini-stat">
          <div class="label">NPS atual</div>
          <div class="value">${currentNps}</div>
          <div class="hint">${esc(getRiskBand(currentNps).label)}</div>
        </div>
        <div class="mini-stat">
          <div class="label">Addons vendidos</div>
          <div class="value">${addons}</div>
          <div class="hint">Somatório de todas as categorias do mês</div>
        </div>
        <div class="mini-stat">
          <div class="label">Pendências abertas</div>
          <div class="value">${pendingOpen}</div>
          <div class="hint">Itens que precisam de atenção imediata</div>
        </div>
      `);
    }

    /** @returns {void} */
    function renderDashboard() {
      const indicadores = selecionarIndicadoresDashboard();
      const summary = indicadores.resumoRecepcionistas;
      const nextScale = indicadores.proximaEscala;
      const nextEvent = indicadores.proximoEvento;
      aplicarHtmlSeMudou(document.getElementById('dashboardCards'), `
        <div class="card card-kpi"><div class="card-label">Total alunos</div><div class="card-value">${indicadores.totalAlunos}</div><div class="card-foot">Registros deste mês</div></div>
        <div class="card card-kpi"><div class="card-label">Média geral feedback</div><div class="card-value">${formatPct(indicadores.mediaFeedback)}</div><div class="card-foot">Baseado em respostas ≠ pendente</div></div>
        <div class="card card-kpi"><div class="card-label">Feedback positivo</div><div class="card-value">${formatPct(indicadores.feedbackPositivo)}</div><div class="card-foot">Somente respostas recebidas</div></div>
        <div class="card card-kpi"><div class="card-label">NPS atual</div><div class="card-value">${indicadores.npsAtual}</div><div class="card-foot">${esc(indicadores.faixaNps.label)}</div></div>
        <div class="card card-kpi"><div class="card-label">Pendências abertas</div><div class="card-value">${indicadores.pendenciasAbertas}</div><div class="card-foot">${indicadores.pendenciasConcluidas}/${indicadores.totalPendencias} concluídas</div></div>
        <div class="card card-nav" data-action="set-active-tab" data-tab-target="scale" role="button" tabindex="0" aria-label="Abrir a aba Escala e ver a próxima escala">
          <div class="card-label">Próxima escala</div>
          <div class="card-value">${nextScale ? esc(getPeriodDisplayDate(nextScale.date)) : 'Sem escala'}</div>
          <div class="card-foot"><strong>${nextScale ? esc(getScaleSummaryText(nextScale)) : 'Ir para aba Escala'}</strong></div>
        </div>
        <div class="card card-nav" data-action="set-active-tab" data-tab-target="events" role="button" tabindex="0" aria-label="Abrir a aba Eventos e ações e ver a próxima programação">
          <div class="card-label">Próximo evento / ação</div>
          <div class="card-value">${nextEvent ? esc(nextEvent.title) : 'Sem agenda'}</div>
          <div class="card-foot"><strong>${nextEvent ? esc(getEventSummaryText(nextEvent)) : 'Ir para aba Eventos e ações'}</strong></div>
        </div>
      `);

      renderDashboardCharts();
      renderDashboardInsights(indicadores);

      const summaryList = document.getElementById('summaryList');
      if (!summary.length) {
        aplicarHtmlSeMudou(summaryList, `<div class="empty"><strong>Nenhum atendente configurado</strong>Cadastre atendentes em <em>Configurações</em> para acompanhar volumes, feedback e addons por pessoa.</div>`);
      } else {
        aplicarPatchCards(summaryList, summary, row => row.nome, row => `
          <div class="summary-item summary-item--dashboard-person">
            <div class="summary-main"><div class="name" title="${esc(row.nome)}">${esc(row.nome)}</div><div class="muted">${row.total} atendimentos registrados</div></div>
            <div class="metric"><strong>${row.total}</strong><span>Total</span></div>
            <div class="metric"><strong>${formatPct(row.taxaFeedback)}</strong><span>Feedback</span></div>
            <div class="metric"><strong>${row.addonVolume ?? row.addon ?? 0}</strong><span>Addons</span></div>
            <div class="metric"><strong>${formatPct(row.taxaPositiva)}</strong><span>Positivo</span></div>
            <div class="metric"><strong class="${row.diferencaTaxa < 0 ? 'danger-text' : 'gold-text'}">${row.diferencaTaxa >= 0 ? '+' : ''}${Math.round(row.diferencaTaxa * 100)} pts</strong><span>Vs média</span></div>
          </div>
        `);
      }

      const maxPositiveRate = Math.max(0.01, ...summary.map(s => s.taxaPositiva));
      const feedbackChart = document.getElementById('feedbackChart');
      setRuntimeStyle(feedbackChart, {
        'min-width': `${Math.max(summary.length * 88, 560)}px`
      });
      if (!summary.length) {
        aplicarHtmlSeMudou(feedbackChart, `<div class="empty"><strong>Sem dados para o gráfico</strong>Registre atendimentos com feedback respondido para visualizar o percentual positivo por atendente.</div>`);
      } else {
        aplicarPatchCards(feedbackChart, summary, item => item.nome, s => {
          const h = Math.max(8, (s.taxaPositiva / maxPositiveRate) * 190);
          return `
            <div class="bar-col" data-tooltip="${esc(s.nome)} • ${formatPct(s.taxaPositiva)} positivo">
              <div class="bar-value">${formatPct(s.taxaPositiva)}</div>
              <div class="bar" data-style-height-px="${h}"></div>
              <div class="bar-label" title="${esc(s.nome)}">${esc(s.nome)}</div>
            </div>
          `;
        });
      }

      const addonsOverview = document.getElementById('addonsOverview');
      const addonPeople = getAddonPeople(state);
      const activeReceptionists = new Set(getReceptionists(state));
      if (!addonPeople.length) {
        aplicarHtmlSeMudou(addonsOverview, '<div class="empty"><strong>Sem atendentes cadastrados</strong>Abra <em>Configurações</em> para habilitar o acompanhamento de addons por pessoa.</div>');
      } else {
        aplicarPatchCards(addonsOverview, addonPeople, person => person, person => {
          const total = indicadores.totaisAddons.porPessoa[person] || 0;
          const perType = Object.entries(indicadores.totaisAddons.porPessoaTipo[person] || {})
            .map(([type, count]) => `${esc(type)}: ${count}`)
            .join(' · ') || 'Sem lançamentos registrados.';
          const subtitle = activeReceptionists.has(person) ? perType : `Histórico preservado • ${perType}`;
          return `<div class="summary-item summary-item--addon-overview"><div class="addon-card-details"><div class="addon-card-name">${esc(person)}</div><div class="addon-card-categories">${subtitle}</div></div><div class="addon-card-total"><strong>${total}</strong><span>Total no período</span></div></div>`;
        });
      }

      const counts = indicadores.resumoPendencias.contagens;
      const dashboardPendingItems = indicadores.resumoPendencias.itensDashboard;
      aplicarHtmlSeMudou(document.getElementById('pendingOverview'), `
        <div class="summary-item pending-overview-cards">
          <div class="metric"><strong>${counts.aberto}</strong><span>Abertas</span></div>
          <div class="metric"><strong>${counts.respondido}</strong><span>Respondidas</span></div>
          <div class="metric"><strong>${counts.concluido}</strong><span>Concluídas</span></div>
        </div>
        <div class="dashboard-pending-list">
          ${dashboardPendingItems.map(p => `
            <div class="ticket dashboard-pending-ticket ${p.status === 'aberto' ? 'ticket-attention' : ''}" data-tooltip="${esc(p.pendencia || '')}">
              <div class="ticket-topline">
                <div class="title" data-tooltip="${esc(p.nome)}">${esc(shortText(p.nome || 'Sem nome', 48))}</div>
                ${pendingPill(p.status)}
              </div>
              <div class="meta">${buildPendingMeta(p)}</div>
              <div class="desc" data-tooltip="${esc(p.pendencia || '')}">${esc(shortText(p.pendencia || 'Sem pendência registrada.', 130))}</div>
            </div>
          `).join('') || '<div class="empty empty--compact"><strong>Sem pendências em destaque</strong>Ir para a aba <em>Pendências</em> para registrar ou revisar solicitações dos alunos.</div>'}
        </div>
      `);
    }

    // ══════════════════════════════════════════
    // ENHANCEMENTS — DASHBOARD VISUAL + PAINEL DE RECADOS (INDEPENDENTE)
    // ══════════════════════════════════════════

    const RECADOS_STORAGE_PREFIX = 'wpm_recados_';
    let recadosModuleBound = false;
    let dashboardEnhancementsInstalled = false;

    /** @returns {string} */
    function createRecadoId() {
      return window.crypto?.randomUUID?.() || `recado-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    /** @param {string} [periodKey] @returns {string} */
    function getRecadosStorageKey(periodKey = currentPeriodKey) {
      const [year = String(new Date().getFullYear()), month = '01'] = String(periodKey || '').split('-');
      return `${RECADOS_STORAGE_PREFIX}${year}-${String(month).padStart(2, '0')}`;
    }

    /** @param {Object} item @returns {Recado|null} */
    function sanitizeRecado(item) {
      const text = String(item?.text ?? item?.message ?? '').trim();
      const from = String(item?.from ?? '').trim();
      const to = String(item?.to ?? 'Todos').trim() || 'Todos';
      if (!from || !text) return null;
      return {
        id: String(item?.id || createRecadoId()),
        from,
        to,
        text,
        createdAt: String(item?.createdAt || new Date().toISOString()),
        read: Boolean(item?.read)
      };
    }

    /** @param {*} recados @returns {Recado[]} */
    function normalizeRecadosCollection(recados) {
      return (Array.isArray(recados) ? recados : [])
        .map(sanitizeRecado)
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    /** @param {Recado[]} primary @param {Recado[]} fallback @returns {Recado[]} */
    function mergeRecadosCollections(primary, fallback) {
      const byId = new Map();
      const bySignature = new Map();

      const register = item => {
        const signature = `${item.from}::${item.to}::${item.text}::${item.createdAt}`;
        const existing = byId.get(item.id) || bySignature.get(signature);
        if (!existing) {
          byId.set(item.id, item);
          bySignature.set(signature, item);
          return;
        }
        const merged = {
          ...existing,
          ...item,
          id: existing.id || item.id || createRecadoId(),
          read: Boolean(existing.read || item.read)
        };
        byId.set(merged.id, merged);
        bySignature.set(signature, merged);
      };

      normalizeRecadosCollection(primary).forEach(register);
      normalizeRecadosCollection(fallback).forEach(register);
      return [...new Set(byId.values())]
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    /** @param {Recado[]} left @param {Recado[]} right @returns {boolean} */
    function areRecadosCollectionsEqual(left, right) {
      return JSON.stringify(normalizeRecadosCollection(left)) === JSON.stringify(normalizeRecadosCollection(right));
    }

    /** @param {string} [periodKey] @returns {Recado[]} */
    function readLegacyRecados(periodKey = currentPeriodKey) {
      try {
        const raw = localStorage.getItem(getRecadosStorageKey(periodKey));
        const parsed = JSON.parse(raw || '[]');
        return normalizeRecadosCollection(parsed);
      } catch (error) {
        console.error('Falha ao carregar recados legados:', error);
        return [];
      }
    }

    /** @param {string} [periodKey] @returns {boolean} */
    function clearLegacyRecadosStorageKey(periodKey = currentPeriodKey) {
      try {
        localStorage.removeItem(getRecadosStorageKey(periodKey));
        return true;
      } catch (error) {
        console.error('Falha ao limpar recados legados:', error);
        return false;
      }
    }

    /** @returns {string[]} */
    function getLegacyRecadoPeriodKeys() {
      try {
        const keys = [];
        for (let index = 0; index < localStorage.length; index++) {
          const rawKey = localStorage.key(index);
          if (!rawKey || !rawKey.startsWith(RECADOS_STORAGE_PREFIX)) continue;
          const periodKey = String(rawKey.slice(RECADOS_STORAGE_PREFIX.length) || '').trim();
          if (isValidPeriodKey(periodKey)) keys.push(periodKey);
        }
        return [...new Set(keys)].sort();
      } catch (error) {
        console.error('Falha ao listar recados legados:', error);
        return [];
      }
    }

    /** @param {string} [periodKey] @param {AppStore} [storeRef] @returns {PeriodData|null} */
    function ensureRecadosPeriod(periodKey = currentPeriodKey, storeRef = storage) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      if (!targetStore?.periods) return null;
      const key = String(periodKey || currentPeriodKey);
      if (!targetStore.periods[key]) {
        const template = targetStore.periods?.[targetStore.activePeriod] || Object.values(targetStore.periods || {})[0] || demoData;
        targetStore.periods[key] = buildEmptyPeriodFromTemplate(template, key);
      }
      normalizeData(targetStore.periods[key]);
      return targetStore.periods[key];
    }

    /** @param {string} [periodKey] @param {AppStore} [storeRef] @returns {Recado[]} */
    function getStoreRecados(periodKey = currentPeriodKey, storeRef = storage) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      const period = targetStore?.periods?.[String(periodKey || currentPeriodKey)];
      if (!period || typeof period !== 'object') return [];
      normalizeData(period);
      return normalizeRecadosCollection(period.recados);
    }

    /** @param {AppStore} [storeRef] @param {Object} [options] @returns {Promise<boolean>} */
    async function migrateLegacyRecadosToStore(storeRef = storage, options = {}) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      if (!targetStore?.periods) return false;

      const legacyPeriodKeys = getLegacyRecadoPeriodKeys();
      if (!legacyPeriodKeys.length) return false;

      let changed = false;
      const syncedKeys = [];

      legacyPeriodKeys.forEach(key => {
        const legacyRecados = readLegacyRecados(key);
        if (!legacyRecados.length) return;

        const period = ensureRecadosPeriod(key, targetStore);
        if (!period) return;

        const merged = mergeRecadosCollections(period.recados, legacyRecados);
        syncedKeys.push(key);
        if (areRecadosCollectionsEqual(period.recados, merged)) return;

        period.recados = merged;
        changed = true;
      });

      let saved = true;
      if (changed && options.persist === true) {
        saved = await saveStore(targetStore, {
          silent: true,
          broadcast: false,
          eventType: String(options?.eventType || 'recados-migration')
        });
      }

      if (saved && options.cleanup !== false) {
        syncedKeys.forEach(clearLegacyRecadosStorageKey);
      }

      return changed;
    }

    /** @param {string} [periodKey] @returns {Recado[]} */
    function loadRecados(periodKey = currentPeriodKey) {
      const key = String(periodKey || currentPeriodKey);
      return mergeRecadosCollections(getStoreRecados(key), readLegacyRecados(key));
    }

    /** @param {Recado[]} recados @param {string} [periodKey] @returns {Promise<boolean>} */
    async function saveRecados(recados, periodKey = currentPeriodKey) {
      try {
        const key = String(periodKey || currentPeriodKey);
        const period = ensureRecadosPeriod(key);
        if (!period) throw new Error('Período indisponível para salvar recados.');

        period.recados = normalizeRecadosCollection(recados);
        if (key === currentPeriodKey) state = period;

        const saved = key === currentPeriodKey
          ? await saveData({ silent: true, eventType: 'recados' })
          : await saveStore(storage, { silent: true, eventType: 'recados' });

        if (!saved) return false;
        clearLegacyRecadosStorageKey(key);
        return true;
      } catch (error) {
        console.error('Falha ao salvar recados:', error);
        showToast('Não foi possível salvar os recados deste mês.', 'danger');
        return false;
      }
    }

    // formatRecadoDateTime já existe em src/utils/helpers.js (duplicata removida)

    /** @param {string} [periodKey] @returns {number} */
    function getUnreadRecadosCount(periodKey = currentPeriodKey) {
      return loadRecados(periodKey).filter(item => !item.read).length;
    }

    /** @returns {void} */
    function syncRecadosSelects() {
      const fromSelect = document.getElementById('recadoFrom');
      const toSelect = document.getElementById('recadoTo');
      if (!fromSelect || !toSelect) return;

      const recepcionistas = getReceptionists(state);
      const currentFrom = fromSelect.value;
      const currentTo = toSelect.value;

      fromSelect.innerHTML = recepcionistas.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      toSelect.innerHTML = `<option value="Todos">Todos</option>${recepcionistas.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}`;

      fromSelect.value = recepcionistas.includes(currentFrom) ? currentFrom : (recepcionistas[0] || '');
      toSelect.value = currentTo === 'Todos' || recepcionistas.includes(currentTo) ? (currentTo || 'Todos') : 'Todos';
    }

    /** @returns {void} */
    function renderFeedbackSummary() {
      const host = document.getElementById('feedbackSummary');
      if (!host) return;

      const summary = selecionarIndicadoresDashboard().resumoRecepcionistas || [];
      if (!summary.length) {
        aplicarHtmlSeMudou(host, `<div class="feedback-summary-chip">Sem base suficiente para resumir o feedback da equipe.</div>`);
        return;
      }

      const best = summary.slice().sort((a, b) => b.taxaPositiva - a.taxaPositiva || b.total - a.total)[0];
      const average = summary.reduce((acc, row) => acc + Number(row.taxaPositiva || 0), 0) / summary.length;

      aplicarHtmlSeMudou(host, `
        <div class="feedback-summary-chip">Melhor: <strong>${esc(best.nome)}</strong> (${formatPct(best.taxaPositiva)})</div>
        <div class="feedback-summary-chip">Média da equipe: <strong>${formatPctPrecise(average)}</strong></div>
      `);
    }

    /** @param {number} [unreadCount] @returns {void} */
    function renderHeroRecadosBadge(unreadCount = getUnreadRecadosCount()) {
      const cards = [...document.querySelectorAll('#heroSummary .mini-stat')];
      if (!cards.length) return;

      cards.forEach((card, index) => {
        card.classList.toggle('mini-stat--wide', index === 0);
      });

      const firstCard = cards[0];
      let badge = firstCard.querySelector('.mini-stat-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'mini-stat-badge';
        firstCard.appendChild(badge);
      }
      badge.textContent = unreadCount
        ? `${unreadCount} recado${unreadCount === 1 ? '' : 's'} não lido${unreadCount === 1 ? '' : 's'}`
        : 'Nenhum recado pendente';
      badge.classList.toggle('is-active', unreadCount > 0);
    }

    /** @returns {void} */
    function renderRecadosPanel() {
      const list = document.getElementById('recadosList');
      const counter = document.getElementById('recadosCounter');
      if (!list || !counter) return;

      syncRecadosSelects();

      const recados = loadRecados();
      const unreadCount = recados.filter(item => !item.read).length;

      counter.textContent = `${unreadCount} recado${unreadCount === 1 ? '' : 's'} não lido${unreadCount === 1 ? '' : 's'}`;
      counter.classList.toggle('has-unread', unreadCount > 0);
      renderHeroRecadosBadge(unreadCount);

      if (!recados.length) {
        aplicarHtmlSeMudou(
          list,
          `<div class="empty recado-empty">Nenhum recado publicado em ${esc(getPeriodLabel())}. Use o formulário acima para deixar o primeiro aviso do turno.</div>`
        );
        return;
      }

      aplicarPatchCards(list, recados, item => item.id, item => `
        <article class="recado-card ${item.read ? '' : 'recado-card--unread'}">
          <div class="recado-top">
            <div class="recado-route">
              <span class="recado-pill">${esc(item.from)}</span>
              <span class="recado-pill recado-pill--to">${esc(item.to || 'Todos')}</span>
            </div>
            <div class="recado-meta">
              <span>${esc(formatRecadoDateTime(item.createdAt))}</span>
              <span class="recado-badge ${item.read ? '' : 'recado-badge--unread'}">${item.read ? 'Lido' : 'Não lido'}</span>
            </div>
          </div>
          <div class="recado-text">${esc(item.text)}</div>
          <div class="recado-actions">
            ${item.read ? '<button type="button" class="btn btn-ghost btn-xs" disabled>Lido</button>' : `<button type="button" class="btn btn-success btn-xs" data-recado-action="mark-read" data-recado-id="${esc(item.id)}">Marcar como lido</button>`}
            <button type="button" class="btn btn-danger btn-xs" data-recado-action="delete" data-recado-id="${esc(item.id)}">Excluir</button>
          </div>
        </article>
      `);
    }

    /** @returns {Promise<void>} */
    async function publishRecado() {
      if (!assertWritableCurrentPeriod()) return;
      const from = String(document.getElementById('recadoFrom')?.value || '').trim();
      const to = String(document.getElementById('recadoTo')?.value || 'Todos').trim() || 'Todos';
      const text = String(document.getElementById('recadoMessage')?.value || '').trim();

      if (!from) {
        showToast('Selecione quem está deixando o recado.', 'warning');
        return;
      }
      if (!text) {
        showToast('Escreva o recado antes de publicar.', 'warning');
        return;
      }

      const recados = loadRecados();
      recados.unshift({
        id: createRecadoId(),
        from,
        to,
        text,
        createdAt: new Date().toISOString(),
        read: false
      });

      if (!await saveRecados(recados)) return;

      document.getElementById('recadosForm')?.reset();
      syncRecadosSelects();
      renderRecadosPanel();
      document.getElementById('recadoMessage')?.focus();
      showToast('✓ recado publicado para o próximo turno.', 'success');
    }

    /** @param {string} id @returns {Promise<void>} */
    async function markRecadoAsRead(id) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard'] })) return;
      const recados = loadRecados();
      const next = recados.map(item => item.id === id ? { ...item, read: true } : item);
      if (!await saveRecados(next)) return;
      renderRecadosPanel();
    }

    /** @param {string} id @returns {void} */
    function removeRecado(id) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard'] })) return;
      const recados = loadRecados();
      const target = recados.find(item => item.id === id);
      if (!target) return;

      showConfirm(`Excluir o recado de ${target.from} para ${target.to}?`, async () => {
        const next = loadRecados().filter(item => item.id !== id);
        if (!await saveRecados(next)) return;
        renderRecadosPanel();
        showToast('✓ recado excluído.', 'success');
      });
    }

    /** @returns {void} */
    function bindRecadosModule() {
      if (recadosModuleBound) return;
      recadosModuleBound = true;

      document.addEventListener('submit', e => {
        if (e.target?.id !== 'recadosForm') return;
        e.preventDefault();
        publishRecado();
      });

      document.addEventListener('click', e => {
        const action = e.target.closest('[data-recado-action]');
        if (!action) return;

        if (action.dataset.recadoAction === 'mark-read') {
          markRecadoAsRead(action.dataset.recadoId);
          return;
        }
        if (action.dataset.recadoAction === 'delete') {
          removeRecado(action.dataset.recadoId);
        }
      });

      window.addEventListener('storage', e => {
        if (!e.key || !e.key.startsWith(RECADOS_STORAGE_PREFIX)) return;
        renderRecadosPanel();
      });
    }

    /** @returns {void} */
    function installDashboardEnhancements() {
      if (dashboardEnhancementsInstalled) return;
      dashboardEnhancementsInstalled = true;
      bindRecadosModule();

      const baseRenderHero = renderHero;
      renderHero = function renderHeroEnhanced() {
        baseRenderHero();
        renderHeroRecadosBadge();
      };

      const baseRenderDashboard = renderDashboard;
      renderDashboard = function renderDashboardEnhanced() {
        baseRenderDashboard();
        renderFeedbackSummary();
        renderRecadosPanel();
      };
    }

    installDashboardEnhancements();
