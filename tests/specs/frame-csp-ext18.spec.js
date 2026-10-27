// EXT18: clickjacking guard, the narrowed script policy and the no-script fallback.
//   1. Each page opened inside another site's frame hides itself (or takes over
//      the whole window), so it cannot be overlaid to trick a click.
//   2. Scripts may come only from this site and the ONE pinned library file:
//      another package on the same CDN is refused. A control run with the old
//      whole-CDN policy shows the same script would have run.
//   3. If the scripts never load, submitting the sign-in form sends nothing:
//      no email or password in the address.
// Limitation (documented in DOM_CSP_SECURITY_EXT18.md): a frame with the sandbox
// attribute and no allow-scripts stops the guard from running. The real fix is a
// frame-ancestors header, which GitHub Pages cannot send.
const fs = require('fs');
const path = require('path');
const { test, expect, login } = require('../helpers/dashboard');
const ROOT = path.join(__dirname, '..', '..');
const PAGES = ['owner-login.html', 'change-password.html', 'dashboard.html', 'index.html', 'manual-order-entry.html', 'search.html'];

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'per page, not per screen size; once'); });
// Four smaller pages ask Google Fonts for their typeface (allowed by their policy,
// recorded in SUPPLY_CHAIN_SECURITY_EXT18.md); the mock refuses it, as elsewhere.
test.afterEach(({ backend }) => { backend.blocked = backend.blocked.filter(u => !u.startsWith('https://fonts.googleapis.com/')); });

test('every page inside a hostile frame hides itself or takes over the window', async ({ page }) => {
  for (const p of PAGES) {
    await page.route('http://evil.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>evil</title><iframe id="f" src="http://dashboard.test/${p}" width="1000" height="700"></iframe>` }));
    await page.goto('http://evil.test/');
    await expect.poll(async () => {
      if (page.url().startsWith('http://dashboard.test/')) return 'escaped';
      const fr = page.frames().find(f => f.url().includes('dashboard.test/' + p));
      if (!fr) return 'no frame yet';
      return fr.evaluate(() => getComputedStyle(document.documentElement).display).catch(() => 'loading');
    }, { message: p }).toMatch(/^(escaped|none)$/);
    if (!page.url().startsWith('http://dashboard.test/')) {
      const fr = page.frames().find(f => f.url().includes('dashboard.test/' + p));
      // nothing in the framed page can be seen, so nothing can be clicked
      expect(await fr.evaluate(() => [...document.querySelectorAll('input, button, a')].filter(e => e.getClientRects().length).length), p).toBe(0);
    }
    await page.unroute('http://evil.test/**');
  }
});

test('the same pages opened normally are not hidden by the guard', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto('/' + p);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).display), p).not.toBe('none');
  }
});

async function tryOtherCdnPackage(page) {
  return page.evaluate(async () => {
    window.__cdnPwn = 0;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/evil-package@1.0.0/x.js';
    document.body.appendChild(s);
    await new Promise(r => { s.onload = s.onerror = r; setTimeout(r, 1500); });
    return window.__cdnPwn;
  });
}

test('another package on the same CDN is refused by the policy', async ({ page, backend }) => {
  const cdnHits = [];
  await page.route('https://cdn.jsdelivr.net/npm/evil-package@**', r => { cdnHits.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: 'window.__cdnPwn = 1;' }); });
  const v = [];
  await page.exposeFunction('__cspV', x => v.push(x));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspV(e.violatedDirective + ' ' + e.blockedURI)));
  await login(page);
  expect(await tryOtherCdnPackage(page)).toBe(0);
  expect(cdnHits, 'the browser must not even fetch it').toEqual([]);
  expect(v.some(x => /^script-src.*evil-package/.test(x))).toBe(true);
  expect(backend.cdnRequests.length, 'the pinned library itself still loads').toBeGreaterThan(0);
});

test('control: with the old whole-CDN policy the same script WOULD run (the test can fail)', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/evil-package@**', r => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: 'window.__cdnPwn = 1;' }));
  const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  const old = html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[0-9.]+\/dist\/umd\/supabase\.js;/, 'https://cdn.jsdelivr.net;');
  expect(old).not.toBe(html);
  await page.route('http://dashboard.test/owner-login.html', r => r.fulfill({ status: 200, contentType: 'text/html', body: old }));
  await page.goto('/owner-login.html');
  expect(await tryOtherCdnPackage(page)).toBe(1);
});

test('with scripts unavailable, submitting the sign-in forms puts nothing in the address', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://dashboard.test' });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.origin !== 'http://dashboard.test') return r.abort();
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : (f.endsWith('.css') ? 'text/css' : 'application/octet-stream'), body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  // change-password.html keeps its sign-in form hidden until its script runs, so
  // without scripts there is nothing to submit; its fields have no name either
  // (checked for every page by static-security.js).
  for (const [p, email, pw] of [['owner-login.html', '#email', '#password']]) {
    await page.goto('/' + p);
    await page.fill(email, 'owner@example.test');
    await page.fill(pw, 'Synthetic-Pass-123');
    await Promise.all([page.waitForLoadState('load'), page.locator(pw).press('Enter')]);
    const url = decodeURIComponent(page.url());
    expect(url, p).not.toContain('Synthetic-Pass-123');
    expect(url, p).not.toContain('owner@example.test');
  }
  await ctx.close();
});
