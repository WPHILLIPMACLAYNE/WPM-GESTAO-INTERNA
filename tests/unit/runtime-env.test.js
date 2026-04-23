import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRealApp } from '../helpers/load-real-app.js';

let cleanup = () => {};

afterEach(() => {
  cleanup();
  cleanup = () => {};
});

describe('Contrato runtime: window.__APP_ENV__', () => {
  it('expõe defaults seguros mesmo sem env.js', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const env = app.window.__APP_ENV__;
    expect(env).toBeDefined();
    expect(env.SUPABASE_URL).toBeNull();
    expect(env.SUPABASE_ANON_KEY).toBeNull();
    expect(env.SUPABASE_UNIT_SLUG).toBeNull();
    expect(env.SENTRY_DSN).toBeNull();
  });

  it('permite forçar o runtime via APP_RUNTIME_OVERRIDE', async () => {
    const app = await loadRealApp({
      appEnv: { APP_RUNTIME_OVERRIDE: 'production' }
    });
    cleanup = app.cleanup;
    expect(app.window.__APP_INTERNALS__.config.APP_RUNTIME).toBe('production');
    expect(app.window.__APP_INTERNALS__.config.DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA).toBe(false);
  });
});

describe('Backend (Supabase) — fallback offline', () => {
  it('renderiza o painel de auth/backend nas Configuracoes', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    expect(app.window.document.getElementById('supabaseAuthPanel')).toBeTruthy();
    expect(app.window.document.getElementById('supabaseAuthActions')).toBeTruthy();
    expect(app.window.document.getElementById('migrationDryRunList')).toBeTruthy();
    expect(app.window.document.getElementById('migrationHomologationList')).toBeTruthy();
  });

  it('isSupabaseEnabled retorna false sem env nem SDK', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    expect(app.window.__APP_INTERNALS__.backend.isSupabaseEnabled()).toBe(false);
  });

  it('getSupabaseClient retorna null quando env ausente', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { backend } = app.window.__APP_INTERNALS__;
    expect(backend.getSupabaseClient()).toBeNull();
    const status = backend.getSupabaseStatus();
    expect(status.enabled).toBe(false);
    expect(status.hasEnv).toBe(false);
    expect(status.reason).toBe('env-missing');
  });

  it('getSupabaseClient ainda retorna null quando env presente mas SDK ausente', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { backend } = app.window.__APP_INTERNALS__;
    app.window.__APP_ENV__.SUPABASE_URL = 'https://fake.supabase.co';
    app.window.__APP_ENV__.SUPABASE_ANON_KEY = 'fake-anon-key';
    backend.resetSupabaseClient();
    expect(backend.getSupabaseClient()).toBeNull();
    const status = backend.getSupabaseStatus();
    expect(status.hasEnv).toBe(true);
    expect(status.hasSdk).toBe(false);
    expect(status.reason).toBe('sdk-missing');
  });

  it('getSupabaseClient cria singleton quando env e SDK presentes', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { backend } = app.window.__APP_INTERNALS__;
    let createdWith = null;
    app.window.supabase = {
      createClient(url, key) {
        createdWith = { url, key };
        return { __mock: true, url };
      }
    };
    app.window.__APP_ENV__.SUPABASE_URL = 'https://fake.supabase.co';
    app.window.__APP_ENV__.SUPABASE_ANON_KEY = 'fake-anon-key';
    backend.resetSupabaseClient();
    const client = backend.getSupabaseClient();
    expect(client).not.toBeNull();
    expect(client.__mock).toBe(true);
    expect(createdWith).toEqual({
      url: 'https://fake.supabase.co',
      key: 'fake-anon-key'
    });
    expect(backend.getSupabaseClient()).toBe(client);
  });

  it('loadStore prefere store remoto quando o adapter remoto retorna base valida', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { persistence, config } = app.window.__APP_INTERNALS__;
    const localStore = await persistence.loadStore({ skipRemote: true });
    const remoteStore = structuredClone(localStore);
    remoteStore.activePeriod = '2099-12';
    remoteStore.periods['2099-12'] = structuredClone(localStore.periods[localStore.activePeriod]);
    app.window.loadStoreFromSupabase = vi.fn().mockResolvedValue(remoteStore);

    const loaded = await persistence.loadStore();
    const persisted = await persistence.readStoredStore(config.STORAGE_KEY);

    expect(app.window.loadStoreFromSupabase).toHaveBeenCalledOnce();
    expect(loaded.activePeriod).toBe('2099-12');
    expect(persisted.activePeriod).toBe('2099-12');
  });

  it('saveStore dispara sync remoto imediato em eventos criticos', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { persistence } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    app.window.getSupabaseStatus = () => ({ enabled: true });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      activeUnit: { unitId: 'unit-1' },
      writable: true
    });
    app.window.queueSupabaseStoreSync = vi.fn().mockResolvedValue({ ok: true });

    const saved = await persistence.saveStore(structuredClone(baseStore), {
      silent: true,
      broadcast: false,
      eventType: 'reset'
    });

    expect(saved).toBe(true);
    expect(app.window.queueSupabaseStoreSync).toHaveBeenCalledOnce();
    expect(app.window.queueSupabaseStoreSync).toHaveBeenCalledWith(
      expect.objectContaining({ activePeriod: baseStore.activePeriod }),
      expect.objectContaining({ immediate: true })
    );
  });

  it('saveStore respeita skipRemoteSync quando o caller pede persistencia apenas local', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { persistence } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    app.window.getSupabaseStatus = () => ({ enabled: true });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      activeUnit: { unitId: 'unit-1' },
      writable: true
    });
    app.window.queueSupabaseStoreSync = vi.fn().mockResolvedValue({ ok: true });

    const saved = await persistence.saveStore(structuredClone(baseStore), {
      silent: true,
      broadcast: false,
      eventType: 'remote-load',
      skipRemoteSync: true
    });

    expect(saved).toBe(true);
    expect(app.window.queueSupabaseStoreSync).not.toHaveBeenCalled();
  });

  it('runMigrationDryRun consolida recados legados em clone e gera relatorio local', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { diagnostics, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    const originalRecadosCount = (baseStore.periods?.[baseStore.activePeriod]?.recados || []).length;
    const legacyKey = `wpm_recados_${baseStore.activePeriod}`;
    app.window.localStorage.setItem(legacyKey, JSON.stringify([
      {
        from: 'Wallace',
        to: 'Todos',
        text: 'Recado legado',
        createdAt: '2026-04-22T10:00:00.000Z',
        read: false
      }
    ]));

    const report = await diagnostics.runMigrationDryRun(true);

    expect(report.legacyRecados.periods).toBe(1);
    expect(report.legacyRecados.total).toBe(1);
    expect(report.local.totals.recados).toBeGreaterThanOrEqual(originalRecadosCount + 1);
    expect((baseStore.periods[baseStore.activePeriod].recados || []).length).toBe(originalRecadosCount);
  });

  it('runMigrationDryRun compara com store remoto quando autenticado', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { diagnostics, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    app.window.getSupabaseStatus = () => ({ enabled: true, sessionStatus: 'authenticated' });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      source: 'supabase',
      writable: true
    });
    app.window.loadStoreFromSupabase = vi.fn().mockResolvedValue(structuredClone(baseStore));

    const report = await diagnostics.runMigrationDryRun(true);

    expect(app.window.loadStoreFromSupabase).toHaveBeenCalledOnce();
    expect(report.remote.periodCount).toBe(baseStore ? Object.keys(baseStore.periods || {}).length : 0);
    expect(report.comparison.matches).toBe(true);
    expect(report.comparison.mismatches).toHaveLength(0);
  });

  it('runMigrationDryRun trata backend vazio como primeira migracao liberada', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { diagnostics } = app.window.__APP_INTERNALS__;
    app.window.getSupabaseStatus = () => ({ enabled: true, sessionStatus: 'authenticated' });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      source: 'local',
      writable: true
    });
    app.window.loadStoreFromSupabase = vi.fn().mockResolvedValue(null);

    const report = await diagnostics.runMigrationDryRun(true);
    const readiness = diagnostics.getMigrationReadiness(report);

    expect(report.backend.remoteState).toBe('empty');
    expect(readiness.canMigrate).toBe(true);
    expect(readiness.label).toBe('Primeira migração liberada');
  });

  it('runAssistedMigrationToSupabase bloqueia envio quando o dry-run detecta divergencia remota', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { diagnostics, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    const remoteStore = structuredClone(baseStore);
    remoteStore.periods[baseStore.activePeriod].recados.push({
      from: 'Backend',
      to: 'Equipe',
      text: 'Recado remoto extra',
      createdAt: '2026-04-22T11:00:00.000Z',
      read: false
    });
    app.window.getSupabaseStatus = () => ({ enabled: true, sessionStatus: 'authenticated' });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      source: 'supabase',
      writable: true
    });
    app.window.loadStoreFromSupabase = vi.fn().mockResolvedValue(remoteStore);
    app.window.queueSupabaseStoreSync = vi.fn().mockResolvedValue({ ok: true });

    const result = await diagnostics.runAssistedMigrationToSupabase();

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('remote-mismatch');
    expect(app.window.queueSupabaseStoreSync).not.toHaveBeenCalled();
  });

  it('runAssistedMigrationToSupabase consolida recados legados no store local antes do envio', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { persistence, config } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    const activePeriod = baseStore.activePeriod;
    const legacyKey = `wpm_recados_${activePeriod}`;
    app.window.localStorage.setItem(legacyKey, JSON.stringify([
      {
        from: 'Wallace',
        to: 'Todos',
        text: 'Recado legado migrado',
        createdAt: '2026-04-22T10:00:00.000Z',
        read: false
      }
    ]));
    app.window.getSupabaseStatus = () => ({ enabled: true, sessionStatus: 'authenticated' });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      source: 'supabase',
      writable: true
    });
    app.window.loadStoreFromSupabase = vi.fn().mockImplementation(async fallbackStore => structuredClone(fallbackStore));
    app.window.queueSupabaseStoreSync = vi.fn().mockResolvedValue({ ok: true });
    app.window.reloadAppFromSupabaseSession = vi.fn().mockResolvedValue(true);

    const result = await app.window.eval('window.__APP_INTERNALS__.diagnostics.runAssistedMigrationToSupabase()');
    const persisted = await persistence.readStoredStore(config.STORAGE_KEY);
    const queuedStore = app.window.queueSupabaseStoreSync.mock.calls[0]?.[0];

    expect(result.ok).toBe(true);
    expect(app.window.queueSupabaseStoreSync).toHaveBeenCalledOnce();
    expect((queuedStore?.periods?.[activePeriod]?.recados || []).some(item => item.text === 'Recado legado migrado')).toBe(true);
    expect((persisted?.periods?.[activePeriod]?.recados || []).some(item => item.text === 'Recado legado migrado')).toBe(true);
    expect(app.window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('runAssistedMigrationToSupabase permite primeira migracao quando o backend inicia vazio', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { diagnostics, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = await persistence.loadStore({ skipRemote: true });
    let migrated = false;
    app.window.getSupabaseStatus = () => ({ enabled: true, sessionStatus: 'authenticated' });
    app.window.getSupabaseBackendState = () => ({
      sessionStatus: 'authenticated',
      source: migrated ? 'supabase' : 'local',
      writable: true
    });
    app.window.loadStoreFromSupabase = vi.fn().mockImplementation(async fallbackStore => (
      migrated ? structuredClone(fallbackStore || baseStore) : null
    ));
    app.window.queueSupabaseStoreSync = vi.fn().mockImplementation(async () => {
      migrated = true;
      return { ok: true };
    });
    app.window.reloadAppFromSupabaseSession = vi.fn().mockResolvedValue(true);

    const result = await app.window.eval('window.__APP_INTERNALS__.diagnostics.runAssistedMigrationToSupabase()');

    expect(result.ok).toBe(true);
    expect(app.window.queueSupabaseStoreSync).toHaveBeenCalledOnce();
    expect(result.report.backend.remoteState).toBe('present');
    expect(result.report.comparison.matches).toBe(true);
  });
});

