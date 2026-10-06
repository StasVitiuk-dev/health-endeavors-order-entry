// Failure-injection matrix (2026-10-06, EXT3 workstream 3).
//
// Every single-step action below is run five times, each time with a
// different failure on its one database write:
//   server500  – the database answers with an error
//   rls403     – a row-level-security refusal (raw text names the table/policy)
//   constraint – a CHECK-rule refusal (raw text names the constraint)
//   dropBefore – the connection drops before the database saved anything
//   dropAfter  – the connection drops AFTER the database saved the change
// Rules checked every time:
//   * never a success message;
//   * an error is shown, without internal table/policy/constraint names and
//     without the raw browser text ("Failed to fetch");
//   * refused / dropped-before: the record is unchanged;
//   * dropped-after: the record IS changed, and the page says it cannot tell
//     whether the change was saved (never "nothing was changed").
// Multi-step workflows (receive, refund, quarantine, uploads) have their own
// step-by-step failure tests (po-receive, failure-recovery, storage-safety)
// and, for true all-or-nothing behaviour, need the R1–R5 database functions.

const { test, expect, login } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');
const { WORKFLOWS, RAW_INTERNALS, open } = require('../fixtures/fault-workflows');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'fault matrix; run once'); });

const FAULTS = {
  server500: b => b.failNext,
  rls403: null, constraint: null, dropBefore: null, dropAfter: null,
};


for (const w of WORKFLOWS) {
  for (const fault of Object.keys(FAULTS)) {
    test(`${w.name} — ${fault}`, async ({ page, backend }) => {
      if (w.business) seedBusiness(backend); else if (w.seed) w.seed(backend);
      enableWrites(backend, [w.table]);
      backend.expectViolations = fault === 'constraint';
      await page.clock.setFixedTime(NOW);
      await login(page);
      await open(page, w.page);
      expect(w.value(backend)).toEqual(w.before);

      if (fault === 'server500') backend.failNext(w.table, w.method, { status: 500, body: { message: 'Synthetic server error' } });
      if (fault === 'rls403') backend.failNext(w.table, w.method, { status: 403, body: { code: '42501', message: `new row violates row-level security policy for table "${w.table}"` } });
      if (fault === 'constraint') backend.failNext(w.table, w.method, { status: 400, body: { code: '23514', message: `new row for relation "${w.table}" violates check constraint "${w.table}_synthetic_check"` } });
      if (fault === 'dropBefore') backend.dropNext(w.table, w.method, { applied: false });
      if (fault === 'dropAfter') backend.dropNext(w.table, w.method, { applied: true });

      await w.act(page);
      const err = page.locator('#dashError');
      await expect(err).toBeVisible();
      const text = (await err.textContent()) || '';
      expect(text, 'no internal names or raw browser text').not.toMatch(RAW_INTERNALS);
      await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);

      if (fault === 'dropAfter') {
        expect(w.value(backend), 'the database did save it').toEqual(w.after);
        expect(text).toContain('cannot tell whether');
        expect(text).not.toMatch(/nothing was (changed|saved)/i);
      } else {
        expect(w.value(backend), 'nothing changed').toEqual(w.before);
      }
      if (fault === 'dropBefore') expect(text).toContain('cannot tell whether');
      if (fault === 'rls403') expect(text).toContain('only the Owner or an Administrator');
    });
  }
}
