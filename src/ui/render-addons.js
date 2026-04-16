    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — ADDONS — renderAddons, updateAddon, addPerson, renamePerson
    // ══════════════════════════════════════════

    /** @returns {void} */
    function renderAddons() {
      const days = state.settings.monthDays;
      const activeReceptionists = getReceptionists(state);
      const activeReceptionistSet = new Set(activeReceptionists);
      const addonPeople = getAddonPeople(state);
      document.getElementById('monthDaysSelector').value = String(days);
      document.getElementById('addonsGrid').innerHTML = addonPeople.map(person => {
        const isHistorical = !activeReceptionistSet.has(person);
        const personTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(state.addons[person] || {})])];
        const personTitle = isHistorical ? 'Atendente removido do cadastro ativo. Histórico preservado em modo somente leitura.' : '';
        return `
        <div class="person-block">
          <div class="person-head">
            <h3 ${isHistorical ? `title="${esc(personTitle)}"` : 'contenteditable="true" data-blur-action="rename-person"'} data-person="${esc(person)}">${esc(person)}</h3>
            ${isHistorical ? '<span class="pill">Histórico</span>' : ''}
            <span class="pill info">Total do mês: ${totalAddonByPerson(person)}</span>
          </div>
          ${personTypes.map(type => {
            const arr = state.addons[person]?.[type] || Array.from({length:days},()=>0);
            const total = arr.reduce((a,b) => a + Number(b || 0), 0);
            return `
              <div class="chart-box" style="margin-bottom:12px;">
                <div class="toolbar" style="margin-bottom:10px;">
                  <strong>${esc(type)}</strong>
                  <span class="pill">Total: ${total}</span>
                </div>
                <div class="day-grid">
                  ${Array.from({length:days}, (_,i) => `
                    <div class="day-cell">
                      <div class="day">Dia ${i+1}</div>
                      <input type="number" min="0" value="${arr[i] || 0}" data-change-action="update-addon" data-person="${esc(person)}" data-addon-type="${esc(type)}" data-index="${i}" ${isHistorical ? 'disabled data-historical-readonly="true" title="Histórico preservado; novos lançamentos para este nome estão bloqueados."' : ''} />
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      }).join('') || '<div class="empty"><strong>Sem atendentes cadastrados</strong>Abra <em>Configurações</em> e cadastre a equipe para liberar o lançamento diário de addons por tipo.</div>';

      const rankingHost = document.getElementById('addonsTopSellers');
      if (!rankingHost) return;

      const ranking = addonPeople
        .map(name => ({
          name,
          total: totalAddonByPerson(name)
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

      const soldAnyAddon = ranking.some(item => item.total > 0);
      aplicarHtmlSeMudou(
        rankingHost,
        soldAnyAddon
          ? ranking.map((item, index) => `
            <article class="addons-ranking-item ${index === 0 ? 'is-leading' : ''}">
              <span class="addons-ranking-pos">${index + 1}</span>
              <div class="addons-ranking-meta">
                <span class="addons-ranking-name">${esc(item.name)}</span>
                <span class="addons-ranking-label">Atendente do mês</span>
              </div>
              <span class="addons-ranking-total">${item.total} addon${item.total === 1 ? '' : 's'}</span>
            </article>
          `).join('')
          : '<div class="empty addons-ranking-empty">Os atendimentos com addon marcado aparecerão aqui assim que houver vendas no período.</div>'
      );
    }

    /** @param {string} person @param {string} type @param {number} idx @param {string|number} value @returns {void} */
    function updateAddon(person, type, idx, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'addons'] })) return;
      if (!getReceptionists(state).includes(person)) {
        showToast('Atendente removido do cadastro ativo. Histórico de addons está em modo somente leitura.', 'info');
        requestRender(['hero', 'dashboard', 'addons']);
        return;
      }
      state.addons[person][type][idx] = Math.max(0, Number(value || 0));
      saveData();
      requestRender(['hero', 'dashboard', 'addons']);
    }

    /** @returns {void} */
    function addPerson() {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'addons', 'settings'] })) return;
      const base = `Recepcionista ${getReceptionists(state).length + 1}`;
      state.settings.receptionists.push(base);
      state.settings.team = [...state.settings.receptionists];
      state.addons[base] = {};
      state.settings.addonTypes.forEach(type => state.addons[base][type] = Array.from({length:state.settings.monthDays},()=>0));
      saveData();
      populateStudentFilters();
      requestRender(['dashboard', 'addons', 'settings']);
    }

    /** @param {string} oldName @param {string} newNameRaw @returns {Promise<void>} */
    async function renamePerson(oldName, newNameRaw) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const newName = newNameRaw.trim();
      if (!newName || newName === oldName) return requestRender('addons');
      if (getReceptionists(state).includes(newName)) return showToast('Já existe um atendente com esse nome.', 'warning');
      if (state.addons[newName] && newName !== oldName) return showToast('Já existe histórico de addons com esse nome.', 'warning');

      const snapshot = {
        receptionists: [...state.settings.receptionists],
        team: [...(state.settings.team || [])],
        studentsAddon: state.students.map(s => ({ id: s.id, atendimento: s.atendimento })),
        pendingHostess: state.pending.map(p => ({ id: p.id, hostess: p.hostess })),
        npsMentions: state.nps.mentions.map(m => ({ id: m.id, name: m.name })),
        addons: state.addons[oldName] ? { [oldName]: state.addons[oldName] } : null
      };

      state.settings.receptionists = getReceptionists(state).map(name => name === oldName ? newName : name);
      state.settings.team = [...state.settings.receptionists];
      state.students.forEach(s => { if (s.atendimento === oldName) s.atendimento = newName; });
      state.pending.forEach(p => { if (p.hostess === oldName) p.hostess = newName; });
      state.nps.mentions.forEach(m => { if (m.name === oldName) m.name = newName; });
      state.addons[newName] = state.addons[oldName];
      delete state.addons[oldName];

      const saved = await saveData();
      if (!saved) {
        state.settings.receptionists = snapshot.receptionists;
        state.settings.team = snapshot.team;
        snapshot.studentsAddon.forEach(s => { const found = state.students.find(x => x.id === s.id); if (found) found.atendimento = s.atendimento; });
        snapshot.pendingHostess.forEach(p => { const found = state.pending.find(x => x.id === p.id); if (found) found.hostess = p.hostess; });
        snapshot.npsMentions.forEach(m => { const found = state.nps.mentions.find(x => x.id === m.id); if (found) found.name = m.name; });
        if (snapshot.addons) {
          delete state.addons[newName];
          state.addons[oldName] = snapshot.addons[oldName];
        }
        showToast('Falha ao salvar renomeação. Alterações revertidas.', 'danger');
        requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
        return;
      }

      populateStudentFilters();
      requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
    }
