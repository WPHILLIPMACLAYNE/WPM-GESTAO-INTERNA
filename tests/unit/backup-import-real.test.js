import { afterEach, describe, expect, it } from 'vitest';
import { loadRealApp } from '../helpers/load-real-app.js';

let cleanup = () => {};

afterEach(() => {
  cleanup();
  cleanup = () => {};
});

async function createSeededImportApp() {
  const app = await loadRealApp();
  cleanup = app.cleanup;

  await app.setStore({
    version: app.window.__APP_INTERNALS__.config.STORE_VERSION,
    activePeriod: '2026-05',
    preferences: { initializeMonthsWithTestData: false },
    periods: {
      '2026-05': app.window.generatePeriodSeed('2026-05'),
      '2026-06': app.window.generatePeriodSeed('2026-06')
    },
    archives: {}
  });

  return app;
}

describe('Importação real com preview granular', () => {
  it('bloqueia backup completo destrutivo sem aceite do preview granular', async () => {
    const app = await createSeededImportApp();
    const { config, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = persistence.readStoredJson(config.STORAGE_KEY);
    const importedStore = {
      version: config.STORE_VERSION,
      activePeriod: '2026-06',
      preferences: { initializeMonthsWithTestData: false },
      periods: {
        '2026-06': app.window.generatePeriodSeed('2026-06')
      },
      archives: {}
    };
    importedStore.periods['2026-06'].students = [
      { id: 'student-imported', nome: 'Importado', matricula: 'IMP-1', atendimento: 'Ana' }
    ];

    const payload = persistence.buildBackupPayloadFromStore(importedStore, {
      exportedAt: '2026-06-02T10:00:00.000Z'
    });
    const preview = persistence.buildImportPreview(payload, baseStore);

    expect(preview.requiresGranularPreview).toBe(true);
    expect(preview.periodChanges.find(item => item.periodKey === '2026-05')?.action).toBe('replaced');
    expect(preview.periodChanges.find(item => item.periodKey === '2026-06')?.action).toBe('replaced');

    await expect(persistence.applyImportedStore(payload, {
      preview,
      eventType: 'import'
    })).rejects.toThrow(/preview granular/i);
  });

  it('rejeita backup completo adulterado mesmo com preview aceito', async () => {
    const app = await createSeededImportApp();
    const { config, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = persistence.readStoredJson(config.STORAGE_KEY);
    const payload = persistence.buildBackupPayloadFromStore(baseStore, {
      exportedAt: '2026-06-02T10:00:00.000Z'
    });
    payload.periods['2026-05'].students.push({
      id: 'tampered',
      nome: 'Alterado depois do hash',
      matricula: 'BAD-1',
      atendimento: 'Ana'
    });

    const preview = persistence.buildImportPreview(payload, baseStore);

    await expect(persistence.applyImportedStore(payload, {
      preview,
      previewAccepted: true,
      eventType: 'import'
    })).rejects.toThrow(/integridade|hash/i);
  });

  it('aplica backup completo quando preview foi aceito e integridade confere', async () => {
    const app = await createSeededImportApp();
    const { config, persistence } = app.window.__APP_INTERNALS__;
    const baseStore = persistence.readStoredJson(config.STORAGE_KEY);
    const importedStore = {
      ...baseStore,
      periods: {
        ...baseStore.periods,
        '2026-05': {
          ...baseStore.periods['2026-05'],
          students: [
            { id: 'student-imported', nome: 'Importado', matricula: 'IMP-1', atendimento: 'Ana' }
          ]
        }
      }
    };
    const payload = persistence.buildBackupPayloadFromStore(importedStore, {
      exportedAt: '2026-06-02T10:00:00.000Z'
    });
    const preview = persistence.buildImportPreview(payload, baseStore);

    const summary = await persistence.applyImportedStore(payload, {
      preview,
      previewAccepted: true,
      eventType: 'import'
    });
    const nextStore = persistence.readStoredJson(config.STORAGE_KEY);

    expect(summary.periods).toBeGreaterThanOrEqual(12);
    expect(nextStore.periods['2026-05'].students).toHaveLength(1);
    expect(nextStore.periods['2026-05'].students[0]).toMatchObject({
      id: 'student-imported',
      nome: 'Importado'
    });
  });
});
