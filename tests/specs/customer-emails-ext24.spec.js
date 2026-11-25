// Customer emails (owner, Nov 24: "email marketing agents for regular customers who
// order with us ... not only stores"). assets/sales/he-customer-campaign.js and its
// page. NOTHING SENDS: these are the rules for who would get an approved text, and
// the page that shows it. Every customer, address and order is made up.
const C = require('../../assets/sales/he-customer-campaign.js');
const SC = require('../../assets/sales/he-store-campaign.js');
const deps = { claims: require('../../assets/sales/he-sales-claims.js'), approval: require('../../assets/sales/he-sales-approval.js') };
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const NOW = Date.parse('2026-11-24T18:00:00Z');
const ago = (days, from) => new Date((from || NOW) - days * 86400000).toISOString();
const client = (n, extra) => Object.assign({ name: 'SYNTHETIC Person' + n, email: 'person' + n + '@example.test', orders: 1, notCounted: 0, first: ago(n), last: ago(n) }, extra || {});
const TEXT = { subject: 'Thank you, {name}', body: 'Hi {name}, thank you for ordering from our small shop. Reply any time you have a question.' };

test.describe('the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('five kinds of email, each with three ready texts that pass the wording check (one waits for the owner\'s own words)', () => {
    expect(Object.keys(C.KINDS)).toEqual(['welcome', 'reorder', 'newProduct', 'winBack', 'review']);
    for (const kind of Object.keys(C.KINDS)) {
      const ready = C.templates(kind);
      expect(ready).toHaveLength(3);
      expect(new Set(ready.map(t => t.body)).size).toBe(3);
      for (const t of ready) {
        const r = C.checkWording(t, deps);
        expect(r.findings, kind + ' ' + t.key).toEqual([]);                    // no ready text makes a health claim
        if (/\[/.test(t.body)) expect(r.problems).toEqual(['A part in [square brackets] is still waiting for your own words.']);
        else expect(r.ok, kind + ' ' + t.key + ' ' + r.problems.join(' ')).toBe(true);
        expect(t.body).toContain('{name}');
        expect(t.body).not.toMatch(/discount|% off|free shipping|guarantee/i);   // a ready text never promises anything for the owner
        expect(t.subject + t.body).not.toMatch(/5.star|five.star|positive review|in exchange|reward/i);   // and never asks for a good review or offers anything for one
      }
    }
    expect(C.templates('nope')).toEqual([]);
    expect(C.templates(null)).toEqual([]);
  });

  test('who would get it: only people who ordered, by the rule of each email; exact days', () => {
    const list = [client(3), client(20), client(45, { orders: 2, first: ago(200) }), client(119), client(120), client(300, { orders: 4, first: ago(700) }), client(10, { orders: 2, first: ago(90) })];
    const emails = (kind, opts) => C.audience(kind, list, Object.assign({ nowMs: NOW }, opts)).chosen.map(c => c.email.replace('@example.test', '') + ':' + c.daysSince);
    expect(emails('welcome')).toEqual(['person3:3']);                                       // one order, in the last 14 days
    expect(emails('welcome', { days: 30 })).toEqual(['person3:3', 'person20:20']);          // person10 has two orders: not a first order
    expect(emails('reorder')).toEqual(['person45:45', 'person119:119']);                    // 30 to 119 days
    expect(emails('reorder', { days: 7 })).toEqual(['person10:10', 'person20:20', 'person45:45', 'person119:119']);
    expect(emails('winBack')).toEqual(['person120:120', 'person300:300']);
    expect(emails('winBack', { days: 200 })).toEqual(['person300:300']);
    expect(emails('newProduct')).toHaveLength(7);                                           // everyone who ordered
    const w = C.audience('welcome', list, { nowMs: NOW });
    expect(w).toMatchObject({ ok: true, days: 14, notFit: 6, rule: 'People whose first and only order was in the last 14 days.' });
    expect(C.audience('newProduct', list, { nowMs: NOW })).toMatchObject({ days: null, notFit: 0, rule: 'Everyone who has ordered at least once.' });
    // "how was it?": from the chosen day, for three weeks, then never again
    expect(emails('review')).toEqual(['person10:10', 'person20:20']);
    expect(emails('review', { days: 3 })).toEqual(['person3:3', 'person10:10', 'person20:20']);
    expect(C.audience('review', list, { nowMs: NOW }).rule).toBe('People whose last order was 10 to 31 days ago.');
    expect(C.whoText('review', '5')).toBe('People whose last order was 5 to 26 days ago.');
    expect(C.whoText('nope')).toBe('');
    // nobody is in both "time to reorder" and "we miss you"
    const re = new Set(emails('reorder').map(e => e.split(':')[0]));
    expect(emails('winBack').some(e => re.has(e.split(':')[0]))).toBe(false);
  });

  test('only orders the business took itself are used: marketplace buyers and unknown channels never', () => {
    const CH = require('../../assets/views/he-order-channels.js');
    const orders = [{ id: 1, channel: 'shopify' }, { id: 2, channel: 'Amazon' }, { id: 3, channel: 'etsy' }, { id: 4, channel: 'TikTok Shop' }, { id: 5, source: 'manual' }, { id: 6, channel: 'wholesale' },
      { id: 7, channel: 'something new' }, { id: 8 }, null, 'x'];
    const r = C.ownOrders(orders, CH.channelOf);
    expect(r.own.map(o => o.id)).toEqual([1, 5, 6]);
    expect(r).toMatchObject({ ok: true, marketplace: 3, unknown: 2 });
    // without a way to tell the channel, nothing is used
    for (const junk of [null, undefined, 'x', 7, {}]) expect(C.ownOrders(orders, junk)).toEqual({ ok: false, own: [], marketplace: 0, unknown: 0 });
    expect(C.ownOrders(orders, () => { throw new Error('boom'); })).toMatchObject({ ok: true, own: [], unknown: 8 });
    for (const junk of [null, undefined, 'x', 7, {}]) expect(C.ownOrders(junk, CH.channelOf).own).toEqual([]);
  });

  test('left out with the reason: no order that counts, no email, a bad email, the same email twice, asked not to be emailed', () => {
    const list = [client(5), client(6, { email: '' }), client(7, { email: 'not an email' }), client(8, { email: 'PERSON5@example.test' }), client(9, { orders: 0, notCounted: 2 }),
      client(10), client(11, { last: null, first: null }), null, 'x', 7];
    const a = C.audience('newProduct', list, { nowMs: NOW, unsubscribed: ['Person10@Example.test', null, 7] });
    expect(a.chosen.map(c => c.email)).toEqual(['person5@example.test']);
    expect(a.skipped).toEqual([
      { name: 'SYNTHETIC Person6', why: 'no email address on the order' }, { name: 'SYNTHETIC Person7', why: 'no usable email address' },
      { name: 'SYNTHETIC Person8', why: 'same email address as another customer' }, { name: 'SYNTHETIC Person9', why: 'no order that counts (only cancelled or refunded)' },
      { name: 'SYNTHETIC Person10', why: 'asked not to be emailed' }, { name: 'SYNTHETIC Person11', why: 'no date on the order' }]);
  });

  test('the days must be a whole number in the allowed range; junk never throws', () => {
    expect(C.audience('welcome', [], { days: 'abc' })).toMatchObject({ ok: false, reason: 'Type a whole number of days, from 1 to 60.' });
    expect(C.audience('welcome', [], { days: '61' }).ok).toBe(false);
    expect(C.audience('reorder', [], { days: 120 }).reason).toBe('Type a whole number of days, from 7 to 119.');
    expect(C.audience('winBack', [], { days: '12.5' }).ok).toBe(false);
    expect(C.audience('winBack', [], { days: '' })).toMatchObject({ ok: true, days: 120 });
    expect(C.audience('nope', [], {})).toMatchObject({ ok: false, reason: 'Choose which email.' });
    for (const junk of [null, undefined, 'x', 7, [], {}]) { expect(C.audience(junk, junk, junk).chosen).toEqual([]); expect(C.audience('newProduct', junk, junk).chosen).toEqual([]); }
    expect(C.audience('newProduct', [client(1)], { nowMs: 9e15 }).ok).toBe(true);           // an impossible time is read as now
  });

  test('the wording: checked, approved once for everyone, one changed letter needs a new approval; approved is never sent', () => {
    expect(C.checkWording(TEXT, deps)).toMatchObject({ ok: true, problems: [] });
    expect(C.checkWording({ subject: 'Hello there', body: 'Our lotion cures eczema and you will see it in days, we promise you that.' }, deps).problems.join(' ')).toContain('flagged a health or medical claim');
    expect(C.checkWording({ subject: 'Hi {store}', body: 'A long enough email body to pass the length check, for {name} and {price}.' }, deps).problems)
      .toEqual(['Only {name} can be filled in for each customer. Not known: {store}, {price}.']);
    expect(C.checkWording({ subject: 'Hi', body: 'short' }, deps).problems).toEqual(['Write a subject (at least 5 characters).', 'The email is too short (at least 40 characters).']);
    expect(C.checkWording(TEXT, {}).ok).toBe(false);                                         // without the wording check nothing can be approved
    expect(C.checkWording(TEXT, null).problems).toEqual(['The wording check is not available, so this text cannot be approved.']);
    for (const junk of [null, undefined, 'x', 7, [], {}]) expect(C.checkWording(junk, deps).ok).toBe(false);
    const a = C.approveWording(TEXT, 'SYNTHETIC owner', '2026-11-24T18:00:00Z', deps);
    expect(a).toMatchObject({ status: 'APPROVED', sent: false, approvedBy: 'SYNTHETIC owner' });
    expect(C.stillApproved(a, TEXT, deps)).toEqual({ valid: true, reason: '' });
    expect(C.stillApproved(a, Object.assign({}, TEXT, { body: TEXT.body + ' Thanks!' }), deps).reason).toBe('The wording changed after you approved it. Read it again and approve the new wording.');
    expect(C.stillApproved(null, TEXT, deps)).toEqual({ valid: false, reason: 'This wording is not approved yet.' });
    expect(C.wordingDraft(TEXT).recipient).toBeNull();                                       // the customers are not part of what is approved
    // an approval of a store email is not an approval of a customer email with the same words
    const storeApproval = SC.approveWording({ subject: 'Thank you, friend', body: TEXT.body.replace('{name}', 'friend') }, 'x', 'y', deps);
    expect(storeApproval.status).toBe('APPROVED');
    expect(C.stillApproved(storeApproval, { subject: 'Thank you, friend', body: TEXT.body.replace('{name}', 'friend') }, deps).valid).toBe(false);
    expect(C.approveWording({ subject: 'Hello there', body: 'This treats acne and heals dry skin for every customer you have.' }, 'x', 'y', deps)).toMatchObject({ status: 'REFUSED', sent: false });
  });

  test('what one customer would read: the first name when it is a plain one, how to stop the emails, the postal address', () => {
    const r = C.render(TEXT, { name: 'ann marie LEE' }, { postalAddress: '1 SYNTHETIC Street, Testville' });
    expect(r).toMatchObject({ ok: true, subject: 'Thank you, Ann', problems: [] });
    expect(r.body).toBe('Hi Ann, thank you for ordering from our small shop. Reply any time you have a question.\n\nYou are getting this email because you ordered from us. To stop these emails, reply "unsubscribe" and we will take you off the list.\n1 SYNTHETIC Street, Testville');
    for (const odd of ['', '12 Main St', 'x', 'a@b.test', '<b>Bob</b>', null, 7, 'J']) expect(C.firstName(odd)).toBe('there');
    expect(C.firstName("O'Neil Smith")).toBe("O'Neil");
    expect(C.render(TEXT, { name: '' }, {}).problems).toEqual(['Add the business postal address before any real sending (marketing email must carry it).']);
    for (const junk of [null, undefined, 'x', 7, []]) expect(C.render(junk, junk, junk).ok).toBe(false);
  });
});

