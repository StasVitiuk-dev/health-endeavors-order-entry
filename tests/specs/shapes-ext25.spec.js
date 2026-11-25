// Shapes and font (owner request, Nov 24: "I don't like some of the forms of windows,
// buttons, the shape, also the font; something more business casual but elegant").
// Three styles to compare on the real pages, chosen on Feature Flags next to the Look,
// for this browser: Soft, Crisp, Elegant; "As it is" is the dashboard unchanged.
// assets/looks/he-shapes.css, applied before the page is drawn by he-look-boot.js.
// Shapes, spacing and typefaces only: no colour is changed.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const ROOT = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'assets/looks/he-shapes.css'), 'utf8');
const withShape = (page, shape) => page.addInitScript((s) => { try { if (s) localStorage.setItem('he_shape', s); } catch (e) {} }, shape);
const look = (page) => page.evaluate(() => {
  const btn = document.querySelector('#refreshBtn'), panel = document.querySelector('section.panel.activePage'), h2 = panel.querySelector('h2');
  const cs = (el) => getComputedStyle(el);
  return { shape: document.documentElement.getAttribute('data-shape'), button: cs(btn).borderTopLeftRadius, panel: cs(panel).borderTopLeftRadius,
    body: cs(document.body).fontFamily.split(',')[0].replace(/["']/g, '').trim(), title: cs(h2).fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    ink: cs(document.body).color, page: cs(document.body).backgroundColor, accent: cs(document.documentElement).getPropertyValue('--accent').trim() };
});

test('the style sheet changes shapes, spacing and typefaces only: no colour, and only under a chosen style', ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // every rule is either a typeface declaration or scoped to a chosen style
  const selectors = [...body.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map(m => m[2].trim()).filter(Boolean);
  for (const sel of selectors) for (const part of sel.split(',')) expect(part.trim(), part).toMatch(/^:root\[data-shape="(soft|crisp|elegant)"\]/);
  expect((body.match(/@font-face/g) || []).length).toBe(5);
  // no colour is set anywhere: only the two existing button fills are re-used by name
  expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  expect(body.match(/(^|[;{\s])(color|background|background-color|border-color)\s*:[^;}]*/g).map(s => s.trim().replace(/^[;{]\s*/, '')))
    .toEqual(['background-color:var(--btn-fill)', 'background-color:var(--btn-fill-hover)']);
  // the typefaces are the open-licensed files already in the repository
  for (const m of body.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)) expect(fs.existsSync(path.join(ROOT, 'assets/fonts', m[1])), m[1]).toBe(true);
});

for (const shape of ['', 'soft', 'crisp', 'elegant', 'nonsense']) {
  test('style "' + (shape || 'as it is') + '": shape and typeface on the page', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'one size is enough');
    await withShape(page, shape);
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await page.evaluate(() => document.fonts.ready);
    const v = await look(page);
    const expected = { '': [null, '2px', '16px'], nonsense: [null, '2px', '16px'], soft: ['soft', '10px', '22px'] /* the header's button is a small one: 10px; full-size buttons and fields 12px */, crisp: ['crisp', '4px', '8px'], elegant: ['elegant', '7px', '14px'] }[shape];
    expect([v.shape, v.button, v.panel]).toEqual(expected);
    expect(v.body).toBe(shape === 'crisp' || shape === 'elegant' ? 'HE Screen Text' : '-apple-system');
    expect(v.title).toBe(shape === 'elegant' ? 'HE Screen Display' : v.body);
    // the colours are the Look's, whatever the style
    expect([v.ink, v.accent]).toEqual(['rgb(11, 16, 32)', '#4f46e5']);
    // the typeface files really load (the page's security rules allow them)
    if (shape === 'crisp' || shape === 'elegant') expect(await page.evaluate(() => document.fonts.check('14px "HE Screen Text"'))).toBe(true);
    if (shape === 'elegant') expect(await page.evaluate(() => document.fonts.check('600 26px "HE Screen Display"'))).toBe(true);
  });
}

test('the picker on Feature Flags: one tap changes the style at once, it is remembered, and "As it is" removes it', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'flagsPanel');
  const picker = page.locator('[data-shapepicker]');
  await expect(picker).toHaveAttribute('data-shapepicker', 'today');
  await expect(picker.locator('[data-shapepick]')).toHaveText(['As it is', 'Soft', 'Crisp', 'Elegant']);
  await picker.locator('[data-shapepick="elegant"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-shape', 'elegant');
  await expect(page.locator('[data-shapepicker]')).toHaveAttribute('data-shapepicker', 'elegant');
  await expect(page.locator('[data-shapepick="elegant"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shapepick="elegant"]')).toBeFocused();
  await expect(page.locator('[data-shapepicker]')).toContainText('A classic typeface for titles');
  expect(await page.evaluate(() => localStorage.getItem('he_shape'))).toBe('elegant');
  // the Look (colours) is a separate choice and is untouched
  await expect(page.locator('html')).toHaveAttribute('data-look', 'aurora');
  await page.reload(); await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-shape', 'elegant');            // applied again before the page is drawn
  await gotoPage(page, 'flagsPanel');
  await page.locator('[data-shapepick="today"]').click();
  expect(await page.locator('html').getAttribute('data-shape')).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('he_shape'))).toBeNull();
});

for (const shape of ['soft', 'crisp', 'elegant']) {
  test('style "' + shape + '" at phone size: pages fit without sideways scrolling', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    await withShape(page, shape);
    await login(page);
    for (const id of ['attentionPanel', 'ordersPanel', 'expensesPanel', 'flagsPanel']) {
      await gotoPage(page, id);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, shape + ' ' + id).toBeLessThanOrEqual(0);
    }
  });
}
