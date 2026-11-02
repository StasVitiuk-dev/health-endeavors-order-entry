// EXT20: the agents' safety boundary as the dashboard states it (AGENT_REGISTRY in
// assets/app/he-config.js). The agents themselves run in production (database,
// pg_cron, GitHub workflows of other repositories) and are NOT in this repository;
// their real behaviour is checked by the owner (Query C, OWNER_ACTIONS_EXT20.md).
// What this repository controls is what the dashboard claims and offers, so these
// invariants stop a refactor from silently widening it:
//   * agents 9 and 10 (accounting / tax) only read;
//   * agent 6 (customer notification) cannot send: it only writes its own log;
//   * agent 7 (AI customer service) is off by intent and only drafts;
//   * no agent writes money, refund, payment, tax or customer-message tables;
//   * agent 8 (supervisor) writes only tasks.
// Node only: the registry is read from the shipped file.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node only; once'); });

function registry() {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'assets/app/he-config.js'), 'utf8');
  const a = s.indexOf('const AGENT_REGISTRY = [');
  const b = s.indexOf('\n    ];', a);
  return new Function('return ' + s.slice(a + 'const AGENT_REGISTRY = '.length, b + 6))(); // eslint-disable-line no-new-func
}
const writes = a => a.touches.filter(t => /write/i.test(t)).map(t => t.split(' ')[0]);

test('ten agents, numbered 1-10, each with a stated boundary', () => {
  const R = registry();
  expect(R.map(a => a.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const a of R) { expect(a.touches.length, a.name).toBeGreaterThan(0); expect(String(a.limit || '').length, a.name).toBeGreaterThan(20); }
});

test('accounting and tax agents only read', () => {
  const R = registry();
  for (const n of [9, 10]) {
    const a = R.find(x => x.num === n);
    expect(writes(a), a.name).toEqual([]);
    expect(a.touches.every(t => /\(read\)$/.test(t)), a.name + ': ' + a.touches.join(', ')).toBe(true);
  }
});

test('the customer notification agent cannot send: it only writes its own log', () => {
  const a = registry().find(x => x.num === 6);
  expect(writes(a)).toEqual(['customer_notifications']);
  expect(a.limit).toMatch(/Cannot actually send anything/);
  expect(a.touches.join(' ')).not.toMatch(/email|sms|send|resend|sendgrid|twilio|postmark/i);
});

test('the AI customer service agent is off by intent and only drafts', () => {
  const a = registry().find(x => x.num === 7);
  expect(a.ai).toBe(true);
  expect(a.intendedOff).toBe(true);
  expect(a.limit).toMatch(/Never sends anything itself/);
});

test('no agent writes money, refunds, payments, tax or customer messages; the supervisor writes only tasks', () => {
  const R = registry();
  const forbidden = /^(expenses|payments|refunds|accounting|tax|tax_records|customer_messages|emails|sms)$/;
  for (const a of R) expect(writes(a).filter(t => forbidden.test(t)), a.name).toEqual([]);
  expect(writes(R.find(x => x.num === 8))).toEqual(['tasks']);
  expect(R.filter(a => a.ai).map(a => a.num), 'only agent 7 uses AI').toEqual([7]);
});
