// EXT15 CI traps: each new static check in CI is shown to FAIL on a planted
// problem (a copy of the files in a temp folder; the real tree is untouched),
// so a check that silently passes everything cannot hide in the workflow.
// Node-only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

function sandbox(plant) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'he-trap-'));
  fs.mkdirSync(path.join(tmp, 'tests'));
  for (const d of ['tests/tools', 'tests/specs', 'assets']) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  for (const f of ['owner-login.html', 'tests/ci-durations.json']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
  if (plant) plant(tmp);
  return tmp;
}
const run = (dir, tool, args = []) => spawnSync(process.execPath, [path.join(dir, 'tests', 'tools', tool), ...args], { cwd: dir, encoding: 'utf8' });
const edit = (dir, rel, fn) => { const p = path.join(dir, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };

test('control: every EXT15 static check passes on an unmodified copy', () => {
  const dir = sandbox();
  for (const [tool, args] of [['app-modules.js', []], ['inline-styles.js', ['--check']], ['typecheck.js', ['--gate']]]) {
    const r = run(dir, tool, args);
    expect(r.status, tool + '\n' + r.stdout + r.stderr).toBe(0);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

const TRAPS = [
  ['an inline style attribute in a module', 'inline-styles.js', ['--check'], d => edit(d, 'assets/app/he-tasks.js', t => t.replace('class="', 'style="color:red" class="')), /static inline/],
  ['an inline style attribute in the page', 'inline-styles.js', ['--check'], d => edit(d, 'owner-login.html', t => t.replace('<body', '<body style="margin:0"')), /static inline/],
  ['a module that uses a program function it did not ask for (hidden dependency)', 'app-modules.js', [], d => edit(d, 'assets/app/he-format.js', t => t.replace(/return \{/, 'function __trap(){ return loadTasks(); }\n  return {')), /hidden|loadTasks/i],
  ['a module file the page does not load', 'app-modules.js', [], d => edit(d, 'owner-login.html', t => t.replace(/<script src="assets\/app\/he-suppliers\.js\?v=[0-9a-f]+"><\/script>\n?/, '')), /he-suppliers/],
  ['a module created twice by the program', 'app-modules.js', [], d => edit(d, 'assets/owner-login-app.js', t => t.replace(/(\n\s*const \{[^}]*\} = HE\.modules\.create\('he-suppliers'[^\n]*)/, '$1$1')), /twice|more than once|he-suppliers/i],
  ['an unused variable in a module (type-check gate)', 'typecheck.js', ['--gate'], d => edit(d, 'assets/app/he-format.js', t => t.replace(/return \{/, 'const __unusedTrap = 1;\n  return {')), /GATED .*6133/],
];
for (const [what, tool, args, plant, expected] of TRAPS) {
  test(`trap: ${what} → ${tool} fails`, () => {
    const dir = sandbox(plant);
    const r = run(dir, tool, args);
    expect(r.status, r.stdout + r.stderr).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(expected);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test('balanced shards: every spec file is in exactly one of the 3 CI shards, and a new file without a duration is not dropped', () => {
  const dir = sandbox(d => fs.writeFileSync(path.join(d, 'tests/specs/zz-new-trap.spec.js'), '// new\n'));
  const all = fs.readdirSync(path.join(dir, 'tests/specs')).filter(f => f.endsWith('.spec.js')).map(f => 'tests/specs/' + f).sort();
  const got = [1, 2, 3].flatMap(i => run(dir, 'ci-shards.js', ['--list', `${i}/3`]).stdout.trim().split(/\s+/));
  expect(got.slice().sort()).toEqual(all);
  expect(new Set(got).size).toBe(got.length);
  expect(got).toContain('tests/specs/zz-new-trap.spec.js');
  fs.rmSync(dir, { recursive: true, force: true });
});
