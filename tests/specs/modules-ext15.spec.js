// EXT15: the owner dashboard's modules (assets/app/*.js) and their registry.
//   * the graph is sound (created once each, dependency order, no cycles, no
//     hidden dependencies) and the moves were byte-identical except the edits
//     named in ENGINEERING_REPORT_EXT15.md;
//   * a missing, stale or broken module stops the start-up with a plain
//     message: no dashboard, no data, nothing written;
//   * the diagnostic summary names the program and every module version.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const ROOT = path.join(__dirname, '..', '..');
const MODULES = require('../helpers/page-source').OWNER_MODULES;
const nodeOnly = ti => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');

// Deliberate edits after the byte-identical move (each explained in the report).
const CHANGED = [
  // EXT18: lookups keyed by database/customer text use prototype-free objects ("__proto__", "constructor" are ordinary keys):
  'loadActivityDigest', 'PO_LOTS', 'loadPurchaseOrders', 'calNotes', 'loadCalendarMonth', 'agentControlsByNum', 'cronJobStatusByName', 'loadAgentControls',
  'INQUIRY_ORDER_BY_ID', 'loadInquiries', 'loadEvidenceLocker', 'loadDocuments', 'loadAccounting', 'loadTaxRecords',
  // EXT18: changes still waiting for a reply are counted, so a sign-out elsewhere is reported honestly:
  'capAwareFetch', 'writesWaiting', 'writesInFlight',
  // EXT19: sidebar and loading skeletons built as elements (safe builder h), not HTML strings:
  'pageLinkHtml', 'pageLinkNode', 'skeletonRows', 'skeletonNodes', 'paintSkeletons', 'h', 'pageIconNode', 'SVG_NS', 'ICON_TAGS',
  // EXT19: whole-program type gate removed dead names (an inspector variable written but never read):
  'INSPECTOR_ROW', 'openInspector',
  'assetVersions', 'loadAttentionChecks', 'loadSystemStatus', 'loadBusinessHealth', 'getPageBadgeCount', 'searchEverything', 'ACCOUNTING_REFUND_POLICY',
  // inline-style removal edits that are not the mechanical conversion (dynamic colours, computed display, malformed switch):
  'renderSidebar', 'renderActivity', 'agentTruth', 'agentJobHealthHtml', 'loadSystemMode', 'loadInventory',
  // bug fix: a failed month-spend read showed $0.00 spent and the full cap remaining
  'loadAI',
  // EXT16: purchase-order receiving reports to the explicit operation state (he-ops)
  'PO_RECEIPT_UNKNOWN', 'renderPoDetails', 'wirePoDetail',
  // EXT17: a lost reply on a stock write records what was attempted (for the adjustment read-back)
  'changeStock',
  // EXT17: sidebar sections and pinned pages live in memory; storage is best-effort and validated
  'openGroups', 'setGroupOpen', 'getPinnedPages', 'setPinnedPages',
  // EXT20: fixed-text HTML strings (empty states, "Loading…", clearing a box, placeholder options, toasts) built as elements:
  'loadActivity', 'loadActivityPeople', 'loadAdverseEvents', 'loadBusinessRules', 'loadContinuity', 'loadDeletedExpenses', 'loadDeletedFeatureRequests',
  'loadExpenses', 'loadFeatureRequests', 'loadInventoryAdjustments', 'loadLegalHolds', 'loadOrders', 'loadQualityChecks', 'loadRecalls',
  'loadReleasedLegalHolds', 'loadReturns', 'loadSessions', 'loadSops', 'loadSuppliers', 'openInspectorFor', 'renderAttention', 'renderCalFilters',
  'renderInspector', 'renderPalette', 'renderReportHistoryView', 'toast',
  // EXT20J Trusted Types screen cascade: each screen's dynamic rendering built as
  // DOM nodes (safe builder h) instead of HTML strings. Renames are listed under
  // both the old and new name (the old statement is removed, the new one added):
  'loadApprovals', 'renderAgentRegistry', 'agentJobHealthHtml', 'agentJobHealthNode',
  'loadNightlyCheck', 'renderAttentionChecks', 'attnFreshnessHtml', 'attnFreshnessNodes',
  'renderInquiries', 'loadTasks', 'loadRecentlyDoneTasks', 'loadIncidents', 'loadActivityAreas', 'docExpiryBadge',
  'loadDailySummary', 'loadFlags',
  // EXT20J activity + inspector wave: he-audit change renderers return DOM nodes:
  'describeChange', 'hlValue', 'codeDiff'];
