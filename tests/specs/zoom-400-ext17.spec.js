// EXT17: 400% zoom. A 1280 px wide window at 400% zoom lays out like a 320 px
// wide window (WCAG 1.4.10 "Reflow"). At that width each main page must not
// need sideways scrolling for the page itself (wide data tables may scroll
// inside their own box), and the menu, Refresh and Sign out must stay reachable.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ viewport: { width: 320, height: 640 }, timezoneId: 'America/Chicago', locale: 'en-US' });
const PAGES = ['attentionPanel', 'ordersPanel', 'inventoryPanel', 'tasksPanel', 'purchaseOrdersPanel', 'returnsPanel', 'systemStatusPanel'];

test('400% zoom (320 px): no page-level sideways scrolling; header controls reachable', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'desktop browser at 400% zoom');
  test.setTimeout(240000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  const problems = [];
  for (const id of PAGES) {
    if (!(await page.locator(`section#${id}`).count())) continue;
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (r.scroll > r.client + 1) {
      const wide = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.right > document.documentElement.clientWidth + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed') {
            let p = el.parentElement, clipped = false;
            while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; }
            if (!clipped) out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) + ' right=' + Math.round(b.right));
          }
          if (out.length >= 5) break;
        }
        return out;
      });
      problems.push(`${id}: page is ${r.scroll}px wide in a ${r.client}px window (${wide.join(', ')})`);
    }
  }
  for (const sel of ['#menuToggleBtn', '#refreshBtn', '#signout']) {
    const box = await page.locator(sel).boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 321) problems.push(`${sel} not fully on screen at 320 px`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('400% zoom check notices a page that does not reflow (self-test)', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  await login(page);
  await page.evaluate(() => { const d = document.createElement('div'); d.style.width = '700px'; d.style.height = '1px'; document.querySelector('main, #mainContent, body').appendChild(d); });
  const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(r.scroll).toBeGreaterThan(r.client + 1);
});
