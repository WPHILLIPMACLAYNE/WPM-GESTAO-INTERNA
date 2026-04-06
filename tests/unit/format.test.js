import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatPct,
  clamp,
  normalizeSearchText,
  csvEscape,
  buildCsvContent
} from '../helpers/pure-functions.js';

describe('formatDate()', () => {
  it('deve formatar ISO para DD/MM/YYYY', () => {
    expect(formatDate('2026-04-05')).toBe('05/04/2026');
  });

  it('deve retornar - para valor vazio', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });

  it('deve retornar valor original se formato inválido', () => {
    expect(formatDate('invalido')).toBe('invalido');
  });
});

describe('formatPct()', () => {
  it('deve formatar decimal como porcentagem', () => {
    expect(formatPct(0.85)).toBe('85%');
    expect(formatPct(1.0)).toBe('100%');
    expect(formatPct(0.0)).toBe('0%');
  });

  it('deve arredondar corretamente', () => {
    expect(formatPct(0.333)).toBe('33%');
    expect(formatPct(0.666)).toBe('67%');
  });

  it('deve lidar com null/undefined', () => {
    expect(formatPct(null)).toBe('0%');
    expect(formatPct(undefined)).toBe('0%');
  });
});

describe('clamp()', () => {
  it('deve limitar valor dentro do range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('deve limitar valor abaixo do mínimo', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('deve limitar valor acima do máximo', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('deve lidar com NaN', () => {
    expect(clamp(NaN, 0, 100)).toBe(0);
  });

  it('deve lidar com valores nos limites', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('normalizeSearchText()', () => {
  it('deve converter para lowercase', () => {
    expect(normalizeSearchText('WALLACE')).toBe('wallace');
  });

  it('deve remover acentos', () => {
    expect(normalizeSearchText('João')).toBe('joao');
    expect(normalizeSearchText('Café')).toBe('cafe');
  });

  it('deve remover espaços extras', () => {
    expect(normalizeSearchText('  teste  ')).toBe('teste');
  });

  it('deve lidar com null/undefined', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
  });

  it('deve permitir busca parcial', () => {
    const text = normalizeSearchText('Wallace Phillip Maclayne');
    expect(text.includes('wallace')).toBe(true);
    expect(text.includes('phillip')).toBe(true);
    expect(text.includes('maclayne')).toBe(true);
  });
});

describe('csvEscape()', () => {
  it('deve escapar valores com aspas duplas', () => {
    expect(csvEscape('Nome "apelido"')).toBe('"Nome ""apelido"""');
  });

  it('deve escapar valores com ponto e vírgula', () => {
    expect(csvEscape('A;B;C')).toBe('"A;B;C"');
  });

  it('deve substituir quebras de linha por espaço', () => {
    expect(csvEscape('Linha 1\nLinha 2')).toBe('Linha 1 Linha 2');
    expect(csvEscape('Linha 1\r\nLinha 2')).toBe('Linha 1 Linha 2');
  });

  it('deve retornar valor normal se não contém caracteres especiais', () => {
    expect(csvEscape('Nome Simples')).toBe('Nome Simples');
  });

  it('deve lidar com null/undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});

describe('buildCsvContent()', () => {
  it('deve gerar CSV com separador ;', () => {
    const rows = [
      ['Nome', 'Matrícula', 'Addon'],
      ['João', '12345', 'Energy']
    ];
    const csv = buildCsvContent(rows);
    expect(csv).toBe('Nome;Matrícula;Addon\nJoão;12345;Energy');
  });

  it('deve escapar valores corretamente', () => {
    const rows = [['Nome', 'Obs'], ['João', 'Nota; importante']];
    const csv = buildCsvContent(rows);
    expect(csv).toBe('Nome;Obs\nJoão;"Nota; importante"');
  });
});
