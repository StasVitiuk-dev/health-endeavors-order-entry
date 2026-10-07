// Write-path inventory gate (2026-10-06, extension 4, workstream A).
//
// tests/tools/write-paths.js finds every place the pages can change data.
// docs/ops/write-paths.classification.json holds the hand-checked facts for
// each one. This spec fails when:
//   1. a write path is added (or removed) without updating the classification;
//   2. a state change (update / delete of a workflow column) has no stale-tab
//      condition and no written justification;
//   3. an update / delete does not read its rows back (a silent refusal would
//      look like success) and has no written justification;
//   4. a user-triggered write has no double-click lock and no justification;
//   5. a guard the classification recorded has disappeared from the code
//      (the "guards" snapshot must be updated deliberately, i.e. reviewed).
// Regenerate the matrix after a deliberate change:
//   node tests/tools/write-paths.js --md

const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { all } = require('../tools/write-paths');

const ROOT = path.resolve(__dirname, '..', '..');
const CLASSES = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'write-paths.classification.json'), 'utf8'));
const ROWS = all();
const UPDATE_OPS = ['update', 'delete', 'updateIfUnchanged', 'upsert'];
const isUser = r => /^(click|submit|change|input|keydown) /.test(r.context);
const GUARDS = ['staleCondition', 'readBack', 'doubleClickLock', 'confirmation', 'rolePrecheck'];

test.describe('write-path inventory', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'static; run once'); });

  test('the extractor finds the expected kinds of write path', () => {
    expect(ROWS.length).toBeGreaterThan(80);
    for (const op of ['insert', 'update', 'delete', 'updateIfUnchanged', 'upsert', 'rpc', 'storage.remove', 'auth.signOut']) {
      expect(ROWS.some(r => r.op === op), op).toBe(true);
    }
  });

  test('every write path is classified, and every classified path still exists', () => {
    const keys = new Set(ROWS.map(r => r.key));
    const unclassified = ROWS.filter(r => !CLASSES[r.key]).map(r => `${r.key} (line ${r.line})`);
    const gone = Object.keys(CLASSES).filter(k => !keys.has(k));
    expect(unclassified, 'new write paths: classify them in docs/ops/write-paths.classification.json').toEqual([]);
    expect(gone, 'classified paths no longer in the code: remove or rename them').toEqual([]);
  });

  test('state changes carry a stale-tab condition (or a written justification)', () => {
    const bad = ROWS.filter(r => UPDATE_OPS.includes(r.op) && r.writesState && !r.staleCondition && !((CLASSES[r.key] || {}).justify || {}).stale);
    expect(bad.map(r => `${r.key} (line ${r.line})`)).toEqual([]);
  });

  test('updates and deletes read their rows back, so a silent refusal is noticed (or are justified)', () => {
    const bad = ROWS.filter(r => UPDATE_OPS.includes(r.op) && !r.readBack && !((CLASSES[r.key] || {}).justify || {}).readBack);
    expect(bad.map(r => `${r.key} (line ${r.line})`)).toEqual([]);
  });

  test('user-triggered writes lock against a double click (or are justified)', () => {
    const bad = ROWS.filter(r => isUser(r) && !r.doubleClickLock && !((CLASSES[r.key] || {}).justify || {}).lock);
    expect(bad.map(r => `${r.key} (line ${r.line})`)).toEqual([]);
  });

  test('no recorded guard has disappeared from the code', () => {
    const lost = [];
    for (const r of ROWS) {
      const c = CLASSES[r.key];
      if (!c) continue;
      const had = (c.guards || '').split(',').filter(Boolean);
      for (const g of had) if (!r[g]) lost.push(`${r.key}: ${g}`);
    }
    expect(lost, 'a guard was removed: restore it, or update the classification deliberately').toEqual([]);
  });

  test('the generated matrix is up to date with the code', () => {
    const { markdown } = require('../tools/write-paths');
    const current = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'WRITE_PATH_MATRIX.md'), 'utf8');
    expect(current).toBe(markdown(ROWS, CLASSES));
  });

  // EXT7 (workstream C): machine-readable inventory with a retry class per path.
  test('the JSON inventory is up to date, and no write path has an UNRESOLVED retry class', () => {
    const { inventoryJson } = require('../tools/write-paths');
    const want = inventoryJson(ROWS, CLASSES);
    const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'MUTATION_WRITE_PATH_INVENTORY.json'), 'utf8'));
    expect(current).toEqual(want);
    expect(want.items.filter(i => i.retryClass === 'UNRESOLVED').map(i => i.key)).toEqual([]);
  });
});

// Found by the inventory (EXT4): the procedure form had no double-submit lock.
test('Procedures: a double submit while saving adds one procedure, not two', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  backend.tables.sop_documents = [];
  enableWrites(backend, ['sop_documents']);
  backend.delayMs.sop_documents = 600;
  await login(page);
  await gotoPage(page, 'sopsPanel');
  await page.fill('#sopTitle', 'SYNTHETIC procedure');
  await page.fill('#sopContent', 'SYNTHETIC steps');
  const btn = page.locator('#addSopForm button[type="submit"]');
  await btn.click();
  await page.locator('#addSopForm').evaluate(f => f.requestSubmit()); // second submit while the first is saving
  await expect.poll(() => backend.requests.filter(r => r.table === 'sop_documents' && r.method === 'POST').length).toBe(1);
  await expect(btn).toBeEnabled();
  expect(backend.requests.filter(r => r.table === 'sop_documents' && r.method === 'POST')).toHaveLength(1);
});
