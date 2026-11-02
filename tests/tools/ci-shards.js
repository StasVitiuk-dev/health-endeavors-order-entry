// EXT15: CI browser shards balanced by measured duration instead of test count.
//   node tests/tools/ci-shards.js --list 2/3     → the spec files of shard 2 of 3 (space-separated)
//   node tests/tools/ci-shards.js --plan 3       → the plan with estimated minutes per shard
//   node tests/tools/ci-shards.js --record r.json → update tests/ci-durations.json from a
//                                                  Playwright JSON report (both projects summed)
// Every spec file is in exactly one shard: a file without a recorded duration
// gets the median, so a new spec can never be left out of CI.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DUR = path.join(ROOT, 'tests', 'ci-durations.json');
const specs = () => fs.readdirSync(path.join(ROOT, 'tests', 'specs')).filter(f => f.endsWith('.spec.js')).sort();

function durations() { return fs.existsSync(DUR) ? JSON.parse(fs.readFileSync(DUR, 'utf8')).seconds : {}; }
function plan(n) {
  const d = durations();
  const known = Object.values(d).sort((a, b) => a - b);
  const median = known.length ? known[known.length >> 1] : 30;
  const files = specs().map(f => ({ f, s: d[f] != null ? d[f] : median })).sort((a, b) => b.s - a.s || a.f.localeCompare(b.f));
  const shards = Array.from({ length: n }, () => ({ total: 0, files: [] }));
  for (const x of files) { const t = shards.reduce((m, s) => (s.total < m.total ? s : m)); t.files.push(x.f); t.total += x.s; } // greedy: longest first
  shards.forEach(s => s.files.sort());
  return shards;
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--list') {
    const [i, n] = a[1].split('/').map(Number);
    if (!(i >= 1 && i <= n)) { console.error('usage: --list i/n'); process.exit(2); }
    process.stdout.write(plan(n)[i - 1].files.map(f => 'tests/specs/' + f).join(' ') + '\n');
  } else if (a[0] === '--plan') {
    plan(Number(a[1] || 3)).forEach((s, k) => console.log(`shard ${k + 1}: ${s.files.length} files, ~${(s.total / 60).toFixed(1)} min of test time`));
  } else if (a[0] === '--record') {
    const j = JSON.parse(fs.readFileSync(a[1], 'utf8'));
    const per = {};
    (function w(s) { for (const x of s.suites || []) w(x); for (const sp of s.specs || []) for (const t of sp.tests) for (const r of t.results) per[sp.file] = (per[sp.file] || 0) + r.duration / 1000; })({ suites: j.suites });
    const out = Object.fromEntries(Object.entries(per).sort().map(([k, v]) => [k, Math.round(v)]));
    fs.writeFileSync(DUR, JSON.stringify({ about: 'Measured test time per spec file (seconds, desktop + iPhone), for balancing CI shards. Regenerate: node tests/tools/ci-shards.js --record <playwright-json-report>.', seconds: out }, null, 1) + '\n');
    console.log('recorded', Object.keys(out).length, 'files');
  } else console.log('usage: --list i/n | --plan n | --record report.json');
}
module.exports = { plan, specs };
