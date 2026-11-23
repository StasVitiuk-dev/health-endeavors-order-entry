// EXT10 (U42): request keys on every remaining create form, plus the key's
// lifecycle (who, what, how long) and the concurrency cases: the same button
// twice, a lost reply then a retry, two tabs, the same content with a new key,
// different content with the same key, another person, an old key, rapid
// repeats. Switch off = nothing sent (today's behaviour). Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { keysOn, uniqueKeys, UUID4 } = require('../helpers/request-keys');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'form logic; run once'); });

const FORMS = [
  { name: 'reminder (Home)', table: 'manual_attention_items', panel: 'attentionPanel', form: '#addReminderForm', fill: async p => { await p.fill('#reminderTitle', 'SYNTHETIC reminder'); } },
  { name: 'feature request', table: 'feature_requests', panel: 'featureRequestsPanel', form: '#addFeatureRequestForm', fill: async p => { await p.fill('#frTitle', 'SYNTHETIC request'); } },
  { name: 'procedure (SOP)', table: 'sop_documents', panel: 'sopsPanel', form: '#addSopForm', fill: async p => { await p.fill('#sopTitle', 'SYNTHETIC SOP'); await p.fill('#sopContent', 'SYNTHETIC steps'); } },
  { name: 'legal hold', table: 'legal_holds', panel: 'legalHoldsPanel', form: '#addLegalHoldForm', fill: async p => { await p.fill('#lhTitle', 'SYNTHETIC hold'); } },
  { name: 'adverse event', table: 'adverse_event_reports', panel: 'adverseEventsPanel', form: '#addAdverseEventForm', fill: async p => { await p.fill('#aeProduct', 'SYNTHETIC lotion'); await p.fill('#aeDescription', 'SYNTHETIC rash'); } },
  { name: 'quality check', table: 'quality_checks', panel: 'qualityControlPanel', form: '#addQcForm', fill: async p => { await p.selectOption('#qcType', { index: 1 }); await p.fill('#qcDescription', 'SYNTHETIC dent'); } },
  { name: 'personal event (administrator)', table: 'personal_calendar_events', panel: 'calendarPanel', form: '#addPersonalEventForm', setup: b => { b.tables.profiles[0].role = 'administrator'; b.tables.personal_calendar_events = []; }, fill: async p => { await p.fill('#personalEventTitle', 'SYNTHETIC event'); await p.fill('#personalEventStart', '2026-10-20T10:00'); } },
  { name: 'document (no file)', table: 'documents', panel: 'documentsPanel', form: '#addDocumentForm', fill: async p => { await p.fill('#docTitle', 'SYNTHETIC doc'); await p.selectOption('#docCategory', { index: 1 }); } },
];
const posts = (shared, table) => shared.sent.filter(s => s.table === table);
const rowsOf = (backend, t) => (backend.tables[t] || []).length;

for (const f of FORMS) {
  test(`${f.name}: switch on, lost reply, press again → one record, "already saved"`, async ({ page, backend }) => {
    enableWrites(backend, [f.table]);
    backend.tables[f.table] = backend.tables[f.table] || [];
    if (f.setup) f.setup(backend);
    const before = rowsOf(backend, f.table);
    keysOn(backend);
    const shared = await uniqueKeys(page.context(), [f.table], undefined, backend);
    await login(page);
    await gotoPage(page, f.panel);
    backend.dropNext(f.table, 'POST', { applied: true });
    await f.fill(page);
    await page.click(f.form + ' button[type=submit]');
    await expect(page.locator('#dashError')).toContainText('Pressing the button again is safe');
    await page.click(f.form + ' button[type=submit]');
    await expect(page.locator('.toast', { hasText: 'was already saved by an earlier attempt' })).toHaveCount(1);
    expect(rowsOf(backend, f.table)).toBe(before + 1);
    const [a, b] = posts(shared, f.table).map(s => s.key);
    expect(a).toMatch(UUID4);
    expect(b).toBe(a);
  });

  test(`${f.name}: switch off → no key, lost reply says check the list first`, async ({ page, backend }) => {
    enableWrites(backend, [f.table]);
    backend.tables[f.table] = backend.tables[f.table] || [];
    if (f.setup) f.setup(backend);
    const shared = await uniqueKeys(page.context(), [f.table], undefined, backend);
    await login(page);
    await gotoPage(page, f.panel);
    backend.dropNext(f.table, 'POST', { applied: true });
    await f.fill(page);
    await page.click(f.form + ' button[type=submit]');
    await expect(page.locator('#dashError')).toContainText('Check the list before adding it again');
    expect(posts(shared, f.table)[0].body).not.toHaveProperty('client_request_id');
  });
}

test('feature request: the Add button works again after the first add (X10-01)', async ({ page, backend }) => {
  enableWrites(backend, ['feature_requests']);
  await login(page);
  await gotoPage(page, 'featureRequestsPanel');
  await page.fill('#frTitle', 'SYNTHETIC one');
  await page.click('#addFeatureRequestForm button[type=submit]');
  await expect(page.locator('#frTitle')).toHaveValue('');
  await expect(page.locator('#addFeatureRequestForm button[type=submit]')).toBeEnabled();
  await page.fill('#frTitle', 'SYNTHETIC two');
  await page.click('#addFeatureRequestForm button[type=submit]');
  await expect.poll(() => backend.tables.feature_requests.filter(r => /SYNTHETIC (one|two)/.test(r.title)).length).toBe(2);
});

