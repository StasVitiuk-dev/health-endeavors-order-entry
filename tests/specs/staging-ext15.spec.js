// EXT15 staging: four new scenarios, scenario isolation, reproducible builds and
// the output firewall. Built into a temp folder, served for a made-up address
// with every other address refused (offline); nothing is published.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');
const BUILD = path.join(ROOT, 'tests', 'tools', 'staging', 'build-staging.js');
const ORIGIN = 'http://staging-review.test';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' };
let OUT;
test.beforeAll(() => { OUT = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'he-staging15-')), 'build'); execFileSync(process.execPath, [BUILD, OUT, '--offline']); });
test.afterAll(() => { if (OUT) fs.rmSync(path.dirname(OUT), { recursive: true, force: true }); });

async function open(page, scenario) {
  await page.context().route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== ORIGIN) return route.abort();
    const rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1));
    const file = path.join(OUT, rel);
    if (!file.startsWith(OUT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(ORIGIN + '/?scenario=' + scenario);
  await page.locator('#stagingSignIn').click();
  await expect(page.locator('#dash')).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return errors;
}
const go = (page, id) => page.evaluate(p => { location.hash = '#page=' + p; }, id);
const events = page => page.evaluate(() => window.__STAGING_EVENTS);

test.describe('new scenarios', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'staging scenarios; once'); });

  test('session-expired: after sign-in every read is refused and the page says to sign in again, never zeros', async ({ page }) => {
    await open(page, 'session-expired');
    await page.waitForTimeout(1700);
    await go(page, 'tasksPanel');
    await go(page, 'attentionPanel');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#dashError')).toContainText(/expired|sign in/i, { timeout: 15000 });
    expect((await events(page)).some(e => /^expired GET/.test(e))).toBe(true);
  });

  test('switch-drift: System status shows the switch is ON while its database function is missing', async ({ page }) => {
    await open(page, 'switch-drift');
    await go(page, 'continuityPanel');
    await expect(page.locator('#systemStatusWrap')).toContainText(/PROBLEM: switched ON but its database step is missing/, { timeout: 20000 });
    expect((await events(page)).some(e => /missing function/.test(e))).toBe(true);
  });

  test('nightly-stale: the Home card says STALE, not passed', async ({ page }) => {
    await open(page, 'nightly-stale');
    const card = page.locator('#nightlyCheckWrap .nightlyCard');
    await expect(card).toHaveAttribute('data-state', 'STALE', { timeout: 15000 });
  });

  test('return-reply-lost: the save happens, its reply is lost, and the page does not claim a failure that did not happen', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await open(page, 'return-reply-lost');
    await go(page, 'returnsPanel');
    const btn = page.locator('#returnsPanel button', { hasText: /received/i }).first();
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
    await page.locator('#returnsPanel button', { hasText: /confirm|yes|received/i }).first().click({ timeout: 3000 }).catch(() => {});
    await expect.poll(() => events(page), { timeout: 15000 }).toContain('reply-lost returns');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Nothing was changed, so it is safe to try again/);
  });
});

test('switching scenarios starts from a fresh synthetic state (no carry-over)', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  await open(page, 'switch-drift');
  expect((await page.evaluate(() => window.__STAGING_SCENARIO))).toBe('switch-drift');
  await page.locator('#stagingScenario').selectOption('healthy');
  await expect(page).toHaveURL(/scenario=healthy/);
  await page.locator('#stagingSignIn').click();
  await expect(page.locator('#dash')).toBeVisible({ timeout: 15000 });
  expect(await events(page)).toEqual([]);
  await go(page, 'continuityPanel');
  await expect(page.locator('#systemStatusWrap')).not.toContainText('PROBLEM', { timeout: 15000 });
});

test.describe('build properties', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'file checks; once'); });

  test('reproducible: two builds produce byte-identical files', () => {
    const other = path.join(path.dirname(OUT), 'again');
    execFileSync(process.execPath, [BUILD, other, '--offline']);
    const hashes = dir => { const out = {}; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out[path.relative(dir, f)] = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } })(dir); return out; };
    const a = hashes(OUT), b = hashes(other);
    expect(Object.keys(a).length).toBeGreaterThan(20);
    expect(b).toEqual(a);
  });

  test('firewall: a build whose output would carry a backups path or a privileged key deletes itself and fails', () => {
    // negative control on a copy of the tools with a planted trace in a page file
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'he-fw-'));
    fs.cpSync(path.join(ROOT, 'tests'), path.join(tmp, 'tests'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'assets'), path.join(tmp, 'assets'), { recursive: true });
    for (const f of ['owner-login.html']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
    fs.appendFileSync(path.join(tmp, 'assets', 'app', 'he-config.js'), '\n// health-endeavors-backups\n');
    const out = path.join(tmp, 'out');
    let failed = '';
    try { execFileSync(process.execPath, [path.join(tmp, 'tests', 'tools', 'staging', 'build-staging.js'), out], { stdio: 'pipe' }); } catch (e) { failed = String(e.stderr || e.message); }
    expect(failed).toMatch(/forbidden content in the staging build/);
    expect(fs.existsSync(out)).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
