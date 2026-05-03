// Reconstructed Supabase RPC API contract from Reversa Task 17.
// Executable mirror of _reversa_sdd/openapi/supabase-rpcs.yaml.

export const SUPABASE_RPC_BASE_PATH = '/rest/v1/rpc';

export const RPC_OPERATIONS = Object.freeze([
  {
    operationId: 'getUnitSyncCheckpoint',
    functionName: 'get_unit_sync_checkpoint',
    path: '/rest/v1/rpc/get_unit_sync_checkpoint',
    tags: ['Sync'],
    required: ['p_unit_id'],
    optional: [],
    security: 'user',
    successSchema: 'Checkpoint',
    errorStatuses: [401, 403],
  },
  {
    operationId: 'importBackupTransactionGuarded',
    functionName: 'import_backup_transaction_guarded',
    path: '/rest/v1/rpc/import_backup_transaction_guarded',
    tags: ['Sync', 'Periodos'],
    required: ['p_unit_id', 'p_payload'],
    optional: ['p_expected_checkpoint', 'p_preview_accepted'],
    security: 'admin-or-gestor',
    successSchema: 'ImportGuardedResult',
    errorStatuses: [400, 401, 403],
  },
  {
    operationId: 'importBackupTransaction',
    functionName: 'import_backup_transaction',
    path: '/rest/v1/rpc/import_backup_transaction',
    tags: ['Periodos'],
    required: ['p_unit_id', 'p_payload'],
    optional: [],
    security: 'admin-or-gestor',
    successSchema: 'ImportResult',
    errorStatuses: [400, 401, 403],
  },
  {
    operationId: 'closePeriodTransaction',
    functionName: 'close_period_transaction',
    path: '/rest/v1/rpc/close_period_transaction',
    tags: ['Periodos'],
    required: ['p_period_id'],
    optional: ['p_archive_payload', 'p_next_period_key', 'p_next_period_label', 'p_reset_next_period'],
    security: 'admin-or-gestor',
    successSchema: 'ClosePeriodResult',
    errorStatuses: [400, 401, 403],
  },
  {
    operationId: 'resetPeriodTransaction',
    functionName: 'reset_period_transaction',
    path: '/rest/v1/rpc/reset_period_transaction',
    tags: ['Periodos'],
    required: ['p_period_id'],
    optional: ['p_backup_payload'],
    security: 'admin-or-gestor',
    successSchema: 'ResetPeriodResult',
    errorStatuses: [400, 401, 403],
  },
  {
    operationId: 'linkStudentAttendanceAddonTransaction',
    functionName: 'link_student_attendance_addon_transaction',
    path: '/rest/v1/rpc/link_student_attendance_addon_transaction',
    tags: ['Atendimentos'],
    required: ['p_student_attendance_id'],
    optional: ['p_sale_date', 'p_quantity'],
    security: 'admin-gestor-or-recepcao',
    successSchema: 'LinkAddonResult',
    errorStatuses: [400, 401, 403],
  },
  {
    operationId: 'bootstrapUnitAdmin',
    functionName: 'bootstrap_unit_admin',
    path: '/rest/v1/rpc/bootstrap_unit_admin',
    tags: ['Bootstrap'],
    required: ['p_user_id', 'p_unit_name', 'p_unit_slug', 'p_display_name'],
    optional: ['p_period_key', 'p_timezone', 'p_month_days'],
    security: 'service-role',
    successSchema: 'BootstrapResult[]',
    errorStatuses: [400, 401, 403],
  },
]);

export const RPC_OPERATIONS_BY_ID = Object.freeze(Object.fromEntries(
  RPC_OPERATIONS.map((operation) => [operation.operationId, operation]),
));

export const RPC_OPERATIONS_BY_FUNCTION = Object.freeze(Object.fromEntries(
  RPC_OPERATIONS.map((operation) => [operation.functionName, operation]),
));

