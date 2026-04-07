import { describe, it, expect } from 'vitest';
import {
  getPeriodMetrics,
  periodHasMeaningfulData
} from '../helpers/pure-functions.js';

describe('getPeriodMetrics()', () => {
  it('deve retornar zeros para período vazio', () => {
    const metrics = getPeriodMetrics({
      students: [],
      pending: [],
      events: [],
      scale: [],
      nps: { mentions: [] },
      recados: [],
      addons: {}
    });
    expect(metrics.students).toBe(0);
    expect(metrics.pending).toBe(0);
    expect(metrics.events).toBe(0);
    expect(metrics.scale).toBe(0);
    expect(metrics.mentions).toBe(0);
    expect(metrics.recados).toBe(0);
    expect(metrics.addonVolume).toBe(0);
  });

  it('deve contar registros corretamente', () => {
    const metrics = getPeriodMetrics({
      students: [{ id: 1 }, { id: 2 }, { id: 3 }],
      pending: [{ id: 1 }],
      events: [{ id: 1 }, { id: 2 }],
      scale: [{ id: 1 }],
      nps: { mentions: [{ id: 1, name: 'João', count: 3 }] },
      recados: [{ id: 1 }, { id: 2 }],
      addons: {
        'João': { 'Energy': [1, 2, 0, 3] }
      }
    });
    expect(metrics.students).toBe(3);
    expect(metrics.pending).toBe(1);
    expect(metrics.events).toBe(2);
    expect(metrics.scale).toBe(1);
    expect(metrics.mentions).toBe(1);
    expect(metrics.recados).toBe(2);
    expect(metrics.addonVolume).toBe(6); // 1+2+0+3
  });

  it('deve lidar com null/undefined', () => {
    const metrics = getPeriodMetrics(null);
    expect(metrics.students).toBe(0);
    expect(metrics.pending).toBe(0);
  });

  it('deve lidar com estrutura parcial', () => {
    const metrics = getPeriodMetrics({
      students: [{ id: 1 }],
      nps: {}
    });
    expect(metrics.students).toBe(1);
    expect(metrics.mentions).toBe(0);
  });
});

describe('periodHasMeaningfulData()', () => {
  it('deve retornar false para período vazio', () => {
    expect(periodHasMeaningfulData(null)).toBe(false);
    expect(periodHasMeaningfulData({})).toBe(false);
  });

  it('deve retornar true se há alunos', () => {
    expect(periodHasMeaningfulData({ students: [{ id: 1 }] })).toBe(true);
  });

  it('deve retornar true se há pendências', () => {
    expect(periodHasMeaningfulData({ pending: [{ id: 1 }] })).toBe(true);
  });

  it('deve retornar true se há eventos', () => {
    expect(periodHasMeaningfulData({ events: [{ id: 1 }] })).toBe(true);
  });

  it('deve retornar true se há escala', () => {
    expect(periodHasMeaningfulData({ scale: [{ id: 1 }] })).toBe(true);
  });

  it('deve retornar true se há NPS score', () => {
    expect(periodHasMeaningfulData({ nps: { score: 50, mentions: [] } })).toBe(true);
  });

  it('deve retornar true se há mentions', () => {
    expect(periodHasMeaningfulData({ nps: { mentions: [{ id: 1 }] } })).toBe(true);
  });

  it('deve retornar true se há addons com volume', () => {
    expect(periodHasMeaningfulData({
      addons: { 'João': { 'Energy': [1, 0, 0] } }
    })).toBe(true);
  });

  it('deve retornar false se addons são todos zero', () => {
    expect(periodHasMeaningfulData({
      addons: { 'João': { 'Energy': [0, 0, 0] } }
    })).toBe(false);
  });
});
