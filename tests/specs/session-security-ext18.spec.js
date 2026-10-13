// EXT18: sign-out and session hardening beyond the EXT3/EXT7/EXT8 tests
// (session-failures, auth-chaos).
//   * five tabs: a sign-out in one clears all the others
//   * a sign-out elsewhere while THIS tab is still waiting for a save: the
//     note must not claim the save "was not sent" (it was sent and may have
//     landed: the old sign-in stays valid on the server until it expires)
//   * Sign out pressed while the server cannot be reached: still signed out,
//     and still signed out after a reload
//   * a dialog open in another tab when the sign-out happens: gone with the data
//   * what the browser holds: only the sign-in token and plain preferences;
//     never a token in the address, the console or the diagnostic summary;
//     nothing of the token left after sign-out
// Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'session logic; run once'); });

const task = { id: 't1', title: 'SYNTHETIC task', priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' };
const TOKEN_KEY = /^sb-.*-auth-token$/;
const tokenKeys = p => p.evaluate(src => Object.keys(localStorage).filter(k => new RegExp(src).test(k)), TOKEN_KEY.source);
// After a sign-out the page reloads itself; a read during that reload fails
// ("execution context was destroyed"), so poll until the reload has finished.
const noTokenAfterReload = p => expect.poll(() => tokenKeys(p).catch(() => 'page still reloading')).toEqual([]);

// Several real tabs boot and reload here; under a fully loaded machine (8 workers)
// that takes longer than one tab, so these tests get more time (measured: up
// to 34 s for five tabs). The behaviour checked is unchanged.
const RELOAD = { timeout: 20000 };

test('five tabs: signing out in one leaves every other tab at once, each saying why', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);
  const tabs = [page];
  for (let i = 0; i < 4; i++) { const t = await page.context().newPage(); await t.goto(page.url()); await expect(t.locator('#dash')).toBeVisible(); tabs.push(t); }
  await tabs[2].click('#signout');
  for (const [i, t] of tabs.entries()) {
    await expect(t.locator('#loginScreen'), 'tab ' + i).toBeVisible(RELOAD);
    await expect(t.locator('#dash'), 'tab ' + i).toBeHidden();
    if (i !== 2) await expect(t.locator('#loginMsg'), 'tab ' + i).toContainText('You were signed out');
  }
  await noTokenAfterReload(page);
});

test('signed out elsewhere while a save is still on its way: the note says it may have been saved, not "not sent"', async ({ page, backend }) => {
  backend.tables.tasks = [task];
  enableWrites(backend, ['tasks']);
  await login(page);
  await gotoPage(page, 'tasksPanel');
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.locator('#dash')).toBeVisible();
  backend.delayMs.tasks = 4000;                     // the save is sent and is still waiting for its reply
  await page.locator('#tasksTableWrap .taskStatusBtn', { hasText: 'Mark in progress' }).click();
  await expect.poll(() => backend.requests.some(r => r.table === 'tasks' && r.method === 'PATCH')).toBe(true);
  await other.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible(RELOAD);
  const note = await page.locator('#loginMsg').innerText();
  expect(note).toContain('may or may not have been saved');
  expect(note).not.toContain('was not sent');
});

test('signed out elsewhere with nothing on its way: the note still says nothing unsaved was sent', async ({ page }) => {
  await login(page);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.click('#signout');
  await expect(page.locator('#loginMsg')).toContainText('was not sent', RELOAD);
  await expect(page.locator('#loginMsg')).not.toContainText('may or may not');
});

test('Sign out while the server cannot be reached: signed out here, and still after a reload', async ({ page, backend }) => {
  await login(page);
  await page.route('**/auth/v1/logout**', r => r.abort('internetdisconnected'));
  await page.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await noTokenAfterReload(page);
  await page.reload();
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#dash')).toBeHidden();
  backend.blocked = backend.blocked.filter(u => !/\/auth\/v1\/logout/.test(u));
});

test('a dialog open in another tab disappears with the data when the sign-out happens', async ({ page }) => {
  await login(page);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteOverlay.open')).toBeVisible();
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible(RELOAD);
  await expect(page.locator('#paletteOverlay.open')).toHaveCount(0);
  expect(await page.locator('#dash').evaluate(el => el.innerText.includes('SYNTHETIC'))).toBe(false);
});

test('what the browser holds: the sign-in token and plain preferences only; no token in the address, console or diagnostics', async ({ page, context }) => {
  const consoleText = [];
  page.on('console', m => consoleText.push(m.text()));
  await login(page);
  const store = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), url: location.href, cookies: document.cookie }));
  const ALLOWED_LOCAL = [/^sb-.*-auth-token$/, /^he[_.][A-Za-z_.]+$/];
  for (const k of store.local) expect(ALLOWED_LOCAL.some(r => r.test(k)), 'unexpected stored key ' + k).toBe(true);
  for (const k of store.session) expect(k, 'session storage key').toMatch(/^he[_.]|^__heFastLogin$/);
  expect(store.cookies, 'no cookies').toBe('');
  expect((await context.cookies()).length).toBe(0);
  const token = await page.evaluate(src => { const k = Object.keys(localStorage).find(x => new RegExp(src).test(x)); return k ? JSON.parse(localStorage.getItem(k)) : null; }, TOKEN_KEY.source);
  expect(token && token.access_token).toBeTruthy();
  const secrets = [token.access_token, token.refresh_token].filter(Boolean);
  for (const s of secrets) {
    expect(store.url).not.toContain(s);
    expect(consoleText.join('\n')).not.toContain(s);
  }
  // preferences hold no token and no e-mail address
  const prefs = await page.evaluate(() => Object.keys(localStorage).filter(k => /^he[_.]/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
  for (const s of secrets) expect(prefs).not.toContain(s);
  expect(prefs).not.toMatch(/@example\.test/);
  // diagnostic summary (the text people paste into a chat)
  await gotoPage(page, 'continuityPanel');
  await page.click('#copyDiagBtn');
  await expect(page.locator('#diagText')).toContainText('diagnostic summary', { timeout: 30000 });
  const diag = await page.locator('#diagText').textContent();
  for (const s of secrets) expect(diag).not.toContain(s);
  expect(diag).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  await page.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await noTokenAfterReload(page);
  await page.waitForLoadState('load');
  const after = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n') + Object.keys(sessionStorage).map(k => sessionStorage.getItem(k)).join('\n'));
  for (const s of secrets) expect(after, 'token left after sign-out').not.toContain(s);
});
