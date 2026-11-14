// Daily-report US-Letter print view (local follow-on). A "Print report" button
// in the export preview builds a print layout of the report rows into the
// body-level print host: a table with the column headings repeated per sheet and
// a summary row. @media print (owner-login.css) hides the dashboard and breaks
// pages onto US-Letter sheets. Default-OFF (rides the he_report_export flag).
// Nothing is written or sent; window.print is stubbed so no dialog blocks.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('Print report builds the report print DOM: heading row + summary, no dialog', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_report_export', 'on'); } catch (e) {} window.print = () => {}; });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#reportExportHost [data-print="report"]')).toBeVisible();
  await expect(page.locator('#invoicePrintHost')).toBeEmpty();
  await page.locator('#reportExportHost [data-print="report"]').click();
  const host = page.locator('#invoicePrintHost');
  await expect(host.locator('.printPage')).toHaveCount(1);
  await expect(host.locator('.printPage thead th').first()).toHaveText('Date');
  await expect(host).toContainText('Daily report');
  await expect(host).toContainText('SIMULATED');
  // #72: the printed page carries the trace label.
  await expect(host.locator('[data-exportlabel="print"]')).toContainText(/HE · INTERNAL · trace [0-9a-f]{8}/);
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
