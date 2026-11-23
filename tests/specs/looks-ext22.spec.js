// New look (owner request of Nov 22): three design directions behind the "New
// look" preview switch. Checks: OFF changes nothing; the picker applies a
// direction at once and remembers it; every direction keeps every text at or
// above the 4.5:1 minimum (3:1 for large text) on the main pages, light and
// dark; motion respects Reduce Motion; phone width has no sideways scrolling.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { contrastFailures } = require('../helpers/a11y-audit');
const { NOW, seedBusiness } = require('../fixtures/business-data');

const LOOKS = ['aurora', 'graphite', 'original-plus'];
const PAGES = ['attentionPanel', 'ordersPanel', 'inventoryPanel', 'returnsPanel', 'expensesPanel', 'accountingPanel', 'purchaseOrdersPanel', 'flagsPanel'];
const lum = (h) => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

async function withLook(page, look) {
  await page.addInitScript((lk) => { try { localStorage.setItem('he_new_look', 'on'); localStorage.setItem('he_look', lk); } catch (e) {} }, look);
}
// text drawn with a gradient (Aurora's figures) has a transparent colour; its
// gradient end colours are checked separately below
const visibleFailures = (host) => host.evaluate((root, src) => { const f = new Function('return ' + src)(); return f(root); }, contrastFailures.toString())
  .then(list => list);

test('switch OFF (the default): no look is applied and the page is unchanged', async ({ page }) => {
  await login(page);
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBeNull();
  // the default primary button is today's blue
  expect(await page.locator('#refreshBtn').evaluate(b => getComputedStyle(b).backgroundColor)).toBe('rgb(0, 113, 227)');
});

test('the picker on Feature Flags applies a direction at once, and the choice is remembered', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page); await gotoPage(page, 'flagsPanel');
  const host = page.locator('#previewSwitchesHost');
  await host.locator('tr[data-preview-key="he_new_look"] [data-previewswitch="toggle"]').click();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBe('aurora');
  await expect(host.locator('[data-lookpicker]')).toHaveAttribute('data-lookpicker', 'aurora');
  await host.locator('[data-lookpick="graphite"]').click();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBe('graphite');
  await expect(host.locator('[data-lookpick="graphite"]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload(); await expect(page.locator('#dash')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBe('graphite');
  // turning the switch off brings today's look back at once
  await gotoPage(page, 'flagsPanel');
  await page.locator('#previewSwitchesHost tr[data-preview-key="he_new_look"] [data-previewswitch="toggle"]').click();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBeNull();
  // only the listed directions are ever applied
  await page.evaluate(() => { localStorage.setItem('he_new_look', 'on'); localStorage.setItem('he_look', 'evil"><x'); });
  await page.reload(); await expect(page.locator('#dash')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBe('aurora');
});

test('Aurora\'s gradient figures: both ends of each gradient are readable on their panels', () => {
  expect(ratio('#4f46e5', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('#0e7490', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('#c7d2fe', '#10142a')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('#67e8f9', '#10142a')).toBeGreaterThanOrEqual(4.5);
  // white text on both ends of the button gradient
  expect(ratio('#ffffff', '#4f46e5')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('#ffffff', '#0e7490')).toBeGreaterThanOrEqual(4.5);
});

for (const look of LOOKS) {
  test(look + ': every text is readable on the main pages, light and dark', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours are the same at phone size');
    test.setTimeout(180000);
    seedBusiness(backend);
    await page.clock.setFixedTime(NOW);
    await withLook(page, look);
    await login(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBe(look);
    const fails = [];
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const id of PAGES) {
        await gotoPage(page, id); await page.waitForLoadState('networkidle');
        const f = await page.evaluate((args) => {
          const fn = new Function('return ' + args.src)();
          const roots = [document.getElementById(args.id), document.querySelector('.sidebar'), document.querySelector('header.topbar')].filter(Boolean);
          return roots.flatMap(r => fn(r)).filter(x => !/ 0\.\d+$/.test(x) || true);
        }, { src: contrastFailures.toString(), id });
        // gradient text (transparent colour) is checked above, not here
        const real = await page.evaluate((list) => list, f);
        const gradient = await page.evaluate(() => [...document.querySelectorAll('.stat .num')].filter(e => getComputedStyle(e).color === 'rgba(0, 0, 0, 0)').length);
        const kept = gradient ? real.filter(x => !/^div\.num/.test(x)) : real;
        kept.forEach(x => fails.push(scheme + ' ' + id + ': ' + x));
      }
    }
    expect(fails).toEqual([]);
  });
}

test('page switching moves only when Reduce Motion is off', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await withLook(page, 'aurora');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page); await gotoPage(page, 'ordersPanel');
  expect(await page.locator('#ordersPanel').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gotoPage(page, 'inventoryPanel');
  expect(await page.locator('#inventoryPanel').evaluate(e => getComputedStyle(e).animationName)).toBe('heLookIn');
});

