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
    "return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));", 'return String(s);',
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
  for (const f of ['owner-login.html', 'assets/owner-login-helpers.js']) fs.copyFileSync(path.join(ROOT, f), path.join(SCRATCH, f));
  fs.rmSync(path.join(SCRATCH, 'tests'), { recursive: true, force: true });
  sh(`cp -r "${path.join(ROOT, 'tests')}" "${path.join(SCRATCH, 'tests')}"`, ROOT);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(SCRATCH, 'node_modules'));
  const target = path.join(SCRATCH, file);
  const src = fs.readFileSync(target, 'utf8');
  if (!src.includes(find)) { results.push([name, 'MUTATION NOT APPLIED (text not found)']); continue; }
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
