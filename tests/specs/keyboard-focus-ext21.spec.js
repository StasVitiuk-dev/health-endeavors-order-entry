// Keyboard focus in the switch-gated sections that redraw themselves, and in
// the Scan Shipment dialog (Nov 15). Found by a probe, not by a person with a
// screen reader: when the dialog opened, focus stayed on the button behind it;
// after each step it fell to the page; and sections that redraw after a click
// lost the pressed button, sending a keyboard user back to the top of the page.
// A real VoiceOver check stays with the owner (Nov 3 review, item 10).
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const FLAGS = ['he_scan_shipment', 'he_reorder_planning', 'he_saved_views', 'he_cycle_count', 'he_report_versions', 'he_ops_watch'];
async function enable(page) {
  await page.addInitScript(flags => { try { flags.forEach(f => localStorage.setItem(f, 'on')); } catch (e) {} }, FLAGS);
}
const inOverlay = page => page.evaluate(() => { const o = document.getElementById('scanOverlay'); return !!o && o.contains(document.activeElement); });

test('scan dialog: focus moves in when it opens, stays in at every step, Escape closes and returns focus', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'keyboard; run once');
  await enable(page);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const entry = page.locator('#scanEntryOrders [data-scan="open"]');
  await entry.focus();
  await page.keyboard.press('Enter');
  const overlay = page.locator('#scanOverlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('h3')).toBeFocused();              // the dialog's heading: "Scan Shipment"
  // Typing by hand: focus lands in the first field (the carrier list).
  await overlay.locator('[data-scan="manual"]').focus();
  await page.keyboard.press('Enter');
  await expect(overlay.locator('#scanM_carrier')).toBeFocused();
  await page.keyboard.press('ArrowDown');                         // the carrier list answers the keyboard
  await expect(overlay.locator('#scanM_carrier')).not.toHaveValue('');
  // Back to the first step: focus stays inside the dialog.
  await overlay.locator('[data-scan="back-capture"]').first().focus();
  await page.keyboard.press('Enter');
  expect(await inOverlay(page)).toBe(true);
  // Tab and Shift+Tab never leave the dialog.
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); expect(await inOverlay(page), 'Tab ' + i).toBe(true); }
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Shift+Tab'); expect(await inOverlay(page), 'Shift+Tab ' + i).toBe(true); }
  // ...also with the example labels unfolded (more buttons in the loop).
  await overlay.locator('summary').first().focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); expect(await inOverlay(page), 'open Tab ' + i).toBe(true); }
  // Escape closes it and puts focus back where it was.
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(entry).toBeFocused();
});

test('scan dialog: a fixture scan moves focus to the next step inside the dialog', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'keyboard; run once');
  await enable(page);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.locator('#scanEntryOrders [data-scan="open"]').click();
  const fx = page.locator('#scanOverlay [data-scan="fixture"]').first();
  await fx.focus();
  await page.keyboard.press('Enter');
  expect(await inOverlay(page)).toBe(true);
});

test('sections that redraw keep focus on the pressed button, or on the section when it is gone', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'keyboard; run once');
  await enable(page);
  await login(page);
  const press = async (loc) => { await loc.focus(); await page.keyboard.press('Enter'); };

  await gotoPage(page, 'inventoryPanel');
  const comp = page.locator('#reorderPlanningHost [data-reorder="filter"][data-kind="component"]');
  await press(comp);
  await expect(comp).toBeFocused();
  const draft = page.locator('#reorderPlanningHost [data-reorder="draft"]');
  await press(draft);
  await expect(page.locator('#reorderPlanningHost [data-reorder="draft"]')).toBeFocused();

  const approve = page.locator('#cycleCountHost [data-cyclecount="approve"]');
  await press(approve);
  // "Approve" is replaced by the approved state: focus goes to the section, not the page.
  const cc = await page.evaluate(() => { const a = document.activeElement; const h = document.getElementById('cycleCountHost'); return h === a || h.contains(a); });
  expect(cc).toBe(true);

  await gotoPage(page, 'reportHistoryPanel');
  const rerun = page.locator('#reportVersionsHost [data-reportver="rerun"]');
  await press(rerun);
  const rv = await page.evaluate(() => { const a = document.activeElement; const h = document.getElementById('reportVersionsHost'); return h === a || h.contains(a); });
  expect(rv).toBe(true);
  const ack = page.locator('#opsWatchHost [data-opswatch="ack"]').first();
  await press(ack);
  const ow = await page.evaluate(() => { const a = document.activeElement; const h = document.getElementById('opsWatchHost'); return h === a || h.contains(a); });
  expect(ow).toBe(true);

  await gotoPage(page, 'ordersPanel');
  const sv = page.locator('#savedViewsOrders');
  await sv.getByLabel('Name this view').fill('Keyboard view');
  await press(sv.locator('[data-savedview="save"]'));
  await expect(sv.locator('[data-savedview="save"]')).toBeFocused();
  await press(sv.locator('[data-savedview="delete"][data-name="Keyboard view"]'));
  const svf = await page.evaluate(() => { const a = document.activeElement; const h = document.getElementById('savedViewsOrders'); return h === a || h.contains(a); });
  expect(svf).toBe(true);
});
