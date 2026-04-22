    let scaleShiftDrafts = [];

    /** @param {string} dateStr @returns {{day:string, month:string, weekday:string}} */
    function formatScaleBoardDay(dateStr) {
      if (!dateStr) return { day: '—', month: getPeriodLabel(), weekday: '' };
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return { day: '—', month: getPeriodLabel(), weekday: '' };
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(dt.getTime())) return { day: '—', month: getPeriodLabel(), weekday: '' };
      return {
        day: String(dt.getDate()).padStart(2, '0'),
        month: MONTH_NAMES[dt.getMonth()],
        weekday: getWeekdayLabel(dateStr)
      };
    }

    /** @returns {ScaleEntry[]} */
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

    /** @returns {void} */
    function renderScaleShiftRows() {
      const box = document.getElementById('scaleShiftRows');
      if (!box) return;
      aplicarHtmlSeMudou(box, scaleShiftDrafts.length ? scaleShiftDrafts.map((shift, index) => `
        <div class="shift-editor-row">
          <div class="field"><label>Horário</label><input data-scale-shift="time" data-index="${index}" aria-label="Horário do professor na linha ${index + 1}" value="${esc(shift.time || '')}" placeholder="Ex: 08h - 13h" /></div>
          <div class="field"><label>Professor</label><input data-scale-shift="name" data-index="${index}" aria-label="Professor da linha ${index + 1}" value="${esc(shift.name || '')}" placeholder="Ex: JUNIOR" /></div>
          <div class="field"><label>Troca</label><input data-scale-shift="swap" data-index="${index}" aria-label="Troca do professor na linha ${index + 1}" value="${esc(shift.swap || '')}" placeholder="Se houver" /></div>
          <button class="btn btn-danger btn-xs" type="button" data-action="remove-scale-shift-row" data-index="${index}" aria-label="Excluir linha ${index + 1} de professor">Excluir</button>
        </div>
      `).join('') : '<div class="empty empty--compact"><strong>Sem turnos neste dia</strong>Adicione ao menos uma linha de professor para compor a escala.</div>');
    }

    /** @param {Object} [values] @returns {void} */
    function addScaleShiftRow(values = {}) {
      scaleShiftDrafts.push({ time: values.time || '', name: values.name || '', swap: values.swap || '' });
      renderScaleShiftRows();
    }

    /** @param {number} index @returns {void} */
    function removeScaleShiftRow(index) {
      scaleShiftDrafts.splice(index, 1);
      renderScaleShiftRows();
    }

    /** @returns {void} */
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

    /** @returns {void} */
    function openScaleModal() {
      clearScaleForm();
      openModal('scaleModal');
    }

    /** @param {string} id @returns {void} */
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

    /** @returns {Promise<void>} */
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

    /** @param {string} id @returns {void} */
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

    /** @returns {void} */
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
        aplicarHtmlSeMudou(body, `<tr><td colspan="7"><div class="empty"><strong>Escala vazia em ${esc(getPeriodLabel())}</strong>Os dias cadastrados aparecerão aqui. Use <em>Adicionar dia de escala</em> ou <em>Duplicar mês anterior</em> para começar.</div></td></tr>`);
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
          aplicarHtmlSeMudou(board, `<div class="empty"><strong>Escala ainda não montada</strong>Monte a escala de ${esc(getPeriodLabel())} com <em>Adicionar dia de escala</em> ou <em>Duplicar mês anterior</em> — os cards aparecerão aqui em grid visual.</div>`);
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
                  ${item.note ? `<div class="scale-board-note scale-board-note--spaced">${esc(item.note)}</div>` : `<div class="scale-board-note scale-board-note--spaced">Sem observações registradas.</div>`}
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
