    // ══════════════════════════════════════════
    // LIFECYCLE DE PERÍODOS
    // ══════════════════════════════════════════

    const LOCKED_CURRENT_PERIOD_ACTIONS = new Set([
      'close-current-month',
      'reset-selected-month',
      'open-student-modal',
      'open-pending-modal',
      'add-person',
      'register-mention',
      'save-nps-observations',
      'open-scale-modal',
      'duplicate-previous-month-scale',
      'open-event-modal',
      'save-settings',
      'restore-local-snapshot',
      'reset-demo-data',
      'save-student',
      'save-pending',
      'save-scale-day',
      'save-event-item',
      'edit-student',
      'remove-student',
      'edit-pending',
      'remove-pending',
      'adjust-mention',
      'remove-mention',
      'edit-scale-day',
      'remove-scale-day',
      'edit-event-item',
      'duplicate-event-item',
      'remove-event-item'
    ]);
    const LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS = new Set(['update-student-inline', 'update-addon', 'set-mention-count']);
    const LOCKED_CURRENT_PERIOD_INPUT_ACTIONS = new Set(['update-nps-score', 'update-nps-goal']);
    const LOCKED_CURRENT_PERIOD_BLUR_ACTIONS = new Set(['rename-person', 'rename-mention']);
    const LOCKED_CURRENT_PERIOD_CONTROL_IDS = [
      'monthDaysSelector',
      'importFile',
      'receptionistEditor',
      'professorEditor',
      'addonTypeEditor',
      'recadoFrom',
      'recadoTo',
      'recadoMessage',
      'student_nome',
      'student_matricula',
      'student_ultimaVisita',
      'student_horaVisita',
      'student_inicio',
      'student_avisoNps',
      'student_atendimento',
      'student_feedback',
      'student_addon',
      'student_observacoes',
      'pending_nome',
      'pending_matricula',
      'pending_hostess',
      'pending_data',
      'pending_status',
      'pending_desc',
      'pending_resposta',
      'npsMentionName',
      'npsMentionCount',
      'npsObservations',
      'scale_date',
      'scale_tone',
      'scale_receptionTime',
      'scale_receptionist',
      'scale_receptionSwap',
      'scale_note',
      'event_date',
      'event_time',
      'event_type',
      'event_status',
      'event_title',
      'event_place',
      'event_owner',
      'event_description'
    ];

    function normalizeData(data) {
      data.settings ||= { team: [], addonTypes: [], monthDays: 31, receptionists: [], professors: [] };
      data.settings.receptionists ||= data.settings.team || [];
      data.settings.professors ||= [];
      if (!data.settings.receptionists.length) data.settings.receptionists = [...APP_DEFAULTS.receptionists];
      if (!data.settings.professors.length) data.settings.professors = [...APP_DEFAULTS.professors];
      data.settings.team = [...new Set((data.settings.team?.length ? data.settings.team : data.settings.receptionists).filter(Boolean))];
      data.settings.receptionists = [...new Set(data.settings.receptionists.filter(Boolean))];
      data.settings.professors = [...new Set(data.settings.professors.filter(Boolean))];
      data.settings.addonTypes ||= [...APP_DEFAULTS.addonTypes];
      data.settings.monthDays ||= 31;
      data.students ||= [];
      data.pending ||= [];
      data.recados = normalizeRecadosCollection(data.recados);
      data.scale = Array.isArray(data.scale) ? data.scale : Array.isArray(data.escala) ? data.escala : [];
      data.events = Array.isArray(data.events) ? data.events : Array.isArray(data.eventos) ? data.eventos : [];
      data.addons ||= {};
      data.nps ||= {};
      data.nps.score = clamp(Number(data.nps.score ?? 0), 0, 100);
      data.nps.monthlyGoal = clamp(Number(data.nps.monthlyGoal ?? 75), 0, 100);
      data.nps.semesterGoal = clamp(Number(data.nps.semesterGoal ?? 80), 0, 100);
      data.nps.observations ||= '';
      data.nps.mentions = Array.isArray(data.nps.mentions) ? data.nps.mentions : [];
      data.nps.rankSnapshot ||= {};

      data.students = data.students.map(student => ({
        id: student.id || crypto.randomUUID(),
        nome: student.nome || '',
        matricula: normalizeNumericId(student.matricula),
        ultimaVisita: student.ultimaVisita || '',
        horaVisita: student.horaVisita || student.horario || '',
        inicio: student.inicio || '',
        avisoNps: student.avisoNps || 'Sim',
        atendimento: student.atendimento || data.settings.team[0] || '',
        feedback: student.feedback || 'Pendente',
        addon: student.addon || '',
        observacoes: student.observacoes || ''
      }));

      data.pending = data.pending.map(item => ({
        id: item.id || crypto.randomUUID(),
        nome: item.nome || '',
        matricula: normalizeNumericId(item.matricula),
        pendencia: item.pendencia || '',
        data: item.data || '',
        hostess: item.hostess || data.settings.team[0] || '',
        resposta: item.resposta || '',
        status: item.status || 'aberto'
      }));

      data.scale = data.scale.map(item => {
        const shifts = Array.isArray(item.professorShifts) ? item.professorShifts : Array.isArray(item.professores) ? item.professores : [];
        return {
          id: item.id || crypto.randomUUID(),
          date: item.date || item.data || '',
          rowTone: ['green','red','neutral'].includes(item.rowTone) ? item.rowTone : (['green','red','neutral'].includes(item.tone) ? item.tone : 'neutral'),
          professorShifts: (shifts.length ? shifts : [{ time: item.professorTime || item.horarioProfessor || '', name: item.professor || '', swap: item.professorSwap || item.trocaProfessor || '' }]).map(shift => ({
            id: shift.id || crypto.randomUUID(),
            time: shift.time || shift.horario || '',
            name: shift.name || shift.nome || '',
            swap: shift.swap || shift.troca || ''
          })),
          receptionTime: item.receptionTime || item.horarioRecepcao || '',
          receptionist: item.receptionist || item.recepcionista || '',
          receptionSwap: item.receptionSwap || item.trocaRecepcao || '',
          note: item.note || item.observacao || ''
        };
      }).filter(item => item.date);

      data.events = data.events.map(item => ({
        id: item.id || crypto.randomUUID(),
        date: item.date || item.data || '',
        time: item.time || item.hora || '',
        type: item.type || item.tipo || 'Evento',
        title: item.title || item.titulo || '',
        place: item.place || item.local || '',
        owner: item.owner || item.responsavel || '',
        status: item.status || item.situacao || 'Programado',
        description: item.description || item.descricao || ''
      })).filter(item => item.date || item.title);

      data.nps.mentions = data.nps.mentions.map(item => ({
        id: item.id || crypto.randomUUID(),
        name: item.name || item.nome || '',
        count: Math.max(0, Number(item.count || item.citacoes || 0))
      })).filter(item => item.name);

      hydrateLegacyAddonsFromStudents(data);

      getAddonPeople(data).forEach(person => {
        data.addons[person] ||= {};
        const knownTypes = [...new Set([...(data.settings.addonTypes || APP_DEFAULTS.addonTypes), ...Object.keys(data.addons[person] || {})])];
        knownTypes.forEach(type => {
          const arr = data.addons[person][type] || [];
          data.addons[person][type] = Array.from({ length: data.settings.monthDays }, (_, i) => Number(arr[i] || 0));
        });
      });
    }

    function isPeriodLocked(key = currentPeriodKey) {
      return Boolean(storage?.archives?.[String(key || '')]);
    }

    function isCurrentPeriodLocked() {
      return isPeriodLocked(currentPeriodKey);
    }

    function getCurrentPeriodLockMessage(key = currentPeriodKey) {
      return `${getPeriodLabel(key)} está fechado. Ação bloqueada.`;
    }

    function canMutateCurrentPeriod(options = {}) {
      if (!isCurrentPeriodLocked()) return true;
      const rerenderTargets = normalizarAlvosRender(options?.rerender || []);
      if (rerenderTargets.length) requestRender(rerenderTargets);
      if (!options?.silent) {
        showToast(options?.message || getCurrentPeriodLockMessage(), 'warning');
      }
      return false;
    }

    function assertWritableCurrentPeriod(options = {}) {
      return canMutateCurrentPeriod(options);
    }

    function syncCurrentPeriodLockUI() {
      const locked = isCurrentPeriodLocked();
      const hint = locked ? `${getPeriodLabel()} fechado. Somente leitura.` : '';

      const syncDisableState = control => {
        if (!control) return;
        if (control.dataset.historicalReadonly === 'true') {
          if ('disabled' in control) control.disabled = true;
          control.setAttribute('aria-disabled', 'true');
          return;
        }
        if ('disabled' in control) control.disabled = locked;
        control.setAttribute('aria-disabled', String(locked));
        if (locked) {
          if (!('lockHint' in control.dataset)) {
            control.dataset.lockHint = control.getAttribute('title') || '';
          }
          if (hint) control.setAttribute('title', hint);
        } else if ('lockHint' in control.dataset) {
          const previousTitle = control.dataset.lockHint;
          if (previousTitle) control.setAttribute('title', previousTitle);
          else control.removeAttribute('title');
          delete control.dataset.lockHint;
        }
      };

      document.querySelectorAll('[data-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_ACTIONS.has(control.dataset.action)) return;
        syncDisableState(control);
      });

      document.querySelectorAll('[data-change-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS.has(control.dataset.changeAction)) return;
        syncDisableState(control);
      });

      document.querySelectorAll('[data-input-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_INPUT_ACTIONS.has(control.dataset.inputAction)) return;
        syncDisableState(control);
      });

      document.querySelectorAll('[data-blur-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_BLUR_ACTIONS.has(control.dataset.blurAction)) return;
        if (control.dataset.blurAction === 'rename-person') {
          control.contentEditable = locked ? 'false' : 'true';
          control.setAttribute('aria-disabled', String(locked));
          if (locked) {
            control.setAttribute('tabindex', '-1');
            if (!('lockHint' in control.dataset)) {
              control.dataset.lockHint = control.getAttribute('title') || '';
            }
            if (hint) control.setAttribute('title', hint);
          } else {
            control.removeAttribute('tabindex');
            if ('lockHint' in control.dataset) {
              const previousTitle = control.dataset.lockHint;
              if (previousTitle) control.setAttribute('title', previousTitle);
              else control.removeAttribute('title');
              delete control.dataset.lockHint;
            }
          }
          return;
        }
        syncDisableState(control);
      });

      LOCKED_CURRENT_PERIOD_CONTROL_IDS.forEach(id => {
        syncDisableState(document.getElementById(id));
      });

      const recadoSubmit = document.querySelector('#recadosForm button[type="submit"]');
      syncDisableState(recadoSubmit);

      document.querySelectorAll('[data-recado-action]').forEach(control => {
        syncDisableState(control);
      });

      document.querySelectorAll('#pendingKanban [data-pending-id]').forEach(card => {
        card.draggable = !locked;
        card.setAttribute('aria-disabled', String(locked));
      });
    }

    function periodHasMeaningfulData(period) {
      if (!period) return false;
      return Boolean(
        period.recados?.length ||
        period.students?.length ||
        period.pending?.length ||
        period.scale?.length ||
        period.events?.length ||
        period.nps?.score ||
        period.nps?.observations ||
        period.nps?.mentions?.length ||
        Object.values(period.addons || {}).some(group => Object.values(group || {}).some(days => (days || []).some(value => Number(value || 0) > 0)))
      );
    }

    function ensurePeriod(key, template = state) {
      if (!storage.periods[key]) {
        storage.periods[key] = buildEmptyPeriodFromTemplate(template || demoData, key);
      }
      normalizeData(storage.periods[key]);
      return storage.periods[key];
    }

    function syncPeriodControls() {
      const monthSelect = document.getElementById('periodMonthSelect');
      const yearInput = document.getElementById('periodYearInput');
      const badge = document.getElementById('monthStatusBadge');
      if (!monthSelect || !yearInput || !badge) return;
      const [year, month] = currentPeriodKey.split('-');
      monthSelect.value = String(Number(month));
      yearInput.value = year;
      const archive = storage.archives[currentPeriodKey];
      badge.textContent = archive ? `✕ Fechado em ${archive.closedAtLabel}` : '● Mês em andamento';
      badge.classList.toggle('closed', !!archive);
      badge.classList.toggle('active', !archive);
      const closeBtn = document.getElementById('closeMonthBtn');
      if (closeBtn) closeBtn.disabled = !!archive;
      syncCurrentPeriodLockUI();
    }

    async function switchPeriod(key, options = {}) {
      const normalizedKey = String(key);
      ensurePeriod(normalizedKey);
      currentPeriodKey = normalizedKey;
      storage.activePeriod = normalizedKey;
      state = storage.periods[normalizedKey];
      const saved = await saveData(true);
      renderAll();
      syncPeriodControls();
      if (!options.silent && saved) showSaveToast(`✓ período ativo: ${getPeriodLabel(normalizedKey)}`);
    }

    function changePeriodFromControls() {
      const month = String(document.getElementById('periodMonthSelect').value || '1').padStart(2, '0');
      const year = String(document.getElementById('periodYearInput').value || new Date().getFullYear());
      switchPeriod(`${year}-${month}`);
    }

    function closePeriod() {
      if (!assertWritableCurrentPeriod({ message: `${getPeriodLabel()} já está fechado.` })) return;
      const currentLabel = getPeriodLabel(currentPeriodKey);
      showConfirm(`Fechar ${currentLabel} e abrir o próximo mês? O arquivo de fechamento será baixado automaticamente.`, async () => {
        const committedStore = await getCommittedStoreSnapshot({
          persistCurrent: true,
          eventType: 'close-month-backup',
          broadcast: false
        });
        const archivePayload = buildMonthArchivePayload(committedStore, currentPeriodKey, currentLabel);
        const blob = new Blob([JSON.stringify(archivePayload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `smartfit-fechamento-${currentPeriodKey}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);

        const previousArchive = storage.archives[currentPeriodKey];
        storage.archives[currentPeriodKey] = {
          closedAt: new Date().toISOString(),
          closedAtLabel: new Date().toLocaleString('pt-BR'),
          label: currentLabel
        };

        const nextKey = getNextPeriodKey(currentPeriodKey);
        const nextPeriod = storage.periods[nextKey];

        const finishClose = async resetNextPeriod => {
          if (resetNextPeriod) resetPeriodData(nextKey, state);
          else ensurePeriod(nextKey, state);
          const saved = await saveData(true);
          if (!saved) {
            if (previousArchive) storage.archives[currentPeriodKey] = previousArchive;
            else delete storage.archives[currentPeriodKey];
            showToast('Falha ao fechar o mês. Tente novamente.', 'danger');
            return;
          }
          await switchPeriod(nextKey, { silent: true });
          const nextMessage = resetNextPeriod
            ? `${getPeriodLabel(nextKey)} iniciado com dados zerados.`
            : `${getPeriodLabel(nextKey)} aberto preservando os dados existentes.`;
          showToast(`✓ ${currentLabel} fechado. ${nextMessage}`, 'success', 4500);
        };

        if (periodHasMeaningfulData(nextPeriod)) {
          showConfirm(
            `${getPeriodLabel(nextKey)} já possui dados. Confirmar = zerar e iniciar limpo. Cancelar = manter dados existentes.`,
            () => finishClose(true),
            () => finishClose(false)
          );
        } else {
          finishClose(true);
        }
      });
    }

    const closeCurrentMonth = closePeriod;

    async function resetPeriod() {
      if (!assertWritableCurrentPeriod({ message: `${getPeriodLabel()} está fechado e não pode ser resetado.` })) return;
      const label = getPeriodLabel(currentPeriodKey);
      await exportBackup();
      showConfirm(`Deseja resetar o mês ${label}? Um backup completo foi gerado antes desta operação. Todos os atendimentos, pendências, escala, eventos, NPS e addons serão apagados. As configurações de equipe e tipos de addon serão preservadas.`, async () => {
        resetPeriodData(currentPeriodKey, state);
        state = storage.periods[currentPeriodKey];
        const saved = await saveData({ eventType: 'reset' });
        renderAll();
        syncPeriodControls();
        if (saved) showToast(`✓ Mês ${label} resetado — pronto para novos registros.`, 'success');
      });
    }

    const resetSelectedMonth = resetPeriod;

    function duplicatePreviousMonthScale() {
      if (!assertWritableCurrentPeriod()) return;
      const previousKey = getPreviousPeriodKey(currentPeriodKey);
      const previous = storage.periods[previousKey];
      if (!previous || !Array.isArray(previous.scale) || !previous.scale.length) {
        return showToast(`Não há escala cadastrada em ${getPeriodLabel(previousKey)} para duplicar.`, 'warning');
      }
      const doDuplicate = async () => {
        const [targetYear, targetMonth] = String(currentPeriodKey).split('-');
        const targetMonthDays = new Date(Number(targetYear), Number(targetMonth), 0).getDate();
        let skippedDays = 0;

        state.scale = structuredClone(previous.scale).reduce((list, item) => {
          const parts = String(item?.date || '').split('-');
          const day = Number(parts[2]);
          if (!Number.isInteger(day) || day < 1 || day > targetMonthDays) {
            skippedDays += 1;
            return list;
          }
          list.push({
            ...item,
            id: crypto.randomUUID(),
            date: `${currentPeriodKey}-${String(day).padStart(2, '0')}`,
            professorShifts: (item.professorShifts || []).map(shift => ({ ...shift, id: crypto.randomUUID() }))
          });
          return list;
        }, []);

        state.scale.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        const saved = await saveData();
        requestRender(['scale', 'dashboard']);
        if (!saved) return;
        const skippedMessage = skippedDays
          ? ` ${skippedDays} dia(s) excedente(s) foram ignorados por não existirem em ${getPeriodLabel()}.`
          : '';
        showToast(`✓ Escala de ${getPeriodLabel(previousKey)} duplicada para ${getPeriodLabel()}.${skippedMessage}`, 'success');
      };
      if (state.scale.length) {
        showConfirm(`A escala atual de ${getPeriodLabel()} será substituída pela escala de ${getPeriodLabel(previousKey)}. Deseja continuar?`, doDuplicate);
      } else {
        doDuplicate();
      }
    }

    async function syncAppState(storeLike = null) {
      const sourceStore = storeLike || storage || await loadStore();
      storage = prepareStoreCandidate(sourceStore) || getDefaultStore();
      await migrateLegacyRecadosToStore(storage, {
        persist: true,
        cleanup: true,
        eventType: 'recados-migration'
      });
      currentPeriodKey = storage.activePeriod;
      state = storage.periods[currentPeriodKey];
      normalizeData(state);
      limparCacheSelectores();
      return state;
    }
