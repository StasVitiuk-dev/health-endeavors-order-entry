// Pagination / scale audit (2026-10-06): long id lists in one URL. Real API
// gateways refuse URLs past a few KB (the mock does too with maxUrlLength).
// Each test fails on the code before the fix.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.describe('calendar notes for a busy day', () => {
  test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

  test('120 events with long ids: every note is shown (fetched in small batches)', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'data loading, not layout; run once');
    const uid = n => 'synthetic-google-event-' + String(n).padStart(4, '0') + '-' + 'x'.repeat(40) + '@google.com';
    backend.tables.calendar_events = Array.from({ length: 120 }, (_, i) => ({
      id: 'ce-' + i, uid: uid(i), calendar_name: 'SYNTHETIC Work', summary: 'SYNTHETIC event ' + i, location: null,
      starts_at: new Date(Date.UTC(2026, 5, 15, 13, 0) + i * 60000).toISOString(), ends_at: null, all_day: false,
    }));
    backend.tables.calendar_notes = backend.tables.calendar_events.map((e, i) => ({ event_uid: e.uid, note: 'SYNTHETIC note ' + i }));
    backend.maxUrlLength = 8000;
    await page.clock.setFixedTime(new Date('2026-06-15T15:00:00Z'));
    await login(page);
    await gotoPage(page, 'calendarPanel');
    await page.locator('#calViewToggle button[data-calview="day"]').click();
    await expect(page.locator('#calBody')).toContainText('SYNTHETIC event 119');
    await expect(page.locator("#calBody")).toContainText("SYNTHETIC note 119");
    const noteReqs = backend.requests.filter(r => r.table === 'calendar_notes' && r.method === 'GET');
    expect(noteReqs.length).toBeGreaterThan(1);
    for (const r of noteReqs) expect(r.path.length + r.query.length).toBeLessThan(8000);
  });
});

test.describe('customer inquiries linked to many orders', () => {
  test('200 inquiries: the order numbers load without one huge URL', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'data loading, not layout; run once');
    const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
    backend.tables.orders = Array.from({ length: 200 }, (_, i) => ({ id: id(i), order_number: 'SYN-' + (5000 + i), status: 'paid', created_at: '2026-09-01T00:00:00Z' }));
    backend.tables.customer_inquiries = Array.from({ length: 200 }, (_, i) => ({
      id: 'inq-' + i, order_id: id(i), customer_name: 'SYNTHETIC ' + i, customer_email: null, question_text: 'SYNTHETIC question ' + i,
      status: 'new', severity: 'low', ai_draft_reply: null, created_at: new Date(Date.UTC(2026, 8, 1) + i * 60000).toISOString(),
    }));
    backend.maxUrlLength = 6000;
    await login(page);
    await gotoPage(page, 'inquiriesPanel');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#dashError')).not.toContainText('inquiries');
    const orderReqs = backend.requests.filter(r => r.table === 'orders' && r.params.some(([k, v]) => k === 'id' && v.startsWith('in.')));
    expect(orderReqs.length).toBeGreaterThan(1);
    for (const r of orderReqs) expect(r.path.length + r.query.length).toBeLessThan(6000);
  });
});
