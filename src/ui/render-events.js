    /** @returns {EventItem[]} */
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

    /** @returns {{year:number, monthIndex:number, totalDays:number, firstWeekday:number}} */
    function getCurrentPeriodDateInfo() {
      const [yearStr, monthStr] = String(currentPeriodKey).split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
      return { year, monthIndex, totalDays, firstWeekday };
    }

    /** @param {Object} dadosEventos @returns {void} */
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

    /** @returns {void} */
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

    /** @returns {void} */
    function finalizeEventSaveUI() {
      closeModal('eventModal');
      clearEventForm();
    }

    /** @returns {void} */
    function renderEventSaveUI() {
      requestRender(['dashboard', 'events']);
    }

    /** @returns {void} */
    function openEventModal() {
      clearEventForm();
      openModal('eventModal');
    }

    /** @param {string} id @returns {void} */
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

    /** @param {string} id @returns {void} */
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

    /** @param {string} id @returns {Promise<void>} */
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

    /** @returns {void} */
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
