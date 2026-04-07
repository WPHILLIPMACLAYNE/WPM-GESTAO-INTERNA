/**
 * Playwright E2E Tests — Responsividade e Regressão Visual
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_FILE = path.resolve(__dirname, '../../index.html');
const FILE_URL = `file://${APP_FILE}`;

const VIEWPORTS = {
  'desktop': { width: 1440, height: 900 },
  'tablet': { width: 820, height: 1180 },
  'mobile': { width: 390, height: 844 }
};

const TABS = [
  { id: 'tab-dashboard', name: 'dashboard', label: 'Dashboard' },
  { id: 'tab-students', name: 'students', label: 'Alunos' },
  { id: 'tab-addons', name: 'addons', label: 'Addons' },
  { id: 'tab-pending', name: 'pending', label: 'Pendências' },
  { id: 'tab-nps', name: 'nps', label: 'NPS' },
  { id: 'tab-scale', name: 'scale', label: 'Escala' },
  { id: 'tab-events', name: 'events', label: 'Eventos' },
  { id: 'tab-settings', name: 'settings', label: 'Configurações' }
];

test.describe('App: Estrutura', () => {
  test('deve carregar com título correto', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect(page).toHaveTitle(/WPM Gestão Interna/);
  });

  test('deve ter topbar visível', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.topbar')).toBeVisible();
  });

  test('deve ter todas as 8 abas visíveis', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    for (const tab of TABS) {
      await expect(page.locator(`#${tab.id}`)).toBeVisible();
    }
  });

  test('deve ter skip-link acessível', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.skip-link')).toBeVisible();
  });

  test('deve ter live regions para acessibilidade', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#appLiveRegion')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#appLiveRegionUrgente')).toHaveAttribute('aria-live', 'assertive');
  });
});

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Responsividade: ${name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('não deve ter overflow horizontal', async ({ page }) => {
      await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    if (viewport.width <= 760) {
      test('inputs devem ter font-size >= 16px (sem zoom no mobile)', async ({ page }) => {
        await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);
        await page.locator('#tab-students').click();
        await page.waitForTimeout(200);
        const fontSize = await page.locator('input').first().evaluate(el => {
          return parseFloat(getComputedStyle(el).fontSize);
        });
        expect(fontSize).toBeGreaterThanOrEqual(16);
      });
    }
  });
}

test.describe('Funcionalidade', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('deve ter botão de novo atendimento na topbar', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    const btn = page.getByRole('button', { name: 'Novo atendimento' });
    await expect(btn).toBeVisible();
  });

  test('deve ter botão de exportar backup', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    const btn = page.getByRole('button', { name: 'Exportar backup' });
    await expect(btn).toBeVisible();
  });

  test('deve ter seletores de período', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#periodMonthSelect')).toBeVisible();
    await expect(page.locator('#periodYearInput')).toBeVisible();
  });

  test('deve ter abas com role tablist e tab', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(8);
  });

  test('dashboard deve ser a aba ativa por padrão', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    const dashboardTab = page.locator('#tab-dashboard');
    await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
    const dashboardView = page.locator('#dashboard');
    await expect(dashboardView).toBeVisible();
    await expect(dashboardView).not.toHaveAttribute('hidden');
  });

  test('deve ter modais no DOM', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#studentModal')).toBeAttached();
    await expect(page.locator('#pendingModal')).toBeAttached();
    await expect(page.locator('#confirmModal')).toBeAttached();
  });

  test('deve ter toast de salvamento', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#saveToast')).toBeAttached();
  });
});

test.describe('Segurança: CSP', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('deve ter meta tag CSP', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    const csp = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(csp).toHaveCount(1);
    const content = await csp.getAttribute('content');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("frame-ancestors 'none'");
  });

  test('deve carregar main.js via tag script src', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    const scriptTag = page.locator('script[src="src/main.js"]');
    await expect(scriptTag).toHaveCount(1);
  });

  test('deve carregar styles.css via link tag', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    const linkTag = page.locator('link[rel="stylesheet"][href="styles.css"]');
    await expect(linkTag).toHaveCount(1);
  });
});
