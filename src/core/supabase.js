/**
 * src/core/supabase.js
 * ------------------------------------------------------------------
 * Camada de integração com Supabase para autenticação, contexto de
 * unidade e sincronização híbrida do store.
 *
 * O app continua local-first: se env, SDK, sessão ou RLS falharem,
 * a execução recai para IndexedDB/localStorage sem quebrar o runtime.
 * ------------------------------------------------------------------
 */

    /** @type {any|null} */
    let __supabaseClientCache = null;
    /** @type {string|null} */
    let __supabaseInitErrorReason = null;
    /** @type {any|null} */
    let __supabaseSessionCache = null;
    /** @type {boolean} */
    let __supabaseAuthListenerBound = false;
    /** @type {number|null} */
    let __supabaseSyncTimer = null;
    /** @type {Object|null} */
    let __supabasePendingSyncStore = null;
    /** @type {Promise<Object>|null} */
    let __supabaseSyncPromise = null;
    /** @type {Object|null} */
    let __supabaseLastRemoteCheckpoint = null;

    const SUPABASE_WRITABLE_ROLES = new Set(['admin', 'gestor']);
    const SUPABASE_ROLE_PRIORITY = {
      admin: 1,
      gestor: 2,
      recepcao: 3,
      professor: 4,
      leitura: 5
    };
    const SUPABASE_RPC_OPERATIONS = Object.freeze({
      getUnitSyncCheckpoint: Object.freeze({
        operationId: 'getUnitSyncCheckpoint',
        functionName: 'get_unit_sync_checkpoint',
        required: Object.freeze(['p_unit_id']),
        optional: Object.freeze([])
      }),
      importBackupTransactionGuarded: Object.freeze({
        operationId: 'importBackupTransactionGuarded',
        functionName: 'import_backup_transaction_guarded',
        required: Object.freeze(['p_unit_id', 'p_payload']),
        optional: Object.freeze(['p_expected_checkpoint', 'p_preview_accepted'])
      })
    });
    const SUPABASE_RPC_OPERATION_LIST = Object.freeze(Object.values(SUPABASE_RPC_OPERATIONS));

    const supabaseBackendState = {
      enabled: false,
      hasEnv: false,
      hasSdk: false,
      sessionStatus: 'offline',
      user: null,
      memberships: [],
      activeUnit: null,
      writable: false,
      source: 'local',
      syncPolicy: 'local-first-guarded',
      syncStatus: 'idle',
      conflictStatus: 'clear',
      lastSyncAt: null,
      lastRemoteCheckpoint: null,
      lastError: null
    };

    /**
     * @returns {void}
     */
    function notifySupabaseStateChanged() {
      if (typeof requestRender === 'function') requestRender('settings');
    }

    /**
     * @param {Partial<typeof supabaseBackendState>} patch
     * @param {boolean} [rerender=true]
     * @returns {Readonly<typeof supabaseBackendState>}
     */
    function updateSupabaseBackendState(patch = {}, rerender = true) {
      Object.assign(supabaseBackendState, patch);
      if (rerender) notifySupabaseStateChanged();
      return getSupabaseBackendState();
    }

    /**
     * @returns {Readonly<typeof supabaseBackendState>}
     */
    function getSupabaseBackendState() {
      return Object.freeze({
        ...supabaseBackendState,
        user: supabaseBackendState.user ? { ...supabaseBackendState.user } : null,
        activeUnit: supabaseBackendState.activeUnit ? { ...supabaseBackendState.activeUnit } : null,
        lastRemoteCheckpoint: supabaseBackendState.lastRemoteCheckpoint
          ? cloneSerializable(supabaseBackendState.lastRemoteCheckpoint)
          : null,
        memberships: Array.isArray(supabaseBackendState.memberships)
          ? supabaseBackendState.memberships.map(item => ({ ...item }))
          : []
      });
    }

    /**
     * @param {any} value
     * @returns {any}
     */
    function normalizeSupabaseCheckpoint(value) {
      const raw = Array.isArray(value) ? value[0] : value;
      if (!raw || typeof raw !== 'object') return null;
      return {
        revision: String(raw.revision || raw.maxUpdatedAt || raw.max_updated_at || ''),
        maxUpdatedAt: String(raw.maxUpdatedAt || raw.max_updated_at || ''),
        periodCount: Number(raw.periodCount ?? raw.period_count ?? 0),
        auditCount: Number(raw.auditCount ?? raw.audit_count ?? 0)
      };
    }

    /**
     * @param {any} value
     * @returns {boolean}
     */
    function isEmptySupabaseCheckpoint(value) {
      const checkpoint = normalizeSupabaseCheckpoint(value);
      return !checkpoint || (checkpoint.periodCount === 0 && checkpoint.auditCount === 0 && !checkpoint.revision);
    }

    /**
     * @param {any} value
     * @returns {void}
     */
    function rememberSupabaseRemoteCheckpoint(value) {
      const checkpoint = normalizeSupabaseCheckpoint(value);
      __supabaseLastRemoteCheckpoint = checkpoint ? cloneSerializable(checkpoint) : null;
      updateSupabaseBackendState({
        conflictStatus: 'clear',
        lastRemoteCheckpoint: checkpoint ? cloneSerializable(checkpoint) : null
      }, false);
    }

    /**
     * @param {any} error
     * @returns {boolean}
     */
    function isSupabaseSyncConflictError(error) {
      const message = String(error?.message || error?.details || error?.hint || '');
      return error?.code === 'WPM01'
        || /WPM_SYNC_CONFLICT|checkpoint remoto divergente|recarregue do backend/i.test(message);
    }

    /**
     * @param {Object<string, Array>} rowsByTable
     * @param {Array<Object>} periodRows
     * @returns {boolean}
     */
    function hasSupabaseOperationalRows(rowsByTable = {}, periodRows = []) {
      const hasClosedPeriod = periodRows.some(item => String(item?.status || '') === 'closed');
      if (hasClosedPeriod) return true;
      return [
        rowsByTable.students,
        rowsByTable.addonSales,
        rowsByTable.pending,
        rowsByTable.notes,
        rowsByTable.metrics,
        rowsByTable.mentions,
        rowsByTable.scaleDays,
        rowsByTable.shifts,
        rowsByTable.events
      ].some(rows => Array.isArray(rows) && rows.length > 0);
    }

    /**
     * @param {unknown} value
     * @returns {boolean}
     */
    function isSupabasePlainObject(value) {
      return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }

    /**
     * @param {string} identifier
     * @returns {Object|null}
     */
    function getSupabaseRpcOperation(identifier) {
      const key = String(identifier || '');
      return SUPABASE_RPC_OPERATIONS[key]
        || SUPABASE_RPC_OPERATION_LIST.find(operation => operation.functionName === key)
        || null;
    }

    /**
     * @param {Array<Object>} failures
     * @param {string} path
     * @param {string} message
     * @returns {void}
     */
    function addSupabaseRpcFailure(failures, path, message) {
      failures.push({ path, message });
    }

    /**
     * @param {string} identifier
     * @param {Object} [params]
     * @returns {{ok: boolean, failures: Array<{path: string, message: string}>}}
     */
    function validateSupabaseRpcParams(identifier, params = {}) {
      const operation = getSupabaseRpcOperation(identifier);
      if (!operation) {
        return { ok: false, failures: [{ path: 'operationId', message: 'unknown operation' }] };
      }
      const failures = [];
      if (!isSupabasePlainObject(params)) {
        return { ok: false, failures: [{ path: 'params', message: 'must be an object' }] };
      }
      operation.required.forEach(key => {
        if (params[key] === undefined || params[key] === null) {
          addSupabaseRpcFailure(failures, key, 'is required');
        }
      });
      if (params.p_payload !== undefined && !isSupabasePlainObject(params.p_payload)) {
        addSupabaseRpcFailure(failures, 'p_payload', 'must be an object');
      }
      if (params.p_expected_checkpoint !== undefined
        && params.p_expected_checkpoint !== null
        && !isSupabasePlainObject(params.p_expected_checkpoint)) {
        addSupabaseRpcFailure(failures, 'p_expected_checkpoint', 'must be an object');
      }
      if (params.p_preview_accepted !== undefined && typeof params.p_preview_accepted !== 'boolean') {
        addSupabaseRpcFailure(failures, 'p_preview_accepted', 'must be a boolean');
      }
      return { ok: failures.length === 0, failures };
    }

    /**
     * @param {any} client
     * @param {string} operationId
     * @param {Object} params
     * @returns {Promise<{data: any, error: any}>}
     */
    async function callSupabaseRpc(client, operationId, params = {}) {
      if (!client?.rpc) throw new Error('Supabase RPC client indisponível.');
      const operation = getSupabaseRpcOperation(operationId);
      if (!operation) throw new Error(`Operação RPC Supabase desconhecida: ${operationId}`);
      const validation = validateSupabaseRpcParams(operation.operationId, params);
      if (!validation.ok) {
        throw new Error(`Parâmetros inválidos para ${operation.operationId}: ${validation.failures.map(item => item.path).join(', ')}`);
      }
      return client.rpc(operation.functionName, params);
    }

    /**
     * @param {any} client
     * @param {string} unitId
     * @returns {Promise<Object|null>}
     */
    async function readSupabaseSyncCheckpoint(client, unitId) {
      if (!client?.rpc || !unitId) return null;
      const { data, error } = await callSupabaseRpc(client, 'getUnitSyncCheckpoint', {
        p_unit_id: unitId
      });
      if (error) throw error;
      return normalizeSupabaseCheckpoint(data);
    }

    /**
     * Lê env runtime do navegador, com fallback seguro.
     * @returns {{SUPABASE_URL: string|null, SUPABASE_ANON_KEY: string|null, SUPABASE_UNIT_SLUG: string|null}}
     */
    function readSupabaseEnv() {
      const env = (typeof window !== 'undefined' && window.__APP_ENV__) || {};
      return {
        SUPABASE_URL: env.SUPABASE_URL || null,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || null,
        SUPABASE_UNIT_SLUG: env.SUPABASE_UNIT_SLUG || null
      };
    }

    /**
     * @param {string|null|undefined} role
     * @returns {boolean}
     */
    function isSupabaseRoleWritable(role) {
      return SUPABASE_WRITABLE_ROLES.has(String(role || '').toLowerCase());
    }

    /**
     * @param {string} periodKey
     * @returns {number}
     */
    function getPeriodMonthDays(periodKey) {
      const [yearStr, monthStr] = String(periodKey || getInitialPeriodKey()).split('-');
      const year = Number(yearStr) || new Date().getFullYear();
      const month = Number(monthStr) || 1;
      return new Date(year, month, 0).getDate();
    }

    /**
     * @param {string|null|undefined} value
     * @returns {string}
     */
    function normalizeSupabaseRole(value) {
      return String(value || '').trim().toLowerCase();
    }

    /**
     * @param {any} user
     * @returns {{id: string, email: string, fullName: string}|null}
     */
    function snapshotSupabaseUser(user) {
      if (!user || typeof user !== 'object') return null;
      return {
        id: String(user.id || ''),
        email: String(user.email || ''),
        fullName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || '')
      };
    }

    /**
     * @param {any} rawMembership
     * @returns {Object|null}
     */
    function snapshotSupabaseMembership(rawMembership) {
      if (!rawMembership || typeof rawMembership !== 'object') return null;
      const rawUnit = Array.isArray(rawMembership.unit) ? rawMembership.unit[0] : rawMembership.unit;
      if (!rawUnit || typeof rawUnit !== 'object') return null;
      return {
        membershipId: String(rawMembership.id || ''),
        displayName: String(rawMembership.display_name || ''),
        role: normalizeSupabaseRole(rawMembership.role),
        active: rawMembership.active !== false,
        unitId: String(rawUnit.id || ''),
        unitName: String(rawUnit.name || ''),
        unitSlug: String(rawUnit.slug || ''),
        unitTimezone: String(rawUnit.timezone || 'America/Sao_Paulo'),
        unitActive: rawUnit.active !== false
      };
    }

    /**
     * @param {Object[]} memberships
     * @param {string|null} preferredSlug
     * @returns {Object|null}
     */
    function selectActiveSupabaseMembership(memberships, preferredSlug = null) {
      const activeMemberships = (Array.isArray(memberships) ? memberships : [])
        .filter(item => item?.active && item?.unitActive)
        .sort((left, right) => {
          const roleDelta = (SUPABASE_ROLE_PRIORITY[left.role] || 99) - (SUPABASE_ROLE_PRIORITY[right.role] || 99);
          if (roleDelta !== 0) return roleDelta;
          return String(left.unitName || '').localeCompare(String(right.unitName || ''));
        });
      if (!activeMemberships.length) return null;
      if (preferredSlug) {
        const preferred = activeMemberships.find(item => item.unitSlug === preferredSlug);
        if (preferred) return preferred;
      }
      return activeMemberships[0];
    }

    /**
     * @param {Array<Object>} rows
     * @param {string} key
     * @returns {Map<string, Array<Object>>}
     */
    function groupSupabaseRows(rows, key) {
      const map = new Map();
      (Array.isArray(rows) ? rows : []).forEach(row => {
        const groupKey = String(row?.[key] || '');
        if (!groupKey) return;
        if (!map.has(groupKey)) map.set(groupKey, []);
        map.get(groupKey).push(row);
      });
      return map;
    }

    /**
     * @param {string} periodKey
     * @param {any} settingsRow
     * @param {any[]} addonTypeRows
     * @param {any[]} studentRows
     * @param {any[]} addonSaleRows
     * @param {any[]} pendingRows
     * @param {any[]} noteRows
     * @param {any|null} metricsRow
     * @param {any[]} mentionRows
     * @param {any[]} scaleDayRows
     * @param {any[]} shiftRows
     * @param {any[]} eventRows
     * @returns {PeriodData}
     */
    function mapSupabasePeriodToLocal(
      periodKey,
      settingsRow,
      addonTypeRows,
      studentRows,
      addonSaleRows,
      pendingRows,
      noteRows,
      metricsRow,
      mentionRows,
      scaleDayRows,
      shiftRows,
      eventRows
    ) {
      const monthDays = Math.max(28, Math.min(31, Number(settingsRow?.month_days || getPeriodMonthDays(periodKey))));
      const receptionists = [
        ...(Array.isArray(settingsRow?.reception_snapshot) ? settingsRow.reception_snapshot : []),
        ...studentRows.map(item => item?.receptionist_name_snapshot).filter(Boolean),
        ...pendingRows.map(item => item?.assignee_name_snapshot).filter(Boolean),
        ...scaleDayRows.map(item => item?.receptionist_name_snapshot).filter(Boolean),
        ...noteRows.map(item => item?.from_name_snapshot).filter(Boolean)
      ];
      const professors = [
        ...(Array.isArray(settingsRow?.professor_snapshot) ? settingsRow.professor_snapshot : []),
        ...shiftRows.map(item => item?.professor_name_snapshot).filter(Boolean)
      ];
      const team = [
        ...(Array.isArray(settingsRow?.team_snapshot) ? settingsRow.team_snapshot : []),
        ...receptionists,
        ...professors,
        ...mentionRows.map(item => item?.name_snapshot).filter(Boolean)
      ];
      const addonTypes = (Array.isArray(addonTypeRows) ? addonTypeRows : [])
        .slice()
        .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
        .map(item => String(item?.name || '').trim())
        .filter(Boolean);

      const period = {
        settings: {
          team: [...new Set(team.filter(Boolean))],
          receptionists: [...new Set(receptionists.filter(Boolean))],
          professors: [...new Set(professors.filter(Boolean))],
          addonTypes: [...new Set(addonTypes.filter(Boolean))],
          monthDays
        },
        students: (Array.isArray(studentRows) ? studentRows : []).map(item => ({
          id: String(item?.id || crypto.randomUUID()),
          nome: String(item?.student_name || ''),
          matricula: String(item?.membership_number || ''),
          ultimaVisita: String(item?.last_visit_date || ''),
          horaVisita: String(item?.last_visit_time || ''),
          inicio: String(item?.started_at_date || ''),
          avisoNps: String(item?.nps_notice_status || 'Pendente'),
          atendimento: String(item?.receptionist_name_snapshot || ''),
          feedback: String(item?.feedback_status || 'Pendente'),
          addon: String(item?.addon_type_snapshot || ''),
          observacoes: String(item?.notes || '')
        })),
        pending: (Array.isArray(pendingRows) ? pendingRows : []).map(item => ({
          id: String(item?.id || crypto.randomUUID()),
          nome: String(item?.student_name || ''),
          matricula: String(item?.membership_number || ''),
          pendencia: String(item?.description || ''),
          data: String(item?.requested_at_date || ''),
          hostess: String(item?.assignee_name_snapshot || ''),
          resposta: String(item?.response || ''),
          status: String(item?.status || 'aberto')
        })),
        recados: (Array.isArray(noteRows) ? noteRows : []).map(item => ({
          id: String(item?.id || crypto.randomUUID()),
          from: String(item?.from_name_snapshot || ''),
          to: String(item?.to_audience || 'Todos'),
          text: String(item?.message || ''),
          createdAt: String(item?.created_at || new Date().toISOString()),
          read: false
        })),
        nps: {
          score: Number(metricsRow?.score || 0),
          monthlyGoal: Number(metricsRow?.monthly_goal || 75),
          semesterGoal: Number(metricsRow?.semester_goal || 80),
          observations: String(metricsRow?.observations || ''),
          mentions: (Array.isArray(mentionRows) ? mentionRows : []).map(item => ({
            id: String(item?.id || crypto.randomUUID()),
            name: String(item?.name_snapshot || ''),
            count: Math.max(0, Number(item?.count || 0))
          })),
          rankSnapshot: Object.fromEntries(
            (Array.isArray(mentionRows) ? mentionRows : [])
              .filter(item => item?.rank_position)
              .map(item => [String(item.id || ''), Number(item.rank_position || 0)])
          )
        },
        scale: [],
        events: (Array.isArray(eventRows) ? eventRows : [])
          .slice()
          .sort((left, right) => {
            const dateDelta = String(left?.event_date || '').localeCompare(String(right?.event_date || ''));
            if (dateDelta !== 0) return dateDelta;
            return String(left?.event_time || '').localeCompare(String(right?.event_time || ''));
          })
          .map(item => ({
            id: String(item?.id || crypto.randomUUID()),
            date: String(item?.event_date || ''),
            time: String(item?.event_time || ''),
            type: String(item?.type || 'Evento'),
            title: String(item?.title || ''),
            place: String(item?.place || ''),
            owner: String(item?.owner_name_snapshot || ''),
            status: String(item?.status || 'Programado'),
            description: String(item?.description || '')
          })),
        addons: {}
      };

      seedAddons(period);

      const shiftsByDayId = groupSupabaseRows(shiftRows, 'scale_day_id');
      period.scale = (Array.isArray(scaleDayRows) ? scaleDayRows : [])
        .slice()
        .sort((left, right) => String(left?.scale_date || '').localeCompare(String(right?.scale_date || '')))
        .map(item => ({
          id: String(item?.id || crypto.randomUUID()),
          date: String(item?.scale_date || ''),
          rowTone: String(item?.row_tone || 'neutral'),
          professorShifts: (shiftsByDayId.get(String(item?.id || '')) || [])
            .slice()
            .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
            .map(shift => ({
              id: String(shift?.id || crypto.randomUUID()),
              time: String(shift?.time_label || ''),
              name: String(shift?.professor_name_snapshot || ''),
              swap: String(shift?.swap_name_snapshot || '')
            })),
          receptionTime: String(item?.reception_time || ''),
          receptionist: String(item?.receptionist_name_snapshot || ''),
          receptionSwap: String(item?.reception_swap || ''),
          note: String(item?.note || '')
        }));

      (Array.isArray(addonSaleRows) ? addonSaleRows : []).forEach(item => {
        const receptionist = String(item?.receptionist_name_snapshot || '').trim();
        const addonType = String(item?.addon_type_snapshot || '').trim();
        const saleDate = String(item?.sale_date || '').trim();
        if (!receptionist || !addonType || !saleDate) return;
        const index = Number(String(saleDate).split('-')[2]) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= monthDays) return;
        if (!period.addons[receptionist]) period.addons[receptionist] = {};
        if (!Array.isArray(period.addons[receptionist][addonType])) {
          period.addons[receptionist][addonType] = Array.from({ length: monthDays }, () => 0);
        }
        period.addons[receptionist][addonType][index] += Math.max(0, Number(item?.quantity || 0));
      });

      normalizeData(period);
      return period;
    }

    /**
     * @param {Object} storeLike
     * @returns {Object}
     */
    function buildSupabaseBackupPayload(storeLike) {
      const prepared = prepareStoreCandidate(cloneSerializable(storeLike)) || getDefaultStore();
      const payload = {
        meta: {
          kind: 'app-backup',
          appVersion: APP_VERSION,
          exportedAt: new Date().toISOString(),
          sourceAppId: 'wpm-gestao-interna',
          source: 'supabase-sync'
        },
        version: prepared.version || STORE_VERSION,
        activePeriod: prepared.activePeriod,
        preferences: cloneSerializable(prepared.preferences),
        periods: cloneSerializable(prepared.periods),
        archives: cloneSerializable(prepared.archives)
      };
      return typeof attachPayloadIntegrity === 'function' ? attachPayloadIntegrity(payload) : payload;
    }

    /**
     * @param {string} eventType
     * @returns {boolean}
     */
    function shouldSyncSupabaseImmediately(eventType) {
      return ['import', 'restore', 'reset', 'close', 'recovery', 'close-month-backup'].includes(String(eventType || ''));
    }

    /**
     * @returns {boolean} true quando env e SDK estão prontos.
     */
    function isSupabaseEnabled() {
      const env = readSupabaseEnv();
      const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
      const hasSdk = typeof window !== 'undefined'
        && window.supabase
        && typeof window.supabase.createClient === 'function';
      return hasEnv && hasSdk;
    }

    /**
     * @param {any} client
     * @returns {void}
     */
    function bindSupabaseAuthListener(client) {
      if (__supabaseAuthListenerBound || !client?.auth || typeof client.auth.onAuthStateChange !== 'function') return;
      __supabaseAuthListenerBound = true;
      client.auth.onAuthStateChange(async (event, session) => {
        __supabaseSessionCache = session || null;
        updateSupabaseBackendState({
          sessionStatus: session?.user ? 'authenticated' : 'anonymous',
          user: snapshotSupabaseUser(session?.user || null),
          lastError: null
        });
        if (event === 'SIGNED_OUT') {
          updateSupabaseBackendState({
            memberships: [],
            activeUnit: null,
            writable: false,
            source: 'local',
            syncStatus: 'idle',
            conflictStatus: 'clear',
            lastRemoteCheckpoint: null
          });
          __supabaseLastRemoteCheckpoint = null;
          return;
        }
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          await refreshSupabaseBackendState({ forceSession: false });
        }
      });
    }

    /**
     * Retorna o client singleton ou null em modo offline.
     * @returns {any|null}
     */
    function getSupabaseClient() {
      if (__supabaseClientCache) return __supabaseClientCache;
      if (!isSupabaseEnabled()) {
        const env = readSupabaseEnv();
        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
          __supabaseInitErrorReason = 'env-missing';
        } else {
          __supabaseInitErrorReason = 'sdk-missing';
        }
        updateSupabaseBackendState({
          enabled: false,
          hasEnv: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
          hasSdk: typeof window !== 'undefined' && Boolean(window.supabase && typeof window.supabase.createClient === 'function'),
          sessionStatus: !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY ? 'offline' : 'sdk-missing'
        }, false);
        return null;
      }
      try {
        const env = readSupabaseEnv();
        __supabaseClientCache = window.supabase.createClient(
          env.SUPABASE_URL,
          env.SUPABASE_ANON_KEY,
          {
            auth: { persistSession: true, autoRefreshToken: true },
            realtime: { params: { eventsPerSecond: 5 } }
          }
        );
        __supabaseInitErrorReason = null;
        bindSupabaseAuthListener(__supabaseClientCache);
        updateSupabaseBackendState({
          enabled: true,
          hasEnv: true,
          hasSdk: true,
          sessionStatus: supabaseBackendState.sessionStatus === 'offline' ? 'anonymous' : supabaseBackendState.sessionStatus
        }, false);
        return __supabaseClientCache;
      } catch (err) {
        __supabaseInitErrorReason = `init-error:${err && err.message ? err.message : 'unknown'}`;
        updateSupabaseBackendState({
          enabled: false,
          hasEnv: true,
          hasSdk: true,
          sessionStatus: 'error',
          lastError: __supabaseInitErrorReason
        }, false);
        if (typeof console !== 'undefined') {
          console.warn('[supabase] falha ao criar client:', err);
        }
        return null;
      }
    }

    /**
     * @param {{force?: boolean}} [options]
     * @returns {Promise<any|null>}
     */
    async function getSupabaseSession(options = {}) {
      const client = getSupabaseClient();
      if (!client?.auth || typeof client.auth.getSession !== 'function') return null;
      if (!options.force && __supabaseSessionCache) return __supabaseSessionCache;
      const { data, error } = await client.auth.getSession();
      if (error) {
        updateSupabaseBackendState({
          sessionStatus: 'error',
          lastError: error.message || 'Falha ao ler sessão Supabase.'
        });
        return null;
      }
      __supabaseSessionCache = data?.session || null;
      return __supabaseSessionCache;
    }

    /**
     * @param {{forceSession?: boolean}} [options]
     * @returns {Promise<Readonly<typeof supabaseBackendState>>}
     */
    async function refreshSupabaseBackendState(options = {}) {
      const env = readSupabaseEnv();
      const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
      const hasSdk = typeof window !== 'undefined'
        && Boolean(window.supabase && typeof window.supabase.createClient === 'function');
      if (!hasEnv || !hasSdk) {
        return updateSupabaseBackendState({
          enabled: false,
          hasEnv,
          hasSdk,
          sessionStatus: !hasEnv ? 'offline' : 'sdk-missing',
          user: null,
          memberships: [],
          activeUnit: null,
          writable: false,
          source: 'local',
          conflictStatus: 'clear',
          lastRemoteCheckpoint: null
        });
      }

      const client = getSupabaseClient();
      if (!client) {
        return getSupabaseBackendState();
      }

      const session = await getSupabaseSession({ force: options.forceSession === true });
      if (!session?.user) {
        return updateSupabaseBackendState({
          enabled: true,
          hasEnv: true,
          hasSdk: true,
          sessionStatus: 'anonymous',
          user: null,
          memberships: [],
          activeUnit: null,
          writable: false,
          source: 'local',
          conflictStatus: 'clear',
          lastRemoteCheckpoint: null,
          lastError: null
        });
      }

      try {
        const { data, error } = await client
          .from('unit_members')
          .select('id, display_name, role, active, unit:units(id, name, slug, timezone, active)');
        if (error) throw error;

        const memberships = (Array.isArray(data) ? data : [])
          .map(snapshotSupabaseMembership)
          .filter(Boolean);
        const activeMembership = selectActiveSupabaseMembership(memberships, readSupabaseEnv().SUPABASE_UNIT_SLUG);

        return updateSupabaseBackendState({
          enabled: true,
          hasEnv: true,
          hasSdk: true,
          sessionStatus: 'authenticated',
          user: snapshotSupabaseUser(session.user),
          memberships,
          activeUnit: activeMembership,
          writable: isSupabaseRoleWritable(activeMembership?.role),
          source: supabaseBackendState.source || 'local',
          lastError: activeMembership ? null : 'Usuário autenticado sem vínculo ativo em unit_members.'
        });
      } catch (error) {
        return updateSupabaseBackendState({
          enabled: true,
          hasEnv: true,
          hasSdk: true,
          sessionStatus: 'error',
          user: snapshotSupabaseUser(session.user),
          memberships: [],
          activeUnit: null,
          writable: false,
          source: 'local',
          conflictStatus: 'clear',
          lastError: error?.message || 'Falha ao carregar memberships do usuário.'
        });
      }
    }

    /**
     * @param {Object} [fallbackStore]
     * @returns {Promise<AppStore|null>}
     */
    async function loadStoreFromSupabase(fallbackStore = null) {
      const client = getSupabaseClient();
      if (!client) return null;

      const backendState = await refreshSupabaseBackendState();
      if (!backendState.activeUnit?.unitId) return null;

      updateSupabaseBackendState({
        syncStatus: 'loading',
        lastError: null
      });

      try {
        const { data: periods, error: periodsError } = await client
          .from('periods')
          .select('id, period_key, label, status, closed_at')
          .eq('unit_id', backendState.activeUnit.unitId)
          .order('period_key', { ascending: true });
        if (periodsError) throw periodsError;

        const periodRows = Array.isArray(periods) ? periods : [];
        if (!periodRows.length) {
          const emptyCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
          rememberSupabaseRemoteCheckpoint(emptyCheckpoint);
          updateSupabaseBackendState({
            syncStatus: 'idle',
            source: 'local',
            conflictStatus: 'clear'
          });
          return null;
        }

        const periodIds = periodRows.map(item => item.id).filter(Boolean);
        const emptyRows = {
          settings: [],
          addonTypes: [],
          students: [],
          addonSales: [],
          pending: [],
          notes: [],
          metrics: [],
          mentions: [],
          scaleDays: [],
          shifts: [],
          events: []
        };

        if (periodIds.length) {
          const [
            settingsRes,
            addonTypesRes,
            studentsRes,
            addonSalesRes,
            pendingRes,
            notesRes,
            metricsRes,
            mentionsRes,
            scaleDaysRes,
            shiftsRes,
            eventsRes
          ] = await Promise.all([
            client.from('period_settings').select('period_id, team_snapshot, reception_snapshot, professor_snapshot, month_days').in('period_id', periodIds),
            client.from('addon_types').select('period_id, name, sort_order').in('period_id', periodIds),
            client.from('student_attendances').select('id, period_id, student_name, membership_number, last_visit_date, last_visit_time, started_at_date, nps_notice_status, receptionist_name_snapshot, feedback_status, addon_type_snapshot, notes').in('period_id', periodIds),
            client.from('addon_sales').select('period_id, sale_date, receptionist_name_snapshot, addon_type_snapshot, quantity').in('period_id', periodIds),
            client.from('pending_items').select('id, period_id, student_name, membership_number, description, requested_at_date, assignee_name_snapshot, response, status').in('period_id', periodIds),
            client.from('shift_notes').select('id, period_id, from_name_snapshot, to_audience, message, created_at').in('period_id', periodIds),
            client.from('nps_period_metrics').select('period_id, score, monthly_goal, semester_goal, observations').in('period_id', periodIds),
            client.from('nps_mentions').select('id, period_id, name_snapshot, count, rank_position').in('period_id', periodIds),
            client.from('scale_days').select('id, period_id, scale_date, row_tone, reception_time, receptionist_name_snapshot, reception_swap, note').in('period_id', periodIds),
            client.from('scale_professor_shifts').select('id, scale_day_id, time_label, professor_name_snapshot, swap_name_snapshot, sort_order'),
            client.from('events').select('id, period_id, event_date, event_time, type, title, place, owner_name_snapshot, status, description').in('period_id', periodIds)
          ]);

          const responses = [settingsRes, addonTypesRes, studentsRes, addonSalesRes, pendingRes, notesRes, metricsRes, mentionsRes, scaleDaysRes, shiftsRes, eventsRes];
          const firstError = responses.find(result => result?.error)?.error;
          if (firstError) throw firstError;

          emptyRows.settings = settingsRes.data || [];
          emptyRows.addonTypes = addonTypesRes.data || [];
          emptyRows.students = studentsRes.data || [];
          emptyRows.addonSales = addonSalesRes.data || [];
          emptyRows.pending = pendingRes.data || [];
          emptyRows.notes = notesRes.data || [];
          emptyRows.metrics = metricsRes.data || [];
          emptyRows.mentions = mentionsRes.data || [];
          emptyRows.scaleDays = scaleDaysRes.data || [];
          emptyRows.shifts = shiftsRes.data || [];
          emptyRows.events = eventsRes.data || [];
        }

        const scaleDayIds = (emptyRows.scaleDays || []).map(item => String(item?.id || '')).filter(Boolean);
        const shifts = (Array.isArray(emptyRows.shifts) ? emptyRows.shifts : []).filter(item => scaleDayIds.includes(String(item?.scale_day_id || '')));

        if (!hasSupabaseOperationalRows({ ...emptyRows, shifts }, periodRows)) {
          const emptyCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
          rememberSupabaseRemoteCheckpoint(emptyCheckpoint);
          updateSupabaseBackendState({
            syncStatus: 'idle',
            source: 'local',
            conflictStatus: 'clear'
          });
          return null;
        }

        const settingsByPeriod = new Map((emptyRows.settings || []).map(item => [String(item.period_id || ''), item]));
        const metricsByPeriod = new Map((emptyRows.metrics || []).map(item => [String(item.period_id || ''), item]));
        const addonTypesByPeriod = groupSupabaseRows(emptyRows.addonTypes, 'period_id');
        const studentsByPeriod = groupSupabaseRows(emptyRows.students, 'period_id');
        const addonSalesByPeriod = groupSupabaseRows(emptyRows.addonSales, 'period_id');
        const pendingByPeriod = groupSupabaseRows(emptyRows.pending, 'period_id');
        const notesByPeriod = groupSupabaseRows(emptyRows.notes, 'period_id');
        const mentionsByPeriod = groupSupabaseRows(emptyRows.mentions, 'period_id');
        const scaleDaysByPeriod = groupSupabaseRows(emptyRows.scaleDays, 'period_id');
        const eventsByPeriod = groupSupabaseRows(emptyRows.events, 'period_id');

        const periodsMap = {};
        const archives = {};

        periodRows.forEach(period => {
          const periodId = String(period.id || '');
          const periodKey = String(period.period_key || '');
          periodsMap[periodKey] = mapSupabasePeriodToLocal(
            periodKey,
            settingsByPeriod.get(periodId) || null,
            addonTypesByPeriod.get(periodId) || [],
            studentsByPeriod.get(periodId) || [],
            addonSalesByPeriod.get(periodId) || [],
            pendingByPeriod.get(periodId) || [],
            notesByPeriod.get(periodId) || [],
            metricsByPeriod.get(periodId) || null,
            mentionsByPeriod.get(periodId) || [],
            scaleDaysByPeriod.get(periodId) || [],
            shifts,
            eventsByPeriod.get(periodId) || []
          );

          if (String(period.status || '') === 'closed') {
            const closedAt = String(period.closed_at || new Date().toISOString());
            const closedDate = new Date(closedAt);
            archives[periodKey] = {
              closedAt,
              closedAtLabel: Number.isNaN(closedDate.getTime()) ? closedAt : closedDate.toLocaleString('pt-BR'),
              label: String(period.label || periodKey)
            };
          }
        });

        const fallbackCandidate = prepareStoreCandidate(cloneSerializable(fallbackStore || null));
        const preferredActivePeriod = fallbackCandidate?.periods?.[fallbackCandidate.activePeriod]
          ? fallbackCandidate.activePeriod
          : periodRows.find(item => String(item.status || '') === 'open')?.period_key
            || periodRows[periodRows.length - 1]?.period_key
            || getInitialPeriodKey();

        const remoteStore = prepareStoreCandidate({
          version: STORE_VERSION,
          activePeriod: preferredActivePeriod,
          preferences: normalizeStorePreferences(fallbackCandidate?.preferences),
          periods: periodsMap,
          archives
        });
        const checkpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
        rememberSupabaseRemoteCheckpoint(checkpoint);

        updateSupabaseBackendState({
          source: 'supabase',
          syncStatus: 'idle',
          conflictStatus: 'clear',
          lastSyncAt: new Date().toISOString(),
          lastError: null
        });

        return remoteStore;
      } catch (error) {
        updateSupabaseBackendState({
          source: 'local',
          syncStatus: 'error',
          conflictStatus: 'clear',
          lastError: error?.message || 'Falha ao carregar store remoto.'
        });
        if (typeof console !== 'undefined') {
          console.warn('[supabase] fallback para store local após falha de leitura remota:', error);
        }
        return null;
      }
    }

    /**
     * @param {Object} storeLike
     * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, data?: any, error?: any}>}
     */
    async function saveStoreToSupabase(storeLike) {
      const client = getSupabaseClient();
      if (!client) {
        return { ok: false, skipped: true, reason: 'supabase-disabled' };
      }

      const backendState = await refreshSupabaseBackendState();
      if (!backendState.activeUnit?.unitId) {
        return { ok: false, skipped: true, reason: 'unit-missing' };
      }
      if (!backendState.writable) {
        return { ok: false, skipped: true, reason: 'role-readonly' };
      }

      updateSupabaseBackendState({
        syncStatus: 'saving',
        conflictStatus: 'clear',
        lastError: null
      });

      try {
        const payload = buildSupabaseBackupPayload(storeLike);
        const currentCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(error => {
          if (typeof console !== 'undefined') {
            console.warn('[supabase] não foi possível ler checkpoint remoto antes da sincronização:', error);
          }
          return null;
        });
        if (!__supabaseLastRemoteCheckpoint
          && !isEmptySupabaseCheckpoint(currentCheckpoint)
          && backendState.source !== 'supabase') {
          updateSupabaseBackendState({
            source: 'local',
            syncStatus: 'conflict',
            conflictStatus: 'baseline-missing',
            lastRemoteCheckpoint: normalizeSupabaseCheckpoint(currentCheckpoint),
            lastError: 'Backend já possui dados. Recarregue do backend antes de sincronizar este dispositivo.'
          });
          return {
            ok: false,
            skipped: true,
            conflict: true,
            reason: 'remote-baseline-missing'
          };
        }

        const expectedCheckpoint = __supabaseLastRemoteCheckpoint
          ? cloneSerializable(__supabaseLastRemoteCheckpoint)
          : normalizeSupabaseCheckpoint(currentCheckpoint);
        const { data, error } = await callSupabaseRpc(client, 'importBackupTransactionGuarded', {
          p_unit_id: backendState.activeUnit.unitId,
          p_payload: payload,
          p_expected_checkpoint: expectedCheckpoint,
          p_preview_accepted: true
        });
        if (error) throw error;
        const nextCheckpoint = await readSupabaseSyncCheckpoint(client, backendState.activeUnit.unitId).catch(() => null);
        rememberSupabaseRemoteCheckpoint(nextCheckpoint);

        updateSupabaseBackendState({
          source: 'supabase',
          syncStatus: 'idle',
          conflictStatus: 'clear',
          lastSyncAt: new Date().toISOString(),
          lastError: null
        });
        return { ok: true, data, checkpoint: getSupabaseBackendState().lastRemoteCheckpoint };
      } catch (error) {
        if (isSupabaseSyncConflictError(error)) {
          updateSupabaseBackendState({
            source: 'local',
            syncStatus: 'conflict',
            conflictStatus: 'detected',
            lastError: error?.message || 'Conflito remoto detectado. Recarregue do backend antes de sincronizar.'
          });
          return { ok: false, conflict: true, reason: 'remote-conflict', error };
        }
        updateSupabaseBackendState({
          source: 'local',
          syncStatus: 'error',
          conflictStatus: 'clear',
          lastError: error?.message || 'Falha ao sincronizar store com Supabase.'
        });
        return { ok: false, error };
      }
    }

    /**
     * @param {Object} storeLike
     * @param {Object} [options]
     * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, data?: any, error?: any}>}
     */
    async function queueSupabaseStoreSync(storeLike, options = {}) {
      if (__supabaseSyncTimer) {
        clearTimeout(__supabaseSyncTimer);
        __supabaseSyncTimer = null;
      }
      __supabasePendingSyncStore = cloneSerializable(storeLike);
      updateSupabaseBackendState({
        syncStatus: options.immediate === true ? 'saving' : 'queued'
      });

      const runSync = async () => {
        const payload = __supabasePendingSyncStore;
        __supabasePendingSyncStore = null;
        __supabaseSyncPromise = saveStoreToSupabase(payload);
        return __supabaseSyncPromise.finally(() => {
          __supabaseSyncPromise = null;
        });
      };

      if (options.immediate === true) {
        return runSync();
      }

      return new Promise(resolve => {
        __supabaseSyncTimer = window.setTimeout(async () => {
          __supabaseSyncTimer = null;
          resolve(await runSync());
        }, Math.max(250, Number(options.delayMs || 900)));
      });
    }

    /**
     * @param {{showToast?: boolean}} [options]
     * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, data?: any, error?: any}>}
     */
    async function syncCurrentStoreToSupabase(options = {}) {
      if (typeof storage !== 'object' || !storage) {
        return { ok: false, skipped: true, reason: 'store-missing' };
      }
      const storeSnapshot = prepareStoreCandidate(cloneSerializable(storage));
      if (!storeSnapshot) {
        return { ok: false, skipped: true, reason: 'store-invalid' };
      }
      const result = await queueSupabaseStoreSync(storeSnapshot, { immediate: true });
      if (options.showToast !== false && typeof showToast === 'function') {
        if (result?.ok) {
          showToast('Sincronização com o backend concluída.', 'success');
        } else if (result?.conflict) {
          showToast('Conflito remoto detectado. Recarregue do backend antes de sincronizar novamente.', 'warning', 6500);
        } else if (!result?.skipped) {
          showToast('Falha ao sincronizar o estado atual com o backend.', 'warning', 4500);
        }
      }
      return result;
    }

    /**
     * @param {Object} [options]
     * @returns {Promise<boolean>}
     */
    async function reloadAppFromSupabaseSession(options = {}) {
      try {
        const localCandidate = typeof loadStore === 'function' ? await loadStore({ skipRemote: true }) : null;
        const remoteStore = await loadStoreFromSupabase(localCandidate);
        if (!remoteStore) return false;
        if (typeof saveStore === 'function') {
          await saveStore(remoteStore, {
            silent: true,
            broadcast: false,
            skipRemoteSync: true,
            eventType: 'remote-load'
          });
        }
        if (typeof syncAppState === 'function') {
          await syncAppState(remoteStore);
        }
        if (typeof renderAll === 'function') renderAll();
        if (typeof syncPeriodControls === 'function') syncPeriodControls();
        if (options.showToast !== false && typeof showToast === 'function') {
          showToast('Base remota carregada com sucesso.', 'success');
        }
        return true;
      } catch (error) {
        updateSupabaseBackendState({
          syncStatus: 'error',
          lastError: error?.message || 'Falha ao aplicar store remoto.'
        });
        if (options.showToast !== false && typeof showToast === 'function') {
          showToast('Não foi possível carregar a base remota. O app seguirá com o store local.', 'warning', 5000);
        }
        return false;
      }
    }

    /**
     * @param {string} email
     * @param {string} password
     * @param {{reload?: boolean}} [options]
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async function signInSupabasePassword(email, password, options = {}) {
      const client = getSupabaseClient();
      if (!client?.auth || typeof client.auth.signInWithPassword !== 'function') {
        return { ok: false, error: 'Supabase Auth indisponível neste runtime.' };
      }

      const normalizedEmail = String(email || '').trim();
      if (!normalizedEmail || !String(password || '').trim()) {
        return { ok: false, error: 'Informe e-mail e senha.' };
      }

      updateSupabaseBackendState({
        syncStatus: 'loading',
        lastError: null
      });

      const { data, error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password: String(password || '')
      });

      if (error) {
        updateSupabaseBackendState({
          syncStatus: 'error',
          lastError: error.message || 'Falha ao autenticar.'
        });
        return { ok: false, error: error.message || 'Falha ao autenticar.' };
      }

      __supabaseSessionCache = data?.session || null;
      await refreshSupabaseBackendState({ forceSession: false });
      if (options.reload !== false) {
        await reloadAppFromSupabaseSession({ showToast: false });
      }
      return { ok: true };
    }

    /**
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async function signOutSupabase() {
      const client = getSupabaseClient();
      if (!client?.auth || typeof client.auth.signOut !== 'function') {
        return { ok: false, error: 'Supabase Auth indisponível neste runtime.' };
      }
      const { error } = await client.auth.signOut();
      if (error) {
        updateSupabaseBackendState({
          syncStatus: 'error',
          lastError: error.message || 'Falha ao encerrar sessão.'
        });
        return { ok: false, error: error.message || 'Falha ao encerrar sessão.' };
      }
      __supabaseSessionCache = null;
      updateSupabaseBackendState({
        sessionStatus: 'anonymous',
        user: null,
        memberships: [],
        activeUnit: null,
        writable: false,
        source: 'local',
        syncStatus: 'idle',
        conflictStatus: 'clear',
        lastRemoteCheckpoint: null,
        lastError: null
      });
      __supabaseLastRemoteCheckpoint = null;
      return { ok: true };
    }

    /**
     * Diagnóstico para painel de Configurações e testes.
     * @returns {{enabled: boolean, hasEnv: boolean, hasSdk: boolean, reason: string|null, unitSlug: string|null, sessionStatus: string}}
     */
    function getSupabaseStatus() {
      const env = readSupabaseEnv();
      const hasEnv = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
      const hasSdk = typeof window !== 'undefined'
        && Boolean(window.supabase && typeof window.supabase.createClient === 'function');
      return {
        enabled: hasEnv && hasSdk,
        hasEnv,
        hasSdk,
        reason: __supabaseInitErrorReason,
        unitSlug: env.SUPABASE_UNIT_SLUG,
        sessionStatus: supabaseBackendState.sessionStatus
      };
    }

    /**
     * Reseta o cache do client e do estado local de sessão (útil em testes).
     */
    function resetSupabaseClient() {
      if (__supabaseSyncTimer) {
        clearTimeout(__supabaseSyncTimer);
        __supabaseSyncTimer = null;
      }
      __supabaseClientCache = null;
      __supabaseInitErrorReason = null;
      __supabaseSessionCache = null;
      __supabaseAuthListenerBound = false;
      __supabasePendingSyncStore = null;
      __supabaseSyncPromise = null;
      __supabaseLastRemoteCheckpoint = null;
      updateSupabaseBackendState({
        enabled: false,
        hasEnv: false,
        hasSdk: false,
        sessionStatus: 'offline',
        user: null,
        memberships: [],
        activeUnit: null,
        writable: false,
        source: 'local',
        syncStatus: 'idle',
        conflictStatus: 'clear',
        lastSyncAt: null,
        lastRemoteCheckpoint: null,
        lastError: null
      }, false);
    }
