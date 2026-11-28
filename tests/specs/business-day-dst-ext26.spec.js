// The business day ends at midnight Central (owner decision #4), and Central time changes twice a year:
// on Sun Mar 8, 2026 clocks go 2:00 -> 3:00 (CST -6 to CDT -5); on Sun Nov 1, 2026 they go 2:00 -> 1:00.
// Midnight is then a different UTC hour on each side, and the two Sundays are 23 and 25 hours long.
// An order, an invoice's day of issue or a report must land on the Central day, whatever the season.
// Nov 27, 2026 (night). Node only; every time is made up.
const { test, expect } = require('@playwright/test');
const INV = require('../../assets/invoice/he-invoice.js');
const SCH = require('../../assets/reports/he-report-schedule.js');
const EXP = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// [instant (UTC), Central calendar day, why]
const CASES = [
  ['2026-11-27T05:59:59Z', '2026-11-26', 'an ordinary winter night: 11:59:59 PM CST'],
  ['2026-11-27T06:00:00Z', '2026-11-27', '  midnight CST'],
  ['2026-07-15T04:59:59Z', '2026-07-14', 'an ordinary summer night: 11:59:59 PM CDT'],
  ['2026-07-15T05:00:00Z', '2026-07-15', '  midnight CDT'],
  ['2026-03-08T05:59:59Z', '2026-03-07', 'spring forward: the evening before (CST)'],
  ['2026-03-08T06:00:00Z', '2026-03-08', '  midnight that starts the short Sunday (still CST)'],
  ['2026-03-08T07:59:59Z', '2026-03-08', '  1:59:59 AM CST, one second before the clocks jump'],
  ['2026-03-08T08:00:00Z', '2026-03-08', '  3:00 AM CDT, the hour 2-3 AM does not exist'],
  ['2026-03-09T04:59:59Z', '2026-03-08', '  11:59:59 PM CDT, the end of the 23-hour Sunday'],
  ['2026-03-09T05:00:00Z', '2026-03-09', '  midnight CDT (a fixed -6 offset would still say Mar 8)'],
  ['2026-11-01T04:59:59Z', '2026-10-31', 'fall back: 11:59:59 PM CDT the evening before'],
  ['2026-11-01T05:00:00Z', '2026-11-01', '  midnight CDT that starts the long Sunday'],
  ['2026-11-01T06:30:00Z', '2026-11-01', '  1:30 AM CDT, the first time'],
  ['2026-11-01T07:30:00Z', '2026-11-01', '  1:30 AM CST, the second time (the hour repeats)'],
  ['2026-11-02T05:59:59Z', '2026-11-01', '  11:59:59 PM CST, the end of the 25-hour Sunday'],
  ['2026-11-02T06:00:00Z', '2026-11-02', '  midnight CST'],
];

test('every instant lands on its Central day, both clock changes included (invoices and reports agree)', () => {
  for (const [at, day, why] of CASES) {
    expect(INV.businessDay(at), 'invoice: ' + why).toBe(day);
    expect(SCH.businessDateTZ(at), 'report: ' + why).toBe(day);
  }
});

test('a fixed six-hour offset would be wrong for half the year (why the reports use the zone, not an offset)', () => {
  // he-report-export's businessDate(at, offset) is kept for callers that pass a fixed offset; nothing
  // in the dashboard uses it for the Central day. This shows the summer hour it would misplace.
  expect(EXP.businessDate('2026-07-15T05:30:00Z', -6)).toBe('2026-07-14');      // fixed -6: the wrong day
  expect(SCH.businessDateTZ('2026-07-15T05:30:00Z')).toBe('2026-07-15');          // the zone: 12:30 AM CDT, Jul 15
  // and the ledger roll-up, given the zone, puts that order on Jul 15
  const rows = EXP.summarizeLedger([{ type: 'order', at: '2026-07-15T05:30:00Z', amount: 10 }], { dayOf: SCH.businessDateTZ });
  expect(rows.map(r => r.report_date)).toEqual(['2026-07-15']);
});

test('Net 14 counts calendar days, so a due date across a clock change is still 14 days later', () => {
  expect(INV.dueDateFor('2026-10-25', 'NET_14')).toBe('2026-11-08');   // across fall back
  expect(INV.dueDateFor('2026-03-01', 'NET_14')).toBe('2026-03-15');   // across spring forward
  expect(INV.dueDateFor('2026-12-25', 'NET_14')).toBe('2027-01-08');   // across a new year
  expect(INV.dueDateFor('2026-11-01', 'DUE_ON_RECEIPT')).toBe('2026-11-01');
});

test('an invoice issued at 11:30 PM Central on the long Sunday is dated that Sunday, not Monday (UTC)', () => {
  const at = '2026-11-02T05:30:00Z';                                         // 11:30 PM CST, Nov 1
  expect(INV.businessDay(at)).toBe('2026-11-01');
  expect(new Date(at).toISOString().slice(0, 10)).toBe('2026-11-02');      // the UTC date would be the next day
});

test('a missing or broken time gives no day (never "today" by accident)', () => {
  for (const bad of [null, undefined, '', 'not a date']) {
    expect(INV.businessDay(bad)).toBeNull();
  }
  expect(SCH.businessDateTZ('not a date')).toBeNull();
});
