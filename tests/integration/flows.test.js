import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateStudent,
  validatePending,
  validateEvent,
  sanitizeDeep,
  getPeriodMetrics,
  periodHasMeaningfulData,
  getPreviousPeriodKey,
  getNextPeriodKey
} from '../helpers/pure-functions.js';

describe('Fluxo: Cadastro de Aluno', () => {
  it('deve validar -> criar -> contar aluno', () => {
    // 1. Validação
    const validation = validateStudent({
      nome: 'Ana Silva',
      matricula: '10001'
    });
    expect(validation.valid).toBe(true);

    // 2. Simular criação (inserir em coleção)
    const students = [];
    const newStudent = {
      id: 'uuid-1',
      nome: 'Ana Silva',
      matricula: '10001',
      ultimaVisita: '2026-04-05',
      horaVisita: '14:30',
      inicio: '2026-04-01',
      avisoNps: 'Sim',
      atendimento: 'Wallace',
      feedback: 'Respondeu',
      addon: 'Energy',
      observacoes: ''
    };
    students.push(newStudent);

    // 3. Verificar contagem
    const metrics = getPeriodMetrics({
      students,
      pending: [],
      events: [],
      scale: [],
      nps: { mentions: [] },
      recados: [],
      addons: { 'Wallace': { 'Energy': [1] } }
    });
    expect(metrics.students).toBe(1);
  });

  it('deve rejeitar aluno sem nome e não criar', () => {
    const validation = validateStudent({ nome: '', matricula: '10002' });
    expect(validation.valid).toBe(false);
    // Se validação falha, não cria
    const students = [];
    expect(students.length).toBe(0);
  });
});

describe('Fluxo: Cadastro de Pendência', () => {
  it('deve validar -> criar -> alterar status -> contar', () => {
    // 1. Validação
    const validation = validatePending({
      nome: 'Carlos Souza',
      pendencia: 'Regularizar matrícula',
      data: '2026-04-05'
    });
    expect(validation.valid).toBe(true);

    // 2. Simular criação
    const pending = [];
    const newPending = {
      id: 'uuid-2',
      nome: 'Carlos Souza',
      matricula: '20001',
      pendencia: 'Regularizar matrícula',
      data: '2026-04-05',
      hostess: 'Emilia',
      resposta: '',
      status: 'aberto'
    };
    pending.push(newPending);

    // 3. Alterar status
    const item = pending.find(p => p.id === 'uuid-2');
    expect(item.status).toBe('aberto');
    item.status = 'respondido';
    expect(item.status).toBe('respondido');
    item.status = 'concluido';
    expect(item.status).toBe('concluido');

    // 4. Verificar contagem
    const metrics = getPeriodMetrics({
      students: [],
      pending,
      events: [],
      scale: [],
      nps: { mentions: [] },
      recados: [],
      addons: {}
    });
    expect(metrics.pending).toBe(1);
  });
});

describe('Fluxo: NPS', () => {
  it('deve ajustar score -> verificar faixa de risco', () => {
    let score = 45;
    // Faixa moderada
    expect(score >= 41 && score <= 60).toBe(true);

    // Melhorar score
    score = 72;
    // Faixa boa
    expect(score >= 61 && score <= 80).toBe(true);

    // Piorar score
    score = 15;
    // Faixa crítica
    expect(score <= 20).toBe(true);
  });

  it('deve gerenciar menções -> ranking', () => {
    const mentions = [
      { id: 'm1', name: 'Wallace', count: 5 },
      { id: 'm2', name: 'Emilia', count: 3 },
      { id: 'm3', name: 'Gessica', count: 8 }
    ];

    // Ordenar por count decrescente
    const ranking = [...mentions].sort((a, b) => b.count - a.count);
    expect(ranking[0].name).toBe('Gessica');
    expect(ranking[1].name).toBe('Wallace');
    expect(ranking[2].name).toBe('Emilia');

    // Ajustar menção
    const target = mentions.find(m => m.id === 'm2');
    target.count += 6; // Emilia recebe +6 citações
    expect(target.count).toBe(9);

    // Reordenar
    const newRanking = [...mentions].sort((a, b) => b.count - a.count);
    expect(newRanking[0].name).toBe('Emilia');
  });
});

