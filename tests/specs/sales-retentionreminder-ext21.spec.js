// W-5 retention reorder-reminder drafts (FU6). Pure, Node-only, synthetic.
// Reuses he-sales-retention (classify/interval) + he-sales-followup (stopping
// rules). Drafts reorder reminders from synthetic purchase history for human
// review — never sends. Covers consent/opt-out, recent orders, duplicate
// reminders, the follow-up cap and supersession, and makes the reorder cadence
// an EXPLICIT, surfaced assumption.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RR = require('../../assets/sales/he-sales-retentionreminder.js');
const RT = require('../../assets/sales/he-sales-retention.js');
const FU = require('../../assets/sales/he-sales-followup.js');
const C = require('../../assets/sales/he-sales-claims.js');

const deps = { retention: RT, followup: FU, claims: C };

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('an overdue, consented customer gets a first draft reminder; nothing is sent', () => {
  const fx = RR.fixtures();
  const plan = RR.planReminders(fx.customers, fx.asOf, {}, deps);
  expect(plan.sent).toBe(false);
  expect(plan.counts.draft).toBe(1);               // only C-DUE is overdue + consented
  const due = plan.rows.find(r => r.id === 'C-DUE');
  expect(due.status).toBe('DRAFT');
  expect(due.reminderNumber).toBe(1);
  expect(due.text).toMatch(/Draft for owner review/);
  expect(due.published).toBe(false);
});

test('the reorder cadence is an explicit, surfaced assumption', () => {
  const fx = RR.fixtures();
  const plan = RR.planReminders(fx.customers, fx.asOf, {}, deps);
  // Customer with history: cadence is their own interval, basis stated.
  const due = plan.rows.find(r => r.id === 'C-DUE');
  expect(due.cadenceBasis).toBe('customer-interval');
  expect(due.cadenceDays).toBeGreaterThan(0);
  // Customer without a known interval falls back to the explicit default, named.
  const fresh = plan.rows.find(r => r.id === 'C-NEW');
  expect(fresh.cadenceBasis).toBe('explicit-default');
  expect(plan.cadenceDefault).toBe(RR.DEFAULT_CADENCE_DAYS);
  // The default is overridable per call.
  const d5 = RR.reminderDraft({ customer: { id: 'X', storeName: 'X', orderDates: [] }, asOf: fx.asOf, cadenceDays: 5, retention: RT, followup: FU, claims: C });
  expect(d5.cadenceDays).toBe(5);
});

test('consent/opt-out and a recent order both stop a reminder', () => {
  const fx = RR.fixtures();
  const plan = RR.planReminders(fx.customers, fx.asOf, {}, deps);
  expect(plan.rows.find(r => r.id === 'C-OPTOUT').status).toBe('SUPPRESSED'); // retention opt-out
  expect(plan.rows.find(r => r.id === 'C-RECENT').status).toBe('NOT_DUE');    // ordered recently
  // A reminder-specific opt-out also suppresses, even a first reminder.
  const optout = RR.reminderDraft({ customer: fx.customers[0], asOf: fx.asOf, reminderState: { optedOut: true }, retention: RT, followup: FU, claims: C });
  expect(optout.status).toBe('SUPPRESSED');
});

test('duplicate reminders are prevented, the cap stops the sequence, and a new order supersedes', () => {
  const fx = RR.fixtures();
  const cust = fx.customers[0]; // C-DUE, overdue
  // A reminder already sent one day ago (within cadence) -> no duplicate this cycle.
  const dup = RR.reminderDraft({ customer: cust, asOf: fx.asOf, reminderState: { remindersSent: 1, lastReminderAt: '2026-11-08' }, retention: RT, followup: FU, claims: C });
  expect(dup.status).toBe('DUPLICATE');
  // At the reminder cap, the sequence stops.
  const stopped = RR.reminderDraft({ customer: cust, asOf: fx.asOf, reminderState: { remindersSent: 3, lastReminderAt: '2026-01-01' }, retention: RT, followup: FU, claims: C });
  expect(stopped.status).toBe('STOPPED');
  // A newer order after the last reminder supersedes a pending one.
  const superseded = RR.reminderDraft({ customer: cust, asOf: fx.asOf, reminderState: { remindersSent: 1, lastReminderAt: '2026-09-01', lastOrderAt: '2026-11-08' }, retention: RT, followup: FU, claims: C });
  expect(superseded.status).toBe('SUPERSEDED');
});

test('reminder wording is claim-checked (fail closed)', () => {
  // Force a prohibited product name into the reminder wording.
  const d = RR.reminderDraft({ customer: { id: 'Z', storeName: 'Z Spa', orderDates: ['2026-01-01', '2026-03-01'] }, asOf: '2026-11-09', product: 'our eczema cure', retention: RT, followup: FU, claims: C });
  expect(d.status).toBe('BLOCKED');
  expect(d.claimFindings.length).toBeGreaterThan(0);
  expect(d.sent).toBe(false);
});
