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
  // Nov 15: also shortens very long cell text when a table is drawn (clipLongCellText)
  'labelPhoneCards',
  // Nov 15: the quick-reminder field takes focus at once (a key pressed right after the shortcut was lost)
  'openQuickAdd', 'openShortcuts', 'resolveInspectTarget', 'showDashboardFor', 'bindOrderLookupLinks',
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
  'renderInquiries', 'loadTasks', 'loadRecentlyDoneTasks', 'CELL_TEXT_SHOWN', 'clipLongCellText', 'loadIncidents', 'loadActivityAreas', 'docExpiryBadge',
  'loadDailySummary', 'loadFlags',
  // EXT20J activity + inspector wave: he-audit change renderers return DOM nodes:
  'describeChange', 'hlValue', 'codeDiff',
  // EXT20J order lookup: the cached answer is a node-builder, not an HTML string:
  'ORDER_LOOKUP', 'lookUpAllOrders',
  // EXT20J: the Guide article body is built as <p> nodes instead of an HTML string:
  'openHelp',
  // EXT20J command palette: rows built as DOM nodes with pageIconNode; the icon
  // string field (and pageIconSvg) is no longer carried on each item:
  'paletteItems',
  // EXT20J calendar wave: every calendar renderer returns DOM nodes (h) instead
  // of HTML strings (data-shown/data-had carried via setAttribute, round-tripped):
  'eventHtml', 'noteEditorHtml', 'dayGroupHtml', 'renderCalendar', 'personalEventEditorHtml'];
