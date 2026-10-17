// Mutation check for the page-side safety guards (2026-10-06, backlog TQ-02).
// For each mutation: copy the repository into a scratch git worktree, break
// ONE guard on purpose, run the tests aimed at it, and report whether they
// failed (= the tests really protect that guard). The real files are never
// touched. Usage (from the repo root):
//   node tests/mutation/run-page-mutations.js [scratch-dir]
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRATCH = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'he-mutations'));

// [name, file, exact text to find, replacement, specs + grep]
const MUTATIONS = [
  // ---- EXT13 additions (2026-10-11): undated evidence, documentation integrity ----
  ['an undated result is accepted as current evidence (EXT13)', 'tests/tools/evidence.js',
    "if (STALE_DAYS[T] && !/^", "if (false && !/^",
    'evidence-ext12 -g "EXT13: a result that expires"'],
  ['the doc checker stops reporting missing files (EXT13)', 'tests/tools/doc-check.js',
    "for (const r of refs) if (!exists(r, dir)) problems.push(", "for (const r of refs) if (false) problems.push(",
    'docs-integrity-ext13 -g "catches"'],
  ['the doc checker stops reporting unknown npm scripts (EXT13)', 'tests/tools/doc-check.js',
    "if (!scripts.includes(m[1])) problems.push(", "if (false) problems.push(",
    'docs-integrity-ext13 -g "catches"'],
  // ---- EXT12 additions (2026-10-11): evidence intake, deployment simulator, incident map (Node tools) ----
  ['evidence with no stated environment is interpreted anyway (EXT12)', 'tests/tools/evidence.js',
    "if (!ENVIRONMENTS.includes(env)) return { status: 'UNKNOWN'", "if (false) return { status: 'UNKNOWN'",
    'evidence-ext12 -g "environment is required"'],
  ['evidence containing a key or token is accepted and stored (EXT12)', 'tests/tools/evidence.js',
    "  if (p.secret) return {", "  if (false) return {",
    'evidence-ext12 -g "secrets are refused"'],
  ['local or staging query results count on the production board (EXT12)', 'tests/tools/evidence.js',
    "if (rec.environment !== 'production' && /^(QUERY_", "if (false && /^(QUERY_",
    'evidence-ext12 -g "environment is required"'],
  ['old evidence never goes STALE (EXT12)', 'tests/tools/evidence.js',
    "> limit ? 'STALE' : rec.status", "> 1e9 ? 'STALE' : rec.status",
    'evidence-ext12 -g "staleness"'],
  ['simulator lets a switch go on before its database step (EXT12)', 'tests/tools/deploy-sim.js',
    "if (!done(s.units[sw.install].status)) return no(s, 'Switch '", "if (false) return no(s, 'Switch '",
    'deploy-sim-ext12 -g "invalid transitions"'],
  ['simulator installs without a passed precheck (EXT12)', 'tests/tools/deploy-sim.js',
    "if (s.units[a.unit].status !== 'PRECHECK PASS') return no(", "if (false) return no(",
    'deploy-sim-ext12 -g "invalid transitions"'],
  ['simulator accepts local evidence for a production step (EXT12)', 'tests/tools/deploy-sim.js',
    "if (!s.simulated && a.env !== 'production')", "if (false)",
    'deploy-sim-ext12 -g "production mode"'],
  ['simulator accepts an unreviewed function version (EXT12)', 'tests/tools/deploy-sim.js',
    "const fpBad = u.fingerprint && a.fingerprint !== u.fingerprint;", "const fpBad = false;",
    'deploy-sim-ext12 -g "fingerprint"'],
  ['simulator rolls back while a switch is ON (EXT12)', 'tests/tools/deploy-sim.js',
    "if (onSwitches.length) return no(", "if (false) return no(",
    'deploy-sim-ext12 -g "rollback: refused"'],
  ['simulator lets two switches be observed at once (EXT12)', 'tests/tools/deploy-sim.js',
    "if (busy.length) return no(", "if (false) return no(",
    'deploy-sim-ext12 -g "one switch at a time"'],
  ['simulated results stop saying SIMULATED (EXT12)', 'tests/tools/deploy-sim.js',
    "message: (s.simulated ? 'SIMULATED: ' : '') + message", "message: message",
    'deploy-sim-ext12 -g "environment must be stated"'],
  ['incident map allows "safe to retry" on an unknown outcome (EXT12)', 'tests/tools/incidents.js',
    "if (s.unknownOutcome && s.retry === 'SAFE' && !s.keyed)", "if (false)",
    'incidents-ext12 -g "validate catches"'],
  // ---- EXT11 additions (2026-10-11): unknown is never $0, lost-reply read-back, installation status ----
  ['a received return claims "Restocked" again although the restock may not have run (X11-06)', 'assets/owner-login-app.js',
    "'Chosen outcome: ' + esc(RETURN_DISPOSITION_LABELS", "'Outcome: Restocked ' + esc(RETURN_DISPOSITION_LABELS",
    'failure-recovery -g "X11-02: claim saved"'],
  ['orders without a total are counted as $0 again (X11-01)', 'assets/owner-login-app.js',
    "return (orders || []).filter(o => o.total === null", "return 0 && (orders || []).filter(o => o.total === null",
    'missing-totals-ext11'],
  ['return receive after a lost reply assumes "not saved" (X11-02)', 'assets/owner-login-app.js',
    "const outcome = await claimOutcomeAfterDrop('returns', id, 'approved', 'received');", "const outcome = 'not_saved';",
    'failure-recovery -g "X11-02"'],
  ['recall quarantine after a lost reply assumes "not saved" (X11-03)', 'assets/owner-login-app.js',
    "const outcome = await claimOutcomeAfterDrop('recalls', id, 'initiated', 'quarantined');", "const outcome = 'not_saved';",
    'inventory-safety -g "X11-03"'],
  ['a count missing from a report shows 0 again (X11-04)', 'assets/owner-login-app.js',
    "      if (v === null || v === undefined || String(v).trim() === '') return '—';\n      const n = Number(v);", "      if (v === null || v === undefined || String(v).trim() === '') return 0;\n      const n = Number(v);",
    'missing-totals-ext11 -g "Report History"'],
  ['a missing report amount counts as $0 in the week total (X11-04)', 'assets/owner-login-helpers.js',
    "g[f] = (v === null || v === undefined || String(v).trim() === '') ? NaN : g[f] + Number(v);", "g[f] = g[f] + Number(v || 0);",
    'helpers-unit -g "EXT11"'],
  ['switch safety misses a switch that is ON without its step (X11-05)', 'assets/owner-login-app.js',
    "const broken = DB_STEPS.filter(([flag], i) => on.has(flag) && installed[i] === false)", "const broken = DB_STEPS.filter(([flag], i) => false)",
    'system-status-ext10 -g "partial install"'],
  ['installation probes run in the background at every sign-in (X11-05)', 'assets/owner-login-app.js',
    "const dbSteps = currentPageId === 'continuityPanel'", "const dbSteps = true",
    'merge-without-sql-ext11 -g "today\'s path"'],
  // ---- EXT10b additions (2026-10-11): receipt recovery, Home next steps, agent health, system status, no silent caps ----
  ['phone rows squeeze their text beside the buttons again (X10-23)', 'assets/owner-login.css',
    "    .approvalRow .info, .deletedRow .info, .sessionRow .info{ flex-basis:100%; }\n", "",
    'mobile-cards-ext10 -g "X10-23" --project=iphone'],
  ['System status values run off the phone screen again (X10-24)', 'assets/owner-login.css',
    "    section.panel table.sysStatus{ display:table; white-space:normal; overflow:visible; }\n", "",
    'system-status-ext10 -g "X10-24" --project=iphone'],
  ['a list read in one request no longer warns at the reply limit', 'assets/owner-login-app.js',
    "if (Array.isArray(rows) && rows.length >= ROW_CAP) noteRowCap(", "if (false) noteRowCap(",
    'scale-matrix -g "one request warns"'],
  ['an unknown receive outcome no longer locks the Receive button', 'assets/owner-login-app.js',
    "            poReceiveOps.unknown(po.id, 'claim reply lost, read-back failed');\n", "",
    'po-receive -g "not saved: Receive is withheld"'],
  ['the receipt check says "safe" without proving nothing was received', 'assets/owner-login-app.js',
    "} else if (PO_ALLOWED_FROM.received.includes(data.status) && !anyReceived) {", "} else if (true) {",
    'po-receive -g "already shows stock"'],
  ['a Received order claims stock was added even when lines are short', 'assets/owner-login-app.js',
    "if (po.status === 'received' && !poReceiveOps.isUnknown(po.id)) actions += shortLines", "if (po.status === 'received' && !poReceiveOps.isUnknown(po.id)) actions += false",
    'po-receive -g "never shows .stock added."'],
  ['Home checks lose their next step', 'assets/owner-login-helpers.js',
    "page: ATTN_PAGES[key], action: ATTN_ACTIONS[key] }, f));", "page: ATTN_PAGES[key] }, f));",
    'attention-checks -g "each rule, exactly"'],
  ['deactivated products count as missing a low-stock level', 'assets/owner-login-helpers.js',
    " && !(inactiveIds && inactiveIds.has(r.product_id)));", ");",
    'attention-checks -g "low-stock level not set"'],
  ['an unreadable schedule list shows agents as Stale again', 'assets/owner-login-app.js',
    "if (a.cronJobName && cronJobState !== 'ok') {", "if (false) {",
    'agent-truth -g "schedule list cannot be read"'],
  ['agents off on purpose are listed as paused', 'assets/owner-login-app.js',
    "rows: AGENT_REGISTRY.filter(a => !a.intendedOff && agentControls().byNum", "rows: AGENT_REGISTRY.filter(a => agentControls().byNum",
    'agent-truth -g "Home lists failed"'],
  ['the diagnostic summary records the error text instead of its kind', 'assets/owner-login-app.js',
    "LAST_ERROR_KIND = errorKind(text); LAST_ERROR_AT", "LAST_ERROR_KIND = text; LAST_ERROR_AT",
    'system-status-ext10 -g "diagnostic summary"'],
  ['System status says the database works when the read failed', 'assets/owner-login-app.js',
    "db = error ? { ok: false,", "db = false ? { ok: false,",
    'system-status-ext10 -g "database unreadable"'],
  ['the purchase-order list hides that older orders are not shown', 'assets/owner-login-app.js',
    "typeof poCount === 'number' && poCount > rows.length", "false",
    'scale-ext10b -g "says it shows only the newest"'],
  ['the PO product picker is limited to one reply again', 'assets/owner-login-app.js',
    "          fetchAllRows('products', 'id, name, sku', q => q).then(rows => ({ data: rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))) }), () => ({ data: [] })),\n          fetchAllRows('inventory_lots', 'id, purchase_order_id",
    "          supabase.from('products').select('id, name, sku').order('name', { ascending: true }),\n          fetchAllRows('inventory_lots', 'id, purchase_order_id",
    'scale-ext10b -g "PO line product list"'],
  ['high-risk switches no longer say what they need first', 'assets/owner-login-app.js',
    "${FLAG_DEPENDS[f.flag_key] ? `<div class=\"d flagDepends\">", "${false ? `<div class=\"d flagDepends\">",
    'nightly-check-ext10 -g "each high-risk switch says"'],
  // ---- EXT10 additions (2026-10-11): request-key lifecycle, new create paths, phone cards ----
  ['different content long after a lost reply keeps the old key (stale key never dropped)', 'assets/owner-login-app.js',
    "Date.now() - Number(d.requestKeyAt || 0) > KEY_FRESH_MS", "false",
    'request-keys-ext10 -g "more than 10 minutes"'],
  ['different content right after a lost reply gets a new key (possible silent duplicate)', 'assets/owner-login-app.js',
    "> KEY_FRESH_MS));", ">= 0));",
    'request-keys-ext10 -g "right after a lost reply"'],
  ['a key is reused after another person signs in on the tab', 'assets/owner-login-app.js',
    "d.requestKeyUser !== uid\n        || ", "",
    'request-keys-ext10 -g "another person"'],
  ['a refused repeat on the new create forms is shown as a failure', 'assets/owner-login-app.js',
    "if (isRequestKeyRepeat(error)) { clearRequestKey(el); toast(what + REPEAT_NOTE); return { error: null, repeated: true }; }", "",
    'request-keys-ext10 -g "reminder \\(Home\\): switch on"'],
  ['a successful create keeps its key (the next real entry is refused)', 'assets/owner-login-app.js',
    "if (!error) { clearRequestKey(el); return { error: null, repeated: false }; }", "if (!error) { return { error: null, repeated: false }; }",
    'request-keys-ext10 -g "same content again is a NEW entry"'],
  ['a lost reply says "safe to press again" even with keys off', 'assets/owner-login-app.js',
    "return { error: new Error(rk\n", "return { error: new Error(true\n",
    'request-keys-ext10 -g "reminder \\(Home\\): switch off"'],
  ['escalation uses a random key (a retry makes a second incident)', 'assets/owner-login-app.js',
    "fixedRequestKey('escalate|' + table + '|' + id)", "newRequestKey()",
    'request-keys-ext10 -g "escalate to incident twice"'],
  ['escalation repeat does not find the incident already made', 'assets/owner-login-app.js',
    "if (rk && isRequestKeyRepeat(incErr)) {", "if (false) {",
    'request-keys-ext10 -g "escalate to incident twice"'],
  ['feature request Add button stays disabled after the first add (X10-01)', 'assets/owner-login-app.js',
    "// add, success or failure, until the page was reloaded.\n        if (btn) btn.disabled = false;", "",
    'request-keys-ext10 -g "X10-01"'],
  ['evidence without a file throws after saving again (X10-02)', 'assets/owner-login-app.js',
    "        clearRequestKey(e.target);\n        titleInput.value = '';\n        descriptionInput.value = '';\n        typeInput.value", "        if (!isLatest()) return;\n        clearRequestKey(e.target);\n        titleInput.value = '';\n        descriptionInput.value = '';\n        typeInput.value",
    'request-keys-ext10 -g "X10-02"'],
  ['phone card cells lose their column labels', 'assets/owner-login-app.js',
    "if (heads[i]) c.setAttribute('data-label', heads[i]); else c.classList.add('cardActions');", "",
    'mobile-cards-ext10 -g "column name is shown" --project=iphone'],
  ['the nightly card never goes STALE', 'assets/owner-login-helpers.js',
    "if (!Number.isFinite(t) || now - t > staleMs) return 'STALE';", "",
    'nightly-check-ext10 -g "older than 26 hours"'],
  ['a failed nightly run is ignored (old results look current)', 'assets/owner-login-helpers.js',
    "if (lastAttempt.status === 'failed') return 'FAIL';", "",
    'nightly-check-ext10 -g "last attempt failed"'],
  ['impossible values only count as a warning', 'assets/owner-login-helpers.js',
    "return /points at the wrong thing|impossible value/i.test(String(row.section || '')) ? 'FAIL' : 'WARN';", "return 'WARN';",
    'nightly-check-ext10 -g "impossible value found"'],
  ['the nightly card reads the tables while its switch is off', 'assets/owner-login-app.js',
    "if (!flag || flag.enabled !== true) {\n          wrap.innerHTML = card('NOT VERIFIED', 'Not set up yet',", "if (false) {\n          wrap.innerHTML = card('NOT VERIFIED', 'Not set up yet',",
    'nightly-check-ext10 -g "switch off"'],
  ['staff are told the nightly check has not run (instead of owner/admin only)', 'assets/owner-login-app.js',
    "if (flag && flag.enabled === true && !['owner', 'administrator'].includes(currentUserRole)) {", "if (false) {",
    'nightly-check-ext10 -g "staff account"'],
  ['the nightly Home switch turns on without the tables', 'assets/owner-login-app.js',
    "if (newVal && row.getAttribute('data-key') === 'integrity_results_home') {", "if (false) {",
    'nightly-check-ext10 -g "refused while the tables are missing"'],
  ['an unreadable nightly check is shown as "not installed"', 'assets/owner-login-app.js',
    "wrap.innerHTML = isMissingRelation(readErr)", "wrap.innerHTML = true",
    'nightly-check-ext10 -g "cannot read"'],
  ['wide tables are no longer cards on a phone', 'assets/owner-login.css',
    "table.phoneCards tr{ display:block;", "table.phoneCards tr{",
    'mobile-cards-ext10 -g "320 px" --project=iphone'],
  // ---- EXT9 additions (2026-10-10): stock buttons and the R1–R5 switches ----
  ['a retry gets a new request key (the repeat is saved twice)', 'assets/owner-login-app.js',
    "if (!d.requestKey || stale) { d.requestKey = newRequestKey();", "{ d.requestKey = newRequestKey();",
    'request-keys -g "lost reply"'],
  ['a refused repeat is shown as a failure instead of "already saved"', 'assets/owner-login-app.js',
    "if (isRequestKeyRepeat(error)) { toast('That expense' + REPEAT_NOTE); error = null; }", "",
    'request-keys -g "lost reply"'],
  ['the request-key switch can be turned on without the columns', 'assets/owner-login-app.js',
    "if (newVal && row.getAttribute('data-key') === 'request_keys') {", "if (false) {",
    'request-keys -g "stays off until the columns exist"'],
  ['a background load puts its currency warning on another page again', 'assets/owner-login-app.js',
    "if (text && currentPageId === pageId) showDashError(text);", "if (text) showDashError(text);",
    'accounting-oracle -g "never appear on a different page"'],
  ['opening a page no longer shows its own warning', 'assets/owner-login-app.js',
    "if (PAGE_WARNINGS[pageId]) showDashError(PAGE_WARNINGS[pageId]);", "",
    'accounting-oracle -g "never appear on a different page"'],
  ['a calendar note edit overwrites a note changed elsewhere', 'assets/owner-login-app.js',
    ".eq('event_uid', uid).eq('note', box.getAttribute('data-shown')).select('event_uid');", ".eq('event_uid', uid).select('event_uid');",
    'calendar-owner -g "still the text shown"'],
  ['a new calendar note is upserted again (replaces one added elsewhere)', 'assets/owner-login-app.js',
    "if (error && String(error.code) !== '23505') throw error;\n              saved = !error;", "if (error && String(error.code) !== '23505') throw error;\n              saved = true;",
    'calendar-owner -g "added in another tab"'],
  ['the page can be framed again (no frame guard)', 'owner-login.html',
    "<script id=\"frameGuard\">if (window.top !== window.self) {", "<script id=\"frameGuard\">if (false) {",
    'csp -g "framed by another site"'],
  ['the CSV guard forgets the full-width equals sign', 'assets/owner-login-helpers.js',
    "\\uFF1D\\uFF0B", "\\uFF0B",
    'helpers-unit -g "full-width"'],
  ['a missing stock switch counts as ON', 'assets/owner-login-app.js',
    "eq('flag_key', STOCK_FN_FLAGS[kind]).maybeSingle();\n        return !error && !!data && data.enabled === true;", "eq('flag_key', STOCK_FN_FLAGS[kind]).maybeSingle();\n        return !error && (!data || data.enabled !== false);",
    'stock-functions -g "no switch row"'],
  ['an unreadable stock switch counts as ON', 'assets/owner-login-app.js',
    "eq('flag_key', STOCK_FN_FLAGS[kind]).maybeSingle();\n        return !error && !!data && data.enabled === true;", "eq('flag_key', STOCK_FN_FLAGS[kind]).maybeSingle();\n        return !!error || (!!data && data.enabled === true);",
    'stock-functions -g "cannot be read"'],
  ['a function that is not installed is reported as a refusal (no "turn the switch off")', 'assets/owner-login-app.js',
    "er.kind = (code === 'PGRST202' || code === '42883' || /could not find the function/i.test(err.message || '')) ? 'missing'", "er.kind = false ? 'missing'",
    'stock-functions -g "not installed"'],
  ['a lost reply on a stock function is reported as "nothing was changed"', 'assets/owner-login-app.js',
    ": (isNetworkError(err) || /^5\\d\\d$/.test(code) || !code) ? 'unknown' : 'refused';", ": 'refused';",
    'stock-functions -g "lost reply"'],
  ['the adjustment no longer sends the number shown (stale tab applied on top)', 'assets/owner-login-app.js',
    "p_reason: reasonInput.value.trim() || null, p_expected: shown });", "p_reason: reasonInput.value.trim() || null, p_expected: null });",
    'stock-functions -g "saved elsewhere since"'],
  ['the adjustment invites a blind retry after a lost reply', 'assets/owner-login-app.js',
    "stockFunctionError(err, 'the adjustment', false)", "stockFunctionError(err, 'the adjustment', true)",
    'stock-functions -g "never invites a blind retry"'],
  ['receive also runs the old browser path after the function', 'assets/owner-login-app.js',
    "          safeRun(loadExpenses);\n          return;\n        }\n", "          safeRun(loadExpenses);\n        }\n",
    'stock-functions -g "one call does everything"'],
  ['return sends the page quantity instead of the whole line (D-ops-5 decided silently)', 'assets/owner-login-app.js',
    "p_disposition: disposition, p_quantity: null });", "p_disposition: disposition, p_quantity: quantity });",
    'stock-functions -g "whole line"'],
  // ---- EXT6 additions (2026-10-07) ----
  ['a total that is really zero shows "-$0.00" again', 'assets/owner-login-helpers.js',
    "if (n === 0 || !isFinite(n)) n = 0;", "if (!isFinite(n)) n = 0;",
    'accounting-oracle -g "exactly zero"'],
  ['figure effect changes the number (EXT7: the fade must never touch the text)', 'assets/owner-login-app.js',
    "      el.classList.add('numIn');", "      el.classList.add('numIn'); el.textContent = el.textContent.replace(/[1-9]/, '0');",
    'accounting-oracle tax-oracle -g "independent|exact"'],
  ['figures lose their thousands commas', 'assets/owner-login-app.js',
    "      formatFigure(el);\n", "",
    'accounting-oracle -g "thousands commas"'],
  // EXT8
  ['inquiries capped across all statuses again', 'assets/owner-login-app.js',
    "fetchAllRows('customer_inquiries', INQ_COLS, q => q.or('status.is.null,status.neq.answered'))", "fetchAllRows('customer_inquiries', INQ_COLS, q => q.eq('status', 'no-such-status'))",
    'capped-reads -g "Customer inquiries"'],
  ['returns: older orders cannot be found', 'assets/owner-login-app.js',
    "      if (!text || btn.disabled) return;\n      btn.disabled = true;\n      try {\n        const { data, error } = await supabase.from('orders').select('id, order_number, customer_name')", "      if (true) return;\n      btn.disabled = true;\n      try {\n        const { data, error } = await supabase.from('orders').select('id, order_number, customer_name')",
    'capped-reads -g "older than the newest 200"'],
  ['capped lists hide their total again (no Show more)', 'assets/owner-login-app.js',
    "      if (!wrap || total == null || total <= shown) return;", "      return;",
    'capped-reads -g "Show more|counts and Show more"'],
  ['order lookup treats % as a wildcard', 'assets/owner-login-app.js',
    "        const pat = '%' + likeLiteral(q) + '%';", "        const pat = '%' + q + '%';",
    'capped-reads -g "is literal"'],
  ['a failed check is shown as nothing found', 'assets/owner-login-helpers.js',
    "        if (!input.ok) {\n          out.push({ key, level: 'unknown'", "        if (false) {\n          out.push({ key, level: 'unknown'",
    'attention-checks -g "UNKNOWN|could not check"'],
  ['data problems can be hidden', 'assets/owner-login-app.js',
    "      const canHide = f => (f.level === 'action' || f.level === 'info') && f.key !== 'backups';", "      const canHide = f => true;",
    'attention-checks -g "cannot be hidden"'],
  ['received-but-not-stocked check removed', 'assets/owner-login-helpers.js',
    "l.product_id && Number(l.quantity_received || 0) !== Number(l.quantity || 0)", "false",
    'attention-checks -g "each rule|data problem"'],
  ['browser Back leaves the dashboard again (no page history)', 'assets/owner-login-app.js',
    "      saveLastPage(pageId);\n      recordPageInHistory(pageId);", "      saveLastPage(pageId);",
    'nav-history -g "Back and Forward|link to a page"'],
  ['"Last 7 days" window cut at the current time again (orders vs expenses differ)', 'assets/owner-login-helpers.js',
    "      if (range === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);", "      if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }",
    'money-periods -g "week"'],
  ['product edit overwrites a newer save (no updated_at guard)', 'assets/owner-login-app.js',
    "                [row.getAttribute('data-updated-at') ? 'eq' : 'is']('updated_at', row.getAttribute('data-updated-at') || null)\n", "",
    'pages-data -g "EXT8: a product saved"'],
  ['PO shipping/tax overwrite a newer save', 'assets/owner-login-app.js',
    "{ status: PO_EDITABLE, deleted_at: null, shipping_cost: po.shipping_cost, tax: po.tax }", "{ status: PO_EDITABLE, deleted_at: null }",
    'purchase-orders -g "another tab meanwhile"'],
  ['older replies may draw over newer ones (no latest-request check)', 'assets/owner-login-app.js',
    "return () => LOAD_TOKENS[key] === t; }", "return () => true; }",
    'out-of-order'],
  ['manual order page policy blocks the database', 'manual-order-entry.html',
    "connect-src 'self' https://uizrazyehilyzmwttsrn.supabase.co wss://uizrazyehilyzmwttsrn.supabase.co;", "connect-src 'self';",
    'csp -g "manual order page works|manual-order-entry.html: has"'],
  ['finishing an order compares the saved total with itself (any total attaches)', 'assets/manual-order-entry.js',
    "Number(pending.resume ? total : pending.total)", "Number(pending.total)",
    'manual-order-entry -g "does not match"'],
  ['finishing an order quietly makes a new order instead of refusing', 'assets/manual-order-entry.js',
    "if (pending.resume && mine.length === 0) {", "if (false) {",
    'manual-order-entry -g "finishing also refuses"'],
  ['manual order sign-out leaves the typed customer in the page', 'assets/manual-order-entry.js',
    // EXT6 runner fix: the sign-out event listener reloads the page too, so a
    // mutant that still signs out is wiped by the listener (equivalent).
    // This one breaks the button's wipe without triggering the listener.
    "try { await sb.auth.signOut(); } finally { window.location.reload(); }", "showLogin();",
    'manual-order-entry -g "signing out clears"'],
  ['manual order: a sign-out in another tab leaves the typed customer in the page', 'assets/manual-order-entry.js',
    "if (event === 'SIGNED_OUT') { leavingOnPurpose = true; window.location.reload(); return; }", "if (event === 'SIGNED_OUT') { showLogin(); return; }",
    'manual-order-entry -g "another tab clears"'],
  ['dashboard sign-out only hides the page (previous data left behind)', 'assets/owner-login-app.js',
    "try { if (note) sessionStorage.setItem(SIGNED_OUT_NOTE, note); } catch (_) { /* private window: no note */ }\n      window.location.reload();",
    "try { if (note) sessionStorage.setItem(SIGNED_OUT_NOTE, note); } catch (_) { /* private window: no note */ }\n      if (note) showLoginError(note);",
    'session-failures -g "shared computer"'],
  ['Emergency: a lost reply on Order Sync is reported as "could NOT" again', 'assets/owner-login-app.js',
    "if (flagErr && isNetworkError(flagErr)) {", "if (false) {",
    'admin-pages -g "Order Sync switch-off fails with a lost reply"'],
  ['deadlock / timeout shown as raw database text again', 'assets/owner-login-helpers.js',
    "if (/deadlock detected|canceling statement due to (statement|lock) timeout|could not obtain lock on row/i.test(t) && !/try again/i.test(t)) {", "if (false) {",
    'helpers-unit -g "deadlock"'],
  // ---- EXT5 additions (2026-10-06) ----
  ['Receive uses the lines the page loaded, not the saved order', 'assets/owner-login-app.js',
    "rpo = Object.assign({}, po, fresh);\n          items = rpo.purchase_order_items || [];", "rpo = po;\n          items = po.purchase_order_items || [];",
    'po-receive -g "another tab"'],
  ['Receive final line re-check removed (clean success despite a change mid-receive)', 'assets/owner-login-app.js',
    "if (after && lineSig(after) !== lineSig(items)) {", "if (false) {",
    'po-receive -g "final re-check"'],
  ['line add / remove no longer re-checks the status afterwards', 'assets/owner-login-app.js',
    "if (statusAfter && !PO_EDITABLE.includes(statusAfter)) {\n              showDashError('The line was removed,", "if (false) {\n              showDashError('The line was removed,",
    'purchase-orders -g "removing a line while"'],
  ['manual order retry adopts any order with the same number', 'assets/manual-order-entry.js',
    "const mine = (already || []).filter(o => Number(o.total) === Number(pending.resume ? total : pending.total) && (o.customer_name || '') === orderPayload.customer_name);", "const mine = (already || []).slice(0, 1);",
    'manual-order-entry -g "another person|two identical"'],
  ['orders saved without items are no longer listed on sign-in', 'assets/manual-order-entry.js',
    "const empty = recent.filter(o => !withLines.has(o.id));", "const empty = [];",
    'manual-order-entry -g "without its items"'],
  ['inquiry draft overwrites a draft changed elsewhere', 'assets/owner-login-app.js',
    "if (rec && (nowRow.ai_draft_reply || '') !== (rec.ai_draft_reply || '')) {", "if (false) {",
    'guarded-toggles -g "draft edited elsewhere"'],
  ['money totals page by position again (double count when rows arrive)', 'assets/owner-login-app.js',
    // keyset paging AND the repeated-id skip are two independent protections;
    // removing only one is equivalent (a 56/57 run showed it), so remove both.
    "if (lastId !== null) q = q.gt('id', lastId);\n        q = q.order('id', { ascending: true }).range(0, PAGE - 1);\n        const { data, error, count } = await q;\n        if (error) throw error;\n        if (pageNo === 0) total = (typeof count === 'number') ? count : null;\n        const batch = data || [];\n        for (const r of batch) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }",
    "q = q.order('id', { ascending: true }).range(rows.length, rows.length + PAGE - 1);\n        const { data, error, count } = await q;\n        if (error) throw error;\n        if (pageNo === 0) total = (typeof count === 'number') ? count : null;\n        const batch = data || [];\n        rows.push(...batch); if (total !== null && rows.length >= total) return rows;",
    'report-totals -g "created while"'],
  ['activity "Load more" repeats rows already shown', 'assets/owner-login-app.js',
    "ACTIVITY_ROWS = ACTIVITY_ROWS.concat(rows.filter(r => r.id == null || !shown.has(r.id)));", "ACTIVITY_ROWS = ACTIVITY_ROWS.concat(rows);",
    'activity-page -g "twice"'],
  ['unreadable number text reported as "empty" again', 'assets/owner-login-app.js',
    "if (el.validity && el.validity.badInput) return '(not a plain number)';", "",
    'numeric-contract -g "typed as"'],
  ['manual order keeps the customer in browser storage', 'assets/manual-order-entry.js',
    "return 'fp1-' + h1.toString(16) + '-' + h2.toString(16) + '-' + text.length;", "return text;",
    'manual-order-entry -g "no customer name"'],
  // ---- EXT4 additions (2026-10-06) ----
  ['feature request advances from the database status, not the one shown (stale tab could jump to done)', 'assets/owner-login-app.js',
    "{ status: nextStatus, updated_at: new Date().toISOString() }, { status: shown });", "{ status: nextStatus, updated_at: new Date().toISOString() }, {});",
    'state-transitions-2 -g "feature request \\"Mark"'],
  ['expense Restore without the "still deleted" condition', 'assets/owner-login-app.js',
    "from('expenses').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null)", "from('expenses').update({ deleted_at: null }).eq('id', id)",
    'state-transitions-2 -g "expense Restore"'],
  ['gateway error page shown as raw HTML again', 'assets/owner-login-helpers.js',
    'if (html !== -1) {', 'if (false) {',
    'fault-injection-2 -g "gateway502"'],
  ['manual order retry matches on the total only (changed lines silently dropped)', 'assets/manual-order-entry.js',
    'if (pending && (pending.resume || pending.fingerprint === fingerprint)) {', 'if (pending) {',
    'manual-order-entry -g "same total"'],
  ['manual order reuses an order number another tab already has', 'assets/manual-order-entry.js',
    'if (!taken || !taken.length) orderNumber = candidate;', 'orderNumber = candidate;',
    'manual-order-entry -g "same second"'],
  ['manual order: Enter while saving submits twice', 'assets/manual-order-entry.js',
    'if (saving) return; // Enter pressed again', 'void 0; // Enter pressed again',
    'manual-order-entry -g "Enter pressed"'],
  ['product delete restores the stock row without looking (deleted product gets a stray row)', 'assets/owner-login-app.js',
    'if (!stillThere) { prodGone = [{ id }]; error = null; }', '',
    'session-expiry-midway -g "WAS deleted"'],
  ['receive expense dated with the UTC day again', 'assets/owner-login-app.js',
    'expense_date: localDateString(new Date()), // Central calendar day', 'expense_date: new Date().toISOString().slice(0, 10), // Central calendar day',
    'po-receive -g "Sept 30"'],
  ['Accounting expense range uses a UTC slice again', 'assets/owner-login-app.js',
    "if (start) q = q.gte('expense_date', localDateString(start));\n          return q;", "if (start) q = q.gte('expense_date', start.toISOString().slice(0, 10));\n          return q;",
    'timezone-contract'],
  ['PO grand total not rounded to cents', 'assets/owner-login-helpers.js',
    'return Math.round((poLinesTotal(po) + Number(po.shipping_cost || 0) + Number(po.tax || 0)) * 100) / 100;', 'return poLinesTotal(po) + Number(po.shipping_cost || 0) + Number(po.tax || 0);',
    'helpers-unit -g "whole cents"'],
  ['money decimals rule removed (10.009 accepted)', 'assets/owner-login-helpers.js',
    'if (!o.integer && o.decimals !== undefined) {', 'if (false) {',
    'failure-recovery -g "10.009"'],
  ['1,000-row notice never shown', 'assets/owner-login-app.js',
    'if (Array.isArray(rows) && rows.length >= ROW_CAP) noteRowCap(', 'if (false) noteRowCap(',
    'scale-matrix -g "notice"'],
  ['Emergency stops before switching off Order Sync when the mode is not recorded', 'assets/owner-login-app.js',
    'if (modeProblem && !protective) {', 'if (modeProblem) {',
    'admin-pages -g "Emergency when"'],
  ['dialog focus trap removed', 'assets/owner-login-app.js',
    "const open = Array.from(document.querySelectorAll('[role=\"dialog\"][aria-modal=\"true\"]')).filter(shown);", 'const open = [];',
    'a11y-basics -g "stay inside"'],
  ['procedure form double-submit lock removed', 'assets/owner-login-app.js',
    'if (submitBtn && submitBtn.disabled) return;', '',
    'write-path-inventory -g "Procedures"'],
  ['refund amount checks removed', 'assets/owner-login-app.js',
    "const refundProblem = numberInputError(raw, { label: 'The refund amount', allowBlank: true, max: 1000000, decimals: 2 });", "const refundProblem = '';",
    'failure-recovery -g "refund of"'],
  // ---- EXT3 additions (2026-10-06) ----
  ['return decision ignores the status shown (stale tab could re-open a return)', 'assets/owner-login-app.js',
    "const changed = await updateIfUnchanged('returns', id, patch, { status: 'requested' });", "const changed = await updateIfUnchanged('returns', id, patch, {});",
    'state-transitions -g "return \\"(Approve|Reject)\\""'],
  ['task button ignores the allowed starting statuses', 'assets/owner-login-app.js',
    "          .in('status', allowedFrom)\n", '',
    'state-transitions -g "task"'],
  ['purchase-order status button ignores the allowed starting statuses', 'assets/owner-login-app.js',
    "const changed = await updateIfUnchanged('purchase_orders', po.id, patch, { status: allowedFrom, deleted_at: null });", "const changed = await updateIfUnchanged('purchase_orders', po.id, patch, { deleted_at: null });",
    'state-transitions -g "purchase order"'],
  ['product edit form overwrites a status changed elsewhere (X3-01)', 'assets/owner-login-app.js',
    ".eq('status', row.getAttribute('data-status'))", '',
    'pages-data -g "stale edit form|saving a product"'],
  ['order Restore without the "still deleted" condition (X3-02)', 'assets/owner-login-app.js',
    "from('orders').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null)", "from('orders').update({ deleted_at: null }).eq('id', id)",
    'pages-data -g "Restore"'],
  ['Expenses total summed from the 200 listed only (X3-03)', 'assets/owner-login-app.js',
    'const total = allAmounts.reduce(', 'const total = (rows || []).reduce(',
    'second-pass-fixes -g "Expenses"'],
  ['Returns list cut at the newest 200 again (X3-04)', 'assets/owner-login-app.js',
    'return q.order(\'created_at\', { ascending: false }).limit(closed ? CLOSED_CAP : OPEN_CAP);', 'return q.order(\'created_at\', { ascending: false }).limit(closed ? CLOSED_CAP : 0);',
    'second-pass-fixes -g "Returns"'],
  ['typed numbers: infinity / text no longer refused (X3-05/06)', 'assets/owner-login-helpers.js',
    "if (!Number.isFinite(n)) return label + ' must be a plain number: digits and one decimal point only (no $, commas, spaces or words), for example 1200.50.';", '',
    'helpers-unit -g "numberInputError"'],
  ['negative shipping accepted again (X3-06)', 'assets/owner-login-app.js',
    "const totalsProblem = numberInputError(numVal(box.querySelector('.poShipping'))", "const totalsProblem = '' && numberInputError(numVal(box.querySelector('.poShipping'))",
    'second-pass-fixes -g "negative shipping"'],
  ['dropped connection shown as raw "Failed to fetch" again', 'assets/owner-login-helpers.js',
    'if (/Failed to fetch|Load failed|NetworkError when attempting to fetch/i.test(t)', 'if (false',
    'fault-injection -g "dropAfter|dropBefore"'],
  ['signed out in another tab: dashboard stays open', 'assets/owner-login-app.js',
    "      if (event === 'SIGNED_OUT') {\n        // EXT18: a change still waiting", "      if (false) {\n        // EXT18: a change still waiting",
    'session-failures -g "another tab"'],
  ['manual order retry creates a second order again', 'assets/manual-order-entry.js',
    'if (mine.length === 1) newOrder = mine[0];', 'if (false) newOrder = mine[0];',
    'manual-order-entry -g "SAME order|no second order"'],
  ['manual order retry adds the items twice', 'assets/manual-order-entry.js',
    'if (!itemCount) {', 'if (true) {',
    'manual-order-entry -g "items twice"'],
  ['employee may save the stock threshold (role check removed)', 'assets/owner-login-app.js',
    "if (!canChangeStock()) { showDashError('Only the Owner or an Administrator can change stock settings. Nothing was changed.'); return; }", '',
    'role-matrix -g "low-stock"'],
  ['sold product can be deleted again (X3-13)', 'assets/owner-login-app.js',
    'if (soldCount) {', 'if (false) {',
    'product-lifecycle -g "sold"'],
  ['search Enter prefers a Guide over the named page again', 'assets/owner-login-app.js',
    'if (named) { showPage(named.id); return; }', '',
    'general -g "page name"'],
  ['CSV formula guard removed (=, +, -, @ run as formulas)', 'assets/owner-login-helpers.js',
    "if (/^[=+\\-@\\t\\r\\n\\uFF1D\\uFF0B\\uFF0D\\uFF20]/.test(s) && !/^[-+]?\\$?[\\d,]+(\\.\\d+)?%?$/.test(s)) s = \"'\" + s;", '',
    'csv-export-guard'],
  ['refund larger than the order line accepted', 'assets/owner-login-app.js',
    'amount > lineValue + 0.005', 'false',
    'failure-recovery -g "refund above the order line"'],
  ['Emergency follow-up: column-not-found fallback removed (X3-17)', 'assets/owner-login-app.js',
    "if (flagErr && (String(flagErr.code) === 'PGRST204'", "if (false && (String(flagErr.code) === 'PGRST204'",
    'admin-pages -g "no who/when columns"'],
  ['business rule save ignores what the page showed (MU-14)', 'assets/owner-login-app.js',
    "shown === 'null' ? { config: null } : { config: shown });", '{});',
    'admin-pages -g "MU-14"'],
  ['stale guard dropped (updateIfUnchanged ignores the expected values)', 'assets/owner-login-app.js',
    'Object.keys(expected || {}).forEach(col => {', 'Object.keys({}).forEach(col => {',
    'ops-findings purchase-orders guarded-toggles -g "stale|already|only from|only while"'],
  ['silent refusals accepted (noRowsChanged always false)', 'assets/owner-login-helpers.js',
    'function noRowsChanged(data){ return !data || (Array.isArray(data) && data.length === 0); }', 'function noRowsChanged(data){ return false; }',
    'pages-data double-submit-stale admin-pages -g "quietly refuses|could not really|was NOT"'],
  ['paging stops after the first page (fetchAllRows)', 'assets/owner-login-app.js',
    'lastId = batch[batch.length - 1].id;', 'return rows;',
    'report-totals -g "2,500|1,001|10,000"'],
  ['permission pre-check removed (canChangeStock always true)', 'assets/owner-login-app.js',
    "function canChangeStock(){ return currentUserRole === 'owner' || currentUserRole === 'administrator'; }", 'function canChangeStock(){ return true; }',
    'query-a-fixes inventory-safety -g "employee"'],
  ['second press removed (confirmSecondPress always true)', 'assets/owner-login-helpers.js',
    "if (btn.dataset.armed === '1') { btn.dataset.armed = '0'; return true; }", 'return true;',
    'failure-recovery ops-findings purchase-orders -g "first press|Confirm refund|second press"'],
  ['upload cleanup skipped (refused record leaves the file)', 'assets/owner-login-app.js',
    'const { error: cleanupErr } = await supabase.storage.from(bucket).remove([path]);', 'const cleanupErr = null;',
    'storage-safety query-a-fixes -g "removed again|no longer leaves|before the record was saved"'],
  ['upload keeps a file even when nothing was saved (network check inverted)', 'assets/owner-login-app.js',
    'if (!checkErr && saved) return;', 'if (!checkErr) return;',
    'storage-safety -g "before the record was saved"'],
  ['file names not cleaned (safeStorageName identity)', 'assets/owner-login-helpers.js',
    "let n = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')", "let n = String(name || 'file')",
    'storage-safety -g "hostile or very long"'],
  ['escaping broken (esc returns raw text)', 'assets/owner-login-helpers.js',
    ".replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));", ';',
    'xss-everywhere -g "every text field|no database text"'],
  ['Emergency follow-up failures hidden again', 'assets/owner-login-app.js',
    'if (leftOn.length) {', 'if (false) {',
    'admin-pages -g "could not really"'],
  ['document categories widened back to the old list', 'assets/owner-login-app.js',
    "      license: 'License / Permit',", "      license: 'License / Permit',\n      invoice: 'Invoice',",
    'state-machine query-a-fixes -g "categor"'],
  // EXT7
  ['open tasks capped together with finished ones again', 'assets/owner-login-app.js',
    "          .not('status', 'in', CLOSED_IN)\n          .order('due_at'", "          .order('due_at'",
    'owner-control-center -g "Tasks: 150|more than 100"'],
  ['approval queue capped together with decided requests again', 'assets/owner-login-app.js',
    "          .not('status', 'in', CLOSED_IN)\n          .order('created_at', { ascending: false })", "          .order('created_at', { ascending: false })",
    'owner-control-center -g "Approvals: 120"'],
  ['open incidents capped together with resolved ones again', 'assets/owner-login-app.js',
    "          .or('status.is.null,status.not.in.' + CLOSED_IN)\n", '',
    'owner-control-center -g "Incidents: 120"'],
  ['Reopen allowed for cancelled tasks', 'assets/owner-login-app.js',
    "open: ['done'] };", "open: ['done', 'cancelled'] };",
    'owner-control-center state-machine -g "only the finished one|done only reopens"'],
  ['Reopen without the still-done condition', 'assets/owner-login-app.js',
    "          .in('status', allowedFrom)\n          .select('id, status');", "          .select('id, status');",
    'owner-control-center tasks -g "cancelled elsewhere|already finished elsewhere"'],
  ['one failed Business Health read blanks the whole panel again', 'assets/owner-login-app.js',
    "        }).catch(e => ({ ok: false, e }));", "        });",
    'owner-control-center -g "Overdue tasks is"'],
  ['unsaved typing no longer protected when closing the tab', 'assets/owner-login-app.js',
    "      if (leavingOnPurpose || !hasUnsavedTyping()) return;", "      return;",
    'unsaved-changes -g "did not save"'],
  ['forced sign-out waits on the unsaved-typing question', 'assets/owner-login-app.js',
    "      leavingOnPurpose = true;\n      dash.style.display = 'none';", "      dash.style.display = 'none';",
    'unsaved-changes -g "another tab"'],
  ['manual order stays "unsaved" after a successful save', 'assets/manual-order-entry.js',
    "    orderTyped = false;\n    orderForm.reset();", "    orderForm.reset();",
    'unsaved-changes -g "FAILED save"'],
  ['unknown service status shown as Operational again', 'assets/owner-login-app.js',
    "                  ${['operational', 'degraded', 'down'].includes(s.status) ? '' : `<option value=\"${esc(s.status || '')}\" selected disabled>Unknown (${esc(s.status || 'not set')})</option>`}\n", '',
    'stale-tab-gaps -g "never as Operational"'],
  ['SOP switch guesses instead of re-reading after a refusal', 'assets/owner-login-app.js',
    "                showDashError(staleMessage('That procedure'));\n                loadSops();\n                return;", "                throw new Error(staleMessage('That procedure'));",
    'stale-tab-gaps -g "shows it ON"'],
  ['supplier same-name check removed', 'assets/owner-login-app.js',
    "        if (same && same.length && !window.confirm(", "        if (false && !window.confirm(",
    'stale-tab-gaps -g "same name in any case"'],
  ['dashboard keeps showing the previous person after a sign-in switch', 'assets/owner-login-app.js',
    "      if (uid && shownUserId && uid !== shownUserId) {\n        wipeAfterSignOut(", "      if (false) {\n        wipeAfterSignOut(",
    'auth-chaos -g "signed-in person changes"'],
  ['dashboard wipes on every sign-in event (same person too)', 'assets/owner-login-app.js',
    "      if (uid && shownUserId && uid !== shownUserId) {\n        wipeAfterSignOut(", "      if (uid) {\n        wipeAfterSignOut(",
    'auth-chaos -g "SAME person"'],
  ['order page keeps the previous person\'s attempt after a switch', 'assets/manual-order-entry.js',
    "      pending = null;\n      storePending(null);\n      leavingOnPurpose = true;\n      window.location.reload();\n    }\n  });", "      leavingOnPurpose = true;\n      window.location.reload();\n    }\n  });",
    'auth-chaos -g "manual order page"'],
  // EXT14: diagnostics fuzz found the role copied verbatim into the summary.
  ['diagnostic summary copies the database role value verbatim again', 'assets/owner-login-app.js',
    "Object.prototype.hasOwnProperty.call(ROLE_LABELS, currentUserRole) ? currentUserRole : 'other (not a standard role)'", "currentUserRole",
    'diagnostics-ext14'],
  // EXT15: modules, strict style policy, honesty fixes found by the property tests.
  ['the registry lets a module be created twice', 'assets/owner-login-modules.js',
    "if (d.instance) throw new Error('Module created twice: ' + name);", "",
    'modules-ext15 -g "registry refuses"'],
  ['the start-up no longer refuses a missing module', 'assets/owner-login-app.js',
    "  } else if (window.HE.modules.missing(APP_MODULES).length) {", "  } else if (false) {",
    'modules-ext15 -g "does not load: plain message naming it"'],
  ['a module uses a value it was not handed (hidden dependency)', 'assets/app/he-format.js',
    "const { CLOSED_WORDS, esc, fmtDateOnly } = ctx;", "const { CLOSED_WORDS, fmtDateOnly } = ctx;",
    'modules-ext15 -g "module graph"'],
  ['a module reads a value off window instead of ctx (hidden dependency)', 'assets/app/he-format.js',
    "const { CLOSED_WORDS, esc, fmtDateOnly } = ctx;", "const { CLOSED_WORDS, fmtDateOnly } = ctx; const esc = window.__notHanded;",
    'modules-ext15 -g "module graph"'],
  ['the diagnostic summary stops naming the program version', 'assets/app/he-status.js',
    "return 'program ' + pick(/owner-login-app\\.js/) + ', helpers API '", "return 'helpers API '",
    'modules-ext15 -g "diagnostic summary names"'],
  ['inline styles allowed again on the owner page', 'owner-login.html',
    "style-src 'self';", "style-src 'self' 'unsafe-inline';",
    'csp-strict-ext15 -g "the policy"'],
  ['a sidebar group colour is applied without the hex check', 'assets/owner-login-app.js',
    "if (/^#[0-9a-fA-F]{3,8}$/.test(c)) g.style.setProperty('--groupColor', c);", "g.style.setProperty('--groupColor', c);",
    'csp-strict-ext15 -g "group colour"'],
  ['the activity detail toggle reads the inline display again (never opens)', 'assets/owner-login-app.js',
    "if (getComputedStyle(box).display === 'none') {\n            if (!box.innerHTML) box.innerHTML = describeChange(ACTIVITY_ROWS[i]);", "if (box.style.display === 'none') {\n            if (!box.innerHTML) box.innerHTML = describeChange(ACTIVITY_ROWS[i]);",
    'activity-page'],
  ['a blank nightly-check count reads as PASS again', 'assets/owner-login-helpers.js',
    "const isCount = (typeof f === 'number' && Number.isInteger(f)) || (typeof f === 'string' && /^\\s*\\d+\\s*$/.test(f));", "const isCount = f != null && Number.isFinite(Number(f));",
    'property-node-ext15 -g "nightly check"'],
  ['the offline bar covers the header again (menu cannot be opened offline)', 'assets/owner-login.css',
    "position:fixed; left:0; right:0; bottom:0; z-index:190; pointer-events:none;", "position:fixed; left:0; right:0; top:0; z-index:220;",
    'chaos-ui-ext15 -g "offline bar"'],
  ['a failed AI month-spend read shows $0.00 spent again', 'assets/owner-login-app.js',
    "const spendThisMonth = monthErr ? null : (monthLogs || [])", "const spendThisMonth = (monthLogs || [])",
    'malformed-data-ext15 -g "spend cannot be read"'],
  // EXT16: strict policies on the five smaller pages.
  ['inline styles allowed again on the manual order page', 'manual-order-entry.html',
    "style-src 'self' https://fonts.googleapis.com;", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
    'csp-strict-ext15 -g "ALL dashboard pages"'],
  ['the dashboard spend bar no longer gets its width', 'assets/dashboard-page.js',
    "if (fill) fill.style.width = Math.max(0, Math.min(100, Number(pct) || 0)) + '%';", "",
    'pages-strict-ext16 -g "spend bar"'],
  // EXT16: high-risk operation state machine (he-ops).
  ['an unknown result may be sent again (automatic retry)', 'assets/app/he-ops.js',
    "|| (r.state === 'RESULT_UNKNOWN' && r.idempotent && idempotent);", "|| (r.state === 'RESULT_UNKNOWN');",
    'ops-state-ext16'],
  ['a confirmed receipt may be sent a second time', 'assets/app/he-ops.js',
    "CONFIRMED: [],", "CONFIRMED: ['SENDING'],",
    'ops-state-ext16 -g "random event"'],
  ['"still unknown" is accepted outside a read-back', 'assets/app/he-ops.js',
    "stillUnknown(key, why) { if (get(key).state !== 'READBACK_CHECKING') throw", "stillUnknown(key, why) { if (false) throw",
    'ops-state-ext16 -g "random event"'],
  ['an agent switch that is not on/off counts as on again', 'assets/app/he-agents.js',
    "if (typeof ctrl.enabled !== 'boolean') return { key: 'unknown',", "if (false) return { key: 'unknown',",
    'malformed-data-ext15 -g "clear on/off"'],
  // EXT17: manual stock adjustment state machine (he-ops, repeatable)
  ['a lost adjustment reply is sent again without the read-back check', 'assets/owner-login-app.js',
    "      if (adjustOps.isUnknown(key)) { await checkUnknownAdjustment(key, amountInput); return; }\n", "",
    'adjust-ops-ext17 -g "sends NOTHING"'],
  ['the adjustment read-back never recognises a saved adjustment', 'assets/owner-login-app.js',
    "} else if (p.before != null && now === p.before + p.change) {", "} else if (false) {",
    'adjust-ops-ext17 -g "sends NOTHING"'],
  ['stock saved but history refused is reported as "could not save"', 'assets/owner-login-app.js',
    "        if (stockDone) {", "        if (false) {",
    'adjust-ops-ext17 -g "history line refused"'],
  ['a confirmed adjustment blocks the next one on the same product', 'assets/app/he-ops.js',
    "{ CONFIRMED: ['READY', 'SENDING'] }", "{ CONFIRMED: [] }",
    'adjust-ops-ext17 -g "two normal adjustments"'],
  // EXT17: browser storage that cannot be trusted
  ['open sidebar sections are read back from storage after every click again', 'assets/app/he-nav.js',
    "      return openGroupsMem.slice();", "      const r = openGroupsMem.slice(); openGroupsMem = null; return r;",
    'storage-adversarial-ext17 -g "drawn again"'],
  ['a stored open-sections value of any shape is trusted again', 'assets/app/he-nav.js',
    "          openGroupsMem = Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];", "          openGroupsMem = v;",
    'storage-adversarial-ext17 -g "null|number|object"'],
  // EXT17: session-reuse isolation (test helper): the restore must run once per page
  ['session reuse restores the session again after sign-out', 'tests/helpers/dashboard.js',
    "        if (sessionStorage.getItem('__heFastLogin')) return;\n", "",
    'fast-login-isolation-ext17 --workers=1'],
  // (Removing only the read-back check is not enough to double-count: begin() also
  // refuses a send from RESULT_UNKNOWN, a second independent layer.)
  ['high-risk chaos: a lost adjustment reply misread as "not saved" is sent twice', 'assets/owner-login-app.js',
    "            adjustOps.unknown(key, 'stock reply lost');", "            adjustOps.failedBeforeEffect(key, 'x'); adjustOps.reset(key, 'x');",
    'chaos-long-ext17'],
  ['a lost adjustment reply misread as "not saved" (browser test)', 'assets/owner-login-app.js',
    "            adjustOps.unknown(key, 'stock reply lost');", "            adjustOps.failedBeforeEffect(key, 'x'); adjustOps.reset(key, 'x');",
    'adjust-ops-ext17 -g "sends NOTHING"'],
  // EXT18: security gates
  ['the script policy allows the whole CDN again (any package could run)', 'owner-login.html',
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js; style-src", "https://cdn.jsdelivr.net; style-src",
    'frame-csp-ext18 -g "same CDN is refused"'],
  ['a supplier name is put into the page without escaping', 'assets/app/he-suppliers.js',
    '<div class="sName">${esc(s.name)} <span', '<div class="sName">${s.name} <span',
    'security-static-ext18 -g "static security check passes|DOM sink gate passes"'],
  ['the DOM sink gate lets an unreviewed value through', 'tests/tools/dom-sinks.js',
    "if (!e) fails.push(", "if (false) fails.push(",
    'security-static-ext18 -g "DOM sink gate"'],
  ['the static check no longer notices eval / Function', 'tests/tools/static-security.js',
    "if (c === 'eval' ||", "if (false && c === 'eval' ||",
    'security-static-ext18 -g "planted dangerous"'],
  // EXT18: values named like built-in object properties
  ['the sales-tax-by-state table uses a plain object again ("__proto__" state vanishes)', 'assets/owner-login-app.js',
    "        const stateTax = Object.create(null);", "        const stateTax = {};",
    'prototype-keys-ext18 -g "shipping state"'],
  ['the duplicate purchase-order check uses a plain object again (page fails on "Purchase order constructor")', 'assets/owner-login-app.js',
    "        const poCosts = Object.create(null);", "        const poCosts = {};",
    'prototype-keys-ext18 -g "Accounting"'],
  ['the label tables keep their prototype again ("constructor" finds a function)', 'assets/owner-login-helpers.js',
    "    Object.setPrototypeOf(TAX_CATEGORY_MAP, null);", "    ",
    'prototype-keys-ext18 -g "expense category"'],
  // EXT18: slow patterns on huge input
  ['database error text is no longer cut before the slow pattern checks', 'assets/owner-login-helpers.js',
    "      let t = raw.slice(0, 2000);", "      let t = raw;",
    'security-parsers-ext18 -g "explainDbError"'],
  // EXT18: secret firewall
  ['the secret scanner no longer reports any key pattern', 'tests/tools/secret-scan.js',
    "const m = text.match(re); if (m) hits.push(name);", "const m = text.match(re); if (false) hits.push(name);",
    'supply-chain-ext18 -g "fires on each kind"'],
  ['the secret scanner no longer refuses .env and key files', 'tests/tools/secret-scan.js',
    "if (SECRET_FILE.test(f) && !SECRET_FILE_OK.test(f))", "if (false)",
    'supply-chain-ext18 -g "fires on each kind"'],
  // EXT18: honest note when signed out with a save still on its way
  ['changes waiting for a reply are no longer counted (sign-out says "not sent")', 'assets/app/he-data.js',
    "      if (isWrite) writesWaiting++;", "",
    'session-security-ext18 -g "still on its way"'],
  // EXT19: safe element builder
  ['the element builder adds text as HTML', 'assets/app/he-ui.js',
    "el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));", "if (c instanceof Node) el.appendChild(c); else el.insertAdjacentHTML('beforeend', String(c));",
    'dom-builder-ext19 -g "3,000 hostile"'],
  ['the element builder accepts event-handler attributes', 'assets/app/he-ui.js',
    "if (/^on/i.test(k) || /^srcdoc$/i.test(k)) throw", "if (false) throw",
    'dom-builder-ext19 -g "refused"'],
  ['the icon builder accepts any tag from the table', 'assets/app/he-ui.js',
    "        if (!ICON_TAGS.test(m[1])) continue;\n", "",
    'dom-builder-ext19 -g "pageIconNode"'],
  // EXT19: state contract and schema contract
  ['an unknown result may be re-sent straight away (table changed)', 'assets/app/he-ops.js',
    "    RESULT_UNKNOWN: ['READBACK_CHECKING'],", "    RESULT_UNKNOWN: ['READBACK_CHECKING', 'SENDING'],",
    'state-contract-ext19'],
  ['a conflict may be overwritten (conflict goes straight to sending)', 'assets/app/he-ops.js',
    "    CONFLICT: ['READY'],", "    CONFLICT: ['READY', 'SENDING'],",
    'state-contract-ext19'],
  ['"changed by" is read from profiles.full_name again', 'assets/app/he-agents.js',
    "select('id, display_name, email')", "select('id, full_name')",
    'schema-contract-ext19 -g "who changed"'],
  // EXT20: Trusted Types ratchet and URL safety
  ['a toast shows its message as HTML (EXT20 security)', 'assets/app/he-ui.js',
    "h('span', null, message)", "Object.assign(document.createElement('span'), { innerHTML: message })",
    'trusted-types-ext20 -g "toasts"'],
  ['a raw HTML string is restored for an empty state (EXT20 security)', 'assets/app/he-admin.js',
    "document.getElementById('sessionsWrap').replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'No active sessions found.' }));",
    "document.getElementById('sessionsWrap').innerHTML = '<p class=\"empty\">No active sessions found.</p>';",
    'trusted-types-ext20 -g "report-only"'],
  ['a javascript: link becomes clickable again (EXT20 security)', 'assets/app/he-ui.js',
    "!/^(javascript|data|vbscript):/.test(u)", "!/^(data|vbscript):/.test(u)",
    'link-scheme-check'],
];

