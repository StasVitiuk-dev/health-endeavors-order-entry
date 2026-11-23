// Sales & Growth: sample safety system (assets/sales/he-sales-samples.js).
// Proves the funnel gate, owner-approval requirement, no-SENT-before-APPROVED,
// monthly budget guard + audited override, advisory candidate scoring, and ROI
// that never invents missing costs.
const { test, expect } = require('@playwright/test');
const S = require('../../assets/sales/he-sales-samples.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('eligibility: only serious stages can request a sample', () => {
  for (const s of ['NEW', 'CONTACTED', 'REPLIED', 'INTERESTED', 'NOT_NOW', 'DECLINED']) expect(S.eligibility(s).eligible).toBe(false);
  for (const s of ['SAMPLE_CONSIDERATION', 'WHOLESALE_DISCUSSION', 'CUSTOMER']) expect(S.eligibility(s).eligible).toBe(true);
});

test('request is blocked unless the lead is at a serious stage', () => {
  const b = S.createSampleBook();
  expect(() => b.request('k', { pipelineState: 'INTERESTED' })).toThrow(/cannot request a sample/);
  expect(b.request('k', { pipelineState: 'SAMPLE_CONSIDERATION' })).toBe('REQUESTED');
});

test('approval requires an owner actor — code alone cannot approve', () => {
  const b = S.createSampleBook();
  b.request('k', { pipelineState: 'WHOLESALE_DISCUSSION' }); b.review('k');
  expect(() => b.approve('k', {})).toThrow(/requires an owner actor/);
  expect(b.state('k')).toBe('UNDER_REVIEW');
  expect(b.approve('k', { owner: 'Stas', monthKey: '2026-10' })).toBe('APPROVED');
});

test('SENT is impossible before an owner APPROVED the sample', () => {
  const b = S.createSampleBook();
  b.request('k', { pipelineState: 'CUSTOMER' }); b.review('k');
  expect(() => b.markSent('k')).toThrow(/refused UNDER_REVIEW -> SENT/);
  b.approve('k', { owner: 'Stas', monthKey: '2026-10' });
  expect(b.markSent('k')).toBe('SENT');
});

test('monthly budget caps approvals; going over needs an audited owner override', () => {
  const b = S.createSampleBook({ monthlyBudget: 2 });
  const month = '2026-10';
  for (const k of ['a', 'b']) { b.request(k, { pipelineState: 'SAMPLE_CONSIDERATION' }); b.review(k); b.approve(k, { owner: 'Stas', monthKey: month }); }
  expect(b.budgetStatus(month)).toMatchObject({ budget: 2, approved: 2, remaining: 0 });
  b.request('c', { pipelineState: 'SAMPLE_CONSIDERATION' }); b.review('c');
  expect(() => b.approve('c', { owner: 'Stas', monthKey: month })).toThrow(/monthly sample budget/);
  // override requires BOTH override:true AND a reason.
  expect(() => b.approve('c', { owner: 'Stas', monthKey: month, override: true })).toThrow(/monthly sample budget/);
  expect(b.approve('c', { owner: 'Stas', monthKey: month, override: true, overrideReason: 'key account' })).toBe('APPROVED');
});

test('candidate score is advisory, deterministic, and reports confidence from known signals', () => {
  const full = S.candidateScore({ storeFit: 1, leadScore: 90, replyQuality: 0.9, seriousness: 1, termsDiscussion: true, explicitlyRequested: true, priorPurchases: true });
  expect(full.band).toBe('high');
  expect(full.confidence).toBe(1);
  expect(S.candidateScore({ storeFit: 0.2 }).confidence).toBeLessThan(0.5); // few signals known
  expect(S.candidateScore({ storeFit: 1, leadScore: 90 })).toEqual(S.candidateScore({ storeFit: 1, leadScore: 90 }));
});

test('ROI separates ACTUAL from UNKNOWN and never invents a missing cost', () => {
  const b = S.createSampleBook({ monthlyBudget: 10 });
  const m = '2026-10';
  // One sample with known costs that converts with known revenue.
  b.request('x', { pipelineState: 'CUSTOMER' }); b.review('x');
  b.approve('x', { owner: 'Stas', monthKey: m, unitCost: 4, shipCost: 6, packCost: 1 });
  b.markSent('x'); b.markReceived('x'); b.markConverted('x', { revenue: 300 });
  // One with unknown costs, no order.
  b.request('y', { pipelineState: 'WHOLESALE_DISCUSSION' }); b.review('y');
  b.approve('y', { owner: 'Stas', monthKey: m }); b.markSent('y'); b.markNoOrder('y');
  const r = b.roi(m);
  expect(r.approved).toBe(2);
  expect(r.sent).toBe(2);
  expect(r.converted).toBe(1);
  expect(r.actualCost).toBe(11);
  expect(r.unknownCostRecords).toBe(1);
  expect(r.actualRevenue).toBe(300);
  expect(r.costBasis).toBe('PARTIAL/UNKNOWN');
  expect(r.conversionRate).toBe(0.5);
});

test('conversion rate is null (not a fake 0%) when nothing has been sent', () => {
  expect(S.createSampleBook().roi('2099-01').conversionRate).toBe(null);
});
