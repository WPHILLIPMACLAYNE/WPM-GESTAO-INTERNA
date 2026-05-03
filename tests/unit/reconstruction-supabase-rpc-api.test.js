import { describe, expect, it, vi } from 'vitest';

import {
  RPC_OPERATIONS,
  SUPABASE_RPC_BASE_PATH,
  buildRpcPath,
  buildRpcRequest,
  buildRpcUrl,
  classifyPostgrestError,
  createSupabaseRpcClient,
  getRpcOperation,
  validateBackupPayload,
  validateCheckpoint,
  validateRpcParams,
  validateRpcResult,
} from '../../src/reconstruction/supabase-rpc-api.js';

const UUID_1 = '00000000-0000-4000-8000-000000000001';
const UUID_2 = '00000000-0000-4000-8000-000000000002';
const UUID_3 = '00000000-0000-4000-8000-000000000003';

function checkpoint(overrides = {}) {
  return {
    revision: '',
    maxUpdatedAt: '',
    periodCount: 0,
    auditCount: 0,
    ...overrides,
  };
}

function appBackupPayload(overrides = {}) {
  return {
    meta: {
      kind: 'app-backup',
      exportedAt: '2026-05-02T18:29:51Z',
    },
    periods: {
      '2026-05': {
        settings: { monthDays: 31 },
        students: [],
        pending: [],
        recados: [],
        nps: { score: 0, monthlyGoal: 75, semesterGoal: 80, mentions: [] },
        scale: [],
        events: [],
        addons: {},
      },
    },
    archives: {},
    ...overrides,
  };
}

function makeResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

