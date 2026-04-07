import { describe, it, expect } from 'vitest';
import {
  validateStudent,
  validatePending,
  validateEvent
} from '../helpers/pure-functions.js';

describe('validateStudent()', () => {
  it('deve validar dados completos', () => {
    const result = validateStudent({
      nome: 'João Silva',
      matricula: '12345'
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('deve falhar sem nome', () => {
    const result = validateStudent({ nome: '', matricula: '12345' });
    expect(result.valid).toBe(false);
    expect(result.errors.nome).toBeDefined();
  });

  it('deve falhar sem matrícula', () => {
    const result = validateStudent({ nome: 'João', matricula: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.matricula).toBeDefined();
  });

  it('deve falhar com ambos vazios', () => {
    const result = validateStudent({ nome: '', matricula: '' });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toHaveLength(2);
  });

  it('deve rejeitar nome só com espaços', () => {
    const result = validateStudent({ nome: '   ', matricula: '12345' });
    expect(result.valid).toBe(false);
  });

  it('deve lidar com null/undefined', () => {
    const result = validateStudent(null);
    expect(result.valid).toBe(false);
    expect(result.errors.nome).toBeDefined();
    expect(result.errors.matricula).toBeDefined();
  });
});

describe('validatePending()', () => {
  it('deve validar dados completos', () => {
    const result = validatePending({
      nome: 'João',
      pendencia: 'Regularizar cadastro',
      data: '2026-04-05'
    });
    expect(result.valid).toBe(true);
  });

  it('deve falhar sem nome', () => {
    const result = validatePending({ nome: '', pendencia: 'Teste', data: '2026-04-05' });
    expect(result.valid).toBe(false);
    expect(result.errors.nome).toBeDefined();
  });

  it('deve falhar sem descrição', () => {
    const result = validatePending({ nome: 'João', pendencia: '', data: '2026-04-05' });
    expect(result.valid).toBe(false);
    expect(result.errors.required).toBeDefined();
  });

  it('deve falhar sem data', () => {
    const result = validatePending({ nome: 'João', pendencia: 'Teste', data: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.data).toBeDefined();
  });
});

describe('validateEvent()', () => {
  it('deve validar dados completos', () => {
    const result = validateEvent({
      date: '2026-04-15',
      title: 'Treinamento de vendas'
    });
    expect(result.valid).toBe(true);
  });

  it('deve falhar sem data', () => {
    const result = validateEvent({ date: '', title: 'Evento' });
    expect(result.valid).toBe(false);
    expect(result.errors.date).toBeDefined();
  });

  it('deve falhar sem título', () => {
    const result = validateEvent({ date: '2026-04-15', title: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.required).toBeDefined();
  });
});
