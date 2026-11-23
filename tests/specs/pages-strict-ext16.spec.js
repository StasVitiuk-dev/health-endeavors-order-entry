// EXT16: the five smaller pages under strict policies (no 'unsafe-inline' for
// styles; the manual order pages also for scripts). The behaviour that used
// inline code must still work:
//   * dashboard.html: the AI spend bar width (was an inline style in markup);
//   * index.html / manual-order-entry.html: a refused library now gives a plain
//     message (the old inline onerror flag is gone and the page used to throw);
//   * every page loads with no policy violation.
const { test, expect, login } = require('../helpers/dashboard');

async function watchViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
}
const dropFonts = backend => { backend.blocked = backend.blocked.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)); };

test('dashboard.html: the AI spend bar gets its width (now set through the CSS object model), with no policy violation', async ({ page, backend }) => {
  const now = new Date().toISOString();
  Object.assign(backend.tables, {
    owner_dashboard_summary: [{ system_mode: 'NORMAL', open_incidents: 0, critical_incidents: 0, open_tasks: 0, overdue_tasks: 0, open_alerts: 0, security_changes_last_24h: 0, profile_changes_last_7d: 0 }],
    owner_dashboard_recent_activity: [],
    ai_decision_log: [{ agent_key: 'customer_service_agent', output_summary: 'SYNTHETIC', cost_usd: 7.5, created_at: now }],
    business_rules: [],
  });
  await watchViolations(page);
  await login(page);
  await page.goto('/dashboard.html');
  await expect(page.locator('#app')).toBeVisible();
  const fill = page.locator('#ai-spend-summary .ai-spend-bar-fill');
  await expect(fill).toHaveCount(1);
  // $7.50 of the default $30 cap = 25%
  expect(await fill.evaluate(e => e.style.width)).toBe('25%');
  expect(await fill.evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  dropFonts(backend);
});

for (const f of ['index.html', 'manual-order-entry.html']) {
  test(`${f}: altered library bytes are refused and the page says so (no inline onerror needed)`, async ({ page, backend }) => {
    backend.cdnBody = '/* tampered */ window.supabase = { createClient: () => ({}) };';
    await page.goto('/' + f);
    await expect(page.locator('#scriptError')).toContainText("couldn't load a required file");
    dropFonts(backend);
  });
}

for (const f of ['change-password.html', 'dashboard.html', 'search.html', 'index.html', 'manual-order-entry.html']) {
  test(`${f}: loads with no policy violation, and the page's own stylesheet applied`, async ({ page, backend }) => {
    await watchViolations(page);
    await page.goto('/' + f);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    // the moved <style> block is in effect: the page's own sheet is loaded and has rules
    const own = await page.evaluate(() => [...document.styleSheets].filter(s => s.href && /\/assets\/[a-z-]+\.css/.test(s.href)).map(s => s.cssRules.length));
    expect(own.length).toBeGreaterThan(0);
    expect(Math.max(...own)).toBeGreaterThan(10);
    dropFonts(backend);
  });
}
