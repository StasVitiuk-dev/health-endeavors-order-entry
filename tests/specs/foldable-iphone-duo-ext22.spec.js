// iPhone Duo (Apple's folding iPhone, on sale since Oct 23, 2026) — owner
// request of Nov 22: the dashboard must work on it, closed and open.
//
// Apple lists the outer display at 1398 x 2034 pixels and the inner display at
// 1878 x 2670. At the usual 3x scale that is about 466 x 678 points closed and
// 626 x 890 points open (890 x 626 turned sideways). No source lists the exact
// point size yet, so the sweep covers a band around each: 440 and 466 (closed),
// 600/601 and 626, 700 (open, upright; the dashboard's in-between layout), 820/821
// (where the menu changes from a drawer to a column) and 890 (open, sideways).
//
// On every page, with every preview switch on, at each width:
//   * the page never scrolls sideways, and nothing is cut off at the right edge
//     (a wide table may scroll inside its own box, which is how it is meant to work);
//   * the menu is usable: a drawer with its button up to 820 points, a column above;
//   * at sideways width the content keeps a usable width next to the menu;
//   * buttons stay at least 24 points for a finger.
// And folding or unfolding in the middle of typing keeps what was typed, never
// leaves the menu's dark overlay over the page, and never leaves the drawer
// sliding over the page after folding back.
// Chromium imitating these sizes on Linux: not a real iPhone Duo, not Safari.
// The real-device checks are F1–F4 in docs/ops/DEVICE_CHECKLIST_2026-11-16.md.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'app', 'he-config.js'), 'utf8');
const PREVIEWS = [...CONFIG.matchAll(/\{ key: '(he_[a-z_]+)'/g)].map(m => m[1]);
const WIDTHS = [
  ['closed, narrow band', 440, 678], ['closed', 466, 678],
  ['open upright, edge of the phone layout', 600, 890], ['open upright, first in-between width', 601, 890],
  ['open upright', 626, 890], ['open upright, wide band', 700, 890],
  // Nov 24: between the phone cards and the menu-beside-the-page layout (the owner's narrow computer window)
  ['first width with tables instead of cards', 701, 890], ['narrow computer window', 790, 800],
  ['last drawer width', 820, 626], ['first column width', 821, 626], ['open sideways', 890, 626],
];

async function allOn(page) {
  await page.addInitScript(keys => { try { keys.forEach(k => localStorage.setItem(k, 'on')); } catch (e) {} }, PREVIEWS);
}
// What on the open page sticks out past the right edge of the screen, outside
// any box that scrolls sideways on purpose; and tiny visible buttons.
function measure(pid) {
  const W = document.documentElement.clientWidth;
  const sec = document.getElementById(pid);
  const scrollsOnPurpose = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  const cut = [], tiny = [];
  sec.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.position === 'fixed') return;
    if (r.right > W + 1 && !scrollsOnPurpose(el)) cut.push((el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + ' +' + Math.round(r.right - W));
    if (el.tagName === 'BUTTON' && (r.height < 24 || r.width < 24)) tiny.push((el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  const main = document.querySelector('main.contentArea') || sec.parentElement;
  return { side: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth, cut: [...new Set(cut)].slice(0, 6), tiny: [...new Set(tiny)].slice(0, 6), mainWidth: Math.round(main.getBoundingClientRect().width) };
}

for (const [label, w, h] of WIDTHS) {
  test(`iPhone Duo, ${label} (${w} x ${h} points): every page fits, the menu works`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'touch-screen phone profile only');
    test.setTimeout(240000);
    seedBusiness(backend);
    await allOn(page);
    await page.setViewportSize({ width: w, height: h });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await login(page);
    // the menu: a drawer with a button up to 820 points, a fixed column above
    const toggle = page.locator('.menuToggleBtn');
    if (w <= 820) {
      await expect(toggle, 'menu button').toBeVisible();
      expect(await page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right), 'the drawer starts closed').toBeLessThanOrEqual(1);
    } else {
      await expect(toggle, 'no menu button next to a visible menu').toBeHidden();
      await expect(page.locator('.sidebar')).toBeInViewport();
    }
    const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    const problems = [];
    for (const p of ids) {
      await gotoPage(page, p);
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(measure, p);
      if (m.side > 1) problems.push(p + ': the page scrolls sideways by ' + m.side);
      if (m.cut.length) problems.push(p + ': cut off at the right edge: ' + m.cut.join(', '));
      if (m.tiny.length) problems.push(p + ': buttons under 24 points: ' + m.tiny.join(', '));
      if (w > 820 && m.mainWidth < 480) problems.push(p + ': only ' + m.mainWidth + ' points left for the page next to the menu');
    }
    expect(problems, ti.project.name + ' ' + w + 'x' + h).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('folding and unfolding while typing keeps the text; the menu and its overlay follow the screen', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'touch-screen phone profile only');
  await page.setViewportSize({ width: 466, height: 678 });
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  const name = page.locator('#prodName');
  await name.fill('SYNTHETIC half-typed product name');
  // unfold, turn sideways, fold again
  for (const [w, h] of [[626, 890], [890, 626], [466, 678]]) {
    await page.setViewportSize({ width: w, height: h });
    await expect(name, 'typed text kept at ' + w).toHaveValue('SYNTHETIC half-typed product name');
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth), 'no sideways scroll at ' + w).toBeLessThanOrEqual(1);
  }
  // the drawer open on the outer screen, then unfolded and turned sideways: no dark overlay left over the page
  await page.locator('.menuToggleBtn').click();
  await expect(page.locator('.sidebarOverlay')).toBeVisible();
  await page.setViewportSize({ width: 890, height: 626 });
  await expect(page.locator('.sidebarOverlay'), 'no overlay over the page next to a visible menu').toBeHidden();
  await expect(page.locator('.sidebar')).toBeInViewport();
  // folded back: the drawer is closed, not left sliding over the page
  await page.setViewportSize({ width: 466, height: 678 });
  // (the drawer slides shut in about 0.2 s)
  await expect.poll(() => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right), { message: 'drawer closed after folding' }).toBeLessThanOrEqual(1);
  await expect(page.locator('.sidebarOverlay')).toBeHidden();
  await expect(name).toHaveValue('SYNTHETIC half-typed product name');
});

