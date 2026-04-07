import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_FILE = path.resolve(__dirname, '../../index.html');
const FILE_URL = `file://${APP_FILE}`;

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1920, height: 1080 } },
  { name: 'laptop', size: { width: 1366, height: 768 } },
  { name: 'tablet', size: { width: 768, height: 1024 } },
  { name: 'mobile', size: { width: 375, height: 812 } }
];

const SNAPSHOT_OPTS = {
  animations: 'disabled',
  fullPage: true,
  timeout: 15000,
  maxDiffPixelRatio: 0.003
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForApp(page) {
  await page.waitForFunction(() => !!window.__APP_INTERNALS__);
  await page.waitForFunction(() => (
    !!document.querySelector('.tab-btn.active')
    && !!document.getElementById('periodMonthSelect')?.value
    && !!document.getElementById('periodYearInput')?.value
  ));
}

async function seedFullData(page, periodKey = '2026-04') {
  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.evaluate(async (pk) => {
    localStorage.clear();
    if (typeof storageCache !== 'undefined' && typeof storageCache.clear === 'function') {
      storageCache.clear();
    }
    await removeStoredValues([
      LOCAL_SNAPSHOT_KEY, SYSTEM_REPORT_KEY, FLOW_TEST_REPORT_KEY,
      ...LEGACY_LOCAL_SNAPSHOT_KEYS, ...LEGACY_SYSTEM_REPORT_KEYS,
      ...LEGACY_FLOW_TEST_REPORT_KEYS
    ]);
    const store = {
      version: window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: pk,
      periods: { [pk]: generatePeriodSeed(pk) },
      archives: {}
    };
    await syncAppState(store);
    saveUIState({
      activeTab: 'dashboard', studentSearch: '', studentFilterAtendente: '',
      studentFilterFeedback: '', pendingSearch: '', eventSearch: '',
      eventTypeFilter: '', eventStatusFilter: '', scaleSearch: ''
    });
    await saveData({ silent: true, broadcast: false, eventType: 'playwright-visual-seed' });
    await window.__APP_INTERNALS__.actions.switchPeriod(pk, { silent: true });
    setActiveTab('dashboard', true);
    renderAll();
    syncPeriodControls();
  }, periodKey);
  await page.waitForFunction(() =>
    document.querySelectorAll('#heroSummary .mini-stat .value').length >= 5
  );
}

async function seedEmptyData(page, periodKey = '2026-04') {
  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.evaluate(async (pk) => {
    localStorage.clear();
    if (typeof storageCache !== 'undefined' && typeof storageCache.clear === 'function') {
      storageCache.clear();
    }
    await removeStoredValues([
      LOCAL_SNAPSHOT_KEY, SYSTEM_REPORT_KEY, FLOW_TEST_REPORT_KEY,
      ...LEGACY_LOCAL_SNAPSHOT_KEYS, ...LEGACY_SYSTEM_REPORT_KEYS,
      ...LEGACY_FLOW_TEST_REPORT_KEYS
    ]);
    const template = generatePeriodSeed(pk);
    template.students = [];
    template.pending = [];
    template.recados = [];
    template.nps = { score: 0, monthlyGoal: 0, semesterGoal: 0, observations: '', mentions: [], rankSnapshot: [] };
    template.scale = [];
    template.events = [];
    template.addons = {};
    const store = {
      version: window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: pk,
      periods: { [pk]: template },
      archives: {}
    };
    await syncAppState(store);
    saveUIState({
      activeTab: 'dashboard', studentSearch: '', studentFilterAtendente: '',
      studentFilterFeedback: '', pendingSearch: '', eventSearch: '',
      eventTypeFilter: '', eventStatusFilter: '', scaleSearch: ''
    });
    await saveData({ silent: true, broadcast: false, eventType: 'playwright-visual-seed-empty' });
    await window.__APP_INTERNALS__.actions.switchPeriod(pk, { silent: true });
    setActiveTab('dashboard', true);
    renderAll();
    syncPeriodControls();
  }, periodKey);
  await waitForApp(page);
}

async function goToTab(page, tabName) {
  await page.evaluate((t) => {
    setActiveTab(t, true);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  }, tabName);
  await page.waitForTimeout(150);
}

function snap(page, name) {
  return expect(page).toHaveScreenshot(name, SNAPSHOT_OPTS);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  test.describe(`Visual states — ${vp.name} (${vp.size.width}x${vp.size.height})`, () => {
    test.use({ viewport: vp.size });

    // =====================================================================
    // DASHBOARD
    // =====================================================================

    test('dashboard — com dados', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'dashboard');
      await snap(page, `dashboard-com-dados-${vp.name}-chromium-linux.png`);
    });

    test('dashboard — sem dados', async ({ page }) => {
      await seedEmptyData(page);
      await goToTab(page, 'dashboard');
      await snap(page, `dashboard-sem-dados-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // ALUNOS NOVOS
    // =====================================================================

    test('alunos — tabela cheia', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'students');
      await snap(page, `alunos-tabela-cheia-${vp.name}-chromium-linux.png`);
    });

    test('alunos — filtro por atendente', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'students');
      await page.evaluate(() => {
        const sel = document.getElementById('studentFilterAtendente');
        if (sel && sel.options.length > 1) {
          sel.value = sel.options[1].value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(200);
      await snap(page, `alunos-filtro-atendente-${vp.name}-chromium-linux.png`);
    });

    test('alunos — filtro por feedback', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'students');
      await page.evaluate(() => {
        const sel = document.getElementById('studentFilterFeedback');
        if (sel) {
          sel.value = 'Respondeu';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('#studentTableBody tr');
        return rows.length > 0 && rows.length < 30;
      }, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      await snap(page, `alunos-filtro-feedback-${vp.name}-chromium-linux.png`);
    });

    test('alunos — busca com texto', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'students');
      await page.evaluate(() => {
        const input = document.getElementById('studentSearch');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, 'Ana');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(200);
      await snap(page, `alunos-busca-texto-${vp.name}-chromium-linux.png`);
    });

    test('alunos — modal adicionar aberto', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'students');
      await page.evaluate(() => {
        openModal('studentModal');
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(200);
      await snap(page, `alunos-modal-adicionar-${vp.name}-chromium-linux.png`);
    });

    test('alunos — modal editar aberto', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'students');
      await page.evaluate(() => {
        const rows = document.querySelectorAll('#studentTableBody tr');
        if (rows.length > 0) {
          const editBtn = rows[0].querySelector('[data-action="edit-student"]');
          if (editBtn) editBtn.click();
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(200);
      await snap(page, `alunos-modal-editar-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // PENDÊNCIAS
    // =====================================================================

    test('pendencias — tabela e kanban cheios', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'pending');
      await snap(page, `pendencias-cheio-${vp.name}-chromium-linux.png`);
    });

    test('pendencias — card com classe dragging', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'pending');
      await page.evaluate(() => {
        const card = document.querySelector('#pendingKanban .kanban-card');
        if (card) card.classList.add('dragging');
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(150);
      await snap(page, `pendencias-dragging-${vp.name}-chromium-linux.png`);
    });

    test('pendencias — busca ativa', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'pending');
      await page.evaluate(() => {
        const input = document.getElementById('pendingSearch');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, 'cadastro');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(200);
      await snap(page, `pendencias-busca-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // NPS
    // =====================================================================

    test('nps — com score preenchido', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'nps');
      await snap(page, `nps-com-score-${vp.name}-chromium-linux.png`);
    });

    test('nps — sem score', async ({ page }) => {
      await seedEmptyData(page);
      await goToTab(page, 'nps');
      await snap(page, `nps-sem-score-${vp.name}-chromium-linux.png`);
    });

    test('nps — com observacoes', async ({ page }) => {
      await seedFullData(page);
      await page.evaluate(() => {
        const p = state;
        if (p && p.nps) {
          p.nps.observations = 'Pesquisa realizada com 45 alunos neste mês. Destaque positivo para atendimento na recepção. Ponto de atenção: tempo de espera nos horários de pico.';
        }
        renderAll();
      });
      await goToTab(page, 'nps');
      await snap(page, `nps-com-observacoes-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // ESCALA
    // =====================================================================

    test('escala — mes completo', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'scale');
      await snap(page, `escala-mes-completo-${vp.name}-chromium-linux.png`);
    });

    test('escala — mes parcial', async ({ page }) => {
      await seedFullData(page);
      await page.evaluate(() => {
        if (state && Array.isArray(state.scale)) {
          state.scale = state.scale.slice(0, 5);
        }
        renderAll();
      });
      await goToTab(page, 'scale');
      await snap(page, `escala-mes-parcial-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // VENDAS DE ADDONS
    // =====================================================================

    test('addons — grid preenchido', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'addons');
      await snap(page, `addons-preenchido-${vp.name}-chromium-linux.png`);
    });

    test('addons — grid vazio', async ({ page }) => {
      await seedEmptyData(page);
      await goToTab(page, 'addons');
      await snap(page, `addons-vazio-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // EVENTOS
    // =====================================================================

    test('eventos — com eventos', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'events');
      await snap(page, `eventos-com-dados-${vp.name}-chromium-linux.png`);
    });

    test('eventos — sem eventos', async ({ page }) => {
      await seedEmptyData(page);
      await goToTab(page, 'events');
      await snap(page, `eventos-sem-dados-${vp.name}-chromium-linux.png`);
    });

    test('eventos — modal aberto', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'events');
      await page.evaluate(() => {
        openModal('eventModal');
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(200);
      await snap(page, `eventos-modal-aberto-${vp.name}-chromium-linux.png`);
    });

    // =====================================================================
    // CONFIGURAÇÕES
    // =====================================================================

    test('configuracoes — tela padrao', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'settings');
      await snap(page, `configuracoes-padrao-${vp.name}-chromium-linux.png`);
    });

    test('configuracoes — apos diagnostico', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'settings');
      await page.evaluate(async () => {
        if (window.__APP_INTERNALS__?.diagnostics?.runSystemDiagnostics) {
          await window.__APP_INTERNALS__.diagnostics.runSystemDiagnostics(false);
        }
        renderAll();
      });
      await page.waitForTimeout(300);
      await snap(page, `configuracoes-apos-diagnostico-${vp.name}-chromium-linux.png`);
    });

    test('configuracoes — apos autotestes', async ({ page }) => {
      await seedFullData(page);
      await goToTab(page, 'settings');
      await page.evaluate(async () => {
        if (window.__APP_INTERNALS__?.diagnostics?.runFlowSmokeTests) {
          await window.__APP_INTERNALS__.diagnostics.runFlowSmokeTests(false);
        }
        renderAll();
      });
      await page.waitForTimeout(300);
      await snap(page, `configuracoes-apos-autotestes-${vp.name}-chromium-linux.png`);
    });
  });
}