describe('Observability (Sentry) — no-op condicional', () => {
  it('initSentry retorna false sem DSN', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { observability } = app.window.__APP_INTERNALS__;
    observability.resetObservability();
    expect(observability.initSentry()).toBe(false);
    const status = observability.getObservabilityStatus();
    expect(status.initialized).toBe(false);
    expect(status.hasDsn).toBe(false);
    expect(status.reason).toBe('dsn-missing');
  });

  it('initSentry retorna false com DSN mas sem SDK', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { observability } = app.window.__APP_INTERNALS__;
    app.window.__APP_ENV__.SENTRY_DSN = 'https://abc@xyz.ingest.sentry.io/123';
    observability.resetObservability();
    expect(observability.initSentry()).toBe(false);
    const status = observability.getObservabilityStatus();
    expect(status.hasDsn).toBe(true);
    expect(status.hasSdk).toBe(false);
    expect(status.reason).toBe('sdk-missing');
  });

  it('initSentry inicializa com DSN e SDK presentes', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { observability } = app.window.__APP_INTERNALS__;
    let initCalledWith = null;
    app.window.Sentry = {
      init(opts) { initCalledWith = opts; },
      captureException() {},
      captureMessage() {}
    };
    app.window.__APP_ENV__.SENTRY_DSN = 'https://abc@xyz.ingest.sentry.io/123';
    app.window.__APP_ENV__.SENTRY_ENVIRONMENT = 'staging';
    app.window.__APP_ENV__.SENTRY_RELEASE = 'v34-test';
    observability.resetObservability();
    expect(observability.initSentry()).toBe(true);
    expect(initCalledWith.dsn).toBe('https://abc@xyz.ingest.sentry.io/123');
    expect(initCalledWith.environment).toBe('staging');
    expect(initCalledWith.release).toBe('v34-test');
    expect(observability.getObservabilityStatus().initialized).toBe(true);
  });

  it('captureError é seguro de chamar mesmo sem inicialização', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { observability } = app.window.__APP_INTERNALS__;
    observability.resetObservability();
    expect(() => observability.captureError(new Error('teste'))).not.toThrow();
  });

  it('captureError encaminha para Sentry quando inicializado', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;
    const { observability } = app.window.__APP_INTERNALS__;
    let captured = null;
    app.window.Sentry = {
      init() {},
      captureException(err, ctx) { captured = { err, ctx }; },
      captureMessage() {}
    };
    app.window.__APP_ENV__.SENTRY_DSN = 'https://abc@xyz.ingest.sentry.io/123';
    observability.resetObservability();
    observability.initSentry();
    const err = new Error('falha real');
    observability.captureError(err, { feature: 'pendencias' });
    expect(captured.err).toBe(err);
    expect(captured.ctx).toEqual({ extra: { feature: 'pendencias' } });
  });
});
