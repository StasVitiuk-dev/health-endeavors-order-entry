// #70/#71 scheduled reports + versioning. Pure, Node-only, synthetic. Daily
// generation vs an expected schedule, IMMUTABLE versions with reruns appended
// (never overwritten), and SIMULATED delivery states with safe retry. No real
// email provider — delivery never actually sends.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const S = require('../../assets/reports/he-report-schedule.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

function book() {
  const fx = S.scheduleFixtures();
  const b = S.createReportBook();
  b.generate('2026-11-11', fx.day11, '2026-11-11T06:00:00Z');
  b.generate('2026-11-13', fx.day13, '2026-11-13T06:00:00Z');
  return { b, fx };
}

test('the schedule check reports which expected days ran and which were missed', () => {
  const { b, fx } = book();
  const s = b.scheduleStatus(fx.expected);
  expect(s.present).toEqual(['2026-11-11', '2026-11-13']);
  expect(s.missing).toEqual(['2026-11-12']);
  expect(s.complete).toBe(false);
});

test('a rerun appends a new immutable version with its own checksum; history is preserved', () => {
  const { b, fx } = book();
  const r = b.generate('2026-11-13', fx.day13v2, '2026-11-13T18:00:00Z'); // corrected numbers
  expect(r.isRerun).toBe(true);
  expect(r.version.version).toBe(2);
  const versions = b.versions('2026-11-13');
  expect(versions.map(v => v.version)).toEqual([1, 2]);
  expect(versions[0].checksum).not.toBe(versions[1].checksum); // different content
  expect(b.latest('2026-11-13').version).toBe(2);
  // the first version is unchanged by the rerun (immutable history).
  expect(versions[0].rows[0].revenue).toBe(150);
});

test('an identical rerun produces the same checksum (content-addressed)', () => {
  const { b, fx } = book();
  b.generate('2026-11-11', fx.day11, '2026-11-11T20:00:00Z'); // same rows again
  const v = b.versions('2026-11-11');
  expect(v).toHaveLength(2);
  expect(v[0].checksum).toBe(v[1].checksum); // identical content -> identical checksum
});

test('a saved version is immutable: mutating it does not change the book', () => {
  const { b } = book();
  const v = b.versions('2026-11-11')[0];
  expect(Object.isFrozen(v)).toBe(true);
  try { v.rows[0].revenue = 999; } catch (e) { /* strict mode throws; fine */ }
  expect(b.versions('2026-11-11')[0].rows[0].revenue).toBe(100);
});

test('delivery is simulated with safe retry and never actually sends', () => {
  const { b } = book();
  let d = S.queueDelivery(b.latest('2026-11-13'), 'email', '2026-11-13T07:00:00Z');
  expect(d.state).toBe('QUEUED');
  expect(d.real).toBe(false);
  expect(d.dependency).toMatch(/email provider/);
  // held for retry, then requeued, then simulated-sent.
  expect(S.canDeliveryTransition('QUEUED', 'HELD')).toBe(true);
  d = S.applyDelivery(d, 'HELD').record;
  d = S.applyDelivery(d, 'QUEUED').record;
  d = S.applyDelivery(d, 'SENT').record;
  expect(d.state).toBe('SENT');
  expect(d.delivered).toBe(false);   // simulated — nothing left the building
  expect(d.sent).toBe(false);
  expect(d.history).toEqual(['QUEUED', 'HELD', 'QUEUED', 'SENT']);
  // SENT is terminal; an illegal transition is refused.
  expect(S.applyDelivery(d, 'QUEUED').ok).toBe(false);
  // a FAILED delivery can be retried.
  let d2 = S.queueDelivery(b.latest('2026-11-11'), 'email');
  d2 = S.applyDelivery(d2, 'FAILED').record;
  expect(S.canDeliveryTransition('FAILED', 'QUEUED')).toBe(true);
  expect(S.applyDelivery(d2, 'QUEUED').record.state).toBe('QUEUED');
});
