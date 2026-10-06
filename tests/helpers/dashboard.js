// Shared test setup: every test gets a browser page whose network is fully
// mocked (see mock-supabase.js), plus a record of any JavaScript error the
// dashboard hit. After each test we also check that nothing tried to reach
// anything outside the mock.

const base = require('@playwright/test');
const { installMocks, OWNER_USER } = require('./mock-supabase');
const { checkWrite } = require('./db-constraints');

const test = base.test.extend({
  // auto: installed for every test, even ones that never mention it, so no
  // test can ever run with the real network.
  backend: [async ({ page }, use) => {
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
async function login(page) {
  await page.goto('/owner-login.html');
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('#whoAmI')).toContainText('Synthetic Owner');
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
  await expect(async () => {
    await page.locator(`#sidebarGroups .sidebarLink[data-page="${pageId}"]`).first().click();
    await expect(page.locator(`section#${pageId}`)).toHaveClass(/activePage/, { timeout: 2000 });
  }).toPass({ timeout: 15000 });
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