export const RPC_ALLOWED_BACKUP_KINDS = Object.freeze(['month-archive', 'app-backup', 'full-backup']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIOD_KEY_RE = /^\d{4}-\d{2}$/;

export function getRpcOperation(identifier) {
  return RPC_OPERATIONS_BY_ID[identifier] || RPC_OPERATIONS_BY_FUNCTION[identifier] || null;
}

export function buildRpcPath(identifier) {
  const operation = getRpcOperation(identifier);
  if (!operation) throw new Error(`Unknown Supabase RPC operation: ${identifier}`);
  return operation.path;
}

export function buildRpcUrl(supabaseUrl, identifier) {
  const base = String(supabaseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('supabaseUrl is required');
  return `${base}${buildRpcPath(identifier)}`;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isValidUuid(value) {
  return UUID_RE.test(String(value || ''));
}

export function isValidPeriodKey(value) {
  if (!PERIOD_KEY_RE.test(String(value || ''))) return false;
  const month = Number(String(value).slice(5, 7));
  return month >= 1 && month <= 12;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  return Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}

export function isValidDateTime(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  return Number.isFinite(new Date(value).getTime());
}

function addFailure(failures, path, message) {
  failures.push({ path, message });
}

export function validateCheckpoint(value, path = 'checkpoint') {
  const failures = [];
  if (!isPlainObject(value)) {
    addFailure(failures, path, 'must be an object');
    return failures;
  }
  for (const key of ['revision', 'maxUpdatedAt']) {
    if (typeof value[key] !== 'string') addFailure(failures, `${path}.${key}`, 'must be a string');
  }
  for (const key of ['periodCount', 'auditCount']) {
    if (!Number.isInteger(value[key]) || value[key] < 0) {
      addFailure(failures, `${path}.${key}`, 'must be a non-negative integer');
    }
  }
  return failures;
}

export function validatePeriodData(value, path = 'period') {
  const failures = [];
  if (!isPlainObject(value)) {
    addFailure(failures, path, 'must be an object');
    return failures;
  }
  for (const key of ['students', 'pending', 'recados', 'scale', 'events']) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      addFailure(failures, `${path}.${key}`, 'must be an array');
    }
  }
  if (value.settings?.monthDays !== undefined) {
    const monthDays = value.settings.monthDays;
    if (!Number.isInteger(monthDays) || monthDays < 28 || monthDays > 31) {
      addFailure(failures, `${path}.settings.monthDays`, 'must be an integer between 28 and 31');
    }
  }
  if (value.addons !== undefined && !isPlainObject(value.addons)) {
    addFailure(failures, `${path}.addons`, 'must be an object');
  }
  return failures;
}

export function validateBackupPayload(value, path = 'p_payload') {
  const failures = [];
  if (!isPlainObject(value)) {
    addFailure(failures, path, 'must be an object');
    return failures;
  }
  if (!isPlainObject(value.meta)) {
    addFailure(failures, `${path}.meta`, 'must be an object');
    return failures;
  }
  if (!RPC_ALLOWED_BACKUP_KINDS.includes(value.meta.kind)) {
    addFailure(failures, `${path}.meta.kind`, `must be one of ${RPC_ALLOWED_BACKUP_KINDS.join(', ')}`);
  }
  if (value.meta.exportedAt !== undefined && !isValidDateTime(value.meta.exportedAt)) {
    addFailure(failures, `${path}.meta.exportedAt`, 'must be a date-time');
  }
  if (value.meta.kind === 'month-archive') {
    if (!isValidPeriodKey(value.periodKey)) addFailure(failures, `${path}.periodKey`, 'must be YYYY-MM for month-archive');
    failures.push(...validatePeriodData(value.data, `${path}.data`));
  }
  if (value.meta.kind === 'app-backup' || value.meta.kind === 'full-backup') {
    if (!isPlainObject(value.periods)) {
      addFailure(failures, `${path}.periods`, 'must be an object for app-backup/full-backup');
    } else {
      for (const [periodKey, periodData] of Object.entries(value.periods)) {
        if (!isValidPeriodKey(periodKey)) addFailure(failures, `${path}.periods.${periodKey}`, 'period key must be YYYY-MM');
        failures.push(...validatePeriodData(periodData, `${path}.periods.${periodKey}`));
      }
    }
    if (value.archives !== undefined && !isPlainObject(value.archives)) {
      addFailure(failures, `${path}.archives`, 'must be an object');
    }
  }
  return failures;
}

function validateString(value, path, failures, { minLength = 0 } = {}) {
  if (typeof value !== 'string') {
    addFailure(failures, path, 'must be a string');
    return;
  }
  if (value.trim().length < minLength) addFailure(failures, path, `must have length >= ${minLength}`);
}

function validateUuidParam(params, key, failures) {
  if (!isValidUuid(params[key])) addFailure(failures, key, 'must be a uuid');
}

export function validateRpcParams(identifier, params = {}) {
  const operation = getRpcOperation(identifier);
  if (!operation) return { ok: false, failures: [{ path: 'operationId', message: 'unknown operation' }] };
  const failures = [];
  if (!isPlainObject(params)) {
    return { ok: false, failures: [{ path: 'params', message: 'must be an object' }] };
  }
  for (const requiredKey of operation.required) {
    if (params[requiredKey] === undefined || params[requiredKey] === null) {
      addFailure(failures, requiredKey, 'is required');
    }
  }

  if (params.p_unit_id !== undefined) validateUuidParam(params, 'p_unit_id', failures);
  if (params.p_period_id !== undefined) validateUuidParam(params, 'p_period_id', failures);
  if (params.p_student_attendance_id !== undefined) validateUuidParam(params, 'p_student_attendance_id', failures);
  if (params.p_user_id !== undefined) validateUuidParam(params, 'p_user_id', failures);
  if (params.p_payload !== undefined) failures.push(...validateBackupPayload(params.p_payload, 'p_payload'));
  if (params.p_expected_checkpoint !== undefined && params.p_expected_checkpoint !== null) {
    failures.push(...validateCheckpoint(params.p_expected_checkpoint, 'p_expected_checkpoint'));
  }
  if (params.p_preview_accepted !== undefined && typeof params.p_preview_accepted !== 'boolean') {
    addFailure(failures, 'p_preview_accepted', 'must be a boolean');
  }
  if (params.p_next_period_key !== undefined && params.p_next_period_key !== null && !isValidPeriodKey(params.p_next_period_key)) {
    addFailure(failures, 'p_next_period_key', 'must be YYYY-MM');
  }
  if (params.p_archive_payload !== undefined && !isPlainObject(params.p_archive_payload)) {
    addFailure(failures, 'p_archive_payload', 'must be an object');
  }
  if (params.p_backup_payload !== undefined && !isPlainObject(params.p_backup_payload)) {
    addFailure(failures, 'p_backup_payload', 'must be an object');
  }
  if (params.p_sale_date !== undefined && params.p_sale_date !== null && !isValidDate(params.p_sale_date)) {
    addFailure(failures, 'p_sale_date', 'must be a date');
  }
  if (params.p_quantity !== undefined && (!Number.isInteger(params.p_quantity) || params.p_quantity < 0)) {
    addFailure(failures, 'p_quantity', 'must be a non-negative integer');
  }
  for (const key of ['p_unit_name', 'p_unit_slug', 'p_display_name']) {
    if (params[key] !== undefined) validateString(params[key], key, failures, { minLength: 1 });
  }
  if (params.p_period_key !== undefined && !isValidPeriodKey(params.p_period_key)) {
    addFailure(failures, 'p_period_key', 'must be YYYY-MM');
  }
  if (params.p_month_days !== undefined && params.p_month_days !== null) {
    if (!Number.isInteger(params.p_month_days) || params.p_month_days < 28 || params.p_month_days > 31) {
      addFailure(failures, 'p_month_days', 'must be an integer between 28 and 31');
    }
  }

  return { ok: failures.length === 0, failures };
}

function requireKeys(value, keys, path) {
  const failures = [];
  if (!isPlainObject(value)) {
    addFailure(failures, path, 'must be an object');
    return failures;
  }
  for (const key of keys) {
    if (value[key] === undefined || value[key] === null) addFailure(failures, `${path}.${key}`, 'is required');
  }
  return failures;
}

export function validateRpcResult(identifier, value) {
  const operation = getRpcOperation(identifier);
  if (!operation) return { ok: false, failures: [{ path: 'operationId', message: 'unknown operation' }] };
  let failures = [];

  if (operation.successSchema === 'Checkpoint') {
    failures = validateCheckpoint(value, 'result');
  } else if (operation.successSchema === 'ImportResult') {
    failures = requireKeys(value, ['kind', 'processedPeriods', 'deletedPeriods'], 'result');
  } else if (operation.successSchema === 'ImportGuardedResult') {
    failures = requireKeys(value, ['kind', 'processedPeriods', 'deletedPeriods', 'previousCheckpoint', 'nextCheckpoint'], 'result');
    failures.push(...validateCheckpoint(value?.previousCheckpoint, 'result.previousCheckpoint'));
    failures.push(...validateCheckpoint(value?.nextCheckpoint, 'result.nextCheckpoint'));
  } else if (operation.successSchema === 'ClosePeriodResult') {
    failures = requireKeys(value, ['closedPeriodId', 'closedPeriodKey', 'nextPeriodId', 'nextPeriodKey', 'nextPeriodReset'], 'result');
    if (value?.closedPeriodId && !isValidUuid(value.closedPeriodId)) addFailure(failures, 'result.closedPeriodId', 'must be a uuid');
    if (value?.nextPeriodId && !isValidUuid(value.nextPeriodId)) addFailure(failures, 'result.nextPeriodId', 'must be a uuid');
    if (value?.closedPeriodKey && !isValidPeriodKey(value.closedPeriodKey)) addFailure(failures, 'result.closedPeriodKey', 'must be YYYY-MM');
    if (value?.nextPeriodKey && !isValidPeriodKey(value.nextPeriodKey)) addFailure(failures, 'result.nextPeriodKey', 'must be YYYY-MM');
    if (value?.nextPeriodReset !== undefined && typeof value.nextPeriodReset !== 'boolean') addFailure(failures, 'result.nextPeriodReset', 'must be boolean');
  } else if (operation.successSchema === 'ResetPeriodResult') {
    failures = requireKeys(value, ['periodId', 'periodKey', 'status'], 'result');
    if (value?.periodId && !isValidUuid(value.periodId)) addFailure(failures, 'result.periodId', 'must be a uuid');
    if (value?.periodKey && !isValidPeriodKey(value.periodKey)) addFailure(failures, 'result.periodKey', 'must be YYYY-MM');
    if (value?.status !== undefined && value.status !== 'reset') addFailure(failures, 'result.status', 'must be reset');
  } else if (operation.successSchema === 'LinkAddonResult') {
    failures = requireKeys(value, ['studentAttendanceId', 'saleAction'], 'result');
    if (value?.studentAttendanceId && !isValidUuid(value.studentAttendanceId)) addFailure(failures, 'result.studentAttendanceId', 'must be a uuid');
    if (value?.saleId !== undefined && value.saleId !== null && !isValidUuid(value.saleId)) addFailure(failures, 'result.saleId', 'must be a uuid or null');
    if (!['upserted', 'deleted'].includes(value?.saleAction)) addFailure(failures, 'result.saleAction', 'must be upserted or deleted');
  } else if (operation.successSchema === 'BootstrapResult[]') {
    const rows = Array.isArray(value) ? value : [value];
    if (!Array.isArray(value)) addFailure(failures, 'result', 'must be an array');
    rows.forEach((row, index) => {
      failures.push(...requireKeys(row, ['boot_unit_id', 'boot_unit_member_id', 'boot_period_id'], `result.${index}`));
      for (const key of ['boot_unit_id', 'boot_unit_member_id', 'boot_period_id']) {
        if (row?.[key] && !isValidUuid(row[key])) addFailure(failures, `result.${index}.${key}`, 'must be a uuid');
      }
    });
  }

  return { ok: failures.length === 0, failures };
}

export function classifyPostgrestError(error = {}, status = 400) {
  const message = String(error?.message || '');
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (message.includes('WPM_SYNC_CONFLICT')) return 'sync-conflict';
  if (message.toLowerCase().includes('checkpoint')) return 'checkpoint-error';
  return 'postgrest-error';
}

export function buildRpcRequest(identifier, params = {}, options = {}) {
  const operation = getRpcOperation(identifier);
  if (!operation) throw new Error(`Unknown Supabase RPC operation: ${identifier}`);
  const validation = validateRpcParams(operation.operationId, params);
  if (!validation.ok) {
    const error = new Error(`Invalid params for ${operation.operationId}`);
    error.failures = validation.failures;
    throw error;
  }

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(options.apiKey ? { apikey: options.apiKey } : {}),
  };
  const bearerToken = operation.security === 'service-role'
    ? (options.serviceRoleToken || options.bearerToken)
    : options.bearerToken;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;

  return {
    method: 'POST',
    url: buildRpcUrl(options.supabaseUrl || '', operation.operationId),
    headers,
    body: JSON.stringify(params),
    operation,
  };
}

