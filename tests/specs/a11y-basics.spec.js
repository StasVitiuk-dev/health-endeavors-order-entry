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
  // Record Inspector: opened from a row with Quick Look (hover + Space), closed
  // with Escape. (Was a click, which never opens it, so this part used to be
  // skipped silently; fixed EXT3.)
  // (Focus is back on the Delete button after the password prompt, and Space
  // on a focused button presses it, so move focus away first.)
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.locator('#ordersTableWrap tbody tr').first().hover();
  await page.keyboard.press(' ');
  await expect(page.locator('#inspectorOverlay.open')).toBeVisible();
  await page.keyboard.press('Escape');
  if (await page.locator('#inspectorOverlay.open').count()) stuck.push('record inspector');
  expect(stuck).toEqual([]);
  expect(backend.tableWrites()).toEqual([]);
});

// AX-06 / AX-09 (2026-10-06): text contrast meets WCAG AA (4.5:1 for normal
// text, 3:1 for large) on every page, light and dark, for all visible text.
for (const scheme of ['light', 'dark']) {
  test(`text contrast meets AA on every page (${scheme})`, async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'colours; run once');
    test.setTimeout(180000);
    await page.emulateMedia({ colorScheme: scheme });
    seedBusiness(backend);
    await page.clock.setFixedTime(NOW);
    await login(page);
    const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
    const bad = new Map();
    for (const id of ids) {
      await gotoPage(page, id);
      await page.waitForLoadState('networkidle');
      const found = await page.locator(`section#${id}`).evaluate(root => {
        const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const bgOf = el => {
          const layers = []; let e = el;
          while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } e = e.parentElement; }
          let base = layers.pop() || { r: 255, g: 255, b: 255, a: 1 };
          while (layers.length) { const t = layers.pop(); base = { r: t.r * t.a + base.r * (1 - t.a), g: t.g * t.a + base.g * (1 - t.a), b: t.b * t.a + base.b * (1 - t.a), a: 1 }; }
          return base;
        };
        const out = [];
        // Every visible element that has text of its own (AX-09, EXT3: was
        // only badges, buttons, hints, empty states, labels and links).
        root.querySelectorAll('*').forEach(el => {
          const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!ownText || el.offsetParent === null || el.disabled) return;
          const fg = parse(getComputedStyle(el).color); if (!fg) return;
          const L1 = lum(fg), L2 = lum(bgOf(el));
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
          if (ratio < ((size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5)) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${ratio.toFixed(2)}`);
        });
        return out;
      });
      found.forEach(f => { if (!bad.has(f)) bad.set(f, `${id}: ${f}`); });
    }
    expect([...bad.values()]).toEqual([]);
  });
}

// EXT3 (2026-10-06): when a dialog closes, keyboard focus goes back to the
// button that opened it (WCAG 2.4.3), instead of the top of the page.
test('focus returns to the opener when a dialog closes with Escape', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard; desktop only');
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const focusedId = () => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className));
  const lost = [];
  // command palette, opened while the Refresh button has focus
  await page.locator('#refreshBtn').focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteOverlay.open')).toBeVisible();
  await page.keyboard.press('Escape');
  if ((await focusedId()) !== 'refreshBtn') lost.push('command palette → ' + await focusedId());
  // quick add
  await page.locator('#refreshBtn').focus();
  await page.keyboard.press('ControlOrMeta+n');
  await expect(page.locator('#quickAddOverlay.open')).toBeVisible();
  await page.keyboard.press('Escape');
  if ((await focusedId()) !== 'refreshBtn') lost.push('quick add → ' + await focusedId());
  // password prompt, opened from a Delete button
  const del = page.locator('#ordersTableWrap .deleteOrderBtn').first();
  await del.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  if (!(await del.evaluate(el => el === document.activeElement))) lost.push('password prompt → ' + await focusedId());
  expect(lost).toEqual([]);
});

test('every dialog is announced as a dialog with a name (role, aria-modal, label)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'markup; run once');
  await login(page);
  const missing = await page.evaluate(() => ['reauthOverlay', 'inspectorOverlay', 'paletteOverlay', 'shortcutOverlay', 'quickAddOverlay', 'helpOverlay']
    .filter(id => { const el = document.getElementById(id); return !el || el.getAttribute('role') !== 'dialog' || el.getAttribute('aria-modal') !== 'true' || !(el.getAttribute('aria-label') || '').trim(); }));
  expect(missing).toEqual([]);
});
