// EXT17 forensic probe (not part of npm test): how far is the owner dashboard
// from Trusted Types? The page is served with an extra REPORT-ONLY policy
// "require-trusted-types-for 'script'" (nothing is blocked), every sidebar page
// is opened, and each violation is recorded by sink and source file.
// Run: npx playwright test -c tests/forensics/probe.config.js trusted-types --project=desktop
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('Trusted Types readiness: report-only violations on load and on every page', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  test.setTimeout(300000);
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'owner-login.html'), 'utf8');
  await page.route(/\/owner-login\.html(\?|#|$)/, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'content-security-policy-report-only': "require-trusted-types-for 'script'" }, body: html }));
  await page.addInitScript(() => {
    window.__tt = [];
    document.addEventListener('securitypolicyviolation', e => {
      window.__tt.push({ directive: e.effectiveDirective || e.violatedDirective, sample: (e.sample || '').slice(0, 60), source: (e.sourceFile || '').split('/').pop(), line: e.lineNumber });
    });
  });
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  for (const id of ids) await gotoPage(page, id).catch(() => {});
  await page.waitForLoadState('networkidle');
  const v = await page.evaluate(() => window.__tt);
  const bySink = {}, bySource = {};
  for (const x of v) { const sink = (x.sample.split('|')[0] || '?'); bySink[sink] = (bySink[sink] || 0) + 1; bySource[x.source + ':' + x.line] = (bySource[x.source + ':' + x.line] || 0) + 1; }
  const distinct = Object.keys(bySource).length;
  console.log(`TRUSTED-TYPES report-only: ${v.length} violations, ${distinct} distinct code locations, ${ids.length} pages opened`);
  console.log('by sink: ' + JSON.stringify(bySink));
  console.log('top locations: ' + JSON.stringify(Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 15)));
  if (process.env.TT_OUT) require('fs').writeFileSync(process.env.TT_OUT, JSON.stringify({ total: v.length, distinct, locations: Object.entries(bySource).sort() }, null, 1));
  ti.annotations.push({ type: 'trusted-types', description: `${v.length} violations, ${distinct} locations` });
  expect(v.length).toBeGreaterThanOrEqual(0);
});
