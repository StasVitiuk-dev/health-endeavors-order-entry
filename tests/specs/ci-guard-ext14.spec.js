// EXT14: the CI workflow can only test. It must never deploy, publish Pages,
// use a secret, reach production, check out another repository, or skip a
// required check because of a clever change-impact rule. Node-only.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const WF_DIR = path.join(ROOT, '.github', 'workflows');
const workflows = fs.readdirSync(WF_DIR).filter(f => /\.ya?ml$/.test(f));
const read = f => fs.readFileSync(path.join(WF_DIR, f), 'utf8');
const code = t => t.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');   // comments may mention forbidden words
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('only the tests-only workflow exists', () => {
  expect(workflows).toEqual(['ci.yml']);
});

for (const f of workflows) {
  test(`${f}: least privilege, no secrets, no deploy, no production, no other repositories`, () => {
    const t = read(f), c = code(t);
    expect(c).toMatch(/^permissions:\n  contents: read\n/m);
    expect(c.match(/^\s*permissions:/gm).length, 'permissions set once, at the top').toBe(1);
    expect(c).not.toMatch(/\bsecrets\./);
    expect(c).not.toMatch(/GITHUB_TOKEN|github\.token/);
    expect(c).not.toMatch(/pull_request_target|workflow_run/);
    expect(c).not.toMatch(/id-token|pages:|deployments:|environment:/);
    expect(c).not.toMatch(/deploy-pages|configure-pages|upload-pages-artifact|gh-pages|peaceiris/i);
    expect(c).not.toMatch(/supabase\.co|supabase\.com|shopify|myshopify|gmail/i);
    expect(c).not.toMatch(/health-endeavors-backups|real-estate|website/i);
    expect(c).not.toMatch(/^\s*repository:/m);
    expect(c).not.toMatch(/\bgit push\b|\bgh \b|curl |wget /);
  });

  test(`${f}: only GitHub-made actions, every checkout without stored credentials`, () => {
    const c = code(read(f));
    const uses = [...c.matchAll(/uses:\s*([^\s]+)/g)].map(m => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    // EXT15: pinned to a full commit SHA (verified from GitHub), never a moving tag or branch.
    for (const u of uses) expect(u, u).toMatch(/^actions\/(checkout|setup-node|upload-artifact|cache)@[0-9a-f]{40}$/);
    for (const line of read(f).split('\n').filter(l => /uses:/.test(l))) expect(line, line).toMatch(/# v\d+\.\d+\.\d+ /);
    const checkouts = (c.match(/uses:\s*actions\/checkout@/g) || []).length;
    expect((c.match(/persist-credentials:\s*false/g) || []).length).toBe(checkouts);
  });

  test(`${f}: every job has a time limit; artifacts are small and short-lived`, () => {
    const c = code(read(f));
    const jobs = c.split('\njobs:\n')[1].split(/\n  (?=[a-z][\w-]*:\n)/).map(s => s.trim()).filter(Boolean);
    expect(jobs.length).toBeGreaterThan(2);
    for (const j of jobs) expect(j, j.split('\n')[0]).toMatch(/timeout-minutes:\s*\d+/);
    for (const m of c.matchAll(/retention-days:\s*(\d+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(7);
    expect(c).toMatch(/path: test-results\//);
    expect(c).not.toMatch(/path: \.|path: docs|path: \*\*/);
  });
}

test('the database job only talks to its own throwaway service, and the runner refuses Supabase', () => {
  const c = code(read('ci.yml'));
  expect(c).toMatch(/run-db-suite\.sh -h localhost -p 5432/);
  const runner = fs.readFileSync(path.join(ROOT, 'tests', 'tools', 'run-db-suite.sh'), 'utf8');
  expect(runner).toMatch(/supabase\.co\*\|\*pooler\.supabase\*\) echo "Refusing/);
});

test('change impact is conservative: only documentation can skip the browser suite', () => {
  const { decide } = require('../tools/ci-impact');
  expect(decide([])).toMatchObject({ browser: true, db: true });
  expect(decide(null)).toMatchObject({ browser: true, db: true });
  expect(decide(['docs/ops/START_HERE_EXT13.md', 'design-review/x/a.png'])).toMatchObject({ browser: false, db: false });
  for (const f of ['owner-login.html', 'assets/owner-login.css', 'assets/owner-login-helpers.js', 'tests/specs/po-receive.spec.js', 'package.json', '.github/workflows/ci.yml', 'manual-order-entry.html'])
    expect(decide(['README.md', f]).browser, f).toBe(true);
  expect(decide(['docs/ops/sql/drafts/10_DRAFT_stock_functions.sql']).db).toBe(true);
  expect(decide(['docs/ops/sql/README.md']).browser, 'a doc inside the SQL folder still runs everything').toBe(true);
  expect(decide(['owner-login.html']).db).toBe(false);
});

// EXT15: on GitHub a docs-only push cancelled the run of the code push before it
// (concurrency) and then skipped the browser suite. Pushes compare with main.
test('change impact compares a push with main, never only with the previous push', () => {
  const wf = fs.readFileSync(path.join(WF_DIR, 'ci.yml'), 'utf8');
  const line = wf.split('\n').find(l => /ci-impact\.js/.test(l) && /run:/.test(l));
  expect(line).toContain("github.event.pull_request.base.sha || 'origin/main'");
  expect(line).not.toContain('github.event.before');
  expect(wf).toMatch(/fetch-depth: 0/);
});

test('the secret scanner finds planted credentials and passes on the real tree', () => {
  const S = require('../tools/secret-scan');
  const fakeJwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', 'abcdefghijklmnop'].join('.');
  for (const t of [fakeJwt, 'ghp_' + 'A'.repeat(36), 'sk_' + 'live_' + '9'.repeat(16), '-----BEGIN ' + 'PRIVATE KEY-----', 'postgres://admin:hunter2' + '@' + 'db.example.com:5432/x', 'sb_' + 'secret_' + 'x'.repeat(20)])
    expect(S.scanText(t).length, t.slice(0, 12)).toBeGreaterThan(0);
  expect(S.scanText('const SUPABASE_ANON_KEY = "sb_publishable_abc"; postgres://postgres:ci-only-local@localhost:5432')).toEqual([]);
  const { execFileSync } = require('child_process');
  expect(execFileSync(process.execPath, [path.join(ROOT, 'tests', 'tools', 'secret-scan.js')], { cwd: ROOT, encoding: 'utf8' })).toMatch(/^OK:/m);
});

test('a local command reproduces the CI sequence', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  expect(pkg.scripts['ci:local']).toBe('bash tests/tools/ci-local.sh');
  const sh = fs.readFileSync(path.join(ROOT, 'tests', 'tools', 'ci-local.sh'), 'utf8');
  for (const step of ['secret-scan.js', 'sql-lint.js', 'doc-check.js --current', 'run-db-suite.sh', '--ignore-snapshots']) expect(sh).toContain(step);
});

// EXT15: the static job installs no browser (PR #29's CI was red because a
// browser spec, safety.spec.js, sat in this list). Every spec named there must
// be Node-only: it may not load the dashboard fixture, which starts a browser.
test('the static job runs only Node-only specs (no browser is installed there), and ci-local runs the same list', () => {
  const wf = fs.readFileSync(path.join(WF_DIR, 'ci.yml'), 'utf8');
  const line = wf.split('\n').find(l => /Node-only specs/.test(l));
  const run = wf.split('\n')[wf.split('\n').indexOf(line) + 1];
  const listed = (run.match(/tests\/specs\/[\w.-]+\.spec\.js/g) || []);
  expect(listed.length).toBeGreaterThan(5);
  for (const f of listed) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(src, f).not.toMatch(/require\('\.\.\/helpers\/dashboard'\)/);
    expect(src, f).not.toMatch(/async \(\{[^}]*\bpage\b/);
  }
  const local = fs.readFileSync(path.join(ROOT, 'tests', 'tools', 'ci-local.sh'), 'utf8');
  expect((local.match(/tests\/specs\/[\w.-]+\.spec\.js/g) || []).sort()).toEqual(listed.slice().sort());
  expect(local).toMatch(/PLAYWRIGHT_BROWSERS_PATH=\/nonexistent/);
});
