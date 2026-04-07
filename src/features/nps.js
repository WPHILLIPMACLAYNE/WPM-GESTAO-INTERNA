    // ══════════════════════════════════════════
    // NPS ACTIONS — registro, ajuste, rename, remoção de menções + observações
    // ══════════════════════════════════════════
    // Dependências globais (providas por scripts carregados antes):
    //   assertWritableCurrentPeriod                            — core/lifecycle.js
    //   saveData                                               — core/backup.js
    //   requestRender                                          — ui/render-core.js
    //   showToast, showConfirm                                 — ui/events-core.js
    //   state, currentPeriodKey                                — estado global
    //   getMentionDraft, getNpsObservationsDraft               — features/forms.js
    //   captureNpsRankSnapshot                                 — ui/render-nps.js
    //   DOM                                                    — core/config.js

    function registerMention() {
      if (!assertWritableCurrentPeriod()) return;
      const { name, count } = getMentionDraft();
      if (!name) return showToast('Informe o nome do funcionário citado.', 'warning');
      captureNpsRankSnapshot();
      const existing = state.nps.mentions.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.count += count;
      } else {
        state.nps.mentions.push({ id: crypto.randomUUID(), name, count });
      }
      DOM.setValue('npsMentionName', '');
      DOM.setValue('npsMentionCount', 1);
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
    }

    function adjustMention(id, delta) {
      if (!assertWritableCurrentPeriod()) return;
      const item = state.nps.mentions.find(x => x.id === id);
      if (!item) return;
      captureNpsRankSnapshot();
      item.count = Math.max(0, Number(item.count || 0) + delta);
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
    }

    function setMentionCount(id, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'nps'] })) return;
      const item = state.nps.mentions.find(x => x.id === id);
      if (!item) return;
      captureNpsRankSnapshot();
      item.count = Math.max(0, Number(value || 0));
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
    }

    function renameMention(id, newNameRaw) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'nps'] })) return;
      const item = state.nps.mentions.find(x => x.id === id);
      if (!item) return;
      const newName = newNameRaw.trim();
      if (!newName || newName === item.name) return requestRender('nps');
      captureNpsRankSnapshot();
      item.name = newName;
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
    }

    function removeMention(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja remover este nome do ranking de NPS?', () => {
        captureNpsRankSnapshot();
        state.nps.mentions = state.nps.mentions.filter(item => item.id !== id);
        saveData();
        requestRender(['hero', 'dashboard', 'nps']);
      });
    }

    async function saveNpsObservations() {
      if (!assertWritableCurrentPeriod({ rerender: ['nps'] })) return;
      state.nps.observations = getNpsObservationsDraft();
      const saved = await saveData();
      if (saved) showToast('Observações de NPS salvas.');
    }
