// Export recovery drill panel wiring (local item L2). Default-OFF
// (he_recovery_drill). Flag OFF renders nothing; flag ON shows a clean package
// opening and a tampered / missing package being rejected before anything is
// applied, labelled read-only with backups untouched. No file is written.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('flag OFF (default): the recovery drill does not render', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#recoveryDrillHost')).toBeEmpty();
});

test('flag ON: clean package opens; tampered + missing are rejected before applying', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_recovery_drill', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#recoveryDrillHost');
  await expect(host).toContainText('Export recovery drill');
  await expect(host).toContainText('read-only, backups untouched');
  await expect(host).toContainText('Clean package: opened');
  await expect(host).toContainText('Tampered package: rejected at checksum');
  await expect(host).toContainText('Missing file: rejected at files');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
