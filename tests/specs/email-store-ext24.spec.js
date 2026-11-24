// Saved email campaigns: the dashboard side of docs/ops/sql/drafts/56 (owner, Nov 24:
// approve the wording once, then choose who it goes to; a sending guard). The database
// part is tested against a real local PostgreSQL (docs/ops/sql/local-test/
// email_sending_test.sh); this is the dashboard side, behind he_email_sending (a switch
// that saves real records, OFF). NOTHING IS SENT ANYWHERE. Everything is made up.
const E = require('../../assets/sales/he-email-store.js');
const C = require('../../assets/sales/he-customer-campaign.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test.describe('the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('only what an email needs is handed to the database: the address, the name and the fill-ins', () => {
    const stores = [{ id: 'row-2', name: 'SYNTHETIC Shop A', email: ' A@Example.test ', city: 'Testville', distanceMiles: 3, score: 96, lastContactedAt: null }, { name: 'No mail', email: 'nope' },
      { name: 'Same again', email: 'a@example.test' }, null, 'x'];
    expect(E.recipients('store', stores)).toEqual([{ email: 'a@example.test', name: 'SYNTHETIC Shop A', fields: { store: 'SYNTHETIC Shop A', city: 'Testville' } }]);
    const customers = [{ name: 'ann marie LEE', email: 'ann@example.test', orders: 3, last: '2026-11-01T00:00:00Z', daysSince: 23 }, { name: '12 Main St', email: 'odd@example.test' }];
    expect(E.recipients('customer', customers, { firstName: C.firstName })).toEqual([
      { email: 'ann@example.test', name: 'ann marie LEE', fields: { name: 'Ann' } }, { email: 'odd@example.test', name: '12 Main St', fields: { name: 'there' } }]);
    expect(E.recipients('customer', customers)[0].fields).toEqual({ name: 'there' });           // without a way to read a first name: a neutral greeting
    expect(E.recipients('store', Array.from({ length: 700 }, (x, i) => ({ name: 'S' + i, email: 's' + i + '@example.test' })))).toHaveLength(500);
    for (const junk of [null, undefined, 'x', 7, {}]) { expect(E.recipients('store', junk)).toEqual([]); expect(E.recipients(junk, stores)).toEqual([]); }
  });

  test('a name to start from, the counts of a campaign, and plain words for what the database says', () => {
    expect(E.campaignName('store', 'A body-care line for {store}', '2026-11-25')).toBe('Stores 2026-11-25: A body-care line for');
    expect(E.campaignName('customer', '', 'tomorrow')).toBe('Customers');
    expect(E.campaignName('store', 'x'.repeat(300), '2026-11-25').length).toBeLessThanOrEqual(120);
    const t = E.tally([{ campaign_id: 'a', status: 'queued' }, { campaign_id: 'a', status: 'sent' }, { campaign_id: 'a', status: 'bounced' }, { campaign_id: 'a', status: 'complaint' },
      { campaign_id: 'a', status: 'skipped' }, { campaign_id: 'a', status: 'failed' }, { campaign_id: 'a', status: 'total' }, { campaign_id: 'b', status: 'queued' }, null, { status: 'sent' }]);
    expect(t.a).toEqual({ queued: 1, sent: 3, skipped: 1, failed: 1, back: 2, total: 7 });       // an email that came back was sent first
    expect(t.b).toEqual({ queued: 1, sent: 0, skipped: 0, failed: 0, back: 0, total: 1 });
    expect(E.friendlyError({ code: 'PGRST202', message: 'Could not find the function public.approve_email_campaign' })).toContain('not installed in the database yet');
    expect(E.friendlyError({ code: '42501', message: 'Only the owner approves an email campaign.' })).toBe('Only the owner approves an email campaign.');
    expect(E.friendlyError({ code: '42501', message: 'permission denied for table email_outbox' })).toBe('You do not have permission to do that. Nothing was changed.');
    expect(E.friendlyError({ code: '23514', message: 'This wording makes a health or medical claim. A body-care product may not; change the wording.' })).toContain('health or medical claim');
    expect(E.friendlyError({ code: '23514', message: 'new row violates check constraint "email_campaigns_body_check"' })).toContain('too short, too long or not allowed');
    expect(E.friendlyError(new TypeError('Failed to fetch'))).toContain('Could not reach the database');
    for (const junk of [null, undefined, 'x', 7, {}]) expect(typeof E.friendlyError(junk)).toBe('string');
  });

  test('the store refuses before asking the database: no name, no address, nobody to write to, too many', async () => {
    const calls = [];
    const client = { from: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }) }), rpc: async (name, args) => { calls.push([name, args]); return { data: { ok: true, id: id(1), queued: 1, skipped: [] }, error: null }; } };
    const store = E.createStore({ client, enabled: true });
    const good = { kind: 'store', name: 'First stores', subject: 'A body-care line', body: 'x'.repeat(60), postalAddress: '1 SYNTHETIC Street, Testville', startDay: '2026-11-25' };
    const one = [{ email: 'a@example.test', name: 'A', fields: { store: 'A', city: '' } }];
    expect((await store.saveAndQueue(Object.assign({}, good, { name: 'x' }), one)).message).toContain('Give the campaign a name');
    expect((await store.saveAndQueue(Object.assign({}, good, { postalAddress: '' }), one)).message).toContain('business postal address');
    expect((await store.saveAndQueue(good, [])).message).toContain('nobody to write to');
    expect((await store.saveAndQueue(good, Array.from({ length: 501 }, (x, i) => ({ email: 's' + i + '@example.test' })))).message).toContain('At most 500');
    expect((await store.saveAndQueue(Object.assign({}, good, { kind: 'everyone' }), one)).ok).toBe(false);
    expect(calls).toEqual([]);                                                                    // nothing was asked of the database
    const saved = await store.saveAndQueue(good, one);
    expect(saved).toMatchObject({ ok: true, queued: 1, sent: false });
    expect(calls.map(c => c[0])).toEqual(['approve_email_campaign', 'queue_campaign_emails']);
    expect(calls[1][1]).toEqual({ p_campaign: id(1), p_recipients: [{ email: 'a@example.test', name: 'A', fields: { store: 'A', city: '' } }], p_start: '2026-11-25' });
    // switched off: nothing is ever asked
    const off = E.createStore({ client, enabled: false });
    expect(await off.state()).toBe('off');
    expect((await off.saveAndQueue(good, one)).ok).toBe(false);
    expect((await off.campaigns('store')).rows).toEqual([]);
    expect(calls).toHaveLength(2);
  });
});

