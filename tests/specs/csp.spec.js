// EXT8 (workstream H, security review S7): every page carries a
// Content-Security-Policy that lets it load / contact only this site, the
// pinned CDN, the Supabase project (and Google Fonts where used), and the
// pages still work under it (no violation is raised). Synthetic data only.

const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = ['owner-login.html', 'index.html', 'manual-order-entry.html', 'dashboard.html', 'search.html', 'change-password.html'];
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'policy check; run once'); });

for (const f of PAGES) {
  test(`${f}: has a strict policy (no wildcard, no plugins, no frames)`, () => {
    const m = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
    expect(m, 'policy missing').not.toBeNull();
    const csp = m[1];
    expect(csp).not.toMatch(/(^|[\s;])\*([\s;]|$)|https:\s|http:/);
    for (const d of ["default-src 'self'", "object-src 'none'", "frame-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d);
    expect(csp).toMatch(/connect-src 'self' https:\/\/uizrazyehilyzmwttsrn\.supabase\.co wss:\/\/uizrazyehilyzmwttsrn\.supabase\.co;/);
  });
}

async function watchViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
}
const violations = page => page.evaluate(() => window.__cspViolations || []);
// The mock blocks Google Fonts (no outside requests in tests); that is not a policy violation.

test('the dashboard works under its policy: sign in and open several pages, no violation', async ({ page }) => {
  await watchViolations(page);
  await login(page);
  for (const id of ['ordersPanel', 'accountingPanel', 'inventoryPanel', 'tasksPanel']) await gotoPage(page, id);
  expect(await violations(page)).toEqual([]);
});

test('manual order page works under its policy', async ({ page }) => {
  await watchViolations(page);
  await page.goto('/manual-order-entry.html');
  await page.fill('#loginEmail', OWNER_USER.email);
  await page.fill('#loginPassword', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#appView')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

for (const f of ['dashboard.html', 'search.html', 'change-password.html']) {
  test(`${f} loads under its policy with no violation`, async ({ page }) => {
    await watchViolations(page);
    await page.goto('/' + f);
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
  });
}

test.afterEach(({ backend }) => { backend.blocked = backend.blocked.filter(u => !u.startsWith('https://fonts.')); });

// EXT9: referrer policy and frame guard on every page (GitHub Pages cannot
// send X-Frame-Options or frame-ancestors, and frame-ancestors is ignored in a
// meta tag, so the page itself refuses to be framed).
for (const f of PAGES) {
  test(`${f}: sends no referrer and refuses to be framed`, () => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(src).toContain('<meta name="referrer" content="no-referrer">');
    expect(src).toMatch(/<script id="frameGuard">if \(window\.top !== window\.self\)/);
    // The guard runs before any page script or content.
    expect(src.indexOf('id="frameGuard"')).toBeLessThan(src.indexOf('<body'));
  });
}

test('framed by another site, the dashboard hides itself (no clickable content)', async ({ page, backend }) => {
  await page.context().route('http://attacker.test/**', r => r.fulfill({ status: 200, contentType: 'text/html',
    body: '<!doctype html><title>x</title><iframe id="f" src="http://dashboard.test/owner-login.html" width="800" height="600"></iframe>' }));
  await page.goto('http://attacker.test/');
  const frame = page.frameLocator('#f');
  await expect.poll(async () => {
    const f = page.frames().find(x => x.url().includes('owner-login.html'));
    return f ? f.evaluate(() => document.documentElement.style.display) : 'not loaded';
  }).toBe('none');
  await expect(frame.locator('#loginForm')).toBeHidden();
});

test('not framed: the page shows normally', async ({ page }) => {
  await login(page);
  expect(await page.evaluate(() => document.documentElement.style.display)).toBe('');
});
