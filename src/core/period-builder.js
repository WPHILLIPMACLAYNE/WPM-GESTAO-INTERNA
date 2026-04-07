    // CAMADA DE PERÍODOS E ESTADO — versionamento, estado de UI, equipes e builders de período
    // ══════════════════════════════════════════

    function getStoreVersion(store) {
      const version = Number(store?.version);
      return Number.isInteger(version) && version > 0 ? version : 0;
    }

    function setStoreVersion(store, version) {
      if (!store || typeof store !== 'object') return store;
      store.version = Number(version) || 0;
      return store;
    }

    function getUIState() {
      return readStoredJsonWithFallback(UI_KEY, LEGACY_UI_KEYS, {});
    }

    function saveUIState(patch = {}) {
      const next = sanitizeUIState({ ...getUIState(), ...patch });
      writeStoredJson(UI_KEY, next);
      removeStoredValues(LEGACY_UI_KEYS);
      return next;
    }

    function sanitizeUIState(ui = getUIState()) {
      const next = { ...ui };
      const validEventTypes = new Set(['', 'evento', 'acao', 'campanha', 'treinamento', 'feriado', 'outro']);
      const validEventStatuses = new Set(['', 'Programado', 'Confirmado', 'Concluído', 'Cancelado']);
      const validTabs = new Set(['dashboard','students','addons','pending','nps','scale','events','settings']);
      let changed = false;
      if (next.activeTab === 'tickets') {
        next.activeTab = 'pending';
        changed = true;
      }
      if (!validEventTypes.has(String(next.eventTypeFilter ?? ''))) {
        next.eventTypeFilter = '';
        changed = true;
      }
      if (!validEventStatuses.has(String(next.eventStatusFilter ?? ''))) {
        next.eventStatusFilter = '';
        changed = true;
      }
      if (next.activeTab && !validTabs.has(String(next.activeTab))) {
        next.activeTab = 'dashboard';
        changed = true;
      }
      if (changed) {
        writeStoredJson(UI_KEY, next);
        removeStoredValues(LEGACY_UI_KEYS);
      }
      return next;
    }

    function setActiveTab(tab, silent = false) {
      const target = document.getElementById(tab);
      if (!target) return;
      const appShell = document.querySelector('.app');
      if (appShell) appShell.dataset.activeTab = tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
        b.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      document.querySelectorAll('.view').forEach(v => {
        const isActive = v.id === tab;
        v.classList.toggle('active', isActive);
        v.hidden = !isActive;
        v.setAttribute('aria-hidden', String(!isActive));
      });
      if (!silent) {
        saveUIState({ activeTab: tab });
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        target.focus({ preventScroll: true });
      }
    }

    function getReceptionists(source = state) {
      const list = source?.settings?.receptionists || source?.settings?.team || APP_DEFAULTS.receptionists;
      return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
    }

    function getProfessors(source = state) {
      const list = source?.settings?.professors || APP_DEFAULTS.professors;
      return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
    }

    function getAllEmployees(source = state) {
      return [...new Set([...getReceptionists(source), ...getProfessors(source)])];
    }

    function totalAddonVolumeForPerson(person, source = state) {
      const group = source?.addons?.[person] || {};
      const knownTypes = [...new Set([...(source?.settings?.addonTypes || []), ...Object.keys(group)])];
      return knownTypes.reduce((total, type) => {
        const values = Array.isArray(group[type]) ? group[type] : [];
        return total + values.reduce((acc, value) => acc + Number(value || 0), 0);
      }, 0);
    }

    function getAddonPeople(source = state) {
      const activeReceptionists = getReceptionists(source);
      const historicalPeople = Object.keys(source?.addons || {}).filter(person => (
        person &&
        (activeReceptionists.includes(person) || totalAddonVolumeForPerson(person, source) > 0)
      ));
      return [...new Set([...activeReceptionists, ...historicalPeople])];
    }

    function getTotalAddonVolume(source = state) {
      return Object.keys(source?.addons || {}).reduce((total, person) => {
        return total + totalAddonVolumeForPerson(person, source);
      }, 0);
    }

    function hydrateLegacyAddonsFromStudents(data) {
      if (!data || getTotalAddonVolume(data) > 0) return;
      data.students.forEach(student => {
        const person = String(student?.atendimento || '').trim();
        const type = String(student?.addon || '').trim();
        const rawDate = String(student?.inicio || student?.ultimaVisita || '').trim();
        const day = Number(rawDate.split('-')[2] || 0);
        if (!person || !type || !day) return;
        data.addons[person] ||= {};
        const arr = Array.from(
          { length: data.settings.monthDays },
          (_, index) => Number((data.addons[person][type] || [])[index] || 0)
        );
        const idx = Math.min(data.settings.monthDays, Math.max(1, day)) - 1;
        arr[idx] = Number(arr[idx] || 0) + 1;
        data.addons[person][type] = arr;
      });
    }

    function seedAddons(data) {
      data.addons = {};
      getReceptionists(data).forEach(name => {
        data.addons[name] = {};
        (data.settings.addonTypes || APP_DEFAULTS.addonTypes).forEach(type => {
          data.addons[name][type] = Array.from({ length: data.settings.monthDays }, () => 0);
        });
      });
    }

    // ─── buildCleanPeriodFromTemplate: cria período limpo herdando settings ──────
    // Unifica a criação de períodos vazios e resets. Valida cada campo com
    // clamp(), structuredClone e deduplicação via Set para evitar dados sujos.
    function buildCleanPeriodFromTemplate(template, key = currentPeriodKey) {
      const normalizedKey = String(key || getInitialPeriodKey());
      const [yearStr, monthStr] = normalizedKey.split('-');
      const year = Number(yearStr) || new Date().getFullYear();
      const month = Number(monthStr) || 1;
      const monthDays = new Date(year, month, 0).getDate();

      const source = structuredClone(template || {});
      normalizeData(source);

      const receptionists = Array.isArray(source?.settings?.receptionists) && source.settings.receptionists.length
        ? [...new Set(source.settings.receptionists.filter(Boolean))]
        : [...APP_DEFAULTS.receptionists];

      const professors = Array.isArray(source?.settings?.professors) && source.settings.professors.length
        ? [...new Set(source.settings.professors.filter(Boolean))]
        : [...APP_DEFAULTS.professors];

      const addonTypes = Array.isArray(source?.settings?.addonTypes) && source.settings.addonTypes.length
        ? [...new Set(source.settings.addonTypes.filter(Boolean))]
        : [...APP_DEFAULTS.addonTypes];

      const clean = {
        settings: {
          team: [...receptionists],
          receptionists: [...receptionists],
          professors: [...professors],
          addonTypes: [...addonTypes],
          monthDays
        },
        students: [],
        pending: [],
        recados: [],
        nps: {
          score: 0,
          monthlyGoal: clamp(Number(source?.nps?.monthlyGoal ?? 75), 0, 100),
          semesterGoal: clamp(Number(source?.nps?.semesterGoal ?? 80), 0, 100),
          observations: '',
          mentions: [],
          rankSnapshot: {}
        },
        scale: [],
        events: [],
        addons: {}
      };

      seedAddons(clean);
      normalizeData(clean);
      return clean;
    }

    // Alias mantido para compatibilidade com seedYear e normalizeStore
    function buildEmptyPeriodFromTemplate(template, key = currentPeriodKey) {
      return buildCleanPeriodFromTemplate(template, key);
    }

    // ─── resetPeriodData: wrapper limpo para reset de período ───────────────────
    function resetPeriodData(key, template = state) {
      storage.periods[key] = buildCleanPeriodFromTemplate(template || state, key);
      normalizeData(storage.periods[key]);
      clearLegacyRecadosStorageKey(key);
      return storage.periods[key];
    }

    function seedYear(year) {
      const periods = {};
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        periods[key] = buildEmptyPeriodFromTemplate(null, key);
      }
      return periods;
    }
