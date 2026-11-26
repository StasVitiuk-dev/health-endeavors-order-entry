// Shared test setup: every test gets a browser page whose network is fully
// mocked (see mock-supabase.js), plus a record of any JavaScript error the
// dashboard hit. After each test we also check that nothing tried to reach
// anything outside the mock.

const base = require('@playwright/test');
const { installMocks, OWNER_USER } = require('./mock-supabase');
const { checkWrite } = require('./db-constraints');

const MENU = require('../../assets/views/he-menu-layouts.js');

const test = base.test.extend({
  // The menu these tests see. The dashboard ships with a shorter menu (owner, Nov 24:
  // same-topic pages sit inside one another). Most tests are about what is ON a page,
  // not about the menu, so they run with the full menu ("Today's menu": every page on
  // its own line), set the way a person sets it and only when nothing is set yet.
  // `test.use({ shippedMenu: true })` (or HE_SHIPPED_MENU=1 for a whole run) leaves the
  // menu as shipped; tests/specs/menu-layouts-ext24.spec.js covers that menu.
  shippedMenu: [process.env.HE_SHIPPED_MENU === '1', { option: true }],
  // auto: installed for every test, even ones that never mention it, so no
  // test can ever run with the real network.
  backend: [async ({ page, shippedMenu }, use) => {
    if (!shippedMenu) await page.addInitScript(() => { try { if (localStorage.getItem('he_menu_layout') === null) localStorage.setItem('he_menu_layout', 'today'); } catch (e) { /* storage blocked */ } });
    const backend = await installMocks(page);
    await use(backend);
    base.expect(backend.blocked, 'the page tried to reach something outside the mock').toEqual([]);
    if (!backend.allowUnguardedState) {
      base.expect(backend.unguardedStateWrites, 'the page changed a workflow state without checking it was still what the page showed (STATE_COLUMNS in mock-supabase.js)').toEqual([]);
    }
    if (!backend.expectViolations) {
      base.expect(backend.constraintViolations, 'the page wrote a value the real database refuses (tests/helpers/db-constraints.js)').toEqual([]);
      // The mock's tables (including rows a test seeded) must also be a state
      // the real database could actually hold.
      const impossible = backend.allowImpossibleData ? [] : Object.entries(backend.tables).flatMap(([t, rows]) => Array.isArray(rows) ? checkWrite(t, rows) : []);
      base.expect(impossible, 'the test data holds a value the real database refuses').toEqual([]);
    }
  }, { auto: true }],
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', err => errors.push('pageerror: ' + err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
    await use(errors);
  },
});
const expect = base.expect;

// Opens the owner dashboard and signs in with the synthetic owner account,
// going through the real login form.
// EXT16 prototype (opt-in, HE_FAST_LOGIN=1): the first sign-in in a worker saves the
// synthetic session; later tests restore it before the page loads, instead of typing the
// form. Each test still has its own fresh mock database (the session is only the
// synthetic token). The restore runs once per page (a sessionStorage flag), so a test that
// signs out and reloads really is signed out afterwards. Default: OFF (every test signs in
// through the form, as before).
let SAVED_SESSION = null;
// Nov 24: signing out reloads the page on its own a moment later. A test that signs
// in again straight away could have its own navigation cut short by that reload
// ("interrupted by another navigation"), by chance. Let the page settle and go again.
async function gotoLogin(page) {
  try { await page.goto('/owner-login.html'); }
  catch (e) {
    if (!/interrupted by another navigation/.test(String(e && e.message))) throw e;
    await page.waitForLoadState('load');
    await page.goto('/owner-login.html');
  }
}
async function login(page) {
  if (process.env.HE_FAST_LOGIN === '1' && SAVED_SESSION) {
    await page.addInitScript(entries => {
      try {
        if (sessionStorage.getItem('__heFastLogin')) return;
        sessionStorage.setItem('__heFastLogin', '1');
        for (const [k, v] of entries) localStorage.setItem(k, v);
      } catch (e) { /* storage blocked: the page then shows the sign-in form */ }
    }, SAVED_SESSION);
    await gotoLogin(page);
    await expect(page.locator('#dash')).toBeVisible();
    await expect(page.locator('#whoAmI')).toContainText('Synthetic Owner');
    return;
  }
  await gotoLogin(page);
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('#whoAmI')).toContainText('Synthetic Owner');
  if (process.env.HE_FAST_LOGIN === '1' && !SAVED_SESSION) {
    SAVED_SESSION = await page.evaluate(() => Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)).map(k => [k, localStorage.getItem(k)]));
    if (!SAVED_SESSION.length) SAVED_SESSION = null; // nothing to reuse: keep using the form
  }
}

