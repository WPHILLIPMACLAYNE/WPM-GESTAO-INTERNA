    // ══════════════════════════════════════════
    // EVENTOS UI — PENDING
    // ══════════════════════════════════════════

    let draggingPendingId = null;

    function updatePendingStatus(id, status) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'pending'] })) return;
      const item = state.pending.find(x => x.id === id);
      if (!item || item.status === status) return;
      item.status = status;
      estadoAcessibilidade.pendenciaFocadaId = id;
      saveData();
      requestRender(['hero', 'dashboard', 'pending']);
    }

    function limparEstadoDropPendencias() {
      document.querySelectorAll('.kanban-col.drop-target').forEach(col => col.classList.remove('drop-target'));
    }

    function openPendingModal() {
      clearPendingForm();
      openModal('pendingModal');
    }

    function bindPendingEvents() {
      return {
        handleClick(actionEl) {
          switch (actionEl.dataset.action) {
            case 'open-pending-modal':
              openPendingModal();
              return true;
            case 'export-pending-csv':
              exportPendingCsv();
              return true;
            case 'save-pending':
              savePending();
              return true;
            case 'edit-pending':
              editPending(actionEl.dataset.id);
              return true;
            case 'remove-pending':
              removePending(actionEl.dataset.id);
              return true;
            default:
              return false;
          }
        }
      };
    }

    function bindPendingDnD() {
      if (estadoEventos.dndPendenciasInicializado) return;
      estadoEventos.dndPendenciasInicializado = true;

      document.addEventListener('dragstart', e => {
        const card = e.target.closest('[data-pending-id]');
        if (!card) return;
        draggingPendingId = card.dataset.pendingId;
        card.classList.add('dragging');
      });

      document.addEventListener('dragend', e => {
        const card = e.target.closest('[data-pending-id]');
        if (!card) return;
        card.classList.remove('dragging');
        draggingPendingId = null;
        limparEstadoDropPendencias();
      });

      document.addEventListener('dragover', e => {
        const col = e.target.closest('[data-drop-status]');
        if (!col) return;
        e.preventDefault();
        col.classList.add('drop-target');
      });

      document.addEventListener('dragleave', e => {
        const col = e.target.closest('[data-drop-status]');
        if (!col) return;
        const relacionado = e.relatedTarget;
        if (relacionado && col.contains(relacionado)) return;
        col.classList.remove('drop-target');
      });

      document.addEventListener('drop', e => {
        const col = e.target.closest('[data-drop-status]');
        if (!col) return;
        e.preventDefault();
        col.classList.remove('drop-target');
        if (!draggingPendingId) return;
        updatePendingStatus(draggingPendingId, col.dataset.dropStatus);
      });
    }
