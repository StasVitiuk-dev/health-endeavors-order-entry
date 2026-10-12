// EXT14: redaction fuzzing of the diagnostic summary (System status → Copy).
// Every free-text source that can reach the summary is filled with planted
// secrets (e-mail, signed token, secret key, database URL with a password,
// project address, customer name, HTML), chosen by a seeded random generator,
// and the summary must never contain any of them. Sources: the database error
// on the System status read, an error shown on screen, agent error text,
// switch labels, and the signed-in role.
// The planted strings are assembled from pieces so the repository's own
// secret checks do not trip on this file.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const J = (...p) => p.join('');
const PLANTS = [
  J('leak.person', '@', 'customer-mail.example.test'),
  J('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', '.', 'c2lnbmF0dXJlLWZvci1mdXp6'),
  J('sb_', 'secret_', 'FuzzSecretValue1234567890'),
  J('postgres://admin:', 'pw-fuzz-9911', '@', 'db.leak.example.test:5432/prod'),
  J('fuzzprojectref0000aa', '.supabase', '.co'),
  'SYNTHETIC Fuzz Customer Name',
  '<img src=x onerror=alert(1)>',
  J('sk_', 'live_', 'FuzzLiveKey12345678'),
];
// what must never appear (the distinctive part of each plant)
const NEEDLES = ['leak.person', 'c2lnbmF0dXJlLWZvci1mdXp6', 'FuzzSecretValue', 'pw-fuzz-9911', 'fuzzprojectref', 'Fuzz Customer', 'onerror', 'FuzzLiveKey'];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const mix = r => Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(r, PLANTS)).join(pick(r, [' ', ': ', ' | ', '\n']));

for (const seed of [1401, 1402, 1403, 1404, 1405, 1406]) {
  test(`seed ${seed}: no planted secret reaches the diagnostic summary`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'one run is enough; the summary is not layout-dependent');
    const r = rng(seed);
    const P = { dbError: mix(r), screenError: mix(r), agentError: mix(r), flagLabel: mix(r), role: r() < 0.5 ? 'owner' : 'owner ' + mix(r) };
    backend.tables.agent_controls = [1, 4, 5, 6].map(n => ({ agent_num: n, enabled: true, updated_by: null, updated_at: null, last_run_status: 'failed', last_error: P.agentError, last_run_at: '2026-10-11T00:00:00Z' }));
    backend.tables.feature_flags = (backend.tables.feature_flags || []).concat([{ id: 'ff-fuzz', flag_key: 'request_keys', label: P.flagLabel, description: P.flagLabel, enabled: true }]);
    const prof = (backend.tables.profiles || []).find(p => p.role === 'owner');
    if (prof) prof.role = P.role;
    await login(page);
    // an error on screen whose text carries planted secrets
    await page.context().route(/\/rest\/v1\/manual_attention_items/, rt => rt.request().method() === 'POST'
      ? rt.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: P.screenError, details: P.screenError, hint: null }) }) : rt.fallback());
    await page.fill('#reminderTitle', 'SYNTHETIC reminder');
    await page.click('#addReminderForm button[type=submit]');
    await expect(page.locator('#dashError')).toBeVisible();
    // the System status database read fails with planted text
    await page.context().route(/\/rest\/v1\/feature_flags\?select=flag_key&limit=1/, rt =>
      rt.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: P.dbError, details: P.dbError, hint: P.dbError }) }));
    await gotoPage(page, 'continuityPanel');
    await page.click('#copyDiagBtn');
    await expect(page.locator('#diagText')).toContainText('diagnostic summary', { timeout: 30000 });
    const text = await page.locator('#diagText').textContent();
    for (const n of NEEDLES) expect(text, `${n} leaked (seed ${seed})`).not.toContain(n);
    expect(text).not.toMatch(/@[a-z0-9-]+\./i);
    expect(text).toMatch(/Database: Could not read: /); // the planted error really was hit
    expect(text).toMatch(/Last error on screen: (other|permission|connection|conflict|switch)/);
  });
}
