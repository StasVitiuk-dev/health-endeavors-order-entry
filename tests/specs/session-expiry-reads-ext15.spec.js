// EXT15: the sign-in expires while the operator is READING (writes are covered
// by fault-injection-2). An expired session must never look like "nothing
// there": no "0", no empty export that looks complete, no "no results", no
// green status. Every database read answers 401 "JWT expired" from the moment
// the session expires.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

const EXPIRED = { code: 'PGRST301', message: 'JWT expired' };
async function expire(page) {
  await page.route('**/rest/v1/**', r => r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(EXPIRED) }));
}

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

test('Home refresh after expiry: figures become "?" or an error, never a fresh-looking zero', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  await expire(page);
  await gotoPage(page, 'tasksPanel');
  await gotoPage(page, 'attentionPanel'); // Home re-reads its figures when opened
  await page.waitForLoadState('networkidle');
  const tiles = await page.locator('#businessHealthStats .stat').allTextContents();
  expect(tiles.length).toBeGreaterThan(0);
  for (const t of tiles) expect(t, t).not.toMatch(/^\s*\$?0(\.00)?\s/);
  await expect(page.locator('#dashError')).toContainText(/expired|sign in|could not be read/i);
});

test('activity export after expiry: an error, and no file that looks like a complete export', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'download behaviour; once');
  seedBusiness(backend);
  await login(page);
  await gotoPage(page, 'activityPanel');
  await page.waitForLoadState('networkidle');
  await expire(page);
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.locator('#activityExportBtn').click();
  await expect(page.locator('#dashError')).toContainText(/expired|sign in|could not/i, { timeout: 15000 });
  await page.waitForTimeout(500);
  expect(downloaded).toBe(false);
});

test('diagnostic summary after expiry: the database line says it could not read, and the summary is still produced', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await expire(page);
  await page.click('#copyDiagBtn');
  await expect(page.locator('#diagText')).toContainText('diagnostic summary', { timeout: 30000 });
  const text = await page.locator('#diagText').textContent();
  expect(text).toMatch(/Database: Could not read/);
  expect(text).toMatch(/Switch safety: UNKNOWN|could not be read/i);
});