const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_customer_emails', 'on'); } catch (e) {} });
const order = (n, days, extra) => Object.assign({ id: 'ce-' + n, order_number: 'HE-' + (2000 + n), customer_name: 'SYNTHETIC Person' + n, customer_email: 'person' + n + '@example.test', channel: 'shopify', source: 'shopify', status: 'paid', currency: 'USD', total: 20,
  placed_at: ago(days, Date.now() - 3600000), deleted_at: null }, extra || {});
const seed = (backend) => { backend.tables.orders = [order(1, 2, { customer_name: 'Ann SYNTHETIC' }), order(2, 40), order(3, 50, { customer_email: 'person2@example.test', customer_name: 'SYNTHETIC Person2' }),
  order(4, 200), order(5, 3, { customer_email: null }), order(6, 4, { status: 'cancelled' }), order(7, 5, { deleted_at: new Date().toISOString() }),
  order(8, 2, { channel: 'amazon', source: 'amazon' }), order(9, 2, { channel: 'popup', source: 'popup' })]; };   // a marketplace buyer and an unknown channel: never used
const writes = (backend) => backend.requests.filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/'));
const ownReads = (backend) => backend.requests.filter(r => r.table === 'orders' && r.method === 'GET' && r.params.some(([k, v]) => k === 'select' && v === 'id,customer_name,customer_email,channel,source,status,currency,total,placed_at,deleted_at'));

