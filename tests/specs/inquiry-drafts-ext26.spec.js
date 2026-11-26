// An edited reply to a customer survives the page drawing itself again (Nov 26). The
// Customer Inquiries list is redrawn on Refresh, by the load after sign-in and by the
// refresh every 5 minutes (which only waits while the cursor is in a box): an edit not yet
// saved used to come back as the agent's draft. Every value is made up; the database is the mock.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const ROW = { id: 'iq-1', status: 'needs_review', customer_email: 'synthetic@example.test', question_text: 'SYNTHETIC where is my order',
  ai_draft_reply: 'SYNTHETIC draft from the agent', ai_confidence: 0.8, created_at: '2026-11-25T10:00:00Z', answered_at: null, severity: null, sensitive: false, order_id: null };
async function open(page, backend) {
  backend.tables.customer_inquiries = [Object.assign({}, ROW)];
  await login(page);
  await gotoPage(page, 'inquiriesPanel');
  await page.waitForLoadState('networkidle');
  const ta = page.locator('.inqDraftText[data-id="iq-1"]');
  await expect(ta).toHaveValue('SYNTHETIC draft from the agent');
  return ta;
}
const redrawn = (page) => page.locator('#inquiriesWrap .inqDraftText[data-id="iq-1"]:not([data-test-old])');

test('an unsaved edit of a reply survives Refresh; saving it still writes once', async ({ page, backend }) => {
  const ta = await open(page, backend);
  await ta.fill('SYNTHETIC draft from the agent, checked by the owner');
  await ta.evaluate(el => el.setAttribute('data-test-old', '1'));
  await page.locator('#inqFilter').focus();                                                    // the cursor has left the box
  await page.locator('#refreshBtn').click();
  await expect(redrawn(page)).toHaveCount(1);                                                  // the list was drawn again
  await expect(ta).toHaveValue('SYNTHETIC draft from the agent, checked by the owner');
  await page.locator('.inqSaveBtn[data-id="iq-1"]').click();
  await expect.poll(() => backend.tableWrites().filter(r => r.table === 'customer_inquiries').length).toBe(1);
  expect(backend.tableWrites().filter(r => r.table === 'customer_inquiries')[0].body).toEqual({ ai_draft_reply: 'SYNTHETIC draft from the agent, checked by the owner' });
});

test('the draft changed elsewhere while the edit waited: the save is still refused, nothing is overwritten', async ({ page, backend }) => {
  const ta = await open(page, backend);
  await ta.fill('SYNTHETIC my own wording');
  backend.tables.customer_inquiries[0].ai_draft_reply = 'SYNTHETIC new draft from the agent';
  await ta.evaluate(el => el.setAttribute('data-test-old', '1'));
  await page.locator('#refreshBtn').click();
  await expect(redrawn(page)).toHaveCount(1);
  await expect(ta).toHaveValue('SYNTHETIC my own wording');                                    // kept
  await page.locator('.inqSaveBtn[data-id="iq-1"]').click();
  await expect(page.locator('#dashError')).toContainText('Someone else changed this draft');
  expect(backend.tableWrites().filter(r => r.table === 'customer_inquiries')).toEqual([]);
  expect(backend.tables.customer_inquiries[0].ai_draft_reply).toBe('SYNTHETIC new draft from the agent');
  // "reload to see theirs": Refresh now shows theirs (it used to keep this text with the old
  // guard, so every later save was refused), and an edit of theirs saves
  await page.locator('#refreshBtn').click();
  await expect(ta).toHaveValue('SYNTHETIC new draft from the agent');
  await ta.fill('SYNTHETIC new draft from the agent, combined');
  await page.locator('.inqSaveBtn[data-id="iq-1"]').click();
  await expect.poll(() => backend.tables.customer_inquiries[0].ai_draft_reply).toBe('SYNTHETIC new draft from the agent, combined');
});

test('nothing edited: Refresh shows the newest draft', async ({ page, backend }) => {
  const ta = await open(page, backend);
  backend.tables.customer_inquiries[0].ai_draft_reply = 'SYNTHETIC new draft from the agent';
  await page.locator('#refreshBtn').click();
  await expect(ta).toHaveValue('SYNTHETIC new draft from the agent');
});