describe('reconstruction supabase rpc api', () => {
  it('preserva catalogo das 7 RPCs PostgREST do OpenAPI', () => {
    expect(SUPABASE_RPC_BASE_PATH).toBe('/rest/v1/rpc');
    expect(RPC_OPERATIONS.map((operation) => operation.operationId)).toEqual([
      'getUnitSyncCheckpoint',
      'importBackupTransactionGuarded',
      'importBackupTransaction',
      'closePeriodTransaction',
      'resetPeriodTransaction',
      'linkStudentAttendanceAddonTransaction',
      'bootstrapUnitAdmin',
    ]);
    expect(getRpcOperation('get_unit_sync_checkpoint')).toMatchObject({
      operationId: 'getUnitSyncCheckpoint',
      security: 'user',
      successSchema: 'Checkpoint',
    });
    expect(getRpcOperation('bootstrapUnitAdmin')).toMatchObject({
      functionName: 'bootstrap_unit_admin',
      security: 'service-role',
      successSchema: 'BootstrapResult[]',
    });
    expect(buildRpcPath('resetPeriodTransaction')).toBe('/rest/v1/rpc/reset_period_transaction');
    expect(buildRpcUrl('https://example.supabase.co/', 'closePeriodTransaction'))
      .toBe('https://example.supabase.co/rest/v1/rpc/close_period_transaction');
  });

  it('valida checkpoint, payload app-backup e payload month-archive', () => {
    expect(validateCheckpoint(checkpoint())).toEqual([]);
    expect(validateCheckpoint({ revision: 1 })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'checkpoint.revision' }),
      expect.objectContaining({ path: 'checkpoint.periodCount' }),
    ]));

    expect(validateBackupPayload(appBackupPayload())).toEqual([]);
    expect(validateBackupPayload({
      meta: { kind: 'month-archive', exportedAt: '2026-05-02T18:29:51Z' },
      periodKey: '2026-05',
      data: { settings: { monthDays: 30 }, students: [], pending: [], recados: [], scale: [], events: [], addons: {} },
    })).toEqual([]);
    expect(validateBackupPayload({ meta: { kind: 'full-backup' } })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'p_payload.periods' }),
    ]));
    expect(validateBackupPayload({ meta: { kind: 'unknown' } })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'p_payload.meta.kind' }),
    ]));
  });

  it('valida parametros por operacao, uuid, periodo, quantidade e bootstrap', () => {
    expect(validateRpcParams('getUnitSyncCheckpoint', { p_unit_id: UUID_1 })).toMatchObject({ ok: true });
    expect(validateRpcParams('getUnitSyncCheckpoint', { p_unit_id: 'bad' })).toMatchObject({
      ok: false,
      failures: [expect.objectContaining({ path: 'p_unit_id' })],
    });
    expect(validateRpcParams('importBackupTransactionGuarded', {
      p_unit_id: UUID_1,
      p_payload: appBackupPayload(),
      p_expected_checkpoint: checkpoint(),
      p_preview_accepted: true,
    })).toMatchObject({ ok: true });
    expect(validateRpcParams('importBackupTransactionGuarded', {
      p_unit_id: UUID_1,
      p_payload: appBackupPayload(),
      p_preview_accepted: 'sim',
    })).toMatchObject({
      ok: false,
      failures: [expect.objectContaining({ path: 'p_preview_accepted' })],
    });
    expect(validateRpcParams('closePeriodTransaction', {
      p_period_id: UUID_2,
      p_next_period_key: '2026-13',
    })).toMatchObject({
      ok: false,
      failures: [expect.objectContaining({ path: 'p_next_period_key' })],
    });
    expect(validateRpcParams('linkStudentAttendanceAddonTransaction', {
      p_student_attendance_id: UUID_3,
      p_sale_date: '2026-05-02',
      p_quantity: 0,
    })).toMatchObject({ ok: true });
    expect(validateRpcParams('bootstrapUnitAdmin', {
      p_user_id: UUID_1,
      p_unit_name: 'WPM Unidade Local',
      p_unit_slug: 'wpm-unidade-local',
      p_display_name: 'Admin Local',
      p_period_key: '2026-05',
      p_timezone: 'America/Sao_Paulo',
      p_month_days: 31,
    })).toMatchObject({ ok: true });
  });

  it('constroi request com headers anon/user e service role conforme seguranca da operacao', () => {
    const guarded = buildRpcRequest('importBackupTransactionGuarded', {
      p_unit_id: UUID_1,
      p_payload: appBackupPayload(),
    }, {
      supabaseUrl: 'https://example.supabase.co',
      apiKey: 'anon',
      bearerToken: 'jwt-user',
    });

    expect(guarded).toMatchObject({
      method: 'POST',
      url: 'https://example.supabase.co/rest/v1/rpc/import_backup_transaction_guarded',
      headers: {
        apikey: 'anon',
        authorization: 'Bearer jwt-user',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(guarded.body)).toMatchObject({ p_unit_id: UUID_1 });

    const bootstrap = buildRpcRequest('bootstrapUnitAdmin', {
      p_user_id: UUID_1,
      p_unit_name: 'WPM Unidade Local',
      p_unit_slug: 'wpm-unidade-local',
      p_display_name: 'Admin Local',
    }, {
      supabaseUrl: 'https://example.supabase.co',
      apiKey: 'service-key',
      bearerToken: 'user-token',
      serviceRoleToken: 'service-token',
    });

    expect(bootstrap.headers.authorization).toBe('Bearer service-token');
    expect(bootstrap.url).toBe('https://example.supabase.co/rest/v1/rpc/bootstrap_unit_admin');
  });

  it('valida respostas de sucesso por schema OpenAPI', () => {
    expect(validateRpcResult('getUnitSyncCheckpoint', checkpoint({ revision: 'abc' }))).toMatchObject({ ok: true });
    expect(validateRpcResult('importBackupTransactionGuarded', {
      kind: 'app-backup',
      processedPeriods: 1,
      deletedPeriods: 0,
      previousCheckpoint: checkpoint(),
      nextCheckpoint: checkpoint({ revision: 'next', periodCount: 1 }),
    })).toMatchObject({ ok: true });
    expect(validateRpcResult('closePeriodTransaction', {
      closedPeriodId: UUID_1,
      closedPeriodKey: '2026-05',
      nextPeriodId: UUID_2,
      nextPeriodKey: '2026-06',
      nextPeriodReset: true,
    })).toMatchObject({ ok: true });
    expect(validateRpcResult('resetPeriodTransaction', {
      periodId: UUID_1,
      periodKey: '2026-05',
      status: 'reset',
    })).toMatchObject({ ok: true });
    expect(validateRpcResult('linkStudentAttendanceAddonTransaction', {
      studentAttendanceId: UUID_3,
      saleId: null,
      saleAction: 'deleted',
    })).toMatchObject({ ok: true });
    expect(validateRpcResult('bootstrapUnitAdmin', [{
      boot_unit_id: UUID_1,
      boot_unit_member_id: UUID_2,
      boot_period_id: UUID_3,
    }])).toMatchObject({ ok: true });
  });

  it('cliente executa RPC, valida resultado e classifica erros PostgREST', async () => {
    const fetch = vi.fn(async (url, request) => {
      expect(url).toBe('https://example.supabase.co/rest/v1/rpc/get_unit_sync_checkpoint');
      expect(request.method).toBe('POST');
      expect(request.headers.apikey).toBe('anon');
      expect(request.headers.authorization).toBe('Bearer jwt');
      expect(JSON.parse(request.body)).toEqual({ p_unit_id: UUID_1 });
      return makeResponse(checkpoint({ revision: 'remote', periodCount: 2 }));
    });
    const client = createSupabaseRpcClient({
      supabaseUrl: 'https://example.supabase.co',
      apiKey: 'anon',
      bearerToken: 'jwt',
      fetch,
    });

    const result = await client.getUnitSyncCheckpoint({ p_unit_id: UUID_1 });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      validation: { ok: true },
      data: { revision: 'remote', periodCount: 2 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    expect(classifyPostgrestError({ message: 'WPM_SYNC_CONFLICT: checkpoint remoto divergente' }, 400)).toBe('sync-conflict');
    expect(classifyPostgrestError({ message: 'no session' }, 401)).toBe('unauthorized');
    expect(classifyPostgrestError({ message: 'role denied' }, 403)).toBe('forbidden');
  });

  it('cliente retorna erro normalizado quando PostgREST rejeita a chamada', async () => {
    const fetch = vi.fn(async () => makeResponse({
      code: 'P0001',
      message: 'WPM_SYNC_CONFLICT: checkpoint remoto divergente; recarregue do backend antes de sincronizar.',
      details: null,
      hint: null,
    }, { ok: false, status: 400 }));
    const client = createSupabaseRpcClient({
      supabaseUrl: 'https://example.supabase.co',
      apiKey: 'anon',
      bearerToken: 'jwt',
      fetch,
    });

    const result = await client.importBackupTransactionGuarded({
      p_unit_id: UUID_1,
      p_payload: appBackupPayload(),
      p_expected_checkpoint: checkpoint(),
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      kind: 'sync-conflict',
      error: {
        code: 'P0001',
        message: expect.stringContaining('WPM_SYNC_CONFLICT'),
      },
    });
  });
});
