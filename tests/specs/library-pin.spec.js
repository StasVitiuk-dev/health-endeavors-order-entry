// R7: the Supabase library is pinned to one exact version with Subresource
// Integrity on every page. If the CDN ever served different bytes, the browser
// refuses to run them and the page shows its "library did not load" message
// instead of running altered code that holds staff sessions.

const fs = require('fs');
const path = require('path');
const { test, expect, login } = require('../helpers/dashboard');

const PAGES = ['owner-login.html', 'change-password.html', 'dashboard.html', 'index.html', 'manual-order-entry.html', 'search.html'];
const PINNED = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
const SRI = 'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';
const ROOT = path.resolve(__dirname, '..', '..');

test.describe('every page loads one pinned, integrity-checked copy of the library', () => {
  for (const file of PAGES) {
    test(`${file}: exact version, integrity hash, crossorigin and an onerror flag`, async () => {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const tags = [...html.matchAll(/<script[^>]+supabase-js[^>]*>/g)].map(m => m[0]);
      expect(tags).toHaveLength(1);
      expect(tags[0]).toContain(`src="${PINNED}"`);
      expect(tags[0]).toContain(`integrity="${SRI}"`);
      expect(tags[0]).toContain('crossorigin="anonymous"');
      expect(tags[0]).toContain('onerror="window.__sbLoadFailed=true"');
      expect(html).not.toMatch(/supabase-js@2["']/); // no floating "@2" left anywhere
    });
  }

  test('the hash matches the exact file the tests (and package-lock) use', async () => {
    const crypto = require('crypto');
    const bytes = fs.readFileSync(path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'));
    expect('sha384-' + crypto.createHash('sha384').update(bytes).digest('base64')).toBe(SRI);
    expect(require('@supabase/supabase-js/package.json').version).toBe('2.117.2');
  });
});

test('owner dashboard: the pinned library loads and login works', async ({ page, backend }) => {
  await login(page);
  expect(backend.cdnRequests).toEqual([PINNED]);
});

for (const file of PAGES) {
  test(`${file}: the library loads with no integrity error`, async ({ page, backend }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' && /integrity|supabase/i.test(m.text())) errors.push(m.text()); });
    await page.goto('/' + file);
    await expect.poll(() => page.evaluate(() => typeof window.supabase)).toBe('object');
    expect(errors).toEqual([]);
    expect(backend.cdnRequests).toContain(PINNED);
    // The older pages also ask Google Fonts for a typeface; the mock blocks
    // that (nothing leaves the test browser). Unrelated to this test.
    backend.blocked = backend.blocked.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
  });
}

test('owner dashboard: altered library bytes are refused and the page says the library did not load', async ({ page, backend }) => {
  backend.cdnBody = '/* tampered */ window.supabase = { createClient: () => { window.__tamperedRan = true; } };';
  await page.goto('/owner-login.html');
  await expect(page.locator('body')).toContainText('library did not load');
  expect(await page.evaluate(() => window.__tamperedRan === true)).toBe(false);
  expect(await page.evaluate(() => typeof window.supabase)).toBe('undefined');
});

test('change-password page: altered library bytes are refused and the page says so', async ({ page, backend }) => {
  backend.cdnBody = '/* tampered */ window.supabase = { createClient: () => ({}) };';
  await page.goto('/change-password.html');
  await expect(page.locator('#scriptError')).toContainText("couldn't load a required file");
});
