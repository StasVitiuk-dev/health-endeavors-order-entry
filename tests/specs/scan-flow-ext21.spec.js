// Scan Shipment UI flow — browser journey tests (Phase 1). Behind the default-OFF
// he_scan_shipment flag. With the flag off there is NO entry button and the live
// dashboard is unchanged; with it on, the local SIMULATED flow runs on fixture
// orders. No camera is used here — the camera path falls back to photo/manual and
// is driven through the demo fixtures and manual entry.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

async function enableScan(page) {
  await page.addInitScript(() => { try { localStorage.setItem('he_scan_shipment', 'on'); } catch (e) {} });
}
async function openFlow(page) {
  await gotoPage(page, 'attentionPanel');
  await page.locator('[data-scan="open"]').first().click();
  await expect(page.locator('#scanOverlay')).toBeVisible();
}
async function loadFixture(page, key) {
  await page.locator('.scanDemo summary').click();
  await page.locator(`[data-scan="fixture"][data-fx="${key}"]`).click();
}

test('flag OFF (default): no Scan Shipment entry button on Home or Orders', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'attentionPanel');
  await expect(page.locator('[data-scan="open"]')).toHaveCount(0);
  await gotoPage(page, 'ordersPanel');
  await expect(page.locator('[data-scan="open"]')).toHaveCount(0);
});

test('flag ON: the complete flow — fixture scan, suggested order, confirm, attach once, simulated tracking + notification', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run the full journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enableScan(page);
  await login(page);
  await openFlow(page);
  await loadFixture(page, 'exact_match');
  // Review step shows a single suggested order and still requires confirmation.
  await expect(page.locator('#scanOverlay .scanCard')).toHaveCount(1);
  await expect(page.locator('#scanOverlay')).toContainText('SYN-1003');
  await page.locator('[data-scan="confirm"][data-order="SYN-o3"]').click();
  // Result: attached + a queued tracking check and one notification.
  await expect(page.locator('#scanOverlay')).toContainText('Tracking attached');
  await expect(page.locator('#scanOverlay')).toContainText('Tracking check');
  await expect(page.locator('#scanOverlay')).toContainText('Shipping notification');
  // No Trusted-Types / CSP violations during the flow.
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('same-name accounts produce a chooser, never an auto-pick', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once');
  await enableScan(page); await login(page); await openFlow(page);
  await loadFixture(page, 'same_name');
  await expect(page.locator('#scanOverlay')).toContainText('More than one order matches');
  await expect(page.locator('#scanOverlay .scanCard')).toHaveCount(2);
});

test('no-match asks to search and never guesses', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once');
  await enableScan(page); await login(page); await openFlow(page);
  await loadFixture(page, 'no_match');
  await expect(page.locator('#scanOverlay .scanCard')).toHaveCount(0);
  await expect(page.locator('#scanOverlay')).toContainText('No confident match');
});

test('an invalid tracking number is flagged before attaching', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once');
  await enableScan(page); await login(page); await openFlow(page);
  await loadFixture(page, 'invalid_tracking');
  await expect(page.locator('#scanOverlay')).toContainText('tracking failed its carrier check');
});

test('a duplicate scan of the same label attaches nothing the second time', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once');
  await enableScan(page); await login(page); await openFlow(page);
  await loadFixture(page, 'exact_match');
  await page.locator('[data-scan="confirm"][data-order="SYN-o3"]').click();
  await expect(page.locator('#scanOverlay')).toContainText('Tracking attached');
  // Scan the same label again.
  await page.locator('[data-scan="again"]').click();
  await loadFixture(page, 'exact_match');
  await page.locator('[data-scan="confirm"][data-order="SYN-o3"]').click();
  await expect(page.locator('#scanOverlay')).toContainText('already attached');
});

test('a provider outage holds the notification with a safe retry; the attach is kept', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once');
  await enableScan(page); await login(page); await openFlow(page);
  await loadFixture(page, 'exact_match');
  await page.locator('[data-scan="outage"]').check();
  await page.locator('[data-scan="confirm"][data-order="SYN-o3"]').click();
  await expect(page.locator('#scanOverlay')).toContainText('Tracking attached'); // shipment state kept
  await expect(page.locator('#scanOverlay .scanQ-failed')).toHaveCount(1);
  await page.locator('[data-scan="retry"]').click();
  await expect(page.locator('#scanOverlay .scanQ-sent')).toHaveCount(1);
});

test('manual entry path finds the order without a camera', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once');
  await enableScan(page); await login(page); await openFlow(page);
  await page.locator('[data-scan="manual"]').click();
  await page.locator('#scanM_tracking').fill('1Z999AA10123456784');
  await page.locator('#scanM_ref').fill('SYN-1003');
  await page.locator('[data-scan="manual-submit"]').click();
  await expect(page.locator('#scanOverlay .scanCard')).toHaveCount(1);
  await expect(page.locator('#scanOverlay')).toContainText('SYN-1003');
});

test('on a phone, the entry button and flow are reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone only');
  await enableScan(page); await login(page);
  await gotoPage(page, 'attentionPanel');
  await page.locator('[data-scan="open"]').first().click();
  await expect(page.locator('#scanOverlay')).toBeVisible();
  await loadFixture(page, 'exact_match');
  await expect(page.locator('#scanOverlay .scanCard')).toHaveCount(1);
});
