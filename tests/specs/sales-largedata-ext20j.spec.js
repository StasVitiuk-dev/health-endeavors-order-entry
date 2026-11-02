// Sales & Growth — large-data engine load (item 119/120). The pure engine must
// stay fast and correct at 10k–50k synthetic leads (the browser pages page/cap
// their own rendering; this guards the engine math itself from pathological
// blow-ups). Node-only, synthetic.
const { test, expect } = require('@playwright/test');
const F = require('../../assets/sales/he-sales-fixtures.js');
const LEADS = require('../../assets/sales/he-sales-leads.js');
const TER = require('../../assets/sales/he-sales-territory.js');
const SRC = require('../../assets/sales/he-sales-sources.js');
const DQ = require('../../assets/sales/he-sales-dataquality.js');
const IMPORT = require('../../assets/sales/he-sales-import.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

function timed(fn) { const t = Date.now(); const out = fn(); return { ms: Date.now() - t, out }; }

test('lead scoring + ranking stays fast and ordered at 10k leads', () => {
  const leads = F.leads(10000, 7);
  const { ms, out } = timed(() => LEADS.rank(leads));
  expect(out.length).toBe(10000);
  for (let i = 1; i < out.length; i++) expect(out[i - 1].scoring.score).toBeGreaterThanOrEqual(out[i].scoring.score);
  expect(ms).toBeLessThan(5000);
});

test('territory + source aggregation stays fast at 10k leads', () => {
  const ranked = LEADS.rank(F.leads(10000, 9)).map(l => ({ ...l, storeType: l.category, replied: true, converted: false }));
  const t1 = timed(() => TER.analyze(ranked));
  const t2 = timed(() => SRC.analyze(ranked));
  expect(t1.out.totalProspects).toBe(10000);
  expect(t2.out.bySource.length).toBeGreaterThan(0);
  expect(t1.ms).toBeLessThan(5000);
  expect(t2.ms).toBeLessThan(5000);
});

test('data-quality scan stays fast at 10k leads', () => {
  const leads = F.leads(10000, 3);
  const { ms, out } = timed(() => DQ.scan({ leads }));
  expect(out).toBeTruthy();
  expect(ms).toBeLessThan(6000);
});

test('duplicate graph handles 5k messy rows without blowing up', () => {
  const rows = [];
  for (let i = 0; i < 5000; i++) rows.push({ id: 'R' + i, storeName: 'Store ' + (i % 500), email: 'buyer@store' + (i % 500) + '.example.com', website: 'store' + (i % 500) + '.example.com', city: 'Austin' });
  const prepared = rows.map(IMPORT.prepareRow);
  const { ms, out } = timed(() => IMPORT.duplicateGraph(prepared));
  expect(out).toBeTruthy();
  expect(ms).toBeLessThan(8000);
});

test('50k engine-only pass completes within budget', () => {
  const { ms, out } = timed(() => LEADS.rank(F.leads(50000, 11)));
  expect(out.length).toBe(50000);
  expect(ms).toBeLessThan(15000);
});
