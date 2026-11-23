// Money matching (owner request of Nov 22): bank and card exports read safely,
// Shopify payouts checked against their own transactions, every expected
// deposit and refund matched once to the bank, and card purchases matched to
// recorded expenses. assets/reports/he-money-match.js, made-up data only.
const { test, expect } = require('@playwright/test');
const M = require('../../assets/reports/he-money-match.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('amounts and dates are read exactly, and anything unclear is refused, never turned into zero', () => {
  expect(['412.07', '$412.07', '1,234.56', '-48.00', '(48.00)', '-$48.00', '+5', '0.1', 12.34].map(M.toCents)).toEqual([41207, 41207, 123456, -4800, -4800, -4800, 500, 10, 1234]);
  for (const bad of ['', 'abc', '1.234', '1,23', '12,34.00', null, undefined, NaN, Infinity, '1e3', '--5']) expect(M.toCents(bad)).toBeNull();
  expect(['11/20/2026', '2026-11-20', '11/20/26', '1/5/2026', '2026-11-20T10:00:00Z'].map(M.toDay)).toEqual(['2026-11-20', '2026-11-20', '2026-11-20', '2026-01-05', '2026-11-20']);
  for (const bad of ['02/30/2026', '13/01/2026', '2026-13-01', 'yesterday', '', null]) expect(M.toDay(bad)).toBeNull();
});

test('a Chase business checking export is read as downloaded (header, trailing comma, quoted descriptions)', () => {
  const r = M.parseStatement(M.fixtures().chase);
  expect(r.ok).toBe(true);
  expect(r.layout).toBe('chase_checking');
  expect(r.rows).toHaveLength(6);
  expect(r.rows[0]).toMatchObject({ date: '2026-11-17', cents: 41207, type: 'ACH_CREDIT' });
  expect(r.rows[0].description).toMatch(/^SHOPIFY PAYMENTS/);
  expect(r.rows[3]).toMatchObject({ cents: 7500, ref: '1' });
  expect(r.rows[5].cents).toBe(-4800);
  expect([r.from, r.to, r.moneyIn, r.moneyOut]).toEqual(['2026-11-17', '2026-11-21', 41207 + 12999 + 25000 + 7500 + 50000, -4800]);
});

test('a Wells Fargo card export (no header row) is read; purchases are money out', () => {
  const r = M.parseStatement(M.fixtures().wells);
  expect(r.ok).toBe(true);
  expect(r.layout).toBe('wells_fargo');
  expect(r.rows.map(x => x.cents)).toEqual([-8640, -3215, -1999, 50000]);
  expect(r.rows[0].description).toBe('SYN LABEL PRINTER CO');
});

test('any other export with date, description and debit/credit columns is read too', () => {
  const csv = 'Date,Description,Debit,Credit\n2026-11-01,Deposit,,100.00\n2026-11-02,Supplies,25.50,\n2026-11-03,Broken,abc,\n';
  const r = M.parseStatement(csv);
  expect(r.ok).toBe(true);
  expect(r.rows.map(x => x.cents)).toEqual([10000, -2550]);
  expect(r.problems).toEqual([{ line: 4, reason: 'no readable amount' }]);
});

test('files that are not statements are refused with a reason, never thrown', () => {
  for (const bad of [null, undefined, 42, {}, '', '   ', 'hello,world\n1,2', '﻿', 'a'.repeat(M.MAX_BYTES + 1)]) {
    let r; expect(() => { r = M.parseStatement(bad); }).not.toThrow();
    expect(r.ok).toBe(false); expect(typeof r.reason).toBe('string');
  }
  const unreadable = M.parseStatement('Date,Description,Amount\nnot a date,X,1.00\n11/01/2026,Y,??\n');
  expect(unreadable.ok).toBe(false);
  expect(unreadable.problems.map(p => p.reason)).toEqual(['no readable date', 'no readable amount']);
});

test('Shopify payouts: each must equal its own charges minus fees, refunds and adjustments', () => {
  const r = M.checkPayouts(
    [{ id: 'P1', date: '2026-11-01', amountCents: 9000 }, { id: 'P2', date: '2026-11-02', amountCents: 5000 }, { id: 'P3', date: '2026-11-03' }, { id: 'P4', date: '2026-11-04', amountCents: 100 }],
    [{ payoutId: 'P1', type: 'charge', amountCents: 10000, feeCents: 300 }, { payoutId: 'P1', type: 'refund', amountCents: -700, feeCents: 0 },
     { payoutId: 'P2', type: 'charge', amountCents: 5200, feeCents: 150 }, { payoutId: 'P4', type: 'charge', amountCents: 'x' }]);
  expect(r.items.map(i => i.outcome)).toEqual(['MATCHED', 'AMOUNT_DIFFERS', 'UNKNOWN', 'UNKNOWN']);
  expect(r.items[1].why).toBe('its 1 transaction adds up to $50.50, but the payout is $50.00');
  expect(r.needsLook).toBe(3);
});

