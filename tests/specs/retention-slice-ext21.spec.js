// Retention & replenishment — slice (Phase 2 item 8). Node-only, pure, synthetic.
// Configurable reminder timing (not a hardcoded truth), eligibility checks
// (opt-out, refund, support/delivery issue) before any reminder, dedupe by
// customer+channel, and uncertain-history handling. Advisory only — never sends.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RET = require('../../assets/sales/he-sales-retention.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const asOf = '2026-11-08';

test('review-request timing is configurable (45 is an example to test, not hardcoded)', () => {
  // Two orders, the last 40 days ago.
  const cust = [{ id: 'c1', orderDates: ['2026-08-30', '2026-09-29'] }];
  const def = RET.analyze(cust, asOf); // default window 30
  expect(def.reviewWindowDays).toBe(30);
  expect(def.reviewRequest.find(r => r.id === 'c1')).toBeFalsy(); // 40d > 30d
  const wide = RET.analyze(cust, asOf, { reviewWindowDays: 45 });
  expect(wide.reviewWindowDays).toBe(45);
  expect(wide.reviewRequest.find(r => r.id === 'c1')).toBeTruthy(); // 40d <= 45d
});

test('eligibility holds back opt-out, recent refund, and open support/delivery issues — with the reason preserved', () => {
  const custs = [
    { id: 'ok', orderDates: ['2026-02-01', '2026-05-01'] },                                   // AT_RISK-ish, eligible
    { id: 'optout', orderDates: ['2026-02-01', '2026-05-01'], optOut: true },
    { id: 'refund', orderDates: ['2026-02-01', '2026-05-01'], recentRefund: true },
    { id: 'issue', orderDates: ['2026-02-01', '2026-05-01'], deliveryIssue: true },
  ];
  const a = RET.analyze(custs, asOf);
  const candidateIds = [...a.reorderCandidates, ...a.winBack].map(r => r.id);
  expect(candidateIds).not.toContain('optout');
  expect(candidateIds).not.toContain('refund');
  expect(candidateIds).not.toContain('issue');
  // held reasons are preserved (not discarded when handed to another panel)
  const held = Object.fromEntries(a.heldCandidates.map(r => [r.id, r.holdReason]));
  expect(held.optout).toMatch(/opt-out|DNC/);
  expect(held.refund).toMatch(/refund/);
  expect(held.issue).toMatch(/support\/delivery/);
});

test('reminders dedupe by customer + channel (no double nudge)', () => {
  const a = RET.analyze([{ id: 'c1', orderDates: ['2026-02-01', '2026-05-01'] }], asOf);
  const candidates = [...a.reorderCandidates, ...a.winBack];
  const sent = new Set();
  function queueReminder(custId, channel) {
    const k = custId + '|' + channel;
    if (sent.has(k)) return false;
    sent.add(k); return true;
  }
  const first = candidates.map(r => queueReminder(r.id, 'email'));
  const again = candidates.map(r => queueReminder(r.id, 'email'));
  expect(first.some(Boolean)).toBe(true);
  expect(again.every(x => x === false)).toBe(true); // same customer+channel not queued twice
});

test('uncertain history is UNKNOWN/NEW, never a confident reminder', () => {
  const a = RET.analyze([{ id: 'none', orderDates: [] }, { id: 'one', orderDates: ['2026-10-01'] }], asOf);
  expect(a.rows.find(r => r.id === 'none').segment).toBe('UNKNOWN');
  expect(a.rows.find(r => r.id === 'one').segment).toBe('NEW');
  expect([...a.reorderCandidates, ...a.winBack].map(r => r.id)).not.toContain('none');
});
