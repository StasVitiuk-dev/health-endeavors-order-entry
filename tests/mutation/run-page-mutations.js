// Mutation check for the page-side safety guards (2026-10-06, backlog TQ-02).
// For each mutation: copy the repository into a scratch git worktree, break
// ONE guard on purpose, run the tests aimed at it, and report whether they
// failed (= the tests really protect that guard). The real files are never
// touched. Usage (from the repo root):
//   node tests/mutation/run-page-mutations.js [scratch-dir]
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRATCH = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'he-mutations'));

// [name, file, exact text to find, replacement, specs + grep]
const MUTATIONS = [
  // ---- EXT4 additions (2026-10-06) ----
  ['feature request advances from the database status, not the one shown (stale tab could jump to done)', 'owner-login.html',
    "{ status: nextStatus, updated_at: new Date().toISOString() }, { status: shown });", "{ status: nextStatus, updated_at: new Date().toISOString() }, {});",
    'state-transitions-2 -g "feature request \\"Mark"'],
  ['expense Restore without the "still deleted" condition', 'owner-login.html',
    "from('expenses').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null)", "from('expenses').update({ deleted_at: null }).eq('id', id)",
    'state-transitions-2 -g "expense Restore"'],
  ['gateway error page shown as raw HTML again', 'assets/owner-login-helpers.js',
    'if (html !== -1) {', 'if (false) {',
    'fault-injection-2 -g "gateway502"'],
  ['manual order retry matches on the total only (changed lines silently dropped)', 'manual-order-entry.html',
    'if (pending && pending.fingerprint === fingerprint) {', 'if (pending) {',
    'manual-order-entry -g "same total"'],
  ['manual order reuses an order number another tab already has', 'manual-order-entry.html',
    'if (!taken || !taken.length) orderNumber = candidate;', 'orderNumber = candidate;',
    'manual-order-entry -g "same second"'],
  ['manual order: Enter while saving submits twice', 'manual-order-entry.html',
    'if (saving) return; // Enter pressed again', 'void 0; // Enter pressed again',
    'manual-order-entry -g "Enter pressed"'],
  ['product delete restores the stock row without looking (deleted product gets a stray row)', 'owner-login.html',
    'if (!stillThere) { prodGone = [{ id }]; error = null; }', '',
    'session-expiry-midway -g "WAS deleted"'],
  ['receive expense dated with the UTC day again', 'owner-login.html',
    'expense_date: localDateString(new Date()), // Central calendar day', 'expense_date: new Date().toISOString().slice(0, 10), // Central calendar day',
    'po-receive -g "Sept 30"'],
  ['Accounting expense range uses a UTC slice again', 'owner-login.html',
    "if (start) q = q.gte('expense_date', localDateString(start));\n          return q;", "if (start) q = q.gte('expense_date', start.toISOString().slice(0, 10));\n          return q;",
    'timezone-contract'],
  ['PO grand total not rounded to cents', 'assets/owner-login-helpers.js',
    'return Math.round((poLinesTotal(po) + Number(po.shipping_cost || 0) + Number(po.tax || 0)) * 100) / 100;', 'return poLinesTotal(po) + Number(po.shipping_cost || 0) + Number(po.tax || 0);',
    'helpers-unit -g "whole cents"'],
  ['money decimals rule removed (10.009 accepted)', 'assets/owner-login-helpers.js',
    'if (!o.integer && o.decimals !== undefined) {', 'if (false) {',
    'failure-recovery -g "10.009"'],
  ['1,000-row notice never shown', 'owner-login.html',
    'if (Array.isArray(rows) && rows.length >= ROW_CAP) noteRowCap(', 'if (false) noteRowCap(',
    'scale-matrix -g "notice"'],
  ['Emergency stops before switching off Order Sync when the mode is not recorded', 'owner-login.html',
    'if (modeProblem && !protective) {', 'if (modeProblem) {',
    'admin-pages -g "Emergency when"'],
  ['dialog focus trap removed', 'owner-login.html',
    "const open = Array.from(document.querySelectorAll('[role=\"dialog\"][aria-modal=\"true\"]')).filter(shown);", 'const open = [];',
    'a11y-basics -g "stay inside"'],
  ['procedure form double-submit lock removed', 'owner-login.html',
    'if (submitBtn && submitBtn.disabled) return;', '',
    'write-path-inventory -g "Procedures"'],
  ['refund amount checks removed', 'owner-login.html',
    "const refundProblem = numberInputError(raw, { label: 'The refund amount', allowBlank: true, max: 1000000, decimals: 2 });", "const refundProblem = '';",
    'failure-recovery -g "refund of"'],
  // ---- EXT3 additions (2026-10-06) ----
  ['return decision ignores the status shown (stale tab could re-open a return)', 'owner-login.html',
    "const changed = await updateIfUnchanged('returns', id, patch, { status: 'requested' });", "const changed = await updateIfUnchanged('returns', id, patch, {});",
    'state-transitions -g "return \\"(Approve|Reject)\\""'],
  ['task button ignores the allowed starting statuses', 'owner-login.html',
    "          .in('status', allowedFrom)\n", '',
    'state-transitions -g "task"'],
  ['purchase-order status button ignores the allowed starting statuses', 'owner-login.html',
    "const changed = await updateIfUnchanged('purchase_orders', po.id, patch, { status: allowedFrom, deleted_at: null });", "const changed = await updateIfUnchanged('purchase_orders', po.id, patch, { deleted_at: null });",
    'state-transitions -g "purchase order"'],
  ['product edit form overwrites a status changed elsewhere (X3-01)', 'owner-login.html',
    ".eq('status', row.getAttribute('data-status'))", '',
    'pages-data -g "stale edit form|saving a product"'],
  ['order Restore without the "still deleted" condition (X3-02)', 'owner-login.html',
    "from('orders').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null)", "from('orders').update({ deleted_at: null }).eq('id', id)",
    'pages-data -g "Restore"'],
  ['Expenses total summed from the 200 listed only (X3-03)', 'owner-login.html',
    'const total = allAmounts.reduce(', 'const total = (rows || []).reduce(',
    'second-pass-fixes -g "Expenses"'],
  ['Returns list cut at the newest 200 again (X3-04)', 'owner-login.html',
    'return q.order(\'created_at\', { ascending: false }).limit(closed ? CLOSED_CAP : OPEN_CAP);', 'return q.order(\'created_at\', { ascending: false }).limit(closed ? CLOSED_CAP : 0);',
    'second-pass-fixes -g "Returns"'],
  ['typed numbers: infinity / text no longer refused (X3-05/06)', 'assets/owner-login-helpers.js',
    "if (!Number.isFinite(n)) return label + ' must be a plain number: digits and one decimal point only (no $, commas, spaces or words), for example 1200.50.';", '',
    'helpers-unit -g "numberInputError"'],
  ['negative shipping accepted again (X3-06)', 'owner-login.html',
    "const totalsProblem = numberInputError(box.querySelector('.poShipping').value", "const totalsProblem = '' && numberInputError(box.querySelector('.poShipping').value",
    'second-pass-fixes -g "negative shipping"'],
  ['dropped connection shown as raw "Failed to fetch" again', 'assets/owner-login-helpers.js',
    'if (/Failed to fetch|Load failed|NetworkError when attempting to fetch/i.test(t)', 'if (false',
    'fault-injection -g "dropAfter|dropBefore"'],
  ['signed out in another tab: dashboard stays open', 'owner-login.html',
    "if (event !== 'SIGNED_OUT' || signingOutHere || dash.style.display !== 'flex') return;", 'return;',
    'session-failures -g "another tab"'],
  ['manual order retry creates a second order again', 'manual-order-entry.html',
    'if (already && already.length) newOrder = already[0];', 'if (false) newOrder = already[0];',
    'manual-order-entry -g "SAME order|no second order"'],
  ['manual order retry adds the items twice', 'manual-order-entry.html',
    'if (!itemCount) {', 'if (true) {',
    'manual-order-entry -g "items twice"'],
  ['employee may save the stock threshold (role check removed)', 'owner-login.html',
    "if (!canChangeStock()) { showDashError('Only the Owner or an Administrator can change stock settings. Nothing was changed.'); return; }", '',
    'role-matrix -g "low-stock"'],
  ['sold product can be deleted again (X3-13)', 'owner-login.html',
    'if (soldCount) {', 'if (false) {',
    'product-lifecycle -g "sold"'],
  ['search Enter prefers a Guide over the named page again', 'owner-login.html',
    'if (named) { showPage(named.id); return; }', '',
    'general -g "page name"'],
  ['CSV formula guard removed (=, +, -, @ run as formulas)', 'assets/owner-login-helpers.js',
    "if (/^[=+\\-@\\t\\r]/.test(s) && !/^[-+]?\\$?[\\d,]+(\\.\\d+)?%?$/.test(s)) s = \"'\" + s;", '',
    'csv-export-guard'],
  ['refund larger than the order line accepted', 'owner-login.html',
    'amount > lineValue + 0.005', 'false',
    'failure-recovery -g "refund above the order line"'],
  ['Emergency follow-up: column-not-found fallback removed (X3-17)', 'owner-login.html',
    "if (flagErr && (String(flagErr.code) === 'PGRST204'", "if (false && (String(flagErr.code) === 'PGRST204'",
    'admin-pages -g "no who/when columns"'],
  ['business rule save ignores what the page showed (MU-14)', 'owner-login.html',
    "shown === 'null' ? { config: null } : { config: shown });", '{});',
    'admin-pages -g "MU-14"'],
  ['stale guard dropped (updateIfUnchanged ignores the expected values)', 'owner-login.html',
    'Object.keys(expected || {}).forEach(col => {', 'Object.keys({}).forEach(col => {',
    'ops-findings purchase-orders guarded-toggles -g "stale|already|only from|only while"'],
  ['silent refusals accepted (noRowsChanged always false)', 'assets/owner-login-helpers.js',
    'function noRowsChanged(data){ return !data || (Array.isArray(data) && data.length === 0); }', 'function noRowsChanged(data){ return false; }',
    'pages-data double-submit-stale admin-pages -g "quietly refuses|could not really|was NOT"'],
  ['paging stops after the first page (fetchAllRows)', 'owner-login.html',
    'if (total !== null ? rows.length >= total : batch.length < PAGE) return rows;', 'return rows;',
    'report-totals -g "2,500|1,001|10,000"'],
  ['permission pre-check removed (canChangeStock always true)', 'owner-login.html',
    "function canChangeStock(){ return currentUserRole === 'owner' || currentUserRole === 'administrator'; }", 'function canChangeStock(){ return true; }',
    'query-a-fixes inventory-safety -g "employee"'],
  ['second press removed (confirmSecondPress always true)', 'assets/owner-login-helpers.js',
    "if (btn.dataset.armed === '1') { btn.dataset.armed = '0'; return true; }", 'return true;',
    'failure-recovery ops-findings purchase-orders -g "first press|Confirm refund|second press"'],
  ['upload cleanup skipped (refused record leaves the file)', 'owner-login.html',
    'const { error: cleanupErr } = await supabase.storage.from(bucket).remove([path]);', 'const cleanupErr = null;',
    'storage-safety query-a-fixes -g "removed again|no longer leaves|before the record was saved"'],
  ['upload keeps a file even when nothing was saved (network check inverted)', 'owner-login.html',
    'if (!checkErr && saved) return;', 'if (!checkErr) return;',
    'storage-safety -g "before the record was saved"'],
  ['file names not cleaned (safeStorageName identity)', 'assets/owner-login-helpers.js',
    "let n = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')", "let n = String(name || 'file')",
    'storage-safety -g "hostile or very long"'],
  ['escaping broken (esc returns raw text)', 'assets/owner-login-helpers.js',
    ".replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));", ';',
    'xss-everywhere -g "every text field|no database text"'],
  ['Emergency follow-up failures hidden again', 'owner-login.html',
    'if (leftOn.length) {', 'if (false) {',
    'admin-pages -g "could not really"'],
  ['document categories widened back to the old list', 'owner-login.html',
    "      license: 'License / Permit',", "      license: 'License / Permit',\n      invoice: 'Invoice',",
    'state-machine query-a-fixes -g "categor"'],
];