// Unfolds every folded sidebar section, so every page link is present.
async function unfoldSidebar(page) {
  for (;;) {
    const folded = page.locator('#sidebarGroups .groupToggle[aria-expanded="false"]');
    if (!(await folded.count())) return;
    await folded.first().click();
  }
}

// On a phone the sidebar is hidden behind the menu button; open it if needed.
async function openMenuIfMobile(page) {
  const menuBtn = page.locator('#menuToggleBtn');
  if (!(await menuBtn.isVisible())) return;
  const isOpen = await page.locator('#sidebarNav').evaluate(el => el.classList.contains('mobileOpen'));
  if (!isOpen) await menuBtn.click();
}

// Opens a page from the sidebar the way a person would.
async function gotoPage(page, pageId) {
  await openMenuIfMobile(page);
  if (await page.inputValue('#sidebarSearch')) await page.fill('#sidebarSearch', '');
  await unfoldSidebar(page);
  // The sidebar is re-drawn whenever a background load finishes (badge
  // counts). Under heavy CPU load a click can land just as the link is
  // replaced and be lost (seen once in 3 repeat runs, EXT5). A person would
  // click again; so does this, and the page must still really open.
  // - The first click always happens: on a phone it is also what closes the
  //   menu, even when the page is already the open one.
  // - Each try waits the normal 5 s before clicking again (a 10,000-row page
  //   takes seconds to draw; re-clicking sooner only restarts the drawing).
  // - A retry re-opens the phone menu first, never clicks a page that has
  //   opened, and gives up its click after 5 s instead of hanging the test.
  const section = page.locator(`section#${pageId}`);
  let link = page.locator(`#sidebarGroups .sidebarLink[data-page="${pageId}"]`).first();
  // With a shorter menu the page may sit inside another: a person opens that line,
  // then presses the page's button in the row at the top.
  let inside = null;
  if (!(await link.count())) {
    const key = MENU.fromStored(await page.evaluate(() => { try { return localStorage.getItem('he_menu_layout'); } catch (e) { return null; } }));
    const entry = key ? [].concat(...MENU.LAYOUTS[key].groups.map(g => g.pages)).map(p => (Array.isArray(p) ? p : p.tabs)).find(ids => ids.includes(pageId)) : null;
    if (entry) {
      for (const id of entry) { const l = page.locator(`#sidebarGroups .sidebarLink[data-page="${id}"]`).first(); if (await l.count()) { link = l; break; } }
      inside = page.locator(`#menuTabs [data-menutab="${pageId}"]`);
    }
  }
  const open = async (timeout) => {
    await link.click(timeout ? { timeout } : undefined);
    if (inside) await inside.click({ timeout: timeout || 10000 });
  };
  await open();
  await expect(async () => {
    if (!/\bactivePage\b/.test(await section.getAttribute('class') || '')) {
      await openMenuIfMobile(page);
      await open(5000);
    }
    await expect(section).toHaveClass(/activePage/, { timeout: 5000 });
  }).toPass({ timeout: 20000 });
  // Opening a page plays a short slide-in (panelIn, 0.26 s, 6 px; only where the device allows
  // motion). On a busy machine it can still be running when a test measures where a button is,
  // so a button looked as if it moved by 4.5 px (full run on c5db3ed, Nov 26). Wait for it; a
  // cancelled animation (another page opened) or no animation at all simply continues.
  await section.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => null))));
}

async function openTasks(page) {
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('#tasksTableWrap table')).toBeVisible();
  // The other pages keep loading in the background after login; wait for
  // them so nothing shifts the layout while a test measures or clicks.
  await page.waitForLoadState('networkidle');
}

function taskRow(page, id) {
  return page.locator(`#tasksTableWrap tr[data-id="${id}"]`);
}

module.exports = { test, expect, login, gotoPage, unfoldSidebar, openMenuIfMobile, openTasks, taskRow, OWNER_USER };