export function createSupabaseRpcClient(options = {}) {
  const fetchFn = options.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new TypeError('createSupabaseRpcClient requires fetch');
  const supabaseUrl = options.supabaseUrl;

  async function call(identifier, params = {}, callOptions = {}) {
    const operation = getRpcOperation(identifier);
    if (!operation) throw new Error(`Unknown Supabase RPC operation: ${identifier}`);
    const bearerToken = typeof callOptions.getBearerToken === 'function'
      ? await callOptions.getBearerToken(operation)
      : callOptions.bearerToken || options.bearerToken;
    const request = buildRpcRequest(operation.operationId, params, {
      supabaseUrl,
      apiKey: callOptions.apiKey || options.apiKey,
      bearerToken,
      serviceRoleToken: callOptions.serviceRoleToken || options.serviceRoleToken,
    });
    const response = await fetchFn(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const rawText = typeof response.text === 'function' ? await response.text() : '';
    const payload = rawText ? JSON.parse(rawText) : null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload,
        kind: classifyPostgrestError(payload, response.status),
        operation,
      };
    }
    return {
      ok: true,
      status: response.status,
      data: payload,
      validation: validateRpcResult(operation.operationId, payload),
      operation,
    };
  }

  return {
    call,
    getUnitSyncCheckpoint: (params, callOptions) => call('getUnitSyncCheckpoint', params, callOptions),
    importBackupTransactionGuarded: (params, callOptions) => call('importBackupTransactionGuarded', params, callOptions),
    importBackupTransaction: (params, callOptions) => call('importBackupTransaction', params, callOptions),
    closePeriodTransaction: (params, callOptions) => call('closePeriodTransaction', params, callOptions),
    resetPeriodTransaction: (params, callOptions) => call('resetPeriodTransaction', params, callOptions),
    linkStudentAttendanceAddonTransaction: (params, callOptions) => call('linkStudentAttendanceAddonTransaction', params, callOptions),
    bootstrapUnitAdmin: (params, callOptions) => call('bootstrapUnitAdmin', params, callOptions),
  };
}