test.describe('the Customer Emails page', () => {
  test('switch off (as shipped): no page in the menu, nothing drawn, nothing kept, no orders read for it', async ({ page, backend }) => {
    await login(page);
    await expect(page.locator('#sidebarNav')).not.toContainText('Customer Emails');
    await expect(page.locator('#customerEmailsPanel')).toBeEmpty();
    expect(await page.evaluate(() => localStorage.getItem('he_customer_emails_v1'))).toBeNull();
    expect(ownReads(backend)).toEqual([]);
  });

  test('choose the email, start from a ready text, approve once, see exactly who would get it; nothing is sent, written or kept about customers', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    seed(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel');
    await expect(P.locator('[data-cenosend]')).toContainText('Nothing is sent from this page.');
    await expect(P.locator('[data-cekind]')).toHaveCount(5);
    await expect(P).toContainText('People who bought through Amazon, Etsy or TikTok Shop are never emailed');
    await expect(P.locator('[data-cekind="welcome"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(P.locator('[data-cewho]')).toHaveText('Goes to: People whose first and only order was in the last 14 days.');
    expect(ownReads(backend)).toEqual([]);                                   // opening the page reads no customers
    // not approved yet: asking who would get it is refused, and still nothing is read
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cemessage]')).toHaveText('Approve the wording first (step 2).');
    expect(ownReads(backend)).toEqual([]);
    // a ready text, then approve
    await expect(P.locator('[data-cetemplate]')).toHaveCount(3);
    await P.locator('[data-cetemplate="short"]').click();
    await expect(page.locator('#ceSubject')).toHaveValue('Welcome, {name}');
    await expect(P.locator('[data-cewording]')).toHaveAttribute('data-cewording', 'ok');
    await expect(P.locator('[data-ceapproval]')).toHaveText('Not approved yet.');
    // a health claim blocks the approval, live
    await page.fill('#ceBody', 'Hi {name}, our lotion cures dry skin and heals eczema in one week for everybody.');
    await expect(P.locator('[data-cewording]')).toHaveAttribute('data-cewording', 'problems');
    await expect(P.locator('[data-cewording]')).toContainText('health or medical claim');
    await expect(P.locator('[data-ce="approve"]')).toBeDisabled();
    await P.locator('[data-cetemplate="short"]').click();
    await page.fill('#ceAddress', '1 SYNTHETIC Street, Testville');
    await P.locator('[data-ce="approve"]').click();
    await expect(P.locator('[data-ceapproval]')).toHaveAttribute('data-ceapproval', 'approved');
    await expect(P.locator('[data-ceapproval]')).toContainText('Approved does not mean sent.');
    await expect(P.locator('[data-ceapproval]')).toBeFocused();
    // who would get the welcome: the one person whose only order was two days ago
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen]')).toHaveAttribute('data-cechosen', '1');
    await expect(P.locator('[data-cemessage]')).toHaveText('1 customer would get this email over 1 working day. Nothing was sent.');
    await expect(P.locator('[data-cechosen] tbody tr')).toContainText(['Ann SYNTHETIC']);
    await expect(P.locator('[data-cechosen] tbody tr').first()).toContainText('person1@example.test');
    await expect(P.locator('[data-cecount]')).toContainText('Exact, from 6 orders of 5 customers; 2 do not fit this email.');
    // the marketplace buyer and the unknown channel are not in the list, and the page says so
    await expect(P.locator('[data-cechosen]')).not.toContainText('person8@example.test');
    await expect(P.locator('[data-cenotused]')).toHaveText('1 order from Amazon, Etsy or TikTok Shop is not used: those sites do not let sellers email their buyers. 1 order with an unknown sales channel is not used.');
    await expect(P.locator('[data-ceskipped]')).toHaveAttribute('data-ceskipped', '2');
    await P.locator('[data-ceskipped] summary').click();
    await expect(P.locator('[data-ceskipped] li')).toHaveText(['SYNTHETIC Person5: no email address on the order', 'SYNTHETIC Person6: no order that counts (only cancelled or refunded)']);
    await expect(P.locator('[data-cedays] tbody tr')).toHaveCount(1);
    await expect(P.locator('[data-cesample] .taskTitle')).toHaveText('Welcome, Ann');
    await expect(P.locator('[data-cesample] .scSampleBody')).toContainText('To stop these emails, reply "unsubscribe"');
    await expect(P.locator('[data-cesample] .scSampleBody')).toContainText('1 SYNTHETIC Street, Testville');
    expect(ownReads(backend).length).toBeGreaterThanOrEqual(1);
    // changing the wording after approval: asking again is refused until it is approved again
    await page.fill('#ceSubject', 'Welcome to our shop, {name}');
    await expect(P.locator('[data-ceapproval]')).toHaveAttribute('data-ceapproval', 'changed');
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cemessage]')).toHaveText('The wording changed after it was approved. Approve the new wording first.');
    // each kind keeps its own wording and its own approval
    await P.locator('[data-cekind="reorder"]').click();
    await expect(P.locator('[data-cekind="reorder"]')).toBeFocused();
    await expect(page.locator('#ceSubject')).toHaveValue('');
    await expect(P.locator('[data-ceapproval]')).toHaveText('Not approved yet.');
    await P.locator('[data-cetemplate="low"]').click();
    await P.locator('[data-ce="approve"]').click();
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen]')).toHaveAttribute('data-cechosen', '1');           // person2: two orders, the last 40 days ago
    await expect(P.locator('[data-cechosen] tbody tr').first()).toContainText('person2@example.test');
    await expect(P.locator('[data-cechosen] tbody tr').first().locator('td').nth(2)).toHaveText('2');
    // a number of days outside the range is refused in plain words
    await page.fill('#ceDays', '500');
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cemessage]')).toHaveText('Type a whole number of days, from 7 to 119.');
    await page.fill('#ceDays', '30');
    await P.locator('[data-cekind="winBack"]').click();
    await P.locator('[data-cetemplate="miss"]').click();
    await P.locator('[data-ce="approve"]').click();
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen] tbody tr').first()).toContainText('person4@example.test');
    // "how was it?": the people who ordered a few days ago, from your own shop only
    await P.locator('[data-cekind="review"]').click();
    await expect(P.locator('[data-cewho]')).toHaveText('Goes to: People whose last order was 10 to 31 days ago.');
    await page.fill('#ceDays', '3');
    await expect(P.locator('[data-cewho]')).toHaveText('Goes to: People whose last order was 3 to 24 days ago.');
    await page.fill('#ceDays', '2');
    await P.locator('[data-cetemplate="ask"]').click();
    await P.locator('[data-ce="approve"]').click();
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cemessage]')).toHaveText('Type a whole number of days, from 3 to 60.');
    await page.fill('#ceDays', '1');
    await page.fill('#ceDays', '3');
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen]')).toHaveCount(0);                                  // person1 ordered 2 days ago: too early
    await expect(P.locator('[data-ceresult]')).toContainText('Nobody fits this email right now.');
    await P.locator('[data-cekind="winBack"]').click();
    // nothing about customers is kept in the browser; nothing was written anywhere
    const kept = await page.evaluate(() => localStorage.getItem('he_customer_emails_v1'));
    expect(kept).not.toMatch(/person\d@example\.test|SYNTHETIC Person|Ann SYNTHETIC/);
    expect(JSON.parse(kept).texts.welcome.subject).toBe('Welcome to our shop, {name}');
    expect(writes(backend)).toEqual([]);
    // the wording and the approvals are still there after a reload
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await gotoPage(page, 'customerEmailsPanel');
    await expect(P.locator('[data-cekind="winBack"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(P.locator('[data-ceapproval]')).toHaveAttribute('data-ceapproval', 'approved');
    await expect(page.locator('#ceAddress')).toHaveValue('1 SYNTHETIC Street, Testville');
    expect(pageErrors).toEqual([]);
  });

  test('the orders cannot be read: said in plain words, nothing shown, nothing sent', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    seed(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel');
    await P.locator('[data-cekind="newProduct"]').click();
    await P.locator('[data-cetemplate="short"]').click();
    await P.locator('[data-ce="approve"]').click();
    await page.waitForLoadState('networkidle');
    await page.route('**/rest/v1/orders*', route => (route.request().url().includes('customer_email') ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'SYNTHETIC failure' }) }) : route.fallback()));
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cemessage]')).toContainText('Your orders could not be read');
    await expect(P.locator('[data-cemessage]')).toContainText('Nothing was sent.');
    await expect(P.locator('[data-cechosen]')).toHaveCount(0);
    await expect(P.locator('[data-ce="show"]')).toBeEnabled();
  });

  test('on a phone: the page and the list of customers fit', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone size only');
    seed(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel');
    await P.locator('[data-cekind="newProduct"]').click();
    await P.locator('[data-cetemplate="first"]').click();
    await P.locator('[data-ce="approve"]').click();
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen]')).toHaveAttribute('data-cechosen', '3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });
});

