// Product list import (owner request of Nov 23): the owner's product list arrives
// in about a week as a spreadsheet. The checker (he-product-import) must catch
// every mistake before anything is added; the Inventory screen (behind the
// he_product_import switch, OFF) adds the new products only when every line is
// right and the owner presses Add. Everything here is made-up data.
const P = require('../../assets/inventory/he-product-import.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const HEAD = 'name,size,sku,retail_price,wholesale_price,cost,status,packaging\n';
const GOOD = HEAD
  + 'SYNTHETIC Lavender Body Lotion,8 oz,SYN-LAV-8OZ,24.00,12.00,4.50,active,8 oz glass jar\n'
  + 'SYNTHETIC Honey Milk Cream,4 oz,SYN-HONEY-4OZ,$18.50,9.25,3.10,later,tube\n';

test.describe('the checker', () => {
  test('the template has the right columns and its EXAMPLE rows must be deleted', ({}, ti) => {
    node(ti);
    const t = P.templateCsv();
    expect(t.startsWith('﻿name,size,sku,retail_price,wholesale_price,cost,status,packaging\r\n')).toBe(true);
    const r = P.checkFile(t);
    expect(r.ok).toBe(true);
    expect(r.counts).toMatchObject({ total: 2, error: 2, new: 0 });
    expect(r.rows.every(x => x.problems.some(p => /EXAMPLE row/.test(p)))).toBe(true);
    expect(r.ready).toEqual([]);
  });

  test('a correct list: every product is ready, the size joins the name, prices become numbers', ({}, ti) => {
    node(ti);
    const r = P.checkFile(GOOD);
    expect(r.counts).toMatchObject({ total: 2, new: 2, error: 0 });
    expect(r.summary).toBe('2 products ready to add.');
    expect(r.ready).toEqual([
      { name: 'SYNTHETIC Lavender Body Lotion 8 oz', sku: 'SYN-LAV-8OZ', status: 'active', cost: 4.5, retail_price: 24, wholesale_price: 12, packaging_info: '8 oz glass jar' },
      { name: 'SYNTHETIC Honey Milk Cream 4 oz', sku: 'SYN-HONEY-4OZ', status: 'draft', cost: 3.1, retail_price: 18.5, wholesale_price: 9.25, packaging_info: 'tube' },
    ]);
    // line numbers are the spreadsheet's row numbers (row 1 = the column names)
    expect(r.rows.map(x => x.line)).toEqual([2, 3]);
  });

  test('every kind of mistake is caught, with the line and a plain reason, and nothing is ready', ({}, ti) => {
    node(ti);
    const r = P.checkFile(HEAD
      + ',8 oz,SYN-A,10,5,1,active,\n'                                  // 2 no name
      + 'SYNTHETIC No Sku,8 oz,,10,5,1,active,\n'                        // 3 no SKU
      + 'SYNTHETIC Space Sku,,SYN B,10,5,1,active,\n'                    // 4 space in SKU
      + 'SYNTHETIC Dup One,,SYN-DUP,10,5,1,active,\n'                    // 5
      + 'SYNTHETIC Dup Two,,syn-dup,10,5,1,active,\n'                    // 6 same SKU (case does not matter)
      + 'SYNTHETIC Comma,,SYN-C,"12,50",5,1,active,\n'                   // 7 European decimal comma
      + 'SYNTHETIC Negative,,SYN-D,-12,5,1,active,\n'                    // 8 negative
      + 'SYNTHETIC Cents,,SYN-E,12.505,5,1,active,\n'                    // 9 three decimals
      + 'SYNTHETIC Upside Down,,SYN-F,10,15,1,active,\n'                 // 10 wholesale above retail
      + 'SYNTHETIC Maybe,,SYN-G,10,5,1,maybe,\n'                         // 11 unknown status
      + 'SYNTHETIC No Price,,SYN-H,,5,1,active,\n'                       // 12 active without retail price
      + 'SYNTHETIC Words,,SYN-I,ten dollars,5,1,active,\n');             // 13 not an amount
    const by = Object.fromEntries(r.rows.map(x => [x.line, x.problems.join(' | ')]));
    expect(by[2]).toMatch(/no product name/);
    expect(by[3]).toMatch(/no SKU \(suggestion: HE-SYNTHETIC-NO-SKU-8OZ\)/);
    expect(by[4]).toMatch(/SKU "SYN B" may use only letters/);
    expect(by[5]).toBe('');
    expect(by[6]).toMatch(/same SKU as line 5/);
    expect(by[7]).toMatch(/retail price is not a plain amount .*12,50.*use a dot/);
    expect(by[8]).toMatch(/retail price is negative/);
    expect(by[9]).toMatch(/more than 2 decimals/);
    expect(by[10]).toMatch(/wholesale price \(\$15\.00\) is higher than the retail price \(\$10\.00\)/);
    expect(by[11]).toMatch(/status "maybe" is not one of/);
    expect(by[12]).toMatch(/an active product needs a retail price/);
    expect(by[13]).toMatch(/retail price is not an amount/);
    expect(r.counts.error).toBe(11);
    expect(r.ready).toEqual([]);
    expect(r.summary).toBe('11 lines need fixing in the file before anything can be added.');
  });

  test('warnings point at things worth a look without blocking', ({}, ti) => {
    node(ti);
    const r = P.checkFile(HEAD
      + 'SYNTHETIC Loss,,SYN-L,3,2,4,active,\n'
      + 'SYNTHETIC No Cost,,SYN-N,10,5,,active,\n'
      + 'SYNTHETIC Pricey,,SYN-P,"1,250.00",600,10,active,\n'
      + 'SYNTHETIC Later,,SYN-Q,,,,,\n'
      + 'SYNTHETIC Loss,,SYN-L2,3,2,1,active,\n');
    const w = Object.fromEntries(r.rows.map(x => [x.line, x.warnings.join(' | ')]));
    expect(w[2]).toMatch(/retail price is below cost.*wholesale price is below cost/);
    expect(w[3]).toMatch(/no cost/);
    expect(w[4]).toMatch(/\$1,250\.00 is unusually high/);
    expect(w[5]).toMatch(/no status: added as draft.*no retail price yet/);
    expect(w[6]).toMatch(/same name as line 2/);
    expect(r.counts).toMatchObject({ error: 0, new: 5 });
  });

  test('products already in the dashboard: identical ones are skipped, different ones are listed and never changed', ({}, ti) => {
    node(ti);
    const existing = [
      { id: 'p1', sku: 'syn-lav-8oz', name: 'SYNTHETIC Lavender Body Lotion 8 oz', status: 'active', cost: '4.5', retail_price: '24', wholesale_price: '12', packaging_info: '8 oz glass jar' },
      { id: 'p2', sku: 'SYN-HONEY-4OZ', name: 'SYNTHETIC Honey Milk Cream 4 oz', status: 'active', cost: 3.1, retail_price: 17.5, wholesale_price: 9.25, packaging_info: 'tube' },
      { id: 'p3', sku: 'SYN-OLD', name: 'SYNTHETIC Cocoa Butter 8 oz', status: 'active', retail_price: 20 },
    ];
    const r = P.checkFile(GOOD + 'SYNTHETIC Cocoa Butter,8 oz,SYN-NEW,20,10,3,active,\n', { existing });
    const o = Object.fromEntries(r.rows.map(x => [x.line, x]));
    expect(o[2].outcome).toBe('SAME');
    expect(o[3].outcome).toBe('DIFFERS');
    expect(o[3].differences.join(' | ')).toMatch(/status: active in the dashboard.*retail price: \$17\.50 in the dashboard/);
    expect(o[4].outcome).toBe('NEW');
    expect(o[4].warnings.join(' ')).toMatch(/already in the dashboard under SKU SYN-OLD/);
    expect(r.ready.map(p => p.sku)).toEqual(['SYN-NEW']);
    expect(r.summary).toBe('1 product ready to add. 1 is already in the dashboard, unchanged. 1 is already in the dashboard with other details (not changed by the import).');
  });

  test('suggested SKUs are used only when asked, never collide, and avoid SKUs already in use', ({}, ti) => {
    node(ti);
    const csv = HEAD + 'SYNTHETIC Rose Lotion,8 oz,,10,5,1,active,\nSYNTHETIC Rose Lotion,8 oz,,10,5,1,active,\n';
    const off = P.checkFile(csv);
    expect(off.counts.error).toBe(2);
    const on = P.checkFile(csv, { useSuggestedSkus: true, existing: [{ sku: 'HE-SYNTHETIC-ROSE-LOTION-8OZ', name: 'other' }] });
    expect(on.rows.map(x => x.product.sku)).toEqual(['HE-SYNTHETIC-ROSE-LOTION-8OZ-2', 'HE-SYNTHETIC-ROSE-LOTION-8OZ-3']);
    expect(on.rows[0].warnings[0]).toMatch(/SKU suggested: .*use the same SKU in Shopify/);
    expect(on.counts.error).toBe(0);
    expect(P.suggestSku('Lavender Body Lotion', '8 oz')).toBe('HE-LAVENDER-BODY-LOTION-8OZ');
    expect(P.suggestSku('  ', '')).toBe('');
    expect(P.suggestSku('Health Endeavors Whipped Shea Butter With Vanilla And Honey', '16 fl. oz.').length).toBeLessThanOrEqual(32);
  });

  test('a row without a SKU that is already in the dashboard is matched by name, never added a second time', ({}, ti) => {
    node(ti);
    const existing = [{ sku: 'HE-SYNTHETIC-ROSE-8OZ', name: 'SYNTHETIC Rose 8 oz', status: 'active', retail_price: 10, wholesale_price: 5, cost: 1 }];
    const csv = HEAD + 'SYNTHETIC Rose,8 oz,,10,5,1,active,\n';
    expect(P.checkFile(csv, { existing }).rows[0].problems).toEqual(['no SKU (this product is already in the dashboard as HE-SYNTHETIC-ROSE-8OZ)']);
    const r = P.checkFile(csv, { existing, useSuggestedSkus: true });
    expect(r.rows[0].outcome).toBe('SAME');
    expect(r.ready).toEqual([]);
  });

  test('spreadsheet quirks: other column names, quotes, commas in names, Windows line ends, a byte-order mark', ({}, ti) => {
    node(ti);
    const csv = '﻿Product Name,SKU,Retail Price,Wholesale Price,Unit Cost,Selling now,Notes\r\n'
      + '"SYNTHETIC Lotion, Unscented ""Sensitive""",SYN-U,12,6,2,yes,hello\r\n\r\n,,,,,,\r\n';
    const r = P.checkFile(csv);
    expect(r.ok).toBe(true);
    expect(r.ignoredColumns).toEqual(['Notes']);
    expect(r.ready).toEqual([{ name: 'SYNTHETIC Lotion, Unscented "Sensitive"', sku: 'SYN-U', status: 'active', cost: 2, retail_price: 12, wholesale_price: 6, packaging_info: null }]);
  });

  test('wrong files are refused with one sentence, never half-read', ({}, ti) => {
    node(ti);
    expect(P.checkFile('').reason).toBe('the file is empty');
    expect(P.checkFile('sku,price\nA,1\n').reason).toMatch(/at least a "name" column/);
    expect(P.checkFile(HEAD).reason).toBe('the file has the column names but no products');
    expect(P.checkFile(null).reason).toMatch(/could not be read/);
    expect(P.checkFile('x'.repeat(P.MAX_BYTES + 1)).reason).toMatch(/larger than 1 MB/);
    const many = HEAD + Array.from({ length: P.MAX_ROWS + 1 }, (_, i) => 'SYN ' + i + ',,SYN-' + i + ',1,1,1,active,').join('\n');
    expect(P.checkFile(many).reason).toMatch(/more than 500 products/);
    // a giant cell is refused quickly, not parsed
    const t0 = Date.now();
    const r = P.checkFile(HEAD + 'SYN,,SYN-1,' + '9'.repeat(100000) + ',1,1,active,\n');
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(r.rows[0].problems.join(' ')).toMatch(/retail price is not an amount/);
  });

  test('the saved checked list cannot run formulas when opened in a spreadsheet', ({}, ti) => {
    node(ti);
    const r = P.checkFile(HEAD + '=HYPERLINK("http://example.invalid"),,SYN-X,1,1,1,active,@SUM(A1)\n');
    const out = P.toCsv(r);
    expect(out).toContain("'=HYPERLINK(http://example.invalid)");
    expect(out).toContain("'@SUM(A1)");
    expect(out.split('\r\n')[0]).toBe('﻿line,outcome,name,sku,status,retail_price,wholesale_price,cost,packaging,problems,warnings');
  });

  // Nov 28 (launch plan day 4): the same checked list as Shopify's product import file, typed once.
  test('Save for Shopify: one row per product with the same SKU and price; drafts unpublished; discontinued left out', ({}, ti) => {
    node(ti);
    const r = P.checkFile(GOOD + 'SYNTHETIC Lavender Body Lotion,8 oz,SYN-LAV-8OZ-B,24,12,4.5,draft,\nSYNTHETIC Old,,SYN-OLD,5,,,discontinued,\n');
    const s = P.toShopifyCsv(r);
    expect(s).toMatchObject({ ok: true, count: 3, left_out: 1 });
    const lines = s.csv.replace(/^﻿/, '').split('\r\n').filter(Boolean).map(l => l.split(','));
    expect(lines[0]).toEqual(P.SHOPIFY_HEAD);
    const col = (row, name) => row[P.SHOPIFY_HEAD.indexOf(name)];
    const lav = lines[1], honey = lines[2], lav2 = lines[3];
    expect([col(lav, 'Handle'), col(lav, 'Title'), col(lav, 'Variant SKU'), col(lav, 'Variant Price'), col(lav, 'Cost per item'), col(lav, 'Published'), col(lav, 'Status')])
      .toEqual(['synthetic-lavender-body-lotion-8-oz', 'SYNTHETIC Lavender Body Lotion 8 oz', 'SYN-LAV-8OZ', '24.00', '4.5', 'TRUE', 'active']);
    // "later" is read as draft by the checker: in Shopify it stays unpublished
    expect([col(honey, 'Variant SKU'), col(honey, 'Variant Price'), col(honey, 'Published'), col(honey, 'Status')]).toEqual(['SYN-HONEY-4OZ', '18.50', 'FALSE', 'draft']);
    // two products with the same name get different handles, never one product with two SKUs
    expect(col(lav2, 'Handle')).toBe('synthetic-lavender-body-lotion-8-oz-2');
    // Shopify refuses a sale when its own count is zero, tracks stock, and the product ships
    for (const row of lines.slice(1)) {
      expect([col(row, 'Variant Inventory Tracker'), col(row, 'Variant Inventory Policy'), col(row, 'Variant Requires Shipping'), col(row, 'Option1 Value')])
        .toEqual(['shopify', 'deny', 'TRUE', 'Default Title']);
    }
    expect(s.csv).not.toContain('SYN-OLD');
  });

  test('Save for Shopify refuses a list with any line to fix, and never writes a formula', ({}, ti) => {
    node(ti);
    const bad = P.checkFile(HEAD + 'SYNTHETIC Rose,8 oz,,10,15,1,active,\n');
    expect(P.toShopifyCsv(bad)).toMatchObject({ ok: false, count: 0 });
    expect(P.toShopifyCsv(bad).reason).toMatch(/Fix the lines marked in red first/);
    expect(P.toShopifyCsv(null).ok).toBe(false);
    // Shopify reads values literally: the title arrives exactly as typed (quoted, never with a stray
    // apostrophe, which would show in the store); the dashboard's own spreadsheet copy keeps its formula guard
    const checked = P.checkFile(HEAD + '@SUM(A1) Cream,,SYN-F,1,1,1,active,\n-Sale Cream,,SYN-G,2,1,1,active,\n');
    const f = P.toShopifyCsv(checked);
    expect(f.ok).toBe(true);
    expect(f.csv).toContain(',"@SUM(A1) Cream",');
    expect(f.csv).toContain(',"-Sale Cream",');
    expect(f.csv).not.toContain("'@SUM");
    expect(f.csv).not.toContain("'-Sale");
    expect(P.toCsv(checked)).toContain("'@SUM(A1) Cream");
  });
});

// ---- the Inventory screen ----------------------------------------------------------
async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_product_import', 'on'); } catch (e) {} }); }
const file = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });
const productWrites = (backend) => backend.tableWrites().filter(w => w.table === 'products');

