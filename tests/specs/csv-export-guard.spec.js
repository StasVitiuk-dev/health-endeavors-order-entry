// CSV exports (Tax Records, Employee Activity) must not produce cells that
// spreadsheet apps run as formulas. Text starting with = + - @ gets a leading
// apostrophe; plain numbers and money amounts (including negatives) stay as
// they are. Synthetic data only; the mock answers every request.

const fs = require('fs');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const YEAR = new Date().getFullYear();

async function download(page, buttonSelector) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.click(buttonSelector)]);
  return fs.readFileSync(await file.path(), 'utf8');
}

test('Tax Records CSV: formula-like vendor names are neutralised; money values unchanged', async ({ page, backend }) => {
  Object.assign(backend.tables, {
    orders: [],
    expenses: [
      { id: 'e1', category: 'advertising', amount: 10, expense_date: `${YEAR}-01-02`, vendor: '=SYNTHETIC formula vendor', receipt_path: null, deleted_at: null },
      { id: 'e2', category: 'software', amount: 12, expense_date: `${YEAR}-01-03`, vendor: '+SYNTHETIC plus vendor', receipt_path: null, deleted_at: null },
      { id: 'e3', category: 'other', amount: 8, expense_date: `${YEAR}-01-04`, vendor: '@SYNTHETIC at vendor', receipt_path: null, deleted_at: null },
      { id: 'e4', category: 'packaging', amount: 5, expense_date: `${YEAR}-01-05`, vendor: '-SYNTHETIC dash vendor', receipt_path: null, deleted_at: null },
      { id: 'e5', category: 'packaging', amount: 5, expense_date: `${YEAR}-01-06`, vendor: 'SYNTHETIC normal vendor', receipt_path: null, deleted_at: null },
    ],
  });
  await login(page);
  await gotoPage(page, 'taxRecordsPanel');
  await expect(page.locator('#taxReceiptWrap tbody tr')).toHaveCount(5);
  const csv = await download(page, '#taxExportBtn');

  expect(csv).toContain(`"'=SYNTHETIC formula vendor"`);
  expect(csv).toContain(`"'+SYNTHETIC plus vendor"`);
  expect(csv).toContain(`"'@SYNTHETIC at vendor"`);
  expect(csv).toContain(`"'-SYNTHETIC dash vendor"`);
  expect(csv).toContain(`"SYNTHETIC normal vendor"`);
  expect(csv).not.toMatch(/(^|,)"[=+@]/m);
  // No revenue and $40 of expenses: the negative net profit stays a plain amount.
  expect(csv).toContain('"-$40.00"');
  expect(csv).not.toContain(`"'-$40.00"`);
  expect(csv).toContain('"$10.00"');
});

test('Employee Activity CSV: formula-like names and changes are neutralised', async ({ page, backend }) => {
  backend.rpc.employee_activity = [{
    id: 1, happened_at: '2026-09-20T15:00:00Z', person_name: '=SYNTHETIC person', person_account_number: null, person_role: 'owner',
    table_name: 'tasks', area: 'Tasks', action: 'UPDATE', action_label: 'Updated', record_id: 'task-1',
    values_stored: true, old_data: { title: 'SYNTHETIC before' }, new_data: { title: '@SYNTHETIC after' },
  }];
  await login(page);
  await gotoPage(page, 'activityPanel');
  await expect(page.locator('#activityPanel')).toContainText('=SYNTHETIC person');
  const csv = await download(page, '#activityExportBtn');
  expect(csv).toContain(`"'=SYNTHETIC person"`);
  expect(csv).not.toMatch(/(^|,)"[=+@]/m);
});
