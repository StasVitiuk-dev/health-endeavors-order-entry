// Drafts that follow every device (owner's rule 3, Nov 24: "everything updated
// everywhere right away ... a bunch of phones and the computer at the same time").
// The owner's wording on Store Campaigns, Customer Emails and the Content Helper is
// saved as a shared setting (docs/ops/sql/drafts/50), so it is the same on every
// phone and computer. Lists of stores and customers are never part of it. Nothing
// is sent. Everything here is made up.
const SC = require('../../assets/sales/he-store-campaign.js');
const deps = { claims: require('../../assets/sales/he-sales-claims.js'), approval: require('../../assets/sales/he-sales-approval.js') };
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const FLAGS = ['he_store_campaigns', 'he_customer_emails', 'he_content_helper'];
const on = (page, shared) => page.addInitScript(([flags, sharedOn]) => { try { flags.forEach(f => localStorage.setItem(f, 'on')); if (sharedOn) localStorage.setItem('he_shared_settings', 'on'); } catch (e) {} }, [FLAGS, shared]);
const saves = (backend) => backend.requests.filter(r => r.rpc === 'set_shared_setting').map(r => r.body);
const reads = (backend) => backend.requests.filter(r => r.table === 'shared_settings' && r.method === 'GET' && r.params.some(([k, v]) => k === 'key' && /store_campaign|customer_emails|content_helper/.test(v)));
const row = (key, value) => ({ key, value, audience: 'owner_admin', updated_at: '2026-11-24T16:00:00Z', updated_by: 'u-owner' });
const store = (backend) => { backend.tables.shared_settings = backend.tables.shared_settings || []; backend.rpc.set_shared_setting = (body) => {
  backend.tables.shared_settings = backend.tables.shared_settings.filter(r => r.key !== body.p_key).concat([row(body.p_key, body.p_value)]); return { ok: true, updated_at: new Date().toISOString() }; }; };
const TEXT = { subject: 'A body-care line for {store}', body: 'Hello {store}, we make small-batch body lotion and would love to send a sample to your shop in {city}.' };
const PAGES = [['storeCampaignsPanel', 'store'], ['customerEmailsPanel', 'customer'], ['contentHelperPanel', 'content']];

