// EXT10 (U43): the nightly integrity check (Query F run by the database,
// drafts/25 + 29) on Home, with honest states and freshness. Off / not
// installed = NOT VERIFIED, never "fine". Synthetic data only; the database
// tables are imitated by the mock.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'page logic; run once'); });

const H = 3600000;
const iso = ms => new Date(Date.now() - ms).toISOString();
const SECTIONS = [
  ['F01 stuck work', 'tasks "in progress" with no change for 14+ days'], ['F02 stuck work', 'open tasks more than 7 days past due'],
  ['F03 stuck work', 'approval requests pending for 7+ days'], ['F04 stuck work', 'recalls still "initiated" after 14+ days'],
  ['F05 stuck work', 'purchase orders not received'], ['F06 probable duplicate', 'order numbers used twice'],
  ['F07 probable duplicate', 'suppliers with the same name'], ['F08 probable duplicate', 'products with the same name'],
  ['F09 probable duplicate', 'expenses that look the same'], ['F10 points at the wrong thing', 'returns on another order\'s line'],
  ['F11 points at the wrong thing', 'order lines whose SKU matches no product'], ['F12 impossible value', 'order totals missing or below zero'],
  ['F13 impossible value', 'order totals that do not add up'], ['F14 impossible value', 'stock buckets below zero'],
  ['F15 impossible value', 'refund dates that do not match'],
];
function seed(backend, { on = true, runs = [], found = {} } = {}) {
  backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => f.flag_key !== 'integrity_results_home')
    .concat(on === null ? [] : [{ id: 'ff-ih', flag_key: 'integrity_results_home', label: 'Nightly integrity check on Home', description: 'SYNTHETIC', enabled: on }]);
  backend.tables.integrity_check_runs = runs.map((r, i) => ({ id: 100 + i, started_at: iso(r.ago), finished_at: r.status === 'running' ? null : iso(r.ago - 60000), status: r.status, checks: r.status === 'ok' ? 15 : null, error: r.error || null }));
  backend.tables.integrity_check_results = runs.flatMap((r, i) => r.status !== 'ok' ? [] : SECTIONS.map(([section, check_name]) => ({
    id: (100 + i) * 100 + Number(section.slice(1, 3)), run_id: 100 + i, run_at: iso(r.ago), section, check_name,
    found: (found[100 + i] || {})[section.slice(0, 3)] || 0, examples: (found[100 + i] || {})[section.slice(0, 3) + 'ex'] || null })));
}
const card = page => page.locator('#nightlyCheckWrap .nightlyCard');
const reads = (backend, t) => backend.requests.filter(r => r.table === t && r.method === 'GET');

test('default (no switch row): NOT VERIFIED, "not set up", and the check tables are never asked', async ({ page, backend }) => {
  seed(backend, { on: null });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'NOT VERIFIED');
  await expect(card(page)).toContainText('Not set up yet');
  await expect(card(page)).toContainText('nothing here means "fine"');
  expect(reads(backend, 'integrity_check_runs')).toEqual([]);
});

test('switch off: same NOT VERIFIED card', async ({ page, backend }) => {
  seed(backend, { on: false, runs: [{ ago: H, status: 'ok' }] });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'NOT VERIFIED');
  expect(reads(backend, 'integrity_check_runs')).toEqual([]);
});

test('switch on but the tables are missing: NOT VERIFIED with what to do', async ({ page, backend }) => {
  seed(backend, { on: true });
  await page.context().route(/\/rest\/v1\/integrity_check_runs/, r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.integrity_check_runs' in the schema cache" }) }));
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'NOT VERIFIED');
  await expect(card(page)).toContainText('not installed');
});

test('installed, never ran: NOT VERIFIED "has not run yet"', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [] });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'NOT VERIFIED');
  await expect(card(page)).toContainText('has not run yet');
});

test('a fresh run with nothing found: PASS, with last success / last attempt / threshold', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: 3 * H, status: 'ok' }] });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'PASS');
  await expect(card(page)).toContainText('All 15 checks passed');
  await expect(card(page).locator('.nightlyFresh')).toContainText('Last success:');
  await expect(card(page).locator('.nightlyFresh')).toContainText('Last attempt:');
  await expect(card(page).locator('.nightlyFresh')).toContainText('worked');
  await expect(card(page).locator('.nightlyFresh')).toContainText('after 26 hours');
  await expect(card(page).locator('details.nightlyDetails')).not.toHaveAttribute('open', '');
});

