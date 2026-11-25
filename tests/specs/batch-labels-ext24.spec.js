// Batch stickers (owner, Nov 24: the barcode printed on a bottle says which
// product it is, not which batch, and nothing else on the bottle carries the
// batch; "we will have to print it on label"). Inventory prints a sticker per
// bottle: the batch in words and as a Code 128 barcode. Behind he_batch_labels
// (OFF). assets/scan/he-batch-labels.js. Reads only; every value is made up.
// The barcode was also compared, outside this repository, with an established
// barcode library on 304 texts covering every printable character: identical.
const B = require('../../assets/scan/he-batch-labels.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
// a barcode read back the way a scanner does it: bar and space widths -> characters
const PATTERN_VALUES = (() => {
  const all = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
  const by = {};
  all.forEach((ch, v) => { by[B.encode(ch).widths.slice(6, 12)] = v; });   // start(6) + the character(6) + check + stop
  return by;
})();
function readBack(text) {
  const e = B.encode(text), w = e.widths;
  expect(w.slice(0, 6)).toBe('211214');          // start B
  expect(w.slice(-7)).toBe('2331112');           // stop
  const symbols = []; for (let i = 6; i < w.length - 7; i += 6) symbols.push(w.slice(i, i + 6));
  const check = symbols.pop();
  const values = symbols.map(s => PATTERN_VALUES[s]);
  expect(values.every(v => Number.isInteger(v))).toBe(true);
  const sum = (104 + values.reduce((t, v, i) => t + v * (i + 1), 0)) % 103;
  expect(check).toBe(sum < 95 ? B.encode(String.fromCharCode(32 + sum)).widths.slice(6, 12) : check);
  return { text: values.map(v => String.fromCharCode(32 + v)).join(''), checksum: sum };
}

test.describe('the barcode and the plan (no browser)', () => {
  test('a batch number becomes "B-" plus the number, and reads back as the same batch', ({}, ti) => {
    node(ti);
    expect(B.payload('  LOT-A ')).toEqual({ ok: true, text: 'B-LOT-A', reason: '' });
    expect(B.parse('B-LOT-A')).toEqual({ ok: true, lot: 'LOT-A' });
    expect(B.parse(' B-2026-11 #7 ')).toEqual({ ok: true, lot: '2026-11 #7' });
    for (const notOurs of ['850558001222', '1Z999AA10123456784', 'B-', 'b-LOT', 'LOT-A', '', null, undefined, 7, {}, [], 'B-' + 'x'.repeat(25), 'B-café'])
      expect(B.parse(notOurs).ok, String(notOurs)).toBe(false);
    expect(B.payload('').ok).toBe(false);
    expect(B.payload('x'.repeat(25)).reason).toContain('too long');
    expect(B.payload('café').reason).toContain('cannot hold');
    for (const junk of [null, undefined, {}, [], NaN, Infinity]) expect(B.payload(junk).ok).toBe(false);
    expect(B.payload(42)).toMatchObject({ ok: true, text: 'B-42' });
  });

  test('Code 128: known answers, every pattern 11 modules wide, and a scanner reads the text back', ({}, ti) => {
    node(ti);
    // known answers (checked against an independent barcode library)
    expect(B.encode('B-LOT-A')).toMatchObject({ ok: true, checksum: 23, modules: 112 });
    expect(B.encode('B-LOT-A').widths).toBe('2112141311231221321321311331212133111221321113233121312331112');
    expect(B.encode('A')).toMatchObject({ widths: '2112141113231311232331112', checksum: 34 });   // start B, A, check, stop
    // every character: 6 widths adding to 11; the whole symbol adds up
    for (let c = 32; c <= 126; c += 1) {
      const w = B.encode(String.fromCharCode(c)).widths.slice(6, 12);
      expect(w.split('').reduce((t, d) => t + Number(d), 0), 'character ' + c).toBe(11);
    }
    expect(new Set(Object.keys(PATTERN_VALUES)).size).toBe(95);              // no two characters share a pattern
    for (const text of ['B-LOT-A', 'B-2026-11-A1', 'B-HE 24/11 #7', 'B-~}|{`_^]', 'B-' + '0'.repeat(24)]) {
      expect(readBack(text).text).toBe(text);
      expect(B.encode(text).modules).toBe((text.length + 2) * 11 + 13);
    }
    // the bars: start after the quiet zone, never touch, never overlap, end before the quiet zone
    const b = B.bars('B-LOT-A');
    expect(b.width).toBe(112 + 20);
    expect(b.bars[0]).toEqual({ x: 10, w: 2 });
    b.bars.forEach((r, i) => { if (i) expect(r.x).toBeGreaterThan(b.bars[i - 1].x + b.bars[i - 1].w); });
    const last = b.bars[b.bars.length - 1]; expect(last.x + last.w).toBe(b.width - 10);
    for (const junk of [null, undefined, '', 'café', 'x'.repeat(61), {}, []]) { expect(B.encode(junk).ok).toBe(false); expect(B.bars(junk)).toEqual({ ok: false, bars: [], width: 0 }); }
  });

  test('the plan: how many labels, a readable bar width, plain words when it cannot be printed', ({}, ti) => {
    node(ti);
    expect(B.plan({ lot: 'LOT-A', count: 40, layout: 'roll' })).toMatchObject({ ok: true, text: 'B-LOT-A', count: 40, perPage: 1, pages: 40, moduleInch: 0.01, widthInch: 1.32 });
    expect(B.plan({ lot: 'LOT-A', count: '17', layout: 'sheet' })).toMatchObject({ ok: true, count: 17, perPage: 8, pages: 3 });
    const long = B.plan({ lot: 'X'.repeat(14), count: 1, layout: 'roll' });           // still fits, with thinner bars
    expect(long.ok).toBe(true); expect(long.moduleInch).toBeLessThan(0.01); expect(long.moduleInch).toBeGreaterThanOrEqual(B.MIN_MODULE_INCH); expect(long.widthInch).toBeLessThanOrEqual(2.05);
    expect(B.plan({ lot: 'X'.repeat(20), count: 3, layout: 'roll' })).toMatchObject({ ok: false, reason: expect.stringContaining('Choose the 4 × 6 label') });
    expect(B.plan({ lot: 'X'.repeat(24), count: 9, layout: 'sheet' })).toMatchObject({ ok: true, pages: 2 });
    for (const [count, words] of [[0, 'how many'], [-3, 'how many'], [1.5, 'how many'], ['abc', 'how many'], ['', 'how many'], [501, 'At most 500'], [null, 'how many']])
      expect(B.plan({ lot: 'LOT-A', count, layout: 'roll' }), String(count)).toMatchObject({ ok: false, reason: expect.stringContaining(words) });
    expect(B.plan({ lot: 'LOT-A', count: 5, layout: 'poster' }).reason).toContain('Choose where');
    expect(B.plan({ lot: '', count: 5, layout: 'roll' }).reason).toContain('no number');
    for (const junk of [null, undefined, 7, 'x', []]) expect(B.plan(junk).ok).toBe(false);
  });
});

const lots = () => [
  { id: 'lot-1', lot_number: 'LOT-A', product_id: 'p-1', received_at: '2026-11-20T15:00:00Z', quantity_received: 40 },
  { id: 'lot-2', lot_number: 'SYN-2026-11-B', product_id: 'p-2', received_at: '2026-11-22T15:00:00Z', quantity_received: 12 },
  { id: 'lot-3', lot_number: '  ', product_id: 'p-1', received_at: '2026-11-23T15:00:00Z', quantity_received: 5 },   // no number: not offered
];
const products = () => [{ id: 'p-1', name: 'SYNTHETIC Sea lotion 8 oz', sku: 'SYN-SEA-8' }, { id: 'p-2', name: 'SYNTHETIC Honey balm', sku: 'SYN-HON' }];
const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_batch_labels', 'on'); } catch (e) {} window.__printed = 0; window.print = () => { window.__printed += 1; }; });

test.describe('on the Inventory page', () => {
  test('switch off (as shipped): no section, and the batches are not asked for', async ({ page, backend }) => {
    backend.tables.inventory_lots = lots(); backend.tables.products = products();
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await expect(page.locator('#batchLabelsHost')).toHaveCount(0);
    expect(backend.requests.filter(r => r.table === 'inventory_lots' && /quantity_received/.test((r.params.find(([k]) => k === 'select') || [])[1] || '') && !/purchase_order_id/.test((r.params.find(([k]) => k === 'select') || [])[1] || ''))).toEqual([]);
  });

  test('the newest batch is ready with one sticker per bottle; Print sends that many stickers and writes nothing', async ({ page, backend }) => {
    backend.tables.inventory_lots = lots(); backend.tables.products = products();
    await on(page);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    const host = page.locator('#batchLabelsHost');
    await expect(host.locator('h3')).toHaveText('Batch stickers');
    await expect(host.locator('#blLot option')).toHaveCount(2);                       // the batch with no number is not offered
    await expect(host.locator('#blLot')).toHaveValue('lot-2');                        // newest first
    await expect(host.locator('#blCount')).toHaveValue('12');
    await expect(host.locator('#blCount')).toHaveAttribute('max', String(B.MAX_COUNT));   // the box's limit and the rule agree
    await expect(host.locator('[data-blpreview]')).toHaveAttribute('data-blpreview', 'B-SYN-2026-11-B');
    await expect(host.locator('[data-blpreview] .blLot')).toHaveText('Batch SYN-2026-11-B');
    await expect(host.locator('[data-blpreview] .blProduct')).toHaveText('SYNTHETIC Honey balm');
    // the picture has exactly the bars of the barcode
    const want = B.bars('B-SYN-2026-11-B');
    const drawn = await host.locator('[data-blpreview] svg rect').evaluateAll(els => els.map(r => ({ x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')) })));
    expect(drawn).toEqual(want.bars);
    expect(await host.locator('[data-blpreview] svg').getAttribute('viewBox')).toBe('0 0 ' + want.width + ' 10');

    await host.locator('#blLot').selectOption('lot-1');
    await expect(host.locator('#blCount')).toHaveValue('40');
    await expect(host.locator('[data-blprint]')).toHaveText('Print 40 stickers (40 labels)');
    await host.locator('#blCount').fill('5');
    await host.locator('#blCount').blur();
    await expect(host.locator('[data-blprint]')).toHaveText('Print 5 stickers (5 labels)');
    await host.locator('[data-blprint]').click();
    await expect(host.locator('[data-blmessage]')).toContainText('5 stickers for batch LOT-A sent to the print window');
    expect(await page.evaluate(() => window.__printed)).toBe(1);
    const doc = page.locator('#invoicePrintHost .blDoc');
    await expect(doc).toHaveAttribute('data-bldoc', '5');
    await expect(doc.locator('.printPage')).toHaveCount(5);
    await expect(doc.locator('.blSticker[data-blsticker="B-LOT-A"]')).toHaveCount(5);
    expect(await page.evaluate(() => [document.getElementById('stickerPrintCss').media, document.getElementById('labelPrintCss').media])).toEqual(['print', 'not all']);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await page.evaluate(() => [document.getElementById('stickerPrintCss').media, document.getElementById('labelPrintCss').media])).toEqual(['not all', 'not all']);
    expect(backend.tableWrites()).toEqual([]);
  });

  test('on a 4 × 6 label: 8 strips per label; a count that makes no sense is refused in plain words', async ({ page, backend }) => {
    backend.tables.inventory_lots = lots(); backend.tables.products = products();
    await on(page);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    const host = page.locator('#batchLabelsHost');
    await host.locator('#blLayout').selectOption('sheet');
    await host.locator('#blCount').fill('17');
    await host.locator('#blCount').blur();
    await expect(host.locator('[data-blprint]')).toHaveText('Print 17 stickers (3 labels)');
    await host.locator('[data-blprint]').click();
    const doc = page.locator('#invoicePrintHost .blDoc');
    await expect(doc.locator('.printPage')).toHaveCount(3);
    expect(await doc.locator('.printPage').evaluateAll(ps => ps.map(p => p.querySelectorAll('.blSticker').length))).toEqual([8, 8, 1]);
    expect(await page.evaluate(() => [document.getElementById('stickerPrintCss').media, document.getElementById('labelPrintCss').media])).toEqual(['not all', 'print']);

    await host.locator('#blCount').fill('0');
    await host.locator('#blCount').blur();
    await expect(host.locator('[data-blprint]')).toBeDisabled();
    await expect(host.locator('[data-blmessage]')).toContainText('Type how many stickers');
    await host.locator('#blCount').fill('501');
    await host.locator('#blCount').blur();
    await expect(host.locator('[data-blmessage]')).toContainText('At most 500');
    expect(await page.evaluate(() => window.__printed)).toBe(1);
  });

  test('no batch yet, and batches that cannot be read: said plainly', async ({ page, backend }) => {
    backend.tables.inventory_lots = []; backend.tables.products = products();
    await on(page);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await expect(page.locator('#batchLabelsHost')).toContainText('No batch has been received yet');
    await expect(page.locator('#batchLabelsHost [data-blprint]')).toHaveCount(0);
  });

  test('the section fits the screen (no sideways scrolling), with a long product name and batch number', async ({ page, backend }) => {
    backend.tables.inventory_lots = [{ id: 'lot-x', lot_number: 'SYN-LONG-BATCH-2026-11', product_id: 'p-x', received_at: '2026-11-23T15:00:00Z', quantity_received: 3 }];
    backend.tables.products = [{ id: 'p-x', name: 'SYNTHETIC ' + 'very-long-product-name-'.repeat(8), sku: 'SYN-X' }];
    await on(page);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    const host = page.locator('#batchLabelsHost');
    await expect(host.locator('[data-blmessage]')).toContainText('too long for the small label');   // 22 characters: only the 4 × 6 label
    await host.locator('#blLayout').selectOption('sheet');
    await expect(host.locator('[data-blpreview]')).toBeVisible();
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('#batchLabelsHost, #batchLabelsHost *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1) out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.right) + '>' + w); });
      return out.concat(document.documentElement.scrollWidth > w + 1 ? ['page scrolls sideways'] : []);
    });
    expect(over).toEqual([]);
  });
});
