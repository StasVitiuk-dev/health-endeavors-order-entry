// REVIEW-ONLY preview capture of the Sales & Growth pages on the current feature
// branch. Synthetic data only (the test mock); nothing is fetched from the live
// site, nothing is sent, no provider/agent is activated. The feature flag is
// enabled ONLY in this isolated local review context (localStorage) — the
// source/default flag stays OFF.
//   npx playwright test -c tests/tools/screenshots.config.js SHOT_SPEC via env:
//   SHOT_SPEC=capture-sales-preview npx playwright test -c tests/tools/screenshots.config.js
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableSalesFlag } = require('../helpers/sales-pages');

const OUT = path.join(__dirname, '..', '..', 'design-review', 'sales-preview-2026-10-27');
const shot = (page, name, ti) => page.screenshot({ path: path.join(OUT, `sales_${name}_w${ti.project.name.slice(1)}.png`), fullPage: true });

// Two sizes are enough for review (desktop + phone).
test.beforeEach(({}, ti) => { test.skip(ti.project.name === 'w320', 'two sizes are enough'); });

// id -> file-name slug, in a sensible review order. Incidents has no page yet
// (engine-only), so the Anomaly Center is captured as the closest existing view.
const PAGES = [
  ['salesCommandPanel', '01-command-center'],
  ['salesAgentsPanel', '02-agent-activity'],
  ['salesSafetyPanel', '03-safety-center'],
  ['salesSettingsPanel', '04-settings-controls'],
  ['salesPriorityPanel', '05-prioritization-lab'],
  ['salesProgressionPanel', '06-deal-progression'],
  ['salesConcentrationPanel', '07-pipeline-risk'],
  ['salesNextActionPanel', '08-next-best-action'],
  ['salesReplyLabPanel', '09-reply-triage'],
  ['salesAuditPanel', '10-audit-explainability'],
  ['salesRetentionPanel', '11-retention'],
  ['salesTerritoryPanel', '12-territory'],
  ['salesCreatorPanel', '13-creator-prospects'],
  ['salesAnomalyPanel', '14-anomaly-center'],
];

for (const [id, slug] of PAGES) {
  test(`preview ${slug}`, async ({ page }, ti) => {
    await enableSalesFlag(page);       // local review context only; default stays OFF
    await login(page);
    await gotoPage(page, id);
    await expect(page.locator(`#${id} .salesPage`)).toBeVisible();
    // decision pages must be in their real (non-disabled) state for the shot
    await expect(page.locator(`#${id} .salesPage`)).toHaveAttribute('data-state', /^(?!DISABLED).+/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await shot(page, slug, ti);
  });
}