// a small stand-in for drafts/56 inside the mock database
function install(backend, opts) {
  const o = opts || {};
  backend.tables.email_campaigns = [{ id: id(900), kind: 'store', name: 'SYNTHETIC earlier campaign', subject: 'An earlier subject', status: 'approved', stop_reason: null, approved_at: '2026-11-20T15:00:00Z' }];
  backend.tables.email_outbox = [{ id: id(901), campaign_id: id(900), status: 'queued' }, { id: id(902), campaign_id: id(900), status: 'sent' }, { id: id(903), campaign_id: id(900), status: 'bounced' }];
  backend.tables.email_suppressions = [];
  let n = 1000;
  backend.rpc.approve_email_campaign = (b) => {
    if (o.refuseApprove) return { __error: o.refuseApprove };
    const row = { id: id(n++), kind: b.p_kind, name: b.p_name, subject: b.p_subject, status: 'approved', stop_reason: null, approved_at: '2026-11-24T18:00:00Z' };
    backend.tables.email_campaigns.push(row);
    return { ok: true, id: row.id, status: 'approved', sent: false };
  };
  backend.rpc.queue_campaign_emails = (b) => {
    if (o.refuseQueue) return { __error: o.refuseQueue };
    const skipped = [];
    b.p_recipients.forEach(r => { if (backend.tables.email_suppressions.some(s => s.email === r.email)) skipped.push({ email: r.email, why: 'on the do-not-email list' }); else backend.tables.email_outbox.push({ id: id(n++), campaign_id: b.p_campaign, status: 'queued' }); });
    return { ok: true, queued: b.p_recipients.length - skipped.length, skipped, first_day: '2026-11-25', last_day: '2026-11-26', sent: false };
  };
  backend.rpc.set_email_campaign_status = (b) => {
    const row = backend.tables.email_campaigns.find(r => r.id === b.p_campaign);
    if (!row) return { __error: { status: 400, code: 'P0002', message: 'This campaign was not found.' } };
    row.status = b.p_status; row.stop_reason = b.p_status === 'stopped' ? 'Stopped by the owner: ' + b.p_reason : null;
    let skipped = 0;
    if (b.p_status === 'stopped') backend.tables.email_outbox.forEach(e => { if (e.campaign_id === row.id && e.status === 'queued') { e.status = 'skipped'; skipped += 1; } });
    return { ok: true, id: row.id, status: row.status, skipped };
  };
  backend.rpc.add_email_suppression = (b) => {
    const had = backend.tables.email_suppressions.some(s => s.email === b.p_email);
    if (!had) backend.tables.email_suppressions.push({ email: b.p_email, reason: b.p_reason, note: b.p_note });
    return { ok: true, email: b.p_email, added: !had, skipped: had ? 0 : 1 };
  };
}
const on = (page, withSwitch) => page.addInitScript((sw) => { try { localStorage.setItem('he_store_campaigns', 'on'); localStorage.setItem('he_customer_emails', 'on'); if (sw) localStorage.setItem('he_email_sending', 'on'); } catch (e) {} }, withSwitch);
const rpcs = (backend) => backend.requests.filter(r => r.rpc && /email|campaign/.test(r.rpc)).map(r => r.rpc);
// the Feature Flags page asks, for every such switch, whether its table exists (no rows read: limit 0); that is not this feature reading anything
const emailReads = (backend) => backend.requests.filter(r => /^email_/.test(r.table || '') && !r.params.some(([k, v]) => k === 'limit' && v === '0'));
const TEXT = { subject: 'A body-care line for {store}', body: 'Hello {store}, we make small-batch body lotion and would love to send a sample to your shop in {city}.' };
async function showStores(page) {
  const P = page.locator('#storeCampaignsPanel');
  await page.fill('#scSubject', TEXT.subject); await page.fill('#scBody', TEXT.body);
  await page.fill('#scAddress', '1 SYNTHETIC Street, Testville');
  await P.locator('[data-sc="approve"]').click();
  await P.locator('[data-sc="example"]').click();
  await page.fill('#scCount', '4');
  await P.locator('[data-sc="show"]').click();
  await expect(P.locator('[data-scchosen]')).toHaveAttribute('data-scchosen', '4');
}

