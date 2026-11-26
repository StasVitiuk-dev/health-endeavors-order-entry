// A Business Rules value changed but not yet saved survives the page drawing itself again
// (Nov 26). The list is redrawn on Refresh and by the quiet refresh every 5 minutes, which
// only waits while the cursor is in a box: a changed number used to go back to the saved
// one, with its Save button hidden. As in admin-pages.spec.js, every value is made up and
// the database is the mock.
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const writes = (backend) => backend.tableWrites().filter(r => r.table === 'business_rules');
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));
const RULES = () => [
  { id: 'br-refund', rule_key: 'refund_review_threshold_usd', label: 'SYNTHETIC Refund review', description: 'SYNTHETIC', config: { amount: 100 }, is_active: true },
  { id: 'br-custom', rule_key: 'synthetic_custom_rule', label: 'SYNTHETIC Custom rule', description: 'SYNTHETIC', config: { x: 1 }, is_active: true },
];
const row = (page, id) => page.locator(`#businessRulesWrap .flagRow[data-id="${id}"]`);

async function open(page, backend) {
  backend.tables.business_rules = RULES();
  await login(page);
  await gotoPage(page, 'businessRulesPanel');
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await expect(row(page, 'br-refund').locator('.ruleValueInput')).toHaveValue('100');
}
async function confirmPassword(page) {
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.click('#reauthConfirmBtn');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
}
async function redraw(page) {
  await page.locator('#businessRulesWrap').evaluate(el => el.querySelectorAll('.flagRow').forEach(r => r.setAttribute('data-test-old', '1')));
  await page.locator('#refreshBtn').click();
  await expect(page.locator('#businessRulesWrap .flagRow:not([data-test-old])')).toHaveCount(2);   // drawn again
}

test('a changed number survives Refresh, Save stays shown, and the save is guarded by the value it was changed from', async ({ page, backend }) => {
  await open(page, backend);
  await row(page, 'br-refund').locator('.ruleValueInput').fill('250');
  await row(page, 'br-custom').locator('.ruleConfigJson').fill('{"x":2}');
  await redraw(page);
  await expect(row(page, 'br-refund').locator('.ruleValueInput')).toHaveValue('250');
  await expect(row(page, 'br-refund').locator('.ruleSaveBtn')).toBeVisible();
  await expect(row(page, 'br-custom').locator('.ruleConfigJson')).toHaveValue('{"x":2}');
  await row(page, 'br-refund').locator('.ruleSaveBtn').click();
  await confirmPassword(page);
  await expect.poll(() => writes(backend).length).toBe(1);
  expect(writes(backend)[0].body.config).toEqual({ amount: 250 });
  expect(filtersOf(writes(backend)[0])).toEqual({ id: 'eq.br-refund', config: 'eq.{"amount":100}' });
});

test('changed elsewhere meanwhile: the kept number is still refused, then the other version is shown and can be changed', async ({ page, backend }) => {
  await open(page, backend);
  await row(page, 'br-refund').locator('.ruleValueInput').fill('250');
  backend.tables.business_rules[0].config = { amount: 999 };                                   // another tab saved
  await redraw(page);
  await expect(row(page, 'br-refund').locator('.ruleValueInput')).toHaveValue('250');           // kept
  await row(page, 'br-refund').locator('.ruleSaveBtn').click();
  await confirmPassword(page);
  await expect(page.locator('#dashError')).toContainText('changed');
  expect(backend.tables.business_rules[0].config).toEqual({ amount: 999 });                    // nothing overwritten
  await expect(row(page, 'br-refund').locator('.ruleValueInput')).toHaveValue('999');           // the other version, not 250 again
  await expect(row(page, 'br-refund').locator('.ruleSaveBtn')).toBeHidden();
  await row(page, 'br-refund').locator('.ruleValueInput').fill('300');
  await row(page, 'br-refund').locator('.ruleSaveBtn').click();
  await confirmPassword(page);
  await expect.poll(() => backend.tables.business_rules[0].config).toEqual({ amount: 300 });
});

test('nothing changed: Refresh shows the rule as it is now', async ({ page, backend }) => {
  await open(page, backend);
  backend.tables.business_rules[0].config = { amount: 120 };
  await redraw(page);
  await expect(row(page, 'br-refund').locator('.ruleValueInput')).toHaveValue('120');
  await expect(row(page, 'br-refund').locator('.ruleSaveBtn')).toBeHidden();
});

test('the quiet refresh every 5 minutes keeps the changed number too', async ({ page, backend }) => {
  await page.clock.install();
  await open(page, backend);
  await row(page, 'br-refund').locator('.ruleValueInput').fill('250');
  await page.locator('#businessRulesWrap').evaluate(el => el.querySelectorAll('.flagRow').forEach(r => r.setAttribute('data-test-old', '1')));
  await page.evaluate(() => document.activeElement && document.activeElement.blur());            // the cursor has left the box
  await page.clock.runFor(5 * 60 * 1000 + 1000);
  await expect(page.locator('#businessRulesWrap .flagRow:not([data-test-old])')).toHaveCount(2);
  await expect(row(page, 'br-refund').locator('.ruleValueInput')).toHaveValue('250');
  await expect(row(page, 'br-refund').locator('.ruleSaveBtn')).toBeVisible();
});
