// Store campaigns, the rules (owner, Nov 24: "I should approve the general text ...
// then press approve and choose how many stores I want it sent to, and choose the
// nearest or our best target store"). assets/sales/he-store-campaign.js.
// NOTHING SENDS: these are the rules for who would get an approved text, in which
// order and on which day. Node only; every store and address is made up.
const C = require('../../assets/sales/he-store-campaign.js');
const deps = { claims: require('../../assets/sales/he-sales-claims.js'), approval: require('../../assets/sales/he-sales-approval.js') };
const { test, expect } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const TEXT = { subject: 'A body-care line for {store}', body: 'Hello {store}, we make small-batch body oils and would love to send a sample to your shop in {city}.' };
const store = (n, extra) => Object.assign({ id: 's' + n, name: 'SYNTHETIC store ' + String(n).padStart(2, '0'), email: 'shop' + n + '@example.test', city: 'Testville', distanceMiles: n * 3, score: 100 - n }, extra || {});
const NOW = Date.parse('2026-11-24T18:00:00Z');

test('the wording: a clear text passes; a health claim, an unknown fill-in or a missing part is refused with the reason', () => {
  expect(C.checkWording(TEXT, deps)).toMatchObject({ ok: true, problems: [], findings: [] });
  const claim = C.checkWording({ subject: 'Hello there', body: 'Our oil cures eczema and you will see it in days, we promise you that.' }, deps);
  expect(claim.ok).toBe(false);
  expect(claim.problems.join(' ')).toContain('flagged a health or medical claim');
  expect(C.checkWording({ subject: 'Hi {owner}', body: 'A long enough email body to pass the length check, for {store} and {price}.' }, deps).problems)
    .toEqual(['Only {store} and {city} can be filled in for each store. Not known: {owner}, {price}.']);
  expect(C.checkWording({ subject: 'Hi', body: 'short' }, deps).problems).toEqual(['Write a subject (at least 5 characters).', 'The email is too short (at least 40 characters).']);
  expect(C.checkWording({ subject: 'x'.repeat(121), body: 'y'.repeat(2001) }, deps).problems).toHaveLength(2);
  // without the wording check nothing can be approved (it fails closed)
  expect(C.checkWording(TEXT, {}).ok).toBe(false);
  expect(C.checkWording(TEXT, null).problems).toEqual(['The wording check is not available, so this text cannot be approved.']);
  for (const junk of [null, undefined, 'x', 7, [], {}]) expect(C.checkWording(junk, deps).ok).toBe(false);
});

test('approval covers the exact wording, once, whoever it goes to; one changed letter needs a new approval; approved is never sent', () => {
  const a = C.approveWording(TEXT, 'SYNTHETIC owner', '2026-11-24T18:00:00Z', deps);
  expect(a).toMatchObject({ status: 'APPROVED', sent: false, approvedBy: 'SYNTHETIC owner', approvedAt: '2026-11-24T18:00:00Z' });
  expect(C.stillApproved(a, TEXT, deps)).toEqual({ valid: true, reason: '' });
  expect(C.stillApproved(a, { subject: TEXT.subject + ' ', body: '\r\n' + TEXT.body }, deps).valid).toBe(true);          // spaces around it are not a change
  expect(C.stillApproved(a, Object.assign({}, TEXT, { body: TEXT.body + ' Thanks!' }), deps))
    .toEqual({ valid: false, reason: 'The wording changed after you approved it. Read it again and approve the new wording.' });
  expect(C.stillApproved(null, TEXT, deps)).toEqual({ valid: false, reason: 'This wording is not approved yet.' });
  // the stores are not part of what is approved: the same approval holds for any list
  expect(C.wordingDraft(TEXT).recipient).toBeNull();
  // a text with a claim cannot be approved at all
  const refused = C.approveWording({ subject: 'Hello there', body: 'This treats acne and heals dry skin for every customer you have.' }, 'x', 'y', deps);
  expect(refused).toMatchObject({ status: 'REFUSED', sent: false });
  expect(refused.fingerprint).toBeUndefined();
  expect(C.approveWording(TEXT, 'x', 'y', { claims: deps.claims })).toMatchObject({ status: 'REFUSED', sent: false });
});

