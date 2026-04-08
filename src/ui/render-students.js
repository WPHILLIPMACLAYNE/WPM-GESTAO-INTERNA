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
    // RENDERIZAÇÃO — STUDENTS — renderStudents, saveStudent, removeStudent
    // ══════════════════════════════════════════

    /** @returns {void} */
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

    /** @param {string} id @param {string} field @param {string} value @returns {void} */
    function updateStudentInline(id, field, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'students'] })) return;
      const target = state.students.find(s => s.id === id);
      if (!target) return;
      target[field] = value;
      saveData();
      requestRender(['hero', 'dashboard', 'students']);
    }

    /** @returns {void} */
    function populateStudentFilters() {
      const options = `<option value="">Todos os atendentes</option>` + getReceptionists(state).map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      document.getElementById('studentFilterAtendente').innerHTML = options;
      document.getElementById('student_atendimento').innerHTML = getReceptionists(state).map(name => `<option>${esc(name)}</option>`).join('');
      document.getElementById('student_addon').innerHTML = `<option value="">Nenhum</option>` + state.settings.addonTypes.map(type => `<option>${esc(type)}</option>`).join('');
      document.getElementById('pending_hostess').innerHTML = getReceptionists(state).map(name => `<option>${esc(name)}</option>`).join('');
      document.getElementById('teamSuggestions').innerHTML = getAllEmployees(state).map(name => `<option value="${esc(name)}"></option>`).join('');
    }

    // Student-addon link movido para src/features/crud.js

    /** @returns {void} */
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

    /** @returns {void} */
    function finalizeStudentSaveUI() {
      closeModal('studentModal');
      clearStudentForm();
    }

    /** @returns {void} */
    function renderStudentSaveUI() {
      requestRender(['hero', 'dashboard', 'students', 'addons']);
    }

    /** @param {string} id @returns {void} */
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

    /** @param {string} id @returns {void} */
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

    // ══════════════════════════════════════════
    // PILLS — renderização de status visual
    // ══════════════════════════════════════════

    /** @param {string} value @returns {string} */
    function studentStatusPill(value) {
      const cls = value === 'Respondeu' ? 'ok' : value === 'Não respondeu' ? 'bad' : 'warn';
      return `<span class="pill ${cls}">${esc(value)}</span>`;
    }

    /** @param {string} value @returns {string} */
    function npsPill(value) {
      const cls = value === 'Sim' ? 'ok' : value === 'Não' ? 'bad' : 'warn';
      return `<span class="pill ${cls}">${esc(value)}</span>`;
    }
