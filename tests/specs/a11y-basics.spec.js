// Accessibility / responsive basics across every page (2026-10-06), with the
// realistic synthetic data: every visible control has a name a screen reader
// can announce, ids are unique, and on a phone the buttons are big enough to
// tap. No new dependency: plain DOM checks. Visual design is not changed.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

// Visible controls with no accessible name, inside the given root.
function unnamedControls(root) {
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const labelFor = el => el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.textContent || el.value || (labelFor(el) && labelFor(el).textContent) || (el.closest('label') && el.closest('label').textContent) || el.getAttribute('aria-labelledby') || '').trim();
  const out = [];
  root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]').forEach(el => {
    if (!visible(el)) return;
    if (el.tagName === 'SELECT') { if (!name(el) && !(el.options[0] && el.options[0].textContent.trim())) out.push(el.outerHTML.slice(0, 120)); return; }
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) { if (!name(el)) out.push(el.outerHTML.slice(0, 120)); return; }
    if (!name(el) && !el.querySelector('svg title, img[alt]:not([alt=""])')) out.push(el.outerHTML.slice(0, 120));
  });
  return out;
}

test('every visible control on every page has an accessible name; ids are unique', async ({ page, backend }) => {
  test.setTimeout(180000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const problems = [];
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    const bad = await page.locator(`section#${id}`).evaluate(unnamedControls);
    bad.forEach(b => problems.push(`${id}: ${b}`));
  }
  const dupIds = await page.evaluate(() => {
    const seen = {}; document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
    return Object.entries(seen).filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`);
  });
  expect(problems).toEqual([]);
  expect(dupIds).toEqual([]);
});

test('on a phone, visible buttons on every page are at least 24px tall (tap target)', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone size only');
  test.setTimeout(180000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const small = [];
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    const found = await page.locator(`section#${id}`).evaluate(root => [...root.querySelectorAll('button')]
      .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24; })
      .map(b => `${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`));
    found.forEach(f => small.push(`${id}: ${f}`));
  }
  expect(small).toEqual([]);
});

test('the password prompt takes keyboard focus, and Escape closes it without doing anything', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard; desktop only');
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.locator('#ordersTableWrap .deleteOrderBtn').first().click();
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await expect(page.locator('#reauthPassword')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  expect(backend.tableWrites().filter(r => r.table === 'orders')).toEqual([]);
});

test('errors are announced once (alert banner), confirmations politely (status region)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'markup; run once');
  await login(page);
  await expect(page.locator('#dashError')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#toastHost')).toHaveAttribute('aria-live', 'polite');
  await page.evaluate(() => { window.toastErr('SYNTHETIC error'); window.toastOk('SYNTHETIC ok'); });
  await expect(page.locator('#toastHost .toast.err')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#toastHost .toast.ok')).not.toHaveAttribute('aria-hidden', 'true');
});

test('every overlay closes with Escape', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard; desktop only');
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const overlays = [
    ['command palette', async () => { await page.keyboard.press('ControlOrMeta+k'); }, '#paletteOverlay.open'],
    ['shortcut list', async () => { await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Shift+Slash'); }, '#shortcutOverlay.open'],
    ['quick add', async () => { await page.keyboard.press('ControlOrMeta+n'); }, '#quickAddOverlay.open'],
    ['password prompt', async () => { await page.locator('#ordersTableWrap .deleteOrderBtn').first().click(); }, '#reauthOverlay'],
  ];
  const stuck = [];
  for (const [name, openIt, sel] of overlays) {
    await openIt();
    const el = page.locator(sel).first();
    await expect(el).toBeVisible();
    await page.keyboard.press('Escape');
    if (await el.isVisible()) stuck.push(name);
  }
  // Record Inspector: opened from a row, closed with Escape
  await page.locator('#ordersTableWrap tbody tr').first().click();
  if (await page.locator('#inspectorOverlay.open').count()) {
    await page.keyboard.press('Escape');
    if (await page.locator('#inspectorOverlay.open').count()) stuck.push('record inspector');
  }
  expect(stuck).toEqual([]);
  expect(backend.tableWrites()).toEqual([]);
});