const ADDED = ['setReportHistoryView', 'inquiriesList', 'agentControls', 'poReceiveOps',
  // EXT17: manual stock adjustments report to an explicit operation state (he-ops, repeatable)
  'adjustOps', 'adjustPending', 'adjustKey', 'checkUnknownAdjustment',
  'openGroupsMem', 'pinnedMem'];
const NEW_MODULES = ['he-ops']; // EXT16: written new, not moved
const CHANGED_TEXT = ["} = window.HE.helpers;", "forEach(o => Object.setPrototypeOf(o, null))", "supabase.auth.onAuthStateChange((event, session) =>", "getAttribute('data-view')", "getElementById('adjustInventoryForm').addEventListener('submit'", "getElementById('logReturnForm').addEventListener('submit'", "getElementById('retOrder').addEventListener('change'", "Release to refresh", "getElementById('docCategory')"]; // the report-view buttons now call setReportHistoryView

test('the module moves were byte-identical: every original statement once, only the named edits differ', ({}, ti) => {
  nodeOnly(ti);
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, [path.join(ROOT, 'tests/tools/verify-moves.js'), '3a40095', '--styles', '--new-modules', NEW_MODULES.join(','), '--changed', CHANGED.concat(ADDED).join(','), '--changed-text', CHANGED_TEXT.join('||')], { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/^OK: /);
});

test('APPLICATION_MODULE_MAP_EXT15.md section 3 matches the code (regenerate: node tests/tools/module-map.js --write)', ({}, ti) => {
  nodeOnly(ti);
  const { render, DOC } = require('../tools/module-map');
  expect(fs.readFileSync(DOC, 'utf8')).toContain(render());
});

test('module graph: created once each, in dependency order, no cycles, no hidden dependencies', ({}, ti) => {
  nodeOnly(ti);
  const { problems, creates } = require('../tools/app-modules').check();
  expect(problems).toEqual([]);
  expect(creates.map(c => c.name)).toEqual(MODULES.map(m => path.basename(m, '.js')));
  expect(creates.length).toBeGreaterThanOrEqual(10);
});

test('the registry refuses a second definition, a second creation and missing inputs', ({}, ti) => {
  nodeOnly(ti);
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'owner-login-modules.js'), 'utf8'), sandbox);
  const M = sandbox.window.HE.modules;
  M.define('a', { api: 1, needs: ['x'] }, ctx => ({ v: ctx.x + 1 }));
  expect(() => M.define('a', { api: 1 }, () => ({}))).toThrow(/defined twice/);
  expect(M.missing({ a: 1, b: 1 })).toEqual(['b']);
  expect(M.mismatched({ a: 2 })).toEqual(['a']);
  expect(() => M.create('a', {})).toThrow(/missing inputs: x/);
  expect(M.create('a', { x: 1 }).v).toBe(2);
  expect(() => M.create('a', { x: 1 })).toThrow(/created twice/);
  expect(Object.isFrozen(M)).toBe(true);
});

