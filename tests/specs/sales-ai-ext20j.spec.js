// Sales & Growth: the provider-neutral AI drafter (assets/sales/he-sales-ai.js).
// Proves the free deterministic template provider works, drafts are DRAFT/never
// sent, and paid providers refuse loudly until the owner enables them.
const { test, expect } = require('@playwright/test');
const AI = require('../../assets/sales/he-sales-ai.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ctx = { storeName: 'Blue Harbor Apothecary', contactName: 'Jordan', productName: 'our Sea Foam body-care line', senderName: 'Health Endeavors' };

test('default drafter is the free, offline template provider', () => {
  const d = AI.createDrafter();
  expect(d.providerName).toBe('template');
  expect(d.available).toBe(true);
});

test('every draft is a DRAFT and is never marked sent', () => {
  const d = AI.createDrafter();
  for (const kind of ['intro', 'followup', 'reply_interested']) {
    const out = d.draft(kind, ctx);
    expect(out.status).toBe('DRAFT');
    expect(out.sent).toBe(false);
    expect(out.subject.length).toBeGreaterThan(0);
    expect(out.body).toContain('Health Endeavors');
    expect(out.kind).toBe(kind);
  }
});

test('the template provider is deterministic (same input → same draft)', () => {
  const d = AI.createDrafter();
  expect(d.draft('intro', ctx)).toEqual(d.draft('intro', ctx));
});

test('intro draft personalises greeting and names the store', () => {
  const out = AI.createDrafter().draft('intro', ctx);
  expect(out.body).toContain('Hi Jordan,');
  expect(out.subject).toContain('Blue Harbor Apothecary');
  // No contact name → greets the store team instead.
  const noName = AI.createDrafter().draft('intro', { storeName: 'X Co' });
  expect(noName.body).toContain('Hi X Co team,');
});

test('an unknown draft kind is a clear error', () => {
  expect(() => AI.createDrafter().draft('blast', ctx)).toThrow(/unknown draft kind/);
});

test('paid providers are declared but NOT configured — calling one refuses loudly, never reaches a network', () => {
  for (const name of ['claude', 'openai']) {
    const d = AI.createDrafter({ provider: name });
    expect(d.available).toBe(false);
    expect(() => d.draft('intro', ctx)).toThrow(/not configured|owner must enable/i);
  }
});

test('an unknown provider name is an error, never a silent fallback to a paid one', () => {
  expect(() => AI.createDrafter({ provider: 'mystery' })).toThrow(/unknown provider/);
});
