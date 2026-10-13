// EXT18: parsers and patterns that read text from outside the page.
//   * slow-regex audit (tests/tools/regex-audit.js) passes, and its detectors fire
//   * explainDbError / maskSensitive stay fast on a 1 MB value and still work
// Node only, on the real functions copied out of the page (helpers/extract-source.js).
const base = require('@playwright/test');
const { load } = require('../helpers/extract-source');
const regex = require('../tools/regex-audit');
const test = base.test, expect = base.expect;

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only checks; once'); });

const H = load(['explainDbError', 'maskSensitive', 'esc']);
const timed = f => { const t0 = Date.now(); const r = f(); return [r, Date.now() - t0]; };
const MB = 1024 * 1024;

test('slow-regex audit passes on every shipped pattern', () => {
  const r = regex.audit();
  expect(r.findings).toEqual([]);
  expect(r.count).toBeGreaterThan(100);
});

test('slow-regex audit: the shape check fires on exponential patterns and not on ordinary ones', () => {
  for (const bad of ['(a+)+$', '(\\s*x)*y', '(a|b+)*c', '((ab)*)+', '(x{2,})+']) expect(regex.nestedQuantifier(bad), bad).toBe(true);
  for (const ok of ['a+b+', '(ab)+', '[a+]+', '(\\+)+', '^\\d+(\\.\\d+)?$', '(a|b)c*']) expect(regex.nestedQuantifier(ok), ok).toBe(false);
});

test('slow-regex audit: an unlisted slow pattern fails, a cap that is too large fails, a stale entry fails', () => {
  const list = require('../tools/regex-audit-reviewed.json');
  // one run with four planted problems (each audit takes several seconds)
  const planted = { ...list, dynamic: [], patterns: [
    ...list.patterns.slice(2),                                  // first two removed
    { ...list.patterns[1], maxInput: 40000 },                   // second: a cap far too large
    { file: 'assets/owner-login-helpers.js', regex: '/gone/', maxInput: 10, reason: 'no longer in the code' },
  ] };
  const f = regex.audit(planted).findings.join('\n');
  expect(f).toMatch(/cap its input and list it/);
  expect(f).toMatch(/still takes .* at its reviewed cap of 40000/);
  expect(f).toMatch(/stale reviewed pattern/);
  expect(f).toMatch(/built at run time, not reviewed/);
});

test('explainDbError: a 1 MB error is handled in well under a second and still explained', () => {
  const pad = ' '.repeat(MB);
  let [out, ms] = timed(() => H.explainDbError('TypeError: Failed to fetch' + pad));
  expect(ms).toBeLessThan(500);
  expect(out).toContain('cannot tell whether this was saved');
  expect(out.length).toBeLessThan(2400);
  [out, ms] = timed(() => H.explainDbError('Request failed: ' + pad + '<!DOCTYPE html><html><body>502</body></html>'));
  expect(ms).toBeLessThan(500);
  [out, ms] = timed(() => H.explainDbError('deadlock detected' + ' :'.repeat(MB / 2)));
  expect(ms).toBeLessThan(500);
  expect(out).toContain('Nothing was changed by this step');
  // a complete long JSON detail is not mistaken for a cut-off reply
  const json = '{"detail":"' + 'x'.repeat(5000) + '"}';
  expect(H.explainDbError('Bad value ' + json)).not.toContain('cut off');
  expect(H.explainDbError('Bad value ' + json.slice(0, 3000))).toContain('cut off');
});

test('maskSensitive: a 1 MB value is masked in well under a second; an address near the cut is still masked', () => {
  const [out, ms] = timed(() => H.maskSensitive('a'.repeat(MB) + '@' + 'b'.repeat(MB)));
  expect(ms).toBeLessThan(500);
  expect(out.length).toBeLessThanOrEqual(301);
  const near = 'x '.repeat(995) + 'owner@example.test failed';
  expect(H.maskSensitive(near)).not.toContain('owner@');
  expect(H.maskSensitive(' '.repeat(5000) + '@').length).toBeLessThanOrEqual(301);
});