test('evidence without a file: saved, said saved, form cleared (X10-02)', async ({ page, backend, pageErrors }) => {
  enableWrites(backend, ['evidence_locker']);
  backend.tables.evidence_locker = backend.tables.evidence_locker || [];
  backend.tables.incidents = [{ id: 'inc-1', incident_number: 'INC-1', title: 'SYNTHETIC incident', created_at: '2026-09-20T00:00:00Z' }];
  await login(page);
  await gotoPage(page, 'evidenceLockerPanel');
  await page.selectOption('#evidenceIncident', 'inc-1');
  await page.fill('#evidenceTitle', 'SYNTHETIC photo note');
  await page.click('#addEvidenceForm button[type=submit]');
  await expect(page.locator('#evidenceTitle')).toHaveValue('');
  await expect(page.locator('#dashError')).toBeHidden();
  expect(backend.tables.evidence_locker.filter(r => r.title === 'SYNTHETIC photo note')).toHaveLength(1);
  expect(pageErrors.filter(e => /isLatest/.test(e))).toEqual([]);
});

test('evidence without a file: lost reply + retry with keys on → one record', async ({ page, backend }) => {
  enableWrites(backend, ['evidence_locker']);
  backend.tables.evidence_locker = backend.tables.evidence_locker || [];
  backend.tables.incidents = [{ id: 'inc-1', incident_number: 'INC-1', title: 'SYNTHETIC incident', created_at: '2026-09-20T00:00:00Z' }];
  keysOn(backend);
  await uniqueKeys(page.context(), ['evidence_locker'], undefined, backend);
  await login(page);
  await gotoPage(page, 'evidenceLockerPanel');
  backend.dropNext('evidence_locker', 'POST', { applied: true });
  await page.selectOption('#evidenceIncident', 'inc-1');
  await page.fill('#evidenceTitle', 'SYNTHETIC repeat');
  await page.click('#addEvidenceForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('Pressing the button again is safe');
  await page.click('#addEvidenceForm button[type=submit]');
  await expect(page.locator('.toast', { hasText: 'already saved' })).toHaveCount(1);
  expect(backend.tables.evidence_locker.filter(r => r.title === 'SYNTHETIC repeat')).toHaveLength(1);
});

// ---- Lifecycle and concurrency cases (on the reminder form) ----
async function reminderSetup(page, backend) {
  enableWrites(backend, ['manual_attention_items']);
  backend.tables.manual_attention_items = backend.tables.manual_attention_items || [];
  keysOn(backend);
  const shared = await uniqueKeys(page.context(), ['manual_attention_items'], undefined, backend);
  await login(page);
  return shared;
}
const reminders = (backend, title) => backend.tables.manual_attention_items.filter(r => r.title === title).length;

test('same button twice quickly → one request, one record', async ({ page, backend }) => {
  const shared = await reminderSetup(page, backend);
  await page.fill('#reminderTitle', 'SYNTHETIC double');
  await page.locator('#addReminderForm button[type=submit]').dblclick();
  await page.locator('#reminderTitle').press('Enter').catch(() => {});
  await expect.poll(() => reminders(backend, 'SYNTHETIC double')).toBe(1);
  await page.waitForTimeout(400);
  expect(posts(shared, 'manual_attention_items').filter(s => s.body.title === 'SYNTHETIC double')).toHaveLength(1);
});

test('rapid repeats after a lost reply (5 presses) → still one record', async ({ page, backend }) => {
  const shared = await reminderSetup(page, backend);
  backend.dropNext('manual_attention_items', 'POST', { applied: true });
  await page.fill('#reminderTitle', 'SYNTHETIC rapid');
  for (let i = 0; i < 5; i++) {
    await page.click('#addReminderForm button[type=submit]');
    await page.waitForTimeout(150);
    if (!(await page.locator('#reminderTitle').inputValue())) break;
  }
  await page.waitForTimeout(400);
  expect(reminders(backend, 'SYNTHETIC rapid')).toBe(1);
  const keys = new Set(posts(shared, 'manual_attention_items').map(s => s.key));
  expect(keys.size).toBe(1);
});

test('timeout (reply lost, NOT saved) then retry → saved once with the same key', async ({ page, backend }) => {
  const shared = await reminderSetup(page, backend);
  backend.dropNext('manual_attention_items', 'POST', { applied: false });
  await page.fill('#reminderTitle', 'SYNTHETIC timeout');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('Pressing the button again is safe');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#reminderTitle')).toHaveValue('');
  expect(reminders(backend, 'SYNTHETIC timeout')).toBe(1);
  const [a, b] = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(b).toBe(a);
  await expect(page.locator('.toast', { hasText: 'already saved' })).toHaveCount(0);
});

test('after a success, the same content again is a NEW entry (new key)', async ({ page, backend }) => {
  const shared = await reminderSetup(page, backend);
  for (let i = 0; i < 2; i++) {
    await page.fill('#reminderTitle', 'SYNTHETIC same text');
    await page.click('#addReminderForm button[type=submit]');
    await expect(page.locator('#reminderTitle')).toHaveValue('');
  }
  expect(reminders(backend, 'SYNTHETIC same text')).toBe(2);
  const [a, b] = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(a).not.toBe(b);
});

test('different content right after a lost reply → same key, refused and told (no silent duplicate)', async ({ page, backend }) => {
  const shared = await reminderSetup(page, backend);
  backend.dropNext('manual_attention_items', 'POST', { applied: true });
  await page.fill('#reminderTitle', 'SYNTHETIC first');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  await page.fill('#reminderTitle', 'SYNTHETIC edited');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('.toast', { hasText: 'those changes were not saved' })).toHaveCount(1);
  const [a, b] = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(b).toBe(a);
  expect(reminders(backend, 'SYNTHETIC edited')).toBe(0);
});