test('the worked example: matched, short, pending, unexplained, refund out, card purchase not recorded', () => {
  const x = M.example();
  const by = (list) => list.items.map(i => i.outcome + ':' + (i.ref || i.label)).sort();
  expect(by(x.deposits)).toEqual(['AMOUNT_DIFFERS:SYN1002', 'MATCHED:SYN-INV-0001', 'MATCHED:SYN-RF-01', 'MATCHED:SYN1001', 'PENDING:SYN-INV-0002', 'PENDING:SYN1003',
    'UNEXPECTED:1', 'UNEXPECTED:ONLINE TRANSFER FROM SAVINGS']);
  expect(x.deposits.items.find(i => i.ref === 'SYN1002').why).toBe('deposited $250.00 on 2026-11-19, $11.87 short');
  expect(by(x.cardCheck)).toEqual(['MATCHED:e1', 'MATCHED:e2', 'NOT_RECORDED:SYN SHIPPING SUPPLIES']);
  expect(by(x.payoutCheck)).toEqual(['AMOUNT_DIFFERS:SYN1003', 'MATCHED:SYN1001', 'MATCHED:SYN1002']);
  expect(x.needsLook).toBe(5);
  expect(x.label).toBe('SIMULATED');
});

test('missing after the window closes; doubled deposits; one bank line never matches twice', () => {
  const bank = [{ n: 1, date: '2026-11-05', description: 'SHOPIFY PAYOUT', cents: 10000 }, { n: 2, date: '2026-11-06', description: 'SHOPIFY PAYOUT', cents: 10000 }];
  const r = M.matchDeposits([
    { ref: 'A', kind: 'shopify_payout', date: '2026-11-04', amountCents: 10000 },
    { ref: 'B', kind: 'ach', date: '2026-11-01', amountCents: 2500 },
    { ref: 'A', kind: 'shopify_payout', date: '2026-11-04', amountCents: 10000 },
    { ref: 'C', kind: 'ach', date: '2026-11-04' },
  ], bank, { asOf: '2026-11-30' });
  expect(r.items.map(i => i.outcome + ':' + i.ref)).toEqual(['MISSING:B', 'MATCHED:A', 'DOUBLED:A', 'UNKNOWN:C', 'DOUBLED:A']);
  // the second identical deposit is reported, not matched to anything else
  expect(r.items.filter(i => i.outcome === 'DOUBLED').map(i => i.bankLine ? i.bankLine.n : null)).toEqual([null, 2]);
  // before the window has closed it is only pending
  expect(M.matchDeposits([{ ref: 'B', kind: 'check', date: '2026-11-25', amountCents: 2500 }], bank, { asOf: '2026-11-26' }).items[0].outcome).toBe('PENDING');
  // an early posting (a day before) still counts; a refund is matched only to money going out
  expect(M.matchDeposits([{ ref: 'E', kind: 'ach', date: '2026-11-06', amountCents: 10000 }], bank.slice(0, 1), { asOf: '2026-11-30' }).items[0].outcome).toBe('MATCHED');
  expect(M.matchDeposits([{ ref: 'R', kind: 'refund', date: '2026-11-05', amountCents: 10000 }], bank.slice(0, 1), { asOf: '2026-11-30' }).items.map(i => i.outcome)).toEqual(['MISSING', 'UNEXPECTED']);
});

test('card purchases: each matched to one expense; payments to the card are ignored; bad input is safe', () => {
  const card = M.parseStatement(M.fixtures().wells).rows;
  const r = M.matchCard([{ id: 'x', date: '2026-11-16', amountCents: 8640 }, { id: 'y', date: '2026-11-16', amountCents: 8640 }], card.concat([{ n: 9, date: '2026-11-17', description: 'SYN LABEL PRINTER CO', cents: -8640 }]));
  expect(r.items.filter(i => i.outcome === 'MATCHED').map(i => i.ref)).toEqual(['x', 'y']);
  expect(r.items.some(i => /THANK YOU/.test(i.label))).toBe(false);
  for (const bad of [null, undefined, 'x', [null, 1], {}]) {
    expect(() => M.matchCard(bad, bad)).not.toThrow();
    expect(() => M.matchDeposits(bad, bad, bad)).not.toThrow();
    expect(() => M.checkPayouts(bad, bad)).not.toThrow();
  }
});

test('nothing in the engine reaches the network or storage', () => {
  const src = require('fs').readFileSync(require.resolve('../../assets/reports/he-money-match.js'), 'utf8');
  expect(src).not.toMatch(/supabase|fetch\(|XMLHttpRequest|localStorage|\.rpc\(|\.from\(/);
});