test('open upright (626 points): orders are one card each, with the full date and the Delete button in view', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'touch-screen phone profile only');
  seedBusiness(backend);
  await page.setViewportSize({ width: 626, height: 890 });
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const row = page.locator('#ordersPanel table.phoneCards tbody tr').first();
  await expect(row).toBeVisible();
  expect(await row.evaluate(el => getComputedStyle(el).display), 'a card, not a table row').toBe('block');
  const del = row.locator('button', { hasText: 'Delete' });
  await expect(del).toBeInViewport();
  // nothing in the card is hidden in a sideways scroll
  expect(await row.evaluate(el => { const t = el.closest('table'); return t.scrollWidth - t.clientWidth; })).toBeLessThanOrEqual(1);
  // and at 701 points (wider than any phone, narrower than a tablet's column layout) the table comes back
  await page.setViewportSize({ width: 701, height: 890 });
  await expect.poll(() => row.evaluate(el => getComputedStyle(el).display)).toBe('table-row');
});

// Nov 24 (the owner's screenshots): in a computer window about 790 wide, the
// Feature Flags list kept each description on one long line and scrolled
// sideways, so the name, the On/Off word and the button were never visible
// together. Between 701 and 820 wide a table wraps its text and fits.
test('narrow computer window (790 wide): a Feature Flags row shows its name, where, On/Off and button together', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'narrow computer window');
  await page.setViewportSize({ width: 790, height: 800 });
  await login(page);
  await gotoPage(page, 'flagsPanel');
  // both lists on the page: the previews, and the features that save real records
  const tables = page.locator('#flagsPanel table.phoneCards');
  await expect(tables.first().locator('tbody tr').first()).toBeVisible();
  const seen = await tables.evaluateAll(els => {
    const W = document.documentElement.clientWidth;
    return els.filter(el => el.querySelector('tbody tr button')).map(el => {
      const rows = [...el.querySelectorAll('tbody tr')].filter(r => r.querySelector('button'));
      return {
        display: getComputedStyle(rows[0]).display,
        sideways: el.scrollWidth - el.clientWidth,
        page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        outside: rows.filter(r => { const b = r.querySelector('button').getBoundingClientRect(), n = r.querySelector('td').getBoundingClientRect(); return b.right > W + 1 || n.left < 0; }).length,
        rows: rows.length,
      };
    });
  });
  expect(seen.length).toBeGreaterThanOrEqual(2);
  expect(seen.reduce((n, t) => n + t.rows, 0)).toBeGreaterThan(15);
  for (const t of seen) {
    expect(t.display, 'still a table, not cards').toBe('table-row');
    expect(t.sideways, 'the table does not scroll sideways').toBeLessThanOrEqual(1);
    expect(t.page, 'the page does not scroll sideways').toBeLessThanOrEqual(1);
    expect(t.outside, 'every row has its name and its button on screen').toBe(0);
  }
});
