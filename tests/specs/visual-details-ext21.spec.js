// Visual details found in the owner look-over pass of Nov 16 (pictures taken of
// every reviewed screen, then measured). Each was a real inconsistency:
//   * fields in one form row had different heights (dropdowns 37 px, text 39,
//     dates 41), so labels and boxes did not line up;
//   * the Employee Activity search box was the one field still rounded (8 px);
//   * Orders: amounts were left-aligned; a status read "partially_refunded";
//   * Returns: a reason with no label showed its raw code ("damaged"); the
//     refund box cut off its own placeholder; at phone size a lone "Close"
//     button squeezed its row's text instead of going below it;
//   * Employee Activity said "No activity matches that search." when nothing
//     had been searched;
//   * three add forms had no heading, unlike "Log a new return" and "Adjust stock".
// Colours are unchanged; this is shape, alignment and wording only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');

const FORM_PAGES = ['inventoryPanel', 'purchaseOrdersPanel', 'returnsPanel', 'expensesPanel', 'suppliersPanel', 'attentionPanel'];

test('every full-size field in a form row has the same height, and every field is square', async ({ page, backend }, ti) => {
  seedBusiness(backend);
  await login(page);
  const bad = [];
  for (const p of FORM_PAGES) {
    await gotoPage(page, p);
    await page.waitForLoadState('networkidle');
    const r = await page.evaluate(pid => {
      const sel = '.heForm .heField input:not([type=checkbox]):not([type=radio]):not([type=file]), .heForm .heField select, .reminderForm > input:not([type=checkbox]), .reminderForm > select';
      const els = [...document.querySelectorAll('#' + pid + ' :is(' + sel + ')')].filter(e => e.getClientRects().length);
      return { heights: [...new Set(els.map(e => Math.round(e.getBoundingClientRect().height)))], n: els.length,
        radii: [...new Set([...document.querySelectorAll('#' + pid + ' input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), #' + pid + ' select')].filter(e => e.getClientRects().length).map(e => getComputedStyle(e).borderTopLeftRadius))] };
    }, p);
    if (r.n && r.heights.length !== 1) bad.push(p + ' heights ' + r.heights.join('/'));
    if (r.radii.some(x => x !== '2px')) bad.push(p + ' radii ' + r.radii.join('/'));
  }
  await gotoPage(page, 'activityPanel');
  expect(await page.locator('#activitySearch').evaluate(e => getComputedStyle(e).borderTopLeftRadius)).toBe('2px');
  expect(bad, ti.project.name).toEqual([]);
});

test('Orders: amounts line up on the right, statuses read as words', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'table layout; run once');
  seedBusiness(backend);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const row = page.locator('#ordersTableWrap tr[data-id="o3"]');
  await expect(row.locator('.badge')).toHaveText('partially refunded');
  const aligned = await page.locator('#ordersTableWrap').evaluate(w => {
    const rights = [...w.querySelectorAll('tbody tr')].map(tr => Math.round(tr.cells[3].getBoundingClientRect().right - tr.cells[3].firstChild.parentElement.getBoundingClientRect().right));
    const txt = [...w.querySelectorAll('tbody tr')].map(tr => getComputedStyle(tr.cells[3]).textAlign);
    return { txt: [...new Set(txt)], head: getComputedStyle(w.querySelector('thead th:nth-child(4)')).textAlign };
  });
  expect(aligned).toEqual({ txt: ['right'], head: 'right' });
});

test('Returns: reasons read as words, the refund box says what it is, phone rows put buttons below the text', async ({ page, backend }, ti) => {
  seedBusiness(backend);
  await login(page);
  await gotoPage(page, 'returnsPanel');
  await expect(page.locator('#returnsWrap [data-return-id="ret-requested"]')).toContainText('Reason: Damaged');
  const refund = page.locator('#returnsWrap .refundAmountInput');
  await expect(refund).toHaveAttribute('aria-label', 'Refund amount in dollars (optional)');
  expect(await refund.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  expect(await page.locator('#retOrderFind').evaluate(e => { const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(e); c.font = cs.fontSize + ' ' + cs.fontFamily; return c.measureText(e.placeholder).width <= e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; })).toBe(true);
  if (ti.project.name === 'iphone') {
    // Every return row: the text uses the full width; the buttons sit under it.
    const r = await page.locator('#returnsWrap [data-return-id]').evaluateAll(rows => rows.map(row => {
      const info = row.querySelector('.info').getBoundingClientRect(); const acts = row.lastElementChild.getBoundingClientRect();
      return { id: row.getAttribute('data-return-id'), full: info.width >= row.getBoundingClientRect().width - 30, below: acts.top >= info.bottom - 1 };
    }));
    expect(r.filter(x => !x.full || !x.below)).toEqual([]);
  }
});

test('Employee Activity: with nothing searched it does not claim a search found nothing', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page);
  await gotoPage(page, 'activityPanel');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#activityWrap .empty')).toContainText('No changes recorded yet.');
  await expect(page.locator('#activityWrap .empty')).not.toContainText('matches');
  await page.locator('#activitySearch').fill('SYN-NOTHING');
  await page.locator('#activitySearchBtn').click();
  await expect(page.locator('#activityWrap .empty')).toContainText('No activity matches that search.');
});

test('every add form has a heading, like "Log a new return"', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'markup; run once');
  await login(page);
  const heads = await page.evaluate(() => ['addProductForm', 'addPoForm', 'addSupplierForm', 'logReturnForm', 'adjustInventoryForm']
    .map(id => { const f = document.getElementById(id); const h = f && f.previousElementSibling; return id + ':' + (h && h.tagName === 'H3' ? h.textContent : 'none'); }));
  expect(heads).toEqual(['addProductForm:Add a product', 'addPoForm:Create a purchase order', 'addSupplierForm:Add a supplier', 'logReturnForm:Log a new return', 'adjustInventoryForm:Adjust stock']);
});
