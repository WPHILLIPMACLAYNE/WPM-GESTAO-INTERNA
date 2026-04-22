export const FIXED_VISUAL_NOW_ISO = '2026-04-16T12:00:00.000Z';

/**
 * Freeze the browser clock before the app bootstraps so visual snapshots do
 * not drift as "upcoming" selectors advance with the real calendar.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [fixedNowIso]
 * @returns {Promise<void>}
 */
export async function installFixedBrowserClock(page, fixedNowIso = FIXED_VISUAL_NOW_ISO) {
  await page.addInitScript(({ fixedNow }) => {
    const RealDate = Date;
    const fixedTimestamp = RealDate.parse(fixedNow);

    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedTimestamp);
          return;
        }
        super(...args);
      }

      static now() {
        return fixedTimestamp;
      }

      static parse(value) {
        return RealDate.parse(value);
      }

      static UTC(...args) {
        return RealDate.UTC(...args);
      }
    }

    Object.setPrototypeOf(MockDate, RealDate);
    globalThis.Date = MockDate;
    window.Date = MockDate;
  }, { fixedNow: fixedNowIso });
}
