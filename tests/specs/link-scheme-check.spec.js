// Evidence Locker and Documents: saved links must never become clickable if
// they are the kind that runs code (javascript:, data:, vbscript:). Normal
// web, email and Apple Mail/Photos links keep working. The same links are
// refused when someone tries to save them. Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const INCIDENT = { id: 'inc-syn-1', incident_number: 'INC-SYN-1', title: 'SYNTHETIC incident', created_at: '2026-09-20T00:00:00Z' };

function seed(backend) {
  Object.assign(backend.tables, {
    incidents: [INCIDENT],
    evidence_locker: [
      { id: 'ev-safe', incident_id: INCIDENT.id, title: 'SYNTHETIC web link', description: null, evidence_type: 'Document', external_link: 'https://example.test/file', file_path: null, created_at: '2026-09-21T00:00:00Z' },
      { id: 'ev-mail', incident_id: INCIDENT.id, title: 'SYNTHETIC mail link', description: null, evidence_type: 'Email', external_link: 'message://%3Csynthetic@example.test%3E', file_path: null, created_at: '2026-09-21T00:00:01Z' },
      { id: 'ev-bad', incident_id: INCIDENT.id, title: 'SYNTHETIC script link', description: null, evidence_type: 'Other', external_link: ' JavaScript:void(0)', file_path: null, created_at: '2026-09-21T00:00:02Z' },
    ],
    documents: [
      { id: 'doc-safe', title: 'SYNTHETIC contract', category: 'contract', related_type: null, related_id: null, document_url: 'https://example.test/contract', file_path: null, issued_date: null, expiration_date: null, notes: null, created_at: '2026-09-21T00:00:00Z' },
      { id: 'doc-bad', title: 'SYNTHETIC data link', category: 'other', related_type: null, related_id: null, document_url: 'data:text/html,SYNTHETIC', file_path: null, issued_date: null, expiration_date: null, notes: null, created_at: '2026-09-21T00:00:01Z' },
    ],
    suppliers: [], purchase_orders: [],
  });
}

const writes = backend => backend.tableWrites().filter(r => ['evidence_locker', 'documents'].includes(r.table));

test.beforeEach(async ({ page, backend }) => { seed(backend); await login(page); });

test('Evidence Locker: normal links are clickable; a javascript: link is shown as text only', async ({ page }) => {
  await gotoPage(page, 'evidenceLockerPanel');
  const wrap = page.locator('#evidenceWrap');
  await expect(wrap).toContainText('SYNTHETIC script link');
  await expect(wrap.locator('a[href="https://example.test/file"]')).toHaveCount(1);
  await expect(wrap.locator('a[href^="message://"]')).toHaveCount(1);
  await expect(wrap.locator('a[href*="avascript" i]')).toHaveCount(0);
  await expect(wrap).toContainText('not opened — this kind of link can run code');
});

test('Documents: normal links are clickable; a data: link is shown as text only', async ({ page }) => {
  await gotoPage(page, 'documentsPanel');
  const wrap = page.locator('#documentsWrap');
  await expect(wrap).toContainText('SYNTHETIC data link');
  await expect(wrap.locator('a[href="https://example.test/contract"]')).toHaveCount(1);
  await expect(wrap.locator('a[href^="data:"]')).toHaveCount(0);
  await expect(wrap).toContainText('not opened — this kind of link can run code');
});

test('saving evidence with a javascript: link is refused and nothing is sent', async ({ page, backend }) => {
  await gotoPage(page, 'evidenceLockerPanel');
  await page.selectOption('#evidenceIncident', INCIDENT.id);
  await page.fill('#evidenceTitle', 'SYNTHETIC new evidence');
  await page.fill('#evidenceLink', 'javascript:void(0)');
  await page.click('#addEvidenceForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('That link can’t be saved');
  expect(writes(backend)).toEqual([]);
});

test('saving a document with a normal link still works', async ({ page, backend }) => {
  await gotoPage(page, 'documentsPanel');
  await page.fill('#docTitle', 'SYNTHETIC new document');
  await page.selectOption('#docCategory', { index: 1 });
  await page.fill('#docUrl', 'https://example.test/new');
  await page.click('#addDocumentForm button[type=submit]');
  await expect.poll(() => writes(backend).length).toBe(1);
  expect(writes(backend)[0].body.document_url).toBe('https://example.test/new');
});

test('saving a document with a vbscript: link is refused and nothing is sent', async ({ page, backend }) => {
  await gotoPage(page, 'documentsPanel');
  await page.fill('#docTitle', 'SYNTHETIC bad document');
  await page.selectOption('#docCategory', { index: 1 });
  await page.fill('#docUrl', 'VBScript:msgbox(1)');
  await page.click('#addDocumentForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('That link can’t be saved');
  expect(writes(backend)).toEqual([]);
});
