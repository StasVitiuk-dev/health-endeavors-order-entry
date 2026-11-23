// Reserve IV — REPLY TRIAGE LAB. Batch-classifies replies and surfaces what the
// classifier is unsure about, with a suppression-review bucket. Pure,
// deterministic, no auto-action. Uses the real he-sales-replies classifier.
// Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const LAB = require('../../assets/sales/he-sales-replylab.js');
const REPLIES = require('../../assets/sales/he-sales-replies.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const BATCH = [
  { id: 'r1', text: 'Please unsubscribe me from this list' },          // suppress
  { id: 'r2', text: 'What is your wholesale pricing and MOQ?' },        // clear-ish
  { id: 'r3', text: 'asdf qwer zxcv' },                                 // UNKNOWN
  { id: 'r4', text: 'Mailer-Daemon: delivery failed permanently' },     // bounce (suppress)
  { id: 'r5', text: 'We might be interested, tell me more about the line' },
];

test('triage runs the real classifier and buckets every reply once', () => {
  const t = LAB.triage(BATCH, REPLIES);
  expect(t.count).toBe(5);
  // confidence distribution sums to count
  const cs = t.confidence.high + t.confidence.medium + t.confidence.low + t.confidence.unknown;
  expect(cs).toBe(5);
  // every reply is either in review, suppress-review, or auto-clear
  expect(t.reviewCount + t.suppressCount + t.autoClearCount).toBe(5);
  expect(t.noAutoAction).toBe(true);
  expect(t.guard).toMatch(/owner confirms every suppression/i);
});

test('opt-out and bounce land in suppression review, never auto-applied', () => {
  const t = LAB.triage(BATCH, REPLIES);
  const ids = t.suppressReview.map(r => r.id);
  expect(ids).toContain('r1'); // unsubscribe
  expect(ids).toContain('r4'); // bounce
  for (const r of t.suppressReview) expect(r.suppress).toBe(true);
});

test('an unintelligible reply is UNKNOWN and sits first in the review queue', () => {
  const t = LAB.triage(BATCH, REPLIES);
  const r3 = t.rows.find(r => r.id === 'r3');
  expect(r3.label).toBe('UNKNOWN');
  expect(r3.confidence).toBe('unknown');
  // review queue is least-certain first
  expect(t.reviewQueue[0].confRank).toBeLessThanOrEqual(t.reviewQueue[t.reviewQueue.length - 1].confRank);
  expect(t.reviewQueue.map(r => r.id)).toContain('r3');
});

test('uncertainShare is a 0..1 calibration signal', () => {
  const t = LAB.triage(BATCH, REPLIES);
  expect(t.uncertainShare).toBeGreaterThanOrEqual(0);
  expect(t.uncertainShare).toBeLessThanOrEqual(1);
});

test('deterministic: same batch yields the same queue order', () => {
  const a = LAB.triage(BATCH, REPLIES).reviewQueue.map(r => r.id);
  const b = LAB.triage(BATCH, REPLIES).reviewQueue.map(r => r.id);
  expect(a).toEqual(b);
});

test('empty batch is safe; a missing classifier throws (never silently passes)', () => {
  const t = LAB.triage([], REPLIES);
  expect(t.count).toBe(0);
  expect(t.uncertainShare).toBe(0);
  expect(() => LAB.triage(BATCH, {})).toThrow(/no classifier/);
});

test('an injected stub classifier is honored (purity)', () => {
  const stub = { classify: () => ({ label: 'INTERESTED', confidence: 'high', reasons: [] }), suppresses: () => false };
  const t = LAB.triage([{ id: 'x', text: 'hi' }], stub);
  expect(t.autoClearCount).toBe(1);
  expect(t.reviewCount).toBe(0);
});
