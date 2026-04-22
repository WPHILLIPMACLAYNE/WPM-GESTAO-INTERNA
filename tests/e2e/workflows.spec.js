import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_FILE = path.resolve(__dirname, '../../index.html');
const FILE_URL = `file://${APP_FILE}`;

async function waitForApp(page) {
  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__APP_INTERNALS__);
  await page.waitForFunction(() => (
    !!document.querySelector('.tab-btn.active')
    && !!document.getElementById('periodMonthSelect')?.value
    && !!document.getElementById('periodYearInput')?.value
  ));
}

async function waitForPersistedStudents(page, periodKey, expectedCount) {
  await page.waitForFunction(({ targetPeriod, count }) => {
    const storageKey = window.__APP_INTERNALS__?.config?.STORAGE_KEY;
    const store = storageKey ? window.__APP_INTERNALS__.persistence.readStoredJson(storageKey) : null;
    const students = store?.periods?.[targetPeriod]?.students;
    return Array.isArray(students) && students.length === count;
  }, { targetPeriod: periodKey, count: expectedCount });
}

async function seedEmptyStore(page, periodKey = '2026-04') {
  await waitForApp(page);
  await page.evaluate(async (targetPeriod) => {
    localStorage.clear();
    if (typeof storageCache !== 'undefined' && typeof storageCache.clear === 'function') {
      storageCache.clear();
    }
    const emptyPeriod = buildCleanPeriodFromTemplate(null, targetPeriod);
    const store = {
      version: window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: targetPeriod,
      periods: { [targetPeriod]: emptyPeriod },
      archives: {}
    };
    await syncAppState(store);
    saveUIState({
      activeTab: 'dashboard',
      studentSearch: '',
      studentFilterAtendente: '',
      studentFilterFeedback: '',
      pendingSearch: '',
      eventSearch: '',
      eventTypeFilter: '',
      eventStatusFilter: '',
      scaleSearch: ''
    });
    await saveData({ silent: true, broadcast: false, eventType: 'playwright-empty-seed' });
    await window.__APP_INTERNALS__.actions.switchPeriod(targetPeriod, { silent: true });
    renderAll();
    syncPeriodControls();
  }, periodKey);
  await waitForPersistedStudents(page, periodKey, 0);
}

async function seedStoreWithPeriods(page, periodKeys) {
  await waitForApp(page);
  await page.evaluate(async (keys) => {
    localStorage.clear();
    if (typeof storageCache !== 'undefined' && typeof storageCache.clear === 'function') {
      storageCache.clear();
    }
    const periods = Object.fromEntries(
      keys.map(key => [key, generatePeriodSeed(key)])
    );
    const store = {
      version: window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: keys[0],
      periods,
      archives: {}
    };
    await syncAppState(store);
    saveUIState({
      activeTab: 'dashboard',
      studentSearch: '',
      studentFilterAtendente: '',
      studentFilterFeedback: '',
      pendingSearch: '',
      eventSearch: '',
      eventTypeFilter: '',
      eventStatusFilter: '',
      scaleSearch: ''
    });
    await saveData({ silent: true, broadcast: false, eventType: 'playwright-seed' });
    await window.__APP_INTERNALS__.actions.switchPeriod(keys[0], { silent: true });
    renderAll();
    syncPeriodControls();
  }, periodKeys);
  await waitForPersistedStudents(page, periodKeys[0], 30);
}

async function createStudent(page, data) {
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#student_nome').fill(data.nome);
  await page.locator('#student_matricula').fill(data.matricula);
  await page.locator('#student_ultimaVisita').fill(data.ultimaVisita);
  await page.locator('#student_horaVisita').fill(data.horaVisita);
  await page.locator('#student_inicio').fill(data.inicio);
  await page.locator('#student_avisoNps').selectOption(data.avisoNps);
  await page.locator('#student_atendimento').selectOption(data.atendimento);
  await page.locator('#student_feedback').selectOption(data.feedback);
  if (data.addon) {
    await page.locator('#student_addon').selectOption(data.addon);
  }
  await page.locator('#student_observacoes').fill(data.observacoes);
  await page.getByRole('button', { name: 'Salvar atendimento' }).click();
  await expect(page.locator('#studentModal')).not.toHaveClass(/show/);
}

