// EXT20J Reserve VII: branch archaeology. The feature branch is ~458 commits
// ahead of main — too large to review commit-by-commit by eye. This tool reads
// `git log <merge-base>..HEAD` with the files each commit touched and classifies
// every commit along axes a reviewer (and a non-technical owner) actually needs:
//
//   type      EXECUTABLE | TEST | DOCS | GENERATED | MIXED | OTHER
//             (what KIND of file changed — the safety-relevant split)
//   category  SECURITY, TRUSTED_TYPES, CALENDAR, ... (which subsystem)
//   risk      HIGH | MEDIUM | LOW (does it touch auth/writes/security/money/...
//             in shipped code?)
//   ownerVisible  did shipped HTML / app JS / CSS change? (owner can SEE it)
//
// Classification is from the commit SUBJECT plus the set of changed PATHS, so it
// does not depend on the (inconsistent) commit-message prefixes. It is pure given
// the git data, so the spec can feed it fixed input and assert exact output.
//
//   node tests/tools/branch-archaeology.js            -> markdown summary
//   node tests/tools/branch-archaeology.js --json      -> full JSON
//   node tests/tools/branch-archaeology.js --base <sha> -> override merge-base
//
// No network, no production, read-only git.
const { execFileSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// The shipped, executable surface of the dashboard — code the browser runs.
function isExecutable(f) {
  if (f.startsWith('assets/') && (f.endsWith('.js') || f.endsWith('.css'))) return true;
  if (/^[^/]+\.html$/.test(f)) return true;
  return false;
}
function isTest(f) {
  // tests/tools is engineering TOOLING, not browser code and not a behavioural
  // test; it still gates the build, so it counts as test-infra here.
  return f.startsWith('tests/');
}
function isDocs(f) {
  return f.startsWith('docs/') || f.startsWith('design-review/') || (/\.md$/.test(f) && !f.startsWith('tests/'));
}
// Generated artifacts: produced by a tool from source, not hand-edited. Kept
// narrow and explicit so "generated" never silently swallows a real edit.
function isGenerated(f) {
  return /APPLICATION_MODULE_MAP|WRITE_PATH|write-path|MATRIX|module-map|asset-versions|\.snapshots?\//i.test(f)
    || f.endsWith('package-lock.json');
}

// Subsystem categories, tried in order; first match wins. Path hits are stronger
// than subject hits, so paths are checked first for the unambiguous ones.
const CATEGORY_RULES = [
  ['TRUSTED_TYPES', /\btt\b|trusted.?types|innerHTML|dom.?sink|dom.?builder|he-ui\b/i, null],
  ['CALENDAR', /calendar|calColors|colorForCalendar/i, /calendar/i],
  ['SECURITY', /security|xss|csp|secret|supply.?chain|prototype|redos|sri\b|frame.?guard/i, /security|csp|xss|supply-chain|static-security/i],
  ['AUTHORIZATION', /\brole|permission|authoriz|rls\b|guard(ed)?.?(toggle|mutation|state)/i, /role-matrix|guarded|authoriz/i],
  ['AUTH', /\bauth\b|login|session|logout|reauth|password/i, /auth|login|session|reauth/i],
  ['INVENTORY', /inventory|stock|restock|reconcil/i, /inventory|stock/i],
  ['RETURNS', /\breturn(s)?\b|refund|recall/i, /return|refund|recall/i],
  ['PURCHASE_ORDERS', /purchase.?order|\bpo\b|receive/i, /purchase-order|po-receive/i],
  ['APPROVALS', /approv/i, /approv/i],
  ['AGENTS', /\bagent|automation|cron|nightly/i, /agent|automation|nightly/i],
  ['AUDIT', /audit/i, /audit|evidence/i],
  ['ACCOUNTING', /accounting|money|tax|expense|precision|cent/i, /accounting|money|tax|expense|precision|numeric/i],
  ['ACCESSIBILITY', /a11y|accessib|aria|screen.?reader|keyboard|focus/i, /a11y|accessib|zoom|device-matrix/i],
  ['RESPONSIVE', /responsive|mobile|phone|layout|width|zoom/i, /responsive|mobile|phone|layout|width|shrink/i],
  ['PERFORMANCE', /perf|performance|scale|soak|memory|leak/i, /perf|scale|soak|performance|resource-leak/i],
  ['SEARCH', /\bsearch\b|palette|command.?palette/i, /search|palette/i],
  ['HOME', /\bhome\b|attention|control.?center|dashboard summary/i, /attention|owner-control|home/i],
  ['SQL_PACKAGE', /\bsql\b|query [a-h]\b|schema|migration|definer|function/i, /sql|schema|query-/i],
  ['TEST_INFRA', /\btest|spec|fixture|mock|flak|shard|harness|ci\b/i, /tests\/tools|fixtures|helpers|playwright\.config|ci-/i],
  ['TOOLING', /tool|gate|lint|scanner|generat/i, /tests\/tools/i],
  ['DOCS', /\bdoc(s|umentation)?\b|readme|record|report|runbook|changelog|backlog/i, /^docs\/|^design-review\//i],
];

// A commit is HIGH risk if it changes EXECUTABLE code in a sensitive subsystem.
const HIGH_RISK_CATEGORIES = new Set(['SECURITY', 'AUTH', 'AUTHORIZATION', 'INVENTORY', 'RETURNS',
  'PURCHASE_ORDERS', 'APPROVALS', 'AGENTS', 'AUDIT', 'ACCOUNTING', 'SQL_PACKAGE']);

function classifyType(files) {
  if (!files.length) return 'OTHER';
  if (files.every(isGenerated)) return 'GENERATED';
  if (files.every(isExecutable)) return 'EXECUTABLE';
  if (files.every(f => isTest(f))) return 'TEST';
  if (files.every(f => isDocs(f))) return 'DOCS';
  // Anything spanning more than one kind (e.g. shipped code AND docs, or code AND
  // its test) is MIXED — honest about the fact that it is not a single-kind change.
  return 'MIXED';
}

// The dashboard monolith and its page touch nearly every commit and their NAMES
// ("owner-login...") contain substrings like "login"/"search" that would hijack
// path-based category matching. They are catch-alls, so they never drive the
// category by PATH — the commit subject classifies them instead.
const GENERIC_PATHS = /^(assets\/owner-login-app\.js|assets\/owner-login\.css|owner-login\.html)$/;

function classifyCategory(subject, files) {
  const signalPaths = files.filter(f => !GENERIC_PATHS.test(f)).join('\n');
  for (const [name, subjRe, pathRe] of CATEGORY_RULES) {
    if (pathRe && signalPaths && pathRe.test(signalPaths)) return name;
    if (subjRe && subjRe.test(subject)) return name;
  }
  return 'OTHER';
}

function classifyRisk(type, category, files) {
  const execFiles = files.filter(isExecutable);
  if (execFiles.length && HIGH_RISK_CATEGORIES.has(category)) return 'HIGH';
  if (type === 'EXECUTABLE' || type === 'MIXED') return 'MEDIUM';
  return 'LOW';
}

function ownerVisible(files) {
  // The owner can see a change if shipped HTML, the app JS, or a stylesheet moved.
  return files.some(f => /^[^/]+\.html$/.test(f) || /^assets\/.*\.(js|css)$/.test(f));
}

// Parse `git log ... --name-only` output into [{sha, ts, subject, files}].
function parseLog(raw) {
  const commits = [];
  const blocks = raw.split('COMMIT\x00').slice(1);
  for (const b of blocks) {
    const nl = b.indexOf('\n');
    const header = b.slice(0, nl);
    const [sha, ts, subject] = header.split('\x00');
    const files = b.slice(nl + 1).split('\n').map(s => s.trim()).filter(Boolean);
    commits.push({ sha, ts: Number(ts), subject, files });
  }
  return commits;
}

function classifyAll(commits) {
  return commits.map(c => {
    const type = classifyType(c.files);
    const category = classifyCategory(c.subject, c.files);
    const risk = classifyRisk(type, category, c.files);
    return { sha: c.sha.slice(0, 9), date: new Date(c.ts * 1000).toISOString().slice(0, 10),
      subject: c.subject, files: c.files.length, type, category, risk, ownerVisible: ownerVisible(c.files) };
  });
}

function tally(rows, key) {
  const m = {};
  for (const r of rows) m[r[key]] = (m[r[key]] || 0) + 1;
  return m;
}

function collect(base) {
  const mergeBase = (base || git(['merge-base', 'HEAD', 'origin/main']).trim());
  const head = git(['rev-parse', 'HEAD']).trim();
  const raw = git(['log', `${mergeBase}..HEAD`, '--format=COMMIT%x00%H%x00%ct%x00%s', '--name-only']);
  const rows = classifyAll(parseLog(raw));
  return { mergeBase, head, rows };
}

function toMarkdown({ mergeBase, head, rows }) {
  const L = [];
  L.push('# Branch archaeology', '');
  L.push(`merge-base \`${mergeBase.slice(0, 9)}\` .. HEAD \`${head.slice(0, 9)}\` — ${rows.length} commits`, '');
  L.push('## By type', '');
  for (const [k, v] of Object.entries(tally(rows, 'type')).sort((a, b) => b[1] - a[1])) L.push(`- ${k}: ${v}`);
  L.push('', '## By risk', '');
  for (const k of ['HIGH', 'MEDIUM', 'LOW']) L.push(`- ${k}: ${tally(rows, 'risk')[k] || 0}`);
  L.push('', '## By category', '');
  for (const [k, v] of Object.entries(tally(rows, 'category')).sort((a, b) => b[1] - a[1])) L.push(`- ${k}: ${v}`);
  L.push('', `## Owner-visible commits: ${rows.filter(r => r.ownerVisible).length}`, '');
  L.push('## HIGH-risk commits (shipped code in a sensitive subsystem)', '');
  for (const r of rows.filter(r => r.risk === 'HIGH')) L.push(`- \`${r.sha}\` [${r.category}] ${r.subject}`);
  return L.join('\n');
}

if (require.main === module) {
  const baseArg = process.argv.indexOf('--base');
  const data = collect(baseArg >= 0 ? process.argv[baseArg + 1] : null);
  if (process.argv.includes('--json')) console.log(JSON.stringify(data, null, 2));
  else console.log(toMarkdown(data));
}

module.exports = { isExecutable, isTest, isDocs, isGenerated, classifyType, classifyCategory,
  classifyRisk, ownerVisible, parseLog, classifyAll, tally, collect, toMarkdown,
  CATEGORY_RULES, HIGH_RISK_CATEGORIES };
