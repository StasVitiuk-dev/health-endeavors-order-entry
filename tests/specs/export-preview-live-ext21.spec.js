// Export preview over LIVE report rows (EXT21 L1). The default-OFF export
// preview packages the same nightly rows Report History loaded, not a synthetic
// day-set, when saved reports exist; with none saved it falls back to a clearly
// labelled demo set. It still writes no file and sends nothing. The preview
// renders AFTER the (parallel) history load via a composed loader.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('export preview packages the loaded saved reports (not the demo set)', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // four saved nightly rows in the mock backend
  backend.tables.daily_reports = [
    { id: 'dr-1', report_date: '2026-10-10', orders_count: 3, revenue: '100.00', currency: 'USD', new_inquiries_count: 1, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 2, ai_cost: '0.05', emailed_at: null },
    { id: 'dr-2', report_date: '2026-10-11', orders_count: 2, revenue: '80.00', currency: 'USD', new_inquiries_count: 0, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 1, ai_cost: '0.02', emailed_at: null },
    { id: 'dr-3', report_date: '2026-10-12', orders_count: 5, revenue: '150.00', currency: 'USD', new_inquiries_count: 2, tasks_opened_count: 1, incidents_opened_count: 0, ai_calls_count: 4, ai_cost: '0.11', emailed_at: null },
    { id: 'dr-4', report_date: '2026-10-13', orders_count: 1, revenue: null, currency: 'USD', new_inquiries_count: 0, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 1, ai_cost: '0.01', emailed_at: null },
  ];
  await page.addInitScript(() => { try { localStorage.setItem('he_report_export', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#reportExportHost');
  await expect(host).toContainText('Export preview');
  // it reflects the LIVE saved rows, not the 3-row demo set
  await expect(host).toContainText('saved reports (4 days)');
  await expect(host).toContainText('Rows: 4');
  await expect(host).toContainText('2026-10-10 → 2026-10-13');       // the loaded range
  await expect(host).toContainText('OK — checksum matches');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('with no saved reports, the preview falls back to a clearly labelled demo set', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  backend.tables.daily_reports = []; // empty database
  await page.addInitScript(() => { try { localStorage.setItem('he_report_export', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#reportExportHost');
  await expect(host).toContainText('demo data (no saved reports yet)');
});