function sh(cmd, cwd) { return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }

function fixHelpersHash(dir) {
  const bytes = fs.readFileSync(path.join(dir, 'assets', 'owner-login-helpers.js'));
  const v = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  const p = path.join(dir, 'owner-login.html');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/assets\/owner-login-helpers\.js\?v=[0-9a-f]{10}/, 'assets/owner-login-helpers.js?v=' + v));
}

const results = [];
for (const [name, file, find, repl, specs] of MUTATIONS) {
  try { sh(`git worktree remove --force "${SCRATCH}"`, ROOT); } catch (e) { /* not there */ }
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  sh(`git worktree add --detach "${SCRATCH}" HEAD`, ROOT);
  // the working tree's current test files and page (may be ahead of HEAD)
  for (const f of ['owner-login.html', 'assets/owner-login-helpers.js', 'manual-order-entry.html', 'index.html', 'search.html', 'dashboard.html']) fs.copyFileSync(path.join(ROOT, f), path.join(SCRATCH, f));
  fs.rmSync(path.join(SCRATCH, 'tests'), { recursive: true, force: true });
  sh(`cp -r "${path.join(ROOT, 'tests')}" "${path.join(SCRATCH, 'tests')}"`, ROOT);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(SCRATCH, 'node_modules'));
  const target = path.join(SCRATCH, file);
  const src = fs.readFileSync(target, 'utf8');
  if (!src.includes(find)) { results.push([name, 'MUTATION NOT APPLIED (text not found)']); continue; }
  // EXT4: the text must be unique, or the wrong copy could be broken.
  if (src.split(find).length !== 2) { results.push([name, 'MUTATION NOT APPLIED (text found more than once)']); continue; }
  fs.writeFileSync(target, src.replace(find, repl));
  if (file.startsWith('assets/')) fixHelpersHash(SCRATCH);
  let out = '';
  try { out = sh(`npx playwright test --config tests/playwright.config.js ${specs} --project=desktop --reporter=line`, SCRATCH); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const failed = (out.match(/(\d+) failed/) || [])[1];
  const passed = (out.match(/(\d+) passed/) || [])[1];
  results.push([name, failed ? `CAUGHT (${failed} failed, ${passed || 0} passed)` : `NOT CAUGHT (${passed || 0} passed)`]);
}
try { sh(`git worktree remove --force "${SCRATCH}"`, ROOT); } catch (e) { /* ignore */ }
for (const [n, r] of results) console.log((r.startsWith('CAUGHT') ? 'OK   ' : 'MISS ') + n + ' → ' + r);
// Non-zero exit when any mutation was missed or could not be applied (e.g. a
// helper moved to another file), so a stale harness can't pass quietly.
if (results.some(([, r]) => !r.startsWith('CAUGHT'))) process.exitCode = 1;
