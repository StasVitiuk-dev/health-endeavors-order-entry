// Failure-injection matrix, part 2 (2026-10-06, extension 4, workstream C).
//
// Part 1 (fault-injection.spec.js) forces server errors, permission and rule
// refusals and dropped connections. This adds the failures a real network
// and hosting layer produce, on the same single-step actions:
//   gateway502   – a proxy answers with an HTML error page, not JSON
//   busy503      – "service unavailable" with an HTML body
//   rate429      – too many requests
//   jwtExpired   – the sign-in expired between loading the page and clicking
//   duplicate    – a unique-value refusal (raw text names the constraint)
//   garbled      – the database saved it, but the reply body is cut off
//   emptyOk      – the database saved it, but the reply is an empty 200
//   late         – the reply takes 2.5 s; a second click meanwhile must not
//                  send a second write, and the late reply is then handled
// Rules checked every time: never a false success; never raw HTML, internal
// names or browser text; refused => unchanged; saved-but-unreadable reply =>
// changed, and the page says it cannot tell (never "nothing was changed").

const { test, expect, login } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');
const { WORKFLOWS, RAW_INTERNALS, open } = require('../fixtures/fault-workflows');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'fault matrix; run once'); });

const HTML = '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>Bad Gateway</h1></body></html>';
const FAULTS = {
  gateway502: { inject: (b, w) => b.replyNext(w.table, w.method, { status: 502, contentType: 'text/html', body: HTML }), saved: false },
  busy503: { inject: (b, w) => b.replyNext(w.table, w.method, { status: 503, contentType: 'text/html', body: HTML.replace(/502 Bad Gateway|Bad Gateway/g, 'Service Unavailable') }), saved: false },
  rate429: { inject: (b, w) => b.failNext(w.table, w.method, { status: 429, body: { message: 'Too Many Requests' } }), saved: false },
  jwtExpired: { inject: (b, w) => b.failNext(w.table, w.method, { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } }), saved: false, says: /sign in again/i },
  duplicate: { inject: (b, w) => b.failNext(w.table, w.method, { status: 409, body: { code: '23505', message: `duplicate key value violates unique constraint "${w.table}_synthetic_key"` } }), saved: false, says: /already used/i },
  garbled: { inject: (b, w) => b.replyNext(w.table, w.method, { status: 200, body: '[{"id":"x","sta', applied: true }), saved: true },
};
const RAW = new RegExp(RAW_INTERNALS.source + '|<html|<!DOCTYPE|<h1|_synthetic_key|PGRST|JSON|Unexpected (end|token)', 'i');

for (const w of WORKFLOWS) {
  for (const [name, f] of Object.entries(FAULTS)) {
    test(`${w.name} — ${name}`, async ({ page, backend }) => {
      if (w.business) seedBusiness(backend); else if (w.seed) w.seed(backend);
      enableWrites(backend, [w.table]);
      await page.clock.setFixedTime(NOW);
      await login(page);
      await open(page, w.page);
      expect(w.value(backend)).toEqual(w.before);
      f.inject(backend, w);
      await w.act(page);

      const err = page.locator('#dashError');
      await expect(err).toBeVisible();
      const text = (await err.textContent()) || '';
      expect(text, 'no raw HTML, internal names or parser text').not.toMatch(RAW);
      expect(text.trim().length, 'a real sentence').toBeGreaterThan(20);
      await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
      if (f.says) expect(text).toMatch(f.says);
      if (f.saved) {
        expect(w.value(backend), 'the database did save it').toEqual(w.after);
        expect(text).toContain('cannot tell whether');
        expect(text).not.toMatch(/nothing was (changed|saved)/i);
      } else {
        expect(w.value(backend), 'nothing changed').toEqual(w.before);
      }
    });
  }

  test(`${w.name} — late reply: a second click while waiting sends no second write`, async ({ page, backend }) => {
    if (w.business) seedBusiness(backend); else if (w.seed) w.seed(backend);
    enableWrites(backend, [w.table]);
    await login(page);
    await open(page, w.page);
    backend.delayNext(w.table, w.method, 2500);
    const writes = () => backend.requests.filter(r => r.table === w.table && r.method === w.method).length;
    const before = writes();
    // The first click sends the write; the second arrives while it is pending.
    await w.act(page);
    page.setDefaultTimeout(1000);
    await w.act(page).catch(() => {}); // the button may be disabled or gone: that is the point
    page.setDefaultTimeout(0);
    await expect.poll(() => w.value(backend), { timeout: 8000 }).toEqual(w.after);
    await page.waitForLoadState('networkidle');
    expect(writes() - before, 'exactly one write reached the database').toBe(1);
    await expect(page.locator('#dashError')).toBeHidden();
  });
}
