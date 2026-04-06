    // CAMADA DE ARMAZENAMENTO — IndexedDB wrapper, readStoredValue, readStoredJson, writeStoredJson, getStoreVersion, setStoreVersion, parseStoreValue, sanitizeUIState, saveUIState, getUIState
    // ══════════════════════════════════════════

    const storageCache = new Map();
    let storageCacheHydrated = false;
    let idbOpenPromise = null;
    let storageOperationQueue = Promise.resolve();
    let storageBroadcastCounter = 0;

    function isQuotaExceededError(err) {
      return Boolean(err && (err.name === 'QuotaExceededError' || err.code === 22));
    }

    function readLocalStorageValue(key) {
      try {
        return localStorage.getItem(key);
      } catch (err) {
        console.error(`Falha ao ler localStorage (${key}):`, err);
        return null;
      }
    }

    function writeLocalStorageValue(key, value) {
      try {
        localStorage.setItem(key, value);
        return { ok: true, quota: false, error: null };
      } catch (err) {
        if (!isQuotaExceededError(err)) {
          console.error(`Falha ao gravar localStorage (${key}):`, err);
        }
        return { ok: false, quota: isQuotaExceededError(err), error: err };
      }
    }

    function deleteLocalStorageValue(key) {
      try {
        localStorage.removeItem(key);
        return { ok: true, error: null };
      } catch (err) {
        console.error(`Falha ao remover localStorage (${key}):`, err);
        return { ok: false, error: err };
      }
    }

    function cloneSerializable(value) {
      if (value === undefined) return undefined;
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    }

    function canUseStorageBroadcast() {
      const probeKey = `${STORAGE_BROADCAST_KEY}__probe__`;
      const result = writeLocalStorageValue(probeKey, String(Date.now()));
      if (!result.ok) return false;
      deleteLocalStorageValue(probeKey);
      return true;
    }

    function queueStorageOperation(operation) {
      const nextOperation = storageOperationQueue
        .catch(() => undefined)
        .then(operation);
      storageOperationQueue = nextOperation.catch(() => undefined);
      return nextOperation;
    }

    const persistenceTechState = {
      modeLabel: 'híbrido / IndexedDB + cache + broadcast',
      status: 'pronto',
      backendLabel: 'IndexedDB',
      broadcastAvailable: canUseStorageBroadcast(),
      lastSuccessAt: null,
      lastOperationType: '—',
      storeVersion: STORE_VERSION,
      selfTest: {
        status: 'info',
        detail: 'Autoteste ainda não executado.'
      }
    };

    function updatePersistenceTechState(patch = {}, rerender = true) {
      Object.assign(persistenceTechState, patch);
      if (rerender) requestRender('settings');
      return persistenceTechState;
    }

    function formatPersistenceTimestamp(value) {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
    }

    function normalizePersistenceOptions(input, defaultEventType = 'save') {
      if (typeof input === 'boolean') {
        return {
          silent: input,
          eventType: defaultEventType,
          broadcast: true
        };
      }
      return {
        silent: Boolean(input?.silent),
        eventType: String(input?.eventType || defaultEventType),
        broadcast: input?.broadcast !== false
      };
    }

    async function emitStorageBroadcast(eventType = 'save') {
      const payload = JSON.stringify({
        ts: Date.now(),
        seq: ++storageBroadcastCounter,
        type: String(eventType || 'save')
      });
      const result = writeLocalStorageValue(STORAGE_BROADCAST_KEY, payload);
      if (!result.ok) {
        console.warn('Falha ao emitir broadcast cross-tab de persistência.', result.error);
        return false;
      }
      return true;
    }

    function getKnownStorageKeys() {
      return [
        STORAGE_KEY,
        ...LEGACY_STORAGE_KEYS,
        LOCAL_SNAPSHOT_KEY,
        ...LEGACY_LOCAL_SNAPSHOT_KEYS,
        SYSTEM_REPORT_KEY,
        ...LEGACY_SYSTEM_REPORT_KEYS,
        FLOW_TEST_REPORT_KEY,
        ...LEGACY_FLOW_TEST_REPORT_KEYS,
        UI_KEY,
        ...LEGACY_UI_KEYS
      ];
    }

    async function withIndexedDbStore(mode, operation) {
      if (!('indexedDB' in window)) return null;
      if (!idbOpenPromise) {
        idbOpenPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open(IDB_NAME, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
              db.createObjectStore(IDB_STORE_NAME);
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }).catch(err => {
          idbOpenPromise = null;
          throw err;
        });
      }

      const db = await idbOpenPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, mode);
        const store = tx.objectStore(IDB_STORE_NAME);
        const request = operation(store);
        tx.oncomplete = () => resolve(request?.result ?? null);
        tx.onerror = () => reject(tx.error || request?.error);
        tx.onabort = () => reject(tx.error || request?.error);
      });
    }

    async function idbGetValue(key) {
      return withIndexedDbStore('readonly', store => store.get(key));
    }

    async function idbSetValue(key, value) {
      return withIndexedDbStore('readwrite', store => store.put(value, key));
    }

    async function idbDeleteValue(key) {
      return withIndexedDbStore('readwrite', store => store.delete(key));
    }

    async function hydrateStorageCache() {
      if (storageCacheHydrated) return;
      const keys = getKnownStorageKeys();
      await Promise.all(keys.map(async key => {
        let value = null;
        try {
          value = await idbGetValue(key);
        } catch {}
        if (typeof value === 'string') {
          storageCache.set(key, value);
          writeLocalStorageValue(key, value);
          return;
        }
        const fallback = readLocalStorageValue(key);
        if (fallback !== null) storageCache.set(key, fallback);
      }));
      storageCacheHydrated = true;
    }

    async function readPrimaryStoredValue(key, { updateCache = true } = {}) {
      let value = null;
      if ('indexedDB' in window) {
        try {
          value = await idbGetValue(key);
        } catch (err) {
          console.error(`Falha ao ler IndexedDB (${key}):`, err);
        }
      }
      if (typeof value !== 'string') {
        value = readLocalStorageValue(key);
      }
      if (updateCache) {
        if (value === null) storageCache.delete(key);
        else storageCache.set(key, value);
      }
      return value;
    }

    function readStoredValue(key) {
      if (storageCache.has(key)) return storageCache.get(key);
      const value = readLocalStorageValue(key);
      if (value !== null) storageCache.set(key, value);
      return value;
    }

    function readStoredJson(key, fallback = null) {
      try {
        const raw = readStoredValue(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    function readStoredJsonWithFallback(primaryKey, legacyKeys = [], fallback = null) {
      const keys = [primaryKey, ...legacyKeys];
      for (const key of keys) {
        const value = readStoredJson(key, null);
        if (value != null) return value;
      }
      return fallback;
    }

    // ─── writeStoredValue: atualiza cache síncrono e persiste em IndexedDB ──────
    // Mantém espelho em localStorage para compatibilidade e evento cross-tab.
    async function persistStoredValue(key, value, onQuotaMessage, options = {}) {
      return queueStorageOperation(async () => {
        const canUseIndexedDb = 'indexedDB' in window;
        const onPersisted = typeof options.onPersisted === 'function'
          ? options.onPersisted
          : null;

        if (canUseIndexedDb) {
          try {
            await idbSetValue(key, value);
          } catch (err) {
            if (isQuotaExceededError(err)) {
              showToast(onQuotaMessage || 'Armazenamento local cheio. Exporte um backup e limpe dados antigos em Configurações.', 'danger');
            } else {
              console.error('Falha ao persistir no IndexedDB:', err);
              showToast('Não foi possível persistir os dados localmente neste navegador.', 'danger');
            }
            return { ok: false, localPersisted: false, indexedDbPersisted: false };
          }

          storageCache.set(key, value);
          const localResult = writeLocalStorageValue(key, value);
          if (!localResult.ok && !localResult.quota) {
            console.warn(`Espelho localStorage não pôde ser atualizado após commit principal (${key}).`, localResult.error);
          }
          onPersisted?.();
          return { ok: true, localPersisted: localResult.ok, indexedDbPersisted: true };
        }

        const localResult = writeLocalStorageValue(key, value);
        if (!localResult.ok) {
          const message = localResult.quota
            ? (onQuotaMessage || 'Armazenamento local cheio. Exporte um backup e limpe dados antigos em Configurações.')
            : 'Não foi possível persistir os dados localmente neste navegador.';
          showToast(message, 'danger');
          return { ok: false, localPersisted: false, indexedDbPersisted: false };
        }

        storageCache.set(key, value);
        onPersisted?.();
        return { ok: true, localPersisted: true, indexedDbPersisted: false };
      });
    }

    async function persistStoredJson(key, value, onQuotaMessage, options = {}) {
      return persistStoredValue(key, JSON.stringify(value), onQuotaMessage, options);
    }

    async function writeStoredValue(key, value, onQuotaMessage) {
      return (await persistStoredValue(key, value, onQuotaMessage)).ok;
    }

    async function writeStoredJson(key, value, onQuotaMessage) {
      return (await persistStoredJson(key, value, onQuotaMessage)).ok;
    }

    async function removeStoredValue(key) {
      return queueStorageOperation(async () => {
        const canUseIndexedDb = 'indexedDB' in window;

        if (canUseIndexedDb) {
          try {
            await idbDeleteValue(key);
          } catch (err) {
            console.error('Falha ao remover chave do IndexedDB:', err);
            return false;
          }
        }

        const localResult = deleteLocalStorageValue(key);
        if (!localResult.ok) {
          console.error(`Espelho localStorage não pôde ser removido (${key}).`, localResult.error);
          if (!canUseIndexedDb) return false;
        }

        storageCache.delete(key);
        return true;
      });
    }

    async function removeStoredValues(keys = []) {
      const results = [];
      for (const key of keys) {
        results.push(await removeStoredValue(key));
      }
      return results.every(Boolean);
    }

    function hasStoredValue(key) {
      return readStoredValue(key) !== null;
    }

    function hasStoredValueWithFallback(primaryKey, legacyKeys = []) {
      return [primaryKey, ...legacyKeys].some(key => hasStoredValue(key));
    }

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

    // ─── sanitizeDeep: higieniza dados recursivamente antes da importação ─────
    // Em vez de remover < e > (que destrói emails, fórmulas e nomes legítimos),
    // apenas trim strings e remove null bytes. A proteção XSS é feita pelo
    // esc() nos templates de renderização, que já escapa HTML corretamente.
    function sanitizeDeep(value) {
      if (Array.isArray(value)) return value.map(sanitizeDeep);
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, sanitizeDeep(v)])
        );
      }
      if (typeof value === 'string') return value.replace(/\x00/g, '').trim();
      return value;
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

    function makeRng(seed) {
      let h = 1779033703 ^ String(seed).length;
      for (let i = 0; i < String(seed).length; i++) {
        h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      };
    }

    function pick(list, rng) {
      return list[Math.floor(rng() * list.length)] || '';
    }

    function maybe(list, rng, chance = 0.5) {
      return rng() <= chance ? pick(list, rng) : '';
    }

    function generatePeriodSeed(periodKey) {
      const [yearStr, monthStr] = String(periodKey).split('-');
      const year = Number(yearStr) || new Date().getFullYear();
      const month = Number(monthStr) || 1;
      const monthDays = new Date(year, month, 0).getDate();
      const rng = makeRng(`smartfit-${periodKey}`);
      const receptionists = [...APP_DEFAULTS.receptionists];
      const professors = [...APP_DEFAULTS.professors];
      const addonTypes = [...APP_DEFAULTS.addonTypes];
      const base = {
        settings: {
          team: [...receptionists],
          receptionists: [...receptionists],
          professors: [...professors],
          addonTypes: [...addonTypes],
          monthDays
        },
        students: [],
        nps: { score: 0, monthlyGoal: 75, semesterGoal: 80, observations: '', mentions: [], rankSnapshot: {} },
        scale: [],
        events: [],
        pending: [],
        addons: {}
      };

      seedAddons(base);
      const matriculaBase = year * 10000 + month * 100;
      for (let i = 0; i < 30; i++) {
        const day = String(1 + Math.floor(rng() * monthDays)).padStart(2, '0');
        const date = `${yearStr}-${String(month).padStart(2, '0')}-${day}`;
        const name = `${pick(APP_DEFAULTS.studentFirstNames, rng)} ${pick(APP_DEFAULTS.studentLastNames, rng)}`;
        const atendimento = pick(receptionists, rng);
        const addon = rng() < 0.62 ? pick(addonTypes, rng) : '';
        const feedbackRoll = rng();
        const feedback = feedbackRoll < 0.45 ? 'Respondeu' : feedbackRoll < 0.72 ? 'Não respondeu' : 'Pendente';
        const student = {
          id: crypto.randomUUID(),
          nome: name,
          matricula: String(matriculaBase + i + 1),
          ultimaVisita: date,
          horaVisita: `${String(6 + Math.floor(rng() * 15)).padStart(2, '0')}:${pick(['00','10','20','30','40','50'], rng)}`,
          inicio: date,
          avisoNps: rng() < 0.65 ? 'Sim' : 'Não',
          atendimento,
          feedback,
          addon,
          observacoes: `${pick(APP_DEFAULTS.notes, rng)} ${rng() < 0.4 ? 'Perfil com potencial para retenção.' : 'Acompanhar próxima visita.'}`
        };
        base.students.push(student);
        if (addon) {
          const idx = Math.max(0, Math.min(monthDays - 1, Number(day) - 1));
          base.addons[atendimento][addon][idx] = Number(base.addons[atendimento][addon][idx] || 0) + 1;
        }
      }

      const statuses = ['aberto', 'respondido', 'concluido'];
      for (let i = 0; i < 20; i++) {
        const student = base.students[Math.floor(rng() * base.students.length)];
        const day = String(1 + Math.floor(rng() * monthDays)).padStart(2, '0');
        const status = statuses[Math.floor(rng() * statuses.length)];
        base.pending.push({
          id: crypto.randomUUID(),
          nome: student.nome,
          matricula: student.matricula,
          pendencia: `${pick(APP_DEFAULTS.pendingTopics, rng)} — ${pick(['prioridade alta', 'acompanhar no próximo turno', 'validar no sistema', 'cliente aguardando retorno'], rng)}.`,
          data: `${yearStr}-${String(month).padStart(2, '0')}-${day}`,
          hostess: pick(receptionists, rng),
          resposta: status === 'aberto' ? '' : pick(APP_DEFAULTS.pendingResponses, rng),
          status
        });
      }

      const mentions = getAllEmployees(base).map(name => ({
        id: crypto.randomUUID(),
        name,
        count: 1 + Math.floor(rng() * 18)
      }));
      const totalMentions = mentions.reduce((acc, item) => acc + item.count, 0);
      const positiveStudents = base.students.filter(item => item.feedback === 'Respondeu').length;
      base.nps = {
        score: clamp(Math.round((positiveStudents / Math.max(1, base.students.length)) * 100), 35, 98),
        monthlyGoal: 75,
        semesterGoal: 80,
        observations: `Mês ${MONTH_NAMES[month - 1]} com ${totalMentions} citações distribuídas entre recepção e professores. Reforçar retorno ativo em horários de pico e manter abordagem comercial padronizada.`,
        mentions,
        rankSnapshot: Object.fromEntries(mentions.map(item => [item.name, item.count]))
      };

      for (let day = 1; day <= monthDays; day++) {
        const date = `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const rowTone = suggestScaleTone(date);
        const shiftsCount = 1 + Math.floor(rng() * 3);
        const professorShifts = Array.from({ length: shiftsCount }, () => ({
          id: crypto.randomUUID(),
          time: pick(APP_DEFAULTS.scaleTimes, rng),
          name: pick(professors, rng),
          swap: rng() < 0.22 ? 'Cobertura' : ''
        }));
        base.scale.push({
          id: crypto.randomUUID(),
          date,
          rowTone,
          professorShifts,
          receptionTime: pick(APP_DEFAULTS.scaleTimes, rng),
          receptionist: pick(receptionists, rng),
          receptionSwap: rng() < 0.15 ? 'Troca aprovada' : '',
          note: pick(APP_DEFAULTS.notes, rng)
        });
      }

      for (let i = 0; i < 10; i++) {
        const day = String(1 + Math.floor(rng() * monthDays)).padStart(2, '0');
        const type = pick(APP_DEFAULTS.eventTypes, rng);
        base.events.push({
          id: crypto.randomUUID(),
          date: `${yearStr}-${String(month).padStart(2, '0')}-${day}`,
          time: `${String(7 + Math.floor(rng() * 13)).padStart(2, '0')}:${pick(['00','15','30','45'], rng)}`,
          type,
          title: pick(APP_DEFAULTS.eventTitles, rng),
          place: pick(APP_DEFAULTS.eventPlaces, rng),
          owner: pick(APP_DEFAULTS.eventOwners, rng),
          status: type === 'Feriado' ? 'Confirmado' : pick(APP_DEFAULTS.eventStatuses, rng),
          description: `${pick(APP_DEFAULTS.notes, rng)} ${pick(['Acionar equipe completa.', 'Preparar comunicação visual.', 'Registrar resultados no fechamento do mês.', 'Acompanhar leads gerados no mesmo dia.'], rng)}`
        });
      }

      return base;
    }

    const demoData = generatePeriodSeed(getInitialPeriodKey());

    function seedAddons(data) {
      data.addons = {};
      getReceptionists(data).forEach(name => {
        data.addons[name] = {};
        (data.settings.addonTypes || APP_DEFAULTS.addonTypes).forEach(type => {
          data.addons[name][type] = Array.from({ length: data.settings.monthDays }, () => 0);
        });
      });
    }

    function getInitialPeriodKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

    // ══════════════════════════════════════════
