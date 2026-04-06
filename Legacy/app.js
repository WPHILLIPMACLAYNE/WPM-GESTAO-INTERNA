    /*
      Mapa da arquitetura
      1) constantes/configuração
      2) armazenamento/persistência
      3) schema/migração/sanitização
      4) lógica de domínio/selectors
      5) transições de estado/ações
      6) renderização
      7) controladores de UI/eventos
      8) diagnósticos/helpers de teste

      O app continua como uma SPA de arquivo único. A organização abaixo preserva
      o comportamento atual, reduz leituras diretas de DOM espalhadas e mantém o
      fluxo de renderização explícito, agendado e mais previsível.

      Checklist interno de acessibilidade
      - manter feedbacks com aria-live e foco previsível
      - garantir navegação por teclado em abas, modais e cards interativos
      - preservar retorno de foco após fechar modal
      - oferecer alternativa por teclado para fluxos de arrastar e soltar
      - sinalizar validação de forma auditiva e programática
    */

    // ══════════════════════════════════════════
    // CONSTANTES & CONFIGURAÇÃO — STORAGE_KEY, STORE_VERSION, APP_VERSION, MONTH_NAMES, UI_KEY
    // ══════════════════════════════════════════

    const STORAGE_KEY = 'recepcao-smartfit-dashboard-v34';
    const STORAGE_BROADCAST_KEY = 'recepcao-smartfit-dashboard-sync-v34';
    const STORE_VERSION = 4;
    const LEGACY_STORAGE_KEYS = ['recepcao-smartfit-dashboard-v33', 'recepcao-smartfit-dashboard-v24'];
    const APP_VERSION = 'v34';
    const LOCAL_SNAPSHOT_KEY = 'controle_recepcao_app_snapshot_v34';
    const SYSTEM_REPORT_KEY = 'controle_recepcao_app_report_v34';
    const FLOW_TEST_REPORT_KEY = 'controle_recepcao_app_flowtests_v34';
    const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const UI_KEY = 'controle_recepcao_app_ui_v34';
    const IDB_NAME = 'wpm-gestao-interna-db';
    const IDB_STORE_NAME = 'app_kv';
    const LEGACY_LOCAL_SNAPSHOT_KEYS = ['controle_recepcao_app_snapshot_v33'];
    const LEGACY_SYSTEM_REPORT_KEYS = ['controle_recepcao_app_report_v33'];
    const LEGACY_FLOW_TEST_REPORT_KEYS = ['controle_recepcao_app_flowtests_v33'];
    const LEGACY_UI_KEYS = ['controle_recepcao_app_ui_v33'];

    const DOM = {
      byId(id) {
        return document.getElementById(id);
      },
      html(id, markup) {
        const el = DOM.byId(id);
        if (el) el.innerHTML = sanitizeHtml(markup);
        return el;
      },
      text(id, value) {
        const el = DOM.byId(id);
        if (el) el.textContent = value;
        return el;
      },
      value(id, fallback = '') {
        const el = DOM.byId(id);
        return el ? el.value : fallback;
      },
      setValue(id, value) {
        const el = DOM.byId(id);
        if (el) el.value = value;
        return el;
      }
    };

    // ══════════════════════════════════════════
    // HELPERS DE ESCAPE — esc() para proteção XSS nos templates
    // ══════════════════════════════════════════

    function esc(value) {
      if (value == null) return '';
      const str = String(value);
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    /**
     * Sanitiza HTML antes de injetar via innerHTML usando DOMPurify.
     * Se DOMPurify não estiver disponível, fallback para esc() no texto puro.
     * Uso: el.innerHTML = sanitizeHtml(htmlString);
     */
    function sanitizeHtml(html) {
      if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p', 'br', 'span',
            'div', 'article', 'section', 'header', 'footer', 'h1', 'h2', 'h3',
            'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'form', 'input', 'select', 'option', 'textarea', 'button', 'label',
            'img', 'svg', 'circle', 'path', 'g', 'code', 'pre', 'blockquote',
            'small', 'sub', 'sup', 'mark', 'time', 'abbr', 'address', 'cite',
            'data', 'dfn', 'kbd', 'samp', 'var', 'details', 'summary', 'dialog',
            'figure', 'figcaption', 'main', 'nav', 'output', 'progress', 'meter'
          ],
          ALLOWED_ATTR: [
            'href', 'title', 'target', 'rel', 'src', 'alt', 'class', 'id',
            'style', 'data-*', 'aria-*', 'role', 'tabindex', 'type', 'value',
            'placeholder', 'required', 'disabled', 'readonly', 'checked',
            'selected', 'for', 'name', 'min', 'max', 'step', 'pattern',
            'maxlength', 'minlength', 'autocomplete', 'autofocus', 'form',
            'action', 'method', 'enctype', 'novalidate', 'draggable',
            'contenteditable', 'hidden', 'colspan', 'rowspan', 'scope',
            'headers', 'abbr', 'axis', 'dir', 'lang', 'xml:lang', 'translate'
          ],
          ALLOW_DATA_ATTR: true,
          KEEP_CONTENT: true,
          RETURN_DOM: false,
          RETURN_DOM_FRAGMENT: false
        });
      }
      // Fallback: se DOMPurify indisponível, escapa todo o HTML
      console.warn('DOMPurify indisponível — usando fallback esc()');
      return esc(html);
    }

    // ══════════════════════════════════════════
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

    function todayISO(offset = 0) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    }

    function currentMonthDayISO(day = 1) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(1);
      d.setDate(Math.max(1, Number(day || 1)));
      return d.toISOString().slice(0, 10);
    }


    const APP_DEFAULTS = {
      receptionists: ['Wallace', 'Emilia', 'Gessica', 'Maickon'],
      professors: ['Charles', 'Phillipe', 'Junior', 'Samuel', 'Gabriel', 'Maicon', 'Saulo'],
      addonTypes: ['Energy', 'Body', 'Coach'],
      studentFirstNames: ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Giovana', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Mariana', 'Nathan', 'Olivia', 'Paulo', 'Quezia', 'Rafael', 'Sabrina', 'Thiago', 'Ursula', 'Vinicius', 'Wesley', 'Yasmin', 'Zoe', 'Bianca', 'Caio', 'Debora', 'Enzo', 'Fabiana', 'Guilherme', 'Helena', 'Igor', 'Jéssica', 'Leandro', 'Mirela'],
      studentLastNames: ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Ferreira', 'Gomes', 'Henrique', 'Ibrahim', 'Jesus', 'Klein', 'Lopes', 'Macedo', 'Nascimento', 'Oliveira', 'Pereira', 'Queiroz', 'Ramos', 'Silva', 'Teixeira', 'Uchoa', 'Vieira'],
      pendingTopics: ['Atualizar cadastro', 'Confirmar avaliação física', 'Regularizar biometria', 'Enviar contrato assinado', 'Ajustar vencimento', 'Reagendar retorno comercial', 'Entregar atestado', 'Validar dependente', 'Confirmar plano familiar', 'Liberar acesso no totem'],
      pendingResponses: ['WhatsApp enviado e aguardando retorno.', 'Cliente respondeu e seguirá com a regularização.', 'Ligação realizada e recado anotado.', 'Pendência conferida com apoio da recepção.', 'Caso revisado e encaminhado ao professor responsável.'],
      eventTypes: ['Ação', 'Campanha', 'Treinamento', 'Feriado', 'Evento'],
      eventTitles: ['Mutirão de matrícula', 'Treinamento de vendas', 'Campanha de indicação', 'Ação comercial no salão', 'Aula temática', 'Blitz de retenção', 'Feriado operacional', 'Treinamento de recepção', 'Campanha de addons', 'Evento de comunidade'],
      eventPlaces: ['Recepção', 'Sala funcional', 'Entrada da unidade', 'Studio bike', 'Área de musculação', 'Sala de reunião'],
      eventOwners: ['Recepção', 'Coordenação', 'Marketing', 'Equipe comercial'],
      eventStatuses: ['Programado', 'Confirmado', 'Concluído'],
      scaleTimes: ['06h - 12h', '07h - 13h', '08h - 14h', '12h - 18h', '13h - 19h', '14h - 20h', '16h - 22h'],
      notes: ['Foco em retenção e relacionamento.', 'Fluxo alto esperado no período da tarde.', 'Reforçar abordagem comercial na recepção.', 'Cobertura planejada para horários críticos.', 'Monitorar retorno dos alunos com visita inicial.']
    };

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
    // PIPELINE DE MIGRAÇÃO — normalizeStore, getDefaultStore, migrateStoreToV1..V4, migrateStore, sanitizeStore, saveData
    // ══════════════════════════════════════════

    function isValidPeriodKey(key) {
      return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(key || ''));
    }

    function normalizeStore(store) {
      store = store && typeof store === 'object' ? store : {};
      store.activePeriod = isValidPeriodKey(store.activePeriod) ? String(store.activePeriod) : getInitialPeriodKey();
      store.periods = store.periods && typeof store.periods === 'object' && !Array.isArray(store.periods) ? store.periods : {};
      store.archives = store.archives && typeof store.archives === 'object' && !Array.isArray(store.archives) ? store.archives : {};

      Object.keys(store.periods).forEach(key => {
        if (!isValidPeriodKey(key) || !store.periods[key] || typeof store.periods[key] !== 'object' || Array.isArray(store.periods[key])) {
          delete store.periods[key];
          return;
        }
        normalizeData(store.periods[key]);
      });

      if (!store.periods[store.activePeriod]) {
        const source = Object.values(store.periods)[0] || demoData;
        store.periods[store.activePeriod] = buildEmptyPeriodFromTemplate(source, store.activePeriod);
      }
      return store;
    }

    function seedYear(year) {
      const periods = {};
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        periods[key] = buildEmptyPeriodFromTemplate(null, key);
      }
      return periods;
    }

    function getDefaultStore() {
      const initialKey = getInitialPeriodKey();
      return sanitizeStore({
        version: STORE_VERSION,
        activePeriod: initialKey,
        periods: seedYear(String(initialKey).split('-')[0]),
        archives: {}
      });
    }

    // Histórico de versões do armazenamento:
    // V1: baseline inicial.
    // V2: adição do campo events; normalizeData já preenche com [] quando ausente.
    // V3: adição de nps.mentions; normalizeData já preenche com [] quando ausente.
    // V4: reservado para a próxima migração real de schema.

    function migrateStoreToV1(store) {
      if (!store || typeof store !== 'object') return null;
      // V0 → V1: baseline inicial do store versionado; sem transformação de schema.
      return setStoreVersion(store, 1);
    }

    function migrateStoreToV2(store) {
      if (!store || typeof store !== 'object') return null;
      // V1 → V2: nenhuma transformação de schema necessária; apenas bump de versão.
      return setStoreVersion(store, 2);
    }

    function migrateStoreToV3(store) {
      if (!store || typeof store !== 'object') return null;
      // V2 → V3: nenhuma transformação de schema necessária; normalizeData já completa nps.mentions.
      return setStoreVersion(store, 3);
    }

    function migrateStoreToV4(store) {
      if (!store || typeof store !== 'object') return null;
      // V3 → V4: placeholder para a próxima migração real de schema.
      // TODO: aplicar aqui transformações explícitas quando V4 introduzir campos incompatíveis.
      return setStoreVersion(store, 4);
    }

    function migrateStore(store) {
      if (!store || typeof store !== 'object') return null;
      let nextStore = store;
      const currentVersion = getStoreVersion(nextStore);

      if (currentVersion < 1) {
        nextStore = migrateStoreToV1(nextStore);
      }
      if (getStoreVersion(nextStore) < 2) {
        nextStore = migrateStoreToV2(nextStore);
      }
      if (getStoreVersion(nextStore) < 3) {
        nextStore = migrateStoreToV3(nextStore);
      }
      if (getStoreVersion(nextStore) < 4) {
        nextStore = migrateStoreToV4(nextStore);
      }

      if (getStoreVersion(nextStore) !== STORE_VERSION) return null;
      return nextStore;
    }

    function sanitizeStore(parsed) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      if (parsed && parsed.settings && parsed.students) {
        const currentKey = getInitialPeriodKey();
        return normalizeStore(setStoreVersion({
          version: getStoreVersion(parsed),
          activePeriod: currentKey,
          periods: { [currentKey]: cloneSerializable(parsed) },
          archives: {}
        }, getStoreVersion(parsed)));
      }

      if (parsed.periods && typeof parsed.periods === 'object' && !Array.isArray(parsed.periods)) {
        const rawPeriods = Object.fromEntries(
          Object.entries(parsed.periods)
            .filter(([key, value]) => isValidPeriodKey(key) && value && typeof value === 'object' && !Array.isArray(value))
            .map(([key, value]) => [key, cloneSerializable(value)])
        );
        const archives = parsed.archives && typeof parsed.archives === 'object' && !Array.isArray(parsed.archives)
          ? cloneSerializable(parsed.archives)
          : {};
        const store = normalizeStore({
          version: getStoreVersion(parsed),
          activePeriod: parsed.activePeriod,
          periods: rawPeriods,
          archives
        });
        const currentYear = String(store.activePeriod || getInitialPeriodKey()).split('-')[0];
        Object.entries(seedYear(currentYear)).forEach(([key, period]) => {
          if (!store.periods[key]) store.periods[key] = period;
        });
        return setStoreVersion(store, getStoreVersion(parsed));
      }
      return null;
    }

    function prepareStoreCandidate(storeLike) {
      if (!storeLike || typeof storeLike !== 'object' || Array.isArray(storeLike)) return null;
      const migrated = migrateStore(cloneSerializable(storeLike));
      const sanitized = sanitizeStore(migrated);
      if (!sanitized) return null;
      return setStoreVersion(sanitized, STORE_VERSION);
    }

    async function readStoredStore(key) {
      const raw = await readPrimaryStoredValue(key);
      if (!raw) return null;
      try {
        return prepareStoreCandidate(JSON.parse(raw));
      } catch {
        const backupKey = `${key}_corrompido_${Date.now()}`;
        await writeStoredValue(backupKey, raw || '', 'Armazenamento cheio — não foi possível preservar backup do dado corrompido.');
        return null;
      }
    }

    async function loadStore() {
      const currentStore = await readStoredStore(STORAGE_KEY);
      if (currentStore) {
        await saveStore(currentStore, { silent: true, broadcast: false });
        return currentStore;
      }

      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyStore = await readStoredStore(legacyKey);
        if (legacyStore) {
          await saveStore(legacyStore, { silent: true, broadcast: false });
          return legacyStore;
        }
      }

      const defaultStore = getDefaultStore();
      await saveStore(defaultStore, { silent: true, broadcast: false });
      return defaultStore;
    }

    async function saveStore(storeLike, options = false) {
      const { silent, eventType, broadcast } = normalizePersistenceOptions(options, 'save');
      updatePersistenceTechState({
        status: 'sincronizando',
        broadcastAvailable: canUseStorageBroadcast()
      });
      try {
        const storeToSave = prepareStoreCandidate(storeLike) || getDefaultStore();
        const result = await persistStoredJson(
          STORAGE_KEY,
          storeToSave,
          'Armazenamento local cheio. Exporte um backup e limpe dados antigos em Configurações.'
        );
        if (!result.ok) {
          updatePersistenceTechState({
            status: 'erro',
            storeVersion: storeToSave.version || STORE_VERSION
          });
          return false;
        }
        await removeStoredValues(LEGACY_STORAGE_KEYS);
        if (broadcast) await emitStorageBroadcast(eventType);
        updatePersistenceTechState({
          status: 'pronto',
          lastSuccessAt: new Date().toISOString(),
          lastOperationType: eventType,
          storeVersion: storeToSave.version || STORE_VERSION,
          broadcastAvailable: canUseStorageBroadcast()
        });
        if (!silent) showSaveToast();
        return true;
      } catch (err) {
        console.error('Falha ao salvar store principal:', err);
        updatePersistenceTechState({
          status: 'erro',
          broadcastAvailable: canUseStorageBroadcast()
        });
        showToast('Não foi possível salvar os dados do aplicativo.', 'danger');
        return false;
      }
    }

    let saveToastTimer = null;

    function anunciarAoLeitor(message, prioridade = 'polite') {
      const id = prioridade === 'assertive' ? 'appLiveRegionUrgente' : 'appLiveRegion';
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = '';
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    }

    function showSaveToast(message = '✓ salvo automaticamente', duration = 1800) {
      const toast = document.getElementById('saveToast');
      if (!toast) return;
      toast.textContent = message;
      toast.setAttribute('aria-live', 'polite');
      toast.classList.add('show');
      anunciarAoLeitor(message, 'polite');
      clearTimeout(saveToastTimer);
      saveToastTimer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    // ─── showToast: toast tipado para feedback ao usuário ────────────────────────
    // type: 'success' (padrão gold), 'warning' (âmbar), 'danger' (vermelho), 'info' (cinza)
    function showToast(message, type = 'success', duration = 3200) {
      const toast = document.getElementById('saveToast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = 'save-toast' + (type !== 'success' ? ` save-toast--${type}` : '');
      toast.setAttribute('aria-live', type === 'danger' || type === 'warning' ? 'assertive' : 'polite');
      toast.classList.add('show');
      anunciarAoLeitor(message, type === 'danger' || type === 'warning' ? 'assertive' : 'polite');
      clearTimeout(saveToastTimer);
      saveToastTimer = setTimeout(() => {
        toast.classList.remove('show');
        saveToastTimer = setTimeout(() => { toast.className = 'save-toast'; }, 220);
      }, duration);
    }

    // ─── showConfirm: modal de confirmação visual assíncrono ─────────────────────
    let _confirmOk = null;
    let _confirmCancel = null;

    function showConfirm(message, onOk, onCancel) {
      const el = document.getElementById('confirmModalMsg');
      if (el) el.textContent = message;
      _confirmOk = onOk || null;
      _confirmCancel = onCancel || null;
      openModal('confirmModal');
    }

    function _resolveConfirm(accepted) {
      closeModal('confirmModal');
      const cb = accepted ? _confirmOk : _confirmCancel;
      _confirmOk = null;
      _confirmCancel = null;
      if (typeof cb === 'function') cb();
    }

    async function saveData(options = false) {
      try {
        storage.activePeriod = currentPeriodKey;
        storage.periods[currentPeriodKey] = state;
        limparCacheSelectores();
        return await saveStore(storage, options);
      } catch (err) {
        console.error('Falha crítica ao salvar dados:', err);
        showToast('Erro crítico ao salvar dados. Exporte um backup imediatamente.', 'danger', 6000);
        return false;
      }
    }

    async function consumeStorageBroadcast(rawValue) {
      if (!rawValue) return;
      updatePersistenceTechState({
        status: 'sincronizando',
        broadcastAvailable: canUseStorageBroadcast()
      });
      let payload = null;
      try {
        payload = JSON.parse(rawValue);
        if (!payload || typeof payload !== 'object') return;
      } catch {
        updatePersistenceTechState({ status: 'erro' });
        return;
      }

      // Sincronização receptora não persiste nem rebroadcasta; apenas recarrega
      // o store saneado da fonte principal e atualiza o estado/UI local.
      const nextStore = await readStoredStore(STORAGE_KEY);
      if (!nextStore) {
        updatePersistenceTechState({ status: 'erro' });
        return;
      }
      await syncAppState(nextStore);
      updatePersistenceTechState({
        status: 'pronto',
        lastSuccessAt: payload?.ts ? new Date(payload.ts).toISOString() : persistenceTechState.lastSuccessAt,
        lastOperationType: String(payload?.type || persistenceTechState.lastOperationType || 'save'),
        storeVersion: nextStore.version || STORE_VERSION,
        broadcastAvailable: canUseStorageBroadcast()
      });
      renderAll();
      syncPeriodControls();
      showSaveToast('✓ dados sincronizados de outra aba');
    }

    async function getCommittedStoreSnapshot(options = {}) {
      const persistCurrent = options?.persistCurrent === true;
      const eventType = String(options?.eventType || 'save');
      const broadcast = options?.broadcast === true;
      const candidate = prepareStoreCandidate(storage) || getDefaultStore();

      if (persistCurrent) {
        const saved = await saveStore(candidate, {
          silent: true,
          eventType,
          broadcast
        });
        if (!saved) throw new Error('Falha ao persistir o estado atual antes de gerar o backup.');
      }

      return await readStoredStore(STORAGE_KEY) || candidate;
    }

    function buildBackupPayloadFromStore(storeSnapshot) {
      // Export sempre parte do store saneado/commitado, sem chaves legadas nem
      // metadados transitórios de compatibilidade.
      return {
        meta: {
          kind: 'app-backup',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString()
        },
        version: storeSnapshot.version,
        activePeriod: storeSnapshot.activePeriod,
        periods: cloneSerializable(storeSnapshot.periods),
        archives: cloneSerializable(storeSnapshot.archives)
      };
    }

    function buildMonthArchivePayload(storeSnapshot, periodKey, periodLabel) {
      const period = cloneSerializable(storeSnapshot?.periods?.[periodKey] || state);
      normalizeData(period);
      return {
        meta: {
          kind: 'month-archive',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString()
        },
        version: storeSnapshot?.version || STORE_VERSION,
        periodKey,
        periodLabel,
        data: period
      };
    }

    async function runPersistenceSelfTest() {
      const tempKey = `${STORAGE_KEY}__selftest__${Date.now()}`;
      const tempValue = JSON.stringify({ probe: true, ts: Date.now() });
      updatePersistenceTechState({
        status: 'sincronizando',
        selfTest: {
          status: 'info',
          detail: 'Executando autoteste de persistência...'
        },
        broadcastAvailable: canUseStorageBroadcast()
      });

      try {
        const writeResult = await persistStoredValue(tempKey, tempValue, 'Não foi possível gravar o valor temporário do autoteste.');
        if (!writeResult.ok) throw new Error('Falha ao gravar o valor temporário.');

        const roundTrip = await readPrimaryStoredValue(tempKey, { updateCache: false });
        if (roundTrip !== tempValue) throw new Error('Leitura divergente após a gravação de teste.');

        const removed = await removeStoredValue(tempKey);
        if (!removed) throw new Error('Falha ao remover o valor temporário.');

        updatePersistenceTechState({
          status: 'pronto',
          selfTest: {
            status: 'ok',
            detail: 'Valor temporário gravado, lido e removido com sucesso.'
          },
          broadcastAvailable: canUseStorageBroadcast()
        });
        showToast('Autoteste de persistência concluído com sucesso.', 'success');
        return true;
      } catch (err) {
        await removeStoredValue(tempKey).catch(() => false);
        updatePersistenceTechState({
          status: 'erro',
          selfTest: {
            status: 'bad',
            detail: err?.message || 'Falha desconhecida no autoteste de persistência.'
          },
          broadcastAvailable: canUseStorageBroadcast()
        });
        showToast('Autoteste de persistência falhou.', 'danger');
        return false;
      }
    }

    function shortText(value, max = 120) {
      const text = String(value ?? '').trim();
      return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text;
    }

    function isNonEmptyString(value) {
      return String(value ?? '').trim().length > 0;
    }

    function isValidNumber(value) {
      const normalized = Number(value);
      return Number.isFinite(normalized);
    }

    function isPositiveNumber(value) {
      return isValidNumber(value) && Number(value) > 0;
    }

    function isValidDateValue(value) {
      if (!isNonEmptyString(value)) return false;
      const timestamp = new Date(`${String(value).trim()}T00:00:00`).getTime();
      return Number.isFinite(timestamp);
    }

    function createValidationResult() {
      return {
        isValid: true,
        errors: {}
      };
    }

    function normalizeNumericId(value) {
      return String(value ?? '').replace(/\D+/g, '');
    }

    function validateStudent(data) {
      const result = createValidationResult();
      if (isNonEmptyString(data.rawMatricula) && data.matricula !== data.rawMatricula) {
        result.isValid = false;
        result.errors.matricula = 'O número da matrícula deve conter apenas dígitos.';
      }
      if (!isNonEmptyString(data.nome)) {
        result.isValid = false;
        result.errors.nome = 'Preencha ao menos o nome do aluno.';
      }
      return result;
    }

    function validatePending(data) {
      const result = createValidationResult();
      if (isNonEmptyString(data.rawMatricula) && data.matricula !== data.rawMatricula) {
        result.isValid = false;
        result.errors.matricula = 'O número da matrícula deve conter apenas dígitos.';
      }
      if (!isNonEmptyString(data.nome) || !isNonEmptyString(data.pendencia)) {
        result.isValid = false;
        result.errors.required = 'Preencha ao menos nome e pendência.';
      }
      if (isNonEmptyString(data.data) && isValidDateValue(data.data) && !isDateInActivePeriod(data.data)) {
        result.isValid = false;
        result.errors.data = `A data da pendência deve pertencer a ${getPeriodLabel()}.`;
      }
      return result;
    }

    function getStudentFormData() {
      const rawMatricula = DOM.value('student_matricula').trim();
      const matricula = normalizeNumericId(rawMatricula);
      return {
        id: editingStudentId || crypto.randomUUID(),
        nome: DOM.value('student_nome').trim(),
        rawMatricula,
        matricula,
        ultimaVisita: DOM.value('student_ultimaVisita'),
        horaVisita: DOM.value('student_horaVisita'),
        inicio: DOM.value('student_inicio'),
        avisoNps: DOM.value('student_avisoNps'),
        atendimento: DOM.value('student_atendimento'),
        feedback: DOM.value('student_feedback'),
        addon: DOM.value('student_addon'),
        observacoes: DOM.value('student_observacoes').trim()
      };
    }

    function getPendingFormData() {
      const rawMatricula = DOM.value('pending_matricula').trim();
      const matricula = normalizeNumericId(rawMatricula);
      return {
        id: editingPendingId || crypto.randomUUID(),
        nome: DOM.value('pending_nome').trim(),
        rawMatricula,
        matricula,
        pendencia: DOM.value('pending_desc').trim(),
        data: DOM.value('pending_data'),
        hostess: DOM.value('pending_hostess'),
        resposta: DOM.value('pending_resposta').trim(),
        status: DOM.value('pending_status')
      };
    }

    function buildStudentEntity(formData, existingStudent) {
      return {
        id: existingStudent?.id || formData.id,
        nome: formData.nome,
        matricula: formData.matricula,
        ultimaVisita: formData.ultimaVisita,
        horaVisita: formData.horaVisita,
        inicio: formData.inicio,
        avisoNps: formData.avisoNps,
        atendimento: formData.atendimento,
        feedback: formData.feedback,
        addon: formData.addon,
        observacoes: formData.observacoes
      };
    }

    function buildPendingEntity(formData, existingPending) {
      return {
        id: existingPending?.id || formData.id,
        nome: formData.nome,
        matricula: formData.matricula,
        pendencia: formData.pendencia,
        data: formData.data,
        hostess: formData.hostess,
        resposta: formData.resposta,
        status: formData.status
      };
    }

    function upsertStudent(store, student) {
      const idx = store.students.findIndex(item => item.id === student.id);
      const students = idx >= 0
        ? store.students.map((item, index) => index === idx ? student : item)
        : [student, ...store.students];
      return {
        ...store,
        students
      };
    }

    function upsertPending(store, pending) {
      const idx = store.pending.findIndex(item => item.id === pending.id);
      const pendingItems = idx >= 0
        ? store.pending.map((item, index) => index === idx ? pending : item)
        : [pending, ...store.pending];
      return {
        ...store,
        pending: pendingItems
      };
    }

    function createValidationFailureResult(validation) {
      return { ok: false, validation };
    }

    function createSaveSuccessResult(nextState, entity) {
      return { ok: true, nextState, entity };
    }

    function applyStudentSave(store, formData, existingStudent) {
      const validation = validateStudent(formData);
      if (!validation.isValid) {
        return createValidationFailureResult(validation);
      }
      const entity = buildStudentEntity(formData, existingStudent);
      const nextState = upsertStudent(store, entity);
      return createSaveSuccessResult(nextState, entity);
    }

    function applyPendingSave(store, formData, existingPending) {
      const validation = validatePending(formData);
      if (!validation.isValid) {
        return createValidationFailureResult(validation);
      }
      const entity = buildPendingEntity(formData, existingPending);
      const nextState = upsertPending(store, entity);
      return createSaveSuccessResult(nextState, entity);
    }

    function getEventFormData() {
      return {
        id: editingEventId || crypto.randomUUID(),
        date: DOM.value('event_date'),
        time: DOM.value('event_time'),
        type: DOM.value('event_type'),
        title: DOM.value('event_title').trim(),
        place: DOM.value('event_place').trim(),
        owner: DOM.value('event_owner').trim(),
        status: DOM.value('event_status'),
        description: DOM.value('event_description').trim()
      };
    }

    function getScaleFormData() {
      return {
        id: editingScaleId || crypto.randomUUID(),
        date: DOM.value('scale_date'),
        rowTone: DOM.value('scale_tone'),
        receptionTime: DOM.value('scale_receptionTime').trim(),
        receptionist: DOM.value('scale_receptionist').trim(),
        receptionSwap: DOM.value('scale_receptionSwap').trim(),
        note: DOM.value('scale_note').trim(),
        professorShifts: scaleShiftDrafts
          .map(shift => ({
            id: crypto.randomUUID(),
            time: String(shift.time || '').trim(),
            name: String(shift.name || '').trim(),
            swap: String(shift.swap || '').trim()
          }))
          .filter(shift => shift.time || shift.name || shift.swap)
      };
    }

    function getSettingsFormData() {
      return {
        receptionists: [...new Set(DOM.value('receptionistEditor').split('\n').map(v => v.trim()).filter(Boolean))],
        professors: [...new Set(DOM.value('professorEditor').split('\n').map(v => v.trim()).filter(Boolean))],
        addonTypes: [...new Set(DOM.value('addonTypeEditor').split('\n').map(v => v.trim()).filter(Boolean))]
      };
    }

    function getMentionDraft() {
      return {
        name: DOM.value('npsMentionName').trim(),
        count: Math.max(1, Number(DOM.value('npsMentionCount', 1) || 1))
      };
    }

    function getNpsObservationsDraft() {
      return DOM.value('npsObservations').trim();
    }

    function validateEvent(data) {
      const result = createValidationResult();
      if (!isNonEmptyString(data.date) || !isNonEmptyString(data.title)) {
        result.isValid = false;
        result.errors.required = 'Preencha ao menos data e título.';
      }
      if (isNonEmptyString(data.date) && !isDateInActivePeriod(data.date)) {
        result.isValid = false;
        result.errors.date = `A data do evento/ação deve pertencer a ${getPeriodLabel()}.`;
      }
      return result;
    }

    function buildEventEntity(formData, existingEvent) {
      return {
        id: existingEvent?.id || formData.id,
        date: formData.date,
        time: formData.time,
        type: formData.type,
        title: formData.title,
        place: formData.place,
        owner: formData.owner,
        status: formData.status,
        description: formData.description
      };
    }

    function upsertEvent(store, eventItem) {
      const idx = store.events.findIndex(item => item.id === eventItem.id);
      const events = idx >= 0
        ? store.events.map((item, index) => index === idx ? eventItem : item)
        : [...store.events, eventItem];
      return {
        ...store,
        events: events.slice().sort(compareByDateTime)
      };
    }

    function applyEventSave(store, formData, existingEvent) {
      const validation = validateEvent(formData);
      if (!validation.isValid) {
        return createValidationFailureResult(validation);
      }
      const entity = buildEventEntity(formData, existingEvent);
      const nextState = upsertEvent(store, entity);
      return createSaveSuccessResult(nextState, entity);
    }

    function slugify(value) {
      return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
    }

    function renderEllipsisCell(value, fallback = '-') {
      const text = String(value ?? '').trim();
      if (!text) return `<span class="muted">${esc(fallback)}</span>`;
      return `<span class="cell-text multiline" data-tooltip="${esc(text)}">${esc(text)}</span>`;
    }

    // ══════════════════════════════════════════
    // CAMADA DE DADOS — normalizeData, esc, clamp, todayISO, normalizeSearchText, getReceptionists, getAllEmployees
    // ══════════════════════════════════════════

    function normalizeData(data) {
      data.settings ||= { team: [], addonTypes: [], monthDays: 31, receptionists: [], professors: [] };
      data.settings.receptionists ||= data.settings.team || [];
      data.settings.professors ||= [];
      if (!data.settings.receptionists.length) data.settings.receptionists = [...APP_DEFAULTS.receptionists];
      if (!data.settings.professors.length) data.settings.professors = [...APP_DEFAULTS.professors];
      data.settings.team = [...new Set((data.settings.team?.length ? data.settings.team : data.settings.receptionists).filter(Boolean))];
      data.settings.receptionists = [...new Set(data.settings.receptionists.filter(Boolean))];
      data.settings.professors = [...new Set(data.settings.professors.filter(Boolean))];
      data.settings.addonTypes ||= [...APP_DEFAULTS.addonTypes];
      data.settings.monthDays ||= 31;
      data.students ||= [];
      data.pending ||= [];
      data.recados = normalizeRecadosCollection(data.recados);
      data.scale = Array.isArray(data.scale) ? data.scale : Array.isArray(data.escala) ? data.escala : [];
      data.events = Array.isArray(data.events) ? data.events : Array.isArray(data.eventos) ? data.eventos : [];
      data.addons ||= {};
      data.nps ||= {};
      data.nps.score = clamp(Number(data.nps.score ?? 0), 0, 100);
      data.nps.monthlyGoal = clamp(Number(data.nps.monthlyGoal ?? 75), 0, 100);
      data.nps.semesterGoal = clamp(Number(data.nps.semesterGoal ?? 80), 0, 100);
      data.nps.observations ||= '';
      data.nps.mentions = Array.isArray(data.nps.mentions) ? data.nps.mentions : [];
      data.nps.rankSnapshot ||= {};

      data.students = data.students.map(student => ({
        id: student.id || crypto.randomUUID(),
        nome: student.nome || '',
        matricula: normalizeNumericId(student.matricula),
        ultimaVisita: student.ultimaVisita || '',
        horaVisita: student.horaVisita || student.horario || '',
        inicio: student.inicio || '',
        avisoNps: student.avisoNps || 'Sim',
        atendimento: student.atendimento || data.settings.team[0] || '',
        feedback: student.feedback || 'Pendente',
        addon: student.addon || '',
        observacoes: student.observacoes || ''
      }));

      data.pending = data.pending.map(item => ({
        id: item.id || crypto.randomUUID(),
        nome: item.nome || '',
        matricula: normalizeNumericId(item.matricula),
        pendencia: item.pendencia || '',
        data: item.data || '',
        hostess: item.hostess || data.settings.team[0] || '',
        resposta: item.resposta || '',
        status: item.status || 'aberto'
      }));

      data.scale = data.scale.map(item => {
        const shifts = Array.isArray(item.professorShifts) ? item.professorShifts : Array.isArray(item.professores) ? item.professores : [];
        return {
          id: item.id || crypto.randomUUID(),
          date: item.date || item.data || '',
          rowTone: ['green','red','neutral'].includes(item.rowTone) ? item.rowTone : (['green','red','neutral'].includes(item.tone) ? item.tone : 'neutral'),
          professorShifts: (shifts.length ? shifts : [{ time: item.professorTime || item.horarioProfessor || '', name: item.professor || '', swap: item.professorSwap || item.trocaProfessor || '' }]).map(shift => ({
            id: shift.id || crypto.randomUUID(),
            time: shift.time || shift.horario || '',
            name: shift.name || shift.nome || '',
            swap: shift.swap || shift.troca || ''
          })),
          receptionTime: item.receptionTime || item.horarioRecepcao || '',
          receptionist: item.receptionist || item.recepcionista || '',
          receptionSwap: item.receptionSwap || item.trocaRecepcao || '',
          note: item.note || item.observacao || ''
        };
      }).filter(item => item.date);

      data.events = data.events.map(item => ({
        id: item.id || crypto.randomUUID(),
        date: item.date || item.data || '',
        time: item.time || item.hora || '',
        type: item.type || item.tipo || 'Evento',
        title: item.title || item.titulo || '',
        place: item.place || item.local || '',
        owner: item.owner || item.responsavel || '',
        status: item.status || item.situacao || 'Programado',
        description: item.description || item.descricao || ''
      })).filter(item => item.date || item.title);

      data.nps.mentions = data.nps.mentions.map(item => ({
        id: item.id || crypto.randomUUID(),
        name: item.name || item.nome || '',
        count: Math.max(0, Number(item.count || item.citacoes || 0))
      })).filter(item => item.name);

      hydrateLegacyAddonsFromStudents(data);

      getAddonPeople(data).forEach(person => {
        data.addons[person] ||= {};
        const knownTypes = [...new Set([...(data.settings.addonTypes || APP_DEFAULTS.addonTypes), ...Object.keys(data.addons[person] || {})])];
        knownTypes.forEach(type => {
          const arr = data.addons[person][type] || [];
          data.addons[person][type] = Array.from({ length: data.settings.monthDays }, (_, i) => Number(arr[i] || 0));
        });
      });
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }

    let storage;
    let currentPeriodKey;
    let state;
    // ══════════════════════════════════════════
    // GESTÃO DE PERÍODO — getPeriodLabel, ensurePeriod, syncPeriodControls, switchPeriod, closeCurrentMonth, resetSelectedMonth
    // ══════════════════════════════════════════

    let editingStudentId = null;
    let editingPendingId = null;
    let editingScaleId = null;
    let editingEventId = null;
    let scaleShiftDrafts = [];
    let npsObservationsDebounce = null;
    const estadoEventos = {
      uiDelegadaInicializada: false,
      atalhosGlobaisInicializados: false,
      sincronizacaoStorageInicializada: false,
      controlesEstaticosInicializados: false,
      tooltipInicializado: false,
      dndPendenciasInicializado: false,
      acessibilidadeInicializada: false,
      navegacaoAbasInicializada: false,
      modaisInicializados: false,
      formulariosInicializados: false
    };
    const estadoAcessibilidade = {
      focoRetornoModal: {},
      pendenciaFocadaId: null,
      pendenciaFocoPendente: null
    };
    let tooltipAlvoAtual = null;

    function getPeriodLabel(key = currentPeriodKey) {
      const [year, month] = String(key).split('-');
      const monthIndex = Math.max(0, Number(month || 1) - 1);
      return `${MONTH_NAMES[monthIndex] || month}/${year}`;
    }

    function getNextPeriodKey(key = currentPeriodKey) {
      const [yearStr, monthStr] = String(key).split('-');
      const dt = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      dt.setMonth(dt.getMonth() + 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }
    function getPreviousPeriodKey(key = currentPeriodKey) {
      const [yearStr, monthStr] = String(key).split('-');
      const dt = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      dt.setMonth(dt.getMonth() - 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }

    const LOCKED_CURRENT_PERIOD_ACTIONS = new Set([
      'close-current-month',
      'reset-selected-month',
      'open-student-modal',
      'open-pending-modal',
      'add-person',
      'register-mention',
      'save-nps-observations',
      'open-scale-modal',
      'duplicate-previous-month-scale',
      'open-event-modal',
      'save-settings',
      'restore-local-snapshot',
      'reset-demo-data',
      'save-student',
      'save-pending',
      'save-scale-day',
      'save-event-item',
      'edit-student',
      'remove-student',
      'edit-pending',
      'remove-pending',
      'adjust-mention',
      'remove-mention',
      'edit-scale-day',
      'remove-scale-day',
      'edit-event-item',
      'duplicate-event-item',
      'remove-event-item'
    ]);
    const LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS = new Set(['update-student-inline', 'update-addon', 'set-mention-count']);
    const LOCKED_CURRENT_PERIOD_INPUT_ACTIONS = new Set(['update-nps-score', 'update-nps-goal']);
    const LOCKED_CURRENT_PERIOD_BLUR_ACTIONS = new Set(['rename-person', 'rename-mention']);
    const LOCKED_CURRENT_PERIOD_CONTROL_IDS = [
      'monthDaysSelector',
      'importFile',
      'receptionistEditor',
      'professorEditor',
      'addonTypeEditor',
      'recadoFrom',
      'recadoTo',
      'recadoMessage',
      'student_nome',
      'student_matricula',
      'student_ultimaVisita',
      'student_horaVisita',
      'student_inicio',
      'student_avisoNps',
      'student_atendimento',
      'student_feedback',
      'student_addon',
      'student_observacoes',
      'pending_nome',
      'pending_matricula',
      'pending_hostess',
      'pending_data',
      'pending_status',
      'pending_desc',
      'pending_resposta',
      'npsMentionName',
      'npsMentionCount',
      'npsObservations',
      'scale_date',
      'scale_tone',
      'scale_receptionTime',
      'scale_receptionist',
      'scale_receptionSwap',
      'scale_note',
      'event_date',
      'event_time',
      'event_type',
      'event_status',
      'event_title',
      'event_place',
      'event_owner',
      'event_description'
    ];

    function isPeriodLocked(key = currentPeriodKey) {
      return Boolean(storage?.archives?.[String(key || '')]);
    }

    function isCurrentPeriodLocked() {
      return isPeriodLocked(currentPeriodKey);
    }

    function getCurrentPeriodLockMessage(key = currentPeriodKey) {
      return `${getPeriodLabel(key)} está fechado. Ação bloqueada.`;
    }

    function canMutateCurrentPeriod(options = {}) {
      if (!isCurrentPeriodLocked()) return true;
      const rerenderTargets = normalizarAlvosRender(options?.rerender || []);
      if (rerenderTargets.length) requestRender(rerenderTargets);
      if (!options?.silent) {
        showToast(options?.message || getCurrentPeriodLockMessage(), 'warning');
      }
      return false;
    }

    function assertWritableCurrentPeriod(options = {}) {
      return canMutateCurrentPeriod(options);
    }

    function syncCurrentPeriodLockUI() {
      const locked = isCurrentPeriodLocked();
      const hint = locked ? `${getPeriodLabel()} fechado. Somente leitura.` : '';

      const syncDisableState = control => {
        if (!control) return;
        if (control.dataset.historicalReadonly === 'true') {
          if ('disabled' in control) control.disabled = true;
          control.setAttribute('aria-disabled', 'true');
          return;
        }
        if ('disabled' in control) control.disabled = locked;
        control.setAttribute('aria-disabled', String(locked));
        if (locked) {
          if (!('lockHint' in control.dataset)) {
            control.dataset.lockHint = control.getAttribute('title') || '';
          }
          if (hint) control.setAttribute('title', hint);
        } else if ('lockHint' in control.dataset) {
          const previousTitle = control.dataset.lockHint;
          if (previousTitle) control.setAttribute('title', previousTitle);
          else control.removeAttribute('title');
          delete control.dataset.lockHint;
        }
      };

      document.querySelectorAll('[data-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_ACTIONS.has(control.dataset.action)) return;
        syncDisableState(control);
      });

      document.querySelectorAll('[data-change-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS.has(control.dataset.changeAction)) return;
        syncDisableState(control);
      });

      document.querySelectorAll('[data-input-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_INPUT_ACTIONS.has(control.dataset.inputAction)) return;
        syncDisableState(control);
      });

      document.querySelectorAll('[data-blur-action]').forEach(control => {
        if (!LOCKED_CURRENT_PERIOD_BLUR_ACTIONS.has(control.dataset.blurAction)) return;
        if (control.dataset.blurAction === 'rename-person') {
          control.contentEditable = locked ? 'false' : 'true';
          control.setAttribute('aria-disabled', String(locked));
          if (locked) {
            control.setAttribute('tabindex', '-1');
            if (!('lockHint' in control.dataset)) {
              control.dataset.lockHint = control.getAttribute('title') || '';
            }
            if (hint) control.setAttribute('title', hint);
          } else {
            control.removeAttribute('tabindex');
            if ('lockHint' in control.dataset) {
              const previousTitle = control.dataset.lockHint;
              if (previousTitle) control.setAttribute('title', previousTitle);
              else control.removeAttribute('title');
              delete control.dataset.lockHint;
            }
          }
          return;
        }
        syncDisableState(control);
      });

      LOCKED_CURRENT_PERIOD_CONTROL_IDS.forEach(id => {
        syncDisableState(document.getElementById(id));
      });

      const recadoSubmit = document.querySelector('#recadosForm button[type="submit"]');
      syncDisableState(recadoSubmit);

      document.querySelectorAll('[data-recado-action]').forEach(control => {
        syncDisableState(control);
      });

      document.querySelectorAll('#pendingKanban [data-pending-id]').forEach(card => {
        card.draggable = !locked;
        card.setAttribute('aria-disabled', String(locked));
      });
    }

    function periodHasMeaningfulData(period) {
      if (!period) return false;
      return Boolean(
        period.recados?.length ||
        period.students?.length ||
        period.pending?.length ||
        period.scale?.length ||
        period.events?.length ||
        period.nps?.score ||
        period.nps?.observations ||
        period.nps?.mentions?.length ||
        Object.values(period.addons || {}).some(group => Object.values(group || {}).some(days => (days || []).some(value => Number(value || 0) > 0)))
      );
    }

    function formatScaleBoardDay(dateStr) {
      if (!dateStr) return { day: '—', month: getPeriodLabel(), weekday: '' };
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return { day: '—', month: getPeriodLabel(), weekday: '' };
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(dt.getTime())) return { day: '—', month: getPeriodLabel(), weekday: '' };
      return {
        day: String(dt.getDate()).padStart(2, '0'),
        month: MONTH_NAMES[dt.getMonth()],
        weekday: getWeekdayLabel(dateStr)
      };
    }

    function ensurePeriod(key, template = state) {
      if (!storage.periods[key]) {
        storage.periods[key] = buildEmptyPeriodFromTemplate(template || demoData, key);
      }
      normalizeData(storage.periods[key]);
      return storage.periods[key];
    }

    function syncPeriodControls() {
      const monthSelect = document.getElementById('periodMonthSelect');
      const yearInput = document.getElementById('periodYearInput');
      const badge = document.getElementById('monthStatusBadge');
      if (!monthSelect || !yearInput || !badge) return;
      const [year, month] = currentPeriodKey.split('-');
      monthSelect.value = String(Number(month));
      yearInput.value = year;
      const archive = storage.archives[currentPeriodKey];
      badge.textContent = archive ? `✕ Fechado em ${archive.closedAtLabel}` : '● Mês em andamento';
      badge.classList.toggle('closed', !!archive);
      badge.classList.toggle('active', !archive);
      const closeBtn = document.getElementById('closeMonthBtn');
      if (closeBtn) closeBtn.disabled = !!archive;
      syncCurrentPeriodLockUI();
    }

    async function switchPeriod(key, options = {}) {
      const normalizedKey = String(key);
      ensurePeriod(normalizedKey);
      currentPeriodKey = normalizedKey;
      storage.activePeriod = normalizedKey;
      state = storage.periods[normalizedKey];
      const saved = await saveData(true);
      renderAll();
      syncPeriodControls();
      if (!options.silent && saved) showSaveToast(`✓ período ativo: ${getPeriodLabel(normalizedKey)}`);
    }

    function changePeriodFromControls() {
      const month = String(document.getElementById('periodMonthSelect').value || '1').padStart(2, '0');
      const year = String(document.getElementById('periodYearInput').value || new Date().getFullYear());
      switchPeriod(`${year}-${month}`);
    }

    function closeCurrentMonth() {
      if (!assertWritableCurrentPeriod({ message: `${getPeriodLabel()} já está fechado.` })) return;
      const currentLabel = getPeriodLabel(currentPeriodKey);
      showConfirm(`Fechar ${currentLabel} e abrir o próximo mês? O arquivo de fechamento será baixado automaticamente.`, async () => {
        const committedStore = await getCommittedStoreSnapshot({
          persistCurrent: true,
          eventType: 'close-month-backup',
          broadcast: false
        });
        const archivePayload = buildMonthArchivePayload(committedStore, currentPeriodKey, currentLabel);
        const blob = new Blob([JSON.stringify(archivePayload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `smartfit-fechamento-${currentPeriodKey}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);

        // Marca como fechado SÓ após o download ser disparado
        const previousArchive = storage.archives[currentPeriodKey];
        storage.archives[currentPeriodKey] = {
          closedAt: new Date().toISOString(),
          closedAtLabel: new Date().toLocaleString('pt-BR'),
          label: currentLabel
        };

        const nextKey = getNextPeriodKey(currentPeriodKey);
        const nextPeriod = storage.periods[nextKey];

        const finishClose = async (resetNextPeriod) => {
          if (resetNextPeriod) resetPeriodData(nextKey, state);
          else ensurePeriod(nextKey, state);
          const saved = await saveData(true);
          if (!saved) {
            // Rollback do archive em caso de falha
            if (previousArchive) storage.archives[currentPeriodKey] = previousArchive;
            else delete storage.archives[currentPeriodKey];
            showToast('Falha ao fechar o mês. Tente novamente.', 'danger');
            return;
          }
          await switchPeriod(nextKey, { silent: true });
          const nextMessage = resetNextPeriod
            ? `${getPeriodLabel(nextKey)} iniciado com dados zerados.`
            : `${getPeriodLabel(nextKey)} aberto preservando os dados existentes.`;
          showToast(`✓ ${currentLabel} fechado. ${nextMessage}`, 'success', 4500);
        };

        if (periodHasMeaningfulData(nextPeriod)) {
          showConfirm(
            `${getPeriodLabel(nextKey)} já possui dados. Confirmar = zerar e iniciar limpo. Cancelar = manter dados existentes.`,
            () => finishClose(true),
            () => finishClose(false)
          );
        } else {
          finishClose(true);
        }
      });
    }

    async function resetSelectedMonth() {
      if (!assertWritableCurrentPeriod({ message: `${getPeriodLabel()} está fechado e não pode ser resetado.` })) return;
      const label = getPeriodLabel(currentPeriodKey);
      await downloadData();
      showConfirm(`Deseja resetar o mês ${label}? Um backup completo foi gerado antes desta operação. Todos os atendimentos, pendências, escala, eventos, NPS e addons serão apagados. As configurações de equipe e tipos de addon serão preservadas.`, async () => {
        resetPeriodData(currentPeriodKey, state);
        state = storage.periods[currentPeriodKey];
        const saved = await saveData({ eventType: 'reset' });
        renderAll();
        syncPeriodControls();
        if (saved) showToast(`✓ Mês ${label} resetado — pronto para novos registros.`, 'success');
      });
    }

    function duplicatePreviousMonthScale() {
      if (!assertWritableCurrentPeriod()) return;
      const previousKey = getPreviousPeriodKey(currentPeriodKey);
      const previous = storage.periods[previousKey];
      if (!previous || !Array.isArray(previous.scale) || !previous.scale.length) {
        return showToast(`Não há escala cadastrada em ${getPeriodLabel(previousKey)} para duplicar.`, 'warning');
      }
      const doDuplicate = async () => {
        const [targetYear, targetMonth] = String(currentPeriodKey).split('-');
        const targetMonthDays = new Date(Number(targetYear), Number(targetMonth), 0).getDate();
        let skippedDays = 0;

        state.scale = structuredClone(previous.scale).reduce((list, item) => {
          const parts = String(item?.date || '').split('-');
          const day = Number(parts[2]);
          if (!Number.isInteger(day) || day < 1 || day > targetMonthDays) {
            skippedDays += 1;
            return list;
          }
          list.push({
            ...item,
            id: crypto.randomUUID(),
            date: `${currentPeriodKey}-${String(day).padStart(2, '0')}`,
            professorShifts: (item.professorShifts || []).map(shift => ({ ...shift, id: crypto.randomUUID() }))
          });
          return list;
        }, []);

        state.scale.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        const saved = await saveData();
        requestRender(['scale', 'dashboard']);
        if (!saved) return;
        const skippedMessage = skippedDays
          ? ` ${skippedDays} dia(s) excedente(s) foram ignorados por não existirem em ${getPeriodLabel()}.`
          : '';
        showToast(`✓ Escala de ${getPeriodLabel(previousKey)} duplicada para ${getPeriodLabel()}.${skippedMessage}`, 'success');
      };
      if (state.scale.length) {
        showConfirm(`A escala atual de ${getPeriodLabel()} será substituída pela escala de ${getPeriodLabel(previousKey)}. Deseja continuar?`, doDuplicate);
      } else {
        doDuplicate();
      }
    }

    function openModal(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      estadoAcessibilidade.focoRetornoModal[id] = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const destino = modal.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])') || modal.querySelector('.modal-content');
      destino?.focus({ preventScroll: true });
    }

    function closeModal(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      const modalAberto = document.querySelector('.modal.show');
      if (!modalAberto) {
        document.body.style.overflow = '';
        const retorno = estadoAcessibilidade.focoRetornoModal[id];
        if (retorno && retorno.isConnected) retorno.focus({ preventScroll: true });
      } else {
        modalAberto.querySelector('.modal-content')?.focus({ preventScroll: true });
      }
    }
    function openStudentModal() { clearStudentForm(); openModal('studentModal'); }
    function openPendingModal() { clearPendingForm(); openModal('pendingModal'); }

    // ══════════════════════════════════════════
    // VINCULAÇÃO DE EVENTOS — bindUIEvents, initUIBindings, applyUIStateToControls
    // ══════════════════════════════════════════

    function bindUIEvents() {
      if (estadoEventos.uiDelegadaInicializada) return;
      estadoEventos.uiDelegadaInicializada = true;

      document.addEventListener('click', e => {
        const tabButton = e.target.closest('.tab-btn');
        if (tabButton) {
          setActiveTab(tabButton.dataset.tab);
          return;
        }

        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        switch (actionEl.dataset.action) {
          case 'reset-selected-month':
            resetSelectedMonth();
            break;
          case 'close-current-month':
            closeCurrentMonth();
            break;
          case 'open-student-modal':
            openStudentModal();
            break;
          case 'open-pending-modal':
            openPendingModal();
            break;
          case 'download-data':
            downloadData();
            break;
          case 'add-person':
            addPerson();
            break;
          case 'export-pending-csv':
            exportPendingCsv();
            break;
          case 'register-mention':
            registerMention();
            break;
          case 'save-nps-observations':
            clearTimeout(npsObservationsDebounce);
            saveNpsObservations();
            break;
          case 'reset-view-filters':
            resetViewFilters(actionEl.dataset.view);
            break;
          case 'export-scale-csv':
            exportScaleCsv();
            break;
          case 'open-scale-modal':
            openScaleModal();
            break;
          case 'duplicate-previous-month-scale':
            duplicatePreviousMonthScale();
            break;
          case 'export-events-csv':
            exportEventsCsv();
            break;
          case 'open-event-modal':
            openEventModal();
            break;
          case 'save-settings':
            saveSettings();
            break;
          case 'reset-demo-data':
            resetDemoData();
            break;
          case 'save-local-snapshot':
            saveLocalSnapshot();
            break;
          case 'restore-local-snapshot':
            restoreLocalSnapshot();
            break;
          case 'clear-empty-months':
            clearEmptyMonths();
            break;
          case 'run-system-diagnostics':
            runSystemDiagnostics(actionEl.dataset.silent === 'true');
            break;
          case 'run-persistence-self-test':
            runPersistenceSelfTest();
            break;
          case 'run-flow-smoke-tests':
            runFlowSmokeTests(actionEl.dataset.silent === 'true');
            break;
          case 'clear-flow-smoke-tests':
            clearFlowSmokeTests();
            break;
          case 'confirm-ok':
            _resolveConfirm(true);
            break;
          case 'confirm-cancel':
            _resolveConfirm(false);
            break;
          case 'close-modal':
            closeModal(actionEl.dataset.modalId);
            break;
          case 'save-student':
            saveStudent();
            break;
          case 'save-pending':
            savePending();
            break;
          case 'add-scale-shift-row':
            addScaleShiftRow();
            break;
          case 'save-scale-day':
            saveScaleDay();
            break;
          case 'save-event-item':
            saveEventItem();
            break;
          case 'set-active-tab':
            setActiveTab(actionEl.dataset.tabTarget);
            break;
          case 'edit-student':
            editStudent(actionEl.dataset.id);
            break;
          case 'remove-student':
            removeStudent(actionEl.dataset.id);
            break;
          case 'edit-pending':
            editPending(actionEl.dataset.id);
            break;
          case 'remove-pending':
            removePending(actionEl.dataset.id);
            break;
          case 'adjust-mention':
            adjustMention(actionEl.dataset.id, Number(actionEl.dataset.delta || 0));
            break;
          case 'remove-mention':
            removeMention(actionEl.dataset.id);
            break;
          case 'remove-scale-shift-row':
            removeScaleShiftRow(Number(actionEl.dataset.index || -1));
            break;
          case 'edit-scale-day':
            editScaleDay(actionEl.dataset.id);
            break;
          case 'remove-scale-day':
            removeScaleDay(actionEl.dataset.id);
            break;
          case 'edit-event-item':
            editEventItem(actionEl.dataset.id);
            break;
          case 'duplicate-event-item':
            duplicateEventItem(actionEl.dataset.id);
            break;
          case 'remove-event-item':
            removeEventItem(actionEl.dataset.id);
            break;
          default:
            break;
        }
      });

      document.addEventListener('change', e => {
        limparErroValidacaoCampo(e.target);
        const target = e.target.closest('[data-change-action]');
        if (!target) return;

        switch (target.dataset.changeAction) {
          case 'update-student-inline':
            updateStudentInline(target.dataset.id, target.dataset.field, e.target.value);
            break;
          case 'update-addon':
            updateAddon(target.dataset.person, target.dataset.addonType, Number(target.dataset.index || 0), e.target.value);
            break;
          case 'set-mention-count':
            setMentionCount(target.dataset.id, e.target.value);
            break;
          default:
            break;
        }
      });

      document.addEventListener('input', e => {
        limparErroValidacaoCampo(e.target);
        const inputEscala = e.target.closest('[data-scale-shift]');
        if (inputEscala) {
          const idx = Number(inputEscala.dataset.index);
          const field = inputEscala.dataset.scaleShift;
          if (scaleShiftDrafts[idx]) {
            scaleShiftDrafts[idx][field] = e.target.value;
          }
          return;
        }

        const target = e.target.closest('[data-input-action]');
        if (!target) return;

        switch (target.dataset.inputAction) {
          case 'update-nps-score':
            updateNpsScore(e.target.value, target.dataset.source);
            break;
          case 'update-nps-goal':
            updateNpsGoal(target.dataset.field, e.target.value);
            break;
          default:
            break;
        }
      });

      document.addEventListener('focusout', e => {
        const target = e.target.closest('[data-blur-action]');
        if (!target) return;

        switch (target.dataset.blurAction) {
          case 'rename-person':
            renamePerson(target.dataset.person, e.target.textContent);
            break;
          case 'rename-mention':
            renameMention(target.dataset.id, e.target.value);
            break;
          default:
            break;
        }
      });
    }

    function obterElementosFocaveis(raiz) {
      if (!raiz) return [];
      return [...raiz.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.hidden && !el.closest('[hidden]'));
    }

    function obterModalAtivo() {
      const modais = [...document.querySelectorAll('.modal.show')];
      return modais[modais.length - 1] || null;
    }

    function limparErroValidacaoCampo(elemento) {
      if (!(elemento instanceof HTMLElement)) return;
      elemento.removeAttribute('aria-invalid');
      if (elemento.getAttribute('aria-describedby') === 'appValidationFeedback') {
        elemento.removeAttribute('aria-describedby');
      }
      if (typeof elemento.setCustomValidity === 'function') {
        elemento.setCustomValidity('');
      }
    }

    function limparErrosValidacao(ids = []) {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) limparErroValidacaoCampo(el);
      });
      const feedback = document.getElementById('appValidationFeedback');
      if (feedback) feedback.textContent = '';
    }

    function apresentarErroValidacao(erros = []) {
      const feedback = document.getElementById('appValidationFeedback');
      if (!erros.length) return;
      erros.forEach(({ id, message }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', 'appValidationFeedback');
        if (typeof el.setCustomValidity === 'function') {
          el.setCustomValidity(message);
        }
      });
      const primeiro = erros.map(item => ({ ...item, el: document.getElementById(item.id) })).find(item => item.el);
      if (!primeiro) return;
      if (feedback) feedback.textContent = primeiro.message;
      showToast(primeiro.message, 'warning');
      primeiro.el.focus({ preventScroll: true });
      if (typeof primeiro.el.reportValidity === 'function') {
        primeiro.el.reportValidity();
      }
    }

    function sincronizarLabelsComCampos() {
      document.querySelectorAll('.field, .field-stack').forEach(bloco => {
        const label = bloco.querySelector('label');
        const campo = bloco.querySelector('input, select, textarea');
        if (!label || !campo || !campo.id || label.getAttribute('for')) return;
        label.setAttribute('for', campo.id);
      });
    }

    function configurarRotulosAcessiveisEstaticos() {
      const mapa = {
        summaryList: 'Resumo de desempenho por atendente',
        feedbackChart: 'Gráfico de feedback positivo por atendente',
        addonsOverview: 'Resumo de vendas de addons do período',
        pendingOverview: 'Resumo de pendências do período',
        scaleBoard: 'Quadro visual da escala do período',
        eventsList: 'Lista em cards de eventos e ações do período',
        eventsUpcoming: 'Resumo da próxima programação',
        eventsCalendar: 'Calendário visual de eventos e ações do período',
        backupSummaryList: 'Resumo de backup e snapshot',
        diagnosticSummaryList: 'Resumo da validação estrutural',
        periodAuditList: 'Resumo de auditoria por período',
        flowSmokeList: 'Resumo dos autotestes rápidos'
      };
      Object.entries(mapa).forEach(([id, rotulo]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('aria-label', rotulo);
      });
    }

    function obterTicketsPendencia() {
      return [...document.querySelectorAll('#pendingKanban [data-pending-id]')];
    }

    function atualizarRovingPendencias() {
      const tickets = obterTicketsPendencia();
      if (!tickets.length) return;
      const alvoId = estadoAcessibilidade.pendenciaFocadaId && tickets.some(ticket => ticket.dataset.pendingId === estadoAcessibilidade.pendenciaFocadaId)
        ? estadoAcessibilidade.pendenciaFocadaId
        : tickets[0].dataset.pendingId;
      tickets.forEach(ticket => {
        ticket.tabIndex = ticket.dataset.pendingId === alvoId ? 0 : -1;
      });
      estadoAcessibilidade.pendenciaFocadaId = alvoId;
    }

    function focarPendenciaPorIndice(indice) {
      const tickets = obterTicketsPendencia();
      if (!tickets.length) return;
      const posicao = Math.max(0, Math.min(tickets.length - 1, indice));
      const alvo = tickets[posicao];
      if (!alvo) return;
      estadoAcessibilidade.pendenciaFocadaId = alvo.dataset.pendingId;
      atualizarRovingPendencias();
      alvo.focus({ preventScroll: true });
    }

    function agendarRetornoFocoPendencia(id) {
      estadoAcessibilidade.pendenciaFocoPendente = id;
    }

    function restaurarFocoPendenteSeNecessario() {
      if (!estadoAcessibilidade.pendenciaFocoPendente) {
        atualizarRovingPendencias();
        return;
      }
      const id = estadoAcessibilidade.pendenciaFocoPendente;
      estadoAcessibilidade.pendenciaFocoPendente = null;
      requestAnimationFrame(() => {
        const alvo = document.querySelector(`#pendingKanban [data-pending-id="${id}"]`);
        if (!alvo) {
          atualizarRovingPendencias();
          return;
        }
        estadoAcessibilidade.pendenciaFocadaId = id;
        atualizarRovingPendencias();
        alvo.focus({ preventScroll: true });
      });
    }

    function moverPendenciaPorTeclado(id, direcao) {
      const ordem = ['aberto', 'respondido', 'concluido'];
      const item = state.pending.find(entry => entry.id === id);
      if (!item) return;
      const indiceAtual = ordem.indexOf(item.status);
      const proximoIndice = Math.max(0, Math.min(ordem.length - 1, indiceAtual + direcao));
      const proximoStatus = ordem[proximoIndice];
      if (!proximoStatus || proximoStatus === item.status) return;
      agendarRetornoFocoPendencia(id);
      updatePendingStatus(id, proximoStatus);
      anunciarAoLeitor(`Pendência movida para ${proximoStatus}.`, 'polite');
    }

    function bindAcessibilidade() {
      if (estadoEventos.acessibilidadeInicializada) return;
      estadoEventos.acessibilidadeInicializada = true;

      sincronizarLabelsComCampos();
      configurarRotulosAcessiveisEstaticos();

      document.addEventListener('focusin', e => {
        const ticket = e.target.closest('#pendingKanban [data-pending-id]');
        if (!ticket) return;
        estadoAcessibilidade.pendenciaFocadaId = ticket.dataset.pendingId;
        atualizarRovingPendencias();
      });

      document.addEventListener('keydown', e => {
        const modal = obterModalAtivo();
        if (modal && e.key === 'Tab') {
          const focaveis = obterElementosFocaveis(modal);
          if (!focaveis.length) return;
          const primeiro = focaveis[0];
          const ultimo = focaveis[focaveis.length - 1];
          if (e.shiftKey && document.activeElement === primeiro) {
            e.preventDefault();
            ultimo.focus();
          } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primeiro.focus();
          }
        }

        const controleAcionavel = e.target.closest('[data-action]');
        if (controleAcionavel && !controleAcionavel.matches('button, input, select, textarea, a') && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          controleAcionavel.click();
          return;
        }

        const ticket = e.target.closest('#pendingKanban [data-pending-id]');
        if (!ticket) return;
        const tickets = obterTicketsPendencia();
        const indiceAtual = tickets.indexOf(ticket);
        if (indiceAtual < 0) return;

        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          moverPendenciaPorTeclado(ticket.dataset.pendingId, e.key === 'ArrowRight' ? 1 : -1);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          focarPendenciaPorIndice(indiceAtual + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          focarPendenciaPorIndice(indiceAtual - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          focarPendenciaPorIndice(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          focarPendenciaPorIndice(tickets.length - 1);
        }
      });
    }

    function studentStatusPill(value) {
      const cls = value === 'Respondeu' ? 'ok' : value === 'Não respondeu' ? 'bad' : 'warn';
      return `<span class="pill ${cls}">${esc(value)}</span>`;
    }

    function npsPill(value) {
      const cls = value === 'Sim' ? 'ok' : value === 'Não' ? 'bad' : 'warn';
      return `<span class="pill ${cls}">${esc(value)}</span>`;
    }

    function pendingPill(value) {
      const map = {
        aberto: ['open-pill', '<span class="pulse-dot"></span>Aberto'],
        respondido: ['info', 'Respondido'],
        concluido: ['ok', 'Concluído']
      };
      const [cls, text] = map[value] || ['info', esc(value)];
      return `<span class="pill ${cls}">${text}</span>`;
    }

    function formatPct(v) { return `${Math.round((v || 0) * 100)}%`; }

    // Fonte única de verdade para bindings de UI — IDs derivados do array de bindings
    const UI_BINDINGS = [
      { id: 'studentSearch', event: 'input', key: 'studentSearch', alvo: 'students' },
      { id: 'studentFilterAtendente', event: 'change', key: 'studentFilterAtendente', alvo: 'students' },
      { id: 'studentFilterFeedback', event: 'change', key: 'studentFilterFeedback', alvo: 'students' },
      { id: 'pendingSearch', event: 'input', key: 'pendingSearch', alvo: 'pending' },
      { id: 'eventSearch', event: 'input', key: 'eventSearch', alvo: 'events' },
      { id: 'eventTypeFilter', event: 'change', key: 'eventTypeFilter', alvo: 'events' },
      { id: 'eventStatusFilter', event: 'change', key: 'eventStatusFilter', alvo: 'events' },
      { id: 'scaleSearch', event: 'input', key: 'scaleSearch', alvo: 'scale' }
    ];

    const UI_CONTROL_IDS = UI_BINDINGS.map(b => b.id);

    const AREAS_RENDERIZACAO = ['hero', 'dashboard', 'students', 'addons', 'pending', 'nps', 'scale', 'events', 'settings'];
    const estadoRenderizacao = {
      sujas: new Set(),
      agendado: false,
      idQuadro: 0,
      renderizando: false,
      ultimoLote: [],
      controlesUiInicializados: false
    };

    function getStudentViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.studentSearch || ''),
        person: String(ui.studentFilterAtendente || ''),
        feedback: String(ui.studentFilterFeedback || '')
      };
    }

    function getPendingViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.pendingSearch || '')
      };
    }

    function getEventViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.eventSearch || ''),
        typeFilter: String(ui.eventTypeFilter || '').trim(),
        statusFilter: String(ui.eventStatusFilter || '').trim()
      };
    }

    function getScaleViewFilters(ui = sanitizeUIState(getUIState())) {
      return {
        query: normalizeSearchText(ui.scaleSearch || '')
      };
    }

    // Dispatch map para renderização — elimina switch gigante
    const RENDER_MAP = {
      hero: renderHero,
      dashboard: renderDashboard,
      students: renderStudents,
      addons: renderAddons,
      pending: renderPending,
      nps: renderNps,
      scale: renderScale,
      events: renderEvents,
      settings: renderSettings
    };

    function renderSection(section) {
      RENDER_MAP[section]?.();
    }

    function renderSections(...sections) {
      [...new Set(sections.flat().filter(Boolean))].forEach(renderSection);
    }

    function normalizarAlvosRender(alvos = []) {
      const lista = Array.isArray(alvos) ? alvos.flat() : [alvos];
      const normalizados = lista.filter(Boolean).flatMap(alvo => alvo === 'all' || alvo === 'tudo' ? AREAS_RENDERIZACAO : [alvo]);
      return [...new Set(normalizados.filter(alvo => AREAS_RENDERIZACAO.includes(alvo)))];
    }

    function requestRender(alvos = []) {
      const normalizados = normalizarAlvosRender(alvos);
      if (!normalizados.length) return;
      normalizados.forEach(alvo => estadoRenderizacao.sujas.add(alvo));
      if (estadoRenderizacao.renderizando || estadoRenderizacao.agendado) return;
      estadoRenderizacao.agendado = true;
      estadoRenderizacao.idQuadro = window.requestAnimationFrame(executarRenderAgendado);
    }

    function limparFilaRender() {
      if (estadoRenderizacao.idQuadro) {
        window.cancelAnimationFrame(estadoRenderizacao.idQuadro);
      }
      estadoRenderizacao.sujas.clear();
      estadoRenderizacao.agendado = false;
      estadoRenderizacao.idQuadro = 0;
      estadoRenderizacao.ultimoLote = [];
    }

    function executarRenderAgendado() {
      estadoRenderizacao.agendado = false;
      estadoRenderizacao.idQuadro = 0;
      if (!estadoRenderizacao.sujas.size) return;

      const alvos = normalizarAlvosRender([...estadoRenderizacao.sujas]);
      estadoRenderizacao.sujas.clear();
      estadoRenderizacao.renderizando = true;
      estadoRenderizacao.ultimoLote = alvos;

      try {
        alvos.forEach(renderSection);
      } finally {
        estadoRenderizacao.renderizando = false;
      }

      syncCurrentPeriodLockUI();

      if (estadoRenderizacao.sujas.size) {
        requestRender([...estadoRenderizacao.sujas]);
      }
    }

    function applyUIStateToControls(ui = sanitizeUIState(getUIState())) {
      UI_CONTROL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const value = ui[id];
        if (value != null) el.value = value;
      });
    }

    function initUIBindings() {
      if (estadoRenderizacao.controlesUiInicializados) return;
      estadoRenderizacao.controlesUiInicializados = true;

      const debounceTimers = {};
      UI_BINDINGS.forEach(({ id, event, key, alvo }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(event, e => {
          saveUIState({ [key]: e.target.value });
          if (event === 'input') {
            clearTimeout(debounceTimers[id]);
            debounceTimers[id] = setTimeout(() => requestRender(alvo), 150);
          } else {
            requestRender(alvo);
          }
        });
      });
    }

    function resetViewFilters(view) {
      const nextState = {};
      if (view === 'events') {
        nextState.eventSearch = '';
        nextState.eventTypeFilter = '';
        nextState.eventStatusFilter = '';
        saveUIState(nextState);
        applyUIStateToControls({ ...getUIState(), ...nextState });
        requestRender('events');
        showSaveToast('✓ filtros de eventos limpos');
        return;
      }
      if (view === 'scale') {
        nextState.scaleSearch = '';
        saveUIState(nextState);
        applyUIStateToControls({ ...getUIState(), ...nextState });
        requestRender('scale');
        showSaveToast('✓ busca da escala limpa');
      }
    }

    // ══════════════════════════════════════════
    // HELPERS DE PATCH DE DOM — patch explícito por chave, sem virtual DOM
    // ══════════════════════════════════════════

    function criarAssinaturaHtml(html) {
      let hash = 5381;
      for (let i = 0; i < html.length; i++) {
        hash = ((hash << 5) + hash) ^ html.charCodeAt(i);
      }
      return String(hash >>> 0);
    }

    function criarNoRenderizado(html, chave, assinatura) {
      const template = document.createElement('template');
      template.innerHTML = sanitizeHtml(html.trim());
      const no = template.content.firstElementChild;
      if (!no) throw new Error('Renderização sem nó raiz.');
      no.dataset.chaveRender = String(chave);
      no.dataset.assinaturaRender = assinatura;
      return no;
    }

    function escaparSeletorCss(valor) {
      if (window.CSS?.escape) return window.CSS.escape(String(valor));
      return String(valor).replace(/["\\]/g, '\\$&');
    }

    function obterSeletorFoco(el) {
      if (!el) return null;
      if (el.id) return `#${escaparSeletorCss(el.id)}`;
      const partes = [el.tagName.toLowerCase()];
      const atributos = ['data-change-action', 'data-id', 'data-field', 'data-input-action', 'data-scale-shift', 'data-index', 'data-blur-action', 'data-action', 'data-person', 'name'];
      atributos.forEach(atributo => {
        if (!el.hasAttribute?.(atributo)) return;
        partes.push(`[${atributo}="${escaparSeletorCss(el.getAttribute(atributo))}"]`);
      });
      return partes.length > 1 ? partes.join('') : null;
    }

    function capturarEstadoFoco(container) {
      const ativo = document.activeElement;
      if (!ativo || !container?.contains(ativo)) return null;
      return {
        seletor: obterSeletorFoco(ativo),
        valor: 'value' in ativo ? ativo.value : null,
        inicio: typeof ativo.selectionStart === 'number' ? ativo.selectionStart : null,
        fim: typeof ativo.selectionEnd === 'number' ? ativo.selectionEnd : null
      };
    }

    function restaurarEstadoFoco(container, estado) {
      if (!container || !estado?.seletor) return;
      const alvo = container.querySelector(estado.seletor);
      if (!alvo) return;
      alvo.focus({ preventScroll: true });
      if (typeof alvo.setSelectionRange === 'function' && estado.inicio != null && estado.fim != null) {
        try {
          alvo.setSelectionRange(estado.inicio, estado.fim);
        } catch {}
      }
    }

    function aplicarHtmlSeMudou(el, html) {
      if (!el) return;
      const assinatura = criarAssinaturaHtml(html);
      if (el.dataset.assinaturaRender === assinatura) return;
      el.innerHTML = sanitizeHtml(html);
      el.dataset.assinaturaRender = assinatura;
    }

    function aplicarPatchPorChave(container, descritores = []) {
      if (!container) return;
      const foco = capturarEstadoFoco(container);
      const existentes = new Map(Array.from(container.children).map(no => [String(no.dataset.chaveRender || ''), no]));
      const desejados = descritores.map(({ chave, html }) => {
        const chaveNormalizada = String(chave);
        const assinatura = criarAssinaturaHtml(html);
        const existente = existentes.get(chaveNormalizada);
        if (existente && existente.dataset.assinaturaRender === assinatura) {
          existentes.delete(chaveNormalizada);
          return existente;
        }
        const novoNo = criarNoRenderizado(html, chaveNormalizada, assinatura);
        existentes.delete(chaveNormalizada);
        return novoNo;
      });

      if (!container.children.length) {
        const fragmento = document.createDocumentFragment();
        desejados.forEach(no => fragmento.appendChild(no));
        container.replaceChildren(fragmento);
        restaurarEstadoFoco(container, foco);
        return;
      }

      const fragmento = document.createDocumentFragment();
      desejados.forEach(no => fragmento.appendChild(no));
      container.replaceChildren(fragmento);
      restaurarEstadoFoco(container, foco);
    }

    function aplicarPatchLinhas(container, itens, obterChave, renderizarLinha) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarLinha(item)
      })));
    }

    function aplicarPatchCards(container, itens, obterChave, renderizarCard) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarCard(item)
      })));
    }

    function aplicarPatchItensKanban(container, itens, obterChave, renderizarCard) {
      aplicarPatchCards(container, itens, obterChave, renderizarCard);
    }

    function aplicarPatchBlocosAgrupados(container, itens, obterChave, renderizarBloco) {
      aplicarPatchPorChave(container, itens.map(item => ({
        chave: obterChave(item),
        html: renderizarBloco(item)
      })));
    }

    function formatDate(v) {
      if (!v) return '-';
      const [y,m,d] = v.split('-');
      if (!y || !m || !d) return v;
      return `${d}/${m}/${y}`;
    }
    function getPeriodPrefix(key = currentPeriodKey) {
      const [year, month] = String(key).split('-');
      return `${year}-${month}`;
    }

    function getDefaultPeriodDate() {
      return `${getPeriodPrefix()}-01`;
    }

    function getActivePeriodFallbackDate() {
      const today = todayISO();
      return isDateInActivePeriod(today) ? today : getDefaultPeriodDate();
    }

    function isDateInActivePeriod(value) {
      return Boolean(value) && String(value).startsWith(getPeriodPrefix());
    }

    function getPeriodDisplayDate(dateStr) {
      return dateStr ? formatDate(dateStr) : '—';
    }

    function getWeekdayLabel(dateStr) {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return '';
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        timeZone: 'America/Sao_Paulo'
      }).format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '');
    }

    function compareByDateTime(a, b) {
      const aKey = `${a.date || ''}T${a.time || '00:00'}`;
      const bKey = `${b.date || ''}T${b.time || '00:00'}`;
      return aKey.localeCompare(bKey);
    }

    function getUpcomingScale() {
      const sorted = [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      if (!sorted.length) return null;
      const today = todayISO();
      return sorted.find(item => String(item.date || '') >= today) || sorted[0];
    }

    function getUpcomingEvent(source = state.events) {
      const sorted = [...(Array.isArray(source) ? source : [])].sort(compareByDateTime);
      if (!sorted.length) return null;
      const nowKey = `${todayISO()}T00:00`;
      return sorted.find(item => `${item.date || ''}T${item.time || '00:00'}` >= nowKey && item.status !== 'Cancelado') || sorted[0];
    }

    function toneLabel(value) {
      return value === 'green' ? 'Sábado' : value === 'red' ? 'Feriado' : 'Dia normal';
    }

    function eventStatusClass(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (key.includes('confirm')) return 'event-status-confirmado';
      if (key.includes('concl')) return 'event-status-concluido';
      if (key.includes('cancel')) return 'event-status-cancelado';
      return 'event-status-programado';
    }

    function normalizeSearchText(value) {
      return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    }

    function getScaleFilteredList() {
      const { query } = getScaleViewFilters();
      const list = Array.isArray(state.scale) ? state.scale.slice() : [];
      const filtered = query ? list.filter(item => {
        const shifts = Array.isArray(item.professorShifts) ? item.professorShifts : [];
        const haystack = normalizeSearchText([
          item.date,
          getPeriodDisplayDate(item.date),
          getWeekdayLabel(item.date),
          toneLabel(item.rowTone || 'neutral'),
          item.receptionTime,
          item.receptionist,
          item.receptionSwap,
          item.note,
          ...shifts.flatMap(shift => [shift.time, shift.name, shift.swap])
        ].join(' '));
        return haystack.includes(query);
      }) : list;
      return filtered.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    }

    function getEventsFilteredList() {
      const { query, typeFilter, statusFilter } = getEventViewFilters();
      const list = Array.isArray(state.events) ? state.events.slice() : [];
      const filtered = list.filter(item => {
        const matchesQuery = !query || normalizeSearchText([
          item.date,
          getPeriodDisplayDate(item.date),
          item.time,
          item.type,
          item.title,
          item.place,
          item.owner,
          item.status,
          item.description
        ].join(' ')).includes(query);
        const matchesType = !typeFilter || String(item.type || '') === typeFilter;
        const matchesStatus = !statusFilter || String(item.status || '') === statusFilter;
        return matchesQuery && matchesType && matchesStatus;
      });
      return filtered.sort(compareByDateTime);
    }

    function getScaleSummaryText(item) {
      if (!item) return 'Nenhuma escala cadastrada no período.';
      const profs = item.professorShifts.filter(shift => shift.name).map(shift => shift.name);
      const professorText = profs.length ? profs.join(' • ') : 'Sem professor definido';
      const receptionText = item.receptionist || 'Sem recepcionista definido';
      return `Prof.: ${professorText} • Recepção: ${receptionText}`;
    }

    function getEventSummaryText(item) {
      if (!item) return 'Nenhum evento ou ação programado neste período.';
      return `${item.type || 'Agenda'} • ${getPeriodDisplayDate(item.date)}${item.time ? ` • ${item.time}` : ''}`;
    }

    function suggestScaleTone(dateStr) {
      if (!dateStr) return 'neutral';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return 'neutral';
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (weekday === 6) return 'green';
      return 'neutral';
    }

    function normalizeEventType(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (key.includes('acao')) return 'acao';
      if (key.includes('camp')) return 'campanha';
      if (key.includes('trein')) return 'treinamento';
      if (key.includes('feriado')) return 'feriado';
      if (key.includes('evento')) return 'evento';
      return 'outro';
    }

    function getCurrentPeriodDateInfo() {
      const [yearStr, monthStr] = String(currentPeriodKey).split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
      return { year, monthIndex, totalDays, firstWeekday };
    }

    function renderEventsCalendar(dadosEventos) {
      const holder = document.getElementById('eventsCalendar');
      if (!holder) return;
      const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const { year, monthIndex, totalDays, firstWeekday } = getCurrentPeriodDateInfo();
      const map = dadosEventos?.porDia || new Map();
      const today = todayISO();
      aplicarHtmlSeMudou(holder, `<div class="event-calendar-scroll"><div id="eventsCalendarGrid" class="event-calendar-grid"></div></div>`);
      const grid = document.getElementById('eventsCalendarGrid');
      if (!grid) return;

      const blocos = [
        ...weekdays.map(label => ({
          chave: `cabecalho-${label}`,
          html: `<div class="event-weekday-head">${label}</div>`
        })),
        ...Array.from({ length: firstWeekday }, (_, indice) => ({
          chave: `vazio-${indice}`,
          html: `<div class="event-calendar-day empty" aria-hidden="true"></div>`
        })),
        ...Array.from({ length: totalDays }, (_, idx) => {
          const day = idx + 1;
          const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const items = (map.get(day) || []).sort(compareByDateTime);
          const topItems = items.slice(0, 3).map(item => {
            const kind = normalizeEventType(item.type);
            return `<div class="event-day-pill type-${kind}">
              <div class="event-day-time ${item.time ? '' : 'wrap'}">${item.time ? esc(item.time) : (item.type === 'Feriado' ? 'Dia todo' : 'Sem horário')}</div>
              <div class="event-day-name">${esc(item.title || item.type || 'Agenda')}</div>
              <div class="event-day-extra">${esc(item.owner || item.place || item.status || '')}</div>
            </div>`;
          }).join('');
          return {
            chave: date,
            html: `<div class="event-calendar-day ${items.length ? 'has-items' : ''} ${date === today ? 'today' : ''}">
              <div class="event-day-top">
                <div class="event-day-number">${String(day).padStart(2, '0')}</div>
                <div class="event-day-count">${items.length ? `${items.length} ${items.length > 1 ? 'itens' : 'item'}` : 'Livre'}</div>
              </div>
              <div class="event-day-list">
                ${topItems || `<div class="event-day-empty-note">Sem agenda</div>`}
                ${items.length > 3 ? `<div class="event-day-more">+ ${items.length - 3} registro(s) neste dia</div>` : ''}
              </div>
            </div>`
          };
        })
      ];

      aplicarPatchBlocosAgrupados(grid, blocos, bloco => bloco.chave, bloco => bloco.html);
    }

    // ══════════════════════════════════════════
    // CAMADA DE SELECTORS — derivados com memoização previsível
    // ══════════════════════════════════════════

    const cacheSelectores = new Map();

    function limparCacheSelectores() {
      cacheSelectores.clear();
    }

    function criarAssinaturaSelector(...partes) {
      return JSON.stringify(partes);
    }

    function lerSelectorMemorizado(chave, assinatura, calcular) {
      const chaveCompleta = `${currentPeriodKey}::${chave}::${assinatura}`;
      if (cacheSelectores.has(chaveCompleta)) return cacheSelectores.get(chaveCompleta);
      const valor = calcular();
      cacheSelectores.set(chaveCompleta, valor);
      if (cacheSelectores.size > 120) {
        cacheSelectores.clear();
        cacheSelectores.set(chaveCompleta, valor);
      }
      return valor;
    }

    function selecionarTotaisAddons() {
      const pessoasAddon = getAddonPeople(state);
      const assinatura = criarAssinaturaSelector(pessoasAddon, state.settings.addonTypes, state.addons);
      return lerSelectorMemorizado('totais_addons', assinatura, () => {
        const porPessoa = {};
        const porPessoaTipo = {};
        let totalGeral = 0;

        pessoasAddon.forEach(nome => {
          porPessoaTipo[nome] = {};
          const grupo = state.addons[nome] || {};
          const knownTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(grupo)])];
          let totalPessoa = 0;
          knownTypes.forEach(tipo => {
            const totalTipo = (grupo[tipo] || []).reduce((acc, valor) => acc + Number(valor || 0), 0);
            porPessoaTipo[nome][tipo] = totalTipo;
            totalPessoa += totalTipo;
          });
          porPessoa[nome] = totalPessoa;
          totalGeral += totalPessoa;
        });

        return { porPessoa, porPessoaTipo, totalGeral };
      });
    }

    function selecionarResumoRecepcionistas() {
      const recepcionistas = getReceptionists(state);
      const assinatura = criarAssinaturaSelector(recepcionistas, state.students, state.addons, state.settings.addonTypes);
      return lerSelectorMemorizado('resumo_recepcionistas', assinatura, () => {
        const alunos = state.students;
        const totaisAddons = selecionarTotaisAddons();
        const taxaFeedbackGlobal = alunos.length ? alunos.filter(aluno => aluno.feedback !== 'Pendente').length / alunos.length : 0;
        return recepcionistas.map(nome => {
          const itens = alunos.filter(aluno => aluno.atendimento === nome);
          const total = itens.length;
          const comFeedback = itemsComFeedback(itens);
          const nps = itens.filter(aluno => aluno.avisoNps === 'Sim').length;
          const addon = totaisAddons.porPessoa[nome] || 0;
          const positivos = itens.filter(aluno => aluno.feedback === 'Respondeu').length;
          const taxaFeedback = total ? comFeedback / total : 0;
          const taxaAddon = total ? addon / total : 0;
          const taxaPositiva = comFeedback ? positivos / comFeedback : 0;
          return {
            nome,
            total,
            comFeedback,
            nps,
            addon,
            addonVolume: addon,
            positivos,
            taxaFeedback,
            taxaAddon,
            taxaPositiva,
            diferencaTaxa: taxaFeedback - taxaFeedbackGlobal
          };
        });
      });
    }

    function itemsComFeedback(itens) {
      return itens.filter(item => item.feedback !== 'Pendente').length;
    }

    function selecionarLideresHistoricos(limite = 6) {
      const periods = storage?.periods || {};
      const keys = Object.keys(periods).filter(k => k && k !== currentPeriodKey);
      const assinatura = criarAssinaturaSelector('hist_leaders', keys, currentPeriodKey);
      return lerSelectorMemorizado('lideres_historicos', assinatura, () => {
        return keys
          .sort((a, b) => b.localeCompare(a))
          .map(key => {
            const period = periods[key];
            if (!period) return null;

            // Líder de addons: somar todos os tipos por pessoa
            let addonLeader = null;
            try {
              const addons = period.addons || {};
              const tipos = period.settings?.addonTypes || [];
              let melhor = null;
              Object.keys(addons).forEach(nome => {
                const grupo = addons[nome] || {};
                let total = 0;
                (tipos.length ? tipos : Object.keys(grupo)).forEach(tipo => {
                  total += (grupo[tipo] || []).reduce((acc, v) => acc + Number(v || 0), 0);
                });
                if (total > 0 && (!melhor || total > melhor.total || (total === melhor.total && nome.localeCompare(melhor.name, 'pt-BR') < 0))) {
                  melhor = { name: nome, total };
                }
              });
              addonLeader = melhor;
            } catch (_) { /* período legado sem addons */ }

            // Líder de NPS: somar count das mentions
            let npsLeader = null;
            try {
              const mentions = Array.isArray(period?.nps?.mentions) ? period.nps.mentions : [];
              let melhor = null;
              mentions.forEach(m => {
                const count = Number(m?.count || 0);
                const nome = String(m?.name || '');
                if (count > 0 && (!melhor || count > melhor.total || (count === melhor.total && nome.localeCompare(melhor.name, 'pt-BR') < 0))) {
                  melhor = { name: nome, total: count };
                }
              });
              npsLeader = melhor;
            } catch (_) { /* período legado sem nps */ }

            if (!addonLeader && !npsLeader) return null;

            return {
              key,
              label: getPeriodLabel(key),
              addonLeader,
              npsLeader
            };
          })
          .filter(Boolean)
          .slice(0, limite);
      });
    }

    function selecionarResumoPendencias() {
      const assinatura = criarAssinaturaSelector(state.pending);
      return lerSelectorMemorizado('resumo_pendencias', assinatura, () => {
        const contagens = {
          aberto: state.pending.filter(item => item.status === 'aberto').length,
          respondido: state.pending.filter(item => item.status === 'respondido').length,
          concluido: state.pending.filter(item => item.status === 'concluido').length
        };
        const ordemStatus = { aberto: 0, respondido: 1, concluido: 2 };
        const itensDashboard = state.pending.slice().sort((a, b) => {
          const ranking = (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9);
          if (ranking !== 0) return ranking;
          return String(b.data || '').localeCompare(String(a.data || ''));
        }).slice(0, 4);
        const maisAntigaAberta = state.pending
          .filter(item => item.status === 'aberto' && item.data)
          .slice()
          .sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;
        return {
          contagens,
          itensDashboard,
          total: state.pending.length,
          abertas: contagens.aberto,
          concluidas: contagens.concluido,
          maisAntigaAberta
        };
      });
    }

    function selecionarPendenciasFiltradas() {
      const { query } = getPendingViewFilters();
      const assinatura = criarAssinaturaSelector(state.pending, query);
      return lerSelectorMemorizado('pendencias_filtradas', assinatura, () => {
        const linhas = state.pending.filter(item => normalizeSearchText([item.nome, item.matricula, item.pendencia, item.resposta, item.hostess].join(' ')).includes(query));
        return {
          linhas,
          grupos: {
            aberto: linhas.filter(item => item.status === 'aberto'),
            respondido: linhas.filter(item => item.status === 'respondido'),
            concluido: linhas.filter(item => item.status === 'concluido')
          }
        };
      });
    }

    function selecionarRankingNps() {
      const assinatura = criarAssinaturaSelector(state.nps.mentions, state.nps.rankSnapshot, state.nps.score, state.nps.monthlyGoal, state.nps.semesterGoal);
      return lerSelectorMemorizado('ranking_nps', assinatura, () => {
        const itens = [...state.nps.mentions].sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
        const snapshot = state.nps.rankSnapshot || {};
        const haSnapshot = Object.keys(snapshot).length > 0;
        const ranking = itens.map((item, indice) => {
          const posicao = indice + 1;
          const anterior = snapshot[item.id];
          let tendencia = { classe: 'trend-stable', rotulo: '— estável' };
          if (haSnapshot) {
            if (anterior == null) tendencia = { classe: 'trend-new', rotulo: 'novo' };
            else if (anterior > posicao) tendencia = { classe: 'trend-up', rotulo: `↑ ${anterior - posicao}` };
            else if (anterior < posicao) tendencia = { classe: 'trend-down', rotulo: `↓ ${posicao - anterior}` };
          }
          return { ...item, position: posicao, tendencia };
        });
        const totalCitacoes = ranking.reduce((acc, item) => acc + Number(item.count || 0), 0);
        const mapaRanking = {};
        ranking.forEach(item => { mapaRanking[item.id] = item.position; });
        return {
          ranking,
          totalCitacoes,
          top: ranking[0] || null,
          mapaRanking
        };
      });
    }

    function selecionarDadosEventosAgrupados() {
      const filtros = getEventViewFilters();
      const assinatura = criarAssinaturaSelector(state.events, filtros, currentPeriodKey);
      return lerSelectorMemorizado('dados_eventos_agrupados', assinatura, () => {
        const lista = getEventsFilteredList();
        const porDia = new Map();
        lista.forEach(item => {
          const dia = Number(String(item.date || '').slice(-2));
          if (!Number.isFinite(dia)) return;
          if (!porDia.has(dia)) porDia.set(dia, []);
          porDia.get(dia).push(item);
        });
        const proximos = lista.filter(item => `${item.date || ''}T${item.time || '00:00'}` >= `${todayISO()}T00:00` && item.status !== 'Cancelado').length;
        return {
          lista,
          porDia,
          total: lista.length,
          proximos,
          confirmados: lista.filter(item => item.status === 'Confirmado').length,
          concluidos: lista.filter(item => item.status === 'Concluído').length,
          proximo: getUpcomingEvent(lista)
        };
      });
    }

    function selecionarResumoEscala() {
      const filtros = getScaleViewFilters();
      const assinatura = criarAssinaturaSelector(state.scale, filtros, currentPeriodKey);
      return lerSelectorMemorizado('resumo_escala', assinatura, () => {
        const lista = getScaleFilteredList();
        const fimDeSemanaOuAtencao = lista.filter(item => {
          const diaSemana = new Date(`${item.date}T00:00:00`).getDay();
          return diaSemana === 0 || diaSemana === 6 || item.rowTone === 'red';
        }).length;
        const recepcaoCoberta = lista.filter(item => item.receptionist).length;
        const professoresLancados = lista.reduce((acc, item) => acc + (item.professorShifts || []).filter(shift => shift.name).length, 0);
        const trocasOuAtencao = lista.reduce((acc, item) => acc + (item.professorShifts || []).filter(shift => shift.swap).length + (item.receptionSwap ? 1 : 0), 0);
        return {
          lista,
          diasEscalados: lista.length,
          recepcaoCoberta,
          professoresLancados,
          trocasOuAtencao,
          fimDeSemanaOuAtencao
        };
      });
    }

    function getNpsGoalProgress(score, goal) {
      const safeScore = clamp(Number(score || 0), 0, 100);
      const safeGoal = clamp(Number(goal || 0), 0, 100);
      return safeGoal ? Math.min(100, (safeScore / safeGoal) * 100) : 0;
    }

    function selecionarIndicadoresDashboard() {
      const assinatura = criarAssinaturaSelector(
        state.students,
        state.pending,
        state.scale,
        state.events,
        state.nps,
        state.settings,
        state.addons,
        storage.archives?.[currentPeriodKey] || null
      );
      return lerSelectorMemorizado('indicadores_dashboard', assinatura, () => {
        const alunos = state.students;
        const resumoRecepcionistas = selecionarResumoRecepcionistas();
        const resumoPendencias = selecionarResumoPendencias();
        const totaisAddons = selecionarTotaisAddons();
        const rankingNps = selecionarRankingNps();
        const scoreAtual = clamp(Number(state.nps.score || 0), 0, 100);
        const metaMensal = clamp(Number(state.nps.monthlyGoal ?? 75), 0, 100);
        const metaSemestral = clamp(Number(state.nps.semesterGoal ?? 80), 0, 100);
        const destaqueFeedback = resumoRecepcionistas.slice().sort((a, b) => b.taxaPositiva - a.taxaPositiva || b.taxaFeedback - a.taxaFeedback || b.total - a.total)[0] || null;
        const liderAddonNome = Object.keys(totaisAddons.porPessoa).slice().sort((a, b) => (totaisAddons.porPessoa[b] || 0) - (totaisAddons.porPessoa[a] || 0))[0] || '';
        const proximaEscala = [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).find(item => String(item.date || '') >= todayISO()) || [...state.scale].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null;
        const proximoEvento = getUpcomingEvent(state.events);
        const comFeedback = alunos.filter(aluno => aluno.feedback !== 'Pendente').length;
        const positivos = alunos.filter(aluno => aluno.feedback === 'Respondeu').length;
        const percentualMetaMensal = getNpsGoalProgress(scoreAtual, metaMensal);
        const percentualMetaSemestral = getNpsGoalProgress(scoreAtual, metaSemestral);

        return {
          totalAlunos: alunos.length,
          mediaFeedback: alunos.length ? comFeedback / alunos.length : 0,
          feedbackPositivo: comFeedback ? positivos / comFeedback : 0,
          npsAtual: scoreAtual,
          faixaNps: getRiskBand(scoreAtual),
          pendenciasAbertas: resumoPendencias.abertas,
          pendenciasConcluidas: resumoPendencias.concluidas,
          totalPendencias: resumoPendencias.total,
          proximaEscala,
          proximoEvento,
          resumoRecepcionistas,
          resumoPendencias,
          totaisAddons,
          rankingNps,
          destaqueFeedback,
          liderAddonNome,
          liderAddonTotal: liderAddonNome ? (totaisAddons.porPessoa[liderAddonNome] || 0) : 0,
          itemNpsTopo: rankingNps.top,
          metaMensal,
          metaSemestral,
          percentualMetaMensal,
          percentualMetaSemestral,
          maisAntigaAberta: resumoPendencias.maisAntigaAberta
        };
      });
    }

    function totalAddonByPerson(person) {
      return selecionarTotaisAddons().porPessoa[person] || 0;
    }

    function totalNpsMentions() {
      return selecionarRankingNps().totalCitacoes;
    }

    function computeSummary() {
      return selecionarResumoRecepcionistas();
    }

    function getOldestOpenPending() {
      return selecionarResumoPendencias().maisAntigaAberta;
    }

    function diffInDays(dateStr) {
      if (!dateStr) return 0;
      const base = new Date(dateStr + 'T00:00:00');
      const now = new Date();
      const diff = Math.floor((now - base) / 86400000);
      return Number.isFinite(diff) ? Math.max(0, diff) : 0;
    }

    function renderDashboardInsights(indicadores) {
      const bestFeedback = indicadores.destaqueFeedback;
      const addonLeaderName = indicadores.liderAddonNome;
      const addonLeaderTotal = indicadores.liderAddonTotal;
      const topMention = indicadores.itemNpsTopo;
      const totalMentions = indicadores.rankingNps.totalCitacoes;
      const oldest = indicadores.maisAntigaAberta;
      const monthlyGoal = indicadores.metaMensal;
      const semesterGoal = indicadores.metaSemestral;
      const score = indicadores.npsAtual;
      const monthlyPct = indicadores.percentualMetaMensal;
      const semesterPct = indicadores.percentualMetaSemestral;

      aplicarHtmlSeMudou(document.getElementById('dashboardInsights'), `
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Destaque em feedback</div><div class="insight-badge">TOP</div></div>
          <div class="insight-value">${bestFeedback ? esc(bestFeedback.nome) : 'Sem dados'}</div>
          <div class="insight-meta">${bestFeedback ? `${formatPct(bestFeedback.taxaPositiva)} de feedback positivo em ${bestFeedback.total} atendimento${bestFeedback.total === 1 ? '' : 's'}.` : 'Cadastre atendimentos com feedback para gerar o destaque.'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${bestFeedback ? Math.round(bestFeedback.taxaPositiva * 100) : 0}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Líder de addons</div><div class="insight-badge">${addonLeaderTotal}</div></div>
          <div class="insight-value">${addonLeaderName ? esc(addonLeaderName) : 'Sem dados'}</div>
          <div class="insight-meta">${addonLeaderName ? `Maior volume acumulado nas vendas complementares deste mês.` : 'A contagem automática aparece quando o addon é marcado no novo atendimento.'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, addonLeaderTotal * 8)}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Líder NPS</div><div class="insight-badge">${topMention ? topMention.count : 0}</div></div>
          <div class="insight-value">${topMention ? esc(topMention.name) : 'Nenhuma citação registrada'}</div>
          <div class="insight-meta">${topMention ? `#1 • ${topMention.count} ${topMention.count === 1 ? 'citação' : 'citações'} no mês.` : 'Nenhuma citação registrada'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${topMention && totalMentions ? Math.round((topMention.count / totalMentions) * 100) : 0}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Urgência operacional</div><div class="insight-badge">${oldest ? `${diffInDays(oldest.data)}d` : 'OK'}</div></div>
          <div class="insight-value">${oldest ? esc(oldest.nome) : 'Sem pendência crítica'}</div>
          <div class="insight-meta">${oldest ? `Aberta desde ${formatDate(oldest.data)} • ${esc(oldest.hostess || 'Sem responsável')}` : 'Nenhuma pendência aberta exigindo escalonamento imediato.'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, oldest ? diffInDays(oldest.data) * 12 : 0)}%"></div></div>
        </div>
        <div class="insight-card">
          <div class="insight-head"><div class="insight-title">Meta NPS</div><div class="insight-badge">${score}</div></div>
          <div class="insight-value">Mensal ${monthlyGoal} • Semestral ${semesterGoal}</div>
          <div class="insight-meta">${score >= monthlyGoal ? 'Meta mensal alcançada.' : `Faltam ${Math.max(0, monthlyGoal - score)} pts para a meta mensal.`} ${score >= semesterGoal ? 'Meta semestral alcançada.' : `Semestral: faltam ${Math.max(0, semesterGoal - score)} pts.`}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.max(monthlyPct, semesterPct)}%"></div></div>
        </div>
      `);
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — DASHBOARD & HERO — renderHero, renderDashboard
    // ══════════════════════════════════════════

    function renderHero() {
      syncPeriodControls();
      const indicadores = selecionarIndicadoresDashboard();
      const students = indicadores.totalAlunos;
      const pendingOpen = indicadores.pendenciasAbertas;
      const addons = indicadores.totaisAddons.totalGeral;
      const currentNps = indicadores.npsAtual;
      document.getElementById('heroSummary').innerHTML = `
        <div class="mini-stat">
          <div class="label">Período ativo</div>
          <div class="value" style="font-size:22px">${esc(getPeriodLabel())}</div>
          <div class="hint">${storage.archives[currentPeriodKey] ? 'Mês já fechado anteriormente' : 'Base ativa para lançamento atual'}</div>
        </div>
        <div class="mini-stat">
          <div class="label">Atendimentos no mês</div>
          <div class="value">${students}</div>
          <div class="hint">Registros cadastrados na operação atual</div>
        </div>
        <div class="mini-stat">
          <div class="label">NPS atual</div>
          <div class="value">${currentNps}</div>
          <div class="hint">${esc(getRiskBand(currentNps).label)}</div>
        </div>
        <div class="mini-stat">
          <div class="label">Addons vendidos</div>
          <div class="value">${addons}</div>
          <div class="hint">Somatório de todas as categorias do mês</div>
        </div>
        <div class="mini-stat">
          <div class="label">Pendências abertas</div>
          <div class="value">${pendingOpen}</div>
          <div class="hint">Itens que precisam de atenção imediata</div>
        </div>
      `;
    }

    function renderDashboard() {
      const indicadores = selecionarIndicadoresDashboard();
      const summary = indicadores.resumoRecepcionistas;
      const nextScale = indicadores.proximaEscala;
      const nextEvent = indicadores.proximoEvento;
      aplicarHtmlSeMudou(document.getElementById('dashboardCards'), `
        <div class="card card-kpi"><div class="card-label">Total alunos</div><div class="card-value">${indicadores.totalAlunos}</div><div class="card-foot">Registros deste mês</div></div>
        <div class="card card-kpi"><div class="card-label">Média geral feedback</div><div class="card-value">${formatPct(indicadores.mediaFeedback)}</div><div class="card-foot">Baseado em respostas ≠ pendente</div></div>
        <div class="card card-kpi"><div class="card-label">Feedback positivo</div><div class="card-value">${formatPct(indicadores.feedbackPositivo)}</div><div class="card-foot">Somente respostas recebidas</div></div>
        <div class="card card-kpi"><div class="card-label">NPS atual</div><div class="card-value">${indicadores.npsAtual}</div><div class="card-foot">${esc(indicadores.faixaNps.label)}</div></div>
        <div class="card card-kpi"><div class="card-label">Pendências abertas</div><div class="card-value">${indicadores.pendenciasAbertas}</div><div class="card-foot">${indicadores.pendenciasConcluidas}/${indicadores.totalPendencias} concluídas</div></div>
        <div class="card card-nav" data-action="set-active-tab" data-tab-target="scale" role="button" tabindex="0" aria-label="Abrir a aba Escala e ver a próxima escala">
          <div class="card-label">Próxima escala</div>
          <div class="card-value">${nextScale ? esc(getPeriodDisplayDate(nextScale.date)) : 'Sem escala'}</div>
          <div class="card-foot"><strong>${nextScale ? esc(getScaleSummaryText(nextScale)) : 'Ir para aba Escala'}</strong></div>
        </div>
        <div class="card card-nav" data-action="set-active-tab" data-tab-target="events" role="button" tabindex="0" aria-label="Abrir a aba Eventos e ações e ver a próxima programação">
          <div class="card-label">Próximo evento / ação</div>
          <div class="card-value">${nextEvent ? esc(nextEvent.title) : 'Sem agenda'}</div>
          <div class="card-foot"><strong>${nextEvent ? esc(getEventSummaryText(nextEvent)) : 'Ir para aba Eventos e ações'}</strong></div>
        </div>
      `);

      renderDashboardInsights(indicadores);

      const summaryList = document.getElementById('summaryList');
      if (!summary.length) {
        aplicarHtmlSeMudou(summaryList, `<div class="empty">Nenhum atendente configurado.</div>`);
      } else {
        aplicarPatchCards(summaryList, summary, row => row.nome, row => `
          <div class="summary-item summary-item--dashboard-person">
            <div class="summary-main"><div class="name" title="${esc(row.nome)}">${esc(row.nome)}</div><div class="muted">${row.total} atendimentos registrados</div></div>
            <div class="metric"><strong>${row.total}</strong><span>Total</span></div>
            <div class="metric"><strong>${formatPct(row.taxaFeedback)}</strong><span>Feedback</span></div>
            <div class="metric"><strong>${row.addonVolume ?? row.addon ?? 0}</strong><span>Addons</span></div>
            <div class="metric"><strong>${formatPct(row.taxaPositiva)}</strong><span>Positivo</span></div>
            <div class="metric"><strong class="${row.diferencaTaxa < 0 ? 'danger-text' : 'gold-text'}">${row.diferencaTaxa >= 0 ? '+' : ''}${Math.round(row.diferencaTaxa * 100)} pts</strong><span>Vs média</span></div>
          </div>
        `);
      }

      const maxPositiveRate = Math.max(0.01, ...summary.map(s => s.taxaPositiva));
      const feedbackChart = document.getElementById('feedbackChart');
      feedbackChart.style.minWidth = `${Math.max(summary.length * 88, 560)}px`;
      feedbackChart.style.alignItems = 'flex-end';
      if (!summary.length) {
        aplicarHtmlSeMudou(feedbackChart, `<div class="empty">Sem dados para exibir.</div>`);
      } else {
        aplicarPatchCards(feedbackChart, summary, item => item.nome, s => {
          const h = Math.max(8, (s.taxaPositiva / maxPositiveRate) * 190);
          return `
            <div class="bar-col" data-tooltip="${esc(s.nome)} • ${formatPct(s.taxaPositiva)} positivo">
              <div class="bar-value">${formatPct(s.taxaPositiva)}</div>
              <div class="bar" style="height:${h}px"></div>
              <div class="bar-label" title="${esc(s.nome)}">${esc(s.nome)}</div>
            </div>
          `;
        });
      }

      const addonsOverview = document.getElementById('addonsOverview');
      const addonPeople = getAddonPeople(state);
      const activeReceptionists = new Set(getReceptionists(state));
      if (!addonPeople.length) {
        aplicarHtmlSeMudou(addonsOverview, '<div class="empty">Sem atendentes cadastrados.</div>');
      } else {
        aplicarPatchCards(addonsOverview, addonPeople, person => person, person => {
          const total = indicadores.totaisAddons.porPessoa[person] || 0;
          const perType = Object.entries(indicadores.totaisAddons.porPessoaTipo[person] || {})
            .map(([type, count]) => `${esc(type)}: ${count}`)
            .join(' · ') || 'Sem lançamentos registrados.';
          const subtitle = activeReceptionists.has(person) ? perType : `Histórico preservado • ${perType}`;
          return `<div class="summary-item summary-item--addon-overview"><div class="addon-card-details"><div class="addon-card-name">${esc(person)}</div><div class="addon-card-categories">${subtitle}</div></div><div class="addon-card-total"><strong>${total}</strong><span>Total no período</span></div></div>`;
        });
      }

      const counts = indicadores.resumoPendencias.contagens;
      const dashboardPendingItems = indicadores.resumoPendencias.itensDashboard;
      aplicarHtmlSeMudou(document.getElementById('pendingOverview'), `
        <div class="summary-item pending-overview-cards">
          <div class="metric"><strong>${counts.aberto}</strong><span>Abertas</span></div>
          <div class="metric"><strong>${counts.respondido}</strong><span>Respondidas</span></div>
          <div class="metric"><strong>${counts.concluido}</strong><span>Concluídas</span></div>
        </div>
        <div class="dashboard-pending-list">
          ${dashboardPendingItems.map(p => `
            <div class="ticket dashboard-pending-ticket ${p.status === 'aberto' ? 'ticket-attention' : ''}" data-tooltip="${esc(p.pendencia || '')}">
              <div class="ticket-topline">
                <div class="title" data-tooltip="${esc(p.nome)}">${esc(shortText(p.nome || 'Sem nome', 48))}</div>
                ${pendingPill(p.status)}
              </div>
              <div class="meta">${buildPendingMeta(p)}</div>
              <div class="desc" data-tooltip="${esc(p.pendencia || '')}">${esc(shortText(p.pendencia || 'Sem pendência registrada.', 130))}</div>
            </div>
          `).join('') || '<div class="empty">Nenhuma pendência cadastrada.</div>'}
        </div>
      `);
    }

    // ══════════════════════════════════════════
    // ENHANCEMENTS — DASHBOARD VISUAL + PAINEL DE RECADOS (INDEPENDENTE)
    // ══════════════════════════════════════════

    const RECADOS_STORAGE_PREFIX = 'wpm_recados_';
    let recadosModuleBound = false;
    let dashboardEnhancementsInstalled = false;

    function createRecadoId() {
      return window.crypto?.randomUUID?.() || `recado-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    function getRecadosStorageKey(periodKey = currentPeriodKey) {
      const [year = String(new Date().getFullYear()), month = '01'] = String(periodKey || '').split('-');
      return `${RECADOS_STORAGE_PREFIX}${year}-${String(month).padStart(2, '0')}`;
    }

    function sanitizeRecado(item) {
      const text = String(item?.text ?? item?.message ?? '').trim();
      const from = String(item?.from ?? '').trim();
      const to = String(item?.to ?? 'Todos').trim() || 'Todos';
      if (!from || !text) return null;
      return {
        id: String(item?.id || createRecadoId()),
        from,
        to,
        text,
        createdAt: String(item?.createdAt || new Date().toISOString()),
        read: Boolean(item?.read)
      };
    }

    function normalizeRecadosCollection(recados) {
      return (Array.isArray(recados) ? recados : [])
        .map(sanitizeRecado)
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    function mergeRecadosCollections(primary, fallback) {
      const byId = new Map();
      const bySignature = new Map();

      const register = item => {
        const signature = `${item.from}::${item.to}::${item.text}::${item.createdAt}`;
        const existing = byId.get(item.id) || bySignature.get(signature);
        if (!existing) {
          byId.set(item.id, item);
          bySignature.set(signature, item);
          return;
        }
        const merged = {
          ...existing,
          ...item,
          id: existing.id || item.id || createRecadoId(),
          read: Boolean(existing.read || item.read)
        };
        byId.set(merged.id, merged);
        bySignature.set(signature, merged);
      };

      normalizeRecadosCollection(primary).forEach(register);
      normalizeRecadosCollection(fallback).forEach(register);
      return [...new Set(byId.values())]
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    function areRecadosCollectionsEqual(left, right) {
      return JSON.stringify(normalizeRecadosCollection(left)) === JSON.stringify(normalizeRecadosCollection(right));
    }

    function readLegacyRecados(periodKey = currentPeriodKey) {
      try {
        const raw = localStorage.getItem(getRecadosStorageKey(periodKey));
        const parsed = JSON.parse(raw || '[]');
        return normalizeRecadosCollection(parsed);
      } catch (error) {
        console.error('Falha ao carregar recados legados:', error);
        return [];
      }
    }

    function clearLegacyRecadosStorageKey(periodKey = currentPeriodKey) {
      try {
        localStorage.removeItem(getRecadosStorageKey(periodKey));
        return true;
      } catch (error) {
        console.error('Falha ao limpar recados legados:', error);
        return false;
      }
    }

    function getLegacyRecadoPeriodKeys() {
      try {
        const keys = [];
        for (let index = 0; index < localStorage.length; index++) {
          const rawKey = localStorage.key(index);
          if (!rawKey || !rawKey.startsWith(RECADOS_STORAGE_PREFIX)) continue;
          const periodKey = String(rawKey.slice(RECADOS_STORAGE_PREFIX.length) || '').trim();
          if (isValidPeriodKey(periodKey)) keys.push(periodKey);
        }
        return [...new Set(keys)].sort();
      } catch (error) {
        console.error('Falha ao listar recados legados:', error);
        return [];
      }
    }

    function ensureRecadosPeriod(periodKey = currentPeriodKey, storeRef = storage) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      if (!targetStore?.periods) return null;
      const key = String(periodKey || currentPeriodKey);
      if (!targetStore.periods[key]) {
        const template = targetStore.periods?.[targetStore.activePeriod] || Object.values(targetStore.periods || {})[0] || demoData;
        targetStore.periods[key] = buildEmptyPeriodFromTemplate(template, key);
      }
      normalizeData(targetStore.periods[key]);
      return targetStore.periods[key];
    }

    function getStoreRecados(periodKey = currentPeriodKey, storeRef = storage) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      const period = targetStore?.periods?.[String(periodKey || currentPeriodKey)];
      if (!period || typeof period !== 'object') return [];
      normalizeData(period);
      return normalizeRecadosCollection(period.recados);
    }

    async function migrateLegacyRecadosToStore(storeRef = storage, options = {}) {
      const targetStore = storeRef && typeof storeRef === 'object' ? storeRef : storage;
      if (!targetStore?.periods) return false;

      const legacyPeriodKeys = getLegacyRecadoPeriodKeys();
      if (!legacyPeriodKeys.length) return false;

      let changed = false;
      const syncedKeys = [];

      legacyPeriodKeys.forEach(key => {
        const legacyRecados = readLegacyRecados(key);
        if (!legacyRecados.length) return;

        const period = ensureRecadosPeriod(key, targetStore);
        if (!period) return;

        const merged = mergeRecadosCollections(period.recados, legacyRecados);
        syncedKeys.push(key);
        if (areRecadosCollectionsEqual(period.recados, merged)) return;

        period.recados = merged;
        changed = true;
      });

      let saved = true;
      if (changed && options.persist === true) {
        saved = await saveStore(targetStore, {
          silent: true,
          broadcast: false,
          eventType: String(options?.eventType || 'recados-migration')
        });
      }

      if (saved && options.cleanup !== false) {
        syncedKeys.forEach(clearLegacyRecadosStorageKey);
      }

      return changed;
    }

    function loadRecados(periodKey = currentPeriodKey) {
      const key = String(periodKey || currentPeriodKey);
      return mergeRecadosCollections(getStoreRecados(key), readLegacyRecados(key));
    }

    async function saveRecados(recados, periodKey = currentPeriodKey) {
      try {
        const key = String(periodKey || currentPeriodKey);
        const period = ensureRecadosPeriod(key);
        if (!period) throw new Error('Período indisponível para salvar recados.');

        period.recados = normalizeRecadosCollection(recados);
        if (key === currentPeriodKey) state = period;

        const saved = key === currentPeriodKey
          ? await saveData({ silent: true, eventType: 'recados' })
          : await saveStore(storage, { silent: true, eventType: 'recados' });

        if (!saved) return false;
        clearLegacyRecadosStorageKey(key);
        return true;
      } catch (error) {
        console.error('Falha ao salvar recados:', error);
        showToast('Não foi possível salvar os recados deste mês.', 'danger');
        return false;
      }
    }

    function formatRecadoDateTime(value) {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return '-';
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(dt);
    }

    function formatPctPrecise(value) {
      const pct = Number(value || 0) * 100;
      const isInteger = Math.abs(pct - Math.round(pct)) < 0.001;
      return `${pct.toLocaleString('pt-BR', {
        minimumFractionDigits: isInteger ? 0 : 2,
        maximumFractionDigits: 2
      })}%`;
    }

    function getUnreadRecadosCount(periodKey = currentPeriodKey) {
      return loadRecados(periodKey).filter(item => !item.read).length;
    }

    function syncRecadosSelects() {
      const fromSelect = document.getElementById('recadoFrom');
      const toSelect = document.getElementById('recadoTo');
      if (!fromSelect || !toSelect) return;

      const recepcionistas = getReceptionists(state);
      const currentFrom = fromSelect.value;
      const currentTo = toSelect.value;

      fromSelect.innerHTML = recepcionistas.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      toSelect.innerHTML = `<option value="Todos">Todos</option>${recepcionistas.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}`;

      fromSelect.value = recepcionistas.includes(currentFrom) ? currentFrom : (recepcionistas[0] || '');
      toSelect.value = currentTo === 'Todos' || recepcionistas.includes(currentTo) ? (currentTo || 'Todos') : 'Todos';
    }

    function renderFeedbackSummary() {
      const host = document.getElementById('feedbackSummary');
      if (!host) return;

      const summary = selecionarIndicadoresDashboard().resumoRecepcionistas || [];
      if (!summary.length) {
        aplicarHtmlSeMudou(host, `<div class="feedback-summary-chip">Sem base suficiente para resumir o feedback da equipe.</div>`);
        return;
      }

      const best = summary.slice().sort((a, b) => b.taxaPositiva - a.taxaPositiva || b.total - a.total)[0];
      const average = summary.reduce((acc, row) => acc + Number(row.taxaPositiva || 0), 0) / summary.length;

      aplicarHtmlSeMudou(host, `
        <div class="feedback-summary-chip">Melhor: <strong>${esc(best.nome)}</strong> (${formatPct(best.taxaPositiva)})</div>
        <div class="feedback-summary-chip">Média da equipe: <strong>${formatPctPrecise(average)}</strong></div>
      `);
    }

    function renderHeroRecadosBadge(unreadCount = getUnreadRecadosCount()) {
      const cards = [...document.querySelectorAll('#heroSummary .mini-stat')];
      if (!cards.length) return;

      cards.forEach((card, index) => {
        card.classList.toggle('mini-stat--wide', index === 0);
      });

      const firstCard = cards[0];
      let badge = firstCard.querySelector('.mini-stat-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'mini-stat-badge';
        firstCard.appendChild(badge);
      }
      badge.textContent = unreadCount
        ? `${unreadCount} recado${unreadCount === 1 ? '' : 's'} não lido${unreadCount === 1 ? '' : 's'}`
        : 'Nenhum recado pendente';
      badge.classList.toggle('is-active', unreadCount > 0);
    }

    function renderRecadosPanel() {
      const list = document.getElementById('recadosList');
      const counter = document.getElementById('recadosCounter');
      if (!list || !counter) return;

      syncRecadosSelects();

      const recados = loadRecados();
      const unreadCount = recados.filter(item => !item.read).length;

      counter.textContent = `${unreadCount} recado${unreadCount === 1 ? '' : 's'} não lido${unreadCount === 1 ? '' : 's'}`;
      counter.classList.toggle('has-unread', unreadCount > 0);
      renderHeroRecadosBadge(unreadCount);

      if (!recados.length) {
        aplicarHtmlSeMudou(
          list,
          `<div class="empty recado-empty">Nenhum recado publicado em ${esc(getPeriodLabel())}. Use o formulário acima para deixar o primeiro aviso do turno.</div>`
        );
        return;
      }

      aplicarPatchCards(list, recados, item => item.id, item => `
        <article class="recado-card ${item.read ? '' : 'recado-card--unread'}">
          <div class="recado-top">
            <div class="recado-route">
              <span class="recado-pill">${esc(item.from)}</span>
              <span class="recado-pill recado-pill--to">${esc(item.to || 'Todos')}</span>
            </div>
            <div class="recado-meta">
              <span>${esc(formatRecadoDateTime(item.createdAt))}</span>
              <span class="recado-badge ${item.read ? '' : 'recado-badge--unread'}">${item.read ? 'Lido' : 'Não lido'}</span>
            </div>
          </div>
          <div class="recado-text">${esc(item.text)}</div>
          <div class="recado-actions">
            ${item.read ? '<button type="button" class="btn btn-ghost btn-xs" disabled>Lido</button>' : `<button type="button" class="btn btn-success btn-xs" data-recado-action="mark-read" data-recado-id="${esc(item.id)}">Marcar como lido</button>`}
            <button type="button" class="btn btn-danger btn-xs" data-recado-action="delete" data-recado-id="${esc(item.id)}">Excluir</button>
          </div>
        </article>
      `);
    }

    async function publishRecado() {
      if (!assertWritableCurrentPeriod()) return;
      const from = String(document.getElementById('recadoFrom')?.value || '').trim();
      const to = String(document.getElementById('recadoTo')?.value || 'Todos').trim() || 'Todos';
      const text = String(document.getElementById('recadoMessage')?.value || '').trim();

      if (!from) {
        showToast('Selecione quem está deixando o recado.', 'warning');
        return;
      }
      if (!text) {
        showToast('Escreva o recado antes de publicar.', 'warning');
        return;
      }

      const recados = loadRecados();
      recados.unshift({
        id: createRecadoId(),
        from,
        to,
        text,
        createdAt: new Date().toISOString(),
        read: false
      });

      if (!await saveRecados(recados)) return;

      document.getElementById('recadosForm')?.reset();
      syncRecadosSelects();
      renderRecadosPanel();
      document.getElementById('recadoMessage')?.focus();
      showToast('✓ recado publicado para o próximo turno.', 'success');
    }

    async function markRecadoAsRead(id) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard'] })) return;
      const recados = loadRecados();
      const next = recados.map(item => item.id === id ? { ...item, read: true } : item);
      if (!await saveRecados(next)) return;
      renderRecadosPanel();
    }

    function removeRecado(id) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard'] })) return;
      const recados = loadRecados();
      const target = recados.find(item => item.id === id);
      if (!target) return;

      showConfirm(`Excluir o recado de ${target.from} para ${target.to}?`, async () => {
        const next = loadRecados().filter(item => item.id !== id);
        if (!await saveRecados(next)) return;
        renderRecadosPanel();
        showToast('✓ recado excluído.', 'success');
      });
    }

    function bindRecadosModule() {
      if (recadosModuleBound) return;
      recadosModuleBound = true;

      document.addEventListener('submit', e => {
        if (e.target?.id !== 'recadosForm') return;
        e.preventDefault();
        publishRecado();
      });

      document.addEventListener('click', e => {
        const action = e.target.closest('[data-recado-action]');
        if (!action) return;

        if (action.dataset.recadoAction === 'mark-read') {
          markRecadoAsRead(action.dataset.recadoId);
          return;
        }
        if (action.dataset.recadoAction === 'delete') {
          removeRecado(action.dataset.recadoId);
        }
      });

      window.addEventListener('storage', e => {
        if (!e.key || !e.key.startsWith(RECADOS_STORAGE_PREFIX)) return;
        renderRecadosPanel();
      });
    }

    function installDashboardEnhancements() {
      if (dashboardEnhancementsInstalled) return;
      dashboardEnhancementsInstalled = true;
      bindRecadosModule();

      const baseRenderHero = renderHero;
      renderHero = function renderHeroEnhanced() {
        baseRenderHero();
        renderHeroRecadosBadge();
      };

      const baseRenderDashboard = renderDashboard;
      renderDashboard = function renderDashboardEnhanced() {
        baseRenderDashboard();
        renderFeedbackSummary();
        renderRecadosPanel();
      };
    }

    installDashboardEnhancements();

    // ══════════════════════════════════════════
    // MÓDULO CRUD GENÉRICO — saveEntity, createCrudHandler
    // Encapsula o padrão comum de validação → persistência → rollback → UI
    // ══════════════════════════════════════════

    /**
     * Cria um handler genérico para operações de save (create/update).
     *
     * @param {Object} config
     * @param {string} config.name — Nome da entidade (ex: 'student', 'pending', 'event')
     * @param {Array} config.collection — Referência ao array no state (ex: state.students)
     * @param {Function} config.getFormData — Função que retorna o objeto do formulário
     * @param {Function} config.applySave — Função apply*Save(state, formData, existing) → result
     * @param {Function} config.getValidationErrors — Mapeia result.validation.errors → [{id, message}]
     * @param {Function} [config.onBeforeSave] — Hook pré-salvamento (ex: applyStudentAddonLink)
     * @param {Function} [config.onAfterSave] — Hook pós-salvamento com sucesso
     * @param {Function} config.finalizeUI — Função chamada após save bem-sucedido
     * @param {Function} config.renderUI — Função de renderização pós-save
     * @param {Array<string>} config.renderTargets — Seções para re-renderizar
     * @param {Function} [config.duplicateCheck] — (Opcional) Detecta duplicatas e retorna mensagem
     * @returns {Function} async () => { ... } — Handler pronto para uso
     */
    function createCrudHandler(config) {
      const {
        name,
        collection,
        getFormData,
        applySave,
        getValidationErrors,
        onBeforeSave,
        onAfterSave,
        finalizeUI,
        renderUI,
        renderTargets,
        duplicateCheck
      } = config;

      return async function handleSave() {
        if (!assertWritableCurrentPeriod()) return;

        const formData = getFormData();
        const existing = collection.find(item => item.id === formData.id);
        const previous = existing ? structuredClone(existing) : null;

        const result = applySave(state, formData, existing);

        if (!result.ok) {
          const errors = getValidationErrors(result.validation);
          if (errors.length) apresentarErroValidacao(errors);
          return;
        }

        // Hooks pré-salvamento (ex: decrementar contador de addon)
        if (onBeforeSave) onBeforeSave(result.entity, previous, state);

        state = result.nextState;
        const saved = await saveData();

        if (!saved) {
          // Rollback
          if (previous && existing) {
            const idx = collection.findIndex(item => item.id === previous.id);
            if (idx >= 0) collection[idx] = previous;
            else collection.push(previous);
          } else if (existing) {
            collection.push(existing);
          }
          if (onAfterSave) onAfterSave(result.entity, previous, state, 'rollback');
          showToast(`Falha ao salvar ${name}. Tente novamente.`, 'danger');
          return;
        }

        // Hooks pós-salvamento (ex: incrementar contador de addon)
        if (onAfterSave) onAfterSave(result.entity, previous, state, 'saved');

        // Verificar duplicata (específico de eventos)
        if (duplicateCheck) {
          const dupMessage = duplicateCheck(result.entity, collection);
          if (dupMessage) {
            showConfirm(dupMessage, () => {
              finalizeUI();
              renderUI();
              requestRender(renderTargets);
            });
            return;
          }
        }

        finalizeUI();
        renderUI();
        requestRender(renderTargets);
      };
    }

    // Handlers CRUD específicos criados pelo módulo genérico

    const handleSaveStudent = createCrudHandler({
      name: 'atendimento',
      collection: state.students,
      getFormData: getStudentFormData,
      applySave: applyStudentSave,
      getValidationErrors: (validation) => {
        const errors = [];
        if (validation.errors.nome) errors.push({ id: 'student_nome', message: validation.errors.nome });
        if (validation.errors.matricula) errors.push({ id: 'student_matricula', message: validation.errors.matricula });
        return errors;
      },
      onBeforeSave: (entity, previous, stateRef) => {
        if (previous) applyStudentAddonLink(previous, -1);
        applyStudentAddonLink(entity, 1);
      },
      finalizeUI: finalizeStudentSaveUI,
      renderUI: renderStudentSaveUI,
      renderTargets: ['hero', 'dashboard', 'students', 'addons']
    });

    const handleSavePending = createCrudHandler({
      name: 'pendência',
      collection: state.pending,
      getFormData: getPendingFormData,
      applySave: applyPendingSave,
      getValidationErrors: (validation) => {
        const errors = [];
        if (validation.errors.nome || validation.errors.required) errors.push({ id: 'pending_nome', message: validation.errors.nome || validation.errors.required });
        if (validation.errors.matricula) errors.push({ id: 'pending_matricula', message: validation.errors.matricula });
        if (validation.errors.required) errors.push({ id: 'pending_desc', message: validation.errors.required });
        if (validation.errors.data) errors.push({ id: 'pending_data', message: validation.errors.data });
        return errors;
      },
      finalizeUI: finalizePendingSaveUI,
      renderUI: renderPendingSaveUI,
      renderTargets: ['hero', 'dashboard', 'pending']
    });

    const handleSaveEvent = createCrudHandler({
      name: 'evento',
      collection: state.events,
      getFormData: getEventFormData,
      applySave: applyEventSave,
      getValidationErrors: (validation) => {
        const errors = [];
        if (validation.errors.date) errors.push({ id: 'event_date', message: validation.errors.date });
        if (validation.errors.required) errors.push({ id: 'event_title', message: validation.errors.required });
        return errors;
      },
      finalizeUI: finalizeEventSaveUI,
      renderUI: renderEventSaveUI,
      renderTargets: ['dashboard', 'events'],
      duplicateCheck: (entity, collection) => {
        const dup = collection.find(entry =>
          entry.id !== entity.id &&
          String(entry.date || '') === String(entity.date || '') &&
          String(entry.time || '') === String(entity.time || '') &&
          String(entry.title || '').trim().toLowerCase() === entity.title.toLowerCase()
        );
        return dup ? 'Já existe um evento com o mesmo título, data e horário. Deseja salvar mesmo assim?' : null;
      }
    });

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — STUDENTS & ADDONS — renderStudents, saveStudent, removeStudent, renderAddons, updateAddon, addPerson, renamePerson
    // ══════════════════════════════════════════

    function renderStudents() {
      const tbody = document.getElementById('studentTableBody');
      const { query, person, feedback } = getStudentViewFilters();
      const allRows = state.students;
      const totalStudents = allRows.length;
      const byAttendant = getReceptionists(state)
        .map(name => `${name}: ${allRows.filter(item => item.atendimento === name).length}`)
        .join(' • ');
      const respondedCount = allRows.filter(item => item.feedback !== 'Pendente').length;
      const pendingFeedbackCount = allRows.filter(item => item.feedback === 'Pendente').length;
      const addonsCount = allRows.filter(item => item.addon).length;
      aplicarHtmlSeMudou(
        document.getElementById('studentsSectionTitle'),
        `ALUNOS NOVOS (MÊS) — ${totalStudents} registro${totalStudents === 1 ? '' : 's'}`
      );
      aplicarHtmlSeMudou(
        document.getElementById('studentsSummaryBar'),
        `
          <div class="students-summary-item students-summary-item--total">
            <span class="students-summary-label">Total de alunos</span>
            <strong class="students-summary-value">${totalStudents}</strong>
          </div>
          <div class="students-summary-item students-summary-item--attendants">
            <span class="students-summary-label">Atendimentos por atendente</span>
            <strong class="students-summary-value">${esc(byAttendant || 'Sem dados')}</strong>
          </div>
          <div class="students-summary-item students-summary-item--feedback">
            <span class="students-summary-label">Feedbacks</span>
            <strong class="students-summary-value">${respondedCount} respondidos</strong>
            <span class="students-summary-meta">${pendingFeedbackCount} pendentes</span>
          </div>
          <div class="students-summary-item students-summary-item--addons">
            <span class="students-summary-label">Addons vendidos</span>
            <strong class="students-summary-value">${addonsCount}</strong>
          </div>
        `
      );
      const rows = state.students.filter(s => {
        const hay = normalizeSearchText([s.nome, s.matricula, s.atendimento, s.observacoes, s.addon].join(' '));
        return (!query || hay.includes(query)) && (!person || s.atendimento === person) && (!feedback || s.feedback === feedback);
      });
      if (!rows.length) {
        aplicarHtmlSeMudou(tbody, `<tr><td colspan="11"><div class="empty">Nenhum atendimento encontrado.</div></td></tr>`);
        return;
      }
      aplicarPatchLinhas(tbody, rows, item => item.id, s => `
        <tr>
          <td><strong>${esc(s.nome)}</strong></td>
          <td>${esc(s.matricula || '-')}</td>
          <td><input class="table-input" type="date" value="${esc(s.ultimaVisita || '')}" aria-label="Última visita de ${esc(s.nome)}" data-change-action="update-student-inline" data-id="${s.id}" data-field="ultimaVisita" /></td>
          <td><input class="table-input" type="time" value="${esc(s.horaVisita || '')}" aria-label="Hora da visita de ${esc(s.nome)}" data-change-action="update-student-inline" data-id="${s.id}" data-field="horaVisita" /></td>
          <td><span class="table-date-static">${formatDate(s.inicio)}</span></td>
          <td>${npsPill(s.avisoNps)}</td>
          <td>${esc(s.atendimento || '-')}</td>
          <td>${studentStatusPill(s.feedback)}</td>
          <td>${s.addon ? `<span class="pill info">${esc(s.addon)}</span>` : '<span class="pill" style="background:rgba(255,255,255,0.06);color:var(--muted-2);">Nenhum</span>'}</td>
          <td>${renderEllipsisCell(s.observacoes, '-')}</td>
          <td class="right">
            <button class="btn btn-ghost btn-xs" data-action="edit-student" data-id="${s.id}" aria-label="Editar atendimento de ${esc(s.nome)}">Editar</button>
            <button class="btn btn-danger btn-xs" data-action="remove-student" data-id="${s.id}" aria-label="Excluir atendimento de ${esc(s.nome)}">Excluir</button>
          </td>
        </tr>
      `);
    }

    function updateStudentInline(id, field, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'students'] })) return;
      const target = state.students.find(s => s.id === id);
      if (!target) return;
      target[field] = value;
      saveData();
      requestRender(['hero', 'dashboard', 'students']);
    }

    function populateStudentFilters() {
      const options = `<option value="">Todos os atendentes</option>` + getReceptionists(state).map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      document.getElementById('studentFilterAtendente').innerHTML = options;
      document.getElementById('student_atendimento').innerHTML = getReceptionists(state).map(name => `<option>${esc(name)}</option>`).join('');
      document.getElementById('student_addon').innerHTML = `<option value="">Nenhum</option>` + state.settings.addonTypes.map(type => `<option>${esc(type)}</option>`).join('');
      document.getElementById('pending_hostess').innerHTML = getReceptionists(state).map(name => `<option>${esc(name)}</option>`).join('');
      document.getElementById('teamSuggestions').innerHTML = getAllEmployees(state).map(name => `<option value="${esc(name)}"></option>`).join('');
    }

    function getStudentAddonLink(student) {
      if (!student || !student.addon || !student.atendimento) return null;
      const rawDate = student.inicio || student.ultimaVisita || getActivePeriodFallbackDate();
      const day = Number(String(rawDate).split('-')[2] || 0);
      if (!day) return null;
      const idx = Math.min(state.settings.monthDays, Math.max(1, day)) - 1;
      if (!state.addons[student.atendimento] || !state.addons[student.atendimento][student.addon]) return null;
      return { person: student.atendimento, type: student.addon, index: idx };
    }

    function applyStudentAddonLink(student, delta) {
      const link = getStudentAddonLink(student);
      if (!link) return;
      const arr = state.addons[link.person][link.type];
      arr[link.index] = Math.max(0, Number(arr[link.index] || 0) + delta);
    }

    function clearStudentForm() {
      editingStudentId = null;
      limparErrosValidacao(['student_nome', 'student_matricula']);
      document.getElementById('studentModalTitle').textContent = 'Novo atendimento';
      ['nome','matricula','ultimaVisita','horaVisita','inicio','observacoes'].forEach(f => document.getElementById(`student_${f}`).value = '');
      document.getElementById('student_avisoNps').value = 'Sim';
      document.getElementById('student_feedback').value = 'Respondeu';
      document.getElementById('student_atendimento').value = getReceptionists(state)[0] || '';
      document.getElementById('student_addon').value = '';
    }

    function finalizeStudentSaveUI() {
      closeModal('studentModal');
      clearStudentForm();
    }

    function renderStudentSaveUI() {
      requestRender(['hero', 'dashboard', 'students', 'addons']);
    }

    // saveStudent — delega ao handler CRUD genérico
    const saveStudent = handleSaveStudent;

    function editStudent(id) {
      const s = state.students.find(x => x.id === id);
      if (!s) return;
      editingStudentId = id;
      document.getElementById('studentModalTitle').textContent = 'Editar atendimento';
      document.getElementById('student_nome').value = s.nome || '';
      document.getElementById('student_matricula').value = s.matricula || '';
      document.getElementById('student_ultimaVisita').value = s.ultimaVisita || '';
      document.getElementById('student_horaVisita').value = s.horaVisita || '';
      document.getElementById('student_inicio').value = s.inicio || '';
      document.getElementById('student_avisoNps').value = s.avisoNps || 'Sim';
      document.getElementById('student_atendimento').value = s.atendimento || getReceptionists(state)[0] || '';
      document.getElementById('student_feedback').value = s.feedback || 'Respondeu';
      document.getElementById('student_addon').value = s.addon || '';
      document.getElementById('student_observacoes').value = s.observacoes || '';
      openModal('studentModal');
    }

    function removeStudent(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir este atendimento?', async () => {
        const existing = state.students.find(s => s.id === id);
        if (!existing) return;
        applyStudentAddonLink(existing, -1);
        state.students = state.students.filter(s => s.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.students.push(existing);
          applyStudentAddonLink(existing, 1);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['hero', 'dashboard', 'students', 'addons']);
      });
    }

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
      }).join('') || '<div class="empty">Cadastre atendentes em Configurações.</div>';

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

    function renamePerson(oldName, newNameRaw) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const newName = newNameRaw.trim();
      if (!newName || newName === oldName) return requestRender('addons');
      if (getReceptionists(state).includes(newName)) return showToast('Já existe um atendente com esse nome.', 'warning');
      if (state.addons[newName] && newName !== oldName) return showToast('Já existe histórico de addons com esse nome.', 'warning');

      // Snapshot para rollback em caso de falha
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
        // Rollback
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

    function buildPendingMeta(item) {
      const parts = [];
      if (item.status === 'aberto') parts.push('<span class="pulse-dot"></span>');
      if (item.hostess) parts.push(`<span class="meta-item">${esc(item.hostess)}</span>`);
      if (item.hostess && item.data) parts.push('<span class="meta-sep">•</span>');
      if (item.data) parts.push(`<span class="meta-item">${formatDate(item.data)}</span>`);
      return parts.join('') || '<span class="meta-item">Sem dados</span>';
    }


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

    function positionTooltip(e, el, tooltip) {
      const offset = 16;
      const clientX = e?.clientX ?? el.getBoundingClientRect().left;
      const clientY = e?.clientY ?? el.getBoundingClientRect().bottom;
      const maxX = window.innerWidth - tooltip.offsetWidth - 12;
      const maxY = window.innerHeight - tooltip.offsetHeight - 12;
      let x = clientX + offset;
      let y = clientY + offset;
      if (x > maxX) x = Math.max(12, clientX - tooltip.offsetWidth - offset);
      if (y > maxY) y = Math.max(12, clientY - tooltip.offsetHeight - offset);
      tooltip.style.left = `${Math.max(12, Math.min(maxX, x))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(maxY, y))}px`;
    }

    function bindTooltips() {
      if (estadoEventos.tooltipInicializado) return;
      estadoEventos.tooltipInicializado = true;

      const tooltip = document.getElementById('appTooltip');
      if (!tooltip) return;

      const show = (el, e) => {
        const text = String(el?.dataset?.tooltip || '').trim();
        if (!text) return;
        tooltipAlvoAtual = el;
        tooltip.innerHTML = esc(text).replace(/\n/g, '<br>');
        tooltip.classList.add('show');
        positionTooltip(e, el, tooltip);
      };

      const hide = () => {
        tooltipAlvoAtual = null;
        tooltip.classList.remove('show');
      };

      document.addEventListener('mouseover', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el || el === tooltipAlvoAtual) return;
        show(el, e);
      });

      document.addEventListener('mousemove', e => {
        if (!tooltipAlvoAtual || !tooltip.classList.contains('show')) return;
        positionTooltip(e, tooltipAlvoAtual, tooltip);
      });

      document.addEventListener('mouseout', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el || el !== tooltipAlvoAtual) return;
        const relacionado = e.relatedTarget;
        if (relacionado && el.contains(relacionado)) return;
        hide();
      });

      document.addEventListener('focusin', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el) return;
        show(el, { clientX: el.getBoundingClientRect().left, clientY: el.getBoundingClientRect().bottom });
      });

      document.addEventListener('focusout', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el || el !== tooltipAlvoAtual) return;
        hide();
      });
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — PENDING & NPS — renderPending, savePending, removePending, renderNps, registerMention, saveNpsObservations
    // ══════════════════════════════════════════

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
        aplicarHtmlSeMudou(pendingTableBody, `<tr><td colspan="8"><div class="empty">Nenhuma pendência encontrada.</div></td></tr>`);
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
          aplicarHtmlSeMudou(lista, '<div class="empty">Nenhum item</div>');
          return;
        }
        aplicarPatchItensKanban(lista, coluna.items, item => item.id, item => `
          <div class="ticket ${item.status === 'aberto' ? 'ticket-attention' : ''}" draggable="true" data-pending-id="${item.id}" data-tooltip="${esc(item.pendencia || '')}" role="listitem" aria-describedby="pendingKeyboardHelp" aria-keyshortcuts="ArrowUp ArrowDown Home End Alt+ArrowLeft Alt+ArrowRight" aria-label="Pendência de ${esc(item.nome)} com status ${esc(item.status)}">
            <div class="title" data-tooltip="${esc(item.nome)}">${esc(item.nome)}</div>
            <div class="meta">${buildPendingMeta(item)}</div>
            <div class="desc" data-tooltip="${esc(item.pendencia)}">${esc(shortText(item.pendencia, 115))}</div>
            ${item.resposta ? `<div class="desc muted" data-tooltip="${esc(item.resposta)}"><strong style="color:var(--muted)">Resposta:</strong> ${esc(shortText(item.resposta, 85))}</div>` : ''}
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

    function clearPendingForm() {
      editingPendingId = null;
      limparErrosValidacao(['pending_nome', 'pending_matricula', 'pending_desc', 'pending_data']);
      document.getElementById('pendingModalTitle').textContent = 'Nova pendência';
      ['nome','matricula','desc','data','resposta'].forEach(f => document.getElementById(`pending_${f}`).value = '');
      document.getElementById('pending_hostess').value = getReceptionists(state)[0] || '';
      document.getElementById('pending_status').value = 'aberto';
    }

    function finalizePendingSaveUI() {
      closeModal('pendingModal');
      clearPendingForm();
    }

    function renderPendingSaveUI() {
      requestRender(['hero', 'dashboard', 'pending']);
    }

    // savePending — delega ao handler CRUD genérico
    const savePending = handleSavePending;

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

    function getRiskBand(score) {
      const value = clamp(Number(score || 0), 0, 100);
      if (value <= 20) return { label: 'Faixa crítica • vermelho', tone: 'risk-red' };
      if (value <= 40) return { label: 'Faixa de atenção • laranja', tone: 'risk-orange' };
      if (value <= 60) return { label: 'Faixa moderada • amarelo', tone: 'risk-yellow' };
      if (value <= 80) return { label: 'Faixa boa • verde claro', tone: 'risk-green-light' };
      return { label: 'Faixa excelente • verde escuro', tone: 'risk-green-dark' };
    }

    function getSortedMentions() {
      return selecionarRankingNps().ranking;
    }

    function getRankMap() {
      return { ...selecionarRankingNps().mapaRanking };
    }

    function captureNpsRankSnapshot() {
      state.nps.rankSnapshot = getRankMap();
    }

    function trendBadge(item) {
      return `<span class="trend-badge ${item.tendencia?.classe || 'trend-stable'}">${item.tendencia?.rotulo || '— estável'}</span>`;
    }

    function getNpsHistoryBandClass(score) {
      if (score <= 20) return 'is-risk';
      if (score <= 40) return 'is-warning';
      if (score <= 60) return 'is-mid';
      if (score <= 80) return 'is-good';
      return 'is-excellent';
    }

    function getNpsHistoryRows(limit = 6) {
      try {
        const periods = storage?.periods || {};
        return Object.keys(periods)
          .filter(key => key && key !== currentPeriodKey)
          .sort((a, b) => b.localeCompare(a))
          .map(key => {
            const period = periods[key];
            const score = clamp(Number(period?.nps?.score || 0), 0, 100);
            const mentions = Array.isArray(period?.nps?.mentions)
              ? period.nps.mentions.reduce((acc, item) => acc + Number(item?.count || 0), 0)
              : 0;
            const observations = String(period?.nps?.observations || '').trim();
            const hasSignal = score > 0 || mentions > 0 || observations;
            if (!hasSignal) return null;
            return {
              key,
              label: getPeriodLabel(key),
              score,
              band: getRiskBand(score)
            };
          })
          .filter(Boolean)
          .slice(0, limit);
      } catch (error) {
        console.error('Falha ao montar histórico de NPS:', error);
        return [];
      }
    }

    function renderNps() {
      const score = clamp(Number(state.nps.score || 0), 0, 100);
      const band = getRiskBand(score);
      const rankingNps = selecionarRankingNps();
      const pointerLeft = `calc(${score}% - ${score === 100 ? 12 : 0}px)`;

      const monthlyGoal = clamp(Number(state.nps.monthlyGoal ?? 75), 0, 100);
      const semesterGoal = clamp(Number(state.nps.semesterGoal ?? 80), 0, 100);
      const monthlyProgress = getNpsGoalProgress(score, monthlyGoal);
      const semesterProgress = getNpsGoalProgress(score, semesterGoal);
      const historyRows = getNpsHistoryRows();
      document.getElementById('npsMeterBox').innerHTML = `
        <div class="score-hero">
          <div class="nps-score-copy">
            <div class="score-number">${score}</div>
            <div class="score-band">${esc(band.label)}</div>
          </div>
          <div class="goal-pills">
            <div class="goal-pill-strong"><span>Citações no mês</span><strong>${rankingNps.totalCitacoes}</strong></div>
            <div class="goal-pill-strong"><span>Meta mensal</span><strong>${monthlyGoal}</strong></div>
            <div class="goal-pill-strong"><span>Meta semestral</span><strong>${semesterGoal}</strong></div>
          </div>
        </div>
        <div class="risk-meter-wrap">
          <div class="risk-pointer" style="left:${pointerLeft};">
            <div class="marker-value">${score}</div>
            <div class="marker"></div>
          </div>
          <div class="risk-meter">
            <div class="risk-segment risk-red"></div>
            <div class="risk-segment risk-orange"></div>
            <div class="risk-segment risk-yellow"></div>
            <div class="risk-segment risk-green-light"></div>
            <div class="risk-segment risk-green-dark"></div>
          </div>
          <div class="risk-scale">
            <div>0–20</div>
            <div>21–40</div>
            <div>41–60</div>
            <div>61–80</div>
            <div>81–100</div>
          </div>
        </div>
        <div class="score-slider-row nps-grid-3">
          <div class="field">
            <label>Pontuação NPS</label>
            <input id="npsScoreInput" type="number" min="0" max="100" value="${score}" aria-label="Pontuação NPS" data-input-action="update-nps-score" data-source="input" />
          </div>
          <div class="field">
            <label>Meta mensal NPS</label>
            <input id="npsMonthlyGoalInput" type="number" min="0" max="100" value="${monthlyGoal}" aria-label="Meta mensal de NPS" data-input-action="update-nps-goal" data-field="monthlyGoal" />
          </div>
          <div class="field">
            <label>Meta semestral NPS</label>
            <input id="npsSemesterGoalInput" type="number" min="0" max="100" value="${semesterGoal}" aria-label="Meta semestral de NPS" data-input-action="update-nps-goal" data-field="semesterGoal" />
          </div>
        </div>
        <div class="score-slider-row">
          <div class="field">
            <label>Ajuste rápido</label>
            <input id="npsScoreRange" type="range" min="0" max="100" value="${score}" aria-label="Ajuste rápido da pontuação NPS" data-input-action="update-nps-score" data-source="range" />
          </div>
        </div>
        <div class="nps-goals-panel">
          <div class="nps-progress-grid">
            <div class="nps-progress-card">
              <div class="nps-progress-head">
                <div class="nps-progress-title">Progresso da meta mensal</div>
                <div class="nps-progress-meta">${score}/${monthlyGoal} • ${Math.round(monthlyProgress)}%${monthlyProgress >= 100 ? ' ✓' : ''}</div>
              </div>
              <div class="nps-progress-track"><div class="nps-progress-fill" style="width:${Math.min(100, monthlyProgress)}%"></div></div>
            </div>
            <div class="nps-progress-card">
              <div class="nps-progress-head">
                <div class="nps-progress-title">Progresso da meta semestral</div>
                <div class="nps-progress-meta">${score}/${semesterGoal} • ${Math.round(semesterProgress)}%${semesterProgress >= 100 ? ' ✓' : ''}</div>
              </div>
              <div class="nps-progress-track"><div class="nps-progress-fill" style="width:${Math.min(100, semesterProgress)}%"></div></div>
            </div>
          </div>
        </div>
      `;

      aplicarHtmlSeMudou(document.getElementById('npsHistoryBox'), historyRows.length ? `
        <div class="nps-history-panel">
          <div class="toolbar-title">
            <span class="section-kicker">Evolução</span>
            <h2>Histórico de NPS</h2>
            <p>Leitura rápida dos meses anteriores disponíveis na base local.</p>
          </div>
          <div class="nps-history-list">
            ${historyRows.map(item => `
              <div class="nps-history-item">
                <div class="nps-history-period">${esc(item.label)}</div>
                <div class="nps-history-score">${item.score}</div>
                <div class="nps-history-band ${getNpsHistoryBandClass(item.score)}">${esc(item.band.label)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="nps-history-panel">
          <div class="toolbar-title">
            <span class="section-kicker">Evolução</span>
            <h2>Histórico de NPS</h2>
            <p>Leitura rápida dos meses anteriores disponíveis na base local.</p>
          </div>
          <div class="empty nps-history-empty">Dados de meses anteriores aparecerão aqui conforme o uso.</div>
        </div>
      `);

      document.getElementById('npsObservations').value = state.nps.observations || '';

      const ranking = rankingNps.ranking;
      document.getElementById('npsRankingList').innerHTML = ranking.length ? ranking.map(item => `
        <div class="rank-item">
          <div class="rank-left">
            <div class="rank-position">#${item.position}</div>
            <div class="rank-name-group">
              <div class="rank-name-line">
                ${item.position === 1 ? '<span class="crown">👑</span>' : ''}
                <input class="rank-name-input" value="${esc(item.name)}" aria-label="Nome do funcionário citado na posição ${item.position}" data-blur-action="rename-mention" data-id="${item.id}" />
                ${trendBadge(item)}
              </div>
              <div class="rank-meta">${item.count} cita${item.count === 1 ? 'ção' : 'ções'} no mês</div>
            </div>
          </div>
          <div class="rank-actions">
            <button class="btn btn-ghost btn-xs" data-action="adjust-mention" data-id="${item.id}" data-delta="-1" aria-label="Reduzir em uma citação para ${esc(item.name)}">-1</button>
            <input class="count-box" type="number" min="0" value="${item.count}" aria-label="Quantidade de citações de ${esc(item.name)}" data-change-action="set-mention-count" data-id="${item.id}" />
            <button class="btn btn-primary btn-xs" data-action="adjust-mention" data-id="${item.id}" data-delta="1" aria-label="Aumentar em uma citação para ${esc(item.name)}">+1</button>
            <button class="btn btn-danger btn-xs" data-action="remove-mention" data-id="${item.id}" aria-label="Excluir ${esc(item.name)} do ranking de NPS">Excluir</button>
          </div>
        </div>
      `).join('') : '<div class="empty">Ainda não há funcionários citados no NPS.</div>';

      // Líderes dos meses anteriores
      const lideres = selecionarLideresHistoricos();
      aplicarHtmlSeMudou(document.getElementById('npsHistLeaders'), lideres.length ? `
        <div class="hist-leaders">
          <div class="hist-leaders-title">Líderes dos meses anteriores</div>
          <div class="hist-leaders-subtitle">Resumo dos destaques de addons e citações NPS dos períodos já fechados.</div>
          <div class="hist-leaders-list">
            ${lideres.map(m => `
              <div class="hist-leaders-card">
                <div class="hist-leaders-period">${esc(m.label)}</div>
                <div class="hist-leaders-row">
                  <span class="hist-leaders-label">Líder addons</span>
                  <span class="hist-leaders-value">${m.addonLeader ? `${esc(m.addonLeader.name)}<span class="hl-total">${m.addonLeader.total}</span>` : 'Sem dados'}</span>
                </div>
                <div class="hist-leaders-row">
                  <span class="hist-leaders-label">Líder NPS</span>
                  <span class="hist-leaders-value">${m.npsLeader ? `${esc(m.npsLeader.name)}<span class="hl-total">${m.npsLeader.total} cit.</span>` : 'Sem dados'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="hist-leaders">
          <div class="hist-leaders-title">Líderes dos meses anteriores</div>
          <div class="hist-leaders-subtitle">Resumo dos destaques de addons e citações NPS dos períodos já fechados.</div>
          <div class="hist-leaders-empty">Dados de meses anteriores aparecerão aqui conforme o uso.</div>
        </div>
      `);
    }

    function updateNpsScore(value, source) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'nps'] })) return;
      state.nps.score = clamp(Number(value || 0), 0, 100);
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
      if (source === 'input') {
        DOM.setValue('npsScoreRange', state.nps.score);
      } else {
        DOM.setValue('npsScoreInput', state.nps.score);
      }
    }

    function updateNpsGoal(field, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'nps'] })) return;
      state.nps[field] = clamp(Number(value || 0), 0, 100);
      saveData();
      requestRender(['dashboard', 'nps']);
    }

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


    function renderScaleShiftRows() {
      const box = document.getElementById('scaleShiftRows');
      if (!box) return;
      box.innerHTML = scaleShiftDrafts.length ? scaleShiftDrafts.map((shift, index) => `
        <div class="shift-editor-row">
          <div class="field"><label>Horário</label><input data-scale-shift="time" data-index="${index}" aria-label="Horário do professor na linha ${index + 1}" value="${esc(shift.time || '')}" placeholder="Ex: 08h - 13h" /></div>
          <div class="field"><label>Professor</label><input data-scale-shift="name" data-index="${index}" aria-label="Professor da linha ${index + 1}" value="${esc(shift.name || '')}" placeholder="Ex: JUNIOR" /></div>
          <div class="field"><label>Troca</label><input data-scale-shift="swap" data-index="${index}" aria-label="Troca do professor na linha ${index + 1}" value="${esc(shift.swap || '')}" placeholder="Se houver" /></div>
          <button class="btn btn-danger btn-xs" type="button" data-action="remove-scale-shift-row" data-index="${index}" aria-label="Excluir linha ${index + 1} de professor">Excluir</button>
        </div>
      `).join('') : '<div class="empty">Adicione ao menos uma linha de professor para montar o dia.</div>';
    }

    function addScaleShiftRow(values = {}) {
      scaleShiftDrafts.push({ time: values.time || '', name: values.name || '', swap: values.swap || '' });
      renderScaleShiftRows();
    }

    function removeScaleShiftRow(index) {
      scaleShiftDrafts.splice(index, 1);
      renderScaleShiftRows();
    }

    function clearScaleForm() {
      editingScaleId = null;
      limparErrosValidacao(['scale_date']);
      scaleShiftDrafts = [];
      document.getElementById('scaleModalTitle').textContent = 'Novo dia de escala';
      document.getElementById('scale_date').value = getDefaultPeriodDate();
      document.getElementById('scale_tone').value = suggestScaleTone(getDefaultPeriodDate());
      document.getElementById('scale_receptionTime').value = '08h - 17h';
      document.getElementById('scale_receptionist').value = '';
      document.getElementById('scale_receptionSwap').value = '';
      document.getElementById('scale_note').value = '';
      addScaleShiftRow({ time: '08h - 13h', name: '', swap: '' });
      addScaleShiftRow({ time: '12h - 17h', name: '', swap: '' });
    }

    function openScaleModal() {
      clearScaleForm();
      openModal('scaleModal');
    }

    function editScaleDay(id) {
      const item = state.scale.find(entry => entry.id === id);
      if (!item) return;
      editingScaleId = id;
      document.getElementById('scaleModalTitle').textContent = 'Editar dia de escala';
      document.getElementById('scale_date').value = item.date || getDefaultPeriodDate();
      document.getElementById('scale_tone').value = item.rowTone || 'neutral';
      document.getElementById('scale_receptionTime').value = item.receptionTime || '';
      document.getElementById('scale_receptionist').value = item.receptionist || '';
      document.getElementById('scale_receptionSwap').value = item.receptionSwap || '';
      document.getElementById('scale_note').value = item.note || '';
      scaleShiftDrafts = (item.professorShifts || []).map(shift => ({ time: shift.time || '', name: shift.name || '', swap: shift.swap || '' }));
      if (!scaleShiftDrafts.length) scaleShiftDrafts = [{ time: '', name: '', swap: '' }];
      renderScaleShiftRows();
      openModal('scaleModal');
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — SCALE & EVENTS — saveScaleDay, removeScaleDay, renderScale, saveEventItem, removeEventItem, renderEvents
    // ══════════════════════════════════════════

    async function saveScaleDay() {
      if (!assertWritableCurrentPeriod()) return;
      const payload = getScaleFormData();
      limparErrosValidacao(['scale_date']);
      if (!payload.date) { apresentarErroValidacao([{ id: 'scale_date', message: 'Informe a data da escala.' }]); return; }
      if (!isDateInActivePeriod(payload.date)) { apresentarErroValidacao([{ id: 'scale_date', message: `A data da escala deve pertencer a ${getPeriodLabel()}.` }]); return; }
      if (!payload.professorShifts.length) { showToast('Adicione pelo menos uma linha de professor.', 'warning'); document.querySelector('[data-action="add-scale-shift-row"]')?.focus({ preventScroll: true }); return; }
      const idx = state.scale.findIndex(entry => entry.id === payload.id);
      if (idx >= 0) state.scale[idx] = payload; else state.scale.push(payload);
      state.scale.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const saved = await saveData();
      if (!saved) return;
      closeModal('scaleModal');
      requestRender(['dashboard', 'scale']);
    }

    function removeScaleDay(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir este dia da escala?', async () => {
        const existing = state.scale.find(entry => entry.id === id);
        if (!existing) return;
        state.scale = state.scale.filter(entry => entry.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.scale.push(existing);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['dashboard', 'scale']);
      });
    }

    function renderScale() {
      const resumoEscala = selecionarResumoEscala();
      const sorted = resumoEscala.lista;
      const body = document.getElementById('scaleTableBody');
      const board = document.getElementById('scaleBoard');
      const summary = document.getElementById('scaleSummaryCards');
      const opsSummary = document.getElementById('scaleOperationalSummary');

      if (opsSummary) {
        const [yearStr, monthStr] = String(currentPeriodKey || '').split('-');
        const year = Number(yearStr || 0);
        const month = Number(monthStr || 0);
        const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 0;
        const allDays = Array.isArray(state.scale) ? state.scale.slice() : [];
        const totalSlots = allDays.reduce((acc, item) => acc + Math.max(1, (item.professorShifts || []).length) + 1, 0);
        const filledSlots = allDays.reduce((acc, item) => {
          const professorSlotsFilled = (item.professorShifts || []).reduce((sum, shift) => (
            String(shift?.name || '').trim() || String(shift?.time || '').trim() || String(shift?.swap || '').trim()
              ? sum + 1
              : sum
          ), 0);
          const receptionFilled = String(item.receptionist || '').trim() || String(item.receptionTime || '').trim() || String(item.receptionSwap || '').trim() ? 1 : 0;
          return acc + professorSlotsFilled + receptionFilled;
        }, 0);

        const turnsByPerson = new Map();
        allDays.forEach(item => {
          (item.professorShifts || []).forEach(shift => {
            const name = String(shift?.name || '').trim();
            if (!name) return;
            turnsByPerson.set(name, (turnsByPerson.get(name) || 0) + 1);
          });
          const receptionist = String(item.receptionist || '').trim();
          if (receptionist) turnsByPerson.set(receptionist, (turnsByPerson.get(receptionist) || 0) + 1);
        });
        const topPerson = [...turnsByPerson.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0] || null;

        const uncoveredDates = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = `${currentPeriodKey}-${String(day).padStart(2, '0')}`;
          const item = allDays.find(entry => String(entry.date || '') === dateKey);
          if (!item) {
            uncoveredDates.push(dateKey);
            continue;
          }
          const hasProfessorCoverage = (item.professorShifts || []).some(shift => String(shift?.name || '').trim());
          const hasReceptionCoverage = !!String(item.receptionist || '').trim();
          if (!hasProfessorCoverage || !hasReceptionCoverage) uncoveredDates.push(dateKey);
        }

        const uncoveredPreview = uncoveredDates.slice(0, 4).map(date => getPeriodDisplayDate(date)).join(', ');
        const uncoveredDetail = uncoveredDates.length
          ? uncoveredDates.length > 4
            ? `${uncoveredPreview} +${uncoveredDates.length - 4}`
            : uncoveredPreview
          : 'Cobertura completa';

        aplicarHtmlSeMudou(opsSummary, `
          <span class="scale-ops-item"><span>Turnos preenchidos</span><strong>${filledSlots}/${totalSlots}</strong></span>
          <span class="scale-ops-sep" aria-hidden="true"></span>
          <span class="scale-ops-item"><span>Funcionário com mais turnos</span><strong>${topPerson ? `${esc(topPerson[0])} • ${topPerson[1]}` : 'Sem dados'}</strong></span>
          <span class="scale-ops-sep" aria-hidden="true"></span>
          <span class="scale-ops-item"><span>Dias sem cobertura</span><strong>${uncoveredDates.length}</strong><span>${esc(uncoveredDetail)}</span></span>
          <span class="scale-ops-sep" aria-hidden="true"></span>
          <span class="scale-ops-item"><span>Dias lançados</span><strong>${allDays.length}/${daysInMonth || 0}</strong></span>
        `);
      }

      if (summary) {
        aplicarHtmlSeMudou(summary, [
          { label: 'Dias escalados', value: resumoEscala.diasEscalados, foot: `Período ativo: ${getPeriodLabel()}` },
          { label: 'Professores lançados', value: resumoEscala.professoresLancados, foot: 'Somatório dos turnos cadastrados' },
          { label: 'Recepção coberta', value: resumoEscala.recepcaoCoberta, foot: 'Dias com recepcionista definido' },
          { label: 'Trocas / atenção', value: resumoEscala.trocasOuAtencao || resumoEscala.fimDeSemanaOuAtencao, foot: resumoEscala.trocasOuAtencao ? 'Trocas registradas no mês' : `${resumoEscala.fimDeSemanaOuAtencao} dias com atenção operacional` }
        ].map(card => `
          <div class="schedule-kpi">
            <div class="schedule-kpi-label">${esc(card.label)}</div>
            <div class="schedule-kpi-value">${esc(card.value)}</div>
            <div class="schedule-kpi-foot">${esc(card.foot)}</div>
          </div>
        `).join(''));
      }

      if (!sorted.length) {
        aplicarHtmlSeMudou(body, `<tr><td colspan="7"><div class="empty">Nenhum dia de escala encontrado para os filtros aplicados em ${esc(getPeriodLabel())}.</div></td></tr>`);
      } else {
        const linhasEscala = sorted.flatMap(item => {
          const shifts = item.professorShifts.length ? item.professorShifts : [{ time: '', name: '', swap: '' }];
          return shifts.map((shift, index) => ({ item, shift, index, totalShifts: shifts.length }));
        });
        aplicarPatchLinhas(body, linhasEscala, linha => `${linha.item.id}:${linha.index}`, linha => `
          <tr class="scale-tone-${linha.item.rowTone || 'neutral'}">
            ${linha.index === 0 ? `
              <td rowspan="${linha.totalShifts}" class="scale-date-cell">
                <div class="scale-date-main">${esc(getPeriodDisplayDate(linha.item.date))}</div>
                <div class="scale-date-sub">${esc(getWeekdayLabel(linha.item.date))} • ${esc(toneLabel(linha.item.rowTone || 'neutral'))}</div>
                ${linha.item.note ? `<div class="scale-mini-note">${esc(shortText(linha.item.note, 110))}</div>` : ''}
                <div class="scale-action-row">
                  <button class="btn btn-ghost btn-xs" data-action="edit-scale-day" data-id="${linha.item.id}">Editar</button>
                  <button class="btn btn-danger btn-xs" data-action="remove-scale-day" data-id="${linha.item.id}">Excluir</button>
                </div>
              </td>` : ''}
            <td><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.shift.time || '—')}</div></div></td>
            <td><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.shift.name || '—')}</div></div></td>
            <td><div class="scale-cell-stack"><div class="scale-secondary">${esc(linha.shift.swap || '—')}</div></div></td>
            ${linha.index === 0 ? `
              <td rowspan="${linha.totalShifts}"><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.item.receptionTime || '—')}</div></div></td>
              <td rowspan="${linha.totalShifts}"><div class="scale-cell-stack"><div class="scale-primary">${esc(linha.item.receptionist || '—')}</div></div></td>
              <td rowspan="${linha.totalShifts}"><div class="scale-cell-stack"><div class="scale-secondary">${esc(linha.item.receptionSwap || '—')}</div></div></td>` : ''}
          </tr>
        `);
      }

      if (board) {
        if (!sorted.length) {
          aplicarHtmlSeMudou(board, `<div class="empty">Nenhum dia de escala cadastrado para ${esc(getPeriodLabel())}. Use “Adicionar dia de escala” ou “Duplicar mês anterior”.</div>`);
        } else {
          aplicarPatchCards(board, sorted, item => item.id, item => {
            const info = formatScaleBoardDay(item.date);
            const shifts = item.professorShifts.length ? item.professorShifts : [{ time: '—', name: '—', swap: '' }];
            return `
            <article class="scale-board-row tone-${esc(item.rowTone || 'neutral')}">
              <div class="scale-board-day">
                <div class="month">Escala de ${esc(info.month)}</div>
                <div class="date">${esc(info.day)}</div>
                <div class="weekday">${esc(info.weekday || 'Dia do mês')}</div>
              </div>
              <div class="scale-board-prof">
                <div class="scale-board-head">Professores / turnos</div>
                ${shifts.map(shift => `
                  <div class="scale-board-shift">
                    <div class="scale-board-time">${esc(shift.time || '—')}</div>
                    <div>
                      <div class="scale-board-name">${esc(shift.name || '—')}</div>
                      ${shift.swap ? `<div class="scale-board-swap">Troca: ${esc(shift.swap)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="scale-board-recep">
                <div class="scale-board-head">Recepção</div>
                <div class="scale-board-shift">
                  <div class="scale-board-time">${esc(item.receptionTime || '—')}</div>
                  <div>
                    <div class="scale-board-name">${esc(item.receptionist || '—')}</div>
                    ${item.receptionSwap ? `<div class="scale-board-swap">Troca: ${esc(item.receptionSwap)}</div>` : ''}
                  </div>
                </div>
              </div>
              <div class="scale-board-side">
                <div>
                  <div class="scale-tone-pill ${esc(item.rowTone || 'neutral')}">${esc(toneLabel(item.rowTone || 'neutral'))}</div>
                  ${item.note ? `<div class="scale-board-note" style="margin-top:12px;">${esc(item.note)}</div>` : `<div class="scale-board-note" style="margin-top:12px;">Sem observações registradas.</div>`}
                </div>
                <div class="scale-board-actions">
                  <button class="btn btn-ghost btn-xs" data-action="edit-scale-day" data-id="${item.id}">Editar</button>
                  <button class="btn btn-danger btn-xs" data-action="remove-scale-day" data-id="${item.id}">Excluir</button>
                </div>
              </div>
            </article>
          `;
          });
        }
      }
    }

    function clearEventForm() {
      editingEventId = null;
      limparErrosValidacao(['event_date', 'event_title']);
      document.getElementById('eventModalTitle').textContent = 'Novo evento / ação';
      document.getElementById('event_date').value = getDefaultPeriodDate();
      document.getElementById('event_time').value = '';
      document.getElementById('event_type').value = 'Evento';
      document.getElementById('event_status').value = 'Programado';
      document.getElementById('event_title').value = '';
      document.getElementById('event_place').value = '';
      document.getElementById('event_owner').value = '';
      document.getElementById('event_description').value = '';
    }

    function finalizeEventSaveUI() {
      closeModal('eventModal');
      clearEventForm();
    }

    function renderEventSaveUI() {
      requestRender(['dashboard', 'events']);
    }

    function openEventModal() {
      clearEventForm();
      openModal('eventModal');
    }

    function editEventItem(id) {
      const item = state.events.find(entry => entry.id === id);
      if (!item) return;
      editingEventId = id;
      document.getElementById('eventModalTitle').textContent = 'Editar evento / ação';
      document.getElementById('event_date').value = item.date || getDefaultPeriodDate();
      document.getElementById('event_time').value = item.time || '';
      document.getElementById('event_type').value = item.type || 'Evento';
      document.getElementById('event_status').value = item.status || 'Programado';
      document.getElementById('event_title').value = item.title || '';
      document.getElementById('event_place').value = item.place || '';
      document.getElementById('event_owner').value = item.owner || '';
      document.getElementById('event_description').value = item.description || '';
      openModal('eventModal');
    }

    // saveEventItem — delega ao handler CRUD genérico
    const saveEventItem = handleSaveEvent;

    function removeEventItem(id) {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja excluir este evento / ação?', async () => {
        const existing = state.events.find(entry => entry.id === id);
        if (!existing) return;
        state.events = state.events.filter(entry => entry.id !== id);
        const saved = await saveData();
        if (!saved) {
          state.events.push(existing);
          showToast('Falha ao salvar exclusão. Tente novamente.', 'danger');
          return;
        }
        requestRender(['dashboard', 'events']);
      });
    }

    async function duplicateEventItem(id) {
      if (!assertWritableCurrentPeriod()) return;
      const item = state.events.find(entry => entry.id === id);
      if (!item) return;
      const clone = {
        ...structuredClone(item),
        id: crypto.randomUUID(),
        title: `${item.title || 'Evento'} (cópia)`,
        status: 'Programado'
      };
      state.events.push(clone);
      state.events.sort(compareByDateTime);
      const saved = await saveData();
      requestRender(['events', 'dashboard']);
      if (saved) showSaveToast('✓ evento duplicado');
    }

    function renderEvents() {
      const dadosEventos = selecionarDadosEventosAgrupados();
      const list = dadosEventos.lista;
      const monthEvents = state.events || [];
      const totalEventos = monthEvents.filter(item => normalizeEventType(item.type) === 'evento').length;
      const totalAcoes = monthEvents.filter(item => normalizeEventType(item.type) === 'acao').length;
      const totalFeriados = monthEvents.filter(item => normalizeEventType(item.type) === 'feriado').length;
      const totalConfirmados = monthEvents.filter(item => String(item.status || '') === 'Confirmado').length;
      const totalProgramados = monthEvents.filter(item => String(item.status || '') === 'Programado').length;
      aplicarHtmlSeMudou(document.getElementById('eventsQuickSummary'), `
        <span class="events-quick-summary-item type-event">Eventos <strong>${totalEventos}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-action">Ações <strong>${totalAcoes}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-holiday">Feriados <strong>${totalFeriados}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-confirmed">Confirmados <strong>${totalConfirmados}</strong></span>
        <span class="events-quick-summary-sep" aria-hidden="true"></span>
        <span class="events-quick-summary-item type-programmed">Programados <strong>${totalProgramados}</strong></span>
      `);
      const summary = document.getElementById('eventSummaryCards');
      if (summary) {
        aplicarHtmlSeMudou(summary, [
          { label: 'Itens na agenda', value: dadosEventos.total, foot: dadosEventos.total ? `Filtro atual em ${getPeriodLabel()}` : `Sem itens em ${getPeriodLabel()}` },
          { label: 'Próximos', value: dadosEventos.proximos, foot: 'Eventos futuros não cancelados' },
          { label: 'Confirmados', value: dadosEventos.confirmados, foot: 'Programação validada para operação' },
          { label: 'Concluídos', value: dadosEventos.concluidos, foot: 'Ações já executadas no período' }
        ].map(card => `
          <div class="schedule-kpi">
            <div class="schedule-kpi-label">${esc(card.label)}</div>
            <div class="schedule-kpi-value">${esc(card.value)}</div>
            <div class="schedule-kpi-foot">${esc(card.foot)}</div>
          </div>
        `).join(''));
      }

      const eventsList = document.getElementById('eventsList');
      if (!list.length) {
        aplicarHtmlSeMudou(eventsList, `<div class="empty">Nenhum evento ou ação encontrado para os filtros aplicados em ${esc(getPeriodLabel())}.</div>`);
      } else {
        aplicarPatchCards(eventsList, list, item => item.id, item => `
          <div class="event-card">
            <div class="event-head">
              <div>
                <div class="event-title">${esc(item.title || 'Sem título')}</div>
                <div class="event-meta">
                  <span>${esc(getPeriodDisplayDate(item.date))}</span>
                  ${item.time ? `<span>• ${esc(item.time)}</span>` : ''}
                  ${item.place ? `<span>• ${esc(item.place)}</span>` : ''}
                </div>
              </div>
              <span class="event-type">${esc(item.type || 'Evento')}</span>
            </div>
            <div class="event-chip-row">
              ${item.owner ? `<span class="event-chip">Responsável: ${esc(item.owner)}</span>` : ''}
              <span class="event-chip ${eventStatusClass(item.status)}">Status: ${esc(item.status || 'Programado')}</span>
            </div>
            <div class="event-desc">${esc(shortText(item.description || 'Sem descrição adicional.', 170))}</div>
            <div class="ticket-actions">
              <button class="btn btn-ghost btn-xs" data-action="edit-event-item" data-id="${item.id}">Editar</button>
              <button class="btn btn-ghost btn-xs" data-action="duplicate-event-item" data-id="${item.id}">Duplicar</button>
              <button class="btn btn-danger btn-xs" data-action="remove-event-item" data-id="${item.id}">Excluir</button>
            </div>
          </div>
        `);
      }

      const next = dadosEventos.proximo;
      aplicarHtmlSeMudou(document.getElementById('eventsUpcoming'), next ? `
        <div class="event-card">
          <div class="event-head">
            <div>
              <div class="event-title">${esc(next.title)}</div>
              <div class="event-meta">
                <span>${esc(getPeriodDisplayDate(next.date))}</span>
                ${next.time ? `<span>• ${esc(next.time)}</span>` : ''}
                ${next.place ? `<span>• ${esc(next.place)}</span>` : ''}
              </div>
            </div>
            <span class="event-type">${esc(next.type || 'Evento')}</span>
          </div>
          <div class="event-chip-row">
            ${next.owner ? `<span class="event-chip">Responsável: ${esc(next.owner)}</span>` : ''}
            <span class="event-chip ${eventStatusClass(next.status)}">Status: ${esc(next.status || 'Programado')}</span>
          </div>
          <div class="event-desc">${esc(next.description || 'Sem descrição adicional.')}</div>
        </div>
      ` : `<div class="empty">Nenhum evento ou ação programado com os filtros atuais.</div>`);

      renderEventsCalendar(dadosEventos);

      const eventsTableBody = document.getElementById('eventsTableBody');
      if (!list.length) {
        aplicarHtmlSeMudou(eventsTableBody, `<tr><td colspan="8"><div class="empty">Nenhum registro na agenda com os filtros aplicados.</div></td></tr>`);
      } else {
        aplicarPatchLinhas(eventsTableBody, list, item => item.id, item => `
          <tr>
            <td>${esc(getPeriodDisplayDate(item.date))}</td>
            <td>${esc(item.time || '—')}</td>
            <td>${esc(item.type || 'Evento')}</td>
            <td>${renderEllipsisCell(item.title, 'Sem título')}</td>
            <td>${renderEllipsisCell(item.place, '—')}</td>
            <td>${renderEllipsisCell(item.owner, '—')}</td>
            <td><span class="event-chip ${eventStatusClass(item.status)}">${esc(item.status || 'Programado')}</span></td>
            <td class="right">
              <button class="btn btn-ghost btn-xs" data-action="edit-event-item" data-id="${item.id}">Editar</button>
              <button class="btn btn-ghost btn-xs" data-action="duplicate-event-item" data-id="${item.id}">Duplicar</button>
              <button class="btn btn-danger btn-xs" data-action="remove-event-item" data-id="${item.id}">Excluir</button>
            </td>
          </tr>
        `);
      }
    }

    // ══════════════════════════════════════════
    // RENDERIZAÇÃO — SETTINGS & DIAGNOSTICS — renderSettings, saveSettings, resizeMonth, renderBackupSummary, runSystemDiagnostics, importData, exportData
    // ══════════════════════════════════════════

    function renderSettings() {
      if (!state?.settings) return;
      document.getElementById('receptionistEditor').value = getReceptionists(state).join('\n');
      document.getElementById('professorEditor').value = getProfessors(state).join('\n');
      document.getElementById('addonTypeEditor').value = state.settings.addonTypes.join('\n');
      renderSettingsHealthBar();
      renderSettingsSupportPanels();
      renderBackupSummary();
      renderDiagnosticsPanel();
      renderPersistenceTechPanel();
      renderPeriodAudit();
      renderFlowSmokePanel();
    }

    async function saveSettings() {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'students', 'addons', 'pending', 'nps', 'settings'] })) return;
      const { receptionists, professors, addonTypes } = getSettingsFormData();
      if (!receptionists.length || !addonTypes.length) { showToast('Informe ao menos uma recepcionista e um tipo de addon.', 'warning'); return; }
      const old = structuredClone(state);
      state.settings.receptionists = receptionists;
      state.settings.professors = professors;
      state.settings.team = [...new Set([...receptionists, ...professors])];
      state.settings.addonTypes = addonTypes;
      normalizeData(state);
      const removedNames = new Set(getReceptionists(old).filter(name => !getReceptionists(state).includes(name)));
      removedNames.forEach(oldName => {
        state.students = state.students.map(s => s.atendimento === oldName ? { ...s, atendimento: getReceptionists(state)[0] } : s);
        state.pending = state.pending.map(p => p.hostess === oldName ? { ...p, hostess: getReceptionists(state)[0] } : p);
      });
      if (removedNames.size) {
        state.nps.mentions = state.nps.mentions.filter(m => !removedNames.has(m.name));
      }
      const saved = await saveData();
      populateStudentFilters();
      requestRender(['dashboard', 'students', 'addons', 'pending', 'nps', 'settings']);
      if (saved) showToast('Configurações salvas com sucesso.');
    }

    function resizeMonth(days) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'addons'] })) return;
      const newDays = Number(days);
      const oldDays = state.settings.monthDays;

      // Verificar se há dados nos dias que serão cortados
      if (newDays < oldDays) {
        const hasDataInLostDays = Object.values(state.addons || {}).some(group =>
          Object.values(group || {}).some(arr =>
            Array.isArray(arr) && arr.slice(newDays).some(v => Number(v || 0) > 0)
          )
        );
        if (hasDataInLostDays) {
          showConfirm(
            `Há dados de addons nos dias ${newDays + 1} a ${oldDays} que serão perdidos. Deseja continuar?`,
            () => doResizeMonth(newDays)
          );
          return;
        }
      }

      doResizeMonth(newDays);
    }

    function doResizeMonth(days) {
      state.settings.monthDays = days;
      Object.keys(state.addons || {}).forEach(person => {
        const knownTypes = [...new Set([...state.settings.addonTypes, ...Object.keys(state.addons[person] || {})])];
        knownTypes.forEach(type => {
          const old = state.addons[person]?.[type] || [];
          state.addons[person][type] = Array.from({ length: state.settings.monthDays }, (_, i) => Number(old[i] || 0));
        });
      });
      saveData();
      requestRender(['hero', 'dashboard', 'addons']);
    }

    function getPeriodMetrics(period) {
      normalizeData(period);
      return {
        recados: period.recados.length,
        students: period.students.length,
        pending: period.pending.length,
        events: period.events.length,
        scale: period.scale.length,
        mentions: period.nps.mentions.length,
        addonVolume: Object.values(period.addons || {}).reduce((acc, byType) => acc + Object.values(byType || {}).reduce((sum, days) => sum + (days || []).reduce((dayAcc, value) => dayAcc + Number(value || 0), 0), 0), 0)
      };
    }

    function getBackupSummary(storeRef = storage) {
      const periods = Object.entries(storeRef.periods || {});
      const totals = periods.reduce((acc, [_, period]) => {
        const metrics = getPeriodMetrics(period);
        acc.recados += metrics.recados;
        acc.students += metrics.students;
        acc.pending += metrics.pending;
        acc.events += metrics.events;
        acc.scale += metrics.scale;
        acc.mentions += metrics.mentions;
        acc.addonVolume += metrics.addonVolume;
        return acc;
      }, { recados: 0, students: 0, pending: 0, events: 0, scale: 0, mentions: 0, addonVolume: 0 });
      return {
        periods: periods.length,
        archives: Object.keys(storeRef.archives || {}).length,
        ...totals
      };
    }

    function formatBytes(bytes) {
      const value = Math.max(0, Number(bytes || 0));
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${value} B`;
    }

    function getSettingsStorageUsage() {
      const quotaBytes = 5 * 1024 * 1024;
      try {
        const relevantKeys = [];
        const knownKeys = new Set([
          STORAGE_KEY,
          STORAGE_BROADCAST_KEY,
          LOCAL_SNAPSHOT_KEY,
          SYSTEM_REPORT_KEY,
          FLOW_TEST_REPORT_KEY,
          UI_KEY,
          ...LEGACY_STORAGE_KEYS,
          ...LEGACY_LOCAL_SNAPSHOT_KEYS,
          ...LEGACY_SYSTEM_REPORT_KEYS,
          ...LEGACY_FLOW_TEST_REPORT_KEYS,
          ...LEGACY_UI_KEYS
        ]);
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (!key) continue;
          if (key.startsWith('wpm_') || knownKeys.has(key)) relevantKeys.push(key);
        }
        const bytes = relevantKeys.reduce((acc, key) => {
          const raw = localStorage.getItem(key);
          return acc + new Blob([JSON.stringify({ key, value: raw ?? '' })]).size;
        }, 0);
        return {
          bytes,
          quotaBytes,
          ratio: quotaBytes ? Math.min(1, bytes / quotaBytes) : 0,
          keyCount: relevantKeys.length,
          status: bytes / quotaBytes >= 0.8 ? 'warn' : 'ok'
        };
      } catch (error) {
        console.error('Falha ao calcular uso do armazenamento local:', error);
        return {
          bytes: 0,
          quotaBytes,
          ratio: 0,
          keyCount: 0,
          status: 'info',
          error: true
        };
      }
    }

    function getSettingsMetaSnapshot() {
      const summary = getBackupSummary(storage);
      const periodEntries = Object.entries(storage.periods || {});
      const monthsWithData = periodEntries.filter(([, period]) => periodHasMeaningfulData(period)).length;
      const totalRecords = periodEntries.reduce((acc, [, period]) => {
        const metrics = getPeriodMetrics(period);
        return acc + metrics.students + metrics.pending + metrics.events;
      }, 0);
      const emptyMonths = periodEntries.filter(([key, period]) => key !== currentPeriodKey && !periodHasMeaningfulData(period) && loadRecados(key).length === 0).length;
      const storageUsage = getSettingsStorageUsage();
      let lastBackupLabel = 'Não rastreado';
      try {
        const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
        if (snapshot?.savedAt) lastBackupLabel = new Date(snapshot.savedAt).toLocaleString('pt-BR');
      } catch (error) {
        console.error('Falha ao ler snapshot local:', error);
      }
      return {
        summary,
        monthsWithData,
        totalRecords,
        emptyMonths,
        storageUsage,
        lastBackupLabel
      };
    }

    function renderSettingsHealthBar() {
      const host = document.getElementById('settingsHealthBar');
      if (!host) return;
      const meta = getSettingsMetaSnapshot();
      const storageStatusLabel = meta.storageUsage.error
        ? 'Leitura local indisponível'
        : meta.storageUsage.status === 'warn'
          ? 'Espelho local próximo do limite'
          : 'Espelho local OK';
      const storagePill = meta.storageUsage.error
        ? 'info'
        : meta.storageUsage.status === 'warn'
          ? 'warn'
          : 'ok';
      aplicarHtmlSeMudou(host, `
        <span class="settings-health-item"><span class="pill ${storagePill}">${esc(storageStatusLabel)}</span></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Meses com dados</span><strong>${meta.monthsWithData}</strong></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Último backup/snapshot</span><strong>${esc(meta.lastBackupLabel)}</strong></span>
        <span class="settings-health-sep" aria-hidden="true"></span>
        <span class="settings-health-item"><span>Total de registros</span><strong>${meta.totalRecords}</strong></span>
      `);
    }

    function renderSettingsSupportPanels() {
      const meta = getSettingsMetaSnapshot();
      const aboutHost = document.getElementById('settingsAboutPanel');
      const storageHost = document.getElementById('settingsStorageUsage');
      const maintenanceHost = document.getElementById('settingsMaintenanceList');

      if (aboutHost) {
        aplicarHtmlSeMudou(aboutHost, `
          <div class="settings-about-grid">
            <div class="settings-about-item">
              <div class="name">Versão</div>
              <div class="value">${esc(APP_VERSION)}</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Autor</div>
              <div class="value">Wallace Phillip Maclayne</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Tecnologia</div>
              <div class="value">HTML/CSS/JS + persistência local híbrida (IndexedDB + localStorage)</div>
            </div>
            <div class="settings-about-item">
              <div class="name">Descrição</div>
              <div class="value">SPA single-file para operação interna da recepção, com controle mensal independente por período.</div>
            </div>
          </div>
        `);
      }

      if (storageHost) {
        const usage = meta.storageUsage;
        const toneClass = usage.error ? 'info' : usage.status === 'warn' ? 'warn' : 'ok';
        const usageLabel = usage.error ? 'Leitura indisponível' : usage.status === 'warn' ? 'Espelho local próximo do limite estimado' : 'Espelho local em faixa confortável';
        aplicarHtmlSeMudou(storageHost, `
          <div class="settings-storage-box">
            <div class="settings-storage-top">
              <span class="pill ${toneClass}">${esc(usageLabel)}</span>
              <span class="muted">${esc(formatBytes(usage.bytes))} de ${esc(formatBytes(usage.quotaBytes))}</span>
            </div>
            <div class="settings-storage-bar" aria-hidden="true">
              <div class="settings-storage-fill" style="width:${Math.min(100, usage.ratio * 100)}%"></div>
            </div>
            <div class="settings-storage-meta">
              <span>Uso estimado do espelho local <strong>${usage.error ? '—' : `${(usage.ratio * 100).toFixed(1)}%`}</strong></span>
              <span>Chaves monitoradas <strong>${usage.keyCount}</strong></span>
              <span>Escopo <strong>localStorage monitorado do app</strong></span>
            </div>
            <div class="settings-storage-foot">Estimativa local de 5 MB para o espelho em localStorage. A persistência principal do app usa IndexedDB; este painel mostra somente as chaves locais auxiliares e de compatibilidade desta versão.</div>
          </div>
        `);
      }

      if (maintenanceHost) {
        aplicarHtmlSeMudou(maintenanceHost, `
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Exportação consolidada</div>
              <div class="muted">O backup JSON já inclui todos os períodos carregados, arquivos fechados e snapshots necessários para restauração.</div>
            </div>
          </div>
          <div class="summary-item summary-item--col1">
            <div>
              <div class="name">Limpeza de meses vazios</div>
              <div class="muted">${meta.emptyMonths} período(s) sem massa operacional nem recados podem ser removidos com segurança.</div>
            </div>
          </div>
        `);
      }
    }

    function csvEscape(value) {
      const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
      return /[";,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
    }

    function buildCsvContent(rows) {
      return rows.map(row => row.map(csvEscape).join(';')).join('\n');
    }

    function downloadCsvFile(filename, rows) {
      const csv = buildCsvContent(rows);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      return csv;
    }

    function getPendingCsvRows(period = state) {
      const list = (period.pending || []).slice().sort((a, b) => compareByDateTime(a, b));
      return [
        ['Nome', 'Matrícula', 'Pendência', 'Solicitação', 'Hostess', 'Resposta', 'Status'],
        ...list.map(item => [item.nome || '', item.matricula || '', item.pendencia || '', item.data || '', item.hostess || '', item.resposta || '', item.status || ''])
      ];
    }

    function getScaleCsvRows(period = state) {
      const rows = [['Data', 'Professor', 'Horário professor', 'Troca professor', 'Recepção', 'Horário recepção', 'Troca recepção', 'Tom da linha', 'Observação']];
      (period.scale || []).slice().sort((a, b) => compareByDateTime(a, b)).forEach(item => {
        const shifts = item.professorShifts?.length ? item.professorShifts : [{ time: '', name: '', swap: '' }];
        shifts.forEach(shift => {
          rows.push([item.date || '', shift.name || '', shift.time || '', shift.swap || '', item.receptionist || '', item.receptionTime || '', item.receptionSwap || '', item.rowTone || '', item.note || '']);
        });
      });
      return rows;
    }

    function getEventsCsvRows(period = state) {
      const list = (period.events || []).slice().sort((a, b) => compareByDateTime(a, b));
      return [
        ['Data', 'Hora', 'Tipo', 'Título', 'Local', 'Responsável', 'Status', 'Descrição'],
        ...list.map(item => [item.date || '', item.time || '', item.type || '', item.title || '', item.place || '', item.owner || '', item.status || '', item.description || ''])
      ];
    }

    function exportPendingCsv() {
      return downloadCsvFile(`pendencias-${currentPeriodKey}.csv`, getPendingCsvRows());
    }

    function exportScaleCsv() {
      return downloadCsvFile(`escala-${currentPeriodKey}.csv`, getScaleCsvRows());
    }

    function exportEventsCsv() {
      return downloadCsvFile(`eventos-${currentPeriodKey}.csv`, getEventsCsvRows());
    }

    function loadFlowSmokeReport() {
      return readStoredJsonWithFallback(FLOW_TEST_REPORT_KEY, LEGACY_FLOW_TEST_REPORT_KEYS, []);
    }

    function saveFlowSmokeReport(report) {
      writeStoredJson(FLOW_TEST_REPORT_KEY, report);
      removeStoredValues(LEGACY_FLOW_TEST_REPORT_KEYS);
      return report;
    }

    function clearFlowSmokeTests() {
      removeStoredValues([FLOW_TEST_REPORT_KEY, ...LEGACY_FLOW_TEST_REPORT_KEYS]);
      requestRender('settings');
      showSaveToast('✓ relatório de autotestes limpo');
    }

    function renderFlowSmokePanel() {
      const host = document.getElementById('flowSmokeList');
      if (!host) return;
      const report = loadFlowSmokeReport();
      if (!report.length) {
        host.innerHTML = `<div class="summary-item summary-item--col1"><div><div class="name">Autotestes ainda não executados</div><div class="muted">Use “Executar autotestes” para validar backup, reset e CSVs sem alterar os dados reais.</div></div></div>`;
        return;
      }
      host.innerHTML = report.map(item => `
        <div class="summary-item summary-item--col2">
          <div><span class="pill ${item.status === 'ok' ? 'ok' : item.status === 'bad' ? 'bad' : item.status === 'warn' ? 'warn' : 'info'}">${item.status === 'ok' ? 'OK' : item.status === 'bad' ? 'Falha' : item.status === 'warn' ? 'Alerta' : 'Info'}</span></div>
          <div>
            <div class="name">${esc(item.label)}</div>
            <div class="muted">${esc(item.detail)}</div>
          </div>
        </div>
      `).join('');
    }

    function runFlowSmokeTests(silent = false) {
      const clonedStore = normalizeStore(structuredClone(storage));
      const originalSummary = getBackupSummary(clonedStore);
      const payload = {
        version: clonedStore.version,
        activePeriod: clonedStore.activePeriod,
        periods: clonedStore.periods,
        archives: clonedStore.archives
      };
      const roundTripStore = normalizeStore(JSON.parse(JSON.stringify(payload)));
      const roundTripSummary = getBackupSummary(roundTripStore);
      const activePeriod = clonedStore.periods[clonedStore.activePeriod];
      const pendingCsv = buildCsvContent(getPendingCsvRows(activePeriod));
      const scaleCsv = buildCsvContent(getScaleCsvRows(activePeriod));
      const eventsCsv = buildCsvContent(getEventsCsvRows(activePeriod));
      const resetClone = normalizeStore(structuredClone(storage));
      const resetKey = resetClone.activePeriod;
      resetClone.periods[resetKey] = buildEmptyPeriodFromTemplate(resetClone.periods[resetKey], resetKey);
      normalizeData(resetClone.periods[resetKey]);
      const resetMetrics = getPeriodMetrics(resetClone.periods[resetKey]);
      const report = [
        {
          label: 'Round-trip de backup JSON',
          status: JSON.stringify(originalSummary) === JSON.stringify(roundTripSummary) ? 'ok' : 'bad',
          detail: `${originalSummary.periods} períodos comparados antes e depois da serialização.`
        },
        {
          label: 'Exportação CSV de pendências',
          status: pendingCsv.split('\n').length > 1 ? 'ok' : 'bad',
          detail: `${Math.max(0, pendingCsv.split('\n').length - 1)} linha(s) de dados prontas para exportação em ${getPeriodLabel(resetKey)}.`
        },
        {
          label: 'Exportação CSV de escala',
          status: scaleCsv.split('\n').length > 1 ? 'ok' : 'bad',
          detail: `${Math.max(0, scaleCsv.split('\n').length - 1)} linha(s) de escala preparadas para download.`
        },
        {
          label: 'Exportação CSV de eventos',
          status: eventsCsv.split('\n').length > 1 ? 'ok' : 'bad',
          detail: `${Math.max(0, eventsCsv.split('\n').length - 1)} linha(s) de agenda preparadas para download.`
        },
        {
          label: 'Reset do mês em simulação',
          status: resetMetrics.recados === 0 && resetMetrics.students === 0 && resetMetrics.pending === 0 && resetMetrics.events === 0 && resetMetrics.scale === 0 && resetMetrics.mentions === 0 && resetMetrics.addonVolume === 0 ? 'ok' : 'bad',
          detail: `${resetMetrics.recados} recados • ${resetMetrics.students} alunos • ${resetMetrics.pending} pendências • ${resetMetrics.events} eventos • ${resetMetrics.scale} registros de escala • ${resetMetrics.mentions} menções • ${resetMetrics.addonVolume} addons após reset simulado.`
        },
        {
          label: 'Cobertura anual mínima',
          status: Object.keys(clonedStore.periods || {}).length >= 12 ? 'ok' : 'warn',
          detail: `${Object.keys(clonedStore.periods || {}).length} períodos disponíveis para navegação/teste.`
        }
      ];
      saveFlowSmokeReport(report);
      requestRender('settings');
      if (!silent) {
        const failures = report.filter(item => item.status === 'bad').length;
        const warnings = report.filter(item => item.status === 'warn').length;
        const type = failures > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success';
        showToast(`Autotestes concluídos: ${report.length - failures - warnings} ok, ${warnings} alerta(s), ${failures} falha(s).`, type, 4500);
      }
      return report;
    }

    function isLegacyPeriodPayload(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      return ['settings', 'students', 'pending', 'recados', 'nps', 'scale', 'events', 'addons', 'escala', 'eventos'].some(key => key in payload);
    }

    function extractImportedPayload(source) {
      const cleanedRoot = sanitizeDeep(cloneSerializable(source));
      const payload = cleanedRoot?.payload && typeof cleanedRoot.payload === 'object' && !Array.isArray(cleanedRoot.payload)
        ? cleanedRoot.payload
        : cleanedRoot;
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    }

    function isMonthArchivePayload(payload) {
      return Boolean(
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        isValidPeriodKey(payload.periodKey) &&
        payload.data &&
        typeof payload.data === 'object' &&
        !Array.isArray(payload.data)
      );
    }

    function getMonthArchiveImportMeta(payload) {
      if (!isMonthArchivePayload(payload)) return null;
      const periodKey = String(payload.periodKey);
      return {
        periodKey,
        periodLabel: String(payload.periodLabel || '').trim() || getPeriodLabel(periodKey),
        exportedAt: String(payload?.meta?.exportedAt || '').trim()
      };
    }

    function buildArchiveEntryFromMonthArchivePayload(payload, existingArchive = null) {
      const meta = getMonthArchiveImportMeta(payload);
      if (!meta) return existingArchive || null;
      const exportedDate = meta.exportedAt ? new Date(meta.exportedAt) : null;
      const hasValidExportedDate = exportedDate && !Number.isNaN(exportedDate.getTime());
      const fallbackDate = existingArchive?.closedAt ? new Date(existingArchive.closedAt) : new Date();
      const normalizedDate = hasValidExportedDate ? exportedDate : fallbackDate;

      return {
        closedAt: normalizedDate.toISOString(),
        closedAtLabel: normalizedDate.toLocaleString('pt-BR'),
        label: meta.periodLabel || existingArchive?.label || getPeriodLabel(meta.periodKey)
      };
    }

    function buildStoreFromMonthArchivePayload(payload, baseStore = storage) {
      const meta = getMonthArchiveImportMeta(payload);
      if (!meta) return null;

      const baseCandidate = prepareStoreCandidate(cloneSerializable(baseStore)) || getDefaultStore();
      const nextStore = cloneSerializable(baseCandidate);
      nextStore.periods ||= {};
      nextStore.archives ||= {};
      nextStore.periods[meta.periodKey] = cloneSerializable(payload.data);
      normalizeData(nextStore.periods[meta.periodKey]);
      nextStore.archives[meta.periodKey] = buildArchiveEntryFromMonthArchivePayload(payload, nextStore.archives[meta.periodKey]);
      return prepareStoreCandidate(nextStore);
    }

    function getImportedPayloadDescriptor(source) {
      const payload = extractImportedPayload(source);
      if (!payload) return { kind: 'unknown' };
      if (isMonthArchivePayload(payload)) {
        const meta = getMonthArchiveImportMeta(payload);
        return {
          kind: 'month-archive',
          periodKey: meta.periodKey,
          periodLabel: meta.periodLabel
        };
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return {
          kind: 'full-backup',
          periodCount: Object.keys(payload.periods).filter(isValidPeriodKey).length
        };
      }
      if (isLegacyPeriodPayload(payload)) {
        return { kind: 'legacy-period' };
      }
      return { kind: 'unknown' };
    }

    function coerceImportedStore(source) {
      const payload = extractImportedPayload(source);
      if (!payload) return null;
      if (isMonthArchivePayload(payload)) {
        return buildStoreFromMonthArchivePayload(payload, storage);
      }
      if (payload.periods && typeof payload.periods === 'object' && !Array.isArray(payload.periods)) {
        return prepareStoreCandidate(payload);
      }
      if (isLegacyPeriodPayload(payload)) {
        const initialKey = getInitialPeriodKey();
        return prepareStoreCandidate({
          version: getStoreVersion(payload),
          activePeriod: initialKey,
          periods: { [initialKey]: payload },
          archives: {}
        });
      }
      return null;
    }

    async function buildBackupPayload(options = {}) {
      // Export = store saneado atual, opcionalmente persistido antes de gerar o JSON.
      const storeSnapshot = await getCommittedStoreSnapshot({
        persistCurrent: options?.persistCurrent !== false,
        eventType: String(options?.eventType || 'save'),
        broadcast: options?.broadcast === true
      });
      return buildBackupPayloadFromStore(storeSnapshot);
    }

    async function applyImportedStore(parsed, options = {}) {
      // Import/restore = sanitize -> normalize -> persist -> recarregar store principal -> sync UI.
      // Fechamento mensal é mesclado ao store atual como período arquivado; backup
      // completo continua substituindo a base inteira.
      const normalized = coerceImportedStore(parsed);
      if (!normalized) throw new Error('Estrutura inválida ou incompatível com o schema atual.');
      const saved = await saveStore(normalized, {
        silent: true,
        eventType: String(options.eventType || 'import')
      });
      if (!saved) throw new Error('Falha ao persistir o backup importado.');
      const committedStore = await readStoredStore(STORAGE_KEY);
      if (!committedStore) throw new Error('Falha ao recarregar o store importado após persistir.');
      await syncAppState(committedStore);
      renderAll();
      syncPeriodControls();
      runSystemDiagnostics(true);
      return getBackupSummary(storage);
    }

    async function saveLocalSnapshot(payload = null) {
      const snapshotPayload = payload || await buildBackupPayload({
        persistCurrent: true,
        eventType: 'snapshot',
        broadcast: false
      });
      const snapshot = { savedAt: new Date().toISOString(), payload: snapshotPayload };
      const result = await persistStoredJson(
        LOCAL_SNAPSHOT_KEY,
        snapshot,
        'Armazenamento cheio. Não foi possível salvar o snapshot local.'
      );
      if (result.ok) {
        await removeStoredValues(LEGACY_LOCAL_SNAPSHOT_KEYS);
        requestRender('settings');
        showSaveToast('✓ snapshot local salvo');
      }
      return result.ok ? snapshot : null;
    }

    function restoreLocalSnapshot() {
      if (!assertWritableCurrentPeriod()) return;
      const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
      if (!snapshot) { showToast('Nenhum snapshot local foi salvo ainda.', 'info'); return; }
      showConfirm('Deseja restaurar o último snapshot local? Isso substituirá o estado atual.', async () => {
        try {
          const summary = await applyImportedStore(snapshot.payload || snapshot, { eventType: 'restore' });
          showToast(`Snapshot restaurado: ${summary.periods} períodos carregados.`);
        } catch {
          showToast('Snapshot local inválido ou corrompido.', 'danger');
        }
      });
    }

    function loadSystemReport() {
      return readStoredJsonWithFallback(SYSTEM_REPORT_KEY, LEGACY_SYSTEM_REPORT_KEYS, []);
    }

    function saveSystemReport(report) {
      writeStoredJson(SYSTEM_REPORT_KEY, report);
      removeStoredValues(LEGACY_SYSTEM_REPORT_KEYS);
      return report;
    }

    function runSystemDiagnostics(silent = false) {
      const periodEntries = Object.entries(storage.periods || {});
      const currentMetrics = getPeriodMetrics(state);
      const receptionists = new Set(getReceptionists(state));
      const employees = getAllEmployees(state);
      const mentionNames = new Set((state.nps.mentions || []).map(item => item.name).filter(Boolean));
      const report = [
        {
          label: 'Estrutura principal do armazenamento',
          status: storage.activePeriod && storage.periods?.[storage.activePeriod] ? 'ok' : 'bad',
          detail: storage.activePeriod && storage.periods?.[storage.activePeriod] ? `Período ativo ${getPeriodLabel(storage.activePeriod)} disponível.` : 'Período ativo ausente no armazenamento.'
        },
        {
          label: 'Atendimentos vinculados a recepcionistas',
          status: state.students.every(item => receptionists.has(item.atendimento)) ? 'ok' : 'bad',
          detail: `${state.students.filter(item => receptionists.has(item.atendimento)).length}/${state.students.length} registros válidos no período ativo.`
        },
        {
          label: 'Pendências vinculadas a recepcionistas',
          status: state.pending.every(item => receptionists.has(item.hostess)) ? 'ok' : 'bad',
          detail: `${state.pending.filter(item => receptionists.has(item.hostess)).length}/${state.pending.length} pendências com hostess válida.`
        },
        {
          label: 'Cobertura de NPS do período ativo',
          status: employees.every(name => mentionNames.has(name)) ? 'ok' : 'warn',
          detail: `${mentionNames.size}/${employees.length} funcionários aparecem nas citações do NPS.`
        },
        {
          label: 'Massa de teste do período ativo',
          status: currentMetrics.students >= 30 && currentMetrics.pending >= 20 && currentMetrics.events >= 10 && currentMetrics.scale > 0 ? 'ok' : 'warn',
          detail: `${currentMetrics.students} alunos • ${currentMetrics.pending} pendências • ${currentMetrics.events} eventos • ${currentMetrics.scale} turnos de escala.`
        },
        {
          label: 'Cobertura anual carregada',
          status: periodEntries.length >= 12 ? 'ok' : 'warn',
          detail: `${periodEntries.length} períodos disponíveis no armazenamento atual.`
        },
        {
          label: 'Snapshot local disponível',
          status: hasStoredValueWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS) ? 'ok' : 'info',
          detail: hasStoredValueWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS) ? 'Existe um snapshot local pronto para restauração rápida.' : 'Nenhum snapshot local salvo ainda.'
        }
      ];
      saveSystemReport(report);
      if (!silent) {
        const failures = report.filter(item => item.status === 'bad').length;
        const warnings = report.filter(item => item.status === 'warn').length;
        const type = failures > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success';
        showToast(`Validação concluída: ${report.length - failures - warnings} ok, ${warnings} alerta(s), ${failures} falha(s).`, type, 4500);
      }
      requestRender('settings');
      return report;
    }

    function renderBackupSummary() {
      const host = document.getElementById('backupSummaryList');
      if (!host) return;
      const summary = getBackupSummary();
      let snapshotText = 'Nenhum snapshot local salvo.';
      try {
        const snapshot = readStoredJsonWithFallback(LOCAL_SNAPSHOT_KEY, LEGACY_LOCAL_SNAPSHOT_KEYS, null);
        if (snapshot?.savedAt) snapshotText = `Último snapshot local em ${new Date(snapshot.savedAt).toLocaleString('pt-BR')}.`;
      } catch {}
      host.innerHTML = `
        <div class="summary-item summary-item--backup">
          <div>
            <div class="name">Backup ativo</div>
            <div class="muted">${esc(getPeriodLabel())} • ${esc(APP_VERSION)}</div>
          </div>
          <div class="metric"><strong>${summary.periods}</strong><span>Períodos</span></div>
          <div class="metric"><strong>${summary.archives}</strong><span>Arquivos</span></div>
          <div class="metric"><strong>${summary.students + summary.pending + summary.events}</strong><span>Itens principais</span></div>
        </div>
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Resumo consolidado</div>
            <div class="muted">${summary.recados} recados • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos • ${summary.scale} turnos • ${summary.mentions} citações de NPS • volume de addons ${summary.addonVolume}.</div>
            <div class="subtle-note">${esc(snapshotText)}</div>
          </div>
        </div>
      `;
    }

    function renderDiagnosticsPanel() {
      const host = document.getElementById('diagnosticSummaryList');
      if (!host) return;
      const report = loadSystemReport();
      if (!report.length) {
        host.innerHTML = `<div class="summary-item summary-item--col1"><div><div class="name">Validação ainda não executada</div><div class="muted">Use o botão Validar sistema para gerar um relatório rápido da base atual.</div></div></div>`;
        return;
      }
      host.innerHTML = report.map(item => `
        <div class="summary-item summary-item--diagnostic">
          <div><span class="pill ${item.status === 'ok' ? 'ok' : item.status === 'bad' ? 'bad' : item.status === 'warn' ? 'warn' : 'info'}">${item.status === 'ok' ? 'OK' : item.status === 'bad' ? 'Falha' : item.status === 'warn' ? 'Alerta' : 'Info'}</span></div>
          <div>
            <div class="name">${esc(item.label)}</div>
            <div class="muted">${esc(item.detail)}</div>
          </div>
        </div>
      `).join('');
    }

    function renderPersistenceTechPanel() {
      const host = document.getElementById('persistenceTechList');
      if (!host) return;

      const statusPillClass = persistenceTechState.status === 'pronto'
        ? 'ok'
        : persistenceTechState.status === 'sincronizando'
          ? 'warn'
          : 'bad';
      const statusLabel = persistenceTechState.status === 'pronto'
        ? 'Pronto'
        : persistenceTechState.status === 'sincronizando'
          ? 'Sincronizando'
          : 'Erro';
      const selfTestClass = persistenceTechState.selfTest.status === 'ok'
        ? 'ok'
        : persistenceTechState.selfTest.status === 'bad'
          ? 'bad'
          : 'info';
      const selfTestLabel = persistenceTechState.selfTest.status === 'ok'
        ? 'OK'
        : persistenceTechState.selfTest.status === 'bad'
          ? 'Falha'
          : 'Info';

      host.innerHTML = `
        <div class="summary-item summary-item--col1">
          <div>
            <div class="name">Painel técnico de persistência</div>
            <div class="muted">Somente leitura; o autoteste é executado sob demanda.</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Modo de persistência</div>
            <div class="muted">${esc(persistenceTechState.modeLabel)}</div>
          </div>
          <div>
            <div class="name">Status da persistência</div>
            <div class="muted"><span class="pill ${statusPillClass}">${statusLabel}</span></div>
          </div>
          <div>
            <div class="name">Backend principal</div>
            <div class="muted">${esc(persistenceTechState.backendLabel)}</div>
          </div>
          <div>
            <div class="name">Broadcast cross-tab</div>
            <div class="muted">${persistenceTechState.broadcastAvailable ? 'ativo' : 'indisponível'}</div>
          </div>
        </div>
        <div class="summary-item summary-item--col4">
          <div>
            <div class="name">Última gravação bem-sucedida</div>
            <div class="muted">${esc(formatPersistenceTimestamp(persistenceTechState.lastSuccessAt))}</div>
          </div>
          <div>
            <div class="name">Último tipo de operação</div>
            <div class="muted">${esc(persistenceTechState.lastOperationType)}</div>
          </div>
          <div>
            <div class="name">Versão do payload/store</div>
            <div class="muted">${esc(String(persistenceTechState.storeVersion || STORE_VERSION))}</div>
          </div>
          <div>
            <div class="name">Autoteste de persistência</div>
            <div class="muted"><span class="pill ${selfTestClass}">${selfTestLabel}</span> ${esc(persistenceTechState.selfTest.detail)}</div>
          </div>
        </div>
      `;
    }

    function renderPeriodAudit() {
      const host = document.getElementById('periodAuditList');
      if (!host) return;
      const entries = Object.entries(storage.periods || {}).sort(([a], [b]) => a.localeCompare(b));
      host.innerHTML = entries.map(([key, period]) => {
        const metrics = getPeriodMetrics(period);
        const isEmpty = !periodHasMeaningfulData(period) && loadRecados(key).length === 0;
        const coverageOk = !isEmpty && metrics.students >= 30 && metrics.pending >= 20 && metrics.events >= 10 && metrics.scale > 0;
        const [year, month] = String(key).split('-');
        const monthName = MONTH_NAMES[Math.max(0, Number(month || 1) - 1)] || month;
        return `
          <div class="summary-item summary-item--audit settings-period-card ${isEmpty ? 'is-empty' : ''}">
            <div class="settings-period-head">
              <div class="settings-period-title">
                <div class="settings-period-month">${esc(monthName)}</div>
                <div class="settings-period-year">${esc(year)}</div>
                <div class="settings-period-meta">Ref. ${esc(String(key))}</div>
              </div>
              <div class="settings-period-status"><span class="pill ${isEmpty ? 'info' : coverageOk ? 'ok' : 'warn'}">${isEmpty ? 'Vazio' : coverageOk ? 'Completo' : 'Revisar'}</span></div>
            </div>
            <div class="settings-period-kpis">
              <div class="settings-period-kpi"><strong>${metrics.students}</strong><span>Alunos</span></div>
              <div class="settings-period-kpi"><strong>${metrics.pending}</strong><span>Pend.</span></div>
              <div class="settings-period-kpi"><strong>${metrics.events}</strong><span>Eventos</span></div>
              <div class="settings-period-kpi"><strong>${metrics.scale}</strong><span>Escala</span></div>
            </div>
            <div class="settings-period-foot">
              <span class="settings-period-chip">NPS ${metrics.mentions}</span>
              <span class="settings-period-chip">Addons ${metrics.addonVolume}</span>
              ${isEmpty ? '<span class="settings-period-chip">Sem massa operacional</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    async function clearEmptyMonths() {
      const removable = Object.entries(storage.periods || {})
        .filter(([key, period]) => key !== currentPeriodKey && !periodHasMeaningfulData(period) && loadRecados(key).length === 0)
        .map(([key]) => key);
      if (!removable.length) {
        showToast('Nenhum mês vazio encontrado para limpeza.', 'info');
        return;
      }
      showConfirm(`Remover ${removable.length} período(s) vazio(s) do armazenamento local? Essa ação mantém o mês ativo e ignora meses com recados.`, async () => {
        removable.forEach(key => {
          delete storage.periods[key];
        });
        const saved = await saveStore(storage);
        requestRender('settings');
        if (saved) showToast(`✓ ${removable.length} período(s) vazio(s) removido(s).`, 'success');
      });
    }

    async function downloadData() {
      const payload = await buildBackupPayload({
        persistCurrent: true,
        eventType: 'backup',
        broadcast: false
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const now = new Date();
      const ts = `${todayISO()}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
      a.download = `smartfit-recepcao-backup-${ts}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      await saveLocalSnapshot(payload);
      showSaveToast('✓ backup exportado com sucesso');
    }

    function importData(file) {
      if (!assertWritableCurrentPeriod()) return;
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { showToast('Arquivo muito grande (máximo: 50MB).', 'danger'); return; }
      if (!file.name.endsWith('.json')) { showToast('Formato inválido. Selecione um arquivo .json.', 'warning'); return; }
      const reader = new FileReader();
      reader.onerror = () => showToast('Erro ao ler o arquivo. Tente novamente.', 'danger');
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result);
          const descriptor = getImportedPayloadDescriptor(parsed);
          const importedStore = coerceImportedStore(parsed);
          if (!importedStore) throw new Error('Dados não reconhecidos');
          const confirmMessage = descriptor.kind === 'month-archive'
            ? `Confirmar importação do fechamento de ${descriptor.periodLabel}? Somente ${descriptor.periodLabel} será restaurado/atualizado e marcado como fechado. Um backup será gerado antes.`
            : 'Confirmar importação e substituir todos os dados atuais? Um backup será gerado antes.';
          showConfirm(confirmMessage, async () => {
            try {
              await downloadData();
              const summary = await applyImportedStore(parsed, { eventType: 'import' });
              const successMessage = descriptor.kind === 'month-archive'
                ? `Fechamento de ${descriptor.periodLabel} importado com sucesso. Demais períodos foram preservados.`
                : `Backup importado: ${summary.periods} períodos • ${summary.students} alunos • ${summary.pending} pendências • ${summary.events} eventos.`;
              showToast(successMessage, 'success', 5000);
            } catch (err) {
              showToast('Erro ao aplicar backup: ' + (err.message || 'erro desconhecido'), 'danger');
            }
          });
        } catch (err) {
          showToast('Arquivo inválido. Importe um backup JSON gerado pelo app. Detalhe: ' + (err.message || 'erro desconhecido'), 'danger', 5000);
        }
      };
      reader.readAsText(file);
    }

    function resetDemoData() {
      if (!assertWritableCurrentPeriod()) return;
      showConfirm('Deseja restaurar o exemplo inicial? Isso substituirá os dados atuais.', async () => {
        const initialKey = getInitialPeriodKey();
        storage = normalizeStore({ activePeriod: initialKey, periods: seedYear(String(initialKey).split('-')[0]), archives: {} });
        currentPeriodKey = storage.activePeriod;
        state = storage.periods[currentPeriodKey];
        await saveData();
        renderAll();
        syncPeriodControls();
      });
    }

    function renderAll() {
      limparFilaRender();
      normalizeData(state);
      populateStudentFilters();
      applyUIStateToControls();
      renderSections('hero', 'dashboard', 'students', 'addons', 'pending', 'nps', 'scale', 'events', 'settings');
      syncCurrentPeriodLockUI();
    }

    async function syncAppState(storeLike = null) {
      const sourceStore = storeLike || storage || await loadStore();
      storage = prepareStoreCandidate(sourceStore) || getDefaultStore();
      await migrateLegacyRecadosToStore(storage, {
        persist: true,
        cleanup: true,
        eventType: 'recados-migration'
      });
      currentPeriodKey = storage.activePeriod;
      state = storage.periods[currentPeriodKey];
      normalizeData(state);
      limparCacheSelectores();
      return state;
    }

    function initializeStaticControls() {
      if (estadoEventos.controlesEstaticosInicializados) return;
      estadoEventos.controlesEstaticosInicializados = true;
      document.querySelectorAll('button:not([type])').forEach(button => {
        button.type = 'button';
      });
      document.getElementById('monthDaysSelector').addEventListener('change', e => resizeMonth(e.target.value));
      document.getElementById('periodMonthSelect').innerHTML = MONTH_NAMES.map((name, index) => `<option value="${index + 1}">${name}</option>`).join('');
      document.getElementById('periodMonthSelect').addEventListener('change', changePeriodFromControls);
      document.getElementById('periodYearInput').addEventListener('change', changePeriodFromControls);
      document.getElementById('importFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) importData(file);
        e.target.value = '';
      });
    }

    function bindTabKeyboardNavigation() {
      if (estadoEventos.navegacaoAbasInicializada) return;
      estadoEventos.navegacaoAbasInicializada = true;

      document.addEventListener('keydown', e => {
        const button = e.target.closest('.tab-btn');
        if (!button) return;
        const isHorizontalKey = ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key);
        if (!isHorizontalKey) return;
        const tabButtons = [...document.querySelectorAll('.tab-btn')];
        const index = tabButtons.indexOf(button);
        if (index < 0) return;
        e.preventDefault();
        const nextIndex = e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? tabButtons.length - 1
            : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
        const nextButton = tabButtons[nextIndex];
        nextButton.focus();
        setActiveTab(nextButton.dataset.tab, true);
        saveUIState({ activeTab: nextButton.dataset.tab });
      });
    }

    function bindModalBackdropClose() {
      if (estadoEventos.modaisInicializados) return;
      estadoEventos.modaisInicializados = true;

      document.addEventListener('click', e => {
        const modal = e.target.classList?.contains('modal') ? e.target : null;
        if (!modal) return;
        closeModal(modal.id);
      });
    }

    function bindGlobalKeyboardShortcuts() {
      if (estadoEventos.atalhosGlobaisInicializados) return;
      estadoEventos.atalhosGlobaisInicializados = true;

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          const modal = obterModalAtivo();
          if (modal) {
            e.preventDefault();
            closeModal(modal.id);
            return;
          }
        }
        if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName || '')) {
          e.preventDefault();
          const activeView = document.querySelector('.view.active')?.id;
          const targetId = activeView === 'pending'
            ? 'pendingSearch'
            : activeView === 'students'
              ? 'studentSearch'
              : activeView === 'events'
                ? 'eventSearch'
                : activeView === 'scale'
                  ? 'scaleSearch'
                  : null;
          const target = targetId ? document.getElementById(targetId) : null;
          if (target) target.focus();
        }
      });
    }

    function bindStorageSync() {
      if (estadoEventos.sincronizacaoStorageInicializada) return;
      estadoEventos.sincronizacaoStorageInicializada = true;

      window.addEventListener('storage', async e => {
        if (!e.key) return;
        if (e.key === STORAGE_BROADCAST_KEY) {
          await consumeStorageBroadcast(e.newValue);
          return;
        }
        if (!getKnownStorageKeys().includes(e.key)) return;
        if (e.newValue === null) storageCache.delete(e.key);
        else storageCache.set(e.key, e.newValue);
      });
    }

    // ══════════════════════════════════════════
    // DIAGNÓSTICOS & MAPA INTERNO DE MÓDULOS
    // ══════════════════════════════════════════

    const APP_INTERNALS = Object.freeze({
      config: {
        STORAGE_KEY,
        STORE_VERSION,
        APP_VERSION,
        UI_KEY,
        MONTH_NAMES,
        APP_DEFAULTS
      },
      persistence: {
        hydrateStorageCache,
        readStoredValue,
        readStoredJson,
        readStoredJsonWithFallback,
        writeStoredValue,
        writeStoredJson,
        removeStoredValue,
        removeStoredValues,
        loadStore,
        saveStore,
        saveData
      },
      schema: {
        sanitizeDeep,
        sanitizeUIState,
        normalizeData,
        normalizeStore,
        migrateStore,
        sanitizeStore,
        buildCleanPeriodFromTemplate,
        buildEmptyPeriodFromTemplate
      },
      domain: {
        limparCacheSelectores,
        getReceptionists,
        getProfessors,
        getAllEmployees,
        getStudentViewFilters,
        getPendingViewFilters,
        getEventViewFilters,
        getScaleViewFilters,
        selecionarTotaisAddons,
        selecionarResumoRecepcionistas,
        selecionarResumoPendencias,
        selecionarPendenciasFiltradas,
        selecionarRankingNps,
        selecionarDadosEventosAgrupados,
        selecionarResumoEscala,
        selecionarIndicadoresDashboard,
        getScaleFilteredList,
        getEventsFilteredList,
        computeSummary,
        getPeriodMetrics,
        getBackupSummary
      },
      actions: {
        applyStudentSave,
        applyPendingSave,
        applyEventSave,
        switchPeriod,
        resetPeriodData,
        saveSettings,
        resizeMonth,
        saveLocalSnapshot,
        restoreLocalSnapshot,
        applyImportedStore
      },
      rendering: {
        AREAS_RENDERIZACAO,
        estadoRenderizacao,
        requestRender,
        limparFilaRender,
        renderSection,
        renderSections,
        renderAll,
        renderHero,
        renderDashboard,
        renderStudents,
        renderAddons,
        renderPending,
        renderNps,
        renderScale,
        renderEvents,
        renderSettings
      },
      ui: {
        DOM,
        bindUIEvents,
        initUIBindings,
        initializeStaticControls,
        bindTabKeyboardNavigation,
        bindModalBackdropClose,
        bindGlobalKeyboardShortcuts,
        bindStorageSync
      },
      diagnostics: {
        runSystemDiagnostics,
        runFlowSmokeTests,
        renderDiagnosticsPanel,
        renderFlowSmokePanel,
        renderPeriodAudit
      }
    });

    window.__APP_INTERNALS__ = APP_INTERNALS;

    // ══════════════════════════════════════════
    // INICIALIZAÇÃO — initializeForms, initializeSavedUIState, renderInitialViews, initializeApp
    // ══════════════════════════════════════════

    function initializeForms() {
      if (estadoEventos.formulariosInicializados) return;
      estadoEventos.formulariosInicializados = true;

      populateStudentFilters();
      clearStudentForm();
      clearPendingForm();
      clearScaleForm();
      clearEventForm();
      document.getElementById('npsObservations').addEventListener('input', () => {
        clearTimeout(npsObservationsDebounce);
        npsObservationsDebounce = setTimeout(saveNpsObservations, 800);
      });
      sincronizarLabelsComCampos();
    }

    function initializeSavedUIState() {
      const uiState = sanitizeUIState(getUIState());
      applyUIStateToControls(uiState);
      return uiState;
    }

    function renderInitialViews(uiState) {
      renderAll();
      syncPeriodControls();
      runSystemDiagnostics(true);
      applyUIStateToControls(uiState);
      setActiveTab(uiState.activeTab || 'dashboard', true);
    }

    async function initializeApp() {
      try {
        await hydrateStorageCache();
        await syncAppState();
        initializeStaticControls();
        initUIBindings();
        bindUIEvents();
        bindPendingDnD();
        bindTooltips();
        bindAcessibilidade();
        bindTabKeyboardNavigation();
        bindModalBackdropClose();
        bindGlobalKeyboardShortcuts();
        bindStorageSync();
        const initialUIState = initializeSavedUIState();
        initializeForms();
        renderInitialViews(initialUIState);
      } catch (err) {
        console.error('Falha ao inicializar a aplicação:', err);
        showToast('Falha ao inicializar os dados do aplicativo. Tente recarregar a página ou restaurar um backup.', 'danger', 8000);
        // Tenta recovery: carrega dados padrões
        try {
          storage = getDefaultStore();
          currentPeriodKey = storage.activePeriod;
          state = storage.periods[currentPeriodKey];
          await saveData({ silent: true, eventType: 'recovery' });
          renderAll();
          syncPeriodControls();
          showToast('Dados de exemplo restaurados. Importe um backup para recuperar seus dados.', 'warning', 6000);
        } catch (recoveryErr) {
          console.error('Recovery falhou:', recoveryErr);
        }
      }
    }

    initializeApp().catch(err => {
      console.error('Falha ao inicializar a aplicação:', err);
      showToast('Falha ao inicializar os dados do aplicativo.', 'danger', 4500);
    });
