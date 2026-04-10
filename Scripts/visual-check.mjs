// visual-check.mjs — Take full-page screenshots per viewport/tab
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

const VIEWPORTS = [
  { name: 'desktop-1440',   width: 1440, height: 900  },
  { name: 'tablet-portrait', width: 1024, height: 1366 },
  { name: 'tablet-820',      width: 820,  height: 1180 },
  { name: 'iphone-390',     width: 390,  height: 844  },
  { name: 'android-360',    width: 360,  height: 800  },
];

const TAB_IDS = ['dashboard', 'students', 'pending', 'nps', 'scale', 'events', 'settings'];

const OUT = '/tmp/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  console.log(`\n📱 ${vp.name} (${vp.width}x${vp.height})`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(600);

  // Check horizontal overflow
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  console.log(`  Horizontal overflow: ${overflow > 0 ? '❌ ' + overflow + 'px' : '✅ 0px'}`);

  for (const tab of TAB_IDS) {
    const btn = page.locator(`#tab-${tab}`);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(250);
    }

    // Check specific elements
    let issues = [];
    
    if (tab === 'pending') {
      // Check kanban scroll containment
      const kanbanH = await page.evaluate(() => {
        const k = document.querySelector('#pendingKanban');
        const s = document.querySelector('#pending .kanban-scroll');
        if (!k || !s) return null;
        return {
          kanbanHeight: k.scrollHeight,
          scrollHeight: s.scrollHeight,
          scrollClientHeight: s.clientHeight,
          scrollMaxHeight: getComputedStyle(s).maxHeight,
        };
      });
      if (kanbanH) {
        console.log(`    Kanban scroll: maxH=${kanbanH.scrollMaxHeight}, clientH=${kanbanH.scrollClientHeight}`);
      }

      // Check table wrapper
      const tableWrap = await page.evaluate(() => {
        const w = document.querySelector('#pending .table-wrap');
        if (!w) return null;
        return {
          maxHeight: getComputedStyle(w).maxHeight,
          overflowY: getComputedStyle(w).overflowY,
          overflowX: getComputedStyle(w).overflowX,
        };
      });
      if (tableWrap) {
        console.log(`    Table wrap: maxH=${tableWrap.maxHeight}, overflowY=${tableWrap.overflowY}, overflowX=${tableWrap.overflowX}`);
      }
    }

    if (tab === 'students') {
      const tableMinW = await page.evaluate(() => {
        const t = document.querySelector('#students .student-table');
        return t ? getComputedStyle(t).minWidth : 'N/A';
      });
      console.log(`    Student table min-width: ${tableMinW}`);
    }

    const path = `${OUT}/${vp.name}_${tab}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`  ✅ ${tab} → ${path}`);
  }

  await ctx.close();
}

await browser.close();
console.log('\n✅ All screenshots saved to', OUT);