test('choosing stores: how many, nearest or best first; stores that must not be written to are left out with the reason', () => {
  const list = [store(5), store(1), store(3), store(2, { score: 10 }), store(4, { distanceMiles: null }),
    store(6, { unsubscribed: true }), store(7, { bounced: true }), store(8, { email: 'not an email' }), store(9, { email: 'SHOP1@example.test' }),
    store(10, { lastContactedAt: '2026-10-01T00:00:00Z' }), store(11, { lastContactedAt: '2026-06-01T00:00:00Z' }), null, 'x'];
  const near = C.pick(list, { count: 3, order: 'nearest', nowMs: NOW });
  expect(near.chosen.map(s => s.name)).toEqual(['SYNTHETIC store 01', 'SYNTHETIC store 02', 'SYNTHETIC store 03']);
  expect(near).toMatchObject({ ok: true, order: 'nearest', left: 3, short: 0, unknownOrder: 1 });
  expect(near.skipped).toEqual([
    { name: 'SYNTHETIC store 06', why: 'asked not to be written to' }, { name: 'SYNTHETIC store 07', why: 'an earlier email came back' },
    { name: 'SYNTHETIC store 08', why: 'no usable email address' }, { name: 'SYNTHETIC store 09', why: 'same email address as another store' },
    { name: 'SYNTHETIC store 10', why: 'written to in the last 90 days' }]);
  // best first: by score; the store with the low score goes last
  expect(C.pick(list, { count: 10, order: 'best', nowMs: NOW }).chosen.map(s => s.name))
    .toEqual(['SYNTHETIC store 01', 'SYNTHETIC store 03', 'SYNTHETIC store 04', 'SYNTHETIC store 05', 'SYNTHETIC store 11', 'SYNTHETIC store 02']);
  // a store with no distance is never put first by guess
  expect(C.pick(list, { count: 10, order: 'nearest', nowMs: NOW }).chosen.map(s => s.name).pop()).toBe('SYNTHETIC store 04');
  // asking for more than there are says how many are missing
  expect(C.pick(list, { count: 50, nowMs: NOW })).toMatchObject({ ok: true, short: 44, left: 0 });
  for (const bad of [0, -1, 501, 'abc', null, undefined, 2.5 - 2.5]) expect(C.pick(list, { count: bad })).toMatchObject({ ok: false, chosen: [], reason: 'Choose how many stores (1 to 500).' });
  for (const junk of [null, undefined, 'x', 7, {}]) expect(C.pick(junk, { count: 5 })).toMatchObject({ ok: true, chosen: [], short: 5 });
});

test('a slow start: 20 a day in the first working week, then 40, 60, 80, 100; never on a weekend', () => {
  // Friday Nov 27, 2026, 130 emails
  expect(C.plan(130, { startDay: '2026-11-27' })).toEqual([
    { day: '2026-11-27', count: 20 }, { day: '2026-11-30', count: 20 }, { day: '2026-12-01', count: 20 }, { day: '2026-12-02', count: 20 }, { day: '2026-12-03', count: 20 },
    { day: '2026-12-04', count: 30 }]);
  const long = C.plan(500, { startDay: '2026-11-23' });
  expect(long.reduce((n, d) => n + d.count, 0)).toBe(500);
  expect(Math.max(...long.map(d => d.count))).toBeLessThanOrEqual(100);
  expect(long.slice(0, 5).every(d => d.count === 20)).toBe(true);
  expect(long.slice(5, 10).every(d => d.count === 40)).toBe(true);
  expect(long.every(d => { const w = new Date(d.day + 'T12:00:00Z').getUTCDay(); return w !== 0 && w !== 6; })).toBe(true);
  expect(C.plan(15, { startDay: '2026-11-28' })).toEqual([{ day: '2026-11-30', count: 15 }]);                      // a Saturday start waits for Monday
  for (const bad of [[0, '2026-11-27'], [501, '2026-11-27'], [10, '2026-02-30'], [10, 'soon'], [10, null], ['x', '2026-11-27']]) expect(C.plan(bad[0], { startDay: bad[1] })).toEqual([]);
});

test('the stop rule: too many emails coming back, or two people marking it as spam, stops the campaign', () => {
  expect(C.guard({ sent: 40, bounced: 2, complaints: 0 })).toEqual({ stop: false, why: '' });
  expect(C.guard({ sent: 40, bounced: 3, complaints: 0 }).stop).toBe(true);
  expect(C.guard({ sent: 40, bounced: 3 }).why).toBe('3 of 40 emails came back (more than 5%). The list needs cleaning before more are sent.');
  expect(C.guard({ sent: 10, bounced: 5 }).stop).toBe(false);                 // too few sent to judge
  expect(C.guard({ sent: 200, bounced: 0, complaints: 2 })).toEqual({ stop: true, why: '2 people marked the email as spam. The campaign stops until you look at it.' });
  for (const junk of [null, undefined, 'x', 7, [], {}, { sent: 'x', bounced: -5, complaints: null }]) expect(C.guard(junk)).toEqual({ stop: false, why: '' });
});

test('one store\'s email: its name and city filled in, a "no thanks" line and the business address added; no address, no sending', () => {
  const r = C.render(TEXT, store(1, { city: 'Reno' }), { postalAddress: 'SYNTHETIC postal address' });
  expect(r).toEqual({ ok: true, subject: 'A body-care line for SYNTHETIC store 01', problems: [],
    body: 'Hello SYNTHETIC store 01, we make small-batch body oils and would love to send a sample to your shop in Reno.\n\nIf you would rather not hear from us, reply "no thanks" and we will not write again.\nSYNTHETIC postal address' });
  expect(C.render(TEXT, store(1), {}).problems).toEqual(['Add the business postal address before any real sending (marketing email must carry it).']);
  expect(C.render(TEXT, { name: 'SYNTHETIC store' }, { postalAddress: 'x' }).problems).toEqual(['This store has no city to fill in.']);
  for (const junk of [null, undefined, 'x', 7]) expect(C.render(junk, junk, junk).ok).toBe(false);
});
