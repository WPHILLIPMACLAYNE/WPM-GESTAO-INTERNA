    // ══════════════════════════════════════════
    // CRUD HANDLERS — factory genérica + handlers de save para student, pending e event
    // ══════════════════════════════════════════
    // Dependências globais (providas por scripts carregados antes):
    //   assertWritableCurrentPeriod                                    — core/lifecycle.js
    //   saveData                                                       — core/backup.js
    //   showToast, showConfirm                                         — ui/events-core.js
    //   requestRender                                                  — ui/render-core.js (scheduler)
    //   apresentarErroValidacao                                        — features/forms.js
    //   state                                                          — estado global
    //   getStudentFormData, getPendingFormData, getEventFormData       — features/forms.js
    //   applyStudentSave, applyPendingSave, applyEventSave             — features/forms.js
    //   getActivePeriodFallbackDate                                    — utils/helpers.js (date helper)
    //   finalizeStudentSaveUI, renderStudentSaveUI                     — render.js (UI callbacks)
    //   finalizePendingSaveUI, renderPendingSaveUI                     — render.js
    //   finalizeEventSaveUI, renderEventSaveUI                         — render.js

    // ══════════════════════════════════════════
    // STUDENT-ADDON LINK — resolve e aplica delta no addon vinculado a um student
    // ══════════════════════════════════════════

    /** Resolves the addon array link for a student. @param {Student} student @returns {{person: string, type: string, index: number}|null} */
    function getStudentAddonLink(student) {
      if (!student || !student.addon || !student.atendimento) return null;
      const rawDate = student.inicio || student.ultimaVisita || getActivePeriodFallbackDate();
      const day = Number(String(rawDate).split('-')[2] || 0);
      if (!day) return null;
      const idx = Math.min(state.settings.monthDays, Math.max(1, day)) - 1;
      if (!state.addons[student.atendimento] || !state.addons[student.atendimento][student.addon]) return null;
      return { person: student.atendimento, type: student.addon, index: idx };
    }

    /** Applies a delta to the addon counter linked to a student. @param {Student} student @param {number} delta @returns {void} */
    function applyStudentAddonLink(student, delta) {
      const link = getStudentAddonLink(student);
      if (!link) return;
      const arr = state.addons[link.person][link.type];
      arr[link.index] = Math.max(0, Number(arr[link.index] || 0) + delta);
    }

    /** Creates an async save handler from a CRUD config object. @param {CrudHandlerConfig} config @returns {function(): Promise<void>} */
    function createCrudHandler(config) {
      const {
        name,
        getFormData,
        applySave,
        getValidationErrors,
        onBeforeSave,
        onAfterSave,
        finalizeUI,
        renderUI,
        renderTargets,
        duplicateCheck
      } = config;

      return async function handleSave() {
        if (!assertWritableCurrentPeriod()) return;

        // Acessa collection via config para suportar getters (state só existe em runtime)
        const currentCollection = config.collection;

        const formData = getFormData();
        const existing = currentCollection.find(item => item.id === formData.id);
        const previous = existing ? structuredClone(existing) : null;

        const result = applySave(state, formData, existing);

        if (!result.ok) {
          const errors = getValidationErrors(result.validation);
          if (errors.length) apresentarErroValidacao(errors);
          return;
        }

        // Hooks pré-salvamento (ex: decrementar contador de addon)
        if (onBeforeSave) onBeforeSave(result.entity, previous, state);

        state = result.nextState;
        const saved = await saveData();

        if (!saved) {
          // Rollback
          if (previous && existing) {
            const idx = currentCollection.findIndex(item => item.id === previous.id);
            if (idx >= 0) currentCollection[idx] = previous;
            else currentCollection.push(previous);
          } else if (existing) {
            currentCollection.push(existing);
          }
          if (onAfterSave) onAfterSave(result.entity, previous, state, 'rollback');
          showToast(`Falha ao salvar ${name}. Tente novamente.`, 'danger');
          return;
        }

        // Hooks pós-salvamento (ex: incrementar contador de addon)
        if (onAfterSave) onAfterSave(result.entity, previous, state, 'saved');

        // Verificar duplicata (específico de eventos)
        if (duplicateCheck) {
          const dupMessage = duplicateCheck(result.entity, currentCollection);
          if (dupMessage) {
            showConfirm(dupMessage, () => {
              finalizeUI();
              renderUI();
              requestRender(renderTargets);
            });
            return;
          }
        }

        finalizeUI();
        renderUI();
        requestRender(renderTargets);
      };
    }

    // Handlers CRUD específicos criados pelo módulo genérico
    // Nota: collection é resolvida via getter porque state só é populado em runtime (bootstrap → syncAppState)

    const handleSaveStudent = createCrudHandler({
      name: 'atendimento',
      get collection() { return state.students; },
      getFormData: getStudentFormData,
      applySave: applyStudentSave,
      getValidationErrors: (validation) => {
        const errors = [];
        if (validation.errors.nome) errors.push({ id: 'student_nome', message: validation.errors.nome });
        if (validation.errors.matricula) errors.push({ id: 'student_matricula', message: validation.errors.matricula });
        return errors;
      },
      onBeforeSave: (entity, previous, stateRef) => {
        if (previous) applyStudentAddonLink(previous, -1);
        applyStudentAddonLink(entity, 1);
      },
      finalizeUI: finalizeStudentSaveUI,
      renderUI: renderStudentSaveUI,
      renderTargets: ['hero', 'dashboard', 'students', 'addons']
    });

    const handleSavePending = createCrudHandler({
      name: 'pendência',
      get collection() { return state.pending; },
      getFormData: getPendingFormData,
      applySave: applyPendingSave,
      getValidationErrors: (validation) => {
        const errors = [];
        if (validation.errors.nome || validation.errors.required) errors.push({ id: 'pending_nome', message: validation.errors.nome || validation.errors.required });
        if (validation.errors.matricula) errors.push({ id: 'pending_matricula', message: validation.errors.matricula });
        if (validation.errors.required) errors.push({ id: 'pending_desc', message: validation.errors.required });
        if (validation.errors.data) errors.push({ id: 'pending_data', message: validation.errors.data });
        return errors;
      },
      finalizeUI: finalizePendingSaveUI,
      renderUI: renderPendingSaveUI,
      renderTargets: ['hero', 'dashboard', 'pending']
    });

    const handleSaveEvent = createCrudHandler({
      name: 'evento',
      get collection() { return state.events; },
      getFormData: getEventFormData,
      applySave: applyEventSave,
      getValidationErrors: (validation) => {
        const errors = [];
        if (validation.errors.date) errors.push({ id: 'event_date', message: validation.errors.date });
        if (validation.errors.required) errors.push({ id: 'event_title', message: validation.errors.required });
        return errors;
      },
      finalizeUI: finalizeEventSaveUI,
      renderUI: renderEventSaveUI,
      renderTargets: ['dashboard', 'events'],
      duplicateCheck: (entity, collection) => {
        const dup = collection.find(entry =>
          entry.id !== entity.id &&
          String(entry.date || '') === String(entity.date || '') &&
          String(entry.time || '') === String(entry.time || '') &&
          String(entry.title || '').trim().toLowerCase() === entity.title.toLowerCase()
        );
        return dup ? 'Já existe um evento com o mesmo título, data e horário. Deseja salvar mesmo assim?' : null;
      }
    });

    // Aliases para compatibilidade com a camada de eventos UI
    const saveStudent = handleSaveStudent;
    const savePending = handleSavePending;
    const saveEventItem = handleSaveEvent;