const ADDED = ['focusDialog', 'inspectLabel', 'keyLink', 'setReportHistoryView', 'inquiriesList', 'agentControls', 'poReceiveOps',
  // EXT17: manual stock adjustments report to an explicit operation state (he-ops, repeatable)
  'adjustOps', 'adjustPending', 'adjustKey', 'checkUnknownAdjustment',
  'openGroupsMem', 'pinnedMem',
  // EXT20J-post-TT: paints per-calendar colours via the CSS object model (the
  // static u-bg-colorforcalendar-* classes were invalid CSS and never applied)
  'paintCalColors',
  // EXT20J-post-TT: tiny builders for the (now DOM-node) keyboard-shortcut grid
  'scKbd', 'scRow',
  // EXT20J Sales & Growth PART I: new, draft-only sales page wiring (feature-flag
  // OFF by default). loadSales renders the sales view-models with h(); the rest
  // are its helpers. PANEL_LOADERS gained the 7 flag-gated sales panel loaders.
  // salesGrowthOn / SALES_GROWTH_GROUP are the new he-config factory statements.
  'salesMod', 'salesUi', 'salesEngine', 'SALES_TITLES', 'SALES_VIEWS', 'loadSales', 'PANEL_LOADERS',
  'salesGrowthOn', 'SALES_GROWTH_GROUP', 'salesKv', 'salesSection',
  // Nov 7 Phase 1 — Scan Shipment UI flow (commit 4e472ed), feature-flag OFF by
  // default (scanShipmentOn). New top-level declarations wiring the capture→
  // review→confirm→result overlay; the two delegated [data-scan] listeners are
  // waived by text below. No baseline statement is altered (verify-moves reports
  // zero missing/changed — the guard still covers every original statement).
  'scanMod', 'scanState', 'scanOrders', 'scanAccessible', 'scanOverlayEl', 'stopScanCamera',
  'closeScanFlow', 'openScanFlow', 'setExtracted', 'RECOGNITION_LABEL', 'scanRecognizePhoto',
  'scanConfirm', 'scanCard', 'renderScan', 'scanFocusStep', 'scanKeydown', 'startScanCamera', 'captureScanFrame',
  'scanEntryButton', 'paintScanEntry', 'scanShipmentOn',
  // Nov 7 Phase 2 item 4 — Inventory reorder planning view (commit 5c98e05),
  // feature-flag OFF by default (reorderPlanningOn). Read-only planning helpers;
  // the delegated [data-reorder] listener is waived by text below.
  'invMod', 'reorderFilter', 'reorderShowDraft', 'reorderItems', 'reorderDecisionBadge',
  'fmtCell', 'loadReorderPlanning', 'reorderPlanningOn',
  // Nov 7 Phase 2 items 9-10 — Operations output previews wired into Report
  // History, feature-flags OFF by default (reportExportOn / invoicePreviewOn).
  // Read-only, SIMULATED; issuing an invoice stays an owner decision.
  // reportExportOn / invoicePreviewOn are the he-config flag factories (OFF by
  // default), parallel to scanShipmentOn / reorderPlanningOn above.
  'opsReportsMod', 'exportLabelWho', 'exportLabelFor', 'opsInvoiceMod', 'previewInvoiceDraft', 'loadReportExportPreview', 'loadInvoicePreview',
  'reportExportOn', 'invoicePreviewOn',
  // EXT21 L1: composed loader so the export preview renders after Report History
  // loads its rows (the panel loaders otherwise run in parallel); and the
  // he-reports read accessor that exposes the loaded rows to the preview.
  'loadReportHistoryThenExport', 'reportHistoryRows',
  // Export recovery drill panel (read-only, default-OFF he_recovery_drill).
  'loadRecoveryDrill', 'recoveryDrillOn',
  // L3: US-Letter invoice print view (builds into the body-level print host).
  'renderInvoicePrint',
  // follow-on: US-Letter daily-report + packing-slip print views (print host).
  'renderReportPrint', 'renderPackingSlipPrint',
  // #65 saved views & filters wired into Orders + Inventory (host-div, flag
  // savedViewsOn OFF by default). New top-level declarations binding the pure
  // he-saved-views engine to localStorage + the current user + the screen host;
  // the delegated [data-savedview] listener is waived by text below.
  'viewsMod', 'SAVED_VIEW_HOSTS', 'SAVED_VIEW_STATUS', 'savedViewStore',
  'renderSavedViews', 'loadSavedViews', 'savedViewsOn',
  // #54/#55 cycle count + adjustment review wired into Inventory (host-div, flag
  // cycleCountOn OFF by default). Worked synthetic journey render; the delegated
  // [data-cyclecount] listener is waived by text below.
  'cycleCountApproved', 'workedCycleCount', 'loadCycleCount', 'cycleCountOn',
  // #70/#71 report version history + simulated delivery wired into Report
  // History (host-div, flag reportVersionsOn OFF by default). The delegated
  // [data-reportver] listener is waived by text below.
  'reportSchedMod', 'reportRerun', 'reportDeliveryState', 'loadReportVersions', 'reportVersionsOn',
  // #12/#53 supplier scorecard wired into Suppliers (host-div, flag
  // supplierScorecardOn OFF by default). Read-only; no listener.
  'loadSupplierScorecard', 'supplierScorecardOn',
  // Supplier document checklist (Nov 16), same pattern: host empty unless the switch is on.
  'loadSupplierDocs', 'supplierDocsOn', 'supplierDocsShowAll',
  // #08 payment reconciliation review wired into Accounting (host-div, flag
  // reconcileOn OFF by default). The delegated [data-reconcile] listener is
  // waived by text below.
  'reconcileResult', 'reconcileMessage', 'RECONCILE_WORDS', 'reconcileMod', 'loadReconcile', 'reconcileOn',
  // #26 operations watch wired into Report History (host-div, flag opsWatchOn
  // OFF by default). The delegated [data-opswatch] listener is waived below.
  'opsWatchItems', 'opsWatchMod', 'loadOpsWatch', 'opsWatchOn',
  // Preview switches on the Feature Flags page (owner / administrator): on/off
  // buttons for the default-OFF preview flags. The delegated
  // [data-previewswitch] listener is waived by text below.
  'previewSwitchMessage', 'previewSwitchIsOn', 'loadPreviewSwitches', 'PREVIEW_SWITCHES',
  // Invoice review desk (worked example on the invoice preview; flag
  // invoicePreviewOn OFF by default). The delegated [data-invoicedesk] listener
  // is waived by text below.
  'invoiceDesk', 'invoiceDeskSkipped', 'invoiceDeskMessage', 'invoiceDeskOpen', 'draftTaxInput', 'invoiceDeskSales', 'invoiceDeskRates', 'invoiceDeskTaxFields',
  // Expenses receipt picker feedback (owner review Nov 3, point 2): name and
  // size of the chosen file, or the save's own refusal, shown on choosing.
  'receiptSize', 'showReceiptStatus',
  // Sales outreach workbench on Sales Approvals (behind salesGrowthOn; owner
  // brief Nov 3, point 8). The delegated [data-workbench] listener is waived below.
  'announce', 'refocusLike', 'WORKBENCH_KEY', 'workbenchState', 'workbenchSelected', 'workbenchMessage', 'WORKBENCH_REPLIES',
  'workbenchDeps', 'workbenchSave', 'loadSalesWorkbench', 'findWorkbenchStore',
  // Supplier document storage (drafts/36), behind he_supplier_documents_store (OFF).
  'supplierDocsSeq', 'supplierDocsLast', 'SD_WORD', 'sdPerson', 'sdStore', 'sdRecordForm', 'sdHistory', 'sdSettings', 'sdAfter', 'supplierDocsStoreOn',
  // Nov 22: invoice payments on Accounting (drafts/32, behind he_invoice_payments)
  'invPaySeq', 'invPayOpen', 'invPayReverse', 'invPayLast', 'invPayMessage', 'IP_METHOD', 'IP_STATUS', 'invPayStore', 'ipMoney', 'ipWho',
  'loadInvoicePayments', 'invPayDetail', 'invPayAfter', 'invoicePaymentsOn',
  // Nov 22: money matching on Accounting (behind he_money_match)
  'mmState', 'mmSeq', 'MM_WORD', 'MM_KIND', 'mmMod', 'mmCents', 'mmTable', 'loadMoneyMatch', 'moneyMatchOn', 'mmItems', 'mmLastItems',
  // Nov 22: saved money differences (behind he_money_issues)
  'miSeq', 'miMessage', 'miCheckOpen', 'miStore', 'loadMoneyAlert', 'loadMoneyIssues', 'miAfter', 'moneyIssuesOn',
  // Nov 22: deliveries with partial receiving (behind he_receiving_store)
  'dlvSeq', 'dlvLast', 'dlvMessage', 'dlvPo', 'dlvRejectOpen', 'dlvStore', 'dlvWho', 'dlvLineText', 'loadDeliveries', 'dlvAfter', 'receivingStoreOn', 'rtnSeq', 'rtnLast', 'rtnMessage', 'rtnOpen', 'loadStockReturns', 'rtnAfter',
  // Nov 22: new look (preview)
  'lookPicker', 'newLookOn', 'LOOK_CHOICES', 'setLabelSheet', 'PRINT_BRAND', 'printBrand', 'printFoot', 'PRINT_TAGLINE', 'preloadPrintFonts', 'PRINT_SIGNOFF', 'ICON_PATHS', 'backupsPageOn', 'bkReports', 'bkSops', 'bkMonth', 'bkMessage', 'bkSeq', 'BK_DOWN', 'BK_PRINTING', 'bkMonthOf', 'bkMonthName', 'bkNum', 'loadBackupsPage', 'bkMonthRows', 'renderBackupsPage', 'bkPrintDoc', 'bkPrinted', 'bkManualPage', 'orderSlipsOn', 'slipOrders', 'slipItems', 'slipItemsError', 'slipItemsLoading', 'prefetchSlipItems', 'loadOrderSlipsHost', 'slipMessage', 'renderOrderSlipPrint', 'renderPrinterTest',
  // Nov 21 (owner decision 4): hand-off to the owner and owner-only files.
  'sdHandoffForm', 'sdHandoffsForOwner', 'sdSha256',
  // Nov 21 (D-ops-5): the partial receiving example (partialReceivingOn OFF). The
  // delegated [data-partialrcv] listener is waived by text below.
  'partialReceivingShown', 'loadPartialReceiving', 'partialReceivingOn'];
