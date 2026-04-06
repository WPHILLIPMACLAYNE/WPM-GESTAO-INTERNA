    // Fonte única de verdade para bindings de UI — IDs derivados do array de bindings
    const UI_BINDINGS = [
      { id: 'studentSearch', event: 'input', key: 'studentSearch', alvo: 'students' },
      { id: 'studentFilterAtendente', event: 'change', key: 'studentFilterAtendente', alvo: 'students' },
      { id: 'studentFilterFeedback', event: 'change', key: 'studentFilterFeedback', alvo: 'students' },
      { id: 'pendingSearch', event: 'input', key: 'pendingSearch', alvo: 'pending' },
      { id: 'eventSearch', event: 'input', key: 'eventSearch', alvo: 'events' },
      { id: 'eventTypeFilter', event: 'change', key: 'eventTypeFilter', alvo: 'events' },
      { id: 'eventStatusFilter', event: 'change', key: 'eventStatusFilter', alvo: 'events' },
      { id: 'scaleSearch', event: 'input', key: 'scaleSearch', alvo: 'scale' }
    ];

    const UI_CONTROL_IDS = UI_BINDINGS.map(b => b.id);

    const AREAS_RENDERIZACAO = ['hero', 'dashboard', 'students', 'addons', 'pending', 'nps', 'scale', 'events', 'settings'];
    const estadoRenderizacao = {
      sujas: new Set(),
      agendado: false,
      idQuadro: 0,
      renderizando: false,
      ultimoLote: [],
      controlesUiInicializados: false
    };

    function getStudentViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.studentSearch || ''),
        person: String(ui.studentFilterAtendente || ''),
        feedback: String(ui.studentFilterFeedback || '')
      };
    }

    function getPendingViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.pendingSearch || '')
      };
    }

    function getEventViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.eventSearch || ''),
        typeFilter: String(ui.eventTypeFilter || '').trim(),
        statusFilter: String(ui.eventStatusFilter || '').trim()
      };
    }

    function getScaleViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.scaleSearch || '')
      };
    }

    // Dispatch map para renderização — elimina switch gigante
    const RENDER_MAP = {
      hero: renderHero,
      dashboard: renderDashboard,
      students: renderStudents,
      addons: renderAddons,
      pending: renderPending,
      nps: renderNps,
      scale: renderScale,
      events: renderEvents,
      settings: renderSettings
    };

    function renderSection(section) {
      RENDER_MAP[section]?.();
    }

    function renderSections(...sections) {
      [...new Set(sections.flat().filter(Boolean))].forEach(renderSection);
    }

    function normalizarAlvosRender(alvos = []) {
      const lista = Array.isArray(alvos) ? alvos.flat() : [alvos];
      const normalizados = lista.filter(Boolean).flatMap(alvo => alvo === 'all' || alvo === 'tudo' ? AREAS_RENDERIZACAO : [alvo]);
      return [...new Set(normalizados.filter(alvo => AREAS_RENDERIZACAO.includes(alvo)))];
    }

    function requestRender(alvos = []) {
      const normalizados = normalizarAlvosRender(alvos);
      if (!normalizados.length) return;
      normalizados.forEach(alvo => estadoRenderizacao.sujas.add(alvo));
      if (estadoRenderizacao.renderizando || estadoRenderizacao.agendado) return;
      estadoRenderizacao.agendado = true;
      estadoRenderizacao.idQuadro = window.requestAnimationFrame(executarRenderAgendado);
    }

    function limparFilaRender() {
      if (estadoRenderizacao.idQuadro) {
        window.cancelAnimationFrame(estadoRenderizacao.idQuadro);
      }
      estadoRenderizacao.sujas.clear();
      estadoRenderizacao.agendado = false;
      estadoRenderizacao.idQuadro = 0;
      estadoRenderizacao.ultimoLote = [];
    }

    function executarRenderAgendado() {
      estadoRenderizacao.agendado = false;
      estadoRenderizacao.idQuadro = 0;
      if (!estadoRenderizacao.sujas.size) return;

      const alvos = normalizarAlvosRender([...estadoRenderizacao.sujas]);
      estadoRenderizacao.sujas.clear();
      estadoRenderizacao.renderizando = true;
      estadoRenderizacao.ultimoLote = alvos;

      try {
        alvos.forEach(renderSection);
      } finally {
        estadoRenderizacao.renderizando = false;
      }

      syncCurrentPeriodLockUI();

      if (estadoRenderizacao.sujas.size) {
        requestRender([...estadoRenderizacao.sujas]);
      }
    }

    function applyUIStateToControls(ui = sanitizeUIState(getUIState())) {
      UI_CONTROL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const value = ui[id];
        if (value != null) el.value = value;
      });
    }

    function initUIBindings() {
      if (estadoRenderizacao.controlesUiInicializados) return;
      estadoRenderizacao.controlesUiInicializados = true;

      const debounceTimers = {};
      UI_BINDINGS.forEach(({ id, event, key, alvo }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(event, e => {
          saveUIState({ [key]: e.target.value });
          if (event === 'input') {
            clearTimeout(debounceTimers[id]);
            debounceTimers[id] = setTimeout(() => requestRender(alvo), 150);
          } else {
            requestRender(alvo);
          }
        });
      });
    }

    function resetViewFilters(view) {
      const nextState = {};
      if (view === 'events') {
        nextState.eventSearch = '';
        nextState.eventTypeFilter = '';
        nextState.eventStatusFilter = '';
        saveUIState(nextState);
        applyUIStateToControls({ ...getUIState(), ...nextState });
        requestRender('events');
        showSaveToast('✓ filtros de eventos limpos');
        return;
      }
      if (view === 'scale') {
        nextState.scaleSearch = '';
        saveUIState(nextState);
        applyUIStateToControls({ ...getUIState(), ...nextState });
        requestRender('scale');
        showSaveToast('✓ busca da escala limpa');
      }
    }

    // ══════════════════════════════════════════
    // HELPERS DE PATCH DE DOM — patch explícito por chave, sem virtual DOM
    // ══════════════════════════════════════════

    function criarAssinaturaHtml(html) {
      let hash = 5381;
      for (let i = 0; i < html.length; i++) {
        hash = ((hash << 5) + hash) ^ html.charCodeAt(i);
      }
      return String(hash >>> 0);
    }

    function criarNoRenderizado(html, chave, assinatura) {
      const template = document.createElement('template');
      template.innerHTML = sanitizeHtml(html.trim());
      const no = template.content.firstElementChild;
      if (!no) throw new Error('Renderização sem nó raiz.');
      no.dataset.chaveRender = String(chave);
      no.dataset.assinaturaRender = assinatura;
      return no;
    }

    function escaparSeletorCss(valor) {
      if (window.CSS?.escape) return window.CSS.escape(String(valor));
      return String(valor).replace(/["\\]/g, '\\$&');
    }

    function obterSeletorFoco(el) {
      if (!el) return null;
      if (el.id) return `#${escaparSeletorCss(el.id)}`;
      const partes = [el.tagName.toLowerCase()];
      const atributos = ['data-change-action', 'data-id', 'data-field', 'data-input-action', 'data-scale-shift', 'data-index', 'data-blur-action', 'data-action', 'data-person', 'name'];
      atributos.forEach(atributo => {
        if (!el.hasAttribute?.(atributo)) return;
        partes.push(`[${atributo}="${escaparSeletorCss(el.getAttribute(atributo))}"]`);
      });
      return partes.length > 1 ? partes.join('') : null;
    }

    function capturarEstadoFoco(container) {
      const ativo = document.activeElement;
      if (!ativo || !container?.contains(ativo)) return null;
      return {
        seletor: obterSeletorFoco(ativo),
        valor: 'value' in ativo ? ativo.value : null,
        inicio: typeof ativo.selectionStart === 'number' ? ativo.selectionStart : null,
        fim: typeof ativo.selectionEnd === 'number' ? ativo.selectionEnd : null
      };
    }

    function restaurarEstadoFoco(container, estado) {
      if (!container || !estado?.seletor) return;
      const alvo = container.querySelector(estado.seletor);
      if (!alvo) return;
      alvo.focus({ preventScroll: true });
      if (typeof alvo.setSelectionRange === 'function' && estado.inicio != null && estado.fim != null) {
        try {
          alvo.setSelectionRange(estado.inicio, estado.fim);
        } catch {}
      }
    }

    function aplicarHtmlSeMudou(el, html) {
      if (!el) return;
      const assinatura = criarAssinaturaHtml(html);
      if (el.dataset.assinaturaRender === assinatura) return;
      el.innerHTML = sanitizeHtml(html);
      el.dataset.assinaturaRender = assinatura;
    }

    function aplicarPatchPorChave(container, descritores = []) {
      if (!container) return;
      const foco = capturarEstadoFoco(container);
      const existentes = new Map(Array.from(container.children).map(no => [String(no.dataset.chaveRender || ''), no]));
      const desejados = descritores.map(({ chave, html }) => {
        const chaveNormalizada = String(chave);
        const assinatura = criarAssinaturaHtml(html);
        const existente = existentes.get(chaveNormalizada);
        if (existente && existente.dataset.assinaturaRender === assinatura) {
          existentes.delete(chaveNormalizada);
          return existente;
        }
        const novoNo = criarNoRenderizado(html, chaveNormalizada, assinatura);
        existentes.delete(chaveNormalizada);
        return novoNo;
      });

      if (!container.children.length) {
        const fragmento = document.createDocumentFragment();
        desejados.forEach(no => fragmento.appendChild(no));
        container.replaceChildren(fragmento);
        restaurarEstadoFoco(container, foco);
        return;
      }

      const fragmento = document.createDocumentFragment();
      desejados.forEach(no => fragmento.appendChild(no));
      container.replaceChildren(fragmento);
      restaurarEstadoFoco(container, foco);
    }

    function aplicarPatchLinhas(container, itens, obterChave, renderizarLinha) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarLinha(item)
      })));
    }

    function aplicarPatchCards(container, itens, obterChave, renderizarCard) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarCard(item)
      })));
    }

    function aplicarPatchItensKanban(container, itens, obterChave, renderizarCard) {
      aplicarPatchCards(container, itens, obterChave, renderizarCard);
    }

    function aplicarPatchBlocosAgrupados(container, itens, obterChave, renderizarBloco) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarBloco(item)
      })));
    }

    // Date/period helpers já existem em src/utils/helpers.js (cópias removidas)

    function getUpcomingScale() {
      const sorted = [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      if (!sorted.length) return null;
      const today = todayISO();
      return sorted.find(item => String(item.date || '') >= today) || sorted[0];
    }

    function getUpcomingEvent(source = state.events) {
      const sorted = [...(Array.isArray(source) ? source : [])].sort(compareByDateTime);
      if (!sorted.length) return null;
      const nowKey = `${todayISO()}T00:00`;
      return sorted.find(item => `${item.date || ''}T${item.time || '00:00'}` >= nowKey && item.status !== 'Cancelado') || sorted[0];
    }

    function toneLabel(value) {
      return value === 'green' ? 'Sábado' : value === 'red' ? 'Feriado' : 'Dia normal';
    }

    function eventStatusClass(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (key.includes('confirm')) return 'event-status-confirmado';
      if (key.includes('concl')) return 'event-status-concluido';
      if (key.includes('cancel')) return 'event-status-cancelado';
      return 'event-status-programado';
    }

    function normalizeSearchText(value) {
      return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    }

    function getScaleFilteredList() {
      const { query } = getScaleViewFilters();
      const list = Array.isArray(state.scale) ? state.scale.slice() : [];
      const filtered = query ? list.filter(item => {
        const shifts = Array.isArray(item.professorShifts) ? item.professorShifts : [];
        const haystack = normalizeSearchText([
          item.date,
          getPeriodDisplayDate(item.date),
          getWeekdayLabel(item.date),
          toneLabel(item.rowTone || 'neutral'),
          item.receptionTime,
          item.receptionist,
          item.receptionSwap,
          item.note,
          ...shifts.flatMap(shift => [shift.time, shift.name, shift.swap])
        ].join(' '));
        return haystack.includes(query);
      }) : list;
      return filtered.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    }

    function getEventsFilteredList() {
      const { query, typeFilter, statusFilter } = getEventViewFilters();
      const list = Array.isArray(state.events) ? state.events.slice() : [];
      const filtered = list.filter(item => {
        const matchesQuery = !query || normalizeSearchText([
          item.date,
          getPeriodDisplayDate(item.date),
          item.time,
          item.type,
          item.title,
          item.place,
          item.owner,
          item.status,
          item.description
        ].join(' ')).includes(query);
        const matchesType = !typeFilter || String(item.type || '') === typeFilter;
        const matchesStatus = !statusFilter || String(item.status || '') === statusFilter;
        return matchesQuery && matchesType && matchesStatus;
      });
      return filtered.sort(compareByDateTime);
    }

    function getScaleSummaryText(item) {
      if (!item) return 'Nenhuma escala cadastrada no período.';
      const profs = item.professorShifts.filter(shift => shift.name).map(shift => shift.name);
      const professorText = profs.length ? profs.join(' • ') : 'Sem professor definido';
      const receptionText = item.receptionist || 'Sem recepcionista definido';
      return `Prof.: ${professorText} • Recepção: ${receptionText}`;
    }

    function getEventSummaryText(item) {
      if (!item) return 'Nenhum evento ou ação programado neste período.';
      return `${item.type || 'Agenda'} • ${getPeriodDisplayDate(item.date)}${item.time ? ` • ${item.time}` : ''}`;
    }

    function suggestScaleTone(dateStr) {
      if (!dateStr) return 'neutral';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return 'neutral';
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (weekday === 6) return 'green';
      return 'neutral';
    }

    function normalizeEventType(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (key.includes('acao')) return 'acao';
      if (key.includes('camp')) return 'campanha';
      if (key.includes('trein')) return 'treinamento';
      if (key.includes('feriado')) return 'feriado';
      if (key.includes('evento')) return 'evento';
      return 'outro';
    }

    function getCurrentPeriodDateInfo() {
      const [yearStr, monthStr] = String(currentPeriodKey).split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
      return { year, monthIndex, totalDays, firstWeekday };
    }

    function renderEventsCalendar(dadosEventos) {
      const holder = document.getElementById('eventsCalendar');
      if (!holder) return;
      const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const { year, monthIndex, totalDays, firstWeekday } = getCurrentPeriodDateInfo();
      const map = dadosEventos?.porDia || new Map();
      const today = todayISO();
      aplicarHtmlSeMudou(holder, `<div class="event-calendar-scroll"><div id="eventsCalendarGrid" class="event-calendar-grid"></div></div>`);
      const grid = document.getElementById('eventsCalendarGrid');
      if (!grid) return;

      const blocos = [
        ...weekdays.map(label => ({
          chave: `cabecalho-${label}`,
          html: `<div class="event-weekday-head">${label}</div>`
        })),
        ...Array.from({ length: firstWeekday }, (_, indice) => ({
          chave: `vazio-${indice}`,
          html: `<div class="event-calendar-day empty" aria-hidden="true"></div>`
        })),
        ...Array.from({ length: totalDays }, (_, idx) => {
          const day = idx + 1;
          const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const items = (map.get(day) || []).sort(compareByDateTime);
          const topItems = items.slice(0, 3).map(item => {
            const kind = normalizeEventType(item.type);
            return `<div class="event-day-pill type-${kind}">
              <div class="event-day-time ${item.time ? '' : 'wrap'}">${item.time ? esc(item.time) : (item.type === 'Feriado' ? 'Dia todo' : 'Sem horário')}</div>
              <div class="event-day-name">${esc(item.title || item.type || 'Agenda')}</div>
              <div class="event-day-extra">${esc(item.owner || item.place || item.status || '')}</div>
            </div>`;
          }).join('');
          return {
            chave: date,
            html: `<div class="event-calendar-day ${items.length ? 'has-items' : ''} ${date === today ? 'today' : ''}">
              <div class="event-day-top">
                <div class="event-day-number">${String(day).padStart(2, '0')}</div>
                <div class="event-day-count">${items.length ? `${items.length} ${items.length > 1 ? 'itens' : 'item'}` : 'Livre'}</div>
              </div>
              <div class="event-day-list">
                ${topItems || `<div class="event-day-empty-note">Sem agenda</div>`}
                ${items.length > 3 ? `<div class="event-day-more">+ ${items.length - 3} registro(s) neste dia</div>` : ''}
              </div>
            </div>`
          };
        })
      ];

      aplicarPatchBlocosAgrupados(grid, blocos, bloco => bloco.chave, bloco => bloco.html);
    }

    // ══════════════════════════════════════════

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
          <div class="progress-track"><div class="progress-fill" style="width:${bestFeedback ? Math.round(bestFeedback.taxaPositiva * 100) : 0}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Líder de addons</div><div class="insight-badge">${addonLeaderTotal}</div></div>
          <div class="insight-value">${addonLeaderName ? esc(addonLeaderName) : 'Sem dados'}</div>
          <div class="insight-meta">${addonLeaderName ? `Maior volume acumulado nas vendas complementares deste mês.` : 'A contagem automática aparece quando o addon é marcado no novo atendimento.'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, addonLeaderTotal * 8)}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Líder NPS</div><div class="insight-badge">${topMention ? topMention.count : 0}</div></div>
          <div class="insight-value">${topMention ? esc(topMention.name) : 'Nenhuma citação registrada'}</div>
          <div class="insight-meta">${topMention ? `#1 • ${topMention.count} ${topMention.count === 1 ? 'citação' : 'citações'} no mês.` : 'Nenhuma citação registrada'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${topMention && totalMentions ? Math.round((topMention.count / totalMentions) * 100) : 0}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Urgência operacional</div><div class="insight-badge">${oldest ? `${diffInDays(oldest.data)}d` : 'OK'}</div></div>
          <div class="insight-value">${oldest ? esc(oldest.nome) : 'Sem pendência crítica'}</div>
          <div class="insight-meta">${oldest ? `Aberta desde ${formatDate(oldest.data)} • ${esc(oldest.hostess || 'Sem responsável')}` : 'Nenhuma pendência aberta exigindo escalonamento imediato.'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, oldest ? diffInDays(oldest.data) * 12 : 0)}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Meta NPS</div><div class="insight-badge">${score}</div></div>
          <div class="insight-value">Mensal ${monthlyGoal} • Semestral ${semesterGoal}</div>
          <div class="insight-meta">${score >= monthlyGoal ? 'Meta mensal alcançada.' : `Faltam ${Math.max(0, monthlyGoal - score)} pts para a meta mensal.`} ${score >= semesterGoal ? 'Meta semestral alcançada.' : `Semestral: faltam ${Math.max(0, semesterGoal - score)} pts.`}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.max(monthlyPct, semesterPct)}%"></div></div>
        </div>
      `);
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — DASHBOARD & HERO — renderHero, renderDashboard
    // ══════════════════════════════════════════

    function renderHero() {
      syncPeriodControls();
      const indicadores = selecionarIndicadoresDashboard();
      const students = indicadores.totalAlunos;
      const pendingOpen = indicadores.pendenciasAbertas;
      const addons = indicadores.totaisAddons.totalGeral;
      const currentNps = indicadores.npsAtual;
      document.getElementById('heroSummary').innerHTML = `
        <div class="mini-stat">
          <div class="label">Período ativo</div>
          <div class="value" style="font-size:22px">${esc(getPeriodLabel())}</div>
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
      `;
    }

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

      renderDashboardInsights(indicadores);

      const summaryList = document.getElementById('summaryList');
      if (!summary.length) {
        aplicarHtmlSeMudou(summaryList, `<div class="empty">Nenhum atendente configurado.</div>`);
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
      feedbackChart.style.minWidth = `${Math.max(summary.length * 88, 560)}px`;
      feedbackChart.style.alignItems = 'flex-end';
      if (!summary.length) {
        aplicarHtmlSeMudou(feedbackChart, `<div class="empty">Sem dados para exibir.</div>`);
      } else {
        aplicarPatchCards(feedbackChart, summary, item => item.nome, s => {
          const h = Math.max(8, (s.taxaPositiva / maxPositiveRate) * 190);
          return `
            <div class="bar-col" data-tooltip="${esc(s.nome)} • ${formatPct(s.taxaPositiva)} positivo">
              <div class="bar-value">${formatPct(s.taxaPositiva)}</div>
              <div class="bar" style="height:${h}px"></div>
              <div class="bar-label" title="${esc(s.nome)}">${esc(s.nome)}</div>
            </div>
          `;
        });
      }

      const addonsOverview = document.getElementById('addonsOverview');
      const addonPeople = getAddonPeople(state);
      const activeReceptionists = new Set(getReceptionists(state));
      if (!addonPeople.length) {
        aplicarHtmlSeMudou(addonsOverview, '<div class="empty">Sem atendentes cadastrados.</div>');
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
          `).join('') || '<div class="empty">Nenhuma pendência cadastrada.</div>'}
        </div>
      `);
    }

    // ══════════════════════════════════════════
    // ENHANCEMENTS — DASHBOARD VISUAL + PAINEL DE RECADOS (INDEPENDENTE)
    // ══════════════════════════════════════════

    const RECADOS_STORAGE_PREFIX = 'wpm_recados_';
    let recadosModuleBound = false;
    let dashboardEnhancementsInstalled = false;

    function createRecadoId() {
      return window.crypto?.randomUUID?.() || `recado-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    function getRecadosStorageKey(periodKey = currentPeriodKey) {
      const [year = String(new Date().getFullYear()), month = '01'] = String(periodKey || '').split('-');
      return `${RECADOS_STORAGE_PREFIX}${year}-${String(month).padStart(2, '0')}`;
    }

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

    function normalizeRecadosCollection(recados) {
      return (Array.isArray(recados) ? recados : [])
        .map(sanitizeRecado)
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

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

    function areRecadosCollectionsEqual(left, right) {
      return JSON.stringify(normalizeRecadosCollection(left)) === JSON.stringify(normalizeRecadosCollection(right));
    }

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

    function clearLegacyRecadosStorageKey(periodKey = currentPeriodKey) {
      try {
        localStorage.removeItem(getRecadosStorageKey(periodKey));
        return true;
      } catch (error) {
        console.error('Falha ao limpar recados legados:', error);
        return false;
      }
    }

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

    function getStoreRecados(periodKey = currentPeriodKey, storeRef = storage) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      const period = targetStore?.periods?.[String(periodKey || currentPeriodKey)];
      if (!period || typeof period !== 'object') return [];
      normalizeData(period);
      return normalizeRecadosCollection(period.recados);
    }

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

    function loadRecados(periodKey = currentPeriodKey) {
      const key = String(periodKey || currentPeriodKey);
      return mergeRecadosCollections(getStoreRecados(key), readLegacyRecados(key));
    }

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

    function formatPctPrecise(value) {
      const pct = Number(value || 0) * 100;
      const isInteger = Math.abs(pct - Math.round(pct)) < 0.001;
      return `${pct.toLocaleString('pt-BR', {
        minimumFractionDigits: isInteger ? 0 : 2,
        maximumFractionDigits: 2
      })}%`;
    }

    function getUnreadRecadosCount(periodKey = currentPeriodKey) {
      return loadRecados(periodKey).filter(item => !item.read).length;
    }

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

    async function markRecadoAsRead(id) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard'] })) return;
      const recados = loadRecados();
      const next = recados.map(item => item.id === id ? { ...item, read: true } : item);
      if (!await saveRecados(next)) return;
      renderRecadosPanel();
    }

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

    // ══════════════════════════════════════════
    // MÓDULO CRUD GENÉRICO — saveEntity, createCrudHandler
    // Encapsula o padrão comum de validação → persistência → rollback → UI
    // ══════════════════════════════════════════

    /**
     * Cria um handler genérico para operações de save (create/update).
     *
     * @param {Object} config
     * @param {string} config.name — Nome da entidade (ex: 'student', 'pending', 'event')
     * @param {Array} config.collection — Referência ao array no state (ex: state.students)
     * @param {Function} config.getFormData — Função que retorna o objeto do formulário
     * @param {Function} config.applySave — Função apply*Save(state, formData, existing) → result
     * @param {Function} config.getValidationErrors — Mapeia result.validation.errors → [{id, message}]
     * @param {Function} [config.onBeforeSave] — Hook pré-salvamento (ex: applyStudentAddonLink)
     * @param {Function} [config.onAfterSave] — Hook pós-salvamento com sucesso
     * @param {Function} config.finalizeUI — Função chamada após save bem-sucedido
     * @param {Function} config.renderUI — Função de renderização pós-save
     * @param {Array<string>} config.renderTargets — Seções para re-renderizar
     * @param {Function} [config.duplicateCheck] — (Opcional) Detecta duplicatas e retorna mensagem
     * @returns {Function} async () => { ... } — Handler pronto para uso
     */
    // CRUD handlers movidos para src/features/crud.js

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — STUDENTS & ADDONS — renderStudents, saveStudent, removeStudent, renderAddons, updateAddon, addPerson, renamePerson
    // ══════════════════════════════════════════

    function renderStudents() {
      const tbody = document.getElementById('studentTableBody');
      const { query, person, feedback } = getStudentViewFilters();
      const allRows = state.students;
      const totalStudents = allRows.length;
      const byAttendant = getReceptionists(state)
        .map(name => `${name}: ${allRows.filter(item => item.atendimento === name).length}`)
        .join(' • ');
      const respondedCount = allRows.filter(item => item.feedback !== 'Pendente').length;
      const pendingFeedbackCount = allRows.filter(item => item.feedback === 'Pendente').length;
      const addonsCount = allRows.filter(item => item.addon).length;
      aplicarHtmlSeMudou(
        document.getElementById('studentsSectionTitle'),
        `ALUNOS NOVOS (MÊS) — ${totalStudents} registro${totalStudents === 1 ? '' : 's'}`
      );
      aplicarHtmlSeMudou(
        document.getElementById('studentsSummaryBar'),
        `
          <div class="students-summary-item students-summary-item--total">
            <span class="students-summary-label">Total de alunos</span>
            <strong class="students-summary-value">${totalStudents}</strong>
          </div>
          <div class="students-summary-item students-summary-item--attendants">
            <span class="students-summary-label">Atendimentos por atendente</span>
            <strong class="students-summary-value">${esc(byAttendant || 'Sem dados')}</strong>
          </div>
          <div class="students-summary-item students-summary-item--feedback">
            <span class="students-summary-label">Feedbacks</span>
            <strong class="students-summary-value">${respondedCount} respondidos</strong>
            <span class="students-summary-meta">${pendingFeedbackCount} pendentes</span>
          </div>
          <div class="students-summary-item students-summary-item--addons">
            <span class="students-summary-label">Addons vendidos</span>
            <strong class="students-summary-value">${addonsCount}</strong>
          </div>
        `
      );
      const rows = state.students.filter(s => {
        const hay = normalizeSearchText([s.nome, s.matricula, s.atendimento, s.observacoes, s.addon].join(' '));
        return (!query || hay.includes(query)) && (!person || s.atendimento === person) && (!feedback || s.feedback === feedback);
      });
      if (!rows.length) {
        aplicarHtmlSeMudou(tbody, `<tr><td colspan="11"><div class="empty">Nenhum atendimento encontrado.</div></td></tr>`);
        return;
      }
      aplicarPatchLinhas(tbody, rows, item => item.id, s => `
        <tr>
          <td><strong>${esc(s.nome)}</strong></td>
          <td>${esc(s.matricula || '-')}</td>
          <td><input class="table-input" type="date" value="${esc(s.ultimaVisita || '')}" aria-label="Última visita de ${esc(s.nome)}" data-change-action="update-student-inline" data-id="${s.id}" data-field="ultimaVisita" /></td>
          <td><input class="table-input" type="time" value="${esc(s.horaVisita || '')}" aria-label="Hora da visita de ${esc(s.nome)}" data-change-action="update-student-inline" data-id="${s.id}" data-field="horaVisita" /></td>
          <td><span class="table-date-static">${formatDate(s.inicio)}</span></td>
          <td>${npsPill(s.avisoNps)}</td>
          <td>${esc(s.atendimento || '-')}</td>
          <td>${studentStatusPill(s.feedback)}</td>
          <td>${s.addon ? `<span class="pill info">${esc(s.addon)}</span>` : '<span class="pill" style="background:rgba(255,255,255,0.06);color:var(--muted-2);">Nenhum</span>'}</td>
          <td>${renderEllipsisCell(s.observacoes, '-')}</td>
          <td class="right">
            <button class="btn btn-ghost btn-xs" data-action="edit-student" data-id="${s.id}" aria-label="Editar atendimento de ${esc(s.nome)}">Editar</button>
            <button class="btn btn-danger btn-xs" data-action="remove-student" data-id="${s.id}" aria-label="Excluir atendimento de ${esc(s.nome)}">Excluir</button>
          </td>
        </tr>
      `);
    }

    function updateStudentInline(id, field, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'students'] })) return;
      const target = state.students.find(s => s.id === id);
      if (!target) return;
      target[field] = value;
      saveData();
      requestRender(['hero', 'dashboard', 'students']);
    }

    function populateStudentFilters() {
      const options = `<option value="">Todos os atendentes</option>` + getReceptionists(state).map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      document.getElementById('studentFilterAtendente').innerHTML = options;
      document.getElementById('student_atendimento').innerHTML = getReceptionists(state).map(name => `<option>${esc(name)}</option>`).join('');
      document.getElementById('student_addon').innerHTML = `<option value="">Nenhum</option>` + state.settings.addonTypes.map(type => `<option>${esc(type)}</option>`).join('');
      document.getElementById('pending_hostess').innerHTML = getReceptionists(state).map(name => `<option>${esc(name)}</option>`).join('');
      document.getElementById('teamSuggestions').innerHTML = getAllEmployees(state).map(name => `<option value="${esc(name)}"></option>`).join('');
    }

    // Student-addon link movido para src/features/crud.js

    function clearStudentForm() {
      editingStudentId = null;
      limparErrosValidacao(['student_nome', 'student_matricula']);
      document.getElementById('studentModalTitle').textContent = 'Novo atendimento';
      ['nome','matricula','ultimaVisita','horaVisita','inicio','observacoes'].forEach(f => document.getElementById(`student_${f}`).value = '');
      document.getElementById('student_avisoNps').value = 'Sim';
      document.getElementById('student_feedback').value = 'Respondeu';
      document.getElementById('student_atendimento').value = getReceptionists(state)[0] || '';
      document.getElementById('student_addon').value = '';
    }

    function finalizeStudentSaveUI() {
      closeModal('studentModal');
      clearStudentForm();
    }

    function renderStudentSaveUI() {
      requestRender(['hero', 'dashboard', 'students', 'addons']);
    }


    function editStudent(id) {
      const s = state.students.find(x => x.id === id);
      if (!s) return;
      editingStudentId = id;
      document.getElementById('studentModalTitle').textContent = 'Editar atendimento';
      document.getElementById('student_nome').value = s.nome || '';
      document.getElementById('student_matricula').value = s.matricula || '';
      document.getElementById('student_ultimaVisita').value = s.ultimaVisita || '';
      document.getElementById('student_horaVisita').value = s.horaVisita || '';
      document.getElementById('student_inicio').value = s.inicio || '';
      document.getElementById('student_avisoNps').value = s.avisoNps || 'Sim';
      document.getElementById('student_atendimento').value = s.atendimento || getReceptionists(state)[0] || '';
      document.getElementById('student_feedback').value = s.feedback || 'Respondeu';
      document.getElementById('student_addon').value = s.addon || '';
      document.getElementById('student_observacoes').value = s.observacoes || '';
      openModal('studentModal');
    }

    function removeStudent(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir este atendimento?', async () => {
        const existing = state.students.find(s => s.id === id);
        if (!existing) return;
        applyStudentAddonLink(existing, -1);
        state.students = state.students.filter(s => s.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.students.push(existing);
          applyStudentAddonLink(existing, 1);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['hero', 'dashboard', 'students', 'addons']);
      });
    }

    function renderAddons() {
      const days = state.settings.monthDays;
      const activeReceptionists = getReceptionists(state);
      const activeReceptionistSet = new Set(activeReceptionists);
      const addonPeople = getAddonPeople(state);
      document.getElementById('monthDaysSelector').value = String(days);
      document.getElementById('addonsGrid').innerHTML = addonPeople.map(person => {
        const isHistorical = !activeReceptionistSet.has(person);
        const personTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(state.addons[person] || {})])];
        const personTitle = isHistorical ? 'Atendente removido do cadastro ativo. Histórico preservado em modo somente leitura.' : '';
        return `
        <div class="person-block">
          <div class="person-head">
            <h3 ${isHistorical ? `title="${esc(personTitle)}"` : 'contenteditable="true" data-blur-action="rename-person"'} data-person="${esc(person)}">${esc(person)}</h3>
            ${isHistorical ? '<span class="pill">Histórico</span>' : ''}
            <span class="pill info">Total do mês: ${totalAddonByPerson(person)}</span>
          </div>
          ${personTypes.map(type => {
            const arr = state.addons[person]?.[type] || Array.from({length:days},()=>0);
            const total = arr.reduce((a,b) => a + Number(b || 0), 0);
            return `
              <div class="chart-box" style="margin-bottom:12px;">
                <div class="toolbar" style="margin-bottom:10px;">
                  <strong>${esc(type)}</strong>
                  <span class="pill">Total: ${total}</span>
                </div>
                <div class="day-grid">
                  ${Array.from({length:days}, (_,i) => `
                    <div class="day-cell">
                      <div class="day">Dia ${i+1}</div>
                      <input type="number" min="0" value="${arr[i] || 0}" data-change-action="update-addon" data-person="${esc(person)}" data-addon-type="${esc(type)}" data-index="${i}" ${isHistorical ? 'disabled data-historical-readonly="true" title="Histórico preservado; novos lançamentos para este nome estão bloqueados."' : ''} />
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      }).join('') || '<div class="empty">Cadastre atendentes em Configurações.</div>';

      const rankingHost = document.getElementById('addonsTopSellers');
      if (!rankingHost) return;

      const ranking = addonPeople
        .map(name => ({
          name,
          total: totalAddonByPerson(name)
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

      const soldAnyAddon = ranking.some(item => item.total > 0);
      aplicarHtmlSeMudou(
        rankingHost,
        soldAnyAddon
          ? ranking.map((item, index) => `
            <article class="addons-ranking-item ${index === 0 ? 'is-leading' : ''}">
              <span class="addons-ranking-pos">${index + 1}</span>
              <div class="addons-ranking-meta">
                <span class="addons-ranking-name">${esc(item.name)}</span>
                <span class="addons-ranking-label">Atendente do mês</span>
              </div>
              <span class="addons-ranking-total">${item.total} addon${item.total === 1 ? '' : 's'}</span>
            </article>
          `).join('')
          : '<div class="empty addons-ranking-empty">Os atendimentos com addon marcado aparecerão aqui assim que houver vendas no período.</div>'
      );
    }

    function updateAddon(person, type, idx, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'addons'] })) return;
      if (!getReceptionists(state).includes(person)) {
        showToast('Atendente removido do cadastro ativo. Histórico de addons está em modo somente leitura.', 'info');
        requestRender(['hero', 'dashboard', 'addons']);
        return;
      }
      state.addons[person][type][idx] = Math.max(0, Number(value || 0));
      saveData();
      requestRender(['hero', 'dashboard', 'addons']);
    }

    function addPerson() {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'addons', 'settings'] })) return;
      const base = `Recepcionista ${getReceptionists(state).length + 1}`;
      state.settings.receptionists.push(base);
      state.settings.team = [...state.settings.receptionists];
      state.addons[base] = {};
      state.settings.addonTypes.forEach(type => state.addons[base][type] = Array.from({length:state.settings.monthDays},()=>0));
      saveData();
      populateStudentFilters();
      requestRender(['dashboard', 'addons', 'settings']);
    }

    async function renamePerson(oldName, newNameRaw) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const newName = newNameRaw.trim();
      if (!newName || newName === oldName) return requestRender('addons');
      if (getReceptionists(state).includes(newName)) return showToast('Já existe um atendente com esse nome.', 'warning');
      if (state.addons[newName] && newName !== oldName) return showToast('Já existe histórico de addons com esse nome.', 'warning');

      // Snapshot para rollback em caso de falha
      const snapshot = {
        receptionists: [...state.settings.receptionists],
        team: [...(state.settings.team || [])],
        studentsAddon: state.students.map(s => ({ id: s.id, atendimento: s.atendimento })),
        pendingHostess: state.pending.map(p => ({ id: p.id, hostess: p.hostess })),
        npsMentions: state.nps.mentions.map(m => ({ id: m.id, name: m.name })),
        addons: state.addons[oldName] ? { [oldName]: state.addons[oldName] } : null
      };

      state.settings.receptionists = getReceptionists(state).map(name => name === oldName ? newName : name);
      state.settings.team = [...state.settings.receptionists];
      state.students.forEach(s => { if (s.atendimento === oldName) s.atendimento = newName; });
      state.pending.forEach(p => { if (p.hostess === oldName) p.hostess = newName; });
      state.nps.mentions.forEach(m => { if (m.name === oldName) m.name = newName; });
      state.addons[newName] = state.addons[oldName];
      delete state.addons[oldName];

      const saved = await saveData();
      if (!saved) {
        // Rollback
        state.settings.receptionists = snapshot.receptionists;
        state.settings.team = snapshot.team;
        snapshot.studentsAddon.forEach(s => { const found = state.students.find(x => x.id === s.id); if (found) found.atendimento = s.atendimento; });
        snapshot.pendingHostess.forEach(p => { const found = state.pending.find(x => x.id === p.id); if (found) found.hostess = p.hostess; });
        snapshot.npsMentions.forEach(m => { const found = state.nps.mentions.find(x => x.id === m.id); if (found) found.name = m.name; });
        if (snapshot.addons) {
          delete state.addons[newName];
          state.addons[oldName] = snapshot.addons[oldName];
        }
        showToast('Falha ao salvar renomeação. Alterações revertidas.', 'danger');
        requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
        return;
      }

      populateStudentFilters();
      requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
    }

    function buildPendingMeta(item) {
      const parts = [];
      if (item.status === 'aberto') parts.push('<span class="pulse-dot"></span>');
      if (item.hostess) parts.push(`<span class="meta-item">${esc(item.hostess)}</span>`);
      if (item.hostess && item.data) parts.push('<span class="meta-sep">•</span>');
      if (item.data) parts.push(`<span class="meta-item">${formatDate(item.data)}</span>`);
      return parts.join('') || '<span class="meta-item">Sem dados</span>';
    }

    // ══════════════════════════════════════════
    // PILLS — renderização de status visual
    // ══════════════════════════════════════════

    function studentStatusPill(value) {
      const cls = value === 'Respondeu' ? 'ok' : value === 'Não respondeu' ? 'bad' : 'warn';
      return `<span class="pill ${cls}">${esc(value)}</span>`;
    }

    function npsPill(value) {
      const cls = value === 'Sim' ? 'ok' : value === 'Não' ? 'bad' : 'warn';
      return `<span class="pill ${cls}">${esc(value)}</span>`;
    }

    function pendingPill(value) {
      const map = {
        aberto: ['open-pill', '<span class="pulse-dot"></span>Aberto'],
        respondido: ['info', 'Respondido'],
        concluido: ['ok', 'Concluído']
      };
      const [cls, text] = map[value] || ['info', esc(value)];
      return `<span class="pill ${cls}">${text}</span>`;
    }


    let draggingPendingId = null;

    function updatePendingStatus(id, status) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'pending'] })) return;
      const item = state.pending.find(x => x.id === id);
      if (!item || item.status === status) return;
      item.status = status;
      estadoAcessibilidade.pendenciaFocadaId = id;
      saveData();
      requestRender(['hero', 'dashboard', 'pending']);
    }

    function limparEstadoDropPendencias() {
      document.querySelectorAll('.kanban-col.drop-target').forEach(col => col.classList.remove('drop-target'));
    }

    function bindPendingDnD() {
      if (estadoEventos.dndPendenciasInicializado) return;
      estadoEventos.dndPendenciasInicializado = true;

      document.addEventListener('dragstart', e => {
        const card = e.target.closest('[data-pending-id]');
        if (!card) return;
        draggingPendingId = card.dataset.pendingId;
        card.classList.add('dragging');
      });

      document.addEventListener('dragend', e => {
        const card = e.target.closest('[data-pending-id]');
        if (!card) return;
        card.classList.remove('dragging');
        draggingPendingId = null;
        limparEstadoDropPendencias();
      });

      document.addEventListener('dragover', e => {
        const col = e.target.closest('[data-drop-status]');
        if (!col) return;
        e.preventDefault();
        col.classList.add('drop-target');
      });

      document.addEventListener('dragleave', e => {
        const col = e.target.closest('[data-drop-status]');
        if (!col) return;
        const relacionado = e.relatedTarget;
        if (relacionado && col.contains(relacionado)) return;
        col.classList.remove('drop-target');
      });

      document.addEventListener('drop', e => {
        const col = e.target.closest('[data-drop-status]');
        if (!col) return;
        e.preventDefault();
        col.classList.remove('drop-target');
        if (!draggingPendingId) return;
        updatePendingStatus(draggingPendingId, col.dataset.dropStatus);
      });
    }

    function positionTooltip(e, el, tooltip) {
      const offset = 16;
      const clientX = e?.clientX ?? el.getBoundingClientRect().left;
      const clientY = e?.clientY ?? el.getBoundingClientRect().bottom;
      const maxX = window.innerWidth - tooltip.offsetWidth - 12;
      const maxY = window.innerHeight - tooltip.offsetHeight - 12;
      let x = clientX + offset;
      let y = clientY + offset;
      if (x > maxX) x = Math.max(12, clientX - tooltip.offsetWidth - offset);
      if (y > maxY) y = Math.max(12, clientY - tooltip.offsetHeight - offset);
      tooltip.style.left = `${Math.max(12, Math.min(maxX, x))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(maxY, y))}px`;
    }

    function bindTooltips() {
      if (estadoEventos.tooltipInicializado) return;
      estadoEventos.tooltipInicializado = true;

      const tooltip = document.getElementById('appTooltip');
      if (!tooltip) return;

      const show = (el, e) => {
        const text = String(el?.dataset?.tooltip || '').trim();
        if (!text) return;
        tooltipAlvoAtual = el;
        tooltip.innerHTML = esc(text).replace(/\n/g, '<br>');
        tooltip.classList.add('show');
        positionTooltip(e, el, tooltip);
      };

      const hide = () => {
        tooltipAlvoAtual = null;
        tooltip.classList.remove('show');
      };

      document.addEventListener('mouseover', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el || el === tooltipAlvoAtual) return;
        show(el, e);
      });

      document.addEventListener('mousemove', e => {
        if (!tooltipAlvoAtual || !tooltip.classList.contains('show')) return;
        positionTooltip(e, tooltipAlvoAtual, tooltip);
      });

      document.addEventListener('mouseout', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el || el !== tooltipAlvoAtual) return;
        const relacionado = e.relatedTarget;
        if (relacionado && el.contains(relacionado)) return;
        hide();
      });

      document.addEventListener('focusin', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el) return;
        show(el, { clientX: el.getBoundingClientRect().left, clientY: el.getBoundingClientRect().bottom });
      });

      document.addEventListener('focusout', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el || el !== tooltipAlvoAtual) return;
        hide();
      });
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — PENDING & NPS — renderPending, savePending, removePending, renderNps, registerMention, saveNpsObservations
    // ══════════════════════════════════════════

    function renderPending() {
      const { linhas: rows, grupos } = selecionarPendenciasFiltradas();
      aplicarHtmlSeMudou(document.getElementById('pendingStatusStrip'), `
        <div class="pending-status-card pending-status-card--open">
          <span class="pending-status-label">Abertas</span>
          <strong class="pending-status-value">${grupos.aberto.length}</strong>
        </div>
        <div class="pending-status-card pending-status-card--progress">
          <span class="pending-status-label">Em andamento</span>
          <strong class="pending-status-value">${grupos.respondido.length}</strong>
        </div>
        <div class="pending-status-card pending-status-card--done">
          <span class="pending-status-label">Resolvidas</span>
          <strong class="pending-status-value">${grupos.concluido.length}</strong>
        </div>
        <div class="pending-status-card pending-status-card--total">
          <span class="pending-status-label">Total no período</span>
          <strong class="pending-status-value">${rows.length}</strong>
        </div>
      `);
      const pendingTableBody = document.getElementById('pendingTableBody');
      if (!rows.length) {
        aplicarHtmlSeMudou(pendingTableBody, `<tr><td colspan="8"><div class="empty">Nenhuma pendência encontrada.</div></td></tr>`);
      } else {
        aplicarPatchLinhas(pendingTableBody, rows, item => item.id, p => `
          <tr class="${p.status === 'aberto' ? 'row-attention' : ''}">
            <td><strong class="cell-ellipsis" data-tooltip="${esc(p.nome)}">${esc(p.nome)}</strong></td>
            <td><span class="cell-ellipsis" data-tooltip="${esc(p.matricula || '-')}">${esc(p.matricula || '-')}</span></td>
            <td><span class="cell-text multiline pending-cell-main" data-tooltip="${esc(p.pendencia || '-')}">${esc(p.pendencia || '-')}</span></td>
            <td><span class="cell-ellipsis">${formatDate(p.data)}</span></td>
            <td><span class="cell-ellipsis" data-tooltip="${esc(p.hostess || '-')}">${esc(p.hostess || '-')}</span></td>
            <td>${p.resposta ? `<span class="cell-text multiline pending-cell-response" data-tooltip="${esc(p.resposta)}">${esc(p.resposta)}</span>` : '<span class="pending-cell-response-empty">Sem resposta</span>'}</td>
            <td>${pendingPill(p.status)}</td>
            <td class="right">
              <button class="btn btn-ghost btn-xs" data-action="edit-pending" data-id="${p.id}">Editar</button>
              <button class="btn btn-danger btn-xs" data-action="remove-pending" data-id="${p.id}">Excluir</button>
            </td>
          </tr>
        `);
      }

      const pendingKanban = document.getElementById('pendingKanban');
      const colunas = Object.entries(grupos).map(([status, items]) => ({ status, items }));
      aplicarPatchBlocosAgrupados(pendingKanban, colunas, coluna => coluna.status, coluna => `
        <div class="kanban-col ${coluna.status === 'aberto' ? 'status-aberto' : ''}" data-drop-status="${coluna.status}">
          <div class="col-head">
            <h3>${coluna.status === 'aberto' ? '<span class="pulse-dot"></span>Abertas' : coluna.status === 'respondido' ? 'Respondidas' : 'Concluídas'}</h3>
          </div>
          <div class="kanban-list"></div>
        </div>
      `);

      colunas.forEach(coluna => {
        const lista = pendingKanban.querySelector(`[data-drop-status="${coluna.status}"] .kanban-list`);
        if (!lista) return;
        if (!coluna.items.length) {
          aplicarHtmlSeMudou(lista, '<div class="empty">Nenhum item</div>');
          return;
        }
        aplicarPatchItensKanban(lista, coluna.items, item => item.id, item => `
          <div class="ticket ${item.status === 'aberto' ? 'ticket-attention' : ''}" draggable="true" data-pending-id="${item.id}" data-tooltip="${esc(item.pendencia || '')}" role="listitem" aria-describedby="pendingKeyboardHelp" aria-keyshortcuts="ArrowUp ArrowDown Home End Alt+ArrowLeft Alt+ArrowRight" aria-label="Pendência de ${esc(item.nome)} com status ${esc(item.status)}">
            <div class="title" data-tooltip="${esc(item.nome)}">${esc(item.nome)}</div>
            <div class="meta">${buildPendingMeta(item)}</div>
            <div class="desc" data-tooltip="${esc(item.pendencia)}">${esc(shortText(item.pendencia, 115))}</div>
            ${item.resposta ? `<div class="desc muted" data-tooltip="${esc(item.resposta)}"><strong style="color:var(--muted)">Resposta:</strong> ${esc(shortText(item.resposta, 85))}</div>` : ''}
            <div class="foot">
              <span class="drag-hint"><span class="drag-grip" aria-hidden="true">⋮⋮</span>ARRASTE PARA MOVER</span>
              <div class="ticket-actions">
                <button class="btn btn-ghost btn-xs icon-btn" data-action="edit-pending" data-id="${item.id}" title="Editar" aria-label="Editar pendência de ${esc(item.nome)}" draggable="false">✎</button>
                <button class="btn btn-danger btn-xs icon-btn" data-action="remove-pending" data-id="${item.id}" title="Excluir" aria-label="Excluir pendência de ${esc(item.nome)}" draggable="false">✕</button>
              </div>
            </div>
          </div>
        `);
      });
      restaurarFocoPendenteSeNecessario();
    }

    function clearPendingForm() {
      editingPendingId = null;
      limparErrosValidacao(['pending_nome', 'pending_matricula', 'pending_desc', 'pending_data']);
      document.getElementById('pendingModalTitle').textContent = 'Nova pendência';
      ['nome','matricula','desc','data','resposta'].forEach(f => document.getElementById(`pending_${f}`).value = '');
      document.getElementById('pending_hostess').value = getReceptionists(state)[0] || '';
      document.getElementById('pending_status').value = 'aberto';
    }

    function finalizePendingSaveUI() {
      closeModal('pendingModal');
      clearPendingForm();
    }

    function renderPendingSaveUI() {
      requestRender(['hero', 'dashboard', 'pending']);
    }


    function editPending(id) {
      const p = state.pending.find(x => x.id === id);
      if (!p) return;
      editingPendingId = id;
      document.getElementById('pendingModalTitle').textContent = 'Editar pendência';
      document.getElementById('pending_nome').value = p.nome || '';
      document.getElementById('pending_matricula').value = p.matricula || '';
      document.getElementById('pending_desc').value = p.pendencia || '';
      document.getElementById('pending_data').value = p.data || '';
      document.getElementById('pending_hostess').value = p.hostess || getReceptionists(state)[0] || '';
      document.getElementById('pending_resposta').value = p.resposta || '';
      document.getElementById('pending_status').value = p.status || 'aberto';
      openModal('pendingModal');
    }

    function removePending(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir esta pendência?', async () => {
        const existing = state.pending.find(p => p.id === id);
        if (!existing) return;
        state.pending = state.pending.filter(p => p.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.pending.push(existing);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['hero', 'dashboard', 'pending']);
      });
    }

    function getRiskBand(score) {
      const value = clamp(Number(score || 0), 0, 100);
      if (value <= 20) return { label: 'Faixa crítica • vermelho', tone: 'risk-red' };
      if (value <= 40) return { label: 'Faixa de atenção • laranja', tone: 'risk-orange' };
      if (value <= 60) return { label: 'Faixa moderada • amarelo', tone: 'risk-yellow' };
      if (value <= 80) return { label: 'Faixa boa • verde claro', tone: 'risk-green-light' };
      return { label: 'Faixa excelente • verde escuro', tone: 'risk-green-dark' };
    }

    function getSortedMentions() {
      return selecionarRankingNps().ranking;
    }

    function getRankMap() {
      return { ...selecionarRankingNps().mapaRanking };
    }

    function captureNpsRankSnapshot() {
      state.nps.rankSnapshot = getRankMap();
    }

    function trendBadge(item) {
      return `<span class="trend-badge ${item.tendencia?.classe || 'trend-stable'}">${item.tendencia?.rotulo || '— estável'}</span>`;
    }

    function getNpsHistoryBandClass(score) {
      if (score <= 20) return 'is-risk';
      if (score <= 40) return 'is-warning';
      if (score <= 60) return 'is-mid';
      if (score <= 80) return 'is-good';
      return 'is-excellent';
    }

    function getNpsHistoryRows(limit = 6) {
      try {
        const periods = storage?.periods || {};
        return Object.keys(periods)
          .filter(key => key && key !== currentPeriodKey)
          .sort((a, b) => b.localeCompare(a))
          .map(key => {
            const period = periods[key];
            const score = clamp(Number(period?.nps?.score || 0), 0, 100);
            const mentions = Array.isArray(period?.nps?.mentions)
              ? period.nps.mentions.reduce((acc, item) => acc + Number(item?.count || 0), 0)
              : 0;
            const observations = String(period?.nps?.observations || '').trim();
            const hasSignal = score > 0 || mentions > 0 || observations;
            if (!hasSignal) return null;
            return {
              key,
              label: getPeriodLabel(key),
              score,
              band: getRiskBand(score)
            };
          })
          .filter(Boolean)
          .slice(0, limit);
      } catch (error) {
        console.error('Falha ao montar histórico de NPS:', error);
        return [];
      }
    }

    function renderNps() {
      const score = clamp(Number(state.nps.score || 0), 0, 100);
      const band = getRiskBand(score);
      const rankingNps = selecionarRankingNps();
      const pointerLeft = `calc(${score}% - ${score === 100 ? 12 : 0}px)`;

      const monthlyGoal = clamp(Number(state.nps.monthlyGoal ?? 75), 0, 100);
      const semesterGoal = clamp(Number(state.nps.semesterGoal ?? 80), 0, 100);
      const monthlyProgress = getNpsGoalProgress(score, monthlyGoal);
      const semesterProgress = getNpsGoalProgress(score, semesterGoal);
      const historyRows = getNpsHistoryRows();
      document.getElementById('npsMeterBox').innerHTML = `
        <div class="score-hero">
          <div class="nps-score-copy">
            <div class="score-number">${score}</div>
            <div class="score-band">${esc(band.label)}</div>
          </div>
          <div class="goal-pills">
            <div class="goal-pill-strong"><span>Citações no mês</span><strong>${rankingNps.totalCitacoes}</strong></div>
            <div class="goal-pill-strong"><span>Meta mensal</span><strong>${monthlyGoal}</strong></div>
            <div class="goal-pill-strong"><span>Meta semestral</span><strong>${semesterGoal}</strong></div>
          </div>
        </div>
        <div class="risk-meter-wrap">
          <div class="risk-pointer" style="left:${pointerLeft};">
            <div class="marker-value">${score}</div>
            <div class="marker"></div>
          </div>
          <div class="risk-meter">
            <div class="risk-segment risk-red"></div>
            <div class="risk-segment risk-orange"></div>
            <div class="risk-segment risk-yellow"></div>
            <div class="risk-segment risk-green-light"></div>
            <div class="risk-segment risk-green-dark"></div>
          </div>
          <div class="risk-scale">
            <div>0–20</div>
            <div>21–40</div>
            <div>41–60</div>
            <div>61–80</div>
            <div>81–100</div>
          </div>
        </div>
        <div class="score-slider-row nps-grid-3">
          <div class="field">
            <label>Pontuação NPS</label>
            <input id="npsScoreInput" type="number" min="0" max="100" value="${score}" aria-label="Pontuação NPS" data-input-action="update-nps-score" data-source="input" />
          </div>
          <div class="field">
            <label>Meta mensal NPS</label>
            <input id="npsMonthlyGoalInput" type="number" min="0" max="100" value="${monthlyGoal}" aria-label="Meta mensal de NPS" data-input-action="update-nps-goal" data-field="monthlyGoal" />
          </div>
          <div class="field">
            <label>Meta semestral NPS</label>
            <input id="npsSemesterGoalInput" type="number" min="0" max="100" value="${semesterGoal}" aria-label="Meta semestral de NPS" data-input-action="update-nps-goal" data-field="semesterGoal" />
          </div>
        </div>
        <div class="score-slider-row">
          <div class="field">
            <label>Ajuste rápido</label>
            <input id="npsScoreRange" type="range" min="0" max="100" value="${score}" aria-label="Ajuste rápido da pontuação NPS" data-input-action="update-nps-score" data-source="range" />
          </div>
        </div>
        <div class="nps-goals-panel">
          <div class="nps-progress-grid">
            <div class="nps-progress-card">
              <div class="nps-progress-head">
                <div class="nps-progress-title">Progresso da meta mensal</div>
                <div class="nps-progress-meta">${score}/${monthlyGoal} • ${Math.round(monthlyProgress)}%${monthlyProgress >= 100 ? ' ✓' : ''}</div>
              </div>
              <div class="nps-progress-track"><div class="nps-progress-fill" style="width:${Math.min(100, monthlyProgress)}%"></div></div>
            </div>
            <div class="nps-progress-card">
              <div class="nps-progress-head">
                <div class="nps-progress-title">Progresso da meta semestral</div>
                <div class="nps-progress-meta">${score}/${semesterGoal} • ${Math.round(semesterProgress)}%${semesterProgress >= 100 ? ' ✓' : ''}</div>
              </div>
              <div class="nps-progress-track"><div class="nps-progress-fill" style="width:${Math.min(100, semesterProgress)}%"></div></div>
            </div>
          </div>
        </div>
      `;

      aplicarHtmlSeMudou(document.getElementById('npsHistoryBox'), historyRows.length ? `
        <div class="nps-history-panel">
          <div class="toolbar-title">
            <span class="section-kicker">Evolução</span>
            <h2>Histórico de NPS</h2>
            <p>Leitura rápida dos meses anteriores disponíveis na base local.</p>
          </div>
          <div class="nps-history-list">
            ${historyRows.map(item => `
              <div class="nps-history-item">
                <div class="nps-history-period">${esc(item.label)}</div>
                <div class="nps-history-score">${item.score}</div>
                <div class="nps-history-band ${getNpsHistoryBandClass(item.score)}">${esc(item.band.label)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="nps-history-panel">
          <div class="toolbar-title">
            <span class="section-kicker">Evolução</span>
            <h2>Histórico de NPS</h2>
            <p>Leitura rápida dos meses anteriores disponíveis na base local.</p>
          </div>
          <div class="empty nps-history-empty">Dados de meses anteriores aparecerão aqui conforme o uso.</div>
        </div>
      `);

      document.getElementById('npsObservations').value = state.nps.observations || '';

      const ranking = rankingNps.ranking;
      document.getElementById('npsRankingList').innerHTML = ranking.length ? ranking.map(item => `
        <div class="rank-item">
          <div class="rank-left">
            <div class="rank-position">#${item.position}</div>
            <div class="rank-name-group">
              <div class="rank-name-line">
                ${item.position === 1 ? '<span class="crown">👑</span>' : ''}
                <input class="rank-name-input" value="${esc(item.name)}" aria-label="Nome do funcionário citado na posição ${item.position}" data-blur-action="rename-mention" data-id="${item.id}" />
                ${trendBadge(item)}
              </div>
              <div class="rank-meta">${item.count} cita${item.count === 1 ? 'ção' : 'ções'} no mês</div>
            </div>
          </div>
          <div class="rank-actions">
            <button class="btn btn-ghost btn-xs" data-action="adjust-mention" data-id="${item.id}" data-delta="-1" aria-label="Reduzir em uma citação para ${esc(item.name)}">-1</button>
            <input class="count-box" type="number" min="0" value="${item.count}" aria-label="Quantidade de citações de ${esc(item.name)}" data-change-action="set-mention-count" data-id="${item.id}" />
            <button class="btn btn-primary btn-xs" data-action="adjust-mention" data-id="${item.id}" data-delta="1" aria-label="Aumentar em uma citação para ${esc(item.name)}">+1</button>
            <button class="btn btn-danger btn-xs" data-action="remove-mention" data-id="${item.id}" aria-label="Excluir ${esc(item.name)} do ranking de NPS">Excluir</button>
          </div>
        </div>
      `).join('') : '<div class="empty">Ainda não há funcionários citados no NPS.</div>';

      // Líderes dos meses anteriores
      const lideres = selecionarLideresHistoricos();
      aplicarHtmlSeMudou(document.getElementById('npsHistLeaders'), lideres.length ? `
        <div class="hist-leaders">
          <div class="hist-leaders-title">Líderes dos meses anteriores</div>
          <div class="hist-leaders-subtitle">Resumo dos destaques de addons e citações NPS dos períodos já fechados.</div>
          <div class="hist-leaders-list">
            ${lideres.map(m => `
              <div class="hist-leaders-card">
                <div class="hist-leaders-period">${esc(m.label)}</div>
                <div class="hist-leaders-row">
                  <span class="hist-leaders-label">Líder addons</span>
                  <span class="hist-leaders-value">${m.addonLeader ? `${esc(m.addonLeader.name)}<span class="hl-total">${m.addonLeader.total}</span>` : 'Sem dados'}</span>
                </div>
                <div class="hist-leaders-row">
                  <span class="hist-leaders-label">Líder NPS</span>
                  <span class="hist-leaders-value">${m.npsLeader ? `${esc(m.npsLeader.name)}<span class="hl-total">${m.npsLeader.total} cit.</span>` : 'Sem dados'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="hist-leaders">
          <div class="hist-leaders-title">Líderes dos meses anteriores</div>
          <div class="hist-leaders-subtitle">Resumo dos destaques de addons e citações NPS dos períodos já fechados.</div>
          <div class="hist-leaders-empty">Dados de meses anteriores aparecerão aqui conforme o uso.</div>
        </div>
      `);
    }

    function updateNpsScore(value, source) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'nps'] })) return;
      state.nps.score = clamp(Number(value || 0), 0, 100);
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
      if (source === 'input') {
        DOM.setValue('npsScoreRange', state.nps.score);
      } else {
        DOM.setValue('npsScoreInput', state.nps.score);
      }
    }

    function updateNpsGoal(field, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'nps'] })) return;
      state.nps[field] = clamp(Number(value || 0), 0, 100);
      saveData();
      requestRender(['dashboard', 'nps']);
    }

    // NPS actions movidas para src/features/nps.js

    function renderScaleShiftRows() {
      const box = document.getElementById('scaleShiftRows');
      if (!box) return;
      box.innerHTML = scaleShiftDrafts.length ? scaleShiftDrafts.map((shift, index) => `
        <div class="shift-editor-row">
          <div class="field"><label>Horário</label><input data-scale-shift="time" data-index="${index}" aria-label="Horário do professor na linha ${index + 1}" value="${esc(shift.time || '')}" placeholder="Ex: 08h - 13h" /></div>
          <div class="field"><label>Professor</label><input data-scale-shift="name" data-index="${index}" aria-label="Professor da linha ${index + 1}" value="${esc(shift.name || '')}" placeholder="Ex: JUNIOR" /></div>
          <div class="field"><label>Troca</label><input data-scale-shift="swap" data-index="${index}" aria-label="Troca do professor na linha ${index + 1}" value="${esc(shift.swap || '')}" placeholder="Se houver" /></div>
          <button class="btn btn-danger btn-xs" type="button" data-action="remove-scale-shift-row" data-index="${index}" aria-label="Excluir linha ${index + 1} de professor">Excluir</button>
        </div>
      `).join('') : '<div class="empty">Adicione ao menos uma linha de professor para montar o dia.</div>';
    }

    function addScaleShiftRow(values = {}) {
      scaleShiftDrafts.push({ time: values.time || '', name: values.name || '', swap: values.swap || '' });
      renderScaleShiftRows();
    }

    function removeScaleShiftRow(index) {
      scaleShiftDrafts.splice(index, 1);
      renderScaleShiftRows();
    }

    function clearScaleForm() {
      editingScaleId = null;
      limparErrosValidacao(['scale_date']);
      scaleShiftDrafts = [];
      document.getElementById('scaleModalTitle').textContent = 'Novo dia de escala';
      document.getElementById('scale_date').value = getDefaultPeriodDate();
      document.getElementById('scale_tone').value = suggestScaleTone(getDefaultPeriodDate());
      document.getElementById('scale_receptionTime').value = '08h - 17h';
      document.getElementById('scale_receptionist').value = '';
      document.getElementById('scale_receptionSwap').value = '';
      document.getElementById('scale_note').value = '';
      addScaleShiftRow({ time: '08h - 13h', name: '', swap: '' });
      addScaleShiftRow({ time: '12h - 17h', name: '', swap: '' });
    }

    function openScaleModal() {
      clearScaleForm();
      openModal('scaleModal');
    }

    function editScaleDay(id) {
      const item = state.scale.find(entry => entry.id === id);
      if (!item) return;
      editingScaleId = id;
      document.getElementById('scaleModalTitle').textContent = 'Editar dia de escala';
      document.getElementById('scale_date').value = item.date || getDefaultPeriodDate();
      document.getElementById('scale_tone').value = item.rowTone || 'neutral';
      document.getElementById('scale_receptionTime').value = item.receptionTime || '';
      document.getElementById('scale_receptionist').value = item.receptionist || '';
      document.getElementById('scale_receptionSwap').value = item.receptionSwap || '';
      document.getElementById('scale_note').value = item.note || '';
      scaleShiftDrafts = (item.professorShifts || []).map(shift => ({ time: shift.time || '', name: shift.name || '', swap: shift.swap || '' }));
      if (!scaleShiftDrafts.length) scaleShiftDrafts = [{ time: '', name: '', swap: '' }];
      renderScaleShiftRows();
      openModal('scaleModal');
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — SCALE & EVENTS — saveScaleDay, removeScaleDay, renderScale, saveEventItem, removeEventItem, renderEvents
    // ══════════════════════════════════════════

    async function saveScaleDay() {
      if (!assertWritableCurrentPeriod()) return;
      const payload = getScaleFormData();
      limparErrosValidacao(['scale_date']);
      if (!payload.date) { apresentarErroValidacao([{ id: 'scale_date', message: 'Informe a data da escala.' }]); return; }
      if (!isDateInActivePeriod(payload.date)) { apresentarErroValidacao([{ id: 'scale_date', message: `A data da escala deve pertencer a ${getPeriodLabel()}.` }]); return; }
      if (!payload.professorShifts.length) { showToast('Adicione pelo menos uma linha de professor.', 'warning'); document.querySelector('[data-action="add-scale-shift-row"]')?.focus({ preventScroll: true }); return; }
      const idx = state.scale.findIndex(entry => entry.id === payload.id);
      if (idx >= 0) state.scale[idx] = payload; else state.scale.push(payload);
      state.scale.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const saved = await saveData();
      if (!saved) return;
      closeModal('scaleModal');
      requestRender(['dashboard', 'scale']);
    }

    function removeScaleDay(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir este dia da escala?', async () => {
        const existing = state.scale.find(entry => entry.id === id);
        if (!existing) return;
        state.scale = state.scale.filter(entry => entry.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.scale.push(existing);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['dashboard', 'scale']);
      });
    }

    function renderScale() {
      const resumoEscala = selecionarResumoEscala();
      const sorted = resumoEscala.lista;
      const body = document.getElementById('scaleTableBody');
      const board = document.getElementById('scaleBoard');
      const summary = document.getElementById('scaleSummaryCards');
      const opsSummary = document.getElementById('scaleOperationalSummary');

      if (opsSummary) {
        const [yearStr, monthStr] = String(currentPeriodKey || '').split('-');
        const year = Number(yearStr || 0);
        const month = Number(monthStr || 0);
        const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 0;
        const allDays = Array.isArray(state.scale) ? state.scale.slice() : [];
        const totalSlots = allDays.reduce((acc, item) => acc + Math.max(1, (item.professorShifts || []).length) + 1, 0);
        const filledSlots = allDays.reduce((acc, item) => {
          const professorSlotsFilled = (item.professorShifts || []).reduce((sum, shift) => (
            String(shift?.name || '').trim() || String(shift?.time || '').trim() || String(shift?.swap || '').trim()
              ? sum + 1
              : sum
          ), 0);
          const receptionFilled = String(item.receptionist || '').trim() || String(item.receptionTime || '').trim() || String(item.receptionSwap || '').trim() ? 1 : 0;
          return acc + professorSlotsFilled + receptionFilled;
        }, 0);

        const turnsByPerson = new Map();
        allDays.forEach(item => {
          (item.professorShifts || []).forEach(shift => {
            const name = String(shift?.name || '').trim();
            if (!name) return;
            turnsByPerson.set(name, (turnsByPerson.get(name) || 0) + 1);
          });
          const receptionist = String(item.receptionist || '').trim();
          if (receptionist) turnsByPerson.set(receptionist, (turnsByPerson.get(receptionist) || 0) + 1);
        });
        const topPerson = [...turnsByPerson.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0] || null;

        const uncoveredDates = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = `${currentPeriodKey}-${String(day).padStart(2, '0')}`;
          const item = allDays.find(entry => String(entry.date || '') === dateKey);
          if (!item) {
            uncoveredDates.push(dateKey);
            continue;
          }
          const hasProfessorCoverage = (item.professorShifts || []).some(shift => String(shift?.name || '').trim());
          const hasReceptionCoverage = !!String(item.receptionist || '').trim();
          if (!hasProfessorCoverage || !hasReceptionCoverage) uncoveredDates.push(dateKey);
        }

        const uncoveredPreview = uncoveredDates.slice(0, 4).map(date => getPeriodDisplayDate(date)).join(', ');
        const uncoveredDetail = uncoveredDates.length
          ? uncoveredDates.length > 4
            ? `${uncoveredPreview} +${uncoveredDates.length - 4}`
            : uncoveredPreview
          : 'Cobertura completa';

        aplicarHtmlSeMudou(opsSummary, `
          <span class="scale-ops-item"><span>Turnos preenchidos</span><strong>${filledSlots}/${totalSlots}</strong></span>
          <span class="scale-ops-sep" aria-hidden="true"></span>
          <span class="scale-ops-item"><span>Funcionário com mais turnos</span><strong>${topPerson ? `${esc(topPerson[0])} • ${topPerson[1]}` : 'Sem dados'}</strong></span>
          <span class="scale-ops-sep" aria-hidden="true"></span>
          <span class="scale-ops-item"><span>Dias sem cobertura</span><strong>${uncoveredDates.length}</strong><span>${esc(uncoveredDetail)}</span></span>
          <span class="scale-ops-sep" aria-hidden="true"></span>
          <span class="scale-ops-item"><span>Dias lançados</span><strong>${allDays.length}/${daysInMonth || 0}</strong></span>
        `);
      }

      if (summary) {
        aplicarHtmlSeMudou(summary, [
          { label: 'Dias escalados', value: resumoEscala.diasEscalados, foot: `Período ativo: ${getPeriodLabel()}` },
          { label: 'Professores lançados', value: resumoEscala.professoresLancados, foot: 'Somatório dos turnos cadastrados' },
          { label: 'Recepção coberta', value: resumoEscala.recepcaoCoberta, foot: 'Dias com recepcionista definido' },
          { label: 'Trocas / atenção', value: resumoEscala.trocasOuAtencao || resumoEscala.fimDeSemanaOuAtencao, foot: resumoEscala.trocasOuAtencao ? 'Trocas registradas no mês' : `${resumoEscala.fimDeSemanaOuAtencao} dias com atenção operacional` }
        ].map(card => `
          <div class="schedule-kpi">
            <div class="schedule-kpi-label">${esc(card.label)}</div>
            <div class="schedule-kpi-value">${esc(card.value)}</div>
            <div class="schedule-kpi-foot">${esc(card.foot)}</div>
          </div>
        `).join(''));
      }

      if (!sorted.length) {
        aplicarHtmlSeMudou(body, `<tr><td colspan="7"><div class="empty">Nenhum dia de escala encontrado para os filtros aplicados em ${esc(getPeriodLabel())}.</div></td></tr>`);
      } else {
        const linhasEscala = sorted.flatMap(item => {
          const shifts = item.professorShifts.length ? item.professorShifts : [{ time: '', name: '', swap: '' }];
          return shifts.map((shift, index) => ({ item, shift, index, totalShifts: shifts.length }));
        });
        aplicarPatchLinhas(body, linhasEscala, linha => `${linha.item.id}:${linha.index}`, linha => `
          <tr class="scale-tone-${linha.item.rowTone || 'neutral'}">
            ${linha.index === 0 ? `
              <td rowspan="${linha.totalShifts}" class="scale-date-cell">
                <div class="scale-date-main">${esc(getPeriodDisplayDate(linha.item.date))}</div>
                <div class="scale-date-sub">${esc(getWeekdayLabel(linha.item.date))} • ${esc(toneLabel(linha.item.rowTone || 'neutral'))}</div>
                ${linha.item.note ? `<div class="scale-mini-note">${esc(shortText(linha.item.note, 110))}</div>` : ''}
                <div class="scale-action-row">
                  <button class="btn btn-ghost btn-xs" data-action="edit-scale-day" data-id="${linha.item.id}">Editar</button>
                  <button class="btn btn-danger btn-xs" data-action="remove-scale-day" data-id="${linha.item.id}">Excluir</button>
                </div>
              </td>` : ''}
            <td><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.shift.time || '—')}</div></div></td>
            <td><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.shift.name || '—')}</div></div></td>
            <td><div class="scale-cell-stack"><div class="scale-secondary">${esc(linha.shift.swap || '—')}</div></div></td>
            ${linha.index === 0 ? `
              <td rowspan="${linha.totalShifts}"><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.item.receptionTime || '—')}</div></div></td>
              <td rowspan="${linha.totalShifts}"><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.item.receptionist || '—')}</div></div></td>
              <td rowspan="${linha.totalShifts}"><div class="scale-cell-stack"><div class="scale-secondary">${esc(linha.item.receptionSwap || '—')}</div></div></td>` : ''}
          </tr>
        `);
      }

      if (board) {
        if (!sorted.length) {
          aplicarHtmlSeMudou(board, `<div class="empty">Nenhum dia de escala cadastrado para ${esc(getPeriodLabel())}. Use “Adicionar dia de escala” ou “Duplicar mês anterior”.</div>`);
        } else {
          aplicarPatchCards(board, sorted, item => item.id, item => {
            const info = formatScaleBoardDay(item.date);
            const shifts = item.professorShifts.length ? item.professorShifts : [{ time: '—', name: '—', swap: '' }];
            return `
            <article class="scale-board-row tone-${esc(item.rowTone || 'neutral')}">
              <div class="scale-board-day">
                <div class="month">Escala de ${esc(info.month)}</div>
                <div class="date">${esc(info.day)}</div>
                <div class="weekday">${esc(info.weekday || 'Dia do mês')}</div>
              </div>
              <div class="scale-board-prof">
                <div class="scale-board-head">Professores / turnos</div>
                ${shifts.map(shift => `
                  <div class="scale-board-shift">
                    <div class="scale-board-time">${esc(shift.time || '—')}</div>
                    <div>
                      <div class="scale-board-name">${esc(shift.name || '—')}</div>
                      ${shift.swap ? `<div class="scale-board-swap">Troca: ${esc(shift.swap)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="scale-board-recep">
                <div class="scale-board-head">Recepção</div>
                <div class="scale-board-shift">
                  <div class="scale-board-time">${esc(item.receptionTime || '—')}</div>
                  <div>
                    <div class="scale-board-name">${esc(item.receptionist || '—')}</div>
                    ${item.receptionSwap ? `<div class="scale-board-swap">Troca: ${esc(item.receptionSwap)}</div>` : ''}
                  </div>
                </div>
              </div>
              <div class="scale-board-side">
                <div>
                  <div class="scale-tone-pill ${esc(item.rowTone || 'neutral')}">${esc(toneLabel(item.rowTone || 'neutral'))}</div>
                  ${item.note ? `<div class="scale-board-note" style="margin-top:12px;">${esc(item.note)}</div>` : `<div class="scale-board-note" style="margin-top:12px;">Sem observações registradas.</div>`}
                </div>
                <div class="scale-board-actions">
                  <button class="btn btn-ghost btn-xs" data-action="edit-scale-day" data-id="${item.id}">Editar</button>
                  <button class="btn btn-danger btn-xs" data-action="remove-scale-day" data-id="${item.id}">Excluir</button>
                </div>
              </div>
            </article>
          `;
          });
        }
      }
    }

    function clearEventForm() {
      editingEventId = null;
      limparErrosValidacao(['event_date', 'event_title']);
      document.getElementById('eventModalTitle').textContent = 'Novo evento / ação';
      document.getElementById('event_date').value = getDefaultPeriodDate();
      document.getElementById('event_time').value = '';
      document.getElementById('event_type').value = 'Evento';
      document.getElementById('event_status').value = 'Programado';
      document.getElementById('event_title').value = '';
      document.getElementById('event_place').value = '';
      document.getElementById('event_owner').value = '';
      document.getElementById('event_description').value = '';
    }

    function finalizeEventSaveUI() {
      closeModal('eventModal');
      clearEventForm();
    }

    function renderEventSaveUI() {
      requestRender(['dashboard', 'events']);
    }

    function openEventModal() {
      clearEventForm();
      openModal('eventModal');
    }

    function editEventItem(id) {
      const item = state.events.find(entry => entry.id === id);
      if (!item) return;
      editingEventId = id;
      document.getElementById('eventModalTitle').textContent = 'Editar evento / ação';
      document.getElementById('event_date').value = item.date || getDefaultPeriodDate();
      document.getElementById('event_time').value = item.time || '';
      document.getElementById('event_type').value = item.type || 'Evento';
      document.getElementById('event_status').value = item.status || 'Programado';
      document.getElementById('event_title').value = item.title || '';
      document.getElementById('event_place').value = item.place || '';
      document.getElementById('event_owner').value = item.owner || '';
      document.getElementById('event_description').value = item.description || '';
      openModal('eventModal');
    }


    function removeEventItem(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir este evento / ação?', async () => {
        const existing = state.events.find(entry => entry.id === id);
        if (!existing) return;
        state.events = state.events.filter(entry => entry.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.events.push(existing);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['dashboard', 'events']);
      });
    }

    async function duplicateEventItem(id) {
      if (!assertWritableCurrentPeriod()) return;
      const item = state.events.find(entry => entry.id === id);
      if (!item) return;
      const clone = {
        ...structuredClone(item),
        id: crypto.randomUUID(),
        title: `${item.title || 'Evento'} (cópia)`,
        status: 'Programado'
      };
      state.events.push(clone);
      state.events.sort(compareByDateTime);
      const saved = await saveData();
      requestRender(['events', 'dashboard']);
      if (saved) showSaveToast('✓ evento duplicado');
    }

    function renderEvents() {
      const dadosEventos = selecionarDadosEventosAgrupados();
      const list = dadosEventos.lista;
      const monthEvents = state.events || [];
      const totalEventos = monthEvents.filter(item => normalizeEventType(item.type) === 'evento').length;
      const totalAcoes = monthEvents.filter(item => normalizeEventType(item.type) === 'acao').length;
      const totalFeriados = monthEvents.filter(item => normalizeEventType(item.type) === 'feriado').length;
      const totalConfirmados = monthEvents.filter(item => String(item.status || '') === 'Confirmado').length;
      const totalProgramados = monthEvents.filter(item => String(item.status || '') === 'Programado').length;
      aplicarHtmlSeMudou(document.getElementById('eventsQuickSummary'), `
        <span class="events-quick-summary-item type-event">Eventos <strong>${totalEventos}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-action">Ações <strong>${totalAcoes}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-holiday">Feriados <strong>${totalFeriados}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-confirmed">Confirmados <strong>${totalConfirmados}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-programmed">Programados <strong>${totalProgramados}</strong></span>
      `);
      const summary = document.getElementById('eventSummaryCards');
      if (summary) {
        aplicarHtmlSeMudou(summary, [
          { label: 'Itens na agenda', value: dadosEventos.total, foot: dadosEventos.total ? `Filtro atual em ${getPeriodLabel()}` : `Sem itens em ${getPeriodLabel()}` },
          { label: 'Próximos', value: dadosEventos.proximos, foot: 'Eventos futuros não cancelados' },
          { label: 'Confirmados', value: dadosEventos.confirmados, foot: 'Programação validada para operação' },
          { label: 'Concluídos', value: dadosEventos.concluidos, foot: 'Ações já executadas no período' }
        ].map(card => `
          <div class="schedule-kpi">
            <div class="schedule-kpi-label">${esc(card.label)}</div>
            <div class="schedule-kpi-value">${esc(card.value)}</div>
            <div class="schedule-kpi-foot">${esc(card.foot)}</div>
          </div>
        `).join(''));
      }

      const eventsList = document.getElementById('eventsList');
      if (!list.length) {
        aplicarHtmlSeMudou(eventsList, `<div class="empty">Nenhum evento ou ação encontrado para os filtros aplicados em ${esc(getPeriodLabel())}.</div>`);
      } else {
        aplicarPatchCards(eventsList, list, item => item.id, item => `
          <div class="event-card">
            <div class="event-head">
              <div>
                <div class="event-title">${esc(item.title || 'Sem título')}</div>
                <div class="event-meta">
                  <span>${esc(getPeriodDisplayDate(item.date))}</span>
                  ${item.time ? `<span>• ${esc(item.time)}</span>` : ''}
                  ${item.place ? `<span>• ${esc(item.place)}</span>` : ''}
                </div>
              </div>
              <span class="event-type">${esc(item.type || 'Evento')}</span>
            </div>
            <div class="event-chip-row">
              ${item.owner ? `<span class="event-chip">Responsável: ${esc(item.owner)}</span>` : ''}
              <span class="event-chip ${eventStatusClass(item.status)}">Status: ${esc(item.status || 'Programado')}</span>
            </div>
            <div class="event-desc">${esc(shortText(item.description || 'Sem descrição adicional.', 170))}</div>
            <div class="ticket-actions">
              <button class="btn btn-ghost btn-xs" data-action="edit-event-item" data-id="${item.id}">Editar</button>
              <button class="btn btn-ghost btn-xs" data-action="duplicate-event-item" data-id="${item.id}">Duplicar</button>
              <button class="btn btn-danger btn-xs" data-action="remove-event-item" data-id="${item.id}">Excluir</button>
            </div>
          </div>
        `);
      }

      const next = dadosEventos.proximo;
      aplicarHtmlSeMudou(document.getElementById('eventsUpcoming'), next ? `
        <div class="event-card">
          <div class="event-head">
            <div>
              <div class="event-title">${esc(next.title)}</div>
              <div class="event-meta">
                <span>${esc(getPeriodDisplayDate(next.date))}</span>
                ${next.time ? `<span>• ${esc(next.time)}</span>` : ''}
                ${next.place ? `<span>• ${esc(next.place)}</span>` : ''}
              </div>
            </div>
            <span class="event-type">${esc(next.type || 'Evento')}</span>
          </div>
          <div class="event-chip-row">
            ${next.owner ? `<span class="event-chip">Responsável: ${esc(next.owner)}</span>` : ''}
            <span class="event-chip ${eventStatusClass(next.status)}">Status: ${esc(next.status || 'Programado')}</span>
          </div>
          <div class="event-desc">${esc(next.description || 'Sem descrição adicional.')}</div>
        </div>
      ` : `<div class="empty">Nenhum evento ou ação programado com os filtros atuais.</div>`);

      renderEventsCalendar(dadosEventos);

      const eventsTableBody = document.getElementById('eventsTableBody');
      if (!list.length) {
        aplicarHtmlSeMudou(eventsTableBody, `<tr><td colspan="8"><div class="empty">Nenhum registro na agenda com os filtros aplicados.</div></td></tr>`);
      } else {
        aplicarPatchLinhas(eventsTableBody, list, item => item.id, item => `
          <tr>
            <td>${esc(getPeriodDisplayDate(item.date))}</td>
            <td>${esc(item.time || '—')}</td>
            <td>${esc(item.type || 'Evento')}</td>
            <td>${renderEllipsisCell(item.title, 'Sem título')}</td>
            <td>${renderEllipsisCell(item.place, '—')}</td>
            <td>${renderEllipsisCell(item.owner, '—')}</td>
            <td><span class="event-chip ${eventStatusClass(item.status)}">${esc(item.status || 'Programado')}</span></td>
            <td class="right">
              <button class="btn btn-ghost btn-xs" data-action="edit-event-item" data-id="${item.id}">Editar</button>
              <button class="btn btn-ghost btn-xs" data-action="duplicate-event-item" data-id="${item.id}">Duplicar</button>
              <button class="btn btn-danger btn-xs" data-action="remove-event-item" data-id="${item.id}">Excluir</button>
            </td>
          </tr>
        `);
      }
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — SETTINGS & DIAGNOSTICS — renderSettings, saveSettings, resizeMonth, renderBackupSummary, runSystemDiagnostics, importData, exportData
    // ══════════════════════════════════════════

    function renderSettings() {
      if (!state?.settings) return;
      document.getElementById('receptionistEditor').value = getReceptionists(state).join('\n');
      document.getElementById('professorEditor').value = getProfessors(state).join('\n');
      document.getElementById('addonTypeEditor').value = state.settings.addonTypes.join('\n');
      renderSettingsHealthBar();
      renderSettingsSupportPanels();
      renderBackupSummary();
      renderDiagnosticsPanel();
      renderPersistenceTechPanel();
      renderPeriodAudit();
      renderFlowSmokePanel();
    }

    async function saveSettings() {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const { receptionists, professors, addonTypes } = getSettingsFormData();
      if (!receptionists.length || !addonTypes.length) { showToast('Informe ao menos uma recepcionista e um tipo de addon.', 'warning'); return; }
      const old = structuredClone(state);
      state.settings.receptionists = receptionists;
      state.settings.professors = professors;
      state.settings.team = [...new Set([...receptionists, ...professors])];
      state.settings.addonTypes = addonTypes;
      normalizeData(state);
      const removedNames = new Set(getReceptionists(old).filter(name => !getReceptionists(state).includes(name)));
      removedNames.forEach(oldName => {
        state.students = state.students.map(s => s.atendimento === oldName ? { ...s, atendimento: getReceptionists(state)[0] } : s);
        state.pending = state.pending.map(p => p.hostess === oldName ? { ...p, hostess: getReceptionists(state)[0] } : p);
      });
      if (removedNames.size) {
        state.nps.mentions = state.nps.mentions.filter(m => !removedNames.has(m.name));
      }
      const saved = await saveData();
      populateStudentFilters();
      requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
      if (saved) showToast('Configurações salvas com sucesso.');
    }

    function resizeMonth(days) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'addons'] })) return;
      const newDays = Number(days);
      const oldDays = state.settings.monthDays;

      // Verificar se há dados nos dias que serão cortados
      if (newDays < oldDays) {
        const hasDataInLostDays = Object.values(state.addons || {}).some(group =>
          Object.values(group || {}).some(arr =>
            Array.isArray(arr) && arr.slice(newDays).some(v => Number(v || 0) > 0)
          )
        );
        if (hasDataInLostDays) {
          showConfirm(
            `Há dados de addons nos dias ${newDays + 1} a ${oldDays} que serão perdidos. Deseja continuar?`,
            () => doResizeMonth(newDays)
          );
          return;
        }
      }

      doResizeMonth(newDays);
    }

    function doResizeMonth(days) {
      state.settings.monthDays = days;
      Object.keys(state.addons || {}).forEach(person => {
        const knownTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(state.addons[person] || {})])];
        knownTypes.forEach(type => {
          const old = state.addons[person]?.[type] || [];
          state.addons[person][type] = Array.from({ length: state.settings.monthDays }, (_, i) => Number(old[i] || 0));
        });
      });
      saveData();
      requestRender(['hero', 'dashboard', 'addons']);
    }

    function getPeriodMetrics(period) {
      normalizeData(period);
      return {
        recados: period.recados.length,
        students: period.students.length,
        pending: period.pending.length,
        events: period.events.length,
        scale: period.scale.length,
        mentions: period.nps.mentions.length,
        addonVolume: Object.values(period.addons || {}).reduce((acc, byType) => acc + Object.values(byType || {}).reduce((sum, days) => sum + (days || []).reduce((dayAcc, value) => dayAcc + Number(value || 0), 0), 0), 0)
      };
    }

    function getBackupSummary(storeRef = storage) {
      const periods = Object.entries(storeRef.periods || {});
      const totals = periods.reduce((acc, [_, period]) => {
        const metrics = getPeriodMetrics(period);
        acc.recados += metrics.recados;
        acc.students += metrics.students;
        acc.pending += metrics.pending;
        acc.events += metrics.events;
        acc.scale += metrics.scale;
        acc.mentions += metrics.mentions;
        acc.addonVolume += metrics.addonVolume;
        return acc;
      }, { recados: 0, students: 0, pending: 0, events: 0, scale: 0, mentions: 0, addonVolume: 0 });
      return {
        periods: periods.length,
        archives: Object.keys(storeRef.archives || {}).length,
        ...totals
      };
    }

    function formatBytes(bytes) {
      const value = Math.max(0, Number(bytes || 0));
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${value} B`;
    }

    function getSettingsStorageUsage() {
      const quotaBytes = 5 * 1024 * 1024;
      try {
        const relevantKeys = [];
        const knownKeys = new Set([
          STORAGE_KEY,
          STORAGE_BROADCAST_KEY,
          LOCAL_SNAPSHOT_KEY,
          SYSTEM_REPORT_KEY,
          FLOW_TEST_REPORT_KEY,
          UI_KEY,
          ...LEGACY_STORAGE_KEYS,
          ...LEGACY_LOCAL_SNAPSHOT_KEYS,
          ...LEGACY_SYSTEM_REPORT_KEYS,
          ...LEGACY_FLOW_TEST_REPORT_KEYS,
          ...LEGACY_UI_KEYS
        ]);
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (!key) continue;
          if (key.startsWith('wpm_') || knownKeys.has(key)) relevantKeys.push(key);
        }
        const bytes = relevantKeys.reduce((acc, key) => {
          const raw = localStorage.getItem(key);
          return acc + new Blob([JSON.stringify({ key, value: raw ?? '' })]).size;
        }, 0);
        return {
          bytes,
          quotaBytes,
          ratio: quotaBytes ? Math.min(1, bytes / quotaBytes) : 0,
          keyCount: relevantKeys.length,
          status: bytes / quotaBytes >= 0.8 ? 'warn' : 'ok'
        };
      } catch (error) {
        console.error('Falha ao calcular uso do armazenamento local:', error);
        return {
          bytes: 0,
          quotaBytes,
          ratio: 0,
          keyCount: 0,
          status: 'info',
          error: true
        };
      }
    }

    function getSettingsMetaSnapshot() {
      const summary = getBackupSummary(storage);
      const periodEntries = Object.entries(storage.periods || {});
      const monthsWithData = periodEntries.filter(([, period]) => periodHasMeaningfulData(period)).length;
      const totalRecords = periodEntries.reduce((acc, [, period]) => {
        const metrics = getPeriodMetrics(period);
        return acc + metrics.students + metrics.pending + metrics.events;
      }, 0);
      const emptyMonths = periodEntries.filter(([key, period]) => key !== currentPeriodKey && !periodHasMeaningfulData(period) && loadRecados(key).length === 0).length;
      const storageUsage = getSettingsStorageUsage();
      let lastBackupLabel = 'Não rastreado';
      try {
        const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
        if (snapshot?.savedAt) lastBackupLabel = new Date(snapshot.savedAt).toLocaleString('pt-BR');
      } catch (error) {
        console.error('Falha ao ler snapshot local:', error);
      }
      return {
        summary,
        monthsWithData,
        totalRecords,
        emptyMonths,
        storageUsage,
        lastBackupLabel
      };
    }

    function renderSettingsHealthBar() {
      const host = document.getElementById('settingsHealthBar');
      if (!host) return;
      const meta = getSettingsMetaSnapshot();
      const storageStatusLabel = meta.storageUsage.error
        ? 'Leitura local indisponível'
        : meta.storageUsage.status === 'warn'
          ? 'Espelho local próximo do limite'
          : 'Espelho local OK';
      const storagePill = meta.storageUsage.error
        ? 'info'
        : meta.storageUsage.status === 'warn'
          ? 'warn'
          : 'ok';
      aplicarHtmlSeMudou(host, `
        <span class="settings-health-item"><span class="pill ${storagePill}">${esc(storageStatusLabel)}</span></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Meses com dados</span><strong>${meta.monthsWithData}</strong></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Último backup/snapshot</span><strong>${esc(meta.lastBackupLabel)}</strong></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Total de registros</span><strong>${meta.totalRecords}</strong></span>
      `);
    }

    function renderSettingsSupportPanels() {
      const meta = getSettingsMetaSnapshot();
      const aboutHost = document.getElementById('settingsAboutPanel');
      const storageHost = document.getElementById('settingsStorageUsage');
      const maintenanceHost = document.getElementById('settingsMaintenanceList');

      if (aboutHost) {
        aplicarHtmlSeMudou(aboutHost, `
          <div class="settings-about-grid">
            <div class="settings-about-item">
              <div class="name">Versão</div>
              <div class="value">${esc(APP_VERSION)}</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Autor</div>
              <div class="value">Wallace Phillip Maclayne</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Tecnologia</div>
              <div class="value">HTML/CSS/JS + persistência local híbrida (IndexedDB + localStorage)</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Descrição</div>
              <div class="value">SPA single-file para operação interna da recepção, com controle mensal independente por período.</div>
            </div>
          </div>
        `);
      }

      if (storageHost) {
        const usage = meta.storageUsage;
        const toneClass = usage.error ? 'info' : usage.status === 'warn' ? 'warn' : 'ok';
        const usageLabel = usage.error ? 'Leitura indisponível' : usage.status === 'warn' ? 'Espelho local próximo do limite estimado' : 'Espelho local em faixa confortável';
        aplicarHtmlSeMudou(storageHost, `
          <div class="settings-storage-box">
            <div class="settings-storage-top">
              <span class="pill ${toneClass}">${esc(usageLabel)}</span>
              <span class="muted">${esc(formatBytes(usage.bytes))} de ${esc(formatBytes(usage.quotaBytes))}</span>
            </div>
            <div class="settings-storage-bar" aria-hidden="true">
              <div class="settings-storage-fill" style="width:${Math.min(100, usage.ratio * 100)}%"></div>
            </div>
            <div class="settings-storage-meta">
              <span>Uso estimado do espelho local <strong>${usage.error ? '—' : `${(usage.ratio * 100).toFixed(1)}%`}</strong></span>
              <span>Chaves monitoradas <strong>${usage.keyCount}</strong></span>
              <span>Escopo <strong>localStorage monitorado do app</strong></span>
            </div>
            <div class="settings-storage-foot">Estimativa local de 5 MB para o espelho em localStorage. A persistência principal do app usa IndexedDB; este painel mostra somente as chaves locais auxiliares e de compatibilidade desta versão.</div>
          </div>
        `);
      }

      if (maintenanceHost) {
        aplicarHtmlSeMudou(maintenanceHost, `
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Exportação consolidada</div>
              <div class="muted">O backup JSON já inclui todos os períodos carregados, arquivos fechados e snapshots necessários para restauração.</div>
            </div>
          </div>
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Limpeza de meses vazios</div>
              <div class="muted">${meta.emptyMonths} período(s) sem massa operacional nem recados podem ser removidos com segurança.</div>
            </div>
          </div>
        `);
      }
    }

    // CSV export movido para src/features/csv.js

    // Smoke tests de fluxo movidos para src/features/diagnostics.js

    function isLegacyPeriodPayload(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      return ['settings', 'students', 'pending', 'recados', 'nps', 'scale', 'events', 'addons', 'escala', 'eventos'].some(key => key in payload);
    }

    function extractImportedPayload(source) {
      const cleanedRoot = sanitizeDeep(cloneSerializable(source));
      const payload = cleanedRoot?.payload && typeof cleanedRoot.payload === 'object' && !Array.isArray(cleanedRoot.payload)
        ? cleanedRoot.payload
        : cleanedRoot;
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    }

    function isMonthArchivePayload(payload) {
      return Boolean(
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        isValidPeriodKey(payload.periodKey) &&
        payload.data &&
        typeof payload.data === 'object' &&
        !Array.isArray(payload.data)
      );
    }

    function getMonthArchiveImportMeta(payload) {
      if (!isMonthArchivePayload(payload)) return null;
      const periodKey = String(payload.periodKey);
      return {
        periodKey,
        periodLabel: String(payload.periodLabel || '').trim() || getPeriodLabel(periodKey),
        exportedAt: String(payload?.meta?.exportedAt || '').trim()
      };
    }

    function buildArchiveEntryFromMonthArchivePayload(payload, existingArchive = null) {
      const meta = getMonthArchiveImportMeta(payload);
      if (!meta) return existingArchive || null;
      const exportedDate = meta.exportedAt ? new Date(meta.exportedAt) : null;
      const hasValidExportedDate = exportedDate && !Number.isNaN(exportedDate.getTime());
      const fallbackDate = existingArchive?.closedAt ? new Date(existingArchive.closedAt) : new Date();
      const normalizedDate = hasValidExportedDate ? exportedDate : fallbackDate;

      return {
        closedAt: normalizedDate.toISOString(),
        closedAtLabel: normalizedDate.toLocaleString('pt-BR'),
        label: meta.periodLabel || existingArchive?.label || getPeriodLabel(meta.periodKey)
      };
    }

    function buildStoreFromMonthArchivePayload(payload, baseStore = storage) {
      const meta = getMonthArchiveImportMeta(payload);
      if (!meta) return null;

      const baseCandidate = prepareStoreCandidate(cloneSerializable(baseStore)) || getDefaultStore();
      const nextStore = cloneSerializable(baseCandidate);
      nextStore.periods ||= {};
      nextStore.archives ||= {};
      nextStore.periods[meta.periodKey] = cloneSerializable(payload.data);
      normalizeData(nextStore.periods[meta.periodKey]);
      nextStore.archives[meta.periodKey] = buildArchiveEntryFromMonthArchivePayload(payload, nextStore.archives[meta.periodKey]);
      return prepareStoreCandidate(nextStore);
    }

    function getImportedPayloadDescriptor(source) {
      const payload = extractImportedPayload(source);
      if (!payload) return { kind: 'unknown' };
      if (isMonthArchivePayload(payload)) {
        const meta = getMonthArchiveImportMeta(payload);
        return {
          kind: 'month-archive',
          periodKey: meta.periodKey,
          periodLabel: meta.periodLabel
        };
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return {
          kind: 'full-backup',
          periodCount: Object.keys(payload.periods).filter(isValidPeriodKey).length
        };
      }
      if (isLegacyPeriodPayload(payload)) {
        return { kind: 'legacy-period' };
      }
      return { kind: 'unknown' };
    }

    function coerceImportedStore(source) {
      const payload = extractImportedPayload(source);
      if (!payload) return null;
      if (isMonthArchivePayload(payload)) {
        return buildStoreFromMonthArchivePayload(payload, storage);
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return prepareStoreCandidate(payload);
      }
      if (isLegacyPeriodPayload(payload)) {
        const initialKey = getInitialPeriodKey();
        return prepareStoreCandidate({
          version: getStoreVersion(payload),
          activePeriod: initialKey,
          periods: { [initialKey]: payload },
          archives: {}
        });
      }
      return null;
    }

    async function buildBackupPayload(options = {}) {
      // Export = store saneado atual, opcionalmente persistido antes de gerar o JSON.
      const storeSnapshot = await getCommittedStoreSnapshot({
        persistCurrent: options?.persistCurrent !== false,
        eventType: String(options?.eventType || 'save'),
        broadcast: options?.broadcast === true
      });
      return buildBackupPayloadFromStore(storeSnapshot);
    }

    async function applyImportedStore(parsed, options = {}) {
      // Import/restore = sanitize -> normalize -> persist -> recarregar store principal -> sync UI.
      // Fechamento mensal é mesclado ao store atual como período arquivado; backup
      // completo continua substituindo a base inteira.
      const normalized = coerceImportedStore(parsed);
      if (!normalized) throw new Error('Estrutura inválida ou incompatível com o schema atual.');
      const saved = await saveStore(normalized, {
        silent: true,
        eventType: String(options.eventType || 'import')
      });
      if (!saved) throw new Error('Falha ao persistir o backup importado.');
      const committedStore = await readStoredStore(STORAGE_KEY);
      if (!committedStore) throw new Error('Falha ao recarregar o store importado após persistir.');
      await syncAppState(committedStore);
      renderAll();
      syncPeriodControls();
      runSystemDiagnostics(true);
      return getBackupSummary(storage);
    }

    async function saveLocalSnapshot(payload = null) {
      const snapshotPayload = payload || await buildBackupPayload({
        persistCurrent: true,
        eventType: 'snapshot',
        broadcast: false
      });
      const snapshot = { savedAt: new Date().toISOString(), payload: snapshotPayload };
      const result = await persistStoredJson(
        LOCAL_SNAPSHOT_KEY,
        snapshot,
        'Armazenamento cheio. Não foi possível salvar o snapshot local.'
      );
      if (result.ok) {
        await removeStoredValues(LEGACY_LOCAL_SNAPSHOT_KEYS);
        requestRender('settings');
        showSaveToast('✓ snapshot local salvo');
      }
      return result.ok ? snapshot : null;
    }

    function restoreLocalSnapshot() {
      if (!assertWritableCurrentPeriod()) return;
      const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
      if (!snapshot) { showToast('Nenhum snapshot local foi salvo ainda.', 'info'); return; }
      showConfirm('Deseja restaurar o último snapshot local? Isso substituirá o estado atual.', async () => {
        try {
          const summary = await applyImportedStore(snapshot.payload || snapshot, { eventType: 'restore' });
          showToast(`Snapshot restaurado: ${summary.periods} períodos carregados.`);
        } catch {
          showToast('Snapshot local inválido ou corrompido.', 'danger');
        }
      });
    }

    function loadSystemReport() {
      return readStoredJsonWithFallback(SYSTEM_REPORT_KEY, LEGACY_SYSTEM_REPORT_KEYS, []);
    }

    function saveSystemReport(report) {
      writeStoredJson(SYSTEM_REPORT_KEY, report);
      removeStoredValues(LEGACY_SYSTEM_REPORT_KEYS);
      return report;
    }

    function runSystemDiagnostics(silent = false) {
      const periodEntries = Object.entries(storage.periods || {});
      const currentMetrics = getPeriodMetrics(state);
      const receptionists = new Set(getReceptionists(state));
      const employees = getAllEmployees(state);
      const mentionNames = new Set((state.nps.mentions || []).map(item => item.name).filter(Boolean));
      const report = [
        {
          label: 'Estrutura principal do armazenamento',
          status: storage.activePeriod && storage.periods?.[storage.activePeriod] ? 'ok' : 'bad',
          detail: storage.activePeriod && storage.periods?.[storage.activePeriod] ? `Período ativo ${getPeriodLabel(storage.activePeriod)} disponível.` : 'Período ativo ausente no armazenamento.'
        },
        {
          label: 'Atendimentos vinculados a recepcionistas',
          status: state.students.every(item => receptionists.has(item.atendimento)) ? 'ok' : 'bad',
          detail: `${state.students.filter(item => receptionists.has(item.atendimento)).length}/${state.students.length} registros válidos no período ativo.`
        },
        {
          label: 'Pendências vinculadas a recepcionistas',
          status: state.pending.every(item => receptionists.has(item.hostess)) ? 'ok' : 'bad',
          detail: `${state.pending.filter(item => receptionists.has(item.hostess)).length}/${state.pending.length} pendências com hostess válida.`
        },
        {
          label: 'Cobertura de NPS do período ativo',
          status: employees.every(name => mentionNames.has(name)) ? 'ok' : 'warn',
          detail: `${mentionNames.size}/${employees.length} funcionários aparecem nas citações do NPS.`
        },
        {
          label: 'Massa de teste do período ativo',
          status: currentMetrics.students >= 30 && currentMetrics.pending >= 20 && currentMetrics.events >= 10 && currentMetrics.scale > 0 ? 'ok' : 'warn',
          detail: `${currentMetrics.students} alunos • ${currentMetrics.pending} pendências • ${currentMetrics.events} eventos • ${currentMetrics.scale} turnos de escala.`
        },
        {
          label: 'Cobertura anual carregada',
          status: periodEntries.length >= 12 ? 'ok' : 'warn',
          detail: `${periodEntries.length} períodos disponíveis no armazenamento atual.`
        },
        {
          label: 'Snapshot local disponível',
          status: hasStoredValueWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS) ? 'ok' : 'info',
          detail: hasStoredValueWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS) ? 'Existe um snapshot local pronto para restauração rápida.' : 'Nenhum snapshot local salvo ainda.'
        }
      ];
      saveSystemReport(report);
      if (!silent) {
        const failures = report.filter(item => item.status === 'bad').length;
        const warnings = report.filter(item => item.status === 'warn').length;
        const type = failures > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success';
        showToast(`Validação concluída: ${report.length - failures - warnings} ok, ${warnings} alerta(s), ${failures} falha(s).`, type, 4500);
      }
      requestRender('settings');
      return report;
    }

    function renderBackupSummary() {
      const host = document.getElementById('backupSummaryList');
      if (!host) return;
      const summary = getBackupSummary();
      let snapshotText = 'Nenhum snapshot local salvo.';
      try {
        const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
        if (snapshot?.savedAt) snapshotText = `Último snapshot local em ${new Date(snapshot.savedAt).toLocaleString('pt-BR')}.`;
      } catch {}
      host.innerHTML = `
        <div class="summary-item summary-item--backup">
          <div>
            <div class="name">Backup ativo</div>
            <div class="muted">${esc(getPeriodLabel())} • ${esc(APP_VERSION)}</div>
          </div>
          <div class="metric"><strong>${summary.periods}</strong><span>Períodos</span></div>
          <div class="metric"><strong>${summary.archives}</strong><span>Arquivos</span></div>
          <div class="metric"><strong>${summary.students + summary.pending + summary.events}</strong><span>Itens principais</span></div>
        </div>
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Resumo consolidado</div>
            <div class="muted">${summary.recados} recados • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos • ${summary.scale} turnos • ${summary.mentions} citações de NPS • volume de addons ${summary.addonVolume}.</div>
            <div class="subtle-note">${esc(snapshotText)}</div>
          </div>
        </div>
      `;
    }

    function renderDiagnosticsPanel() {
      const host = document.getElementById('diagnosticSummaryList');
      if (!host) return;
      const report = loadSystemReport();
      if (!report.length) {
        host.innerHTML = `<div class="summary-item summary-item--col1"><div><div class="name">Validação ainda não executada</div><div class="muted">Use o botão Validar sistema para gerar um relatório rápido da base atual.</div></div></div>`;
        return;
      }
      host.innerHTML = report.map(item => `
        <div class="summary-item summary-item--diagnostic">
          <div><span class="pill ${item.status === 'ok' ? 'ok' : item.status === 'bad' ? 'bad' : item.status === 'warn' ? 'warn' : 'info'}">${item.status === 'ok' ? 'OK' : item.status === 'bad' ? 'Falha' : item.status === 'warn' ? 'Alerta' : 'Info'}</span></div>
          <div>
            <div class="name">${esc(item.label)}</div>
            <div class="muted">${esc(item.detail)}</div>
          </div>
        </div>
      `).join('');
    }

    function renderPersistenceTechPanel() {
      const host = document.getElementById('persistenceTechList');
      if (!host) return;

      const statusPillClass = persistenceTechState.status === 'pronto'
        ? 'ok'
        : persistenceTechState.status === 'sincronizando'
          ? 'warn'
          : 'bad';
      const statusLabel = persistenceTechState.status === 'pronto'
        ? 'Pronto'
        : persistenceTechState.status === 'sincronizando'
          ? 'Sincronizando'
          : 'Erro';
      const selfTestClass = persistenceTechState.selfTest.status === 'ok'
        ? 'ok'
        : persistenceTechState.selfTest.status === 'bad'
          ? 'bad'
          : 'info';
      const selfTestLabel = persistenceTechState.selfTest.status === 'ok'
        ? 'OK'
        : persistenceTechState.selfTest.status === 'bad'
          ? 'Falha'
          : 'Info';

      host.innerHTML = `
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Painel técnico de persistência</div>
            <div class="muted">Somente leitura; o autoteste é executado sob demanda.</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Modo de persistência</div>
            <div class="muted">${esc(persistenceTechState.modeLabel)}</div>
          </div>
          <div>
            <div class="name">Status da persistência</div>
            <div class="muted"><span class="pill ${statusPillClass}">${statusLabel}</span></div>
          </div>
          <div>
            <div class="name">Backend principal</div>
            <div class="muted">${esc(persistenceTechState.backendLabel)}</div>
          </div>
          <div>
            <div class="name">Broadcast cross-tab</div>
            <div class="muted">${persistenceTechState.broadcastAvailable ? 'ativo' : 'indisponível'}</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Última gravação bem-sucedida</div>
            <div class="muted">${esc(formatPersistenceTimestamp(persistenceTechState.lastSuccessAt))}</div>
          </div>
          <div>
            <div class="name">Último tipo de operação</div>
            <div class="muted">${esc(persistenceTechState.lastOperationType)}</div>
          </div>
          <div>
            <div class="name">Versão do payload/store</div>
            <div class="muted">${esc(String(persistenceTechState.storeVersion || STORE_VERSION))}</div>
          </div>
          <div>
            <div class="name">Autoteste de persistência</div>
            <div class="muted"><span class="pill ${selfTestClass}">${selfTestLabel}</span> ${esc(persistenceTechState.selfTest.detail)}</div>
          </div>
        </div>
      `;
    }

    function renderPeriodAudit() {
      const host = document.getElementById('periodAuditList');
      if (!host) return;
      const entries = Object.entries(storage.periods || {}).sort(([a], [b]) => a.localeCompare(b));
      host.innerHTML = entries.map(([key, period]) => {
        const metrics = getPeriodMetrics(period);
        const isEmpty = !periodHasMeaningfulData(period) && loadRecados(key).length === 0;
        const coverageOk = !isEmpty && metrics.students >= 30 && metrics.pending >= 20 && metrics.events >= 10 && metrics.scale > 0;
        const [year, month] = String(key).split('-');
        const monthName = MONTH_NAMES[Math.max(0, Number(month || 1) - 1)] || month;
        return `
          <div class="summary-item summary-item--audit settings-period-card ${isEmpty ? 'is-empty' : ''}">
            <div class="settings-period-head">
              <div class="settings-period-title">
                <div class="settings-period-month">${esc(monthName)}</div>
                <div class="settings-period-year">${esc(year)}</div>
                <div class="settings-period-meta">Ref. ${esc(String(key))}</div>
              </div>
              <div class="settings-period-status"><span class="pill ${isEmpty ? 'info' : coverageOk ? 'ok' : 'warn'}">${isEmpty ? 'Vazio' : coverageOk ? 'Completo' : 'Revisar'}</span></div>
            </div>
            <div class="settings-period-kpis">
              <div class="settings-period-kpi"><strong>${metrics.students}</strong><span>Alunos</span></div>
              <div class="settings-period-kpi"><strong>${metrics.pending}</strong><span>Pend.</span></div>
              <div class="settings-period-kpi"><strong>${metrics.events}</strong><span>Eventos</span></div>
              <div class="settings-period-kpi"><strong>${metrics.scale}</strong><span>Escala</span></div>
            </div>
            <div class="settings-period-foot">
              <span class="settings-period-chip">NPS ${metrics.mentions}</span>
              <span class="settings-period-chip">Addons ${metrics.addonVolume}</span>
              ${isEmpty ? '<span class="settings-period-chip">Sem massa operacional</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    async function clearEmptyMonths() {
      const removable = Object.entries(storage.periods || {})
        .filter(([key, period]) => key !== currentPeriodKey && !periodHasMeaningfulData(period) && loadRecados(key).length === 0)
        .map(([key]) => key);
      if (!removable.length) {
        showToast('Nenhum mês vazio encontrado para limpeza.', 'info');
        return;
      }
      showConfirm(`Remover ${removable.length} período(s) vazio(s) do armazenamento local? Essa ação mantém o mês ativo e ignora meses com recados.`, async () => {
        removable.forEach(key => {
          delete storage.periods[key];
        });
        const saved = await saveStore(storage);
        requestRender('settings');
        if (saved) showToast(`✓ ${removable.length} período(s) vazio(s) removido(s).`, 'success');
      });
    }

    async function downloadData() {
      const payload = await buildBackupPayload({
        persistCurrent: true,
        eventType: 'backup',
        broadcast: false
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const now = new Date();
      const ts = `${todayISO()}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
      a.download = `smartfit-recepcao-backup-${ts}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      await saveLocalSnapshot(payload);
      showSaveToast('✓ backup exportado com sucesso');
    }

    function importData(file) {
      if (!assertWritableCurrentPeriod()) return;
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { showToast('Arquivo muito grande (máximo: 50MB).', 'danger'); return; }
      if (!file.name.endsWith('.json')) { showToast('Formato inválido. Selecione um arquivo .json.', 'warning'); return; }
      const reader = new FileReader();
      reader.onerror = () => showToast('Erro ao ler o arquivo. Tente novamente.', 'danger');
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result);
          const descriptor = getImportedPayloadDescriptor(parsed);
          const importedStore = coerceImportedStore(parsed);
          if (!importedStore) throw new Error('Dados não reconhecidos');
          const confirmMessage = descriptor.kind === 'month-archive'
            ? `Confirmar importação do fechamento de ${descriptor.periodLabel}? Somente ${descriptor.periodLabel} será restaurado/atualizado e marcado como fechado. Um backup será gerado antes.`
            : 'Confirmar importação e substituir todos os dados atuais? Um backup será gerado antes.';
          showConfirm(confirmMessage, async () => {
            try {
              await downloadData();
              const summary = await applyImportedStore(parsed, { eventType: 'import' });
              const successMessage = descriptor.kind === 'month-archive'
                ? `Fechamento de ${descriptor.periodLabel} importado com sucesso. Demais períodos foram preservados.`
                : `Backup importado: ${summary.periods} períodos • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos.`;
              showToast(successMessage, 'success', 5000);
            } catch (err) {
              showToast('Erro ao aplicar backup: ' + (err.message || 'erro desconhecido'), 'danger');
            }
          });
        } catch (err) {
          showToast('Arquivo inválido. Importe um backup JSON gerado pelo app. Detalhe: ' + (err.message || 'erro desconhecido'), 'danger', 5000);
        }
      };
      reader.readAsText(file);
    }

    function resetDemoData() {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja restaurar o exemplo inicial? Isso substituirá os dados atuais.', async () => {
        const initialKey = getInitialPeriodKey();
        storage = normalizeStore({ activePeriod: initialKey, periods: seedYear(String(initialKey).split('-')[0]), archives: {} });
        currentPeriodKey = storage.activePeriod;
        state = storage.periods[currentPeriodKey];
        await saveData();
        renderAll();
        syncPeriodControls();
      });
    }

    function renderAll() {
      limparFilaRender();
      normalizeData(state);
      populateStudentFilters();
      applyUIStateToControls();
      renderSections('hero', 'dashboard', 'students', 'addons', 'pending', 'nps', 'scale', 'events', 'settings');
      syncCurrentPeriodLockUI();
    }
