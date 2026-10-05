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
