// responsive-test.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

const VIEWPORTS = [
  { name: 'desktop-1440',  width: 1440, height: 900  },
  { name: 'tablet-portrait', width: 1024, height: 1366 },
  { name: 'tablet-landscape', width: 820,  height: 1180 },
  { name: 'iphone-14',     width: 390,  height: 844  },
  { name: 'android-small', width: 360,  height: 800  },
];

const TABS = [
  { id: 'tab-dashboard', label: 'Dashboard' },
  { id: 'tab-students', label: 'Alunos' },
  { id: 'tab-addons', label: 'Addons' },
  { id: 'tab-pending', label: 'Pendências' },
  { id: 'tab-nps', label: 'NPS' },
  { id: 'tab-scale', label: 'Escala' },
  { id: 'tab-events', label: 'Eventos' },
  { id: 'tab-settings', label: 'Configurações' },
];

const ISSUES = [];

function issue(viewport, section, detail) {
  ISSUES.push({ viewport, section, detail });
}

async function testViewport(browser, vp) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  // 1. Check page-level horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  if (scrollWidth > clientWidth + 2) {
    issue(vp.name, 'page', `Horizontal overflow: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);
    console.log(`  ❌ Horizontal overflow: ${scrollWidth} > ${clientWidth}`);
  } else {
    console.log(`  ✅ No horizontal overflow (${scrollWidth} vs ${clientWidth})`);
  }

  // 2. Check topbar visibility
  const topbarVisible = await page.locator('.topbar').isVisible().catch(() => false);
  if (topbarVisible) {
    console.log(`  ✅ Topbar visible`);
  } else {
    issue(vp.name, 'topbar', 'Topbar not visible');
    console.log(`  ❌ Topbar not visible`);
  }

  // 3. Check tabs are accessible (not overflowed)
  const tabsContainer = page.locator('.tabs');
  const tabsVisible = await tabsContainer.isVisible().catch(() => false);
  if (tabsVisible) {
    const tabCount = await page.locator('.tab-btn').count();
    console.log(`  ✅ Tabs visible: ${tabCount} buttons`);
    if (tabCount < 7) {
      issue(vp.name, 'tabs', `Only ${tabCount} tab buttons found (expected 7+)`);
    }
  } else {
    issue(vp.name, 'tabs', 'Tabs container not visible');
    console.log(`  ❌ Tabs container not visible`);
  }

  // 4. Navigate each tab and check content
  for (const tab of TABS) {
    const tabBtn = page.locator(`#${tab.id}`);
    const isVisible = await tabBtn.isVisible().catch(() => false);
    if (!isVisible) {
      issue(vp.name, `tab:${tab.label}`, `Tab button #${tab.id} not visible`);
      console.log(`  ⚠️  Tab "${tab.label}" button not visible`);
      continue;
    }

    await tabBtn.click();
    await page.waitForTimeout(300);

    // Check view is active
    const viewId = tab.id.replace('tab-', '');
    const viewActive = await page.locator(`#${viewId}`).getAttribute('hidden').catch(() => null);
    if (viewActive !== null) {
      issue(vp.name, `view:${tab.label}`, `View #${viewId} still has hidden attribute after click`);
      console.log(`  ⚠️  View "${tab.label}" may not be active`);
    }

    // Check for content rendering
    const view = page.locator(`#${viewId}`);
    const hasContent = await view.isVisible().catch(() => false);
    if (hasContent) {
      console.log(`  ✅ ${tab.label}: content visible`);
    } else {
      issue(vp.name, `view:${tab.label}`, 'View content not visible after activation');
      console.log(`  ❌ ${tab.label}: content NOT visible`);
    }

    // Screenshot for visual inspection
    const safeName = `${vp.name}_${viewId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    await page.screenshot({ path: `/tmp/screenshots/${safeName}.png`, fullPage: false });
  }

  // 5. Specific checks per viewport
  if (vp.width <= 760) {
    // Mobile: check that inputs have font-size 16px (no zoom on focus)
    const inputFontSize = await page.evaluate(() => {
      const inp = document.querySelector('input, select');
      return inp ? getComputedStyle(inp).fontSize : 'N/A';
    });
    console.log(`  ℹ️  Input font-size: ${inputFontSize}`);
  }

  // Check pending table if on pending tab
  await page.locator('#tab-addons').click();
  await page.waitForTimeout(300);

  const addonsGrid = page.locator('#addonsGrid');
  if (await addonsGrid.isVisible().catch(() => false)) {
    const addonMetrics = await page.evaluate(() => {
      const grid = document.querySelector('#addonsGrid');
      const firstBlock = document.querySelector('#addons .person-block');
      return {
        people: document.querySelectorAll('#addons .person-block').length,
        gridOverflow: grid ? grid.scrollWidth - grid.clientWidth : 0,
        blockMaxHeight: firstBlock ? getComputedStyle(firstBlock).maxHeight : 'N/A',
        blockOverflowY: firstBlock ? getComputedStyle(firstBlock).overflowY : 'N/A'
      };
    });
    console.log(`  ℹ️  Addons cards: ${addonMetrics.people}; gridOverflow=${addonMetrics.gridOverflow}px; blockMaxH=${addonMetrics.blockMaxHeight}; overflowY=${addonMetrics.blockOverflowY}`);
  }

  await page.locator('#tab-scale').click();
  await page.waitForTimeout(300);

  const scaleBoard = page.locator('#scaleBoard');
  if (await scaleBoard.isVisible().catch(() => false)) {
    const scaleMetrics = await page.evaluate(() => {
      const board = document.querySelector('#scaleBoard');
      const firstRow = document.querySelector('#scale .scale-board-row');
      const matrix = document.querySelector('#scale .schedule-matrix');
      return {
        rows: document.querySelectorAll('#scale .scale-board-row').length,
        boardDisplay: board ? getComputedStyle(board).display : 'N/A',
        boardOverflow: board ? board.scrollWidth - board.clientWidth : 0,
        firstRowHeight: firstRow ? Math.round(firstRow.getBoundingClientRect().height) : 0,
        firstRowMaxHeight: firstRow ? getComputedStyle(firstRow).maxHeight : 'N/A',
        firstRowOverflowY: firstRow ? getComputedStyle(firstRow).overflowY : 'N/A',
        matrixMaxHeight: matrix ? getComputedStyle(matrix).maxHeight : 'N/A',
        matrixOverflow: matrix ? matrix.scrollHeight - matrix.clientHeight : 0,
      };
    });
    console.log(`  ℹ️  Escala board: rows=${scaleMetrics.rows}; display=${scaleMetrics.boardDisplay}; boardOverflow=${scaleMetrics.boardOverflow}px; firstRowH=${scaleMetrics.firstRowHeight}px; rowMaxH=${scaleMetrics.firstRowMaxHeight}; rowOverflowY=${scaleMetrics.firstRowOverflowY}; matrixMaxH=${scaleMetrics.matrixMaxHeight}; matrixOverflow=${scaleMetrics.matrixOverflow}px`);
  }

  await page.locator('#tab-pending').click();
  await page.waitForTimeout(300);
  
  const pendingTable = page.locator('.pending-table');
  if (await pendingTable.isVisible().catch(() => false)) {
    const tableMinWidth = await page.evaluate(() => {
      const t = document.querySelector('.pending-table');
      return t ? getComputedStyle(t).minWidth : 'N/A';
    });
    console.log(`  ℹ️  Pending table min-width: ${tableMinWidth}`);
  }

  // Check kanban
  const kanban = page.locator('#pendingKanban');
  if (await kanban.isVisible().catch(() => false)) {
    const kanbanCols = await page.locator('.kanban-col').count();
    console.log(`  ℹ️  Kanban columns: ${kanbanCols}`);
  }

  await ctx.close();
}

async function main() {
  // Create screenshots dir
  const { mkdirSync } = await import('fs');
  try { mkdirSync('/tmp/screenshots', { recursive: true }); } catch {}

  const browser = await chromium.launch({ headless: true });
  
  for (const vp of VIEWPORTS) {
    await testViewport(browser, vp);
  }

  await browser.close();

  // Report
  console.log('\n\n========== SUMMARY ==========');
  if (ISSUES.length === 0) {
    console.log('✅ No issues detected across all viewports.');
  } else {
    console.log(`⚠️  ${ISSUES.length} issue(s) found:`);
    for (const iss of ISSUES) {
      console.log(`  [${iss.viewport}] ${iss.section}: ${iss.detail}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
