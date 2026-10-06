// Output escaping across the whole owner dashboard (R6, broad version).
// Every free-text field in the synthetic data gets a hostile HTML payload
// appended; then every page is opened, record search and the ⌘K palette are
// used, and the Record Inspector history is shown. If any page ever put
// database text into the page as HTML, the payload would create an element or
// run code. Neither may happen. (PR #7 covers search.html and dashboard.html.)

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

const PAYLOAD = '"\'><img src=x id=xss-img onerror="window.__xss=(window.__xss||0)+1"><svg onload="window.__xss=(window.__xss||0)+1"></svg>';
const TEXT_FIELD = /name|title|description|summary|notes?$|reason|label|text|vendor|resolution|reply|question|reference|comment|detail|desc$|category_label|full_name|display_name/i;

function poison(value) {
  if (Array.isArray(value)) return value.map(poison);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = (typeof v === 'string' && TEXT_FIELD.test(k)) ? v + PAYLOAD : poison(v);
    }
    return out;
  }
  return value;
}

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

test('no database text is ever rendered as HTML, on any page', async ({ page, backend }, testInfo) => {
  test.setTimeout(180000);
  seedBusiness(backend);
  // Hostile text even in status columns the real database restricts:
  // escaping must not rely on those rules (defence in depth).
  backend.allowImpossibleData = true;
  for (const table of Object.keys(backend.tables)) backend.tables[table] = poison(backend.tables[table]);
  for (const name of Object.keys(backend.rpc)) backend.rpc[name] = poison(backend.rpc[name]);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');

  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  expect(ids.length).toBeGreaterThan(20);
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
  }
  // Record search (sidebar) and the ⌘K palette, with text that matches the poisoned fields.
  await gotoPage(page, 'tasksPanel');
  await page.fill('#sidebarSearch', 'SYNTHETIC');
  await page.waitForTimeout(300);
  await page.fill('#sidebarSearch', '');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('SYNTHETIC');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');

  expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
  expect(await page.locator('#xss-img, svg[onload]').count()).toBe(0);
  // The payload text is visible as text somewhere (so the test did reach the rendering).
  await expect(page.locator('body')).toContainText('onerror=');
});

test('control: the same check catches a broken escape (esc made a no-op)', async ({ page, backend }) => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'assets', 'owner-login-helpers.js'), 'utf8')
    .replace(/function esc\(s\)\{[\s\S]*?\n    \}/, 'function esc(s){ return s === null || s === undefined ? "" : String(s); }');
  await page.route('**/assets/owner-login-helpers.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
  seedBusiness(backend);
  // Hostile text even in status columns the real database restricts:
  // escaping must not rely on those rules (defence in depth).
  backend.allowImpossibleData = true;
  for (const table of Object.keys(backend.tables)) backend.tables[table] = poison(backend.tables[table]);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await expect.poll(() => page.evaluate(() => window.__xss || 0)).toBeGreaterThan(0);
});

// Second payload family (2026-10-06): script tags, javascript: links, closing
// textarea/title, an injected style block, HTML entities that must stay
// literal, a right-to-left override and a very long value. Same walk as above.
const PAYLOAD2 = '</textarea></title><script>window.__xss=(window.__xss||0)+1</script>' +
  '<a id="xss-a" href="javascript:window.__xss=1">x</a><b id="xss-b">bold</b>' +
  '<style id="xss-style">body{display:none!important}</style>&lt;i&gt;&amp;amp;‮evil' + 'L'.repeat(2000);

const NOT_TEXT = /^id$|_id$|^uid$|_uid$|_at$|date|_on$|^at$|^ts$|^day$|^month$|^week$/i;
function poison2(value) {
  if (Array.isArray(value)) return value.map(poison2);
  if (value && typeof value === 'object') {
    const out = {};
    // every text field except ids and dates: also errors, SKUs, e-mails, lot /
    // order numbers, locations, links and status words
    for (const [k, v] of Object.entries(value)) out[k] = (typeof v === 'string' && !NOT_TEXT.test(k)) ? v + PAYLOAD2 : poison2(v);
    return out;
  }
  return value;
}

test('script tags, javascript: links, style blocks and entities stay text on every page (every text field)', async ({ page, backend }) => {
  test.setTimeout(180000);
  seedBusiness(backend);
  backend.allowImpossibleData = true;
  for (const table of Object.keys(backend.tables)) backend.tables[table] = poison2(backend.tables[table]);
  for (const name of Object.keys(backend.rpc)) backend.rpc[name] = poison2(backend.rpc[name]);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    expect(await page.locator('#xss-a, #xss-b, #xss-style').count(), 'injected element on ' + id).toBe(0);
  }
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('SYNTHETIC');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
  await expect(page.locator('body')).toBeVisible(); // the style block did not apply
  await expect(page.locator('body')).toContainText('&lt;i&gt;'); // entities shown literally, not decoded
});
