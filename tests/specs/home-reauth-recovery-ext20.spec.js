// Same-mounted-page recovery: sign-in expires while reading Home, then the owner
// signs back in and refreshes. session-expiry-reads-ext15 proves the expiry
// direction (figures become "?"/error, never a fresh-looking zero). This proves
// the RECOVERY direction on the same page without a reload: once the session is
// valid again, Home shows the real figures again — both a legitimately-zero tile
// (AI spend, no decisions logged → "$0.00 / $30.00") and the non-zero figures —
// and the unavailable "?"/error state is gone. No sleeps: page.unroute restores
// the healthy mock backend and waitForLoadState drives the timing.
const { test, expect, login } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'deterministic logic; run once'); });

const EXPIRED = JSON.stringify({ code: 'PGRST301', message: 'JWT expired' });
const expire = page => page.route('**/rest/v1/**', r => r.fulfill({ status: 401, contentType: 'application/json', body: EXPIRED }));

const tiles = page => page.locator('#businessHealthStats .stat');

test('Home recovers its real figures after expiry → reauth on the same page (legitimate zero and non-zero)', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');

  // Baseline: the real figures shown while signed in. seedBusiness logs no AI
  // decisions, so AI spend is a legitimate zero; the other tiles are non-zero.
  const baseline = await tiles(page).allTextContents();
  expect(baseline.length, 'Home shows tiles when signed in').toBeGreaterThan(0);
  const aiBaseline = baseline.find(t => /AI spend/i.test(t));
  expect(aiBaseline, 'an AI-spend tile exists').toBeTruthy();
  expect(aiBaseline, 'AI spend is a legitimate zero at baseline').toContain('$0.00');
  expect(baseline.some(t => /[1-9]/.test(t)), 'at least one non-zero figure at baseline').toBe(true);

  // Expire and refresh: figures must read as unavailable, never a fresh zero.
  await expire(page);
  await page.locator('#refreshBtn').click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#dashError')).toContainText(/expired|sign in|could not be read/i);
  for (const t of await tiles(page).allTextContents()) expect(t, t).not.toMatch(/^\s*\$?0(\.00)?\s/);

  // Reauthenticate: the session is valid again. Refresh on the SAME mounted page.
  await page.unroute('**/rest/v1/**');
  await page.locator('#refreshBtn').click();
  await page.waitForLoadState('networkidle');

  // Recovery: the real figures are back, identical to the signed-in baseline —
  // the legitimate zero renders as a real "$0.00", not "could not be read", and
  // the non-zero figures return. No tile is left in the unavailable state.
  const recovered = await tiles(page).allTextContents();
  expect(recovered, 'Home returns to its real figures after reauth').toEqual(baseline);
  for (const t of recovered) expect(t, t).not.toMatch(/could not be read/i);
  const aiRecovered = recovered.find(t => /AI spend/i.test(t));
  expect(aiRecovered).toContain('$0.00');
  expect(aiRecovered).toContain('/ $30.00');
});
