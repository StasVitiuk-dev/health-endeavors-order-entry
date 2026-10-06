// Document / storage safety audit (2026-10-06). Uploads are a file first and
// a database record second; these tests make sure the browser never knowingly
// leaves a stored file that no record points at, and never deletes the file
// of a record that was in fact saved. Real Supabase Storage policies are not
// touched; everything here is the page's own behaviour against the mock.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

const storageReqs = backend => backend.requests.filter(r => r.path && r.path.startsWith('/storage/'));
const uploads = (backend, bucket) => storageReqs(backend).filter(r => r.method === 'POST' && r.path.includes('/object/' + bucket + '/'));
const removals = (backend, bucket) => storageReqs(backend).filter(r => r.method === 'DELETE' && r.path.includes('/object/' + bucket));
const uploadedPath = (r, bucket) => decodeURIComponent(r.path.split('/object/' + bucket + '/')[1]);
const pdf = { name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') };

async function openDocuments(page) {
  await gotoPage(page, 'documentsPanel');
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}
async function fillDocument(page, file = pdf) {
  await page.fill('#docTitle', 'SYNTHETIC certificate');
  await page.selectOption('#docCategory', 'certification');
  if (file) await page.setInputFiles('#docFile', file);
}

test.describe('documents', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.documents = [];
    backend.tables.suppliers = [];
    enableWrites(backend, ['documents']);
    await login(page);
    await openDocuments(page);
  });

  test('connection drops after the record was saved: the file is kept and the document counts as added', async ({ page, backend }) => {
    backend.dropNext('documents', 'POST', { applied: true });
    await fillDocument(page);
    await page.click('#addDocumentForm button[type="submit"]');
    await expect(page.locator('.toast', { hasText: 'Document added' })).toBeVisible();
    expect(backend.tables.documents).toHaveLength(1);
    const path = uploadedPath(uploads(backend, 'document-files')[0], 'document-files');
    expect(backend.tables.documents[0].file_path).toBe(path);
    expect(removals(backend, 'document-files')).toEqual([]); // used to delete the saved document's file
  });

  test('connection drops before the record was saved: the file is removed again', async ({ page, backend }) => {
    backend.dropNext('documents', 'POST', { applied: false });
    await fillDocument(page);
    await page.click('#addDocumentForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('Could not add that document');
    expect(backend.tables.documents).toHaveLength(0);
    const path = uploadedPath(uploads(backend, 'document-files')[0], 'document-files');
    expect(removals(backend, 'document-files')[0].body.prefixes).toEqual([path]);
  });

  test('a file over 50 MB is refused before anything is uploaded', async ({ page, backend }) => {
    await fillDocument(page, null);
    await page.locator('#docFile').evaluate(input => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(51 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' }));
      input.files = dt.files;
    });
    await page.click('#addDocumentForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('the limit is 50 MB');
    expect(storageReqs(backend)).toEqual([]);
    expect(backend.tableWrites().filter(r => r.table === 'documents')).toEqual([]);
  });

  test('a web page / script file is refused before anything is uploaded', async ({ page, backend }) => {
    await fillDocument(page, { name: 'invoice.html', mimeType: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') });
    await page.click('#addDocumentForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('can’t be uploaded');
    expect(storageReqs(backend)).toEqual([]);
  });

  test('a double click uploads and saves once', async ({ page, backend }) => {
    backend.delayMs.documents = 500;
    await fillDocument(page);
    await page.locator('#addDocumentForm button[type="submit"]').dblclick();
    await expect(page.locator('.toast', { hasText: 'Document added' })).toBeVisible();
    expect(uploads(backend, 'document-files')).toHaveLength(1);
    expect(backend.tables.documents).toHaveLength(1);
  });

  test('deleting a document also removes its stored file', async ({ page, backend }) => {
    backend.tables.documents.push({ id: 'doc-1', title: 'SYNTHETIC old', category: 'other', related_type: null, related_id: null, document_url: null,
      file_path: '111_old.pdf', issued_date: null, expiration_date: null, notes: null, created_at: '2026-09-01T00:00:00Z' });
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await openDocuments(page);
    page.once('dialog', d => d.accept());
    await page.locator('#documentsPanel [data-id="doc-1"] .docDeleteBtn').click();
    await page.fill('#reauthPassword', OWNER_USER.password);
    await page.click('#reauthConfirmBtn');
    await expect(page.locator('.toast', { hasText: 'Document deleted' })).toBeVisible();
    expect(backend.tables.documents).toHaveLength(0);
    expect(removals(backend, 'document-files')[0].body.prefixes).toEqual(['111_old.pdf']);
  });
});

test.describe('evidence and receipts', () => {
  test('evidence: a refused record no longer leaves its uploaded file behind', async ({ page, backend }) => {
    backend.tables.incidents = [{ id: 'inc-1', incident_number: 'INC-1', title: 'SYNTHETIC incident', created_at: '2026-09-20T00:00:00Z' }];
    backend.tables.evidence_locker = [];
    enableWrites(backend, ['evidence_locker']);
    backend.failNext('evidence_locker', 'POST', { status: 403, body: { code: '42501', message: 'new row violates row-level security policy' } });
    await login(page);
    await gotoPage(page, 'evidenceLockerPanel');
    await page.fill('#evidenceTitle', 'SYNTHETIC photo');
    await page.selectOption('#evidenceIncident', 'inc-1');
    await page.setInputFiles('#evidenceFile', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('synthetic') });
    await page.click('#addEvidenceForm button[type=submit]');
    await expect(page.locator('#dashError')).toContainText('Could not add that evidence');
    const path = uploadedPath(uploads(backend, 'evidence-files')[0], 'evidence-files');
    expect(removals(backend, 'evidence-files')[0].body.prefixes).toEqual([path]);
  });

  test('expense with receipt: a refused expense no longer leaves the receipt file behind', async ({ page, backend }) => {
    backend.tables.expenses = [];
    enableWrites(backend, ['expenses']);
    backend.failNext('expenses', 'POST', { status: 400, body: { code: '23514', message: 'violates check constraint' } });
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await page.selectOption('#expCategory', 'packaging');
    await page.fill('#expAmount', '12.5');
    await page.setInputFiles('#expReceipt', { name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF synthetic') });
    await page.click('#addExpenseForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('Could not save that expense');
    const path = uploadedPath(uploads(backend, 'expense-receipts')[0], 'expense-receipts');
    expect(removals(backend, 'expense-receipts')[0].body.prefixes).toEqual([path]);
  });

  test('expense without receipt: a dropped connection says "may or may not have been saved", not "try again"', async ({ page, backend }) => {
    backend.tables.expenses = [];
    enableWrites(backend, ['expenses']);
    backend.dropNext('expenses', 'POST', { applied: true });
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await page.selectOption('#expCategory', 'packaging');
    await page.fill('#expAmount', '12.5');
    await page.click('#addExpenseForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('may or may not have been saved');
  });
});

test('a raw "row-level security" refusal is explained in plain words', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'message text; run once');
  backend.tables.incidents = [{ id: 'inc-1', incident_number: 'INC-1', title: 'SYNTHETIC incident', created_at: '2026-09-20T00:00:00Z' }];
  backend.tables.evidence_locker = [];
  enableWrites(backend, ['evidence_locker']);
  backend.failNext('evidence_locker', 'POST', { status: 403, body: { code: '42501', message: 'new row violates row-level security policy for table "evidence_locker"' } });
  await login(page);
  await gotoPage(page, 'evidenceLockerPanel');
  await page.fill('#evidenceTitle', 'SYNTHETIC note');
  await page.selectOption('#evidenceIncident', 'inc-1');
  await page.click('#addEvidenceForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('row-level security');
  await expect(page.locator('#dashError')).toContainText('only the Owner or an Administrator can do it');
});
