// EXT14: the iPhone project does not load desktop-only spec files
// (playwright.config.js). This checks the rule cannot hide a test that should
// run on the iPhone. Node-only.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const config = require('../playwright.config.js');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('only files that skip every test off desktop are left out, and a file with an exception stays in', () => {
  const list = config.metadata.desktopOnlyFiles;
  expect(list.length).toBeGreaterThan(30);
  expect(config.projects.find(p => p.name === 'iphone').testIgnore).toBe(list);
  expect(config.projects.find(p => p.name === 'desktop').testIgnore).toBeUndefined();
  // system-status-ext10 skips off desktop EXCEPT its X10-24 phone test: it must stay loaded
  expect(list).not.toContain('system-status-ext10.spec.js');
  for (const f of list) {
    const text = fs.readFileSync(path.join(ROOT, 'tests', 'specs', f), 'utf8');
    const top = text.split('\n').filter(l => /^(base\.)?test\.beforeEach\(/.test(l));
    expect(top.length, f).toBeGreaterThan(0);
    expect(top.some(l => /\.skip\((testInfo|ti)\.project\.name !== 'desktop', /.test(l)), f).toBe(true);
    // nothing in the file asks to run on the iPhone
    const phone = new RegExp("project\\.name === '" + "iphone'|!== '" + "iphone'");
    expect(text, f).not.toMatch(phone);
  }
});

test('the iPhone project still lists every phone test (system-status X10-24, layout sweeps, phone menus)', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--config', 'tests/playwright.config.js', '--project=iphone', '--list'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  expect(out).toContain('X10-24');
  expect(out).toMatch(/layout-sweep-ext9\.spec\.js/);
  expect(out).not.toMatch(/sql-package-ext14|status-manifest-ext14|ci-guard-ext14/);
  const n = Number((/Total: (\d+) tests? in/.exec(out) || [])[1]);
  expect(n).toBeGreaterThan(400); // ~425 phone tests ran in the EXT13 baseline
});
