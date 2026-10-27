// Reserve IV — DEAL PROGRESSION & AGING. Dwell time, aging buckets, stall
// detection, progression map. Pure, deterministic (injected asOf), no side
// effects. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const PR = require('../../assets/sales/he-sales-progression.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ASOF = '2026-10-20T00:00:00Z';
const d = n => new Date(Date.parse(ASOF) - n * 86400000).toISOString();

const LEADS = [
  { id: 'fresh', name: 'Fresh Lead', state: 'CONTACTED', createdAt: d(3), enteredStateAt: d(2) },
  { id: 'stuck', name: 'Stuck Draft', state: 'OUTREACH_DRAFTED', createdAt: d(30), enteredStateAt: d(20) },
  { id: 'cold', name: 'Cold Deal', state: 'INTERESTED', createdAt: d(90), enteredStateAt: d(60) },
  { id: 'won', name: 'Closed Won', state: 'CUSTOMER', createdAt: d(120), enteredStateAt: d(10) },
  { id: 'lost', name: 'Gone', state: 'LOST', createdAt: d(80), enteredStateAt: d(50) },
];

test('aging buckets follow time-in-stage; terminal deals are DONE not stalled', () => {
  const a = PR.analyze(LEADS, { asOf: ASOF });
  const by = Object.fromEntries(a.rows.map(r => [r.leadId, r]));
  expect(by.fresh.agingBucket).toBe('FRESH');       // 2 days
  expect(by.stuck.agingBucket).toBe('AGING');        // 20 days (7..21)
  expect(by.cold.agingBucket).toBe('COLD');          // 60 days
  expect(by.won.agingBucket).toBe('DONE');
  expect(by.lost.agingBucket).toBe('DONE');
  expect(by.won.stalled).toBe(false);
  expect(by.lost.stalled).toBe(false);
});

test('stalled = non-terminal past its stage SLA, worst first by overBy', () => {
  const a = PR.analyze(LEADS, { asOf: ASOF });
  const ids = a.stalled.map(r => r.leadId);
  // OUTREACH_DRAFTED SLA 2, sat 20 -> over by 18. INTERESTED SLA 10, sat 60 -> over by 50.
  expect(ids).toContain('stuck');
  expect(ids).toContain('cold');
  expect(ids).not.toContain('fresh'); // CONTACTED SLA 10, only 2 days
  expect(a.stalled[0].leadId).toBe('cold'); // biggest overBy first
  expect(a.stalledCount).toBe(2);
  expect(a.stalled[0].overBy).toBeCloseTo(50, 5);
});

test('ageDays and currentStageDays are measured from the right timestamps', () => {
  const r = PR.analyzeLead(LEADS[2], Date.parse(ASOF));
  expect(r.ageDays).toBeCloseTo(90, 5);
  expect(r.currentStageDays).toBeCloseTo(60, 5);
  expect(r.overBy).toBeCloseTo(50, 5);
});

test('progression map counts active leads per funnel stage in order; terminals separate', () => {
  const a = PR.analyze(LEADS, { asOf: ASOF });
  const map = a.map;
  const contacted = map.stages.find(s => s.stage === 'CONTACTED');
  const drafted = map.stages.find(s => s.stage === 'OUTREACH_DRAFTED');
  expect(contacted.count).toBe(1);
  expect(drafted.count).toBe(1);
  // funnel order: OUTREACH_DRAFTED comes before CONTACTED
  const order = map.stages.map(s => s.stage);
  expect(order.indexOf('OUTREACH_DRAFTED')).toBeLessThan(order.indexOf('CONTACTED'));
  expect(map.terminal.CUSTOMER).toBe(1);
  expect(map.terminal.LOST).toBe(1);
});

test('histogram and active averages ignore terminal deals', () => {
  const a = PR.analyze(LEADS, { asOf: ASOF });
  expect(a.histogram.DONE).toBe(2);
  expect(a.activeCount).toBe(3);
  // avg active age = (3 + 30 + 90) / 3 = 41
  expect(a.avgActiveAgeDays).toBeCloseTo(41, 5);
  expect(a.guard).toMatch(/writes nothing/i);
});

test('missing timestamps are UNKNOWN, never a crash or a fake age', () => {
  const a = PR.analyze([{ id: 'x', state: 'QUALIFIED' }], { asOf: ASOF });
  expect(a.rows[0].agingBucket).toBe('UNKNOWN');
  expect(a.rows[0].ageDays).toBe(null);
  expect(a.rows[0].stalled).toBe(false); // no data -> not asserted stalled
  expect(a.rows[0].dataComplete).toBe(false);
});

test('an SLA override changes what counts as stalled', () => {
  // Give CONTACTED a 1-day SLA; the fresh lead (2 days) now stalls.
  const a = PR.analyze(LEADS, { asOf: ASOF, sla: { CONTACTED: 1 } });
  expect(a.stalled.map(r => r.leadId)).toContain('fresh');
});

test('empty input is safe', () => {
  const a = PR.analyze([], { asOf: ASOF });
  expect(a.rows).toEqual([]);
  expect(a.stalledCount).toBe(0);
  expect(a.activeCount).toBe(0);
  expect(a.avgActiveAgeDays).toBe(0);
});
