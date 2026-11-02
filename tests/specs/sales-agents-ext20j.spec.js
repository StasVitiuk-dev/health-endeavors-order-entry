// Sales & Growth advisory agent registry (assets/sales/he-sales-agents.js).
// The whole point of the registry is safety: every agent is OFF by default and
// can only advise (observe/score/flag/draft/summarize/simulate), never act.
const { test, expect } = require('@playwright/test');
const AG = require('../../assets/sales/he-sales-agents.js');
const U = require('../../assets/sales/he-sales-ui.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('every advisory agent is OFF by default', () => {
  expect(AG.AGENTS.length).toBeGreaterThanOrEqual(24);
  for (const a of AG.AGENTS) { expect(a.enabled).toBe(false); expect(a.mode).toBe('OFF'); }
});

test('no agent holds an acting capability — advisory only (fails closed)', () => {
  expect(AG.assertSafe()).toBe(true);
  for (const a of AG.AGENTS) for (const c of a.caps) {
    expect(AG.SAFE_CAPS).toContain(c);
    expect(AG.FORBIDDEN_CAPS).not.toContain(c);
  }
});

test('assertSafe throws if an agent is enabled, un-OFF, or gains a forbidden capability', () => {
  expect(() => AG.assertSafe([{ id: 'x', caps: [], enabled: true, mode: 'OFF' }])).toThrow(/not OFF/);
  expect(() => AG.assertSafe([{ id: 'x', caps: [], enabled: false, mode: 'DRAFT_ONLY' }])).toThrow(/mode not OFF/);
  expect(() => AG.assertSafe([{ id: 'x', caps: ['send'], enabled: false, mode: 'OFF' }])).toThrow(/forbidden|non-advisory/);
  expect(() => AG.assertSafe([{ id: 'x', caps: ['approve'], enabled: false, mode: 'OFF' }])).toThrow(/forbidden|non-advisory/);
});

test('agent ids are unique and every agent has a purpose and a group', () => {
  const ids = AG.AGENTS.map(a => a.id);
  expect(ids.length).toBe(new Set(ids).size);
  for (const a of AG.AGENTS) { expect(a.purpose.length).toBeGreaterThan(10); expect(a.group.length).toBeGreaterThan(0); }
});

test('activityRows feed the agent-activity view with honest UNKNOWN health (never run)', () => {
  const rows = AG.activityRows();
  expect(rows.length).toBe(AG.AGENTS.length);
  const vm = U.agentActivityView(rows);
  expect(vm.state).toBe('OK');
  // None has ever run -> every health is UNKNOWN, never a fake OK.
  for (const r of vm.rows) expect(r.health).toBe('UNKNOWN');
});

test('summary counts are consistent and report zero enabled', () => {
  const s = AG.summary();
  expect(s.total).toBe(AG.AGENTS.length);
  expect(s.enabled).toBe(0);
  expect(Object.values(s.byGroup).reduce((a, b) => a + b, 0)).toBe(s.total);
});
