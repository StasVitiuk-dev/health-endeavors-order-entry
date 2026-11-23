// EXT18: supply chain, package scripts and the secret firewall.
//   * dependencies: exact versions, lockfile from the public npm registry with
//     sha512 integrity, matching package.json; no install-time scripts of ours;
//     only the known optional macOS package has an install script, and CI
//     installs with --ignore-scripts anyway
//   * package scripts: no lifecycle hooks, no deploy / publish / production command
//   * secret scanner: fires on each kind of fake key (built at run time so this
//     file holds none), on secret-holding file names, and the repository has none
// Node only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');
const S = require('../tools/secret-scan');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only checks; once'); });

test('dependencies are exact versions, locked, from the npm registry with sha512 integrity', () => {
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  expect(Object.keys(all).length).toBeGreaterThan(0);
  for (const [name, v] of Object.entries(all)) {
    expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
    expect(lock.packages['node_modules/' + name].version, name).toBe(v);
  }
  expect(lock.lockfileVersion).toBe(3);
  for (const [k, p] of Object.entries(lock.packages)) {
    if (!k || p.link) continue;
    expect(p.resolved, k).toMatch(/^https:\/\/registry\.npmjs\.org\//);
    expect(p.integrity, k).toMatch(/^sha512-/);
  }
});

test('no install-time code runs: no lifecycle scripts of ours, only the known optional package has one, CI ignores scripts', () => {
  const HOOKS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'prepack', 'postpack', 'preuninstall', 'postuninstall'];
  for (const h of HOOKS) expect(pkg.scripts[h], h).toBeUndefined();
  const withScripts = Object.entries(lock.packages).filter(([, p]) => p.hasInstallScript).map(([k]) => k);
  expect(withScripts).toEqual(['node_modules/fsevents']); // macOS-only optional file watcher; never installed on Linux CI
  expect(lock.packages['node_modules/fsevents'].optional).toBe(true);
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const installs = wf.match(/npm (ci|install)[^\n]*/g) || [];
  expect(installs.length).toBeGreaterThan(0);
  for (const i of installs) expect(i).toContain('--ignore-scripts');
  expect(fs.readFileSync(path.join(ROOT, 'tests/tools/ci-local.sh'), 'utf8')).toContain('npm ci --ignore-scripts');
});

test('package scripts: nothing deploys, publishes or reaches production', () => {
  const BAD = /\b(deploy|publish|gh-pages|supabase\s+(db|functions|link|push)|psql\b(?![^\n]*localhost)|curl|wget|ssh|scp|rsync|git\s+push|npm\s+publish)\b/i;
  // the one deploy-shaped name is the offline simulator, which only reads files
  const OFFLINE_SIM = ['deploy:sim', 'node tests/tools/deploy-sim.js'];
  for (const [k, v] of Object.entries(pkg.scripts)) {
    if (k === OFFLINE_SIM[0] && v === OFFLINE_SIM[1]) continue;
    expect(v, k).not.toMatch(BAD);
    expect(k, 'script name').not.toMatch(/deploy|publish|release|prod/i);
  }
  expect(pkg.scripts[OFFLINE_SIM[0]]).toBe(OFFLINE_SIM[1]);
  expect(fs.readFileSync(path.join(ROOT, 'tests/tools/deploy-sim.js'), 'utf8')).not.toMatch(/\b(fetch|https?\.request|child_process)\b/);
});

test('secret scanner fires on each kind of fake key and on secret-holding file names', () => {
  const r = n => 'A1b2C3d4E5f6G7h8'.repeat(4).slice(0, n);
  const fakes = {
    'Anthropic API key': 'sk-' + 'ant-' + r(40),
    'OpenAI-style API key': 'sk' + '-proj-' + r(40),
    'Google API key': 'AI' + 'za' + r(35),
    'npm token': 'np' + 'm_' + r(36),
    'GitHub token': 'gh' + 'p_' + r(36),
    'JWT-shaped token': 'ey' + 'J' + r(20) + '.ey' + 'J' + r(20) + '.' + r(20),
    'Supabase secret / service key': 'sb_' + 'secret_' + r(20),
    'service-role key assignment': 'service' + '_role: "' + r(30) + '"',
  };
  for (const [kind, text] of Object.entries(fakes)) expect(S.scanText('x = ' + text), kind).toContain(kind);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-secret-'));
  try {
    for (const f of ['.env', '.env.production', 'deploy/server.pem', 'id_rsa', '.npmrc', 'service-account-prod.json', '.env.example', 'notes.txt']) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), 'SYNTHETIC=1\n');
    }
    const out = (() => { try { execFileSync(process.execPath, [path.join(ROOT, 'tests/tools/secret-scan.js'), dir], { encoding: 'utf8' }); return ''; } catch (e) { return e.stdout; } })();
    for (const f of ['.env', '.env.production', 'deploy/server.pem', 'id_rsa', '.npmrc', 'service-account-prod.json']) expect(out, f).toContain(f + ': secret-holding file name');
    expect(out).not.toContain('.env.example');
    expect(out).not.toContain('notes.txt');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the repository tracks no secret-holding file, and .gitignore keeps them out', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  expect(tracked.filter(f => S.SECRET_FILE.test(f))).toEqual([]);
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  for (const p of ['.env', '.env.*', '*.pem', '*.key']) expect(gi.split('\n')).toContain(p);
});
