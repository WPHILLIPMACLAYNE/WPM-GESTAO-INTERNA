    // ══════════════════════════════════════════
    // EVENTOS UI — SCALE
    // ══════════════════════════════════════════

    function bindScaleEvents() {
      return {
        handleClick(actionEl) {
          switch (actionEl.dataset.action) {
            case 'export-scale-csv':
              exportScaleCsv();
              return true;
            case 'open-scale-modal':
              openScaleModal();
              return true;
            case 'duplicate-previous-month-scale':
              duplicatePreviousMonthScale();
              return true;
            case 'add-scale-shift-row':
              addScaleShiftRow();
              return true;
            case 'remove-scale-shift-row':
              removeScaleShiftRow(Number(actionEl.dataset.index || -1));
              return true;
            case 'save-scale-day':
              saveScaleDay();
              return true;
            case 'edit-scale-day':
              editScaleDay(actionEl.dataset.id);
              return true;
            case 'remove-scale-day':
              removeScaleDay(actionEl.dataset.id);
              return true;
            default:
              return false;
          }
        },

        handleInput(target) {
          const inputEscala = target?.closest?.('[data-scale-shift]');
          if (!inputEscala) return false;
          const idx = Number(inputEscala.dataset.index);
          const field = inputEscala.dataset.scaleShift;
          if (scaleShiftDrafts[idx]) {
            scaleShiftDrafts[idx][field] = target.value;
          }
          return true;
        }
      };
    }
