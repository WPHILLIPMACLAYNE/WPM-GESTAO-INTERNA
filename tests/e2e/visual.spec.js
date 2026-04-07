import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_FILE = path.resolve(__dirname, '../../index.html');
const FILE_URL = `file://${APP_FILE}`;

const VISUAL_VIEWPORTS = [
  { name: 'desktop-hd', size: { width: 1920, height: 1080 } },
  { name: 'desktop-laptop', size: { width: 1366, height: 768 } }
];

const TABS = [
  { id: 'tab-dashboard', name: 'dashboard' },
  { id: 'tab-students', name: 'students' },
  { id: 'tab-addons', name: 'addons' },
  { id: 'tab-pending', name: 'pending' },
  { id: 'tab-nps', name: 'nps' },
  { id: 'tab-scale', name: 'scale' },
  { id: 'tab-events', name: 'events' },
  { id: 'tab-settings', name: 'settings' }
];

async function waitForInitialUi(page) {
  await page.waitForFunction(() => !!window.__APP_INTERNALS__);
  await page.waitForFunction(() => (
    !!document.querySelector('.tab-btn.active')
    && !!document.getElementById('periodMonthSelect')?.value
    && !!document.getElementById('periodYearInput')?.value
    && (document.querySelectorAll('#heroSummary .mini-stat').length || 0) > 0
  ));
}

async function waitForSeededHero(page, periodLabel = 'Abril/2026') {
  await page.waitForFunction(expectedPeriodLabel => {
    const values = [...document.querySelectorAll('#heroSummary .mini-stat .value')].map(node => String(node.textContent || '').trim());
    return values.length >= 5
      && values[0] === expectedPeriodLabel
      && values[1] === '30'
      && values[2] === '40'
      && values[3] === '18'
      && values[4] === '7';
  }, periodLabel);
}

async function seedVisualStore(page, periodKey = '2026-04') {
  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await waitForInitialUi(page);
  await page.evaluate(async targetPeriod => {
    localStorage.clear();
    if (typeof storageCache !== 'undefined' && typeof storageCache.clear === 'function') {
      storageCache.clear();
    }
    await removeStoredValues([
      LOCAL_SNAPSHOT_KEY,
      SYSTEM_REPORT_KEY,
      FLOW_TEST_REPORT_KEY,
      ...LEGACY_LOCAL_SNAPSHOT_KEYS,
      ...LEGACY_SYSTEM_REPORT_KEYS,
      ...LEGACY_FLOW_TEST_REPORT_KEYS
    ]);
    const store = {
      version: window.__APP_INTERNALS__.config.STORE_VERSION,
      activePeriod: targetPeriod,
      periods: { [targetPeriod]: generatePeriodSeed(targetPeriod) },
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
    await saveData({ silent: true, broadcast: false, eventType: 'playwright-visual-seed' });
    await window.__APP_INTERNALS__.actions.switchPeriod(targetPeriod, { silent: true });
    setActiveTab('dashboard', true);
    renderAll();
    syncPeriodControls();
  }, periodKey);
  await waitForSeededHero(page);
}

for (const viewport of VISUAL_VIEWPORTS) {
  test.describe(`Regressão visual ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    for (const tab of TABS) {
      test(`${tab.name} mantém o layout esperado`, async ({ page }) => {
        await seedVisualStore(page);
        await page.evaluate(tabName => {
          setActiveTab(tabName, true);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          window.scrollTo(0, 0);
        }, tab.name);
        await page.waitForTimeout(100);
        await expect(page).toHaveScreenshot(`${viewport.name}-${tab.name}.png`, {
          animations: 'disabled',
          fullPage: true,
          timeout: 15000,
          maxDiffPixels: 10000
        });
      });
    }
  });
}
