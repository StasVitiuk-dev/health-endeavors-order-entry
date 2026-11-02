// EXT14: the page-mutation runner cannot damage the real working tree, even
// when interrupted or pointed at the wrong folder. Node-only; runs no mutants
// (MUT_ONLY matches nothing), so it is quick.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const RUNNER = path.join(ROOT, 'tests', 'mutation', 'run-page-mutations.js');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const run = (scratch, env = {}) => spawnSync(process.execPath, [RUNNER, scratch], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, MUT_ONLY: '^no mutant has this name$', ...env } });

test('refuses a scratch folder inside the repository, or the repository itself, or a parent of it', () => {
  for (const bad of [ROOT, path.join(ROOT, 'tmp-mutants'), path.dirname(ROOT)]) {
    const r = run(bad);
    expect(r.status, bad).not.toBe(0);
    expect(r.stderr, bad).toMatch(/mutation scratch must (be outside|not contain) the repository/);
  }
  expect(fs.existsSync(path.join(ROOT, 'tmp-mutants'))).toBe(false);
});

test('refuses to delete a non-empty folder that is not a mutation scratch folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-not-scratch-'));
  fs.writeFileSync(path.join(dir, 'precious.txt'), 'keep me');
  const r = run(dir);
  expect(r.status).not.toBe(0);
  expect(r.stderr).toMatch(/refusing to delete/);
  expect(fs.readFileSync(path.join(dir, 'precious.txt'), 'utf8')).toBe('keep me');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a clean run leaves no worktree behind and checks the real tree did not change', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'he-scratch-parent-')), 'scratch');
  const r = run(dir);
  expect(r.status, r.stderr).toBe(0);
  expect(fs.existsSync(dir)).toBe(false);
  expect(spawnSync('git', ['worktree', 'list'], { cwd: ROOT, encoding: 'utf8' }).stdout).not.toContain(dir);
  expect(r.stderr).not.toMatch(/WORKING TREE CHANGED/);
});

test('Ctrl-C during a mutant removes the worktree and leaves the real tree untouched', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'he-scratch-parent-')), 'scratch');
  const before = spawnSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: ROOT, encoding: 'utf8' }).stdout;
  // One real mutant; interrupt as soon as its worktree exists. Ctrl-C in a
  // terminal goes to the whole process group (the runner AND its test run).
  const child = spawn(process.execPath, [RUNNER, dir], { cwd: ROOT, detached: true, env: { ...process.env, MUT_ONLY: 'unknown receive outcome no longer locks' } });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  await expect.poll(() => fs.existsSync(path.join(dir, '.he-mutation-scratch')), { timeout: 60000 }).toBe(true);
  process.kill(-child.pid, 'SIGINT');
  const code = await new Promise(r => child.on('exit', c => r(c)));
  expect(code).toBe(130);
  expect(stderr).toMatch(/interrupted \(SIGINT\)/);
  expect(fs.existsSync(dir)).toBe(false);
  expect(spawnSync('git', ['worktree', 'list'], { cwd: ROOT, encoding: 'utf8' }).stdout).not.toContain(dir);
  expect(spawnSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: ROOT, encoding: 'utf8' }).stdout).toBe(before);
});

// EXT16: 17 mutants had silently stopped applying after their code moved
// (found because the Ctrl-C test above waits for one of them). Every mutant's
// text must be in its file exactly once, checked on every run.
test('every mutant still applies: its text is in its file exactly once', () => {
  const r = spawnSync(process.execPath, [RUNNER, '--check'], { cwd: ROOT, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout).toMatch(/ 0 not applicable, 0 duplicate names/);
});
