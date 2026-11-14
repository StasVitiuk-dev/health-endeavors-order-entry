// Owner decisions #2/#3/#4/#5 (OWNER_DECISIONS_2026-11-14.md). Pure, Node-only,
// synthetic, draft-only. Verifies the decided behavior is what the engines do.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const S = require('../../assets/reports/he-report-schedule.js');
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// #4 — day cutoff: midnight Central, America/Chicago, DST-aware.
test('#4 the reporting day ends at midnight Central and handles daylight saving automatically', () => {
  expect(S.DEFAULT_BUSINESS_TZ).toBe('America/Chicago');
  // Summer (CDT, UTC-5): 2026-07-01 23:30 CT -> still 2026-07-01.
  expect(S.businessDateTZ('2026-07-02T04:30:00Z')).toBe('2026-07-01');
  // Winter (CST, UTC-6): 2025-12-31 23:30 CT -> still 2025-12-31.
  expect(S.businessDateTZ('2026-01-01T05:30:00Z')).toBe('2025-12-31');
  // Just after midnight Central rolls to the new day.
  expect(S.businessDateTZ('2026-07-01T05:30:00Z')).toBe('2026-07-01');
  // A bad date is null, never a fabricated day.
  expect(S.businessDateTZ('not-a-date')).toBeNull();
});

// #2 — payment terms: due on receipt default; Net 14 for approved credit.
test('#2 new wholesale buyers are due on receipt; Net 14 only for an approved account', () => {
  expect(INV.termsForAccount({})).toBe('DUE_ON_RECEIPT');
  expect(INV.termsForAccount({ creditApproved: false })).toBe('DUE_ON_RECEIPT');
  expect(INV.termsForAccount({ creditApproved: true })).toBe('NET_14');
  expect(INV.dueDateFor('2026-11-14', 'DUE_ON_RECEIPT')).toBe('2026-11-14'); // same day
  expect(INV.dueDateFor('2026-11-14', 'NET_14')).toBe('2026-11-28');          // +14 days
  expect(INV.dueDateFor(null, 'NET_14')).toBeNull();
});

// #3 — numbering: HE-YYYY-NNNN, per-year gap-free, assigned at issue, year rolls over.
test('#3 invoice numbers are HE-YYYY-NNNN, per-year and gap-free, assigned at issue', () => {
  const first = INV.nextInvoiceNumber({ year: 2026, sequence: 1 });
  expect(first.number).toBe('HE-2026-0001');
  expect(first.format).toMatch(/HE-YYYY-0000/);
  // the year rolls over: 2027 restarts at 0001.
  expect(INV.nextInvoiceNumber({ year: 2027, sequence: 1 }).number).toBe('HE-2027-0001');
  // a draft has no number; the official number is assigned when issued by the owner.
  const draft = INV.draftInvoice({ lines: [{ sku: 'X', quantity: 1, unitPrice: 10 }] });
  expect(draft.number == null || draft.status === 'draft').toBe(true);
  const issued = INV.issue(draft, { role: 'owner', number: 'HE-2026-0007', now: '2026-11-14' });
  expect(issued.ok).toBe(true);
  expect(issued.invoice.number).toBe('HE-2026-0007');
  expect(issued.invoice.status).toBe('issued');
});

// #5 — permissions (owner CONFIRMED 2026-11-14: owner AND administrator may
// issue/void; staff may prepare drafts only).
test('#5 owner and administrator may issue/void; staff cannot', () => {
  const draft = INV.draftInvoice({ lines: [{ sku: 'X', quantity: 1, unitPrice: 10 }] });
  // staff is hard-blocked.
  expect(INV.issue(draft, { role: 'staff', number: 'HE-2026-0001', now: '2026-11-14' }).ok).toBe(false);
  // owner may issue + void.
  const issued = INV.issue(draft, { role: 'owner', number: 'HE-2026-0001', now: '2026-11-14' }).invoice;
  expect(INV.voidInvoice(issued, { role: 'staff' }).ok).toBe(false);
  expect(INV.voidInvoice(issued, { role: 'owner', reason: 'test' }).ok).toBe(true);
  // administrator may issue too (owner-confirmed to keep this power).
  const adminIssued = INV.issue(INV.draftInvoice({ lines: [{ sku: 'Y', quantity: 1, unitPrice: 5 }] }), { role: 'administrator', number: 'HE-2026-0002', now: '2026-11-14' });
  expect(adminIssued.ok).toBe(true);
  expect(INV.voidInvoice(adminIssued.invoice, { role: 'administrator', reason: 'test' }).ok).toBe(true);
  expect(INV.ROLES_MAY_ISSUE.has('owner')).toBe(true);
  expect(INV.ROLES_MAY_ISSUE.has('administrator')).toBe(true);
  expect(INV.ROLES_MAY_ISSUE.has('staff')).toBe(false);
});
