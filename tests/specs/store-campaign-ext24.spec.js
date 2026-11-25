// Store campaigns, the rules (owner, Nov 24: "I should approve the general text ...
// then press approve and choose how many stores I want it sent to, and choose the
// nearest or our best target store"). assets/sales/he-store-campaign.js.
// NOTHING SENDS: these are the rules for who would get an approved text, in which
// order and on which day. Node only; every store and address is made up.
const C = require('../../assets/sales/he-store-campaign.js');
const deps = { claims: require('../../assets/sales/he-sales-claims.js'), approval: require('../../assets/sales/he-sales-approval.js') };
const { test, expect, login, gotoPage } = require('../helpers/dashboard');


const TEXT = { subject: 'A body-care line for {store}', body: 'Hello {store}, we make small-batch body oils and would love to send a sample to your shop in {city}.' };
const store = (n, extra) => Object.assign({ id: 's' + n, name: 'SYNTHETIC store ' + String(n).padStart(2, '0'), email: 'shop' + n + '@example.test', city: 'Testville', distanceMiles: n * 3, score: 100 - n }, extra || {});
const NOW = Date.parse('2026-11-24T18:00:00Z');

test.describe('the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

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

test('a pasted list: the first line names the columns; lines without a name or an email are left out and counted', () => {
  const r = C.parseStores('Name,Email,City,Distance,Score,Last contacted,Unsubscribed,Bounced\n"Shop, The",a@example.test,Reno,3.5,80,2026-10-01,,\nNo Email,,Reno\nB Shop;b@example.test;Sparks;x;;;yes;\n\n');
  expect(r).toMatchObject({ read: 2, unread: 1, problems: [] });
  expect(r.rows[0]).toEqual({ id: 'row-2', name: 'Shop, The', email: 'a@example.test', city: 'Reno', distanceMiles: 3.5, score: 80, lastContactedAt: '2026-10-01T00:00:00.000Z', unsubscribed: false, bounced: false });
  expect(r.rows[1]).toMatchObject({ name: 'B Shop', distanceMiles: null, score: null, unsubscribed: true });
  expect(C.parseStores('a,b\n1,2').problems).toEqual(['The first line must name the columns, with at least: name, email. Optional: city, distance, score, last contacted, unsubscribed, bounced.']);
  expect(C.parseStores('store name\temail\nX\tx@example.test').read).toBe(1);
  expect(C.parseStores('name,email\n' + Array.from({ length: C.MAX_LINES + 1 }, (x, i) => 's' + i + ',s' + i + '@example.test').join('\n')).problems).toEqual(['That list is too long (5000 stores at most at a time).']);
  for (const junk of [null, undefined, '', '   ', 7, {}, []]) expect(C.parseStores(junk)).toEqual({ rows: [], read: 0, unread: 0, problems: [] });
  // the example stores are made up and show every case: one written to lately, one unsubscribed, one bounced
  const ex = C.exampleStores();
  expect(ex).toHaveLength(12);
  expect(ex.every(s => /^EXAMPLE Store \d\d$/.test(s.name) && /@example\.test$/.test(s.email))).toBe(true);
  expect(C.pick(ex, { count: 12 }).skipped.map(s => s.why)).toEqual(['written to in the last 90 days', 'asked not to be written to', 'an earlier email came back']);
});
});

