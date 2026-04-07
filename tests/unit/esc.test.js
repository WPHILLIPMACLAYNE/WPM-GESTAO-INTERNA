import { describe, it, expect } from 'vitest';
import { esc, sanitizeDeep } from '../helpers/pure-functions.js';

describe('esc()', () => {
  it('deve retornar string vazia para null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('deve escapar & como &amp;', () => {
    expect(esc('A & B')).toBe('A &amp; B');
  });

  it('deve escapar < como &lt;', () => {
    expect(esc('x < 10')).toBe('x &lt; 10');
  });

  it('deve escapar > como &gt;', () => {
    expect(esc('x > 5')).toBe('x &gt; 5');
  });

  it('deve escapar " como &quot;', () => {
    expect(esc('Nome "apelido"')).toBe('Nome &quot;apelido&quot;');
  });

  it('deve escapar \' como &#x27;', () => {
    expect(esc("O'Brien")).toBe('O&#x27;Brien');
  });

  it('deve escapar / como &#x2F;', () => {
    expect(esc('</script>')).toBe('&lt;&#x2F;script&gt;');
  });

  it('deve prevenir XSS básico', () => {
    const xss = '<script>alert(1)</script>';
    const escaped = esc(xss);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
  });

  it('deve prevenir XSS em atributos', () => {
    const xss = '" onmouseover="alert(1)"';
    const escaped = esc(xss);
    expect(escaped).not.toContain('"');
    expect(escaped).toContain('&quot;');
  });

  it('deve preservar texto normal', () => {
    expect(esc('Wallace Phillip Maclayne')).toBe('Wallace Phillip Maclayne');
  });

  it('deve converter número para string', () => {
    expect(esc(42)).toBe('42');
    expect(esc(0)).toBe('0');
  });
});

describe('sanitizeDeep()', () => {
  it('deve remover null bytes de strings', () => {
    expect(sanitizeDeep('hello\x00world')).toBe('helloworld');
  });

  it('deve aplicar trim em strings', () => {
    expect(sanitizeDeep('  hello  ')).toBe('hello');
  });

  it('deve preservar < e > em dados legítimos', () => {
    const data = { email: 'joao<silva@email.com>', formula: 'x < 10' };
    const sanitized = sanitizeDeep(data);
    expect(sanitized.email).toBe('joao<silva@email.com>');
    expect(sanitized.formula).toBe('x < 10');
  });

  it('deve processar arrays recursivamente', () => {
    const data = ['  hello  ', '  world  '];
    expect(sanitizeDeep(data)).toEqual(['hello', 'world']);
  });

  it('deve processar objetos aninhados recursivamente', () => {
    const data = {
      name: '  Test  ',
      nested: {
        value: '  nested  ',
        deep: { leaf: '  leaf  ' }
      }
    };
    const result = sanitizeDeep(data);
    expect(result.name).toBe('Test');
    expect(result.nested.value).toBe('nested');
    expect(result.nested.deep.leaf).toBe('leaf');
  });

  it('deve preservar números e booleanos', () => {
    const data = { count: 42, active: true, score: 3.14 };
    expect(sanitizeDeep(data)).toEqual({ count: 42, active: true, score: 3.14 });
  });

  it('deve lidar com null no objeto', () => {
    const data = { name: null, value: 'test' };
    const result = sanitizeDeep(data);
    expect(result.name).toBeNull();
    expect(result.value).toBe('test');
  });
});