test('different content more than 10 minutes after a lost reply → treated as a new entry (stale key dropped)', async ({ page, backend }) => {
  await page.clock.install();
  const shared = await reminderSetup(page, backend);
  backend.dropNext('manual_attention_items', 'POST', { applied: true });
  await page.fill('#reminderTitle', 'SYNTHETIC morning');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  await page.clock.fastForward('11:00');
  await page.fill('#reminderTitle', 'SYNTHETIC afternoon');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#reminderTitle')).toHaveValue('');
  const [a, b] = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(b).not.toBe(a);
  expect(reminders(backend, 'SYNTHETIC afternoon')).toBe(1);
});

test('the same content even hours later keeps the key (a real retry is never duplicated)', async ({ page, backend }) => {
  await page.clock.install();
  const shared = await reminderSetup(page, backend);
  backend.dropNext('manual_attention_items', 'POST', { applied: true });
  await page.fill('#reminderTitle', 'SYNTHETIC patient');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  await page.clock.fastForward('03:00:00');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('.toast', { hasText: 'already saved' })).toHaveCount(1);
  expect(reminders(backend, 'SYNTHETIC patient')).toBe(1);
  const [a, b] = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(b).toBe(a);
});

test('two tabs typing the same reminder → two keys, two records (two real entries, not a retry)', async ({ page, backend, context }) => {
  const shared = await reminderSetup(page, backend);
  const page2 = await context.newPage();
  await page2.goto('/owner-login.html');
  await expect(page2.locator('#dash')).toBeVisible();
  for (const p of [page, page2]) { await p.fill('#reminderTitle', 'SYNTHETIC tabs'); }
  await Promise.all([page.click('#addReminderForm button[type=submit]'), page2.click('#addReminderForm button[type=submit]')]);
  await expect.poll(() => reminders(backend, 'SYNTHETIC tabs')).toBe(2);
  const keys = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(new Set(keys).size).toBe(2);
});

test('another person signs in on the same tab → the old key is not reused', async ({ page, backend }) => {
  const shared = await reminderSetup(page, backend);
  backend.dropNext('manual_attention_items', 'POST', { applied: false });
  await page.fill('#reminderTitle', 'SYNTHETIC handover');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  const before = await page.evaluate(() => document.getElementById('addReminderForm').dataset.requestKeyUser);
  await page.evaluate(() => { document.getElementById('addReminderForm').dataset.requestKeyUser = 'someone-else'; });
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#reminderTitle')).toHaveValue('');
  const [a, b] = posts(shared, 'manual_attention_items').map(s => s.key);
  expect(before).toBeTruthy();
  expect(b).not.toBe(a);
});

test('escalate to incident twice (lost reply, then again) → one incident, linked', async ({ page, backend }) => {
  enableWrites(backend, ['incidents', 'quality_checks']);
  keysOn(backend);
  const shared = await uniqueKeys(page.context(), ['incidents'], undefined, backend);
  backend.tables.quality_checks = [{ id: 'qc-esc', check_type: 'packaging_defect', result: 'fail', severity: 'high', product_id: null, lot_id: null, description: 'SYNTHETIC crushed box', incident_id: null, created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }];
  const before = (backend.tables.incidents || []).length;
  await login(page);
  await gotoPage(page, 'qualityControlPanel');
  backend.dropNext('incidents', 'POST', { applied: true });
  const btn = page.locator('[data-id="qc-esc"] .qcEscalateBtn');
  await btn.click();
  await expect(page.locator('#dashError')).toBeVisible();
  await page.locator('[data-id="qc-esc"] .qcEscalateBtn').click();
  await expect.poll(() => backend.tables.quality_checks[0].incident_id).toBeTruthy();
  expect(backend.tables.incidents.length).toBe(before + 1);
  const keys = posts(shared, 'incidents').map(s => s.key);
  expect(keys[0]).toBe(keys[1]);
  expect(backend.tables.quality_checks[0].incident_id).toBe(backend.tables.incidents[backend.tables.incidents.length - 1].id);
});