async function createPending(page, data) {
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#pending_nome').fill(data.nome);
  await page.locator('#pending_matricula').fill(data.matricula);
  await page.locator('#pending_desc').fill(data.pendencia);
  await page.locator('#pending_data').fill(data.data);
  await page.locator('#pending_hostess').selectOption(data.hostess);
  await page.locator('#pending_resposta').fill(data.resposta);
  await page.locator('#pending_status').selectOption(data.status);
  await page.getByRole('button', { name: 'Salvar pendência' }).click();
  await expect(page.locator('#pendingModal')).not.toHaveClass(/show/);
}

async function createEvent(page, data) {
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#event_date').fill(data.date);
  await page.locator('#event_time').fill(data.time);
  await page.locator('#event_type').selectOption(data.type);
  await page.locator('#event_status').selectOption(data.status);
  await page.locator('#event_title').fill(data.title);
  await page.locator('#event_place').fill(data.place);
  await page.locator('#event_owner').fill(data.owner);
  await page.locator('#event_description').fill(data.description);
  await page.getByRole('button', { name: 'Salvar evento / ação' }).click();
  await expect(page.locator('#eventModal')).not.toHaveClass(/show/);
}

async function getPersistedEventCount(page, periodKey = '2026-04') {
  return page.evaluate((targetPeriod) => {
    const storageKey = window.__APP_INTERNALS__.config.STORAGE_KEY;
    const store = window.__APP_INTERNALS__.persistence.readStoredJson(storageKey);
    return store?.periods?.[targetPeriod]?.events?.length || 0;
  }, periodKey);
}

