// EXT14: the status manifest (docs/ops/STATUS_MANIFEST_EXT14.json) is
// consistent, and the validator catches each kind of dishonest status.
// Node-only.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { validate } = require('../tools/status-validate');
const load = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'STATUS_MANIFEST_EXT14.json'), 'utf8'));
const SQL = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'sql', 'MANIFEST.json'), 'utf8'));
const EV = { date: '2026-10-20', env: 'production', source: 'owner screenshot of Query C' };
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// Production claims in the checked-in file: only what the owner's dated evidence shows (Nov 27):
// the merged dashboard is live (PR #36, Nov 23) and database step 18 is installed and checked
// (drafts/68, Nov 26). Anything else claimed in production fails here until its evidence is added.
const CLAIMED = { merge: 'DEPLOYED', history_search_path: 'VERIFIED' };
test('the checked-in manifest is consistent and claims in production only what has dated owner evidence', () => {
  const m = load();
  expect(validate(m, SQL)).toEqual([]);
  expect(m.units.merge).toMatchObject({ merged: true, deployed: true });
  for (const [k, u] of Object.entries(m.units)) {
    if (CLAIMED[k]) {
      expect(u.production, k).toBe(CLAIMED[k]);
      expect(u.productionEvidence, k).toMatchObject({ env: 'production' });
      expect(u.productionEvidence.date, k).toMatch(/^2026-11-2[0-9]$/);
    } else {
      expect(u.productionEvidence, k).toBeNull();
      expect(['UNKNOWN', 'NOT DEPLOYED', 'NOT INSTALLED'], k).toContain(u.production);
    }
  }
  for (const [k, s] of Object.entries(m.switches)) expect(s.productionEvidence, k).toBeNull();
  expect(m.scores.productionReadinessPercent).toBe(15);
});

const cases = [
  ['deployed but not merged', m => { Object.assign(m.units.merge, { merged: false, deployed: true }); }, /deployed but not merged/],
  ['installed with no evidence', m => { m.units.r15.production = 'INSTALLED'; }, /without dated production evidence/],
  ['local evidence used as production', m => { m.units.r15.production = 'INSTALLED'; m.units.r15.productionEvidence = { ...EV, env: 'local' }; }, /without dated production evidence/],
  ['SQL installed before the merge', m => { Object.assign(m.units.merge, { merged: false, deployed: false, production: 'NOT DEPLOYED', productionEvidence: null }); m.units.r15.production = 'INSTALLED'; m.units.r15.productionEvidence = EV; }, /before the code was merged/],
  ['switch ON with its step not installed', m => { m.switches.stock_fn_receive_po = { install: 'switch_rows', production: 'ON', productionEvidence: EV }; }, /is ON but its step switch_rows is not installed/],
  ['readiness raised for local work', m => { for (const u of Object.values(m.units)) { u.productionEvidence = null; if (!['UNKNOWN', 'NOT DEPLOYED', 'NOT INSTALLED'].includes(u.production)) u.production = 'UNKNOWN'; } Object.assign(m.units.merge, { merged: false, deployed: false }); m.scores.productionReadinessPercent = 40; }, /readiness changed to 40%/],
  ['a step missing', m => { delete m.units.nightly; }, /step nightly .* missing/],
  ['an unknown switch', m => { m.switches.auto_refunds = { install: 'merge', production: 'OFF', productionEvidence: null }; }, /switch auto_refunds is unknown/],
  ['a draft owned by no step', m => { m.units.report_totals.sql = []; m.units.report_totals.rollback = []; }, /drafts\/13 .* belongs to no step/],
  ['a rollback attached to the wrong step', m => { m.units.line_guard.rollback = ['drafts/24']; m.units.integrity_rules.rollback = ['drafts/18']; }, /drafts\/24 rolls back drafts\/23, which is not part of this step/],
  ['an invented status word', m => { m.units.nightly.production = 'PROBABLY FINE'; }, /not an allowed value/],
];
for (const [name, mutate, re] of cases) {
  test(`caught: ${name}`, () => {
    const m = load(); mutate(m);
    const p = validate(m, SQL);
    expect(p.join('\n')).toMatch(re);
  });
}

test('a correct production story passes: merge → deploy → install with evidence → switch ON with evidence', () => {
  const m = load();
  Object.assign(m.units.merge, { merged: true, deployed: true, production: 'DEPLOYED', productionEvidence: EV });
  Object.assign(m.units.r15, { production: 'VERIFIED', productionEvidence: EV });
  Object.assign(m.units.switch_rows, { production: 'INSTALLED', productionEvidence: EV });
  m.switches.stock_fn_receive_po = { install: 'switch_rows', production: 'ON', productionEvidence: EV };
  m.scores.productionReadinessPercent = 30; // allowed once production evidence exists
  expect(validate(m, SQL)).toEqual([]);
});
