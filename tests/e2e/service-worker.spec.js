import { test, expect } from '@playwright/test';

async function waitForAppBootstrap(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__APP_INTERNALS__));
}

async function waitForServiceWorkerControl(page) {
  await waitForAppBootstrap(page);
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  });
}

test.describe('Service worker', () => {
  test('registra no escopo atual da aplicacao', async ({ page }) => {
    await waitForServiceWorkerControl(page);

    const swInfo = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        activeScriptUrl: registration.active?.scriptURL || null,
        controllerScriptUrl: navigator.serviceWorker.controller?.scriptURL || null
      };
    });

    expect(swInfo.scope).toBe(new URL('./', page.url()).href);
    expect(swInfo.activeScriptUrl).toBe(new URL('sw.js', page.url()).href);
    expect(swInfo.controllerScriptUrl).toBe(swInfo.activeScriptUrl);
  });

  test('mantem o app shell disponivel offline apos o primeiro carregamento', async ({ page }) => {
    await waitForServiceWorkerControl(page);

    await page.context().setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/WPM Gestão Interna/);
    await expect(page.locator('.topbar')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__APP_INTERNALS__));
  });
});