test.describe('the Inventory screen', () => {
  test('switch OFF (the default): Inventory is unchanged', async ({ page }) => {
    await login(page); await gotoPage(page, 'inventoryPanel');
    await expect(page.locator('#productImportHost')).toBeEmpty();
  });

  test('a file with mistakes: every line is shown with its reason, and nothing can be added', async ({ page, backend }) => {
    await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
    const host = page.locator('#productImportHost');
    await expect(host.locator('h3')).toHaveText('Import a product list');
    await host.locator('#piFile').setInputFiles(file('my-products.csv', HEAD + 'SYNTHETIC Rose,8 oz,,10,15,1,active,\nSYNTHETIC Mint,,SYN-MINT,9,4,1,active,\n'));
    await expect(host.locator('[data-pisummary]')).toHaveText('1 line needs fixing in the file before anything can be added.');
    const bad = host.locator('tr[data-piline="2"]');
    await expect(bad).toHaveAttribute('data-pioutcome', 'ERROR');
    await expect(bad).toContainText('Fix: no SKU (suggestion: HE-SYNTHETIC-ROSE-8OZ)');
    await expect(bad).toContainText('Fix: the wholesale price ($15.00) is higher than the retail price ($10.00)');
    await expect(host.locator('tr[data-piline="3"]')).toHaveAttribute('data-pioutcome', 'NEW');
    await expect(host.locator('button[data-pi="add"]')).toBeDisabled();
    await expect(host.locator('[data-pimessage]')).toContainText('my-products.csv was read in this browser. Nothing was added.');
    expect(await host.evaluate(unnamedControls)).toEqual([]);
    expect(productWrites(backend)).toEqual([]);
  });

  test('a correct file: Add adds exactly the new products, once; running the same file again adds nothing', async ({ page, backend }) => {
    backend.tables.products = [{ id: 'p-old', sku: 'SYN-OLD', name: 'SYNTHETIC Old 8 oz', status: 'active', cost: 1, retail_price: 10, wholesale_price: 5, packaging_info: null, is_active: true }];
    await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
    const host = page.locator('#productImportHost');
    const csv = GOOD + 'SYNTHETIC Old,8 oz,SYN-OLD,10,5,1,active,\nSYNTHETIC Rose,8 oz,,10,5,1,active,\n';
    await host.locator('#piFile').setInputFiles(file('products.csv', csv));
    await expect(host.locator('[data-pisummary]')).toHaveText('1 line needs fixing in the file before anything can be added.');
    // the owner accepts the suggested SKU for the row without one
    await host.locator('input[data-pi="suggest"]').check();
    await expect(host.locator('[data-pisummary]')).toHaveText('3 products ready to add. 1 is already in the dashboard, unchanged.');
    await expect(host.locator('tr[data-piline="5"]')).toContainText('HE-SYNTHETIC-ROSE-8OZ');
    await expect(host.locator('tr[data-piline="4"]')).toHaveAttribute('data-pioutcome', 'SAME');
    expect(productWrites(backend)).toEqual([]);
    await host.locator('button[data-pi="add"]').click();
    await expect(host.locator('[data-pimessage]')).toContainText('3 products added.');
    const w = productWrites(backend);
    expect(w.map(x => x.method)).toEqual(['POST', 'POST', 'POST']);
    expect(w.map(x => x.body.sku)).toEqual(['SYN-LAV-8OZ', 'SYN-HONEY-4OZ', 'HE-SYNTHETIC-ROSE-8OZ']);
    expect(w[0].body).toMatchObject({ name: 'SYNTHETIC Lavender Body Lotion 8 oz', status: 'active', retail_price: 24, wholesale_price: 12, cost: 4.5, packaging_info: '8 oz glass jar' });
    expect(w[0].body.created_by).toBeTruthy();
    expect(backend.tableWrites().filter(x => x.table !== 'products')).toEqual([]);
    // the database now has them (the mock records inserts but does not store them)
    backend.tables.products.push(...w.map((x, i) => Object.assign({ id: 'p-new-' + i, is_active: true }, x.body)));
    await host.locator('#piFile').setInputFiles(file('products.csv', csv));
    // (the suggestion box is still ticked: the row without a SKU is matched by name to the product
    // added a moment ago, never given a second, new SKU)
    await expect(host.locator('[data-pisummary]')).toHaveText(/Nothing new to add\. 4 are already in the dashboard, unchanged\./);
    await expect(host.locator('tr[data-piline="5"]')).toContainText('matched by name to HE-SYNTHETIC-ROSE-8OZ');
    await expect(host.locator('button[data-pi="add"]')).toBeDisabled();
    expect(productWrites(backend).length).toBe(3);
  });

  test('a product added meanwhile by someone else is counted as already there, not added twice', async ({ page, backend }) => {
    await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
    await page.route('**/rest/v1/products*', (route) => {
      if (route.request().method() === 'POST' && /SYN-HONEY-4OZ/.test(route.request().postData() || '')) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "products_sku_unique_idx"' }) });
      }
      return route.fallback();
    });
    const host = page.locator('#productImportHost');
    await host.locator('#piFile').setInputFiles(file('products.csv', GOOD));
    await host.locator('button[data-pi="add"]').click();
    await expect(host.locator('[data-pimessage]')).toContainText('1 product added. 1 already existed and were left as they were.');
  });

  test('only the owner or an administrator can import', async ({ page, backend }) => {
    backend.tables.profiles.find(p => p.role === 'owner').role = 'employee';
    await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
    await expect(page.locator('#productImportHost')).toContainText('Only the owner or an administrator can import products.');
    await expect(page.locator('#productImportHost input[type="file"]')).toHaveCount(0);
  });

  test('the template downloads, and the checked list can be saved', async ({ page }) => {
    await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
    const host = page.locator('#productImportHost');
    const [dl] = await Promise.all([page.waitForEvent('download'), host.locator('button[data-pi="template"]').click()]);
    expect(dl.suggestedFilename()).toBe('product-list-template.csv');
    const body = require('fs').readFileSync(await dl.path(), 'utf8');
    expect(body).toBe(P.templateCsv());
    await host.locator('#piFile').setInputFiles(file('products.csv', GOOD));
    const [dl2] = await Promise.all([page.waitForEvent('download'), host.locator('button[data-pi="save"]').click()]);
    expect(dl2.suggestedFilename()).toBe('product-list-checked.csv');
    // Nov 28: the same checked list saved as Shopify's import file; nothing is sent anywhere
    const [dl3] = await Promise.all([page.waitForEvent('download'), host.locator('button[data-pi="shopify"]').click()]);
    expect(dl3.suggestedFilename()).toBe('products-for-shopify.csv');
    expect(require('fs').readFileSync(await dl3.path(), 'utf8')).toBe(P.toShopifyCsv(P.checkFile(GOOD)).csv);
    await expect(host.locator('[data-pimessage]')).toContainText('Saved products-for-shopify.csv with 2 products. In Shopify: Products → Import');
    await expect(host.locator('[data-pimessage]')).toContainText('Nothing was sent to Shopify.');
    await host.locator('#piFile').setInputFiles(file('bad.csv', HEAD + 'SYNTHETIC Rose,8 oz,,10,15,1,active,\n'));
    await expect(host.locator('button[data-pi="shopify"]')).toHaveCount(0);   // not offered while a line needs fixing
    await host.locator('button[data-pi="clear"]').click();
    await expect(host.locator('[data-pimessage]')).toHaveText('The file was forgotten. Nothing was added.');
    await expect(host.locator('table')).toHaveCount(0);
  });

  test('at phone size the results fit the screen, even with long names and notes', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
    const long = 'SYNTHETIC ' + 'Very Long Product Name '.repeat(4);
    await page.locator('#piFile').setInputFiles(file('p.csv', HEAD + long + ',8 oz,' + 'X'.repeat(45) + ',10,15,1,maybe,' + 'jar '.repeat(30) + '\n'));
    await expect(page.locator('#productImportHost [data-pisummary]')).toHaveText(/needs fixing/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