// Store finder (owner, Nov 24: "choose nearest location or our best target store"): a pasted
// list of stores gets a score with reasons. assets/sales/he-store-finder.js. Nothing is looked up.
const F = require('../../assets/sales/he-store-finder.js');
test.describe('the store finder rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('the kind of shop is read from its own words, as whole words; an unknown kind is said to be unknown', () => {
    const kinds = (list) => list.map(t => F.typeOf(t).key);
    expect(kinds(['Day spa', 'Spas', 'Nail salon & spa', 'Hair Salon', 'Gift Shops', 'Boutique', 'Bath and body shop', 'Apothecary', 'Health food store', 'Pharmacy', 'Hotel', 'Food market']))
      .toEqual(['spa', 'spa', 'spa', 'salon', 'gift', 'boutique', 'skincare', 'skincare', 'wellness', 'pharmacy', 'hotel', 'grocery']);
    expect(kinds(['Sparkling wines', 'Hospital', 'Soapbox Theatre', 'Hardware store', 'Giftware wholesale'])).toEqual(['other', 'other', 'other', 'other', 'other']);
    expect(kinds(['', null, undefined, 7, {}])).toEqual(['unknown', 'unknown', 'unknown', 'other', 'unknown']);
  });

  test('the score: 0 to 100, every point explained; a missing detail is said to be missing, never guessed high', () => {
    const best = F.score({ type: 'Day spa', distanceMiles: 3, rating: 4.8, reviews: 212, email: 'a@example.test' });
    expect(best).toMatchObject({ score: 96, band: 'strong', type: 'spa' });
    expect(best.reasons).toEqual(['Spa: +36 of 40', '3 miles away: +20 of 20', 'Rated 4.8 of 5: +15 of 15', '212 reviews: +10 of 10', 'Has an email address: +15 of 15']);
    // the points in the reasons add up to the score
    const sum = (r) => r.reasons.reduce((n, t) => n + Number((/: \+(\d+) of/.exec(t) || [0, 0])[1]), 0);
    expect(sum(best)).toBe(best.score);
    const bare = F.score({ name: 'x' });
    expect(bare.reasons).toEqual(['Kind of shop not given: +8 of 40', 'Distance not given: +8 of 20', 'Rating not given: +6 of 15', 'Number of reviews not given: +4 of 10', 'No email address and no website: +0 of 15']);
    expect(bare).toMatchObject({ score: 26, band: 'weak' });
    expect(sum(bare)).toBe(26);
    // a shop that does not sell body care never ranks as a good match, however near and well rated
    const hardware = F.score({ type: 'Hardware store', distanceMiles: 1, rating: 5, reviews: 900, email: 'h@example.test' });
    expect(hardware).toMatchObject({ score: 40, band: 'weak' });
    expect(hardware.reasons[hardware.reasons.length - 1]).toBe('Not a kind of shop that usually sells body care: held at 40 at most');
    // far away, poorly rated, website only
    expect(F.score({ type: 'Boutique', distanceMiles: 80, rating: 3.2, reviews: 2, website: 'shop.example.test' })).toMatchObject({ score: 35, band: 'weak' });
    // impossible values count as not given
    expect(F.score({ type: 'Spa', distanceMiles: -5, rating: 9, reviews: -1, email: 'not an email' }).reasons.slice(1, 4)).toEqual(['Distance not given: +8 of 20', 'Rating not given: +6 of 15', 'Number of reviews not given: +4 of 10']);
    for (const junk of [null, undefined, 'x', 7, [], {}]) expect(F.score(junk).score).toBe(26);
  });

  test('a pasted list: only a name is needed; best first; stores without an email are counted, kept in the list and left out of a campaign', () => {
    const r = F.find(F.exampleText());
    expect(r).toMatchObject({ ok: true, read: 8, unread: 0, withEmail: 6, withoutEmail: 2 });
    expect(r.stores.map(s => s.scoring.score)).toEqual([...r.stores.map(s => s.scoring.score)].sort((a, b) => b - a));
    expect(r.stores[0].name).toBe('EXAMPLE Glow Day Spa');
    expect(r.stores.find(s => s.name === 'EXAMPLE Hardware & Paint').scoring.score).toBe(40);
    const out = F.toCampaign(r.stores);
    expect(out.count).toBe(6);
    expect(out.text.split('\n')[0]).toBe('name, email, city, distance, score, last contacted, unsubscribed, bounced');
    expect(out.text).not.toContain('EXAMPLE Old Apothecary');                                 // no email: cannot be written to
    // Store Campaigns reads it back exactly, with the scores, so "the best match" starts with the best
    const back = C.parseStores(out.text);
    expect(back).toMatchObject({ read: 6, unread: 0, problems: [] });
    expect(C.pick(back.rows, { count: 2, order: 'best' }).chosen.map(s => s.name + ':' + s.score)).toEqual(['EXAMPLE Glow Day Spa:96', 'EXAMPLE Fern Boutique:75']);
    // names with commas and quotes survive the hand-over
    const odd = F.find('name, email, type\n"Soap, Suds & ""Co""", a@example.test, soap shop\n, b@example.test, spa\nNo Mail Shop, not-an-email, spa');
    expect(odd).toMatchObject({ read: 2, unread: 1, withEmail: 1, withoutEmail: 1 });
    expect(odd.stores.find(s => s.name === 'No Mail Shop')).toMatchObject({ email: '', emailGiven: true });
    expect(C.parseStores(F.toCampaign(odd.stores).text).rows[0].name).toBe('Soap, Suds & "Co"');
    expect(F.find('').problems).toEqual(['Paste your list of stores first.']);
    expect(F.find('city, type\nTestville, spa').problems[0]).toContain('The first line must name the columns, with at least: name.');
    expect(F.find(Array.from({ length: 5002 }, (x, i) => (i ? 'S' + i : 'name')).join('\n')).problems).toEqual(['That list is too long (5000 stores at most at a time).']);
    for (const junk of [null, undefined, 7, [], {}]) { expect(F.find(junk).ok).toBe(false); expect(F.toCampaign(junk)).toEqual({ text: '', count: 0 }); expect(F.parse(junk).rows).toEqual([]); }
  });
});

