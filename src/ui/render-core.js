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

    /** @param {AppUIState} [ui] @returns {{query:string, person:string, feedback:string}} */
    function getStudentViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.studentSearch || ''),
        person: String(ui.studentFilterAtendente || ''),
        feedback: String(ui.studentFilterFeedback || '')
      };
    }

    /** @param {AppUIState} [ui] @returns {{query:string}} */
    function getPendingViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.pendingSearch || '')
      };
    }

    /** @param {AppUIState} [ui] @returns {{query:string, typeFilter:string, statusFilter:string}} */
    function getEventViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.eventSearch || ''),
        typeFilter: String(ui.eventTypeFilter || '').trim(),
        statusFilter: String(ui.eventStatusFilter || '').trim()
      };
    }

    /** @param {AppUIState} [ui] @returns {{query:string}} */
    function getScaleViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.scaleSearch || '')
      };
    }

    // Dispatch map para renderização — elimina switch gigante
    const RENDER_MAP = {
      hero: () => renderHero(),
      dashboard: () => renderDashboard(),
      students: () => renderStudents(),
      addons: () => renderAddons(),
      pending: () => renderPending(),
      nps: () => renderNps(),
      scale: () => renderScale(),
      events: () => renderEvents(),
      settings: () => renderSettings()
    };

    /** @param {string} section @returns {void} */
    function renderSection(section) {
      RENDER_MAP[section]?.();
    }

    /** @param {...string} sections @returns {void} */
    function renderSections(...sections) {
      [...new Set(sections.flat().filter(Boolean))].forEach(renderSection);
    }

    /** @param {string|string[]} [alvos] @returns {string[]} */
    function normalizarAlvosRender(alvos = []) {
      const lista = Array.isArray(alvos) ? alvos.flat() : [alvos];
      const normalizados = lista.filter(Boolean).flatMap(alvo => alvo === 'all' || alvo === 'tudo' ? AREAS_RENDERIZACAO : [alvo]);
      return [...new Set(normalizados.filter(alvo => AREAS_RENDERIZACAO.includes(alvo)))];
    }

    /** @param {string|string[]} [alvos] @returns {void} */
    function requestRender(alvos = []) {
      const normalizados = normalizarAlvosRender(alvos);
      if (!normalizados.length) return;
      normalizados.forEach(alvo => estadoRenderizacao.sujas.add(alvo));
      if (estadoRenderizacao.renderizando || estadoRenderizacao.agendado) return;
      estadoRenderizacao.agendado = true;
      estadoRenderizacao.idQuadro = window.requestAnimationFrame(executarRenderAgendado);
    }

    /** @returns {void} */
    function limparFilaRender() {
      if (estadoRenderizacao.idQuadro) {
        window.cancelAnimationFrame(estadoRenderizacao.idQuadro);
      }
      estadoRenderizacao.sujas.clear();
      estadoRenderizacao.agendado = false;
      estadoRenderizacao.idQuadro = 0;
      estadoRenderizacao.ultimoLote = [];
    }

    /** @returns {void} */
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

    /** @returns {void} */
    function renderScheduler() {
      return executarRenderAgendado();
    }

    /** @param {AppUIState} [ui] @returns {void} */
    function applyUIStateToControls(ui = sanitizeUIState(getUIState())) {
      UI_CONTROL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const value = ui[id];
        if (value != null) el.value = value;
      });
    }

    /** @returns {void} */
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

    /** @param {string} view @returns {void} */
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

    /** @param {*} value @param {string} [fallback] @returns {string} */
    function renderEllipsisCell(value, fallback = '-') {
      const text = String(value ?? '').trim();
      if (!text) return `<span class="muted">${esc(fallback)}</span>`;
      return `<span class="cell-text multiline" data-tooltip="${esc(text)}">${esc(text)}</span>`;
    }

    // ══════════════════════════════════════════
    // HELPERS DE PATCH DE DOM — patch explícito por chave, sem virtual DOM
    // ══════════════════════════════════════════

    /** @param {string} html @returns {string} */
    function criarAssinaturaHtml(html) {
      let hash = 5381;
      for (let i = 0; i < html.length; i++) {
        hash = ((hash << 5) + hash) ^ html.charCodeAt(i);
      }
      return String(hash >>> 0);
    }

    /** @param {string} html @param {string} chave @param {string} assinatura @returns {Element} */
    function criarNoRenderizado(html, chave, assinatura) {
      const template = document.createElement('template');
      const markup = sanitizeHtml(html.trim());
      if (/^<tr[\s>]/i.test(markup)) {
        template.innerHTML = `<table><tbody>${markup}</tbody></table>`;
      } else {
        template.innerHTML = markup;
      }
      const no = /^<tr[\s>]/i.test(markup)
        ? template.content.querySelector('tr')
        : template.content.firstElementChild;
      if (!no) throw new Error('Renderização sem nó raiz.');
      no.dataset.chaveRender = String(chave);
      no.dataset.assinaturaRender = assinatura;
      return no;
    }

    /** @param {string} valor @returns {string} */
    function escaparSeletorCss(valor) {
      if (window.CSS?.escape) return window.CSS.escape(String(valor));
      return String(valor).replace(/["\\]/g, '\\$&');
    }

    /** @param {Element} el @returns {string|null} */
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

    /** @param {Element} container @returns {Object|null} */
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

    /** @param {Element} container @param {Object} estado @returns {void} */
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

    /** @param {Element} el @param {string} html @returns {void} */
    function aplicarHtmlSeMudou(el, html) {
      if (!el) return;
      const assinatura = criarAssinaturaHtml(html);
      if (el.dataset.assinaturaRender === assinatura) return;
      el.innerHTML = sanitizeHtml(html);
      el.dataset.assinaturaRender = assinatura;
    }

    /** @param {Element} container @param {Array<{chave:string, html:string}>} descritores @returns {void} */
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

    /** @param {Element} container @param {Array} itens @param {Function} obterChave @param {Function} renderizarLinha @returns {void} */
    function aplicarPatchLinhas(container, itens, obterChave, renderizarLinha) {
      if (!container) return;
      const foco = capturarEstadoFoco(container);
      const html = itens.map(item => renderizarLinha(item)).join('');
      const assinatura = criarAssinaturaHtml(html);
      if (container.dataset.assinaturaRender !== assinatura) {
        // Linhas de tabela já chegam com conteúdo escapado por esc() e markup
        // controlado pelo próprio app; usar innerHTML cru aqui preserva <tr>/<td>.
        container.innerHTML = html;
        container.dataset.assinaturaRender = assinatura;
      }
      restaurarEstadoFoco(container, foco);
    }

    /** @param {Element} container @param {Array} itens @param {Function} obterChave @param {Function} renderizarCard @returns {void} */
    function aplicarPatchCards(container, itens, obterChave, renderizarCard) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarCard(item)
      })));
    }

    /** @param {Element} container @param {Array} itens @param {Function} obterChave @param {Function} renderizarCard @returns {void} */
    function aplicarPatchItensKanban(container, itens, obterChave, renderizarCard) {
      aplicarPatchCards(container, itens, obterChave, renderizarCard);
    }

    /** @param {Element} container @param {Array} itens @param {Function} obterChave @param {Function} renderizarBloco @returns {void} */
    function aplicarPatchBlocosAgrupados(container, itens, obterChave, renderizarBloco) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarBloco(item)
      })));
    }

    /** @returns {void} */
    function renderAll() {
      limparFilaRender();
      normalizeData(state);
      populateStudentFilters();
      applyUIStateToControls();
      renderSections('hero', 'dashboard', 'students', 'addons', 'pending', 'nps', 'scale', 'events', 'settings');
      syncCurrentPeriodLockUI();
    }
