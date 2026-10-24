// Reserve IV — WAVE D: decision-page responsiveness & navigation stability.
//
// D1/D2: the Node-side sales-scale-ext20k matrix measures PURE-ENGINE time only.
// This spec adds the flag-ON browser side: it separates in-page engine compute
// time from the rendered page, and checks repeated navigation among the five
// decision pages does not grow the DOM (D5) or leave a stale/duplicated active
// page (D7). Because showPage() only toggles visibility (panels render once at
// load), the expected and asserted result is STABLE DOM across navigation — a
// real leak check, not a budget-chasing benchmark.
//
// Timings here are emulated Chromium numbers with run-to-run variance; they are
// printed for insight and asserted only against generous ceilings. They are not
// production capacity claims. Desktop project only (timing/DOM; run once).
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableSalesFlag } = require('../helpers/sales-pages');

const DECISION_PAGES = ['salesPriorityPanel', 'salesProgressionPanel', 'salesConcentrationPanel', 'salesNextActionPanel', 'salesReplyLabPanel'];

test.describe('decision pages: responsiveness & navigation stability', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'timing/DOM; run once'); });

  test('each decision page renders exactly one populated salesPage (flag ON)', async ({ page }) => {
    test.setTimeout(120000);
    await enableSalesFlag(page);
    await login(page);
    for (const id of DECISION_PAGES) {
      await gotoPage(page, id);
      const panels = page.locator(`#${id} .salesPage`);
      await expect(panels).toHaveCount(1);
      expect(await panels.getAttribute('data-state')).not.toBe('DISABLED');
      // has real content (at least one section/row rendered)
      expect(await page.locator(`#${id} .salesPage *`).count()).toBeGreaterThan(0);
    }
  });

  test('D5/D7: repeated navigation keeps DOM stable — no re-render accumulation, one active page', async ({ page }) => {
    test.setTimeout(120000);
    await enableSalesFlag(page);
    await login(page);
    // Baseline: child count of each decision panel's salesPage after first visit.
    const baseline = {};
    for (const id of DECISION_PAGES) {
      await gotoPage(page, id);
      baseline[id] = await page.locator(`#${id} .salesPage`).evaluate(el => el.childElementCount);
    }
    // 10 cycles through all five pages.
    for (let i = 0; i < 10; i++) {
      for (const id of DECISION_PAGES) await gotoPage(page, id);
    }
    // After churn: still exactly one salesPage per panel, same child count, and
    // exactly one active page overall (no stale/duplicate).
    for (const id of DECISION_PAGES) {
      await expect(page.locator(`#${id} .salesPage`)).toHaveCount(1);
      const after = await page.locator(`#${id} .salesPage`).evaluate(el => el.childElementCount);
      expect(after, `${id} child count must be stable (was ${baseline[id]}, now ${after})`).toBe(baseline[id]);
    }
    await expect(page.locator('main.contentArea > section.panel.activePage')).toHaveCount(1);
    // no duplicate ids introduced by navigation
    const dupes = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); });
    expect(dupes).toEqual([]);
  });

  test('D2: in-page engine compute time is separated from the page and within a generous ceiling', async ({ page }) => {
    test.setTimeout(120000);
    await enableSalesFlag(page);
    await login(page);
    await gotoPage(page, 'salesPriorityPanel'); // ensure the sales engine namespace is live
    const timings = await page.evaluate(() => {
      const S = window.HE && window.HE.sales;
      if (!S) return { error: 'no HE.sales namespace' };
      // Build a representative synthetic batch in-page (1000 rows).
      const leads = [];
      const asOf = '2026-10-20T00:00:00Z';
      for (let i = 0; i < 1000; i++) {
        leads.push({ id: 'L' + i, account: 'ACC' + (i % 50), state: 'CONTACTED',
          createdAt: new Date(Date.parse(asOf) - (i % 90) * 86400000).toISOString(),
          enteredStateAt: new Date(Date.parse(asOf) - (i % 40) * 86400000).toISOString(),
          weightedValue: (i % 100) + 1,
          factors: { value: (i % 10) / 10, fit: (i % 7) / 7, urgency: (i % 5) / 5, momentum: (i % 3) / 3, effort: (i % 4) / 4, risk: (i % 6) / 6 } });
      }
      const time = fn => { const t0 = performance.now(); fn(); return +(performance.now() - t0).toFixed(1); };
      const out = {};
      out.priority = time(() => S['he-sales-priority'].rank(leads, S['he-sales-priority'].DEFAULT_WEIGHTS));
      out.progression = time(() => S['he-sales-progression'].analyze(leads, { asOf }));
      out.concentration = time(() => S['he-sales-concentration'].analyze(leads));
      out.nextaction = time(() => S['he-sales-nextaction'].recommendAll(leads));
      const replies = leads.slice(0, 200).map(l => ({ id: l.id, text: 'what is your wholesale pricing?' }));
      out.replylab = time(() => S['he-sales-replylab'].triage(replies, S['he-sales-replies']));
      return out;
    });
    expect(timings.error).toBeUndefined();
    // eslint-disable-next-line no-console
    console.log('decision-engine in-page compute (ms, 1000 rows; emulated, variance applies):', JSON.stringify(timings));
    for (const [k, v] of Object.entries(timings)) {
      expect(typeof v, k).toBe('number');
      expect(v, `${k} compute ${v}ms over generous ceiling`).toBeLessThan(3000);
    }
  });
});
