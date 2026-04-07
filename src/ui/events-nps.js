    // ══════════════════════════════════════════
    // EVENTOS UI — NPS
    // ══════════════════════════════════════════

    let npsObservationsDebounce = null;

    function bindNpsObservationsAutoSave() {
      if (estadoEventos.npsObservacoesInicializadas) return;
      estadoEventos.npsObservacoesInicializadas = true;

      const campo = document.getElementById('npsObservations');
      if (!campo) return;
      campo.addEventListener('input', () => {
        clearTimeout(npsObservationsDebounce);
        npsObservationsDebounce = setTimeout(saveNpsObservations, 800);
      });
    }

    function bindNpsEvents() {
      bindNpsObservationsAutoSave();

      return {
        handleClick(actionEl) {
          switch (actionEl.dataset.action) {
            case 'register-mention':
              registerMention();
              return true;
            case 'save-nps-observations':
              clearTimeout(npsObservationsDebounce);
              saveNpsObservations();
              return true;
            case 'adjust-mention':
              adjustMention(actionEl.dataset.id, Number(actionEl.dataset.delta || 0));
              return true;
            case 'remove-mention':
              removeMention(actionEl.dataset.id);
              return true;
            default:
              return false;
          }
        },

        handleChange(target) {
          const actionEl = target?.closest?.('[data-change-action]');
          if (!actionEl || actionEl.dataset.changeAction !== 'set-mention-count') return false;
          setMentionCount(actionEl.dataset.id, target.value);
          return true;
        },

        handleInput(target) {
          const actionEl = target?.closest?.('[data-input-action]');
          if (!actionEl) return false;

          switch (actionEl.dataset.inputAction) {
            case 'update-nps-score':
              updateNpsScore(target.value, actionEl.dataset.source);
              return true;
            case 'update-nps-goal':
              updateNpsGoal(actionEl.dataset.field, target.value);
              return true;
            default:
              return false;
          }
        },

        handleBlur(target) {
          const actionEl = target?.closest?.('[data-blur-action]');
          if (!actionEl || actionEl.dataset.blurAction !== 'rename-mention') return false;
          renameMention(actionEl.dataset.id, target.value);
          return true;
        }
      };
    }