test('module files are listed in owner-login.html, fingerprinted, and loaded before the program', ({}, ti) => {
  nodeOnly(ti);
  const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  const files = fs.readdirSync(path.join(ROOT, 'assets', 'app')).map(f => 'assets/app/' + f).sort();
  expect(MODULES.slice().sort()).toEqual(files);
  const crypto = require('crypto');
  for (const f of files) {
    const v = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 10);
    expect(html, f).toContain(`<script src="${f}?v=${v}"></script>`);
    expect(html.indexOf(f)).toBeLessThan(html.indexOf('assets/owner-login-app.js'));
    expect(html.indexOf(f)).toBeGreaterThan(html.indexOf('assets/owner-login-modules.js'));
  }
});

async function expectStopped(page, re) {
  await page.goto('/owner-login.html');
  await expect(page.locator('#scriptError')).toBeVisible();
  await expect(page.locator('#scriptError')).toContainText(re);
  await expect(page.locator('#dash')).toBeHidden();
}

test.describe('start-up refuses a missing, stale or broken module', () => {
  test('a module file that does not load: plain message naming it, nothing else starts', async ({ page, backend }) => {
    const victim = MODULES[MODULES.length - 1];
    await page.route('**/' + victim + '*', r => r.fulfill({ status: 404, body: 'not found' }));
    await expectStopped(page, new RegExp(victim.replace(/[./]/g, '\\$&') + '\\) did not load'));
    await expect(page.locator('#loginForm')).toBeVisible(); // only the sign-in shell; no data
    expect(backend.requests.filter(r => r.path && r.path.startsWith('/rest/'))).toEqual([]);
  });

  test('the registry does not load: plain message', async ({ page }) => {
    await page.route('**/assets/owner-login-modules.js*', r => r.fulfill({ status: 404, body: '' }));
    await expectStopped(page, /owner-login-modules\.js\) did not load/);
  });

  test('a stale module (old compatibility number) next to a new program: mixed-files message', async ({ page }) => {
    const victim = MODULES[2];
    const src = fs.readFileSync(path.join(ROOT, victim), 'utf8').replace(/\{ api: 1,/, '{ api: 0,');
    await page.route('**/' + victim + '*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
    await expectStopped(page, /mix of old and new files/);
  });

  test('an old shell that does not list a newer module: refuses instead of starting half', async ({ page }) => {
    const victim = MODULES[1];
    const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8').replace(new RegExp('<script src="' + victim.replace(/[./]/g, '\\$&') + '\\?v=[0-9a-f]+"></script>\\n'), '');
    await page.route('**/owner-login.html*', r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await expectStopped(page, /did not load/);
  });

  test('a module that throws while being created: the error is shown, the dashboard does not start', async ({ page, backend }) => {
    const victim = MODULES[0];
    const src = fs.readFileSync(path.join(ROOT, victim), 'utf8').replace('function (ctx) {', 'function (ctx) { throw new Error("SYNTHETIC broken module");');
    await page.route('**/' + victim + '*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
    await page.goto('/owner-login.html');
    await expect(page.locator('#scriptError')).toContainText('SYNTHETIC broken module');
    await expect(page.locator('#dash')).toBeHidden();
    expect(backend.tableWrites()).toEqual([]);
  });

  test('a corrupted module file (syntax error): the start-up refuses with a plain message', async ({ page }) => {
    const victim = MODULES[3];
    await page.route('**/' + victim + '*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.HE.modules.define("' + path.basename(victim, '.js') + '", { api: 1 }, function () { return {' }));
    await expectStopped(page, /did not load|went wrong/);
  });
});

test('the diagnostic summary names the program file and every module with its version', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await page.click('#copyDiagBtn');
  await expect(page.locator('#diagText')).toContainText('diagnostic summary', { timeout: 30000 });
  const text = await page.locator('#diagText').textContent();
  const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  const v = f => new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=([0-9a-f]+)').exec(html)[1];
  expect(text).toContain('program ' + v('assets/owner-login-app.js'));
  expect(text).toContain(`modules ${MODULES.length}/${MODULES.length}`);
  for (const m of MODULES) expect(text).toContain(path.basename(m, '.js') + ' ' + v(m));
  expect(text).not.toContain('NOT STARTED');
});
