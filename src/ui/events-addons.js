    // ══════════════════════════════════════════
    // EVENTOS UI — ADDONS
    // ══════════════════════════════════════════

    function bindAddonEvents() {
      return {
        handleClick(actionEl) {
          if (actionEl.dataset.action !== 'add-person') return false;
          addPerson();
          return true;
        },

        handleChange(target) {
          const actionEl = target?.closest?.('[data-change-action]');
          if (!actionEl || actionEl.dataset.changeAction !== 'update-addon') return false;
          updateAddon(actionEl.dataset.person, actionEl.dataset.addonType, Number(actionEl.dataset.index || 0), target.value);
          return true;
        },

        handleBlur(target) {
          const actionEl = target?.closest?.('[data-blur-action]');
          if (!actionEl || actionEl.dataset.blurAction !== 'rename-person') return false;
          renamePerson(actionEl.dataset.person, target.textContent);
          return true;
        }
      };
    }
