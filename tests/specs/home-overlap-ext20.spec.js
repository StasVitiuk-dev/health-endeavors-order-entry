// Deterministic regression for the Business Health overlapping-load race
// (owner-login-app.js loadBusinessHealth + newLoadToken). No sleeps, no reliance
// on parallel load: request barriers control completion order exactly.
//
// The CI failure (run 41348857407, shard 1): after a session expired and Home was
// refreshed, the "AI spend this month" tile showed a pre-expiry "$0.00 / $30.00"
// while every other tile correctly showed "?". Cause: an older in-flight Home load
// (from sign-in) finished AFTER the newer expired refresh and repainted a stale
// tile, because loadBusinessHealth lacked the newLoadToken guard the other loaders
// have. These tests prove the guard: they FAIL when it is reverted and PASS with it.
const { test, expect, login } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'deterministic logic; run once'); });

const EXPIRED = JSON.stringify({ code: 'PGRST301', message: 'JWT expired', hint: null, details: null });
const expire = route => route.fulfill({ status: 401, contentType: 'application/json', body: EXPIRED });
const ok0 = route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); // 200, 0 rows -> $0 spend
const aiTile = page => page.locator('#businessHealthStats .stat').filter({ hasText: 'AI spend' });

// Park the FIRST ai_decision_log read (the older load) and hand back a releaser.
async function parkFirstAiRead(page) {
  let held = null, seen;
  const arrived = new Promise(r => (seen = r));
  let n = 0;
  await page.route('**/rest/v1/ai_decision_log*', async route => {
    if (++n === 1) { held = route; seen(); }   // older load: hold
    else await expire(route);                   // any later ai read: expired
  });
  return { arrived, release: (how) => how(held) };
}

test('older $0 AI read released AFTER a newer expired refresh cannot repaint the "?" (guard)', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  const parked = await parkFirstAiRead(page);
  await login(page);                 // older loadBusinessHealth starts; its AI read is parked
  await parked.arrived;              // confirmed parked
  await page.route('**/rest/v1/**', expire);   // the session is now expired for every read
  await page.locator('#refreshBtn').click();   // newer load: all reads 401

  // The newer render resolves first and shows the AI spend as unavailable.
  await expect(aiTile(page)).toContainText('could not be read');
  await expect(aiTile(page)).not.toContainText('$0');

  // Release the OLDER read with a successful $0 so the older load finishes LAST.
  parked.release(ok0);
  await page.waitForLoadState('networkidle');

  // The guard must stop the stale $0 from repainting the newer "?".
  await expect(aiTile(page)).toContainText('could not be read');
  await expect(aiTile(page), 'stale older $0 must not repaint the newer expired render').not.toContainText('$0');
});

test('reverse order: older $0 released BEFORE the newer render still leaves "?" (no stale remains)', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  const parked = await parkFirstAiRead(page);
  await login(page);
  await parked.arrived;
  await page.route('**/rest/v1/**', expire);
  // Release the older read FIRST (it is already not the latest), then refresh (newer).
  parked.release(ok0);
  await page.locator('#refreshBtn').click();
  await expect(aiTile(page)).toContainText('could not be read');
  await expect(aiTile(page), 'no stale $0 may survive either completion order').not.toContainText('$0');
});

test('legitimate zero: a normal authenticated refresh still shows "$0.00 / $30.00" (guard does not hide real zero)', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  await page.locator('#refreshBtn').click();
  await page.waitForLoadState('networkidle');
  // No ai_decision_log rows seeded -> a real $0 spend against the $30 cap.
  await expect(aiTile(page)).toContainText('$0.00');
  await expect(aiTile(page)).toContainText('/ $30.00');
  await expect(aiTile(page), 'a legitimate zero is not "unavailable"').not.toContainText('could not be read');
});