test('stuck work found: WARN, the list opens and Open goes to the page', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: 2 * H, status: 'ok' }], found: { 100: { F02: 3, F02ex: 'a1b2c3d4, e5f6a7b8' } } });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'WARN');
  const item = card(page).locator('.nightlyItem[data-section="F02"]');
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute('data-level', 'WARN');
  await expect(item).toContainText('For example: a1b2c3d4');
  await item.locator('.nightlyOpen').click();
  await expect(page.locator('#tasksPanel')).toBeVisible();
});

test('an impossible value found: FAIL beats warnings', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: 2 * H, status: 'ok' }], found: { 100: { F01: 1, F14: 2 } } });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'FAIL');
  await expect(card(page)).toContainText('1 check found data that cannot be right');
  await expect(card(page).locator('.nightlyItem[data-section="F14"]')).toHaveAttribute('data-level', 'FAIL');
});

test('last attempt failed: FAIL with its error, results from the last run that worked', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: 2 * H, status: 'failed', error: 'canceling statement due to statement timeout' }, { ago: 26 * H, status: 'ok' }] });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'FAIL');
  await expect(card(page)).toContainText("Last night's run FAILED");
  await expect(card(page)).toContainText('statement timeout');
  await expect(card(page)).toContainText('from the last run that worked');
  await expect(card(page).locator('.nightlyFresh')).toContainText('FAILED');
});

test('last success older than 26 hours: STALE, even if it found nothing', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: 30 * H, status: 'ok' }] });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'STALE');
  await expect(card(page)).toContainText('Out of date');
});

test('cannot read (server error): UNKNOWN, never PASS', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: H, status: 'ok' }] });
  await page.context().route(/\/rest\/v1\/integrity_check_runs/, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'SYNTHETIC upstream error' }) }));
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'UNKNOWN');
});

test('switch unreadable: UNKNOWN', async ({ page, backend }) => {
  seed(backend, { on: true, runs: [{ ago: H, status: 'ok' }] });
  await page.context().route(/\/rest\/v1\/feature_flags\?.*integrity_results_home/, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'SYNTHETIC' }) }));
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'UNKNOWN');
});

test('a staff account sees "owner and administrators only", not "has not run yet"', async ({ page, backend }) => {
  backend.tables.profiles[0].role = 'employee';
  seed(backend, { on: true, runs: [] });
  await login(page);
  await expect(card(page)).toContainText('Only the owner and administrators');
});

test('examples are shown as text (no HTML from the database)', async ({ page, backend, pageErrors }) => {
  seed(backend, { on: true, runs: [{ ago: H, status: 'ok' }], found: { 100: { F07: 1, F07ex: '<img src=x onerror="window.__pwned=1">' } } });
  await login(page);
  await expect(card(page).locator('.nightlyItem[data-section="F07"]')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('90 nights of saved results: only the latest run is fetched, small and bounded', async ({ page, backend }) => {
  const runs = Array.from({ length: 90 }, (_, i) => ({ ago: (i * 24 + 2) * H, status: 'ok' }));
  seed(backend, { on: true, runs });
  await login(page);
  await expect(card(page)).toHaveAttribute('data-state', 'PASS');
  const res = reads(backend, 'integrity_check_results');
  expect(res).toHaveLength(1);
  expect(Object.fromEntries(res[0].params)).toMatchObject({ run_id: 'eq.100', limit: '200' });
  for (const r of reads(backend, 'integrity_check_runs')) expect(Object.fromEntries(r.params)).toMatchObject({ limit: '1' });
});

test('turning the Home switch on is refused while the tables are missing (no password asked)', async ({ page, backend }) => {
  seed(backend, { on: false });
  await page.context().route(/\/rest\/v1\/integrity_check_runs/, r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.integrity_check_runs'" }) }));
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await page.locator('.flagRow[data-key="integrity_results_home"] .slider').click();
  await expect(page.locator('#dashError')).toContainText('drafts/25 and drafts/29) is not installed yet');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  expect(backend.tableWrites().filter(w => w.table === 'feature_flags')).toEqual([]);
});

test('turning the Home switch on when installed: asks for the password like any switch', async ({ page, backend }) => {
  seed(backend, { on: false, runs: [] });
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await page.locator('.flagRow[data-key="integrity_results_home"] .slider').click();
  await expect(page.locator('#reauthOverlay')).toBeVisible();
});