const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_store_campaigns', 'on'); } catch (e) {} });
const GOOD = { subject: 'A body-care line for {store}', body: 'Hello {store}, we make small-batch body lotion and would love to send a sample to your shop in {city}.' };

test.describe('the Store Campaigns page', () => {
  test('switch off (as shipped): no page in the menu, nothing drawn, nothing kept', async ({ page }) => {
    await login(page);
    await expect(page.locator('#sidebarNav')).not.toContainText('Store Campaigns');
    await expect(page.locator('#storeCampaignsPanel')).toBeEmpty();
    expect(await page.evaluate(() => localStorage.getItem('he_store_campaign_v1'))).toBeNull();
  });

  test('write, check, approve once, choose how many and which first, and see who would get it on which day; nothing is sent or written', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page);
    await page.clock.setFixedTime(new Date('2026-11-24T18:00:00Z'));
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const host = page.locator('#storeCampaignsPanel');
    await expect(host.locator('h2')).toHaveText('Store Campaigns');
    await expect(host.locator('[data-scnosend]')).toContainText('Nothing is sent from this page.');
    const before = backend.requests.length;
    // an empty text cannot be approved
    await expect(host.locator('[data-sc="approve"]')).toBeDisabled();
    await expect(host.locator('[data-scapproval]')).toHaveText('Not approved yet.');
    // a health claim is flagged and blocks approval
    await host.getByLabel('Subject').fill('Hello {store}');
    await host.getByLabel('Email', { exact: true }).fill('Our lotion heals dry skin and cures eczema for every customer you have.');
    await expect(host.locator('[data-scwording]')).toHaveAttribute('data-scwording', 'problems');
    await expect(host.locator('[data-scwording]')).toContainText('flagged a health or medical claim');
    await expect(host.locator('[data-sc="approve"]')).toBeDisabled();
    // a clear text passes and can be approved
    await host.getByLabel('Subject').fill(GOOD.subject);
    await host.getByLabel('Email', { exact: true }).fill(GOOD.body);
    await expect(host.locator('[data-scwording]')).toHaveText('This wording passes the check.');
    // showing before approving is refused
    await host.getByRole('button', { name: 'Show who would get it' }).click();
    await expect(host.locator('[data-scmessage]')).toHaveText('Approve the wording first (step 1).');
    await host.getByRole('button', { name: 'Approve this wording' }).click();
    await expect(host.locator('[data-scapproval]')).toHaveAttribute('data-scapproval', 'approved');
    await expect(host.locator('[data-scapproval]')).toContainText('Approved does not mean sent.');
    await expect(host.locator('[data-scapproval]')).toContainText('Approved by Synthetic Owner on ');
    await expect(host.locator('[data-scmessage]')).toHaveText('Wording approved. Nothing was sent.');
    // one changed letter: the approval no longer covers it; putting it back restores it
    await host.getByLabel('Email', { exact: true }).fill(GOOD.body + '!');
    await expect(host.locator('[data-scapproval]')).toHaveAttribute('data-scapproval', 'changed');
    await host.getByLabel('Email', { exact: true }).fill(GOOD.body);
    await expect(host.locator('[data-scapproval]')).toHaveAttribute('data-scapproval', 'approved');
    // stores: the example list, 5 nearest, starting on a Saturday
    await host.getByRole('button', { name: 'Show who would get it' }).click();
    await expect(host.locator('[data-scmessage]')).toHaveText('Add your stores first (step 2), or use the example stores.');
    await host.getByRole('button', { name: 'Use example stores' }).click();
    await expect(host.locator('[data-scstores]')).toHaveText('12 example stores (made up; none of them exists).');
    await host.getByLabel('How many stores').fill('5');
    await host.getByLabel('First day').fill('2026-11-28');
    await host.getByLabel('Business postal address').fill('SYNTHETIC postal address');
    await host.getByRole('button', { name: 'Show who would get it' }).click();
    await expect(host.locator('[data-scmessage]')).toHaveText('5 stores would get this email over 1 working day. Nothing was sent.');
    await expect(host.locator('[data-scchosen="5"] tbody tr')).toHaveCount(5);
    await expect(host.locator('[data-scchosen] tbody tr').first()).toContainText('EXAMPLE Store 01');
    await expect(host.locator('[data-scdays="1"] tbody tr')).toHaveText(['2026-11-305']);                    // Saturday waits for Monday
    await expect(host.locator('[data-scskipped="3"] summary')).toHaveText('3 left out, with the reason');
    await expect(host.locator('[data-scsample] .taskTitle')).toHaveText('A body-care line for EXAMPLE Store 01');
    await expect(host.locator('[data-scsample]')).toContainText('reply "no thanks" and we will not write again.');
    await expect(host.locator('[data-scsample]')).toContainText('SYNTHETIC postal address');
    // best match first, all of them: only 9 can be written to
    await host.getByLabel('Which first').selectOption('best');
    await host.getByLabel('How many stores').fill('40');
    await host.getByRole('button', { name: 'Show who would get it' }).click();
    await expect(host.locator('[data-scshort="31"]')).toHaveText('You asked for 40, but only 9 can be written to.');
    await expect(host.locator('[data-scchosen="9"] thead')).toContainText('Score');
    // kept after a reload, still approved
    await page.reload(); await gotoPage(page, 'storeCampaignsPanel');
    await expect(host.getByLabel('Subject')).toHaveValue(GOOD.subject);
    await expect(host.locator('[data-scapproval]')).toHaveAttribute('data-scapproval', 'approved');
    await expect(host.getByLabel('Which first')).toHaveValue('best');
    // nothing was written to the database and nothing left the page
    expect(backend.tableWrites()).toEqual([]);
    expect(backend.requests.slice(before).filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
  });

  test('a pasted list is read as typed; a list without the needed columns says what is needed', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const host = page.locator('#storeCampaignsPanel');
    await host.getByLabel('Paste your list of stores').fill('shop,mail\nA,a@example.test');
    await expect(host.locator('[data-scstores]')).toContainText('The first line must name the columns');
    await host.getByLabel('Paste your list of stores').fill('name,email,city,distance\nSYNTHETIC A,a@example.test,Reno,4\nSYNTHETIC B,,Reno,2\nSYNTHETIC C,c@example.test,Sparks,1');
    await expect(host.locator('[data-scstores]')).toHaveText('2 stores read, 1 line without a name or an email left out.');
  });

  test('an employee is told it is for the owner and administrators; at phone size the page does not scroll sideways', async ({ page, backend }, ti) => {
    await on(page);
    if (ti.project.name === 'desktop') {
      backend.tables.profiles[0].role = 'employee';
      await login(page);
      await gotoPage(page, 'storeCampaignsPanel');
      await expect(page.locator('#storeCampaignsPanel')).toContainText('Only the owner and administrators can prepare store campaigns.');
      await expect(page.locator('#storeCampaignsPanel input, #storeCampaignsPanel textarea')).toHaveCount(0);
      return;
    }
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    await page.locator('#storeCampaignsPanel').getByRole('button', { name: 'Use example stores' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});

test.describe('the store finder on the Store Campaigns page', () => {
  test('paste or use example stores, score them with reasons, and hand the ones with an email to the campaign; nothing is looked up, sent or written', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const P = page.locator('#storeCampaignsPanel');
    await expect(P.locator('[data-sfinder]')).toHaveAttribute('data-sfinder', 'empty');
    await expect(P.locator('[data-sfinder]')).toContainText('Nothing is looked up');
    // nothing pasted: said plainly
    await P.locator('[data-sc="sf-score"]').click();
    await expect(P.locator('[data-sfproblems]')).toHaveText('Paste your list of stores first.');
    await expect(page.locator('#sfText')).toBeFocused();
    await P.locator('[data-sc="sf-example"]').click();
    await expect(page.locator('#sfText')).toHaveValue(/EXAMPLE Glow Day Spa/);
    await P.locator('[data-sc="sf-score"]').click();
    await expect(P.locator('[data-sfsummary]')).toHaveText('8 stores scored. 6 have an email address; 2 do not and cannot be written to until you find one.');
    await expect(P.locator('[data-sfsummary]')).toBeFocused();
    const rows = P.locator('[data-sfstores] tbody tr');
    await expect(rows).toHaveCount(8);
    await expect(rows.first().locator('td').first()).toHaveText('96');
    await expect(rows.first()).toContainText('EXAMPLE Glow Day Spa');
    await expect(rows.first().locator('.sfWhy li')).toHaveText(['Spa: +36 of 40', '3 miles away: +20 of 20', 'Rated 4.8 of 5: +15 of 15', '212 reviews: +10 of 10', 'Has an email address: +15 of 15']);
    await expect(P.locator('[data-sfstores] tr', { hasText: 'EXAMPLE Old Apothecary' }).locator('td').last()).toHaveText('none');
    // hand them to the campaign: step 2 is filled in with the scores
    await P.locator('[data-sc="sf-use"]').click();
    await expect(P.locator('[data-scmessage]')).toContainText('6 stores put into step 2 with their scores.');
    await expect(page.locator('#scStores')).toHaveValue(/^name, email, city, distance, score/);
    await expect(page.locator('#scStores')).toBeFocused();
    await expect(P.locator('[data-scstores]')).toHaveAttribute('data-scstores', '6');
    // and the campaign then starts with the best match
    await page.fill('#scSubject', GOOD.subject); await page.fill('#scBody', GOOD.body);
    await P.locator('[data-sc="approve"]').click();
    await page.selectOption('#scOrder', 'best'); await page.fill('#scCount', '3');
    await P.locator('[data-sc="show"]').click();
    await expect(P.locator('[data-scchosen] tbody tr').first()).toContainText('EXAMPLE Glow Day Spa');
    await expect(P.locator('[data-scchosen] tbody tr').first().locator('td').last()).toHaveText('96');
    await expect(P.locator('[data-sfstores] tbody tr')).toHaveCount(8);                      // the scored list is still there
    // changing the list: the old scores are not left standing
    await page.locator('#sfText').focus();
    await page.keyboard.press('Control+End');
    await page.locator('#sfText').pressSequentially('\nEXAMPLE Late Spa, late@example.test, Testville, Spa, 4.9, 10, 1, ');
    await expect(P.locator('[data-sfstale]')).toHaveText('The list changed. Press "Score this list" to score it again.');
    await expect(P.locator('[data-sfstores]')).toHaveCount(0);
    await expect(page.locator('#sfText')).toBeFocused();
    await P.locator('[data-sc="sf-score"]').click();
    await expect(P.locator('[data-sfstores] tbody tr')).toHaveCount(9);
    // kept after a reload (the pasted list, in this browser); nothing written anywhere
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await gotoPage(page, 'storeCampaignsPanel');
    await expect(page.locator('#sfText')).toHaveValue(/EXAMPLE Late Spa/);
    expect(backend.requests.filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/'))).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('on a phone: the scored list fits', async ({ page, pageErrors }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone size only');
    await on(page);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const P = page.locator('#storeCampaignsPanel');
    await P.locator('[data-sc="sf-example"]').click();
    await P.locator('[data-sc="sf-score"]').click();
    await expect(P.locator('[data-sfstores] tbody tr')).toHaveCount(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });
});
