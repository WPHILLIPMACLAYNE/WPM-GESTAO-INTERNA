import { afterEach, describe, expect, it } from 'vitest';
import { loadRealApp } from '../helpers/load-real-app.js';

let cleanup = () => {};

afterEach(() => {
  cleanup();
  cleanup = () => {};
});

function makePayload(key) {
  return `"><img src=x data-xss="${key}">XSS-${key.toUpperCase()}`;
}

function createDaySeries(length, initialValue = 0, highlightedIndex = -1, highlightedValue = 0) {
  return Array.from({ length }, (_, index) => (index === highlightedIndex ? highlightedValue : initialValue));
}

function expectEscapedMarkup(container, key, marker) {
  expect(container).toBeTruthy();
  expect(container.querySelector(`[data-xss="${key}"]`)).toBeNull();
  expect(container.textContent || '').toContain(marker);
}

async function createMaliciousApp(periodKey = '2026-07') {
  const app = await loadRealApp();
  cleanup = app.cleanup;

  const { config, schema, domain, rendering } = app.window.__APP_INTERNALS__;
  const period = schema.buildCleanPeriodFromTemplate(null, periodKey);

  const payloads = {
    student: makePayload('student'),
    pending: makePayload('pending'),
    event: makePayload('event'),
    recado: makePayload('recado'),
    nps: makePayload('nps'),
    settings: makePayload('settings'),
    settingsAddon: makePayload('settings-addon')
  };

  period.settings.receptionists = ['Wallace', payloads.settings];
  period.settings.professors = ['Professor Seguro'];
  period.settings.team = [...new Set([...period.settings.receptionists, ...period.settings.professors])];
  period.settings.addonTypes = ['Energy', payloads.settingsAddon];

  period.students = [{
    id: 'student-1',
    nome: payloads.student,
    matricula: '10001',
    ultimaVisita: `${periodKey}-05`,
    horaVisita: '09:30',
    inicio: `${periodKey}-01`,
    avisoNps: 'Sim',
    atendimento: 'Wallace',
    feedback: 'Respondeu',
    addon: 'Energy',
    observacoes: payloads.student
  }];

  period.pending = [{
    id: 'pending-1',
    nome: payloads.pending,
    matricula: '20001',
    pendencia: payloads.pending,
    data: `${periodKey}-06`,
    hostess: 'Wallace',
    resposta: payloads.pending,
    status: 'aberto'
  }];

  period.events = [{
    id: 'event-1',
    date: `${periodKey}-07`,
    time: '10:00',
    type: 'Campanha',
    title: payloads.event,
    place: 'Unidade',
    owner: 'Marketing',
    description: payloads.event,
    status: 'Programado'
  }];

  period.recados = [{
    id: 'recado-1',
    from: 'Wallace',
    to: 'Todos',
    text: payloads.recado,
    createdAt: `${periodKey}-01T08:00:00.000Z`,
    read: false
  }];

  period.nps = {
    score: 72,
    monthlyGoal: 75,
    semesterGoal: 80,
    observations: payloads.nps,
    mentions: [{
      id: 'mention-1',
      name: payloads.nps,
      count: 3
    }],
    rankSnapshot: {
      'mention-1': 1
    }
  };

  period.addons = {
    Wallace: {
      Energy: createDaySeries(period.settings.monthDays, 0, 0, 1),
      [payloads.settingsAddon]: createDaySeries(period.settings.monthDays)
    },
    [payloads.settings]: {
      Energy: createDaySeries(period.settings.monthDays),
      [payloads.settingsAddon]: createDaySeries(period.settings.monthDays, 0, 1, 2)
    }
  };

  await app.setStore({
    version: config.STORE_VERSION,
    activePeriod: periodKey,
    periods: {
      [periodKey]: period
    },
    archives: {}
  });

  domain.limparCacheSelectores();
  rendering.renderAll();
  await new Promise(resolve => setTimeout(resolve, 60));

  return { app, payloads };
}

describe('XSS por entidade', () => {
  it('renderiza aluno malicioso como texto', async () => {
    const { app } = await createMaliciousApp();
    const row = app.window.document.querySelector('#studentTableBody tr');
    expectEscapedMarkup(row, 'student', 'XSS-STUDENT');
  });

  it('renderiza pendencia maliciosa como texto', async () => {
    const { app } = await createMaliciousApp();
    const row = app.window.document.querySelector('#pendingTableBody tr');
    expectEscapedMarkup(row, 'pending', 'XSS-PENDING');
  });

  it('renderiza evento malicioso como texto', async () => {
    const { app } = await createMaliciousApp();
    const card = app.window.document.querySelector('#eventsList .event-card');
    expectEscapedMarkup(card, 'event', 'XSS-EVENT');
  });

  it('renderiza recado malicioso como texto', async () => {
    const { app } = await createMaliciousApp();
    const card = app.window.document.querySelector('#recadosList .recado-card');
    expectEscapedMarkup(card, 'recado', 'XSS-RECADO');
  });

  it('renderiza ranking NPS malicioso como texto sem criar HTML ativo', async () => {
    const { app } = await createMaliciousApp();
    const item = app.window.document.querySelector('#npsRankingList .rank-item');
    expect(item).toBeTruthy();
    expect(item.querySelector('[data-xss="nps"]')).toBeNull();

    const input = item?.querySelector('.rank-name-input');
    expect(input?.value || '').toContain('XSS-NPS');
  });

  it('renderiza configuracoes maliciosas como texto nas views derivadas', async () => {
    const { app } = await createMaliciousApp();
    const addonsGrid = app.window.document.querySelector('#addonsGrid');
    expectEscapedMarkup(addonsGrid, 'settings', 'XSS-SETTINGS');
    expectEscapedMarkup(addonsGrid, 'settings-addon', 'XSS-SETTINGS-ADDON');
  });
});
