// Sales & Growth: B2B mailbox connector contract + double (assets/sales/he-sales-gmail.js).
// Proves SEND is disabled by default, the send guards (approval, suppression,
// duplicate, connection) all hold, and READ/DRAFT/SEND are separate capabilities.
const { test, expect } = require('@playwright/test');
const G = require('../../assets/sales/he-sales-gmail.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('the real default is NOT connected with SEND off', () => {
  expect(G.REAL_DEFAULT.connected).toBe(false);
  expect(G.REAL_DEFAULT.capabilities.send).toBe(false);
  const mb = G.createMailbox();
  expect(mb.state).toBe('NOT_CONNECTED');
  expect(mb.can('send')).toBe(false);
});

test('drafting needs the DRAFT capability and is offline/synthetic', () => {
  expect(() => G.createMailbox().draft({ leadId: 'L1', to: 'a@b.com', subject: 'Hi' })).toThrow(/DRAFT capability is off/);
  const mb = G.createMailbox({ capabilities: { draft: true } });
  const d = mb.draft({ leadId: 'L1', to: 'a@b.com', subject: 'Hi', body: '...' });
  expect(d.status).toBe('DRAFT');
});

test('a draft with SEND off cannot be sent, even after owner approval', () => {
  const mb = G.createMailbox({ capabilities: { draft: true }, connected: false });
  const d = mb.draft({ key: 'k1', leadId: 'L1', to: 'a@b.com', subject: 'Hi', body: '...' });
  mb.attachApproval('k1', { owner: 'Stas' });
  expect(d.status).toBe('APPROVED_FOR_SEND'); // approval != send
  expect(() => mb.send('k1')).toThrow(/SEND is disabled/);
});

test('even with a synthetic SEND-enabled double, the guards hold', () => {
  const mb = G.createMailbox({ capabilities: { draft: true, send: true }, connected: true });
  mb.draft({ key: 'k1', leadId: 'L1', to: 'buyer@store.com', subject: 'Hi', body: '...' });
  // no approval yet → refused
  expect(() => mb.send('k1')).toThrow(/without an owner approval/);
  mb.attachApproval('k1', { owner: 'Stas' });
  expect(mb.send('k1').status).toBe('SENT'); // synthetic only
  // duplicate send blocked
  expect(() => mb.send('k1')).toThrow(/duplicate send blocked/);
});

test('suppressed recipients (do-not-contact / unsubscribe / bounce) are never sent to', () => {
  const mb = G.createMailbox({ capabilities: { draft: true, send: true }, connected: true });
  mb.draft({ key: 'k2', leadId: 'L2', to: 'stop@store.com', subject: 'Hi', body: '...' });
  mb.attachApproval('k2', { owner: 'Stas' });
  mb.suppress('stop@store.com', 'unsubscribe');
  expect(() => mb.send('k2')).toThrow(/suppressed/);
});

test('inbound bounce/unsubscribe auto-suppress the sender', () => {
  const mb = G.createMailbox({ capabilities: { read: true } });
  expect(mb.receive({ from: 'x@store.com', kind: 'BOUNCE' }).suppressedNow).toBe(true);
  expect(mb.isSuppressed('X@Store.com')).toBe(true);
});

test('attachApproval requires an owner actor', () => {
  const mb = G.createMailbox({ capabilities: { draft: true } });
  mb.draft({ key: 'k3', leadId: 'L3', to: 'a@b.com', subject: 'Hi' });
  expect(() => mb.attachApproval('k3', {})).toThrow(/needs an owner actor/);
});
