    /** @param {PendingItem} item @returns {string} */
    function buildPendingMeta(item) {
      const parts = [];
      if (item.status === 'aberto') parts.push('<span class="pulse-dot"></span>');
      if (item.hostess) parts.push(`<span class="meta-item">${esc(item.hostess)}</span>`);
      if (item.hostess && item.data) parts.push('<span class="meta-sep">•</span>');
      if (item.data) parts.push(`<span class="meta-item">${formatDate(item.data)}</span>`);
      return parts.join('') || '<span class="meta-item">Sem dados</span>';
    }

    /** @param {string} value @returns {string} */
    function pendingPill(value) {
      const map = {
        aberto: ['open-pill', '<span class="pulse-dot"></span>Aberto'],
        respondido: ['info', 'Respondido'],
        concluido: ['ok', 'Concluído']
      };
      const [cls, text] = map[value] || ['info', esc(value)];
      return `<span class="pill ${cls}">${text}</span>`;
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — PENDING — renderPending, savePending, removePending
    // ══════════════════════════════════════════

    /** @returns {void} */
    function renderPending() {
      const { linhas: rows, grupos } = selecionarPendenciasFiltradas();
      aplicarHtmlSeMudou(document.getElementById('pendingStatusStrip'), `
        <div class="pending-status-card pending-status-card--open">
          <span class="pending-status-label">Abertas</span>
          <strong class="pending-status-value">${grupos.aberto.length}</strong>
        </div>
        <div class="pending-status-card pending-status-card--progress">
          <span class="pending-status-label">Em andamento</span>
          <strong class="pending-status-value">${grupos.respondido.length}</strong>
        </div>
        <div class="pending-status-card pending-status-card--done">
          <span class="pending-status-label">Resolvidas</span>
          <strong class="pending-status-value">${grupos.concluido.length}</strong>
        </div>
        <div class="pending-status-card pending-status-card--total">
          <span class="pending-status-label">Total no período</span>
          <strong class="pending-status-value">${rows.length}</strong>
        </div>
      `);
      const pendingTableBody = document.getElementById('pendingTableBody');
      if (!rows.length) {
        aplicarHtmlSeMudou(pendingTableBody, `<tr><td colspan="8"><div class="empty"><strong>Nenhuma pendência no período</strong>Use <em>Nova pendência</em> para registrar uma solicitação ou ajuste os filtros ativos para ver itens arquivados.</div></td></tr>`);
      } else {
        aplicarPatchLinhas(pendingTableBody, rows, item => item.id, p => `
          <tr class="${p.status === 'aberto' ? 'row-attention' : ''}">
            <td><strong class="cell-ellipsis" data-tooltip="${esc(p.nome)}">${esc(p.nome)}</strong></td>
            <td><span class="cell-ellipsis" data-tooltip="${esc(p.matricula || '-')}">${esc(p.matricula || '-')}</span></td>
            <td><span class="cell-text multiline pending-cell-main" data-tooltip="${esc(p.pendencia || '-')}">${esc(p.pendencia || '-')}</span></td>
            <td><span class="cell-ellipsis">${formatDate(p.data)}</span></td>
            <td><span class="cell-ellipsis" data-tooltip="${esc(p.hostess || '-')}">${esc(p.hostess || '-')}</span></td>
            <td>${p.resposta ? `<span class="cell-text multiline pending-cell-response" data-tooltip="${esc(p.resposta)}">${esc(p.resposta)}</span>` : '<span class="pending-cell-response-empty">Sem resposta</span>'}</td>
            <td>${pendingPill(p.status)}</td>
            <td class="right">
              <button class="btn btn-ghost btn-xs" data-action="edit-pending" data-id="${p.id}">Editar</button>
              <button class="btn btn-danger btn-xs" data-action="remove-pending" data-id="${p.id}">Excluir</button>
            </td>
          </tr>
        `);
      }

      const pendingKanban = document.getElementById('pendingKanban');
      const colunas = Object.entries(grupos).map(([status, items]) => ({ status, items }));
      aplicarPatchBlocosAgrupados(pendingKanban, colunas, coluna => coluna.status, coluna => `
        <div class="kanban-col ${coluna.status === 'aberto' ? 'status-aberto' : ''}" data-drop-status="${coluna.status}">
          <div class="col-head">
            <h3>${coluna.status === 'aberto' ? '<span class="pulse-dot"></span>Abertas' : coluna.status === 'respondido' ? 'Respondidas' : 'Concluídas'}</h3>
          </div>
          <div class="kanban-list"></div>
        </div>
      `);

      colunas.forEach(coluna => {
        const lista = pendingKanban.querySelector(`[data-drop-status="${coluna.status}"] .kanban-list`);
        if (!lista) return;
        if (!coluna.items.length) {
          aplicarHtmlSeMudou(lista, '<div class="empty empty--compact">Sem itens nesta coluna</div>');
          return;
        }
        aplicarPatchItensKanban(lista, coluna.items, item => item.id, item => `
          <div class="ticket ${item.status === 'aberto' ? 'ticket-attention' : ''}" draggable="true" data-pending-id="${item.id}" data-tooltip="${esc(item.pendencia || '')}" role="listitem" aria-describedby="pendingKeyboardHelp" aria-keyshortcuts="ArrowUp ArrowDown Home End Alt+ArrowLeft Alt+ArrowRight" aria-label="Pendência de ${esc(item.nome)} com status ${esc(item.status)}">
            <div class="title" data-tooltip="${esc(item.nome)}">${esc(item.nome)}</div>
            <div class="meta">${buildPendingMeta(item)}</div>
            <div class="desc" data-tooltip="${esc(item.pendencia)}">${esc(shortText(item.pendencia, 115))}</div>
            ${item.resposta ? `<div class="desc muted" data-tooltip="${esc(item.resposta)}"><strong class="pending-response-label">Resposta:</strong> ${esc(shortText(item.resposta, 85))}</div>` : ''}
            <div class="foot">
              <span class="drag-hint"><span class="drag-grip" aria-hidden="true">⋮⋮</span>ARRASTE PARA MOVER</span>
              <div class="ticket-actions">
                <button class="btn btn-ghost btn-xs icon-btn" data-action="edit-pending" data-id="${item.id}" title="Editar" aria-label="Editar pendência de ${esc(item.nome)}" draggable="false">✎</button>
                <button class="btn btn-danger btn-xs icon-btn" data-action="remove-pending" data-id="${item.id}" title="Excluir" aria-label="Excluir pendência de ${esc(item.nome)}" draggable="false">✕</button>
              </div>
            </div>
          </div>
        `);
      });
      restaurarFocoPendenteSeNecessario();
    }

    /** @returns {void} */
    function clearPendingForm() {
      editingPendingId = null;
      limparErrosValidacao(['pending_nome', 'pending_matricula', 'pending_desc', 'pending_data']);
      document.getElementById('pendingModalTitle').textContent = 'Nova pendência';
      ['nome','matricula','desc','data','resposta'].forEach(f => document.getElementById(`pending_${f}`).value = '');
      document.getElementById('pending_hostess').value = getReceptionists(state)[0] || '';
      document.getElementById('pending_status').value = 'aberto';
    }

    /** @returns {void} */
    function finalizePendingSaveUI() {
      closeModal('pendingModal');
      clearPendingForm();
    }

    /** @returns {void} */
    function renderPendingSaveUI() {
      requestRender(['hero', 'dashboard', 'pending']);
    }

    /** @param {string} id @returns {void} */
    function editPending(id) {
      const p = state.pending.find(x => x.id === id);
      if (!p) return;
      editingPendingId = id;
      document.getElementById('pendingModalTitle').textContent = 'Editar pendência';
      document.getElementById('pending_nome').value = p.nome || '';
      document.getElementById('pending_matricula').value = p.matricula || '';
      document.getElementById('pending_desc').value = p.pendencia || '';
      document.getElementById('pending_data').value = p.data || '';
      document.getElementById('pending_hostess').value = p.hostess || getReceptionists(state)[0] || '';
      document.getElementById('pending_resposta').value = p.resposta || '';
      document.getElementById('pending_status').value = p.status || 'aberto';
      openModal('pendingModal');
    }

    /** @param {string} id @returns {void} */
    function removePending(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir esta pendência?', async () => {
        const existing = state.pending.find(p => p.id === id);
        if (!existing) return;
        state.pending = state.pending.filter(p => p.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.pending.push(existing);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['hero', 'dashboard', 'pending']);
      });
    }
