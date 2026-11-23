// EXT20 forensic probe for INT-8 (not part of npm test). The original test
// (storage-safety.spec.js "two uploads of the same file name") starts the
// second upload as soon as the first FILE request is seen, while the first save
// is still finishing (database insert, form reset, button re-enabled). This
// probe widens that window on purpose by delaying the first documents insert,
// to show whether the second click is lost.
// Run: npx playwright test -c tests/forensics/probe.config.js upload-int8 --project=desktop
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

const pdf = { name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') };
const uploads = backend => backend.requests.filter(r => r.method === 'POST' && r.path && r.path.includes('/object/document-files/'));

for (const ms of [0, 300, 1500]) {
  test(`INT-8: first insert delayed ${ms} ms, second upload started right after the first file request`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'once');
    backend.tables.documents = []; backend.tables.suppliers = [];
    enableWrites(backend, ['documents']);
    if (ms) backend.delayNext('documents', 'POST', ms);
    await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
    await login(page);
    await gotoPage(page, 'documentsPanel');
    await page.waitForLoadState('networkidle');
    const log = [];
    for (let i = 0; i < 2; i++) {
      await page.fill('#docTitle', 'SYNTHETIC certificate');
      await page.selectOption('#docCategory', 'certification');
      await page.setInputFiles('#docFile', pdf);
      const state = await page.evaluate(() => ({ disabled: document.querySelector('#addDocumentForm button[type="submit"]').disabled }));
      log.push('before click ' + (i + 1) + ': button ' + (state.disabled ? 'DISABLED' : 'enabled'));
      await page.click('#addDocumentForm button[type="submit"]', { force: true });
      await expect.poll(() => uploads(backend).length, { timeout: 4000 }).toBe(i + 1).catch(() => log.push('upload ' + (i + 1) + ' NOT seen within 4 s'));
    }
    await page.waitForTimeout(ms + 500);
    const after = await page.evaluate(() => ({ title: document.getElementById('docTitle').value, err: (document.getElementById('dashError') || {}).textContent || '' }));
    console.log(`INT8 delay=${ms}: uploads=${uploads(backend).length} docs=${backend.tables.documents.length} | ${log.join(' | ')} | form title after="${after.title}" | error="${after.err.trim().slice(0, 80)}"`);
  });
}