test.describe('Fluxos E2E reais', () => {
  test('todas as 8 abas renderizam sem erro no console', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', message => {
      if (message.type() === 'error') {
        const text = message.text();
        if (text.includes("The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.")) {
          return;
        }
        consoleErrors.push(text);
      }
    });
    page.on('pageerror', error => pageErrors.push(String(error)));

    await seedStoreWithPeriods(page, ['2026-04']);

    for (const tabId of [
      'tab-dashboard',
      'tab-students',
      'tab-addons',
      'tab-pending',
      'tab-nps',
      'tab-scale',
      'tab-events',
      'tab-settings'
    ]) {
      await page.locator(`#${tabId}`).click();
      await page.waitForTimeout(150);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('CRUD de alunos cobre validação, filtros, edição inline e persistência após reload', async ({ page }) => {
    await seedEmptyStore(page, '2026-04');
    await page.locator('#tab-students').click();

    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.getByRole('button', { name: 'Salvar atendimento' }).click();
    await expect(page.locator('#appValidationFeedback')).toContainText('Preencha ao menos o nome do aluno.');
    await page.locator('[data-action="close-modal"][data-modal-id="studentModal"]').click();

    await createStudent(page, {
      nome: 'Alice Audit',
      matricula: '1001',
      ultimaVisita: '2026-04-05',
      horaVisita: '09:30',
      inicio: '2026-04-05',
      avisoNps: 'Sim',
      atendimento: 'Wallace',
      feedback: 'Respondeu',
      addon: 'Energy',
      observacoes: 'Lead premium'
    });

    await createStudent(page, {
      nome: 'Bruno Filtro',
      matricula: '1002',
      ultimaVisita: '2026-04-06',
      horaVisita: '10:45',
      inicio: '2026-04-06',
      avisoNps: 'Não',
      atendimento: 'Emilia',
      feedback: 'Pendente',
      addon: '',
      observacoes: 'Aguardando retorno'
    });

    await expect(page.locator('#studentTableBody tr')).toHaveCount(2);
    await expect(page.locator('#studentsSummaryBar')).toContainText('Total de alunos');

    await page.locator('#studentSearch').fill('Alice');
    await expect(page.locator('#studentTableBody tr')).toHaveCount(1);
    await expect(page.locator('#studentTableBody')).toContainText('Alice Audit');

    await page.locator('#studentSearch').fill('');
    await page.locator('#studentFilterAtendente').selectOption('Wallace');
    await expect(page.locator('#studentTableBody')).toContainText('Alice Audit');
    await expect(page.locator('#studentTableBody tr')).toHaveCount(1);

    await page.locator('#studentFilterAtendente').selectOption('');
    await page.locator('#studentFilterFeedback').selectOption('Respondeu');
    await expect(page.locator('#studentTableBody')).toContainText('Alice Audit');
    await expect(page.locator('#studentTableBody tr')).toHaveCount(1);
    await page.locator('#studentFilterFeedback').selectOption('');

    const aliceRow = page.locator('#studentTableBody tr').filter({ hasText: 'Alice Audit' });
    await aliceRow.getByRole('button', { name: /Editar atendimento/ }).click();
    await page.locator('#student_observacoes').fill('Lead premium atualizado');
    await page.getByRole('button', { name: 'Salvar atendimento' }).click();

    await aliceRow.locator('input[data-field="ultimaVisita"]').fill('2026-04-08');
    await expect.poll(async () => (
      page.evaluate(() => {
        const store = window.__APP_INTERNALS__.persistence.readStoredJson(window.__APP_INTERNALS__.config.STORAGE_KEY);
        return store.periods['2026-04'].students.find(item => item.nome === 'Alice Audit')?.ultimaVisita || '';
      })
    )).toBe('2026-04-08');

    const refreshedAliceRow = page.locator('#studentTableBody tr').filter({ hasText: 'Alice Audit' });
    const horaInput = refreshedAliceRow.locator('input[data-field="horaVisita"]');
    await horaInput.click();
    await horaInput.fill('10:15');
    await horaInput.blur();
    await expect.poll(async () => (
      page.evaluate(() => {
        const store = window.__APP_INTERNALS__.persistence.readStoredJson(window.__APP_INTERNALS__.config.STORAGE_KEY);
        const alice = store.periods['2026-04'].students.find(item => item.nome === 'Alice Audit');
        return {
          ultimaVisita: alice?.ultimaVisita || '',
          horaVisita: alice?.horaVisita || ''
        };
      })
    )).toEqual({
      ultimaVisita: '2026-04-08',
      horaVisita: '10:15'
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__APP_INTERNALS__);
    await page.locator('#tab-students').click();

    const reloadedAliceRow = page.locator('#studentTableBody tr').filter({ hasText: 'Alice Audit' });
    await expect(reloadedAliceRow.locator('input[data-field="ultimaVisita"]')).toHaveValue('2026-04-08');
    await expect(reloadedAliceRow.locator('input[data-field="horaVisita"]')).toHaveValue('10:15');
    await expect(reloadedAliceRow).toContainText('Lead premium atualizado');

    await reloadedAliceRow.getByRole('button', { name: /Excluir atendimento/ }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('#studentTableBody tr')).toHaveCount(1);
  });

  test('CRUD de pendências cobre busca, kanban, persistência e export CSV válido', async ({ page }) => {
    await seedEmptyStore(page, '2026-04');
    await page.locator('#tab-pending').click();

    await createPending(page, {
      nome: 'Carlos Ticket',
      matricula: '2001',
      pendencia: 'Regularizar biometria com urgência',
      data: '2026-04-07',
      hostess: 'Wallace',
      resposta: '',
      status: 'aberto'
    });

    await expect(page.locator('#pendingTableBody tr')).toHaveCount(1);
    await expect(page.locator('[data-drop-status="aberto"] [data-pending-id]')).toHaveCount(1);

    await page.locator('#pendingSearch').fill('biometria');
    await expect(page.locator('#pendingTableBody')).toContainText('Carlos Ticket');
    await page.locator('#pendingSearch').fill('');

    const card = page.locator('[data-drop-status="aberto"] [data-pending-id]').first();
    await card.dragTo(page.locator('[data-drop-status="respondido"] .kanban-list'));
    await expect(page.locator('[data-drop-status="respondido"] [data-pending-id]')).toHaveCount(1);

    await page.locator('#pendingTableBody tr').filter({ hasText: 'Carlos Ticket' }).getByRole('button', { name: 'Editar' }).click();
    await page.locator('#pending_resposta').fill('Cliente respondeu e seguirá com a regularização.');
    await page.locator('#pending_status').selectOption('respondido');
    await page.getByRole('button', { name: 'Salvar pendência' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pendencias-2026-04.csv');
    const csvPath = await download.path();
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    expect(csvContent).toContain('Carlos Ticket');
    expect(csvContent).toContain('Regularizar biometria');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__APP_INTERNALS__);
    await page.locator('#tab-pending').click();
    await expect(page.locator('#pendingTableBody')).toContainText('Carlos Ticket');
    await expect(page.locator('[data-drop-status="respondido"] [data-pending-id]')).toHaveCount(1);
  });

  test('CRUD de eventos cobre criar, editar, duplicar, excluir e persistir após reload', async ({ page }) => {
    await seedEmptyStore(page, '2026-04');
    await page.locator('#tab-events').click();

    await createEvent(page, {
      date: '2026-04-12',
      time: '14:30',
      type: 'Evento',
      status: 'Confirmado',
      title: 'Treinamento comercial',
      place: 'Sala de reunião',
      owner: 'Coordenação',
      description: 'Preparar equipe para a campanha do mês.'
    });

    await expect(page.locator('#eventsList')).toContainText('Treinamento comercial');

    await page.locator('#eventsList .event-card').filter({ hasText: 'Treinamento comercial' }).getByRole('button', { name: 'Editar' }).click();
    await page.locator('#event_title').fill('Treinamento comercial atualizado');
    await page.locator('#event_status').selectOption('Concluído');
    await page.getByRole('button', { name: 'Salvar evento / ação' }).click();

    await page.locator('#eventsList .event-card').filter({ hasText: 'Treinamento comercial atualizado' }).getByRole('button', { name: 'Duplicar' }).click();
    await expect(page.locator('#eventsList .event-card')).toHaveCount(2);
    await expect(page.locator('#eventsList')).toContainText('(cópia)');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__APP_INTERNALS__);
    await page.locator('#tab-events').click();
    await expect(page.locator('#eventsTableBody')).toContainText('Treinamento comercial atualizado');
    await expect(page.locator('#eventsTableBody')).toContainText('Concluído');

    await page.locator('#eventsList .event-card').filter({ hasText: '(cópia)' }).getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('#eventsList .event-card')).toHaveCount(1);
  });

  test('eventos fazem rollback em falha de persistência e confirmam duplicata antes de salvar', async ({ page }) => {
    await seedEmptyStore(page, '2026-04');
    await page.locator('#tab-events').click();

    await page.evaluate(() => {
      window.__originalSaveStoreForTest = window.saveStore;
      window.saveStore = async () => false;
    });

    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.locator('#event_date').fill('2026-04-18');
    await page.locator('#event_time').fill('10:00');
    await page.locator('#event_type').selectOption('Evento');
    await page.locator('#event_status').selectOption('Confirmado');
    await page.locator('#event_title').fill('Campanha matrícula');
    await page.locator('#event_place').fill('Recepção');
    await page.locator('#event_owner').fill('Coordenação');
    await page.locator('#event_description').fill('Teste de rollback de persistência.');
    await page.getByRole('button', { name: 'Salvar evento / ação' }).click();

    await expect(page.locator('#eventModal')).toHaveClass(/show/);
    await expect(page.locator('#eventsList .event-card')).toHaveCount(0);
    await expect.poll(() => getPersistedEventCount(page)).toBe(0);
    await expect(page.locator('#saveToast')).toContainText('Falha ao salvar evento');

    await page.evaluate(() => {
      window.saveStore = window.__originalSaveStoreForTest;
      delete window.__originalSaveStoreForTest;
    });

    await page.getByRole('button', { name: 'Salvar evento / ação' }).click();
    await expect(page.locator('#eventModal')).not.toHaveClass(/show/);
    await expect(page.locator('#eventsList .event-card')).toHaveCount(1);
    await expect.poll(() => getPersistedEventCount(page)).toBe(1);

    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.locator('#event_date').fill('2026-04-18');
    await page.locator('#event_time').fill('10:00');
    await page.locator('#event_type').selectOption('Evento');
    await page.locator('#event_status').selectOption('Programado');
    await page.locator('#event_title').fill('  campanha matrícula  ');
    await page.locator('#event_place').fill('Entrada da unidade');
    await page.locator('#event_owner').fill('Equipe comercial');
    await page.locator('#event_description').fill('Mesmo título, data e horário exige confirmação.');
    await page.getByRole('button', { name: 'Salvar evento / ação' }).click();

    await expect(page.locator('#confirmModal')).toHaveClass(/show/);
    await expect(page.locator('#eventModal')).toHaveClass(/show/);
    await expect.poll(() => getPersistedEventCount(page)).toBe(1);

    await page.locator('#confirmModal').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#confirmModal')).not.toHaveClass(/show/);
    await expect(page.locator('#eventModal')).toHaveClass(/show/);
    await expect.poll(() => getPersistedEventCount(page)).toBe(1);

    await page.getByRole('button', { name: 'Salvar evento / ação' }).click();
    await expect(page.locator('#confirmModal')).toHaveClass(/show/);
    await page.locator('#confirmModal').getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.locator('#eventModal')).not.toHaveClass(/show/);
    await expect(page.locator('#eventsList .event-card')).toHaveCount(2);
    await expect.poll(() => getPersistedEventCount(page)).toBe(2);
  });

  test('NPS persiste score e observações com debounce após reload', async ({ page }) => {
    await seedStoreWithPeriods(page, ['2026-04']);
    await page.locator('#tab-nps').click();

    await page.locator('#npsScoreInput').fill('72');
    await page.locator('#npsObservations').evaluate((element, value) => {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, 'Observação auditada pelo fluxo E2E');
    await page.waitForTimeout(900);

    await expect.poll(async () => (
      page.evaluate(() => {
        const store = window.__APP_INTERNALS__.persistence.readStoredJson(window.__APP_INTERNALS__.config.STORAGE_KEY);
        const nps = store.periods['2026-04'].nps;
        return {
          score: Number(nps?.score || 0),
          observations: String(nps?.observations || '')
        };
      })
    )).toEqual({
      score: 72,
      observations: 'Observação auditada pelo fluxo E2E'
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__APP_INTERNALS__);
    await page.locator('#tab-nps').click();
    await expect(page.locator('#npsScoreInput')).toHaveValue('72');
    await expect(page.locator('#npsObservations')).toHaveValue('Observação auditada pelo fluxo E2E');
  });

  test('backup exporta, reseta e importa restaurando o período ativo', async ({ page }, testInfo) => {
    await seedStoreWithPeriods(page, ['2026-04']);
    await page.locator('#tab-students').click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('30 registros');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar backup' }).first().click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('backup-restauracao.json');
    await download.saveAs(backupPath);

    await page.getByRole('button', { name: 'Resetar dados do mês selecionado' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('0 registros');

    await page.setInputFiles('#importFile', backupPath);
    await expect(page.locator('#confirmModal')).toHaveClass(/show/);
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await page.locator('#tab-students').click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('30 registros');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__APP_INTERNALS__);
    await page.locator('#tab-students').click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('30 registros');
  });

  test('troca de mês e reset preservam isolamento entre períodos', async ({ page }) => {
    await seedStoreWithPeriods(page, ['2026-07', '2026-08']);

    await expect(page.locator('#periodMonthSelect')).toHaveValue('7');

    await page.locator('#tab-students').click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('30 registros');

    await page.locator('#periodMonthSelect').selectOption('8');
    await expect(page.locator('#periodMonthSelect')).toHaveValue('8');
    await page.locator('#tab-students').click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('30 registros');

    await page.locator('#periodMonthSelect').selectOption('7');
    await page.getByRole('button', { name: 'Resetar dados do mês selecionado' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('0 registros');

    await page.locator('#periodMonthSelect').selectOption('8');
    await page.locator('#tab-students').click();
    await expect(page.locator('#studentsSectionTitle')).toContainText('30 registros');

    const storeSummary = await page.evaluate(() => {
      const store = window.__APP_INTERNALS__.persistence.readStoredJson(window.__APP_INTERNALS__.config.STORAGE_KEY);
      return {
        julyStudents: store.periods['2026-07'].students.length,
        augustStudents: store.periods['2026-08'].students.length
      };
    });

    expect(storeSummary).toEqual({ julyStudents: 0, augustStudents: 30 });
  });
});
