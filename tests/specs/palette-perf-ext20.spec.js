// EXT20 (INT-7): the palette keeps its selected row visible by scrolling only its
// own result list. scrollIntoView() forced a layout of the whole page on every
// keystroke (93% of keystroke time with 10,000 inventory rows behind the
// palette); see docs/ops/INTERMITTENT_FORENSICS_EXT20.md. Deterministic checks:
// no scrollIntoView while typing or moving, and the selected row is always
// inside the visible part of the list.
const { test, expect, login } = require('../helpers/dashboard');

test('palette: arrow keys keep the selected row visible without scrolling the page', async ({ page, backend }) => {
  backend.tables.products = Array.from({ length: 60 }, (_, i) => ({ id: 'p-' + i, name: 'SYNTHETIC palette product ' + i, sku: 'PP-' + i, is_active: true, status: 'active', cost: null, retail_price: null, wholesale_price: null, packaging_info: null }));
  backend.tables.inventory = backend.tables.products.map(p => ({ product_id: p.id, available: 1, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }));
  await login(page);
  await expect(page.locator('#inventoryWrap [data-product-id="p-59"]')).toHaveCount(1, { timeout: 30000 }); // search index filled
  await page.evaluate(() => {
    window.__siv = 0;
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...a) { if (this.closest && this.closest('#paletteResults')) window.__siv++; return orig.apply(this, a); };
    window.__pageY = window.scrollY;
  });
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteInput')).toBeFocused();
  await page.keyboard.type('synthetic palette');
  await expect(page.locator('#paletteResults .pResult').first()).toBeVisible();
  const n = await page.locator('#paletteResults .pResult').count();
  expect(n).toBeGreaterThan(10); // more rows than fit, so the list must scroll
  const inView = () => page.evaluate(() => {
    const box = document.getElementById('paletteResults');
    const sel = box.querySelector('.pResult.sel');
    const b = box.getBoundingClientRect(), s = sel.getBoundingClientRect();
    return { i: Number(sel.dataset.i), visible: s.top >= b.top - 1 && s.bottom <= b.bottom + 1 };
  });
  for (let k = 1; k < n; k++) {
    await page.keyboard.press('ArrowDown');
    const r = await inView();
    expect(r).toEqual({ i: k, visible: true });
  }
  for (let k = n - 2; k >= 0; k--) {
    await page.keyboard.press('ArrowUp');
    expect(await inView()).toEqual({ i: k, visible: true });
  }
  expect(await page.evaluate(() => window.__siv)).toBe(0);
  expect(await page.evaluate(() => window.scrollY === window.__pageY)).toBe(true);
});
