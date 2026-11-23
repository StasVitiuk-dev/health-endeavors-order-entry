// #70/#71 report version history + simulated delivery — dashboard journey in
// Report History, behind the default-OFF he_report_versions flag. Shows the
// schedule check, immutable versions with a rerun appended, and a simulated
// delivery lifecycle that never actually sends. Flag OFF leaves the panel clean.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

async function enable(page) {
  await page.addInitScript(() => { try { localStorage.setItem('he_report_versions', 'on'); } catch (e) {} });
}

test('flag OFF (default): no report-versions section in Report History', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#reportVersionsHost .reportVersions')).toHaveCount(0);
});

test('flag ON: schedule, immutable versions, rerun and simulated delivery', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enable(page);
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#reportVersionsHost');
  await expect(host.locator('.reportVersions')).toHaveCount(1);
  // schedule check names the missed day.
  await expect(host).toContainText('missed: 2026-11-12');
  // one version initially for 2026-11-13.
  await expect(host).toContainText('2026-11-13 v1');
  await expect(host).not.toContainText('2026-11-13 v2');
  // delivery is queued and not delivered (no real send).
  await expect(host).toContainText('delivered=false');
  await expect(host).toContainText('email provider');
  // Rerun appends v2 (immutable history: v1 remains).
  await host.locator('[data-reportver="rerun"]').click();
  await expect(host).toContainText('2026-11-13 v1');
  await expect(host).toContainText('2026-11-13 v2 (rerun)');
  // Simulate delivery -> SENT but still delivered=false (nothing really sent).
  await host.locator('[data-reportver="send"]').click();
  await expect(host).toContainText('SENT');
  await expect(host).toContainText('delivered=false');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|Refused to|reportver/i);
});
