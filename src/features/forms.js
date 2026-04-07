    function isNonEmptyString(value) {
      return String(value ?? '').trim().length > 0;
    }

    function isValidNumber(value) {
      const normalized = Number(value);
      return Number.isFinite(normalized);
    }

    function isPositiveNumber(value) {
      return isValidNumber(value) && Number(value) > 0;
    }

    function isValidDateValue(value) {
      if (!isNonEmptyString(value)) return false;
      const timestamp = new Date(`${String(value).trim()}T00:00:00`).getTime();
      return Number.isFinite(timestamp);
    }

    function createValidationResult() {
      return {
        isValid: true,
        errors: {}
      };
    }

    function normalizeNumericId(value) {
      return String(value ?? '').replace(/\D+/g, '');
    }

    function validateStudent(data) {
      const result = createValidationResult();
      if (isNonEmptyString(data.rawMatricula) && data.matricula !== data.rawMatricula) {
        result.isValid = false;
        result.errors.matricula = 'O número da matrícula deve conter apenas dígitos.';
      }
      if (!isNonEmptyString(data.nome)) {
        result.isValid = false;
        result.errors.nome = 'Preencha ao menos o nome do aluno.';
      }
      return result;
    }

    function validatePending(data) {
      const result = createValidationResult();
      if (isNonEmptyString(data.rawMatricula) && data.matricula !== data.rawMatricula) {
        result.isValid = false;
        result.errors.matricula = 'O número da matrícula deve conter apenas dígitos.';
      }
      if (!isNonEmptyString(data.nome) || !isNonEmptyString(data.pendencia)) {
        result.isValid = false;
        result.errors.required = 'Preencha ao menos nome e pendência.';
      }
      if (isNonEmptyString(data.data) && isValidDateValue(data.data) && !isDateInActivePeriod(data.data)) {
        result.isValid = false;
        result.errors.data = `A data da pendência deve pertencer a ${getPeriodLabel()}.`;
      }
      return result;
    }

    function getStudentFormData() {
      const rawMatricula = DOM.value('student_matricula').trim();
      const matricula = normalizeNumericId(rawMatricula);
      return {
        id: editingStudentId || crypto.randomUUID(),
        nome: DOM.value('student_nome').trim(),
        rawMatricula,
        matricula,
        ultimaVisita: DOM.value('student_ultimaVisita'),
        horaVisita: DOM.value('student_horaVisita'),
        inicio: DOM.value('student_inicio'),
        avisoNps: DOM.value('student_avisoNps'),
        atendimento: DOM.value('student_atendimento'),
        feedback: DOM.value('student_feedback'),
        addon: DOM.value('student_addon'),
        observacoes: DOM.value('student_observacoes').trim()
      };
    }

    function getPendingFormData() {
      const rawMatricula = DOM.value('pending_matricula').trim();
      const matricula = normalizeNumericId(rawMatricula);
      return {
        id: editingPendingId || crypto.randomUUID(),
        nome: DOM.value('pending_nome').trim(),
        rawMatricula,
        matricula,
        pendencia: DOM.value('pending_desc').trim(),
        data: DOM.value('pending_data'),
        hostess: DOM.value('pending_hostess'),
        resposta: DOM.value('pending_resposta').trim(),
        status: DOM.value('pending_status')
      };
    }

    function buildStudentEntity(formData, existingStudent) {
      return {
        id: existingStudent?.id || formData.id,
        nome: formData.nome,
        matricula: formData.matricula,
        ultimaVisita: formData.ultimaVisita,
        horaVisita: formData.horaVisita,
        inicio: formData.inicio,
        avisoNps: formData.avisoNps,
        atendimento: formData.atendimento,
        feedback: formData.feedback,
        addon: formData.addon,
        observacoes: formData.observacoes
      };
    }

    function buildPendingEntity(formData, existingPending) {
      return {
        id: existingPending?.id || formData.id,
        nome: formData.nome,
        matricula: formData.matricula,
        pendencia: formData.pendencia,
        data: formData.data,
        hostess: formData.hostess,
        resposta: formData.resposta,
        status: formData.status
      };
    }

    function upsertStudent(store, student) {
      const idx = store.students.findIndex(item => item.id === student.id);
      const students = idx >= 0
        ? store.students.map((item, index) => index === idx ? student : item)
        : [student, ...store.students];
      return {
        ...store,
        students
      };
    }

    function upsertPending(store, pending) {
      const idx = store.pending.findIndex(item => item.id === pending.id);
      const pendingItems = idx >= 0
        ? store.pending.map((item, index) => index === idx ? pending : item)
        : [pending, ...store.pending];
      return {
        ...store,
        pending: pendingItems
      };
    }

    function createValidationFailureResult(validation) {
      return { ok: false, validation };
    }

    function createSaveSuccessResult(nextState, entity) {
      return { ok: true, nextState, entity };
    }

    function applyStudentSave(store, formData, existingStudent) {
      const validation = validateStudent(formData);
      if (!validation.isValid) {
        return createValidationFailureResult(validation);
      }
      const entity = buildStudentEntity(formData, existingStudent);
      const nextState = upsertStudent(store, entity);
      return createSaveSuccessResult(nextState, entity);
    }

    function applyPendingSave(store, formData, existingPending) {
      const validation = validatePending(formData);
      if (!validation.isValid) {
        return createValidationFailureResult(validation);
      }
      const entity = buildPendingEntity(formData, existingPending);
      const nextState = upsertPending(store, entity);
      return createSaveSuccessResult(nextState, entity);
    }

    function getEventFormData() {
      return {
        id: editingEventId || crypto.randomUUID(),
        date: DOM.value('event_date'),
        time: DOM.value('event_time'),
        type: DOM.value('event_type'),
        title: DOM.value('event_title').trim(),
        place: DOM.value('event_place').trim(),
        owner: DOM.value('event_owner').trim(),
        status: DOM.value('event_status'),
        description: DOM.value('event_description').trim()
      };
    }

    function getScaleFormData() {
      return {
        id: editingScaleId || crypto.randomUUID(),
        date: DOM.value('scale_date'),
        rowTone: DOM.value('scale_tone'),
        receptionTime: DOM.value('scale_receptionTime').trim(),
        receptionist: DOM.value('scale_receptionist').trim(),
        receptionSwap: DOM.value('scale_receptionSwap').trim(),
        note: DOM.value('scale_note').trim(),
        professorShifts: scaleShiftDrafts
          .map(shift => ({
            id: crypto.randomUUID(),
            time: String(shift.time || '').trim(),
            name: String(shift.name || '').trim(),
            swap: String(shift.swap || '').trim()
          }))
          .filter(shift => shift.time || shift.name || shift.swap)
      };
    }

    function getSettingsFormData() {
      return {
        receptionists: [...new Set(DOM.value('receptionistEditor').split('\n').map(v => v.trim()).filter(Boolean))],
        professors: [...new Set(DOM.value('professorEditor').split('\n').map(v => v.trim()).filter(Boolean))],
        addonTypes: [...new Set(DOM.value('addonTypeEditor').split('\n').map(v => v.trim()).filter(Boolean))]
      };
    }

    function getMentionDraft() {
      return {
        name: DOM.value('npsMentionName').trim(),
        count: Math.max(1, Number(DOM.value('npsMentionCount', 1) || 1))
      };
    }

    function getNpsObservationsDraft() {
      return DOM.value('npsObservations').trim();
    }

    function validateEvent(data) {
      const result = createValidationResult();
      if (!isNonEmptyString(data.date) || !isNonEmptyString(data.title)) {
        result.isValid = false;
        result.errors.required = 'Preencha ao menos data e título.';
      }
      if (isNonEmptyString(data.date) && !isDateInActivePeriod(data.date)) {
        result.isValid = false;
        result.errors.date = `A data do evento/ação deve pertencer a ${getPeriodLabel()}.`;
      }
      return result;
    }

    function buildEventEntity(formData, existingEvent) {
      return {
        id: existingEvent?.id || formData.id,
        date: formData.date,
        time: formData.time,
        type: formData.type,
        title: formData.title,
        place: formData.place,
        owner: formData.owner,
        status: formData.status,
        description: formData.description
      };
    }

    function upsertEvent(store, eventItem) {
      const idx = store.events.findIndex(item => item.id === eventItem.id);
      const events = idx >= 0
        ? store.events.map((item, index) => index === idx ? eventItem : item)
        : [...store.events, eventItem];
      return {
        ...store,
        events: events.slice().sort(compareByDateTime)
      };
    }

    function applyEventSave(store, formData, existingEvent) {
      const validation = validateEvent(formData);
      if (!validation.isValid) {
        return createValidationFailureResult(validation);
      }
      const entity = buildEventEntity(formData, existingEvent);
      const nextState = upsertEvent(store, entity);
      return createSaveSuccessResult(nextState, entity);
    }

    // ══════════════════════════════════════════
    // VALIDAÇÃO UI — limparErrosValidacao, apresentarErroValidacao
    // ══════════════════════════════════════════
    // Dependências globais:
    //   limparErroValidacaoCampo  — ui/events-core.js (helper de campo individual)
    //   showToast                 — ui/events-core.js

    function limparErrosValidacao(ids = []) {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) limparErroValidacaoCampo(el);
      });
      const feedback = document.getElementById('appValidationFeedback');
      if (feedback) feedback.textContent = '';
    }

    function apresentarErroValidacao(erros = []) {
      const feedback = document.getElementById('appValidationFeedback');
      if (!erros.length) return;
      erros.forEach(({ id, message }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', 'appValidationFeedback');
        if (typeof el.setCustomValidity === 'function') {
          el.setCustomValidity(message);
        }
      });
      const primeiro = erros.map(item => ({ ...item, el: document.getElementById(item.id) })).find(item => item.el);
      if (!primeiro) return;
      if (feedback) feedback.textContent = primeiro.message;
      showToast(primeiro.message, 'warning');
      primeiro.el.focus({ preventScroll: true });
      if (typeof primeiro.el.reportValidity === 'function') {
        primeiro.el.reportValidity();
      }
    }
