// EXT12: incident response map (tests/tools/incidents.js). Node-only.
// Every screen phrase it relies on must exist in the real page, so training
// and the page cannot drift apart; unknown outcomes are never "safe to retry"
// without a request key; nothing is repaired automatically.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const I = require('../tools/incidents');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const PAGE = fs.readFileSync(path.join(__dirname, '..', '..', 'owner-login.html'), 'utf8');

test('the map passes its own rules', () => {
  expect(I.validate()).toEqual([]);
});

test('every screen phrase in the map exists in the real page', () => {
  const missing = [];
  for (const s of I.SCENARIOS) for (const p of s.signal.page || []) if (!PAGE.includes(p)) missing.push(s.id + ': ' + p);
  expect(missing).toEqual([]);
});

test('the mission\'s incident areas are all covered', () => {
  const ids = I.SCENARIOS.map(s => s.id);
  for (const want of ['po-receive-unknown', 'return-unknown', 'recall-unknown', 'adjust-negative', 'product-delete', 'save-unknown-with-keys', 'nightly-not-installed', 'rls-denied', 'audit-gap', 'agent-unknown', 'backup-stale', 'dashboard-unavailable', 'session-ended', 'conflict', 'data-drift', 'stock-fn-missing'])
    expect(ids).toContain(want);
});

test('validate catches an unsafe map (unknown outcome marked safe, stock without owner, forbidden step)', () => {
  const base = I.SCENARIOS.find(s => s.id === 'po-receive-unknown');
  expect(I.validate([{ ...base, retry: 'SAFE' }]).join()).toMatch(/cannot be safe to retry/);
  expect(I.validate([{ ...base, escalate: 'none' }]).join()).toMatch(/go to the owner/);
  expect(I.validate([{ ...base, first: ['Run SQL to fix the stock'] }]).join()).toMatch(/forbidden step/);
  expect(I.validate([{ ...base, first: ['Issue a refund to the customer'] }]).join()).toMatch(/forbidden step/);
  expect(I.validate([{ ...base, retry: 'maybe' }]).join()).toMatch(/retry must be/);
  expect(I.validate([base, base]).join()).toMatch(/duplicate id/);
  expect(I.validate([{ ...base, signal: {} }]).join()).toMatch(/no signal/);
});

test('lookup matches only exact screen text; unknown text gives no match', () => {
  expect(I.lookup('Receipt status unknown — do not press Receive again').map(s => s.id)).toEqual(['po-receive-unknown']);
  expect(I.lookup('This entry may or may not have been saved. Check the list').map(s => s.id)).toEqual(['save-unknown-no-keys']);
  expect(I.lookup('something odd happened')).toEqual([]);
  expect(I.lookup(undefined)).toEqual([]);
});

test('every card states the retry rule and that no repair is automatic', () => {
  for (const s of I.SCENARIOS) {
    const c = I.card(s);
    expect(c).toContain('Retry: ' + s.retry);
    expect(c).toContain('No automatic repair');
    if (s.stop) expect(c).toContain('STOP.');
  }
});
