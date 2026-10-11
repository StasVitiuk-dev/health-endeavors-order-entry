// EXT14: the private STAGING review artifact (npm run staging:build).
//   * offline build: the pinned Supabase library is bundled (same integrity
//     hash), so the copy works with NO outside address at all
//   * dev-only scenario selector in the banner; ?scenario=<id> picks one
//   * the scenarios that inject failures behave like the real failure would
//     (permission denied, a lost reply on PO receive, a stale task edit)
//   * the output and the zip carry no credential-like text and no production trace
// Built into a temp folder and served for a made-up address; nothing is published.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const ORIGIN = 'http://staging-review.test';
const { SCENARIOS } = require('../tools/staging/staging-seed');
let OUT, ZIP;

test.beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-staging14-'));
  OUT = path.join(dir, 'build');
  ZIP = OUT + '.zip';
  execFileSync(process.execPath, [path.join(ROOT, 'tests', 'tools', 'staging', 'build-staging.js'), OUT, '--offline', '--zip']);
});
test.afterAll(() => { if (OUT) fs.rmSync(path.dirname(OUT), { recursive: true, force: true }); });

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
// Serves ONLY the build. Every other address (the CDN included) is refused.
async function serveOffline(page) {
  const outside = [];
  await page.context().route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== ORIGIN) { outside.push(u.href); return route.abort(); }
    const rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1));
    const file = path.join(OUT, rel);
    if (!file.startsWith(OUT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  return outside;
}
async function open(page, scenario) {
  const outside = await serveOffline(page);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(ORIGIN + '/' + (scenario ? '?scenario=' + scenario : ''));
  await page.locator('#stagingSignIn').click();
  await expect(page.locator('#dash')).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return { outside, errors };
}
const go = (page, id) => page.evaluate(p => { location.hash = '#page=' + p; }, id);

test.describe('build output', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'file checks; run once'); });

  test('offline: library bundled with the page integrity hash kept; no CDN address left', () => {
    const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
    expect(html).toMatch(/<script src="vendor\/supabase\.js" integrity="sha384-[^"]+"/);
    expect(html).not.toContain('<script src="https://cdn.jsdelivr.net');
    expect(html.indexOf('staging-runtime.js')).toBeLessThan(html.indexOf('vendor/supabase.js'));
    expect(fs.readFileSync(path.join(OUT, 'README-STAGING.txt'), 'utf8')).toMatch(/NOT PRODUCTION[\s\S]*do not publish/);
  });

  test('no production trace and no credential-like text in the folder or the zip', () => {
    const scan = execFileSync(process.execPath, [path.join(ROOT, 'tests', 'tools', 'secret-scan.js'), OUT], { encoding: 'utf8' });
    expect(scan).toMatch(/^OK:/m);
    const listing = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' }).split('\n').filter(Boolean);
    for (const f of ['index.html', 'staging-runtime.js', 'vendor/supabase.js', 'README-STAGING.txt', 'assets/owner-login-app.js']) expect(listing).toContain(f);
    const all = execFileSync('unzip', ['-p', ZIP], { maxBuffer: 64 * 1024 * 1024 }).toString('latin1');
    expect(all).not.toContain('uizrazyehilyzmwttsrn');
    // The bundled library mentions the key PREFIXES (it checks key shapes); a real key has a value after them.
    expect(all).not.toMatch(/sb_(publishable|secret)_[A-Za-z0-9_-]{8,}/);
    expect(all).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/);
  });

  test('scenario list: 13 entries, unique ids, every one applies to a fresh seed', () => {
    const S = require('../tools/staging/staging-seed');
    expect(SCENARIOS).toHaveLength(13);
    expect(new Set(SCENARIOS.map(s => s.id)).size).toBe(13);
    for (const s of SCENARIOS) {
      const t = S.stagingTables(Date.parse('2026-10-11T12:00:00Z'));
      expect(S.applyScenario(s.id, t, Date.parse('2026-10-11T12:00:00Z')).scenario.id).toBe(s.id);
    }
    expect(S.applyScenario('no-such-thing', S.stagingTables(0), 0).scenario.id, 'unknown falls back to the default').toBe('default');
  });
});

test('offline: signs in and draws pages with every outside address refused', async ({ page }) => {
  const { outside, errors } = await open(page);
  await expect(page.locator('#stagingBanner')).toContainText('NOT PRODUCTION');
  await go(page, 'ordersPanel');
  await expect(page.locator('body')).toContainText('SYN-2001', { timeout: 10000 });
  expect(outside, 'outside requests').toEqual([]);
  expect(errors).toEqual([]);
});

test('the dev-only selector lists every scenario and switching reloads into it', async ({ page }) => {
  await serveOffline(page);
  await page.goto(ORIGIN + '/');
  const sel = page.locator('#stagingScenario');
  await expect(sel).toHaveAttribute('aria-label', /development only/);
  await expect(sel.locator('option')).toHaveCount(SCENARIOS.length);
  for (const o of await sel.locator('option').allTextContents()) expect(o).toMatch(/^Scenario \(dev only\): /);
  await sel.selectOption('healthy');
  await expect(page).toHaveURL(/\?scenario=healthy$/);
  await expect(page.locator('#stagingScenario')).toHaveValue('healthy');
});

test('integrity-failure scenario: Home shows the nightly check problems', async ({ page }) => {
  await open(page, 'integrity-failure');
  const card = page.locator('#nightlyCheckWrap .nightlyCard');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('data-state', /NOT VERIFIED|UNKNOWN/);
  await expect(card).toContainText(/F14|impossible value/);
});

test('permission-denied scenario: a save is refused and the page says so', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await open(page, 'permission-denied');
  await go(page, 'tasksPanel');
  const row = page.locator('#tasksTableWrap tr[data-id="t1"]');
  await row.getByRole('button', { name: 'Mark in progress' }).click();
  await expect(page.locator('#dashError')).toBeVisible();
  await expect(page.locator('#dashError')).toContainText(/permission|not allowed|refused/i);
  await expect(row).toBeVisible(); // still listed; nothing changed
  expect(await page.evaluate(() => window.__STAGING_EVENTS)).toContain('denied PATCH /rest/v1/tasks');
});

test('stale-edit scenario: the task changed elsewhere first, so the edit is refused', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await open(page, 'stale-edit');
  await go(page, 'tasksPanel');
  await page.locator('#tasksTableWrap tr[data-id="t3"]').getByRole('button', { name: 'Mark in progress' }).click();
  await expect(page.locator('#dashError')).toContainText('already changed');
  expect(await page.evaluate(() => window.__STAGING_EVENTS)).toEqual(['stale-task']);
});

test('po-uncertain scenario: the claim is saved but its reply is lost; the page recognises its own claim', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await open(page, 'po-uncertain');
  await go(page, 'purchaseOrdersPanel');
  await page.locator('.poItem[data-id="po1"] .poRow').click();
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await page.locator('.poReceiveBtn').click();
  await page.locator('.poReceiveBtn').click();
  await expect(page.locator('.poReceiveBtn')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('body')).not.toContainText('Could not receive that delivery');
  expect(await page.evaluate(() => window.__STAGING_EVENTS)).toEqual(['reply-lost purchase_orders']);
});