const NEW_MODULES = ['he-ops']; // EXT16: written new, not moved
const CHANGED_TEXT = ["if (backupsPageOn()) { const ops = SIDEBAR_GROUPS.find", "closest('#backupsPanel select#bkMonth')", "closest('#backupsPanel [data-bkgoto]')", "closest('[data-printtest]')", "closest('#ordersTableWrap [data-slip]')", "closest('#stockReturnsHost [data-rtnact]')", "closest('#stockReturnsHost form[data-rtnform]')", "window.addEventListener('afterprint', function () { setLabelSheet(false); });", "} = window.HE.helpers;", "closest('[data-lookpick]')", "const t = e.target.closest('[data-previewswitch]'); if (!t) return;", "closest('#deliveriesHost select#dlvPo')", "closest('#deliveriesHost [data-dlvact]')", "closest('#deliveriesHost form[data-dlvform], #deliveriesHost form[data-dlvrejectform]')", "closest('#moneyAlertHost [data-moneyalertopen]')", "closest('#moneyIssuesHost form[data-micheckform]')", "closest('#moneyMatchHost input[data-mmfile]", "closest('#moneyMatchHost [data-mm]", "closest('#invoicePaymentsHost [data-ipopen]", "closest('#invoicePaymentsHost form[data-ippayform]", "forEach(o => Object.setPrototypeOf(o, null))", "supabase.auth.onAuthStateChange((event, session) =>", "getAttribute('data-view')", "getElementById('adjustInventoryForm').addEventListener('submit'", "getElementById('logReturnForm').addEventListener('submit'", "getElementById('retOrder').addEventListener('change'", "Release to refresh", "getElementById('docCategory')",
  // EXT20J-post-TT: the 4 static overlay scaffolds converted innerHTML->h(); each
  // card class is unique to its statement and present in both the old class="x"
  // and the new class:'x' form, so it waives exactly that one statement.
  'helpCard', 'paletteCard', 'shortcutCard', 'quickAddCard', // the report-view buttons now call setReportHistoryView
  // EXT20J Sales & Growth PART I: he-config appends the flag-gated group (no decl name).
  'SIDEBAR_GROUPS.push(SALES_GROWTH_GROUP)',
  // Nov 7: the delegated event listeners for the Scan Shipment flow (click +
  // change) and the reorder planning view (click). Each fragment is unique to
  // its feature's data-attribute, which did not exist at the 3a40095 baseline,
  // so none can waive an original statement. The [data-scan] fragment waives
  // both scan listeners (click + change); [data-reorder] waives the one reorder
  // listener. Named handlers above; these three are anonymous top-level stmts.
  "e.target.closest('[data-scan]')", "e.target.closest('[data-reorder]')",
  // L3: the invoice print button's delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-print]')",
  // #65: the saved-views delegated listener (anonymous top-level stmt; its
  // data-attribute did not exist at the 3a40095 baseline).
  "e.target.closest('[data-savedview]')",
  // #54/#55: the cycle-count delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-cyclecount]')",
  // #70/#71: the report-versions delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-reportver]')",
  // #08: the reconciliation delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-reconcile]')",
  // #26: the operations-watch delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-opswatch]')",
  // Preview switches: the delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-previewswitch]')",
  // Invoice review desk: the delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-invoicedesk]')", "e.target.closest('[data-supplierdocs]')",
  // Receipt picker feedback: the change listener (anonymous top-level stmt).
  "document.getElementById('expReceipt').addEventListener('change', showReceiptStatus)",
  // ...and the Add-expense save handler gains one line: after a successful save
  // it clears the receipt message along with the field (showReceiptStatus()).
  "document.getElementById('addExpenseForm').addEventListener('submit', async (e) =>",
  // Sales outreach workbench: the delegated listener (anonymous top-level stmt).
  "e.target.closest('[data-workbench]')",
  "document.addEventListener('keydown', scanKeydown)",
  // Supplier document storage: the record form's submit listener (anonymous top-level stmt).
  "e.target.closest('form[data-sdform]')",
  // Nov 21: the hand-off form's submit listener (anonymous top-level stmt).
  "e.target.closest('form[data-sdhandoff]')",
  // Nov 21: the partial receiving example's tab listener (anonymous top-level stmt).
  "e.target.closest('[data-partialrcv]')",
  // Nov 22: closing the phone menu when an iPhone Duo is folded or unfolded
  // across the 820-point line (anonymous top-level try statement).
  "window.matchMedia('(max-width: 820px)')"];

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
