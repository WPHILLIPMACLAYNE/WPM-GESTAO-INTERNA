    // ══════════════════════════════════════════
    // EVENTOS UI — STUDENTS
    // ══════════════════════════════════════════

    function openStudentModal() {
      clearStudentForm();
      openModal('studentModal');
    }

    function bindStudentEvents() {
      return {
        handleClick(actionEl) {
          switch (actionEl.dataset.action) {
            case 'open-student-modal':
              openStudentModal();
              return true;
            case 'save-student':
              saveStudent();
              return true;
            case 'edit-student':
              editStudent(actionEl.dataset.id);
              return true;
            case 'remove-student':
              removeStudent(actionEl.dataset.id);
              return true;
            default:
              return false;
          }
        },

        handleChange(target) {
          const actionEl = target?.closest?.('[data-change-action]');
          if (!actionEl || actionEl.dataset.changeAction !== 'update-student-inline') return false;
          updateStudentInline(actionEl.dataset.id, actionEl.dataset.field, target.value);
          return true;
        }
      };
    }
