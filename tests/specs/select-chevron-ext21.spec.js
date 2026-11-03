// Regression for the custom select chevron (owner Safari finding 2026-11-03: the
// Employee Activity "Today"/"All areas" selects tiled the chevron across the whole
// control and obscured the text, because a per-page `.activityFilters select{
// background:<shorthand> }` reset the image/repeat and kept an 8px radius). This
// guards the shared control system against that class of per-page drift by reading
// COMPUTED style on real pages (not just a contrast re-run):
//   * every styled select shows exactly ONE chevron (background-repeat: no-repeat
//     whenever a background-image is present) — never a tiled pattern;
//   * the text is not obscured by it (enough right padding for the chevron zone);
//   * the closed control matches the square field system (small radius).
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'computed CSS; run once'); });

// Pages that carry toolbar/form selects the owner flagged or that are representative.
const PAGES = ['activityPanel', 'suppliersPanel', 'returnsPanel', 'expensesPanel', 'purchaseOrdersPanel'];

test('every styled select shows one chevron, readable text, square corners', async ({ page, backend }) => {
  test.setTimeout(120000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  const bad = [];
  for (const id of PAGES) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    const offenders = await page.locator(`section#${id}`).evaluate(root => {
      const out = [];
      root.querySelectorAll('select').forEach(s => {
        if (s.offsetParent === null) return; // skip hidden
        const c = getComputedStyle(s);
        const hasImg = c.backgroundImage && c.backgroundImage !== 'none';
        const padR = parseFloat(c.paddingRight) || 0;
        const rad = parseFloat(c.borderRadius) || 0;
        const problems = [];
        // A tiled chevron is the exact regression: image present but repeating.
        if (hasImg && c.backgroundRepeat.indexOf('no-repeat') === -1) problems.push('repeats:' + c.backgroundRepeat);
        // Custom chevron must have room so it never sits over the text.
        if ((c.appearance === 'none' || c.webkitAppearance === 'none') && hasImg && padR < 22) problems.push('padRight:' + padR);
        // Closed control must match the square field system, not a leftover pill/8px.
        if (rad > 4) problems.push('radius:' + c.borderRadius);
        if (problems.length) out.push(`${s.id || '(no id)'} [${problems.join(',')}]`);
      });
      return out;
    });
    offenders.forEach(o => bad.push(`${id}: ${o}`));
  }
  expect(bad, 'selects with a tiled/obscured chevron or non-square corners').toEqual([]);
});
