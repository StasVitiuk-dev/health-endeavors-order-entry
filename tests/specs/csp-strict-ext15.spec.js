// EXT15: the owner page's Content-Security-Policy without 'unsafe-inline' for
// styles (scripts lost it in EXT14). Two kinds of proof:
//   1. normal use of every page reports NO policy violation (nothing the page
//      itself needs is blocked);
//   2. deliberate breaks are blocked by the browser: inline script, inline event
//      handler, javascript: link, inline style attribute, injected <style>,
//      a script or stylesheet from another site.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const ROOT = path.join(__dirname, '..', '..');

async function collectViolations(page) {
  const v = [];
  await page.exposeFunction('__cspV', x => v.push(x));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspV(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || ''))));
  return v;
}

test('the policy: scripts and styles only from this site (plus the pinned library), no inline allowance', ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'static; once');
  const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  const dir = n => (csp.split(';').map(x => x.trim()).find(x => x.startsWith(n + ' ')) || '');
  expect(dir('style-src')).toBe("style-src 'self'");
  expect(dir('script-src')).not.toContain("'unsafe-inline'");
  expect(dir('script-src')).not.toContain("'unsafe-eval'");
  expect(html).not.toMatch(/\sstyle="/);
  expect(html).not.toMatch(/<style[\s>]/);
});

test('normal use of every page and the overlays reports no policy violation', async ({ page, backend }, ti) => {
  test.setTimeout(240000);
  const v = await collectViolations(page);
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  for (const id of ids) await gotoPage(page, id);
  // overlays and drawers that build HTML when opened
  if (ti.project.name === 'desktop') {
    await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.type('a'); await page.keyboard.press('Escape');
    await page.keyboard.press('?').catch(() => {}); await page.keyboard.press('Escape');
  }
  await page.waitForLoadState('networkidle');
  expect(v, 'violations in normal use').toEqual([]);
});

test.describe('deliberate breaks are blocked by the browser', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'policy is per page; once'); });

  test('inline script, inline handler, javascript: link, injected external script', async ({ page }) => {
    const v = await collectViolations(page);
    await login(page);
    const ran = await page.evaluate(async () => {
      window.__pwn = 0;
      const host = document.createElement('div'); document.body.appendChild(host);
      host.innerHTML = '<img src="data:," onerror="window.__pwn++"><svg onload="window.__pwn++"></svg><a id="pwnLink" href="javascript:window.__pwn++">x</a>';
      const s = document.createElement('script'); s.textContent = 'window.__pwn++'; document.body.appendChild(s);
      const ext = document.createElement('script'); ext.src = 'https://evil.example/x.js'; document.body.appendChild(ext);
      document.getElementById('pwnLink').click();
      await new Promise(r => setTimeout(r, 300));
      return window.__pwn;
    });
    expect(ran).toBe(0);
    expect(v.some(x => /^script-src/.test(x))).toBe(true);
  });

  test('inline style attribute, injected <style>, stylesheet from another site: none take effect', async ({ page }) => {
    const v = await collectViolations(page);
    await login(page);
    const r = await page.evaluate(async () => {
      const host = document.createElement('div'); host.id = 'cssTrap'; host.textContent = 'x'; document.body.appendChild(host);
      host.innerHTML = '<span id="trapSpan" style="color: rgb(1, 2, 3)">x</span>';
      const st = document.createElement('style'); st.textContent = '#cssTrap{display:none !important}'; document.head.appendChild(st);
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://evil.example/x.css'; document.head.appendChild(link);
      await new Promise(r => setTimeout(r, 300));
      return { color: getComputedStyle(document.getElementById('trapSpan')).color, display: getComputedStyle(host).display };
    });
    expect(r.color).not.toBe('rgb(1, 2, 3)');
    expect(r.display).not.toBe('none');
    expect(v.filter(x => /^style-src/.test(x)).length).toBeGreaterThanOrEqual(2);
  });

  test('styles set by the page through the CSS object model still work (what the page itself uses)', async ({ page }) => {
    await login(page);
    const ok = await page.evaluate(() => { const d = document.createElement('div'); document.body.appendChild(d); d.style.color = 'rgb(4, 5, 6)'; d.style.setProperty('--groupColor', '#123456'); return getComputedStyle(d).color + '|' + d.style.getPropertyValue('--groupColor'); });
    expect(ok).toBe('rgb(4, 5, 6)|#123456');
  });

  test('a group colour from the configuration that is not a plain hex colour is ignored, not applied', async ({ page }) => {
    // The sidebar colours come from the fixed configuration; the page applies one only
    // if it looks like #abc / #aabbcc, so no arbitrary CSS can arrive this way.
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'app', 'he-config.js'), 'utf8').replace(/color: '#[0-9a-fA-F]{3,8}'/, "color: 'url(https://evil.example/x)'");
    // (a value with ';' would be refused by the browser itself and prove nothing: a
    // custom property accepts url(...), so only the page's own hex check stops this one)
    await page.route('**/assets/app/he-config.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
    await login(page);
    const vals = await page.locator('#sidebarGroups .sidebarGroup').evaluateAll(els => els.map(e => e.style.getPropertyValue('--groupColor')));
    expect(vals.length).toBeGreaterThan(3);
    expect(vals.filter(v => v === '').length).toBe(1);
    for (const v of vals.filter(Boolean)) expect(v).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });
});

// EXT16: every dashboard page, not only the owner page. A page may not bring back
// 'unsafe-inline' (styles or scripts), style attributes, <style> blocks, inline
// scripts or inline event handlers; each page's script/style files are 'self'.
test('ALL dashboard pages: no unsafe-inline, no inline styles, style blocks, inline scripts or inline handlers', ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'file check; once');
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
  expect(pages).toEqual(['change-password.html', 'dashboard.html', 'index.html', 'manual-order-entry.html', 'owner-login.html', 'search.html']);
  for (const f of pages) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
    expect(csp, f + ': has a policy').toBeTruthy();
    const dir = name => (csp.split(';').map(x => x.trim()).find(x => x.startsWith(name + ' ')) || '');
    expect(dir('style-src'), f).not.toContain("'unsafe-inline'");
    expect(dir('script-src'), f).not.toContain("'unsafe-inline'");
    expect(dir('script-src'), f).not.toContain("'unsafe-eval'");
    expect(csp, f).toMatch(/object-src 'none'/);
    expect(html, f + ': style attribute').not.toMatch(/\sstyle="/);
    expect(html, f + ': <style> block').not.toMatch(/<style[\s>]/);
    // an inline script is allowed only when the policy names its exact hash (the frame guard)
    for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      const hash = "'sha256-" + require('crypto').createHash('sha256').update(m[1]).digest('base64') + "'";
      expect(dir('script-src'), f + ': inline script without its hash in the policy').toContain(hash);
    }
    expect(html, f + ': inline event handler').not.toMatch(/\son[a-z]+="/);
  }
});