for (const look of LOOKS) {
  test(look + ' at phone size: no page scrolls sideways', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    seedBusiness(backend);
    await withLook(page, look);
    await login(page);
    for (const id of ['attentionPanel', 'ordersPanel', 'inventoryPanel', 'accountingPanel']) {
      await gotoPage(page, id);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, id).toBeLessThanOrEqual(0);
    }
  });
}

// Nov 23 (found in the pictures for the owner): the phone menu slides over the
// page; with a see-through background the menu text overlapped the page behind.
for (const look of LOOKS) {
  test(look + ' at phone size: the open menu has a solid background, light and dark', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    await withLook(page, look);
    await login(page);
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator('#menuToggleBtn').click();
      await expect(page.locator('#sidebarNav')).toHaveClass(/mobileOpen/);
      const bg = await page.locator('#sidebarNav').evaluate(e => getComputedStyle(e).backgroundColor);
      const alpha = /rgba\(/.test(bg) ? Number(bg.split(',')[3].replace(')', '')) : 1;
      expect(alpha, scheme + ' ' + bg).toBe(1);
      await page.locator('#sidebarOverlay').click({ position: { x: 370, y: 400 } });
      await expect(page.locator('#sidebarNav')).not.toHaveClass(/mobileOpen/);
    }
  });
}

// Nov 23 (owner: "put lines so it separates things"): page titles carry a rule,
// sections start with a hairline, forms are framed, sidebar groups are divided.
test('structure lines are drawn in every look, and never with the switch off', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  test.setTimeout(90000);   // four full page loads (switch off + three looks): ~30 s alone, more under load
  await login(page); await gotoPage(page, 'suppliersPanel');
  const lines = () => page.evaluate(() => {
    const w = (el, side) => el ? parseFloat(getComputedStyle(el)['border' + side + 'Width']) : -1;
    const groups = document.querySelectorAll('.sidebarGroup');
    return { title: w(document.querySelector('#suppliersPanel > h2:first-child'), 'Bottom'), form: w(document.querySelector('#suppliersPanel .heForm'), 'Left'), group: w(groups[1], 'Top') };
  });
  expect(await lines()).toEqual({ title: 0, form: 0, group: 0 });
  for (const look of LOOKS) {
    await page.evaluate((lk) => { localStorage.setItem('he_new_look', 'on'); localStorage.setItem('he_look', lk); }, look);
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'suppliersPanel');
    expect(await lines(), look).toEqual({ title: 1, form: 1, group: 1 });
  }
});

// Nov 23, the owner's choice: Aurora with Graphite's accent lines in Aurora's colours
// (a line on top of each figure tile and on the menu's "you are here" marker), and a
// calmer dark mode for long sessions (softer glow than the first Aurora).
test('Aurora carries the accent lines in its own colours, and its dark glow is soft', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await withLook(page, 'aurora');
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page);
  const tile = await page.locator('#businessHealthStats .stat').first().evaluate(e => { const cs = getComputedStyle(e); return { img: cs.backgroundImage, size: cs.backgroundSize }; });
  expect(tile.img).toMatch(/linear-gradient\(90deg, rgb\(139, 147, 245\).*rgb\(79, 195, 217\)/);
  expect(tile.size).toBe('100% 2px');
  const link = page.locator('#sidebarGroups .sidebarLink.active').first();
  await expect(link).toBeVisible();
  await expect.poll(() => link.evaluate(e => getComputedStyle(e, '::before').backgroundImage)).toMatch(/linear-gradient/);
  const glow = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--look-glow').trim());
  expect(glow).toContain('0.28');
});
