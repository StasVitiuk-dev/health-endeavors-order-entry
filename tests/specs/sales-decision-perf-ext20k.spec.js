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

  test('D2/D500-011: in-page engine compute is separated from the page, repeated to bound uncertainty, no false precision', async ({ page }) => {
    test.setTimeout(120000);
    await enableSalesFlag(page);
    await login(page);
    await gotoPage(page, 'salesPriorityPanel'); // ensure the sales engine namespace is live
    const stats = await page.evaluate(() => {
      const S = window.HE && window.HE.sales;
      if (!S) return { error: 'no HE.sales namespace' };
      const asOf = '2026-10-20T00:00:00Z';
      // Dataset build is isolated (HE-D500-010): done ONCE, outside every timed
      // block, so the engine is never charged for fixture construction.
      const leads = [];
      for (let i = 0; i < 1000; i++) {
        leads.push({ id: 'L' + i, account: 'ACC' + (i % 50), state: 'CONTACTED',
          createdAt: new Date(Date.parse(asOf) - (i % 90) * 86400000).toISOString(),
          enteredStateAt: new Date(Date.parse(asOf) - (i % 40) * 86400000).toISOString(),
          weightedValue: (i % 100) + 1,
          factors: { value: (i % 10) / 10, fit: (i % 7) / 7, urgency: (i % 5) / 5, momentum: (i % 3) / 3, effort: (i % 4) / 4, risk: (i % 6) / 6 } });
      }
      const replies = leads.slice(0, 200).map(l => ({ id: l.id, text: 'what is your wholesale pricing?' }));
      const ops = {
        priority: () => S['he-sales-priority'].rank(leads, S['he-sales-priority'].DEFAULT_WEIGHTS),
        progression: () => S['he-sales-progression'].analyze(leads, { asOf }),
        concentration: () => S['he-sales-concentration'].analyze(leads),
        nextaction: () => S['he-sales-nextaction'].recommendAll(leads),
        replylab: () => S['he-sales-replylab'].triage(replies, S['he-sales-replies']),
      };
      // HE-D500-011: repeat each measurement and report median + range instead
      // of a single number, so sub-millisecond results are not quoted as precise.
      const median = a => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
      const out = {};
      for (const [k, fn] of Object.entries(ops)) {
        const runs = [];
        for (let r = 0; r < 5; r++) { const t0 = performance.now(); fn(); runs.push(performance.now() - t0); }
        out[k] = { median: +median(runs).toFixed(2), min: +Math.min(...runs).toFixed(2), max: +Math.max(...runs).toFixed(2) };
      }
      return out;
    });
    expect(stats.error).toBeUndefined();
    // eslint-disable-next-line no-console
    console.log('decision-engine in-page compute (ms, 1000 rows, 5 runs; emulated, timer-resolution-bounded):', JSON.stringify(stats));
    for (const [k, v] of Object.entries(stats)) {
      // Assert only the median against a generous ceiling; near-resolution values
      // are reported as a range, never as a precise speedup claim.
      expect(v.median, `${k} median ${v.median}ms over generous ceiling`).toBeLessThan(3000);
      expect(v.max).toBeGreaterThanOrEqual(v.min);
    }
  });
});

// HE-D500-031 / C10: toggling the feature flag OFF after it was ON (via reload)
// must leave no sales sidebar surface, exactly one active page, and — if a sales
// host section is the active page from the remembered last-page — it must render
// the inert DISABLED shell, never leftover synthetic data.
test('D500-031: flag ON -> OFF toggle leaves no stale sales surface', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'navigation/state; run once');
  test.setTimeout(120000);
  await login(page); // flag OFF by default: no sales group
  await expect(page.locator('#sidebarGroups .groupToggle[data-group="Sales & Growth"]')).toHaveCount(0);
  // Turn it ON for local review and reload: the group and a live page appear.
  await page.evaluate(() => { try { localStorage.setItem('he_sales_growth', 'on'); } catch (e) {} });
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await gotoPage(page, 'salesPriorityPanel');
  await expect(page.locator('#salesPriorityPanel .salesPage')).toHaveAttribute('data-state', /^(?!DISABLED).+/);
  // Toggle OFF and reload while a sales page was the last one open.
  await page.evaluate(() => { try { localStorage.removeItem('he_sales_growth'); } catch (e) {} });
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await page.waitForFunction(() => document.body.dataset.loaded === 'all');
  // No sales surface in the sidebar.
  await expect(page.locator('#sidebarGroups .groupToggle[data-group="Sales & Growth"]')).toHaveCount(0);
  await expect(page.locator('#sidebarGroups .sidebarLink[data-page^="sales"]')).toHaveCount(0);
  // Exactly one active page, and any active sales host shows the DISABLED shell.
  await expect(page.locator('main.contentArea > section.panel.activePage')).toHaveCount(1);
  const activeSales = page.locator('main.contentArea > section.panel.activePage[id^="sales"]');
  if (await activeSales.count()) {
    expect(await activeSales.locator('.salesPage').getAttribute('data-state')).toBe('DISABLED');
    await expect(activeSales.locator('[data-label="SIMULATED"]')).toHaveCount(0);
  }
});
