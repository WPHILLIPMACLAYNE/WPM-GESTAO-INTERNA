import { afterEach, describe, expect, it } from 'vitest';
import { loadRealApp } from '../helpers/load-real-app.js';

let cleanup = () => {};

afterEach(() => {
  cleanup();
  cleanup = () => {};
});

describe('generatePeriodSeed()', () => {
  it('gera massa mensal com volumes e formatos esperados', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const period = app.window.generatePeriodSeed('2026-07');

    expect(period.students).toHaveLength(30);
    expect(period.pending).toHaveLength(20);
    expect(period.events).toHaveLength(10);
    expect(period.scale).toHaveLength(31);
    expect(period.settings.monthDays).toBe(31);
    expect(period.students.every((item) => String(item.inicio).startsWith('2026-07-'))).toBe(true);
    expect(period.pending.every((item) => String(item.data).startsWith('2026-07-'))).toBe(true);
    expect(period.events.every((item) => String(item.date).startsWith('2026-07-'))).toBe(true);
  });

  it('mantém dados determinísticos para o mesmo periodKey ignorando ids randômicos', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const first = app.window.generatePeriodSeed('2026-11');
    const second = app.window.generatePeriodSeed('2026-11');

    const normalizeStudents = (rows) => rows.map((item) => ({
      nome: item.nome,
      matricula: item.matricula,
      inicio: item.inicio,
      atendimento: item.atendimento,
      feedback: item.feedback,
      addon: item.addon
    }));

    const normalizeEvents = (rows) => rows.map((item) => ({
      date: item.date,
      time: item.time,
      type: item.type,
      title: item.title,
      status: item.status
    }));

    expect(normalizeStudents(first.students)).toEqual(normalizeStudents(second.students));
    expect(normalizeEvents(first.events)).toEqual(normalizeEvents(second.events));
    expect(first.nps.score).toBe(second.nps.score);
  });

  it('usa a quantidade correta de dias em fevereiro bissexto', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const period = app.window.generatePeriodSeed('2024-02');

    const allDays = [
      ...period.students.map((item) => Number(String(item.inicio).slice(-2))),
      ...period.pending.map((item) => Number(String(item.data).slice(-2))),
      ...period.events.map((item) => Number(String(item.date).slice(-2)))
    ];

    expect(period.settings.monthDays).toBe(29);
    expect(period.scale).toHaveLength(29);
    expect(Math.max(...allDays)).toBeLessThanOrEqual(29);
    expect(Math.min(...allDays)).toBeGreaterThanOrEqual(1);
  });

  it('aplica metas de nps com clamp e deduplica addonTypes vindos do template', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const seeded = app.window.generatePeriodSeed('2026-05', {
      settings: {
        receptionists: ['Ana', 'Bruno'],
        professors: ['Carla'],
        addonTypes: ['Vip', 'Vip', '', 'Premium']
      },
      nps: {
        monthlyGoal: 140,
        semesterGoal: -12
      }
    });

    expect(seeded.settings.addonTypes).toEqual(['Vip', 'Premium']);
    expect(seeded.settings.receptionists).toEqual(['Ana', 'Bruno']);
    expect(seeded.settings.professors).toEqual(['Carla']);
    expect(seeded.nps.monthlyGoal).toBe(100);
    expect(seeded.nps.semesterGoal).toBe(0);
    expect(seeded.students.every((item) => ['Ana', 'Bruno'].includes(item.atendimento))).toBe(true);
  });

  it('cria rankSnapshot com ids de menções apontando para posições válidas', async () => {
    const app = await loadRealApp();
    cleanup = app.cleanup;

    const period = app.window.generatePeriodSeed('2026-09');
    const ids = period.nps.mentions.map((item) => item.id);
    const snapshotEntries = Object.entries(period.nps.rankSnapshot || {});

    expect(snapshotEntries).toHaveLength(period.nps.mentions.length);
    expect(snapshotEntries.every(([id]) => ids.includes(id))).toBe(true);
    expect(snapshotEntries.every(([, position]) => Number.isInteger(position) && position >= 1)).toBe(true);
  });
});