// Nov 24: copying an approved wording, to paste into the store's own email tool
// (which writes only to people who agreed). Only an approved wording can be copied;
// {name} becomes a visible [first name] mark. Nothing is sent, read or written.
test.describe('copy an approved wording', () => {
  const clip = (page) => page.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(String(t)); return Promise.resolve(); } } }); } catch (e) {} });

  test('the rule (no browser): {name} becomes [first name], other braces stay, junk never throws', ({}, ti) => {
    test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
    expect(C.forOwnTool(TEXT)).toEqual({ subject: 'Thank you, [first name]', body: 'Hi [first name], thank you for ordering from our small shop. Reply any time you have a question.', hasName: true });
    expect(C.forOwnTool({ subject: 'Hello there', body: 'Dear { NAME }, your {order} is ready.' })).toEqual({ subject: 'Hello there', body: 'Dear [first name], your {order} is ready.', hasName: true });
    expect(C.forOwnTool({ subject: 'Hello there', body: 'No name in this one.' }).hasName).toBe(false);
    for (const junk of [null, undefined, 7, 'x', [], { subject: {}, body: [] }]) expect(() => C.forOwnTool(junk)).not.toThrow();
    // nothing is added: no "to stop these emails" line, no address (the other tool has its own footer)
    expect(C.forOwnTool(TEXT).body).not.toMatch(/unsubscribe|stop these emails/i);
  });

  test('not approved: the copy buttons are off; approved: subject and email are copied with [first name]; a changed wording turns them off again', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    seed(backend);
    await on(page); await clip(page);
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel');
    const subjectBtn = P.locator('[data-ce="copy-subject"]'), bodyBtn = P.locator('[data-ce="copy-body"]');
    await expect(P.locator('[data-cecopy]')).toHaveAttribute('data-cecopy', 'none');
    await expect(subjectBtn).toBeDisabled();
    await expect(bodyBtn).toBeDisabled();
    await expect(P.locator('[data-cecopyhint]')).toContainText('Only an approved wording can be copied.');
    await P.locator('#ceSubject').fill(TEXT.subject);
    await P.locator('#ceBody').fill(TEXT.body);
    await expect(subjectBtn).toBeDisabled();                                // a wording that passes the check is still not approved
    await P.locator('[data-ce="approve"]').click();
    await expect(P.locator('[data-cecopy]')).toHaveAttribute('data-cecopy', 'ready');
    await subjectBtn.click();
    await expect(P.locator('[data-cemessage]')).toHaveText('The subject is copied. Nothing was sent. Where it says [first name], use the "personalize" button of your email tool.');
    await bodyBtn.click();
    await expect(P.locator('[data-cemessage]')).toContainText('The email is copied. Nothing was sent.');
    expect(await page.evaluate(() => window.__copied)).toEqual(['Thank you, [first name]', 'Hi [first name], thank you for ordering from our small shop. Reply any time you have a question.']);
    // one changed letter: no longer approved, so no longer copyable
    await P.locator('#ceBody').fill(TEXT.body + ' Thanks!');
    await expect(P.locator('[data-ceapproval]')).toHaveAttribute('data-ceapproval', 'changed');
    await expect(subjectBtn).toBeDisabled();
    await expect(bodyBtn).toBeDisabled();
    expect(await page.evaluate(() => window.__copied.length)).toBe(2);
    expect(ownReads(backend)).toEqual([]);                                  // copying reads no customers
    expect(writes(backend)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('on a phone the copy buttons fit and are easy to tap', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    seed(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel');
    await expect(P.locator('[data-ce="copy-body"]')).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
    for (const sel of ['[data-ce="copy-subject"]', '[data-ce="copy-body"]']) expect((await P.locator(sel).boundingBox()).height).toBeGreaterThanOrEqual(40);
  });
});
