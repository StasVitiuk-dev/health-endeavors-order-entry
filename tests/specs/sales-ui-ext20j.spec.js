// Sales & Growth: synthetic fixtures + page view-models + sink-free render adapter
// (assets/sales/he-sales-fixtures.js, he-sales-ui.js).
const { test, expect } = require('@playwright/test');
const F = require('../../assets/sales/he-sales-fixtures.js');
const U = require('../../assets/sales/he-sales-ui.js');
const L = require('../../assets/sales/he-sales-leads.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('fixtures are deterministic and clearly synthetic (example.com, synthetic flag)', () => {
  const a = F.leads(10, 42), b = F.leads(10, 42);
  expect(a).toEqual(b);
  for (const l of a) { expect(l.synthetic).toBe(true); expect(l.website).toMatch(/\.example\.com$/); expect(l.id).toMatch(/^SYN-/); }
});

test('feature flag off -> every page is DISABLED with no data work', () => {
  const off = { enabled: false };
  const calls = [
    U.commandCenter(null, off), U.leadsView(null, off), U.pipelineView(null, [], off),
    U.approvalsView(null, off), U.samplesView(null, off), U.analyticsView(null, off), U.agentActivityView(null, off),
  ];
  for (const vm of calls) expect(vm.state).toBe('DISABLED');
});

test('loading and error states short-circuit', () => {
  expect(U.commandCenter({}, { loading: true }).state).toBe('LOADING');
  expect(U.leadsView([], { error: 'boom' }).state).toBe('ERROR');
});

test('command center labels synthetic data as SIMULATED and unknowns as UNKNOWN', () => {
  const vm = U.commandCenter({ newLeads: 12, qualifiedLeads: 5, draftsAwaiting: 3, sampleBudget: null, aiMonthlyCost: null });
  expect(vm.state).toBe('OK');
  const pipeline = vm.sections.find(s => s.heading === 'Pipeline');
  expect(pipeline.rows.find(r => r.k === 'New leads').label).toBe('SIMULATED');
  const samples = vm.sections.find(s => s.heading === 'Samples');
  expect(samples.rows.find(r => r.k === 'Monthly budget').label).toBe('OWNER_INPUT_REQUIRED');
  const ai = vm.sections.find(s => s.heading === 'AI usage');
  expect(ai.rows[0].label).toBe('UNKNOWN');
});

test('empty command center reports EMPTY', () => {
  expect(U.commandCenter({ newLeads: 0, qualifiedLeads: 0, draftsAwaiting: 0 }).state).toBe('EMPTY');
});

test('leads view ranks fixtures through the real scorer and marks them SIMULATED', () => {
  const ranked = L.rank(F.leads(8, 7));
  const vm = U.leadsView(ranked);
  expect(vm.state).toBe('OK');
  expect(vm.count).toBe(8);
  expect(vm.rows[0].label).toBe('SIMULATED');
  expect(typeof vm.rows[0].score).toBe('number');
});

test('approvals view states APPROVE != SEND', () => {
  const vm = U.approvalsView([{ kind: 'intro', leadId: 'L1', status: 'DRAFT', provider: 'template' }]);
  expect(vm.approveMeansSend).toBe(false);
  expect(vm.rows[0].sendNote).toMatch(/NOT SENT/);
});

test('analytics view shows UNKNOWN (not 0%) for null rates', () => {
  const vm = U.analyticsView({ replyRate: 0.3, interestRate: null });
  expect(vm.rows.find(r => r.k === 'Interest rate').label).toBe('UNKNOWN');
  expect(vm.rows.find(r => r.k === 'Reply rate').label).toBe('ESTIMATED');
});

test('agent activity never reports a fake healthy state', () => {
  const vm = U.agentActivityView([{ name: 'Outreach Advisor', lastError: 'timeout' }, { name: 'Lead Scorer', lastRun: 't', draftsCreated: 2 }, { name: 'New', }]);
  expect(vm.rows[0].health).toBe('ERROR');
  expect(vm.rows[1].health).toBe('OK');
  expect(vm.rows[2].health).toBe('UNKNOWN'); // never run -> not "healthy"
});

test('render uses the injected h() only — no HTML strings / innerHTML', () => {
  const calls = [];
  const h = (tag, attrs, ...kids) => { calls.push(tag); return { tag, attrs: attrs || {}, kids: kids.flat() }; };
  const vm = U.commandCenter({ newLeads: 1, qualifiedLeads: 0, draftsAwaiting: 0 });
  const node = U.render(vm, h);
  expect(node.tag).toBe('section');
  expect(calls).toContain('h2');
  expect(calls).toContain('div');
  // no attrs object carries innerHTML / srcdoc / on*
  const badAttr = JSON.stringify(vm).match(/innerHTML|srcdoc/i);
  expect(badAttr).toBe(null);
  expect(() => U.render(vm, null)).toThrow(/inject the h/);
});
