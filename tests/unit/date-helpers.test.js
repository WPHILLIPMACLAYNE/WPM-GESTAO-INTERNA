import { describe, it, expect } from 'vitest';
import {
  getWeekdayLabel,
  suggestScaleTone,
  isDateInActivePeriod,
  getPeriodLabel,
  getPreviousPeriodKey,
  getNextPeriodKey,
  isValidPeriodKey
} from '../helpers/pure-functions.js';

describe('getWeekdayLabel()', () => {
  it('deve retornar dia da semana em português', () => {
    // 2026-04-06 é segunda-feira
    expect(getWeekdayLabel('2026-04-06')).toContain('seg');
    // 2026-04-11 é sábado
    expect(getWeekdayLabel('2026-04-11')).toContain('sáb');
    // 2026-04-05 é domingo
    expect(getWeekdayLabel('2026-04-05')).toContain('dom');
  });

  it('deve retornar string vazia para entrada inválida', () => {
    expect(getWeekdayLabel('')).toBe('');
    expect(getWeekdayLabel(null)).toBe('');
    expect(getWeekdayLabel('invalido')).toBe('');
  });

  it('deve usar timezone America/Sao_Paulo para consistência', () => {
    // Deve funcionar corretamente independente do fuso local
    const label = getWeekdayLabel('2026-01-01');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

describe('suggestScaleTone()', () => {
  it('deve retornar green para sábado', () => {
    // 2026-04-11 é sábado
    expect(suggestScaleTone('2026-04-11')).toBe('green');
  });

  it('deve retornar neutral para dia útil', () => {
    // 2026-04-06 é segunda
    expect(suggestScaleTone('2026-04-06')).toBe('neutral');
  });

  it('deve retornar neutral para domingo', () => {
    // 2026-04-05 é domingo (não é sábado)
    expect(suggestScaleTone('2026-04-05')).toBe('neutral');
  });

  it('deve retornar neutral para entrada inválida', () => {
    expect(suggestScaleTone('')).toBe('neutral');
    expect(suggestScaleTone(null)).toBe('neutral');
  });
});

describe('isDateInActivePeriod()', () => {
  it('deve retornar true para data no período ativo', () => {
    expect(isDateInActivePeriod('2026-04-15', '2026-04')).toBe(true);
  });

  it('deve retornar false para data fora do período', () => {
    expect(isDateInActivePeriod('2026-03-15', '2026-04')).toBe(false);
    expect(isDateInActivePeriod('2026-05-01', '2026-04')).toBe(false);
  });

  it('deve retornar false para valor vazio', () => {
    expect(isDateInActivePeriod('', '2026-04')).toBe(false);
    expect(isDateInActivePeriod(null, '2026-04')).toBe(false);
  });
});

describe('getPeriodLabel()', () => {
  it('deve retornar nome do mês em português', () => {
    expect(getPeriodLabel('2026-01')).toBe('Janeiro/2026');
    expect(getPeriodLabel('2026-04')).toBe('Abril/2026');
    expect(getPeriodLabel('2026-12')).toBe('Dezembro/2026');
  });

  it('deve usar padrão se não fornecido', () => {
    expect(getPeriodLabel()).toContain('2026');
  });
});

describe('getPreviousPeriodKey()', () => {
  it('deve retornar mês anterior no mesmo ano', () => {
    expect(getPreviousPeriodKey('2026-04')).toBe('2026-03');
  });

  it('deve retornar dezembro do ano anterior em janeiro', () => {
    expect(getPreviousPeriodKey('2026-01')).toBe('2025-12');
  });

  it('deve formatar com zero à esquerda', () => {
    expect(getPreviousPeriodKey('2026-10')).toBe('2026-09');
  });
});

describe('getNextPeriodKey()', () => {
  it('deve retornar próximo mês no mesmo ano', () => {
    expect(getNextPeriodKey('2026-04')).toBe('2026-05');
  });

  it('deve retornar janeiro do próximo ano em dezembro', () => {
    expect(getNextPeriodKey('2026-12')).toBe('2027-01');
  });
});

describe('isValidPeriodKey()', () => {
  it('deve aceitar formato YYYY-MM válido', () => {
    expect(isValidPeriodKey('2026-04')).toBe(true);
    expect(isValidPeriodKey('2025-12')).toBe(true);
    expect(isValidPeriodKey('2020-01')).toBe(true);
  });

  it('deve rejeitar formato inválido', () => {
    expect(isValidPeriodKey('2026-13')).toBe(false);
    expect(isValidPeriodKey('2026-00')).toBe(false);
    expect(isValidPeriodKey('invalido')).toBe(false);
    expect(isValidPeriodKey('')).toBe(false);
    expect(isValidPeriodKey(null)).toBe(false);
    expect(isValidPeriodKey('2026-4')).toBe(false);
  });
});