test.describe('saving a campaign on Store Campaigns', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); });

  test('switch off (as shipped): no save section, and nothing about email is asked of the database', async ({ page, backend }) => {
    install(backend);
    await on(page, false);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    await showStores(page);
    await expect(page.locator('[data-emailsave]')).toHaveCount(0);
    await gotoPage(page, 'customerEmailsPanel');
    await expect(page.locator('[data-emailsave]')).toHaveCount(0);
    expect(emailReads(backend)).toEqual([]);
    expect(rpcs(backend)).toEqual([]);
  });

  test('switched on but the database step is not installed: said plainly, nothing can be saved', async ({ page, backend }) => {
    await on(page, true);
    await page.route('**/rest/v1/email_campaigns?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.email_campaigns' in the schema cache" }) }));
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const S = page.locator('[data-emailsave="store"]');
    await expect(S).toHaveAttribute('data-esstate', 'not_installed');
    await expect(S).toContainText('its database step (drafts/56) is not installed yet. Nothing can be saved.');
    await expect(S.locator('[data-es]')).toHaveCount(0);
    expect(rpcs(backend)).toEqual([]);
  });

  test('the owner saves: a second tap, then the approved wording and the shown stores go to the database; nothing is sent', async ({ page, backend, pageErrors }) => {
    install(backend);
    await on(page, true);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const S = page.locator('[data-emailsave="store"]');
    await expect(S).toHaveAttribute('data-esstate', 'installed');
    await expect(S.locator('h3').first()).toHaveText('Save this campaign (nothing is sent)');
    await expect(S).toContainText('It sends nothing; the sending program is not connected.');
    // the earlier campaign is listed with what happened to its emails
    const row0 = S.locator('[data-escampaign="' + id(900) + '"]');
    await expect(row0.locator('td')).toHaveText(['SYNTHETIC earlier campaign', 'Ready to send (nothing is sent yet)', '2026-11-20', '1', '2', '0', '1', /Pause/]);
    // nothing shown yet: nothing to save
    await expect(S.locator('[data-esnotready]')).toContainText('press "Show who would get it" first');
    await showStores(page);
    await expect(S.locator('[data-esform]')).toHaveAttribute('data-esform', '4');
    await expect(page.locator('#esName-store')).toHaveValue(/^Stores \d{4}-\d{2}-\d{2}: A body-care line for$/);
    await page.fill('#esName-store', 'SYNTHETIC first stores');
    const save = S.locator('[data-es="save"]');
    await expect(save).toHaveText('Save the campaign and queue 4 emails');
    await save.click();
    await expect(save).toHaveText('Tap again to save: 4 emails will be queued, none sent');
    await expect(save).toBeFocused();
    expect(rpcs(backend)).toEqual([]);                                                            // the first tap saves nothing
    await save.click();
    await expect(S.locator('[data-esresult]')).toHaveAttribute('data-esresult', '4');
    await expect(S.locator('[data-esresult]')).toContainText('Saved. 4 emails are queued from 2026-11-25 to 2026-11-26. Nothing was sent.');
    await expect(S.locator('[data-esresult]')).toBeFocused();
    expect(rpcs(backend)).toEqual(['approve_email_campaign', 'queue_campaign_emails']);
    const sent = backend.requests.filter(r => r.rpc).map(r => r.body);
    const approve = sent.find(b => b.p_kind);
    expect(approve).toEqual({ p_kind: 'store', p_name: 'SYNTHETIC first stores', p_subject: TEXT.subject, p_body: TEXT.body, p_postal_address: '1 SYNTHETIC Street, Testville' });
    const queue = sent.find(b => b.p_recipients);
    expect(queue.p_recipients).toHaveLength(4);
    expect(Object.keys(queue.p_recipients[0]).sort()).toEqual(['email', 'fields', 'name']);
    expect(queue.p_recipients[0]).toEqual({ email: 'example1@example.test', name: 'EXAMPLE Store 01', fields: { store: 'EXAMPLE Store 01', city: 'Reno' } });
    expect(queue.p_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // the list now holds both campaigns
    await expect(S.locator('[data-eslist]')).toHaveAttribute('data-eslist', '2');
    await expect(S.locator('[data-escampaign]').first().locator('td').first()).toHaveText('SYNTHETIC first stores');
    // changing the wording afterwards: what is on screen is no longer the approved text, so nothing can be saved from it
    await page.fill('#scSubject', TEXT.subject + ' (new)');
    await page.locator('#storeCampaignsPanel [data-sc="example"]').click();
    await page.locator('#storeCampaignsPanel [data-sc="example"]').click();
    await expect(S.locator('[data-esnotready]')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('pause, resume and stop a saved campaign; stopping asks twice', async ({ page, backend }) => {
    install(backend);
    await on(page, true);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const S = page.locator('[data-emailsave="store"]'), row = S.locator('[data-escampaign="' + id(900) + '"]');
    await row.locator('[data-es="pause"]').click();
    await expect(row).toHaveAttribute('data-esstatus', 'paused');
    await expect(S.locator('[data-esmessage]')).toContainText('Paused.');
    await row.locator('[data-es="resume"]').click();
    await expect(row).toHaveAttribute('data-esstatus', 'approved');
    await row.locator('[data-es="stop"]').click();
    await expect(row.locator('[data-es="stop"]')).toHaveText('Tap again to stop for good');
    await expect(row).toHaveAttribute('data-esstatus', 'approved');                               // the first tap stops nothing
    await row.locator('[data-es="stop"]').click();
    await expect(row).toHaveAttribute('data-esstatus', 'stopped');
    await expect(S.locator('[data-esmessage]')).toHaveText('Stopped for good. 1 queued email was skipped.');
    await expect(row.locator('td').nth(1)).toContainText('Stopped. Stopped by the owner: stopped on the dashboard');
    await expect(row.locator('[data-es]')).toHaveCount(0);                                        // a stopped campaign has no buttons
    await expect(row.locator('td').nth(3)).toHaveText('0');
    await expect(row.locator('td').nth(5)).toHaveText('1');
    expect(rpcs(backend)).toEqual(['set_email_campaign_status', 'set_email_campaign_status', 'set_email_campaign_status']);
  });

  test('someone asks not to be emailed: the address goes on the list; a later save leaves it out and says so', async ({ page, backend }) => {
    install(backend);
    await on(page, true);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const S = page.locator('[data-emailsave="store"]');
    await page.fill('#esEmail-store', 'not an email');
    await S.locator('[data-es="suppress"]').click();
    await expect(S.locator('[data-esmessage]')).toHaveText('That is not an email address.');
    await page.fill('#esEmail-store', ' Example2@Example.test ');
    await S.locator('[data-es="suppress"]').click();
    await expect(S.locator('[data-esmessage]')).toHaveText('example2@example.test is on the do-not-email list now. 1 queued email was skipped.');
    await expect(page.locator('#esEmail-store')).toHaveValue('');
    await showStores(page);
    await S.locator('[data-es="save"]').click();
    await S.locator('[data-es="save"]').click();
    await expect(S.locator('[data-esresult]')).toHaveAttribute('data-esresult', '3');
    await expect(S.locator('[data-esskipped]')).toHaveAttribute('data-esskipped', '1');
    await S.locator('[data-esskipped] summary').click();
    await expect(S.locator('[data-esskipped] li')).toHaveText(['example2@example.test: on the do-not-email list']);
  });

  test('the database refuses (a health claim; a failure while queueing): said in plain words, nothing pretended', async ({ page, backend }) => {
    install(backend, { refuseApprove: { status: 400, code: '23514', message: 'This wording makes a health or medical claim. A body-care product may not; change the wording.' } });
    await on(page, true);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const S = page.locator('[data-emailsave="store"]');
    await showStores(page);
    await S.locator('[data-es="save"]').click(); await S.locator('[data-es="save"]').click();
    await expect(S.locator('[data-esmessage]')).toHaveText('This wording makes a health or medical claim. A body-care product may not; change the wording.');
    await expect(S.locator('[data-esresult]')).toHaveCount(0);
    expect(rpcs(backend)).toEqual(['approve_email_campaign']);                                    // nothing was queued
    await expect(S.locator('[data-es="save"]')).toHaveText('Save the campaign and queue 4 emails');   // ready to try again, from the first tap
  });

  test('an administrator sees the saved campaigns and can add to the do-not-email list, but cannot save, pause or stop', async ({ page, backend }) => {
    install(backend);
    backend.tables.profiles[0].role = 'administrator';
    await on(page, true);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const S = page.locator('[data-emailsave="store"]');
    await expect(S.locator('[data-eslist]')).toHaveAttribute('data-eslist', '1');
    await expect(S).toContainText('Only the owner can save a campaign.');
    await expect(S.locator('[data-es="save"], [data-es="pause"], [data-es="stop"]')).toHaveCount(0);
    await page.fill('#esEmail-store', 'asked@example.test');
    await S.locator('[data-es="suppress"]').click();
    await expect(S.locator('[data-esmessage]')).toContainText('asked@example.test is on the do-not-email list now.');
  });
});

test.describe('saving a campaign on Customer Emails', () => {
  test('the customers shown are saved with their first name as the fill-in; no other customer detail leaves the page', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    install(backend);
    const ago = (d) => new Date(Date.now() - d * 86400000 - 3600000).toISOString();
    backend.tables.orders = [{ id: 'es-1', order_number: 'HE-5001', customer_name: 'ann SYNTHETIC', customer_email: 'Ann@Example.test', channel: 'shopify', source: 'shopify', status: 'paid', currency: 'USD', total: 55, placed_at: ago(40), deleted_at: null },
      { id: 'es-2', order_number: 'HE-5002', customer_name: 'SYNTHETIC Marketplace', customer_email: 'm@example.test', channel: 'amazon', source: 'amazon', status: 'paid', currency: 'USD', total: 20, placed_at: ago(40), deleted_at: null }];
    await on(page, true);
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel'), S = page.locator('[data-emailsave="customer"]');
    await expect(S.locator('[data-eslist]')).toHaveAttribute('data-eslist', '0');                 // the store campaign is not listed here
    await P.locator('[data-cekind="reorder"]').click();
    await P.locator('[data-cetemplate="low"]').click();
    await page.fill('#ceAddress', '1 SYNTHETIC Street, Testville');
    await P.locator('[data-ce="approve"]').click();
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen]')).toHaveAttribute('data-cechosen', '1');
    await expect(S.locator('[data-esform]')).toHaveAttribute('data-esform', '1');
    await S.locator('[data-es="save"]').click();
    await expect(S.locator('[data-es="save"]')).toHaveText('Tap again to save: 1 email will be queued, none sent');
    await S.locator('[data-es="save"]').click();
    await expect(S.locator('[data-esresult]')).toContainText('Saved. 1 email is queued');
    const sent = backend.requests.filter(r => r.rpc === 'approve_email_campaign' || r.rpc === 'queue_campaign_emails').map(r => r.body);
    expect(sent).toHaveLength(2);
    expect(sent.find(b => b.p_kind)).toMatchObject({ p_kind: 'customer', p_subject: 'Running low?' });
    expect(sent.find(b => b.p_recipients).p_recipients).toEqual([{ email: 'ann@example.test', name: 'ann SYNTHETIC', fields: { name: 'Ann' } }]);
    expect(JSON.stringify(sent)).not.toMatch(/HE-5001|m@example\.test|"total"|placed_at|55/);    // no order, no amount, no marketplace buyer
    // another kind on the same page: what is on screen is for the other email, so nothing can be saved from it
    await P.locator('[data-cekind="welcome"]').click();
    await expect(S.locator('[data-esnotready]')).toBeVisible();
    await expect(S.locator('[data-eslist]')).toHaveAttribute('data-eslist', '1');
  });

  test('on a phone: the save section and the list of saved campaigns fit', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone size only');
    install(backend);
    await on(page, true);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    await expect(page.locator('[data-emailsave="store"] [data-eslist]')).toHaveAttribute('data-eslist', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });
});
