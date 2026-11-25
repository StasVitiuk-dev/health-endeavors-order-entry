// Feature switches shared by every device (owner decision, Nov 23 evening): a
// switch turned on once is on on every phone and computer; work features for
// every employee, money and sensitive documents for the owner and administrators;
// the owner or an administrator flips a switch (owner decision of Nov 24). assets/views/he-shared-switches.js, on top of the
// shared settings (docs/ops/sql/drafts/50). Until that step is installed, switches
// stay per browser (preview-switches-ext21). Every value is made up.
const W = require('../../assets/views/he-shared-switches.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
// Nov 24: reads of the browser's storage inside expect.poll catch a page reload in progress
// (the one reload after the shared switches arrive) and simply try again.

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const SW = [{ key: 'he_order_slips' }, { key: 'he_real_profit' }, { key: 'he_attention_feed' }];
const EVERYONE = ['he_order_slips', 'he_attention_feed'];
const mem = (init) => { const m = Object.assign({}, init); return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };

test.describe('the rules (no browser)', () => {
  test('who gets a switch: work features everyone, the rest owner and administrators', ({}, ti) => {
    node(ti);
    const value = { on: { he_order_slips: true, he_real_profit: true, he_unknown: true } };
    expect(W.effective(value, SW, 'owner', EVERYONE)).toEqual({ he_order_slips: true, he_real_profit: true, he_attention_feed: false });
    expect(W.effective(value, SW, 'administrator', EVERYONE)).toEqual({ he_order_slips: true, he_real_profit: true, he_attention_feed: false });
    expect(W.effective(value, SW, 'employee', EVERYONE)).toEqual({ he_order_slips: true, he_real_profit: false, he_attention_feed: false });
    expect(W.effective(value, SW, undefined, EVERYONE).he_real_profit).toBe(false);
    expect(W.audienceOf('he_real_profit', EVERYONE)).toBe('owner_admin');
    expect(W.audienceOf('he_anything_new', EVERYONE)).toBe('owner_admin');          // a new switch is never for everyone by accident
    expect(W.audienceOf('he_order_slips', null)).toBe('owner_admin');
  });

  test('bringing a browser in line; the first share; one switch at a time; broken input', ({}, ti) => {
    node(ti);
    const s = mem({ he_real_profit: 'on', he_other_thing: 'keep' });
    expect(W.apply({ he_order_slips: true, he_real_profit: false, he_attention_feed: false }, s).sort()).toEqual(['he_order_slips', 'he_real_profit']);
    expect(s.m).toEqual({ he_order_slips: 'on', he_other_thing: 'keep' });
    expect(W.apply({ he_order_slips: true }, s)).toEqual([]);                        // already in line
    expect(W.apply({ 'not a key': true }, s)).toEqual([]);
    expect(W.apply({ he_order_slips: true }, { getItem: () => { throw new Error('blocked'); } })).toEqual([]);
    expect(W.fromStorage(SW, s)).toEqual({ on: { he_order_slips: true } });
    expect(W.nextValue({ on: { he_order_slips: true, he_gone: true } }, SW, 'he_real_profit', true)).toEqual({ on: { he_order_slips: true, he_real_profit: true } });
    expect(W.nextValue({ on: { he_order_slips: true } }, SW, 'he_order_slips', false)).toEqual({ on: {} });
    expect(W.nextValue(null, SW, 'he_not_listed', true)).toEqual({ on: {} });          // only listed switches are ever kept
    expect(W.effective(null, null, 'owner', null)).toEqual({});
    expect(W.signature({ b: true, a: true, c: false })).toBe('a,b');
  });
});

const shared = (on) => [{ id: 'feature_switches', key: 'feature_switches', value: { on }, audience: 'staff', updated_at: '2026-11-24T16:00:00Z', updated_by: '00000000-0000-4000-8000-000000000001' }];

test.describe('on the dashboard, with the shared settings installed', () => {
  // the shared settings are in use in this browser (the owner's switch; later the rule for every device)
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('he_shared_settings', 'on'); } catch (e) {} }); });
  test('a switch turned on elsewhere is on here after signing in; the owner turns one on for every device', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    backend.tables.shared_settings = shared({ he_order_slips: true });
    backend.rpc.set_shared_setting = (body) => { backend.tables.shared_settings = [{ id: body.p_key, key: body.p_key, value: body.p_value, audience: body.p_audience, updated_at: '2026-11-24T16:05:00Z', updated_by: 'x' }]; return { ok: true, key: body.p_key, updated_at: '2026-11-24T16:05:00Z' }; };
    await login(page);
    await expect(page.locator('#dash')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('he_order_slips')).catch(() => null)).toBe('on');   // brought in line at sign-in
    await gotoPage(page, 'flagsPanel');
    const host = page.locator('#previewSwitchesHost');
    await expect(host.locator('[data-preview-shared]')).toHaveAttribute('data-preview-shared', 'installed');
    await expect(host.locator('[data-preview-shared]')).toContainText('turning one on here turns it on on every phone and computer');
    await expect(host.locator('tr[data-preview-key="he_order_slips"]')).toHaveAttribute('data-preview-on', 'yes');
    await expect(host.locator('tr[data-preview-key="he_order_slips"] [data-preview-audience]')).toHaveText('Every employee');
    await expect(host.locator('tr[data-preview-key="he_real_profit"] [data-preview-audience]')).toHaveText('Owner and administrators');
    await host.getByRole('button', { name: 'Turn on Real profit' }).click();
    await expect(host.locator('[data-preview-msg]')).toContainText('Real profit is on for every device (owner and administrators).');
    const saves = backend.requests.filter(r => r.rpc === 'set_shared_setting');
    expect(saves).toHaveLength(1);
    expect(saves[0].body).toMatchObject({ p_key: 'feature_switches', p_audience: 'staff', p_value: { on: { he_order_slips: true, he_real_profit: true } } });
    expect(await page.evaluate(() => localStorage.getItem('he_real_profit'))).toBe('on');
    // turn all off: for every device
    await host.getByRole('button', { name: 'Turn all off' }).click();
    await expect(host.locator('[data-preview-msg]')).toContainText('All previews are off on every device.');
    expect(backend.tables.shared_settings[0].value).toEqual({ on: {} });
    expect(await page.evaluate(() => [localStorage.getItem('he_order_slips'), localStorage.getItem('he_real_profit')])).toEqual([null, null]);
  });

  test('an administrator changes a switch for every device too (owner decision, Nov 24)', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    backend.tables.shared_settings = shared({ he_real_profit: true });
    backend.tables.profiles[0].role = 'administrator';
    backend.rpc.set_shared_setting = (body) => { backend.tables.shared_settings = [{ id: body.p_key, key: body.p_key, value: body.p_value, audience: body.p_audience, updated_at: '2026-11-24T16:05:00Z', updated_by: 'x' }]; return { ok: true, key: body.p_key, updated_at: '2026-11-24T16:05:00Z' }; };
    await login(page);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('he_real_profit')).catch(() => null)).toBe('on');
    await gotoPage(page, 'flagsPanel');
    const host = page.locator('#previewSwitchesHost');
    await expect(host.locator('[data-preview-shared]')).toContainText('The owner and administrators can change a switch.');
    await host.getByRole('button', { name: 'Turn off Real profit' }).click();
    await expect(host.locator('[data-preview-msg]')).toContainText('Real profit is off on every device.');
    const saves = backend.requests.filter(r => r.rpc === 'set_shared_setting');
    expect(saves).toHaveLength(1);
    expect(saves[0].body).toMatchObject({ p_key: 'feature_switches', p_audience: 'staff', p_value: { on: {} } });
  });

  test('a refusal by the database changes nothing', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    backend.tables.shared_settings = shared({ he_real_profit: true });
    backend.tables.profiles[0].role = 'administrator';
    backend.rpc.set_shared_setting = () => ({ __error: { status: 403, code: '42501', message: 'Only the owner or an administrator can change a shared setting.' } });
    await login(page);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('he_real_profit')).catch(() => null)).toBe('on');
    await gotoPage(page, 'flagsPanel');
    const host = page.locator('#previewSwitchesHost');
    await host.getByRole('button', { name: 'Turn off Real profit' }).click();
    await expect(host.locator('[data-preview-msg]')).toContainText('Nothing was changed.');
    expect(await page.evaluate(() => localStorage.getItem('he_real_profit'))).toBe('on');
  });

  test('an employee gets the work switches only', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    backend.tables.shared_settings = shared({ he_order_slips: true, he_real_profit: true, he_money_match: true });
    backend.tables.profiles[0].role = 'employee';
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('he_money_match', 'on'); sessionStorage.setItem('seeded', '1'); } } catch (e) {} });
    await login(page);
    await expect(page.locator('#dash')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('he_order_slips')).catch(() => null)).toBe('on');
    expect(await page.evaluate(() => [localStorage.getItem('he_real_profit'), localStorage.getItem('he_money_match')])).toEqual([null, null]);   // money switches: never for an employee, even if this browser had one on
  });
});

test.describe('without the shared settings (today)', () => {
  test('switches stay in this browser, and the page says so', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await login(page); await gotoPage(page, 'flagsPanel');
    const host = page.locator('#previewSwitchesHost');
    await expect(host.locator('[data-preview-shared]')).toHaveText('Until the shared settings database step (drafts/50) is installed, a switch applies to this browser only.');
    await host.getByRole('button', { name: 'Turn on Packing slips' }).click();
    await expect(host.locator('[data-preview-msg]')).toContainText('Packing slips is on. Reload the page, then open Orders.');
    expect(await page.evaluate(() => localStorage.getItem('he_order_slips'))).toBe('on');
    expect(backend.requests.filter(r => r.rpc === 'set_shared_setting')).toEqual([]);
    // and nothing was asked of the shared settings at sign-in (no failed request before the step is installed)
    expect(backend.requests.filter(r => r.table === 'shared_settings' && !(r.params || []).some(([k, v]) => k === 'limit' && v === '0')).length).toBe(0);   // (the owner's install check on this page reads no rows: limit 0)
  });
});
