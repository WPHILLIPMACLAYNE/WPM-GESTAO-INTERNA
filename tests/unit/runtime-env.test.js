import { afterEach, describe, expect, it } from 'vitest';
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