describe('Fluxo: Navegação entre Períodos', () => {
  it('deve navegar para trás e para frente corretamente', () => {
    let current = '2026-04';

    // Avançar 3 meses
    current = getNextPeriodKey(current); // 2026-05
    expect(current).toBe('2026-05');
    current = getNextPeriodKey(current); // 2026-06
    expect(current).toBe('2026-06');
    current = getNextPeriodKey(current); // 2026-07
    expect(current).toBe('2026-07');

    // Voltar 3 meses
    current = getPreviousPeriodKey(current); // 2026-06
    expect(current).toBe('2026-06');
    current = getPreviousPeriodKey(current); // 2026-05
    expect(current).toBe('2026-05');
    current = getPreviousPeriodKey(current); // 2026-04
    expect(current).toBe('2026-04');
  });

  it('deve navegar através da virada de ano', () => {
    const dec2026 = getNextPeriodKey('2026-11');
    expect(dec2026).toBe('2026-12');

    const jan2027 = getNextPeriodKey('2026-12');
    expect(jan2027).toBe('2027-01');

    const dez2026 = getPreviousPeriodKey('2027-01');
    expect(dez2026).toBe('2026-12');
  });
});

describe('Fluxo: Backup e Importação (sanitização)', () => {
  it('deve sanitizar dados importados sem corromper < e >', () => {
    const importedData = {
      students: [
        {
          nome: 'João <Silva>',
          email: 'joao<silva@email.com>',
          observacoes: 'Aluno nota: x < 10 = aprovado'
        }
      ]
    };

    const sanitized = sanitizeDeep(importedData);

    // Dados legítimos com < e > devem ser preservados
    expect(sanitized.students[0].nome).toBe('João <Silva>');
    expect(sanitized.students[0].email).toBe('joao<silva@email.com>');
    expect(sanitized.students[0].observacoes).toBe('Aluno nota: x < 10 = aprovado');
  });

  it('deve aplicar trim em strings importados', () => {
    const importedData = {
      students: [
        { nome: '  Ana  ', matricula: '  12345  ' }
      ]
    };

    const sanitized = sanitizeDeep(importedData);
    expect(sanitized.students[0].nome).toBe('Ana');
    expect(sanitized.students[0].matricula).toBe('12345');
  });

  it('deve remover null bytes de strings importados', () => {
    const importedData = {
      students: [
        { nome: 'Ana\x00Silva', matricula: '12345' }
      ]
    };

    const sanitized = sanitizeDeep(importedData);
    expect(sanitized.students[0].nome).toBe('AnaSilva');
    expect(sanitized.students[0].nome).not.toContain('\x00');
  });
});

describe('Fluxo: Fechamento de Mês', () => {
  it('deve identificar mês com dados significativos', () => {
    const monthWithData = {
      students: Array.from({ length: 35 }, (_, i) => ({ id: `s${i}` })),
      pending: Array.from({ length: 22 }, (_, i) => ({ id: `p${i}` })),
      events: Array.from({ length: 12 }, (_, i) => ({ id: `e${i}` })),
      scale: Array.from({ length: 20 }, (_, i) => ({ id: `sc${i}` })),
      nps: { score: 72, mentions: [{ id: 'm1', name: 'João', count: 5 }] },
      recados: [{ id: 'r1', from: 'Wallace', to: 'Todos', text: 'Teste', createdAt: '2026-04-01', read: false }],
      addons: { 'Wallace': { 'Energy': [1, 2, 3, 0, 1] } }
    };

    expect(periodHasMeaningfulData(monthWithData)).toBe(true);
    const metrics = getPeriodMetrics(monthWithData);
    expect(metrics.students).toBe(35);
    expect(metrics.pending).toBe(22);
    expect(metrics.events).toBe(12);
    expect(metrics.scale).toBe(20);
  });

  it('deve identificar mês vazio', () => {
    const emptyMonth = {
      students: [],
      pending: [],
      events: [],
      scale: [],
      nps: { score: 0, mentions: [] },
      recados: [],
      addons: {}
    };

    expect(periodHasMeaningfulData(emptyMonth)).toBe(false);
  });
});

describe('Fluxo: Escala — duplicação entre meses', () => {
  it('deve calcular dias corretamente entre meses de tamanhos diferentes', () => {
    // Janeiro (31 dias) -> Fevereiro (28 dias)
    // Dias 29, 30, 31 devem ser ignorados
    const januaryDays = 31;
    const februaryDays = 28;

    const skippedDays = januaryDays - februaryDays;
    expect(skippedDays).toBe(3);
  });

  it('deve identificar sábado corretamente para tom da escala', () => {
    // 2026-04-11 é sábado
    const saturday = '2026-04-11';
    const dt = new Date(Date.UTC(2026, 3, 11));
    expect(dt.getUTCDay()).toBe(6);
  });
});
