// EXT8 (workstream O): the STAGING review copy built by
// tests/tools/staging/build-staging.js works on synthetic data only.
//   * no trace of the production database address or key in the output
//   * the page shows the "DEVELOPMENT / STAGING — NOT PRODUCTION" banner
//   * the synthetic-owner button signs in and the pages draw from the seed
//   * the page never asks for any outside address except the pinned
//     Supabase library (served here from node_modules)
// The built files are served for a made-up address; nothing is published.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const UMD = path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const ORIGIN = 'http://staging-review.test';
let OUT;

test.beforeAll(() => {
  OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'he-staging-'));
  execFileSync(process.execPath, [path.join(ROOT, 'tests', 'tools', 'staging', 'build-staging.js'), OUT]);
});
test.afterAll(() => { if (OUT) fs.rmSync(OUT, { recursive: true, force: true }); });

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' };
async function serve(page) {
  const outside = [];
  await page.context().route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN) {
      const rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1));
      const file = path.join(OUT, rel);
      if (!file.startsWith(OUT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    }
    if (u.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(UMD) });
    }
    outside.push(u.href);
    return route.abort();
  });
  return outside;
}

test('the build contains no production address or key', () => {
  for (const f of ['index.html', 'staging-runtime.js']) {
    const text = fs.readFileSync(path.join(OUT, f), 'utf8');
    expect(text).not.toContain('uizrazyehilyzmwttsrn');
    expect(text).not.toContain('sb_publishable_');
    expect(text).toContain('staging-demo.invalid');
  }
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  expect(html).toMatch(/<title>STAGING — /);
  expect(html.indexOf('staging-runtime.js')).toBeLessThan(html.indexOf('cdn.jsdelivr.net/npm/@supabase'));
});

test('banner, synthetic sign-in, seeded pages; nothing outside is contacted', async ({ page }) => {
  const outside = await serve(page);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(ORIGIN + '/');
  await expect(page.locator('#stagingBanner')).toContainText('DEVELOPMENT / STAGING — NOT PRODUCTION');
  await page.locator('#stagingSignIn').click();
  await expect(page.locator('#attnChecksWrap')).toContainText('Backups', { timeout: 15000 });
  // Seed facts show up: a low-stock product and the manual order without items.
  await expect(page.locator('#attnChecksWrap')).toContainText(/low/i);
  await expect(page.locator('#stagingBanner')).toBeVisible();
  await page.evaluate(() => { location.hash = '#page=ordersPanel'; });
  await expect(page.locator('body')).toContainText('SYN-2001', { timeout: 10000 });
  await page.evaluate(() => { location.hash = '#page=tasksPanel'; });
  await expect(page.locator('body')).toContainText('SYNTHETIC Confirm label proof', { timeout: 10000 });
  // The stand-in refuses any outside address even if the page tried one.
  const refused = await page.evaluate(() => fetch('https://example.com/x').then(() => 'reached', e => String(e)));
  expect(refused).toContain('outside address refused');
  expect(outside, 'outside requests').toEqual([]);
  expect(errors).toEqual([]);
});
