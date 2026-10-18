// EXT20: Trusted Types ratchet and the fixed-text conversions.
//   * The owner page is served with a REPORT-ONLY "require-trusted-types-for
//     'script'" policy (nothing is blocked), every sidebar page is opened, and the
//     number of violations may not rise above the measured ceiling. Lower it
//     when more HTML strings are converted; never raise it without a review.
//   * Toasts now build their text as a text node: hostile messages stay text.
//   * Empty states that used to be HTML strings still show the same words.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const ROOT = path.join(__dirname, '..', '..');

const CEILING = 4; // EXT17/18: 168 · EXT19: 86 · EXT20: 56 · EXT20J: 4 (the dynamic-sink cascade is complete; the only report-only violations left are the 4 static-literal overlay scaffolds — help, command palette, keyboard shortcuts, quick-add — which carry no dynamic data)

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'one browser size is enough'); });

test(`Trusted Types report-only violations stay at or below ${CEILING} across every page`, async ({ page }) => {
  test.setTimeout(180000);
  const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  await page.route(/\/owner-login\.html(\?|#|$)/, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'content-security-policy-report-only': "require-trusted-types-for 'script'" }, body: html }));
  await page.addInitScript(() => {
    window.__tt = [];
    document.addEventListener('securitypolicyviolation', e => { window.__tt.push((e.sourceFile || '').split('/').pop() + ':' + e.lineNumber); });
  });
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  expect(ids.length).toBeGreaterThan(20);
  for (const id of ids) await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const v = await page.evaluate(() => window.__tt);
  expect(v.length, 'violations: ' + v.join(' ')).toBeLessThanOrEqual(CEILING);
  expect(v.length, 'the probe must see the remaining violations (it is not silently off)').toBeGreaterThan(0);
});

test('toasts: 2,000 hostile messages are shown as text; nothing runs', async ({ page }) => {
  // The shipped he-ui module is loaded into the page with a stub registry, so the real toast() runs.
  await page.goto('/owner-login.html');
  const src = fs.readFileSync(path.join(ROOT, 'assets/app/he-ui.js'), 'utf8');
  const parts = ['<img src=x onerror="window.__pwn=1">', '<svg onload=window.__pwn=1>', '<script>window.__pwn=1</script>', 'javascript:window.__pwn=1',
    '<iframe srcdoc="<script>parent.__pwn=1</script>">', '&lt;b&gt;', '</div><b>', '\u202e', '\u0000', '🙂', '<a href="javascript:1">x</a>'];
  let seed = 2001;
  const r = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const msgs = Array.from({ length: 2000 }, () => Array.from({ length: 1 + Math.floor(r() * 4) }, () => parts[Math.floor(r() * parts.length)]).join(' '));
  const res = await page.evaluate(async ({ src, msgs }) => {
    const reg = {};
    const HE = { modules: { define: (name, meta, f) => { reg[name] = f; } } };
    new Function('window', 'HE', src.replace(/window\.HE\.modules/g, 'HE.modules'))(window, HE); // eslint-disable-line no-new-func
    const ui = reg['he-ui']({ EMPTY_ICONS: {}, HELP: [], ICON_PATHS: {}, THEME_FACE: {}, THEME_NAME: {}, THEME_ORDER: ['auto'] });
    document.body.appendChild(ui.toastHost);
    window.__pwn = 0;
    let bad = 0;
    for (const m of msgs) {
      ui.toast(m, 'ok');
      const el = ui.toastHost.lastElementChild;
      const kids = [...el.childNodes];
      if (kids.length !== 2 || kids[0].className !== 'dot' || kids[1].childNodes.length !== 1 || kids[1].firstChild.nodeType !== 3 || kids[1].textContent !== m) bad++;
    }
    await new Promise(r => setTimeout(r, 300));
    return { bad, pwn: window.__pwn, active: ui.toastHost.querySelectorAll('script, img, svg, iframe, a, b').length };
  }, { src, msgs });
  expect(res).toEqual({ bad: 0, pwn: 0, active: 0 });
});

test('fixed-text empty states keep their words and class after the conversion', async ({ page, backend }) => {
  Object.assign(backend.tables, { expenses: [], legal_holds: [], adverse_events: [], sops: [], feature_requests: [] });
  await login(page);
  const cases = [['expensesPanel', '#expensesWrap', 'No expenses logged yet — add your first one below.'],
    ['legalHoldsPanel', '#legalHoldsWrap', 'No active legal holds.'],
    ['adverseEventsPanel', '#adverseEventsWrap', 'No adverse event reports on file — hopefully it stays that way.']];
  for (const [panel, sel, words] of cases) {
    await gotoPage(page, panel);
    await expect(page.locator(sel + ' > p.empty').first()).toContainText(words);
  }
});
