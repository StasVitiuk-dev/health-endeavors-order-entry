// Secret scan (EXT14). Looks through every tracked text file for things that
// look like real credentials. The public Supabase publishable (anon) key in the
// pages is public by design and allowed. Deliberately fake tokens used to prove
// that tools refuse secrets live only in the allow-listed test files.
//
//   node tests/tools/secret-scan.js            scan tracked files (exit 1 on any finding)
//   node tests/tools/secret-scan.js <dir>      scan every file under a folder (e.g. a staging build)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PATTERNS = [
  ['JWT-shaped token', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase secret / service key', /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ['service_role key assignment', /service_role["'\s:=]+["'][A-Za-z0-9._-]{20,}/i],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['Stripe live key', /\b[sr]k_live_[A-Za-z0-9]{10,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['private key', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['database URL with password', /postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]{3,}@(?!localhost|127\.0\.0\.1)/],
  ['Shopify token', /\bshp(at|ss|ca|pa)_[a-f0-9]{20,}/],
];
// Files that hold deliberately fake tokens to prove the tools refuse them.
const ALLOW = new Set(['tests/fixtures/evidence-samples.js', 'tests/specs/evidence-ext12.spec.js', 'tests/tools/secret-scan.js',
  'tests/specs/ci-guard-ext14.spec.js', 'tests/specs/staging-artifact-ext14.spec.js', 'tests/specs/diagnostics-ext14.spec.js']);
const BINARY = /\.(png|jpe?g|gif|ico|pdf|zip|woff2?|ttf)$/i;

function scanText(text) {
  const hits = [];
  for (const [name, re] of PATTERNS) { const m = text.match(re); if (m) hits.push(name); }
  return hits;
}
function scanFiles(files, base) {
  const findings = [];
  for (const f of files) {
    if (BINARY.test(f) || ALLOW.has(f)) continue;
    let t; try { t = fs.readFileSync(path.join(base, f), 'utf8'); } catch (e) { continue; }
    for (const h of scanText(t)) findings.push(f + ': ' + h);
  }
  return findings;
}
function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]);
}
module.exports = { scanText, scanFiles, PATTERNS, ALLOW };

if (require.main === module) {
  const dir = process.argv[2];
  const files = dir ? walk(path.resolve(dir)) : execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const findings = scanFiles(files, dir ? path.resolve(dir) : ROOT);
  for (const f of findings) console.log('SECRET? ' + f);
  console.log(findings.length ? findings.length + ' finding(s).' : 'OK: ' + files.length + ' files scanned, no credential-like text.');
  process.exitCode = findings.length ? 1 : 0;
}
