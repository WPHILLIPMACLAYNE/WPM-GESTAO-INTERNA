    // ══════════════════════════════════════════
    // EVENTOS UI — CORE — delegação principal, modais, tooltips, a11y, atalhos
    // ══════════════════════════════════════════

    const estadoEventos = {
      uiDelegadaInicializada: false,
      atalhosGlobaisInicializados: false,
      sincronizacaoStorageInicializada: false,
      controlesEstaticosInicializados: false,
      tooltipInicializado: false,
      dndPendenciasInicializado: false,
      acessibilidadeInicializada: false,
      navegacaoAbasInicializada: false,
      modaisInicializados: false,
      formulariosInicializados: false,
      npsObservacoesInicializadas: false
    };
    const estadoAcessibilidade = {
      focoRetornoModal: {},
      pendenciaFocadaId: null,
      pendenciaFocoPendente: null
    };
    let tooltipAlvoAtual = null;

    function openModal(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      estadoAcessibilidade.focoRetornoModal[id] = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const destino = modal.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])') || modal.querySelector('.modal-content');
      destino?.focus({ preventScroll: true });
    }

    function closeModal(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      const modalAberto = document.querySelector('.modal.show');
      if (!modalAberto) {
        document.body.style.overflow = '';
        const retorno = estadoAcessibilidade.focoRetornoModal[id];
        if (retorno && retorno.isConnected) retorno.focus({ preventScroll: true });
      } else {
        modalAberto.querySelector('.modal-content')?.focus({ preventScroll: true });
      }
    }

    function bindCoreEvents() {
      return {
        handleClick(actionEl) {
          switch (actionEl.dataset.action) {
            case 'reset-selected-month':
              resetSelectedMonth();
              return true;
            case 'close-current-month':
              closeCurrentMonth();
              return true;
            case 'download-data':
              downloadData();
              return true;
            case 'reset-view-filters':
              resetViewFilters(actionEl.dataset.view);
              return true;
            case 'save-settings':
              saveSettings();
              return true;
            case 'reset-demo-data':
              resetDemoData();
              return true;
            case 'save-local-snapshot':
              saveLocalSnapshot();
              return true;
            case 'restore-local-snapshot':
              restoreLocalSnapshot();
              return true;
            case 'clear-empty-months':
              clearEmptyMonths();
              return true;
            case 'run-system-diagnostics':
              runSystemDiagnostics(actionEl.dataset.silent === 'true');
              return true;
            case 'run-persistence-self-test':
              runPersistenceSelfTest();
              return true;
            case 'run-flow-smoke-tests':
              runFlowSmokeTests(actionEl.dataset.silent === 'true');
              return true;
            case 'clear-flow-smoke-tests':
              clearFlowSmokeTests();
              return true;
            case 'confirm-ok':
              _resolveConfirm(true);
              return true;
            case 'confirm-cancel':
              _resolveConfirm(false);
              return true;
            case 'close-modal':
              closeModal(actionEl.dataset.modalId);
              return true;
            case 'set-active-tab':
              setActiveTab(actionEl.dataset.tabTarget);
              return true;
            default:
              return false;
          }
        }
      };
    }

    function bindEventAgendaEvents() {
      return {
        handleClick(actionEl) {
          switch (actionEl.dataset.action) {
            case 'export-events-csv':
              exportEventsCsv();
              return true;
            case 'open-event-modal':
              openEventModal();
              return true;
            case 'save-event-item':
              saveEventItem();
              return true;
            case 'edit-event-item':
              editEventItem(actionEl.dataset.id);
              return true;
            case 'duplicate-event-item':
              duplicateEventItem(actionEl.dataset.id);
              return true;
            case 'remove-event-item':
              removeEventItem(actionEl.dataset.id);
              return true;
            default:
              return false;
          }
        }
      };
    }

    function collectUiEventBindings() {
      return [
        bindCoreEvents(),
        bindEventAgendaEvents(),
        typeof bindStudentEvents === 'function' ? bindStudentEvents() : null,
        typeof bindPendingEvents === 'function' ? bindPendingEvents() : null,
        typeof bindAddonEvents === 'function' ? bindAddonEvents() : null,
        typeof bindScaleEvents === 'function' ? bindScaleEvents() : null,
        typeof bindNpsEvents === 'function' ? bindNpsEvents() : null
      ].filter(Boolean);
    }

    function dispatchUiBinding(bindings, handlerName, ...args) {
      for (const binding of bindings) {
        if (binding?.[handlerName]?.(...args) === true) return true;
      }
      return false;
    }

    function bindUIEvents() {
      if (estadoEventos.uiDelegadaInicializada) return;
      estadoEventos.uiDelegadaInicializada = true;

      const bindings = collectUiEventBindings();

      document.addEventListener('click', e => {
        const tabButton = e.target.closest('.tab-btn');
        if (tabButton) {
          setActiveTab(tabButton.dataset.tab);
          return;
        }

        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        dispatchUiBinding(bindings, 'handleClick', actionEl, e);
      });

      document.addEventListener('change', e => {
        limparErroValidacaoCampo(e.target);
        dispatchUiBinding(bindings, 'handleChange', e.target, e);
      });

      document.addEventListener('input', e => {
        limparErroValidacaoCampo(e.target);
        dispatchUiBinding(bindings, 'handleInput', e.target, e);
      });

      document.addEventListener('focusout', e => {
        dispatchUiBinding(bindings, 'handleBlur', e.target, e);
      });
    }

    function obterElementosFocaveis(raiz) {
      if (!raiz) return [];
      return [...raiz.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.hidden && !el.closest('[hidden]'));
    }

    function obterModalAtivo() {
      const modais = [...document.querySelectorAll('.modal.show')];
      return modais[modais.length - 1] || null;
    }

    function limparErroValidacaoCampo(elemento) {
      if (!(elemento instanceof HTMLElement)) return;
      elemento.removeAttribute('aria-invalid');
      if (elemento.getAttribute('aria-describedby') === 'appValidationFeedback') {
        elemento.removeAttribute('aria-describedby');
      }
      if (typeof elemento.setCustomValidity === 'function') {
        elemento.setCustomValidity('');
      }
    }

    function sincronizarLabelsComCampos() {
      document.querySelectorAll('.field, .field-stack').forEach(bloco => {
        const label = bloco.querySelector('label');
        const campo = bloco.querySelector('input, select, textarea');
        if (!label || !campo || !campo.id || label.getAttribute('for')) return;
        label.setAttribute('for', campo.id);
      });
    }

    function configurarRotulosAcessiveisEstaticos() {
      const mapa = {
        summaryList: 'Resumo de desempenho por atendente',
        feedbackChart: 'Gráfico de feedback positivo por atendente',
        addonsOverview: 'Resumo de vendas de addons do período',
        pendingOverview: 'Resumo de pendências do período',
        scaleBoard: 'Quadro visual da escala do período',
        eventsList: 'Lista em cards de eventos e ações do período',
        eventsUpcoming: 'Resumo da próxima programação',
        eventsCalendar: 'Calendário visual de eventos e ações do período',
        backupSummaryList: 'Resumo de backup e snapshot',
        diagnosticSummaryList: 'Resumo da validação estrutural',
        periodAuditList: 'Resumo de auditoria por período',
        flowSmokeList: 'Resumo dos autotestes rápidos'
      };
      Object.entries(mapa).forEach(([id, rotulo]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('aria-label', rotulo);
      });
    }

    function obterTicketsPendencia() {
      return [...document.querySelectorAll('#pendingKanban [data-pending-id]')];
    }

    function atualizarRovingPendencias() {
      const tickets = obterTicketsPendencia();
      if (!tickets.length) return;
      const alvoId = estadoAcessibilidade.pendenciaFocadaId && tickets.some(ticket => ticket.dataset.pendingId === estadoAcessibilidade.pendenciaFocadaId)
        ? estadoAcessibilidade.pendenciaFocadaId
        : tickets[0].dataset.pendingId;
      tickets.forEach(ticket => {
        ticket.tabIndex = ticket.dataset.pendingId === alvoId ? 0 : -1;
      });
      estadoAcessibilidade.pendenciaFocadaId = alvoId;
    }

    function focarPendenciaPorIndice(indice) {
      const tickets = obterTicketsPendencia();
      if (!tickets.length) return;
      const posicao = Math.max(0, Math.min(tickets.length - 1, indice));
      const alvo = tickets[posicao];
      if (!alvo) return;
      estadoAcessibilidade.pendenciaFocadaId = alvo.dataset.pendingId;
      atualizarRovingPendencias();
      alvo.focus({ preventScroll: true });
    }

    function agendarRetornoFocoPendencia(id) {
      estadoAcessibilidade.pendenciaFocoPendente = id;
    }

    function restaurarFocoPendenteSeNecessario() {
      if (!estadoAcessibilidade.pendenciaFocoPendente) {
        atualizarRovingPendencias();
        return;
      }
      const id = estadoAcessibilidade.pendenciaFocoPendente;
      estadoAcessibilidade.pendenciaFocoPendente = null;
      requestAnimationFrame(() => {
        const alvo = document.querySelector(`#pendingKanban [data-pending-id="${id}"]`);
        if (!alvo) {
          atualizarRovingPendencias();
          return;
        }
        estadoAcessibilidade.pendenciaFocadaId = id;
        atualizarRovingPendencias();
        alvo.focus({ preventScroll: true });
      });
    }

    function moverPendenciaPorTeclado(id, direcao) {
      const ordem = ['aberto', 'respondido', 'concluido'];
      const item = state.pending.find(entry => entry.id === id);
      if (!item) return;
      const indiceAtual = ordem.indexOf(item.status);
      const proximoIndice = Math.max(0, Math.min(ordem.length - 1, indiceAtual + direcao));
      const proximoStatus = ordem[proximoIndice];
      if (!proximoStatus || proximoStatus === item.status) return;
      agendarRetornoFocoPendencia(id);
      updatePendingStatus(id, proximoStatus);
      anunciarAoLeitor(`Pendência movida para ${proximoStatus}.`, 'polite');
    }

    function bindAcessibilidade() {
      if (estadoEventos.acessibilidadeInicializada) return;
      estadoEventos.acessibilidadeInicializada = true;

      sincronizarLabelsComCampos();
      configurarRotulosAcessiveisEstaticos();

      document.addEventListener('focusin', e => {
        const ticket = e.target.closest('#pendingKanban [data-pending-id]');
        if (!ticket) return;
        estadoAcessibilidade.pendenciaFocadaId = ticket.dataset.pendingId;
        atualizarRovingPendencias();
      });

      document.addEventListener('keydown', e => {
        const modal = obterModalAtivo();
        if (modal && e.key === 'Tab') {
          const focaveis = obterElementosFocaveis(modal);
          if (!focaveis.length) return;
          const primeiro = focaveis[0];
          const ultimo = focaveis[focaveis.length - 1];
          if (e.shiftKey && document.activeElement === primeiro) {
            e.preventDefault();
            ultimo.focus();
          } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primeiro.focus();
          }
        }

        const controleAcionavel = e.target.closest('[data-action]');
        if (controleAcionavel && !controleAcionavel.matches('button, input, select, textarea, a') && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          controleAcionavel.click();
          return;
        }

        const ticket = e.target.closest('#pendingKanban [data-pending-id]');
        if (!ticket) return;
        const tickets = obterTicketsPendencia();
        const indiceAtual = tickets.indexOf(ticket);
        if (indiceAtual < 0) return;

        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          moverPendenciaPorTeclado(ticket.dataset.pendingId, e.key === 'ArrowRight' ? 1 : -1);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          focarPendenciaPorIndice(indiceAtual + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          focarPendenciaPorIndice(indiceAtual - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          focarPendenciaPorIndice(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          focarPendenciaPorIndice(tickets.length - 1);
        }
      });
    }

    function initializeStaticControls() {
      if (estadoEventos.controlesEstaticosInicializados) return;
      estadoEventos.controlesEstaticosInicializados = true;
      document.querySelectorAll('button:not([type])').forEach(button => {
        button.type = 'button';
      });
      document.getElementById('monthDaysSelector').addEventListener('change', e => resizeMonth(e.target.value));
      document.getElementById('periodMonthSelect').innerHTML = MONTH_NAMES.map((name, index) => `<option value="${index + 1}">${name}</option>`).join('');
      document.getElementById('periodMonthSelect').addEventListener('change', changePeriodFromControls);
      document.getElementById('periodYearInput').addEventListener('change', changePeriodFromControls);
      document.getElementById('importFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) importData(file);
        e.target.value = '';
      });
    }

    function bindTabKeyboardNavigation() {
      if (estadoEventos.navegacaoAbasInicializada) return;
      estadoEventos.navegacaoAbasInicializada = true;

      document.addEventListener('keydown', e => {
        const button = e.target.closest('.tab-btn');
        if (!button) return;
        const isHorizontalKey = ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key);
        if (!isHorizontalKey) return;
        const tabButtons = [...document.querySelectorAll('.tab-btn')];
        const index = tabButtons.indexOf(button);
        if (index < 0) return;
        e.preventDefault();
        const nextIndex = e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? tabButtons.length - 1
            : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
        const nextButton = tabButtons[nextIndex];
        nextButton.focus();
        setActiveTab(nextButton.dataset.tab, true);
        saveUIState({ activeTab: nextButton.dataset.tab });
      });
    }

    function bindModalBackdropClose() {
      if (estadoEventos.modaisInicializados) return;
      estadoEventos.modaisInicializados = true;

      document.addEventListener('click', e => {
        const modal = e.target.classList?.contains('modal') ? e.target : null;
        if (!modal) return;
        closeModal(modal.id);
      });
    }

    function bindGlobalKeyboardShortcuts() {
      if (estadoEventos.atalhosGlobaisInicializados) return;
      estadoEventos.atalhosGlobaisInicializados = true;

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          const modal = obterModalAtivo();
          if (modal) {
            e.preventDefault();
            closeModal(modal.id);
            return;
          }
        }
        if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
          e.preventDefault();
          const activeView = document.querySelector('.view.active')?.id;
          const targetId = activeView === 'pending'
            ? 'pendingSearch'
            : activeView === 'students'
              ? 'studentSearch'
              : activeView === 'events'
                ? 'eventSearch'
                : activeView === 'scale'
                  ? 'scaleSearch'
                  : null;
          const target = targetId ? document.getElementById(targetId) : null;
          if (target) target.focus();
        }
      });
    }

    function bindStorageSync() {
      if (estadoEventos.sincronizacaoStorageInicializada) return;
      estadoEventos.sincronizacaoStorageInicializada = true;

      window.addEventListener('storage', async e => {
        if (!e.key) return;
        if (e.key === STORAGE_BROADCAST_KEY) {
          await consumeStorageBroadcast(e.newValue);
          return;
        }
        if (!getKnownStorageKeys().includes(e.key)) return;
        if (e.newValue === null) storageCache.delete(e.key);
        else storageCache.set(e.key, e.newValue);
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