test.describe('drafts on every device', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); });

  test('shared settings not in use (as shipped): each page says it is kept in this browser; nothing is asked of the database for it', async ({ page, backend }) => {
    await on(page, false);
    await login(page);
    for (const [panel, name] of PAGES) {
      await gotoPage(page, panel);
      const line = page.locator(`[data-draftshare="${name}"]`);
      await expect(line).toHaveAttribute('data-draftstate', 'off');
      await expect(line).toContainText('Kept in this browser on this device for now. Once the shared settings database step (drafts/50) is installed, it follows you to every phone and computer.');
    }
    await page.fill('#chProduct', 'SYNTHETIC Lotion');
    await gotoPage(page, 'storeCampaignsPanel');
    await page.fill('#scSubject', TEXT.subject);
    await page.waitForTimeout(1300);
    expect(reads(backend)).toEqual([]);
    expect(saves(backend)).toEqual([]);
    // the time of the change is still noted, so the draft can go up later
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_store_campaign_v1'))).savedAt).toMatch(/^20\d\d-/);
  });

  test('the owner types: the wording, its approval and the choices are saved for every device a moment later; the lists of stores never', async ({ page, backend, pageErrors }) => {
    await on(page, true); store(backend);
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    const P = page.locator('#storeCampaignsPanel'), line = P.locator('[data-draftshare="store"]');
    await expect(line).toContainText('Your lists of stores always stay in this browser.');
    await page.fill('#scSubject', TEXT.subject);
    await page.fill('#scBody', TEXT.body);
    await expect(line).toHaveAttribute('data-draftstate', 'saving');
    await expect(line).toHaveAttribute('data-draftstate', 'saved');
    await expect(line).toContainText('Saved for every phone and computer.');
    expect(saves(backend).length).toBe(1);                                           // typing is gathered into one save
    const first = saves(backend)[0];
    expect(first).toMatchObject({ p_key: 'store_campaign', p_audience: 'owner_admin', p_value: { subject: TEXT.subject, body: TEXT.body, approval: null, count: '20', order: 'nearest' } });
    expect(Object.keys(first.p_value).sort()).toEqual(['address', 'approval', 'body', 'count', 'order', 'savedAt', 'startDay', 'subject']);
    // a list of stores, pasted or scored, changes nothing that is shared: no new save
    await P.locator('[data-sc="sf-example"]').click();
    await P.locator('[data-sc="sf-score"]').click();
    await P.locator('[data-sc="sf-use"]').click();
    await page.locator('#scStores').pressSequentially(' ');
    await page.waitForTimeout(1300);
    expect(saves(backend).length).toBe(1);
    // the approval goes up too
    await P.locator('[data-sc="approve"]').click();
    await expect.poll(() => saves(backend).length).toBe(2);
    expect(saves(backend)[1].p_value.approval).toMatchObject({ status: 'APPROVED', sent: false });
    expect(JSON.stringify(saves(backend))).not.toMatch(/EXAMPLE|example\.test/);     // no store ever leaves the browser
    expect(pageErrors).toEqual([]);
  });

  test('another phone or computer: the saved wording and its approval are there when the page opens, and nothing is saved back', async ({ page, backend }) => {
    const approval = SC.approveWording(TEXT, 'SYNTHETIC Owner', '2026-11-24T15:00:00Z', deps);
    await on(page, true); store(backend);
    backend.tables.shared_settings = [row('store_campaign', { subject: TEXT.subject, body: TEXT.body, approval, count: '35', order: 'best', startDay: '2026-12-01', address: '1 SYNTHETIC Street', savedAt: '2026-11-24T15:00:05.000Z' }),
      row('content_helper', { product: 'SYNTHETIC Cocoa Lotion', story: 'a rich chocolate-scented body lotion we make in small batches', kind: 'email', tone: 'premium', look: 'night', own: 'My own words.', savedAt: '2026-11-24T15:10:00.000Z' }),
      row('customer_emails', { kind: 'winBack', texts: { winBack: { subject: 'We miss you, {name}', body: 'Hi {name}, it has been a while and we wanted to say hello from our small shop.', approval: null } }, days: { winBack: '150' }, startDay: '2026-12-02', address: '1 SYNTHETIC Street', savedAt: '2026-11-24T15:20:00.000Z' })];
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    await expect(page.locator('#scSubject')).toHaveValue(TEXT.subject);
    await expect(page.locator('#scCount')).toHaveValue('35');
    await expect(page.locator('#scOrder')).toHaveValue('best');
    await expect(page.locator('#scAddress')).toHaveValue('1 SYNTHETIC Street');
    await expect(page.locator('#storeCampaignsPanel [data-scapproval]')).toHaveAttribute('data-scapproval', 'approved');   // approved on the other device: still approved here
    await expect(page.locator('[data-draftshare="store"]')).toHaveAttribute('data-draftstate', 'saved');
    await gotoPage(page, 'contentHelperPanel');
    await expect(page.locator('#chProduct')).toHaveValue('SYNTHETIC Cocoa Lotion');
    await expect(page.locator('#chOwn')).toHaveValue('My own words.');
    await expect(page.locator('#contentHelperPanel [data-chkind="email"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#contentHelperPanel [data-chtone="premium"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#contentHelperPanel [data-chcard]')).toHaveAttribute('data-chcard', 'night');
    await gotoPage(page, 'customerEmailsPanel');
    await expect(page.locator('#customerEmailsPanel [data-cekind="winBack"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#ceSubject')).toHaveValue('We miss you, {name}');
    await expect(page.locator('#ceDays')).toHaveValue('150');
    await page.waitForTimeout(1300);
    expect(saves(backend)).toEqual([]);
    // and it is kept in this browser too, for when the database cannot be reached
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_store_campaign_v1')))).toMatchObject({ subject: TEXT.subject, savedAt: '2026-11-24T15:00:05.000Z' });
  });

  test('the newer copy wins: a draft typed here after the saved one goes up; an older one here is replaced', async ({ page, backend }) => {
    await on(page, true); store(backend);
    backend.tables.shared_settings = [row('store_campaign', { subject: 'The saved subject', body: TEXT.body, approval: null, count: '20', order: 'nearest', startDay: '2026-12-01', address: '', savedAt: '2026-11-24T15:00:00.000Z' }),
      row('content_helper', { product: 'SYNTHETIC Saved', story: 'the saved story, long enough to make drafts from it', kind: 'post', tone: 'plain', look: 'clean', own: '', savedAt: '2026-11-24T15:00:00.000Z' })];
    await page.addInitScript(() => { try {
      if (!localStorage.getItem('he_store_campaign_v1')) localStorage.setItem('he_store_campaign_v1', JSON.stringify({ subject: 'Typed here later', body: 'x', savedAt: '2026-11-24T16:00:00.000Z' }));
      if (!localStorage.getItem('he_content_helper_v1')) localStorage.setItem('he_content_helper_v1', JSON.stringify({ product: 'SYNTHETIC Older here', story: 'an older story', savedAt: '2026-11-24T14:00:00.000Z' }));
    } catch (e) {} });
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    await expect(page.locator('#scSubject')).toHaveValue('Typed here later');          // newer here: kept, and sent up
    await expect.poll(() => saves(backend).length).toBe(1);
    expect(saves(backend)[0]).toMatchObject({ p_key: 'store_campaign', p_value: { subject: 'Typed here later', savedAt: '2026-11-24T16:00:00.000Z' } });
    await gotoPage(page, 'contentHelperPanel');
    await expect(page.locator('#chProduct')).toHaveValue('SYNTHETIC Saved');           // older here: replaced by the saved one
    await page.waitForTimeout(1300);
    expect(saves(backend).length).toBe(1);
  });

  test('customer emails: the wording follows the owner; no customer ever does', async ({ page, backend }) => {
    await on(page, true); store(backend);
    backend.tables.orders = [{ id: 'd-1', order_number: 'HE-3001', customer_name: 'SYNTHETIC Person1', customer_email: 'person1@example.test', channel: 'shopify', source: 'shopify', status: 'paid', currency: 'USD', total: 20,
      placed_at: new Date(Date.now() - 86400000).toISOString(), deleted_at: null }];
    await login(page);
    await gotoPage(page, 'customerEmailsPanel');
    const P = page.locator('#customerEmailsPanel');
    await expect(P.locator('[data-draftshare="customer"]')).toContainText('The customer list is read from your orders when you ask and is not kept anywhere.');
    await P.locator('[data-cekind="newProduct"]').click();
    await P.locator('[data-cetemplate="short"]').click();
    await P.locator('[data-ce="approve"]').click();
    await P.locator('[data-ce="show"]').click();
    await expect(P.locator('[data-cechosen]')).toHaveAttribute('data-cechosen', '1');
    await expect(P.locator('[data-draftshare="customer"]')).toHaveAttribute('data-draftstate', 'saved');
    const all = saves(backend);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.every(b => b.p_key === 'customer_emails' && b.p_audience === 'owner_admin')).toBe(true);
    expect(all[all.length - 1].p_value).toMatchObject({ kind: 'newProduct', texts: { newProduct: { subject: 'New in our shop', approval: { status: 'APPROVED' } } } });
    expect(JSON.stringify(all)).not.toMatch(/person1|SYNTHETIC Person/);
  });

  test('when saving fails, or the draft is too large, it says so and the draft stays in this browser', async ({ page, backend }) => {
    await on(page, true);
    backend.tables.shared_settings = [];
    backend.rpc.set_shared_setting = () => ({ __error: { status: 500, code: 'XX000', message: 'SYNTHETIC failure' } });
    await login(page);
    await gotoPage(page, 'contentHelperPanel');
    await page.fill('#chProduct', 'SYNTHETIC Lotion');
    const line = page.locator('[data-draftshare="content"]');
    await expect(line).toHaveAttribute('data-draftstate', 'failed');
    await expect(line).toContainText('Could not save for every device');
    await expect(line).toContainText('Kept in this browser.');
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_content_helper_v1'))).product).toBe('SYNTHETIC Lotion');
    // five long emails are more than a setting can hold: refused before anything is sent
    await gotoPage(page, 'customerEmailsPanel');
    const before = saves(backend).length;
    for (const kind of ['welcome', 'reorder', 'newProduct', 'winBack', 'review']) {
      await page.locator(`#customerEmailsPanel [data-cekind="${kind}"]`).click();
      await page.fill('#ceBody', 'Hi {name}, ' + 'a long line of plain words for you. '.repeat(55));
    }
    const cline = page.locator('[data-draftshare="customer"]');
    await expect(cline).toHaveAttribute('data-draftstate', 'failed');
    await expect(cline).toContainText('This setting is too large to save.');
    expect(saves(backend).length).toBe(before);
  });

  test('an administrator sees the owner\'s saved draft; an administrator\'s own changes stay in the browser', async ({ page, backend }) => {
    await on(page, true); store(backend);
    backend.tables.profiles[0].role = 'administrator';
    backend.tables.shared_settings = [row('store_campaign', { subject: 'The owner wrote this', body: TEXT.body, approval: null, count: '20', order: 'nearest', startDay: '2026-12-01', address: '', savedAt: '2026-11-24T15:00:00.000Z' })];
    await login(page);
    await gotoPage(page, 'storeCampaignsPanel');
    await expect(page.locator('#scSubject')).toHaveValue('The owner wrote this');
    await page.fill('#scSubject', 'An administrator changed it');
    await expect(page.locator('[data-draftshare="store"]')).toContainText('Only the owner\'s changes are saved for every device. Yours are kept in this browser.');
    await page.waitForTimeout(1300);
    expect(saves(backend)).toEqual([]);
  });

  test('the shared settings switched on but not installed in the database: said plainly, the draft stays in the browser', async ({ page, backend }) => {
    await on(page, true);
    await page.route('**/rest/v1/shared_settings?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.shared_settings' in the schema cache" }) }));
    await login(page);
    await gotoPage(page, 'contentHelperPanel');
    const line = page.locator('[data-draftshare="content"]');
    await expect(line).toHaveAttribute('data-draftstate', 'failed');
    await expect(line).toContainText('not installed in the database yet');
    await page.fill('#chProduct', 'SYNTHETIC Lotion');
    await expect(page.locator('#chProduct')).toHaveValue('SYNTHETIC Lotion');
  });
});
