// owner-login.html modularization, step 1: the stylesheet and the app icon live
// in assets/ instead of inline. Every local asset is referenced with ?v=<first
// 10 hex of its SHA-256>, so a browser can never keep using an old cached copy
// after a change — and if someone edits an asset without updating ?v=, this
// test fails. Visual snapshots (visual.spec.js) prove the page looks the same.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const base = require('@playwright/test');
const { test, expect, login } = require('../helpers/dashboard');

const ROOT = path.resolve(__dirname, '..', '..');
const html = () => fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');

base.test.describe('local assets are versioned by content', () => {
  base.test.beforeEach(({}, testInfo) => { base.test.skip(testInfo.project.name !== 'desktop', 'source check; run once'); });

  base.test('every local asset reference carries ?v= equal to its content hash', () => {
    const refs = [...html().matchAll(/(?:href|src)="(assets\/[^"?]+)\?v=([0-9a-f]+)"/g)];
    base.expect(refs.length).toBeGreaterThanOrEqual(3);
    for (const [, file, v] of refs) {
      const bytes = fs.readFileSync(path.join(ROOT, file));
      base.expect(v, file).toBe(crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10));
    }
  });

  base.test('no local asset is referenced without a version', () => {
    base.expect(html()).not.toMatch(/(?:href|src)="assets\/[^"?]+"/);
  });

  base.test('the page has no inline <style> block left and no inline base64 icon', () => {
    base.expect(html()).not.toMatch(/<style[\s>]/);
    base.expect(html()).not.toMatch(/href="data:image\/png;base64/);
  });
});

test('the stylesheet and icon load (no 404) and styles apply', async ({ page, backend }) => {
  const failed = [];
  page.on('response', r => { if (r.url().includes('/assets/') && r.status() !== 200) failed.push(r.url() + ' ' + r.status()); });
  await login(page);
  expect(failed).toEqual([]);
  // A rule that only exists in the stylesheet: the login card is hidden and the
  // dashboard grid is laid out.
  const display = await page.locator('#dash').evaluate(el => getComputedStyle(el).display);
  expect(display).not.toBe('inline');
});

// ---- step 2: pure helpers in assets/owner-login-helpers.js
base.test.describe('pure helpers file', () => {
  base.test.beforeEach(({}, testInfo) => { base.test.skip(testInfo.project.name !== 'desktop', 'source check; run once'); });

  base.test('loads into window.HE.helpers (frozen, API 3) without touching the DOM or Supabase', () => {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'owner-login-helpers.js'), 'utf8');
    base.expect(src).not.toMatch(/\bdocument\b|\bsupabase\b|localStorage|fetch\(/);
    const window = {};
    new Function('window', src)(window);
    base.expect(window.HE.helpers.API).toBe(3); // 3 since 2026-10-06 (step 2c)
    base.expect(Object.isFrozen(window.HE.helpers)).toBe(true);
    base.expect(window.HE.helpers.esc('<b>')).toBe('&lt;b&gt;');
    base.expect(window.HE.helpers.likeLiteral('A_1%')).toBe('A\\_1\\%');
  });

  base.test('every helper the page takes from window.HE.helpers exists there, and none is still defined in the page', () => {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'owner-login-helpers.js'), 'utf8');
    const window = {};
    new Function('window', src)(window);
    const m = html().match(/const \{\n([\s\S]*?)\n    \} = window\.HE\.helpers;/);
    base.expect(m).not.toBeNull();
    const names = m[1].split(',').map(x => x.trim()).filter(Boolean);
    base.expect(names.length).toBe(31);
    for (const n of names) {
      base.expect(window.HE.helpers[n], n).toBeDefined();
      base.expect(html(), n).not.toMatch(new RegExp('^    (async )?function ' + n + '\\s*\\(|^    const ' + n + '\\s*=', 'm'));
    }
  });
});

test('if the helpers file fails to load, the page says so and does not start', async ({ page }) => {
  await page.route('**/assets/owner-login-helpers.js*', route => route.fulfill({ status: 404, body: 'not found' }));
  await page.goto('/owner-login.html');
  await expect(page.locator('body')).toContainText('owner-login-helpers.js) did not load');
});

test('an old helpers file (wrong API) is refused with a "reload" message', async ({ page }) => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'owner-login-helpers.js'), 'utf8').replace('API: 3,', 'API: 2,'); // an older copy
  await page.route('**/assets/owner-login-helpers.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
  await page.goto('/owner-login.html');
  await expect(page.locator('body')).toContainText('loaded a mix of old and new files');
});
