import { beforeAll, describe, expect, it, vi } from 'vitest';

let bootstrapRuntimeEnv;
let canLoadRuntimeEnvScript;

function createDocument({ readyState = 'loading' } = {}) {
  return {
    readyState,
    write: vi.fn(),
    createElement: vi.fn((tag) => ({ tag })),
    head: {
      appendChild: vi.fn(),
    },
  };
}

describe('reconstruction env bootstrap', () => {
  beforeAll(async () => {
    window.__RECONSTRUCTION_ENV_BOOTSTRAP_NO_AUTO_RUN__ = true;
    ({
      bootstrapRuntimeEnv,
      canLoadRuntimeEnvScript,
    } = await import('../../src/reconstruction/env-bootstrap.js'));
  });

  it('carrega env.js em runtime remoto para permitir deploy com Supabase', () => {
    const document = createDocument();
    const result = bootstrapRuntimeEnv({
      location: { protocol: 'https:', hostname: 'wpm-gestao-interna.vercel.app' },
      document,
    });

    expect(result).toMatchObject({
      localRuntime: false,
      envScriptLoaded: true,
      loadMode: 'document.write',
    });
    expect(document.write).toHaveBeenCalledWith('<script src="env.js"><\\/script>');
  });

  it('mantem env.js opcional em runtime local via appendChild apos loading', () => {
    const document = createDocument({ readyState: 'complete' });
    const result = bootstrapRuntimeEnv({
      location: { protocol: 'http:', hostname: '127.0.0.1' },
      document,
    });

    expect(result).toMatchObject({
      localRuntime: true,
      envScriptLoaded: true,
      loadMode: 'head.appendChild',
    });
    expect(document.head.appendChild).toHaveBeenCalledWith(expect.objectContaining({
      src: 'env.js',
      async: false,
    }));
  });

  it('nao tenta carregar env.js em protocolo nao suportado', () => {
    expect(canLoadRuntimeEnvScript({ protocol: 'chrome-extension:' })).toBe(false);
    const document = createDocument();
    const result = bootstrapRuntimeEnv({
      location: { protocol: 'chrome-extension:', hostname: 'extension' },
      document,
    });

    expect(result).toMatchObject({ envScriptLoaded: false });
    expect(document.write).not.toHaveBeenCalled();
  });
});
