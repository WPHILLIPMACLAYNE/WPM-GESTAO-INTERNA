import { test, expect } from '@playwright/test';

const TARGET_URL_ENV = 'DEPLOY_SMOKE_URL';

function getTargetUrl(baseURL) {
  return process.env[TARGET_URL_ENV] || baseURL || 'http://127.0.0.1:4173';
}

async function waitForApp(page, baseURL) {
  await page.goto(getTargetUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__APP_INTERNALS__));
}

test.describe('Smoke pós-deploy', () => {
  test('valida bootstrap, assets críticos e fluxos mínimos', async ({ page, baseURL }) => {
    await waitForApp(page, baseURL);

    await expect(page.locator('body')).toContainText('WPM Gestão Interna');
    await expect.poll(
      () => page.evaluate(() => Boolean(window.Chart)),
      { timeout: 15000, message: 'Chart.js deve estar carregado no runtime' }
    ).toBe(true);

    const serviceWorkerRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(() => resolve(null), 10000))
      ]);
      return Boolean(ready?.active || navigator.serviceWorker.controller);
    });
    expect(serviceWorkerRegistered).toBe(true);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /exportar backup/i }).first().click()
    ]);
    expect(download.suggestedFilename()).toMatch(/backup.*\.json$/);

    await page.setInputFiles('#importFile', {
      name: 'payload-invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ kind: 'invalid-smoke-payload' }))
    });
    await expect(page.locator('#saveToast')).toContainText('Arquivo inválido', { timeout: 5000 });

    const switchedPeriod = await page.evaluate(async () => {
      const internals = window.__APP_INTERNALS__;
      const current = currentPeriodKey;
      const [year, month] = String(current || '2026-04').split('-').map(Number);
      const date = new Date(year, month, 1, 12, 0, 0);
      const nextKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      await internals.actions.switchPeriod(nextKey, { silent: true });
      return {
        nextKey,
        activePeriod: currentPeriodKey
      };
    });
    expect(switchedPeriod.activePeriod).toBe(switchedPeriod.nextKey);
  });
});
