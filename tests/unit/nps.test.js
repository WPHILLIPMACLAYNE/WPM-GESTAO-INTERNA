import { describe, it, expect } from 'vitest';
import { getRiskBand, getNpsGoalProgress } from '../helpers/pure-functions.js';

describe('getRiskBand()', () => {
  it('deve classificar como crítico (0-20)', () => {
    const band = getRiskBand(10);
    expect(band.tone).toBe('risk-red');
    expect(band.label).toContain('crítica');
  });

  it('deve classificar como atenção (21-40)', () => {
    const band = getRiskBand(30);
    expect(band.tone).toBe('risk-orange');
    expect(band.label).toContain('atenção');
  });

  it('deve classificar como moderado (41-60)', () => {
    const band = getRiskBand(50);
    expect(band.tone).toBe('risk-yellow');
    expect(band.label).toContain('moderada');
  });

  it('deve classificar como bom (61-80)', () => {
    const band = getRiskBand(70);
    expect(band.tone).toBe('risk-green-light');
    expect(band.label).toContain('boa');
  });

  it('deve classificar como excelente (81-100)', () => {
    const band = getRiskBand(90);
    expect(band.tone).toBe('risk-green-dark');
    expect(band.label).toContain('excelente');
  });

  it('deve lidar com limites exatos', () => {
    expect(getRiskBand(0).tone).toBe('risk-red');
    expect(getRiskBand(20).tone).toBe('risk-red');
    expect(getRiskBand(21).tone).toBe('risk-orange');
    expect(getRiskBand(40).tone).toBe('risk-orange');
    expect(getRiskBand(41).tone).toBe('risk-yellow');
    expect(getRiskBand(60).tone).toBe('risk-yellow');
    expect(getRiskBand(61).tone).toBe('risk-green-light');
    expect(getRiskBand(80).tone).toBe('risk-green-light');
    expect(getRiskBand(81).tone).toBe('risk-green-dark');
    expect(getRiskBand(100).tone).toBe('risk-green-dark');
  });

  it('deve fazer clamp de valores fora do range', () => {
    expect(getRiskBand(-10).tone).toBe('risk-red');
    expect(getRiskBand(150).tone).toBe('risk-green-dark');
  });

  it('deve lidar com null/undefined', () => {
    expect(getRiskBand(null).tone).toBe('risk-red');
    expect(getRiskBand(undefined).tone).toBe('risk-red');
  });
});

describe('getNpsGoalProgress()', () => {
  it('deve calcular porcentagem do progresso', () => {
    expect(getNpsGoalProgress(50, 100)).toBe(50);
    expect(getNpsGoalProgress(75, 100)).toBe(75);
  });

  it('deve limitar a 100%', () => {
    expect(getNpsGoalProgress(120, 100)).toBe(100);
    expect(getNpsGoalProgress(200, 100)).toBe(100);
  });

  it('deve retornar 0 se meta inválida', () => {
    expect(getNpsGoalProgress(50, 0)).toBe(0);
    expect(getNpsGoalProgress(50, null)).toBe(0);
  });

  it('deve calcular corretamente com meta não-100', () => {
    expect(getNpsGoalProgress(60, 80)).toBe(75);
    expect(getNpsGoalProgress(40, 80)).toBe(50);
  });
});