// EXT16: `--check` only confirms that every mutant's text is still in its file
// exactly once (no worktree, no test run; about a second). A mutant whose code
// moved is otherwise found only by a full run: 17 had gone stale unnoticed
// (14 manual-order mutants after EXT16 moved that page's script, 2 after the
// PO receive state machine, 1 since EXT15) because only subsets were run.
function mutantTarget(dir, file, find) {
  const files = file === 'assets/owner-login-app.js'
    ? [file, ...fs.readdirSync(path.join(dir, 'assets', 'app')).filter(f => f.endsWith('.js')).map(f => 'assets/app/' + f)]
    : [file];
  const hits = files.map(f => [f, fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').split(find).length - 1 : 0]).filter(([, n]) => n > 0);
  return { hits, total: hits.reduce((a, [, n]) => a + n, 0) };
}
if (process.argv[2] === '--check') {
  const stale = MUTATIONS.filter(([, file, find]) => mutantTarget(ROOT, file, find).total !== 1);
  for (const [name, file, find] of stale) console.error('NOT APPLICABLE (' + mutantTarget(ROOT, file, find).total + ' copies): ' + name + ' [' + file + ']');
  const names = MUTATIONS.map(m => m[0]);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  for (const n of dupes) console.error('DUPLICATE NAME: ' + n);
  console.log(MUTATIONS.length + ' mutants, ' + stale.length + ' not applicable, ' + dupes.length + ' duplicate names');
  process.exit(stale.length || dupes.length ? 1 : 0);
}

function sh(cmd, cwd) { return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }

// EXT14: refresh ?v= for every local asset a page references (the page script
// moved to assets/owner-login-app.js, so most mutants now edit an asset).
function fixHelpersHash(dir) {
  for (const page of ['owner-login.html', 'change-password.html', 'search.html', 'dashboard.html', 'manual-order-entry.html', 'index.html']) { // EXT16: the order pages load assets too
    const p = path.join(dir, page);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf8').replace(/((?:href|src)=")(assets\/[^"?]+)\?v=[0-9a-f]+"/g, (all, pre, file) =>
      pre + file + '?v=' + crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex').slice(0, 10) + '"');
    fs.writeFileSync(p, html);
  }
}

// EXT14 crash safety. Mutants are only ever written inside SCRATCH (a separate
// git worktree), never in the real working tree. These guards make sure that
// stays true even if the run is interrupted or SCRATCH is pointed somewhere odd:
//   * SCRATCH must be outside the repository and must not be a parent of it
//   * an existing SCRATCH is only deleted if it is empty or carries our marker
//   * Ctrl-C / kill removes the worktree and prunes git's worktree list
//   * progress is written after each mutant (SCRATCH + '.progress.json')
//   * the real tree's status is fingerprinted before and checked after
const MARKER = '.he-mutation-scratch';
(function guardScratch() {
  const rel = path.relative(ROOT, SCRATCH);
  if (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('mutation scratch must be outside the repository: ' + SCRATCH);
  if (!path.relative(SCRATCH, ROOT).startsWith('..')) throw new Error('mutation scratch must not contain the repository: ' + SCRATCH);
  if (fs.existsSync(SCRATCH) && fs.readdirSync(SCRATCH).length && !fs.existsSync(path.join(SCRATCH, MARKER)))
    throw new Error('refusing to delete ' + SCRATCH + ': not empty and not a mutation scratch folder (no ' + MARKER + ')');
})();
function cleanScratch() {
  try { sh(`git worktree remove --force "${SCRATCH}"`, ROOT); } catch (e) { /* not there */ }
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  try { sh('git worktree prune', ROOT); } catch (e) { /* ignore */ }
}
const treeState = () => crypto.createHash('md5').update(sh('git status --porcelain=v1 -uall', ROOT) + sh('git rev-parse HEAD', ROOT)).digest('hex');
const TREE_BEFORE = treeState();
function interrupted(sig) { console.error('\ninterrupted (' + sig + '): removing the mutation worktree'); cleanScratch(); process.exit(130); }
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => interrupted(sig));
// A child (git / the test run) killed by the same Ctrl-C must not be mistaken
// for a result: an interrupted test run is NOT a "missed" mutant.
const killedBySignal = e => e && (e.signal || e.status === 130 || e.status === 143);
const PROGRESS = SCRATCH.replace(/[\\/]+$/, '') + '.progress.json';

// EXT14: the test run is awaited (not a blocking execSync), so Ctrl-C is handled
// the moment it arrives, and a result is never recorded after an interrupt
// (found under load: a blocked handler let an interrupted run be scored).
let STOP = null, RUNNING = null;
function runTests(cmd, cwd) {
  return new Promise(resolve => {
    const child = spawn('sh', ['-c', cmd], { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true }); // own group: stopped as a whole
    RUNNING = child;
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', (code, signal) => { RUNNING = null; resolve({ out, code, signal }); });
  });
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) { process.removeAllListeners(sig); process.on(sig, () => { STOP = sig; if (RUNNING) { try { process.kill(-RUNNING.pid, 'SIGTERM'); } catch (e) { /* already gone */ } } else interrupted(sig); }); }

const results = [];
// MUT_ONLY=<regex> runs only the mutants whose name matches (spot checks).
const ONLY = process.env.MUT_ONLY ? new RegExp(process.env.MUT_ONLY, 'i') : null;
(async function main() {
try {
for (const [name, file, find, repl, specs] of MUTATIONS.filter(m => !ONLY || ONLY.test(m[0]))) {
  if (STOP) interrupted(STOP);
  cleanScratch();
  sh(`git worktree add --detach "${SCRATCH}" HEAD`, ROOT);
  fs.writeFileSync(path.join(SCRATCH, MARKER), 'mutation scratch; safe to delete\n');
  // the working tree's current test files and page (may be ahead of HEAD)
  for (const f of ['owner-login.html', 'manual-order-entry.html', 'index.html', 'search.html', 'dashboard.html', 'change-password.html']) fs.copyFileSync(path.join(ROOT, f), path.join(SCRATCH, f));
  fs.cpSync(path.join(ROOT, 'assets'), path.join(SCRATCH, 'assets'), { recursive: true }); // EXT14: all page code (app script, helpers, CSS)
  fs.rmSync(path.join(SCRATCH, 'tests'), { recursive: true, force: true });
  sh(`cp -r "${path.join(ROOT, 'tests')}" "${path.join(SCRATCH, 'tests')}"`, ROOT);
  // EXT19: contract files some specs read (they may be ahead of HEAD too)
  for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'ops')).filter(f => f.endsWith('.json'))) fs.copyFileSync(path.join(ROOT, 'docs', 'ops', f), path.join(SCRATCH, 'docs', 'ops', f));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(SCRATCH, 'node_modules'));
  // EXT15: the owner program is split into assets/app/*.js modules. A mutant
  // written for owner-login-app.js is applied to whichever of the owner page's
  // code files holds its text, and only if exactly one of them does, exactly once.
  let targetFile = file;
  if (file === 'assets/owner-login-app.js') {
    const ownerFiles = ['assets/owner-login-app.js', ...fs.readdirSync(path.join(SCRATCH, 'assets', 'app')).filter(f => f.endsWith('.js')).map(f => 'assets/app/' + f)];
    const hits = ownerFiles.map(f => [f, fs.readFileSync(path.join(SCRATCH, f), 'utf8').split(find).length - 1]).filter(([, n]) => n > 0);
    if (hits.length > 1) { results.push([name, 'MUTATION NOT APPLIED (text found in ' + hits.map(h => h[0]).join(' and ') + ')']); continue; }
    if (hits.length === 1) targetFile = hits[0][0];
  }
  const target = path.join(SCRATCH, targetFile);
  const src = fs.readFileSync(target, 'utf8');
  if (!src.includes(find)) { results.push([name, 'MUTATION NOT APPLIED (text not found)']); continue; }
  // EXT4: the text must be unique, or the wrong copy could be broken.
  if (src.split(find).length !== 2) { results.push([name, 'MUTATION NOT APPLIED (text found more than once)']); continue; }
  fs.writeFileSync(target, src.replace(find, repl));
  if (targetFile.startsWith('assets/')) fixHelpersHash(SCRATCH);
  await new Promise(r => setImmediate(r)); // let a pending Ctrl-C land before the run starts
  if (STOP) interrupted(STOP);
  const { out, signal, code } = await runTests(`npx playwright test --config tests/playwright.config.js ${specs}${/--project=/.test(specs) ? '' : ' --project=desktop'} --reporter=line`, SCRATCH);
  // An interrupted run is never a result: not CAUGHT, not MISSED.
  if (STOP || signal || code === 130 || code === 143 || /\d+ interrupted/.test(out)) interrupted(STOP || signal || 'SIGINT');
  // EXT17: only Playwright's own summary lines count ("  1 failed", "  3 passed (12s)");
  // a test's error text such as "seed 1711 failed at step 3" used to be read as the count.
  const plain = out.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); // terminal escape codes start some lines
  const failed = (plain.match(/^\s*(\d+) failed\s*$/m) || [])[1];
  const passed = (plain.match(/^\s*(\d+) passed\b/m) || [])[1];
  // EXT19: no test ran at all (spec failed to load, a file it reads is missing,
  // wrong filter) is neither caught nor missed: it says so.
  results.push([name, failed ? `CAUGHT (${failed} failed, ${passed || 0} passed)` : !passed ? 'NO TEST RAN (spec did not load or filter matched nothing): ' + (plain.match(/Error: [^\n]*/) || ['no error text'])[0].slice(0, 160) : `NOT CAUGHT (${passed} passed)`]);
  fs.writeFileSync(PROGRESS, JSON.stringify({ done: results.length, results }, null, 1));
}
} catch (e) {
  if (killedBySignal(e) || STOP) interrupted(STOP || e.signal || 'SIGINT');
  cleanScratch();
  throw e;
}
cleanScratch();
if (treeState() !== TREE_BEFORE) { console.error('WORKING TREE CHANGED DURING THE MUTATION RUN — investigate before trusting anything'); process.exitCode = 2; }
for (const [n, r] of results) console.log((r.startsWith('CAUGHT') ? 'OK   ' : 'MISS ') + n + ' → ' + r);
// Non-zero exit when any mutation was missed or could not be applied (e.g. a
// helper moved to another file), so a stale harness can't pass quietly.
if (results.some(([, r]) => !r.startsWith('CAUGHT'))) process.exitCode = 1;
})();
