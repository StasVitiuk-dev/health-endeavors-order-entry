// Sales outreach workbench on the Sales Approvals page (owner's Nov 3 brief,
// point 8): the workflow runnable end to end in the dashboard, with state kept
// in this browser and a reset. Shown only with Sales & Growth switched on.
// SIMULATED: nothing is sent; synthetic stores only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableSalesFlag } = require('../helpers/sales-pages');

test('Sales & Growth off (default): no workbench anywhere', async ({ page }) => {
  await login(page);
  await expect(page.locator('#salesWorkbenchHost')).toHaveCount(0);
});

test('the whole path in the page: import, draft, edit cancels approval, approve, simulated send, reply, reload, reset', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run the journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enableSalesFlag(page);
  await login(page);
  await gotoPage(page, 'salesApprovalsPanel');
  const wb = page.locator('#salesWorkbenchHost .salesWorkbench');
  const msg = wb.locator('[data-wb-msg]');
  await expect(wb).toContainText('SIMULATED — nothing is sent');
  await expect(wb).toContainText('No stores yet');

  // Import: a duplicate is marked, an unusable row says why.
  await wb.locator('[data-workbench="import"]').click();
  await expect(wb.locator('tr[data-wb-store]')).toHaveCount(5);
  await expect(wb.locator('tr[data-wb-store="S2"]')).toHaveAttribute('data-wb-status', 'LIKELY_DUPLICATE');
  await expect(wb.locator('tr[data-wb-store="S5"]')).toContainText('missing business name');

  // A weak fit is refused a draft, with the reason.
  await wb.getByRole('button', { name: 'Draft an email to SYN Corner Hardware' }).click();
  await expect(msg).toContainText('not qualified for outreach');

  // Draft, approve, then an edit cancels the approval and the send is refused.
  await wb.getByRole('button', { name: 'Draft an email to SYN Cedar Spa' }).click();
  const review = wb.locator('[data-wb-review="S1"]');
  await expect(review).toContainText('Uses approved facts only: productName = Shea Body Butter');
  await review.locator('[data-workbench="send"]').click();
  await expect(msg).toContainText('has not been approved');
  await review.locator('[data-workbench="approve"]').click();
  await expect(msg).toContainText('Approval is not sending');
  await review.getByLabel('Email text').fill('Hi SYN Cedar Spa team,\n\nShort note from Health Endeavors about Shea Body Butter.\n\nHealth Endeavors');
  await review.locator('[data-workbench="save"]').click();
  await expect(msg).toContainText('earlier approval no longer applies');
  await review.locator('[data-workbench="send"]').click();
  await expect(msg).toContainText('has not been approved');
  // A health claim cannot be saved.
  await review.getByLabel('Email text').fill('Our butter cures eczema.');
  await review.locator('[data-workbench="save"]').click();
  await expect(msg).toContainText('health claim');

  // Approve the edited version and send (simulated) — once only.
  await review.locator('[data-workbench="approve"]').click();
  await review.locator('[data-workbench="send"]').click();
  await expect(msg).toContainText('No email was sent');
  await expect(wb.locator('[data-wb-outbox="S1"]')).toContainText('version 2 · not delivered');
  await review.locator('[data-workbench="send"]').click();
  await expect(msg).toContainText('already sent once');

  // The store asks to be removed: suggestion, do-not-contact list, and no new draft.
  await review.getByLabel('The store replies (example)').selectOption('Please remove me from your list.');
  await review.locator('[data-workbench="reply"]').click();
  await expect(wb.locator('[data-wb-reply="UNSUBSCRIBE"]')).toContainText('next step: REVIEW — suppress');
  await expect(wb.locator('[data-wb-dnc]')).toContainText('buyer@cedarspa.example');
  await expect(wb.locator('tr[data-wb-store="S1"]')).toHaveAttribute('data-wb-status', 'DO NOT CONTACT');
  await expect(wb.locator('[data-wb-summary]')).toContainText('1 simulated-sent · 1 replies · 1 do-not-contact');

  // Kept after a reload (this browser only)...
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await gotoPage(page, 'salesApprovalsPanel');
  const wb2 = page.locator('#salesWorkbenchHost .salesWorkbench');
  await expect(wb2.locator('[data-wb-summary]')).toContainText('1 simulated-sent · 1 replies · 1 do-not-contact');
  await expect(wb2.locator('[data-wb-outbox="S1"]')).toHaveCount(1);
  // ...and Reset clears it, also from storage.
  await wb2.locator('[data-workbench="reset"]').click();
  await expect(wb2).toContainText('No stores yet');
  expect(await page.evaluate(() => localStorage.getItem('he_sales_workbench'))).toBeNull();
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('an employee does not get the Sales pages at all; an administrator can approve', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await enableSalesFlag(page);
  await login(page);
  backend.tables.profiles[0].role = 'employee';
  await page.reload();
  await expect(page.locator('#whoAmI')).toContainText('role: employee');
  await expect(page.locator('#sidebarGroups .sidebarLink[data-page="salesApprovalsPanel"]')).toHaveCount(0);
  backend.tables.profiles[0].role = 'administrator';
  await page.reload();
  await expect(page.locator('#whoAmI')).toContainText('role: administrator');
  await gotoPage(page, 'salesApprovalsPanel');
  const wb = page.locator('#salesWorkbenchHost .salesWorkbench');
  await wb.locator('[data-workbench="import"]').click();
  await wb.getByRole('button', { name: 'Draft an email to SYN Cedar Spa' }).click();
  await wb.locator('[data-wb-review="S1"] [data-workbench="approve"]').click();
  await expect(wb.locator('[data-wb-msg]')).toContainText('Approval is not sending');
  await expect(wb.locator('[data-wb-review="S1"]')).toContainText('approved by administrator (example)');
});

test('damaged saved data: the workbench starts empty and says so; nothing else breaks', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await enableSalesFlag(page);
  await page.addInitScript(() => { try { localStorage.setItem('he_sales_workbench', '{"version":1,"stores":"broken'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'salesApprovalsPanel');
  const wb = page.locator('#salesWorkbenchHost .salesWorkbench');
  await expect(wb.locator('[data-wb-msg]')).toContainText('could not be read, so it starts empty');
  await expect(wb).toContainText('No stores yet');
});
