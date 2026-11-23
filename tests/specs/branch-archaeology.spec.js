// EXT20J Reserve VII: the branch-archaeology classifier (tests/tools/branch-archaeology.js)
// is a review aid for the ~458-commit feature branch. These tests feed it FIXED
// synthetic git data so its classification is pinned and regressions are caught —
// including the real bug found while building it: the monolith filename
// "owner-login-app.js" contains "login", which hijacked the AUTH category by path.
const { test, expect } = require('@playwright/test');
const A = require('../tools/branch-archaeology');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('type split: executable vs test vs docs vs generated vs mixed', () => {
  expect(A.classifyType(['assets/owner-login-app.js'])).toBe('EXECUTABLE');
  expect(A.classifyType(['owner-login.html'])).toBe('EXECUTABLE');
  expect(A.classifyType(['assets/owner-login.css'])).toBe('EXECUTABLE');
  expect(A.classifyType(['tests/specs/foo.spec.js', 'tests/tools/bar.js'])).toBe('TEST');
  expect(A.classifyType(['docs/ops/NOTE.md', 'design-review/x.md'])).toBe('DOCS');
  expect(A.classifyType(['package-lock.json'])).toBe('GENERATED');
  expect(A.classifyType(['docs/ops/APPLICATION_MODULE_MAP_EXT15.md'])).toBe('GENERATED');
  expect(A.classifyType(['assets/owner-login-app.js', 'docs/x.md'])).toBe('MIXED');
  expect(A.classifyType([])).toBe('OTHER');
});

test('the monolith filename never drives the category by path (the login/search bug)', () => {
  // A commit touching ONLY the monolith is classified by its SUBJECT, not by the
  // "login" / "search" substrings in the filename.
  expect(A.classifyCategory('inventory: low-stock threshold fix', ['assets/owner-login-app.js'])).toBe('INVENTORY');
  expect(A.classifyCategory('calendar: colour fix', ['assets/owner-login-app.js'])).toBe('CALENDAR');
  // A bare, uninformative subject on the monolith falls through to OTHER rather
  // than being mislabelled AUTH because of the filename.
  expect(A.classifyCategory('tidy up', ['assets/owner-login-app.js'])).toBe('OTHER');
});

test('path signal wins for dedicated files; real auth files still classify as AUTH', () => {
  expect(A.classifyCategory('misc', ['tests/specs/auth-chaos.spec.js'])).toBe('AUTH');
  expect(A.classifyCategory('misc', ['tests/specs/login-session.spec.js'])).toBe('AUTH');
  expect(A.classifyCategory('tt: convert returns panel', ['assets/owner-login-app.js'])).toBe('TRUSTED_TYPES');
});

test('risk: shipped code in a sensitive subsystem is HIGH; tests/docs are LOW', () => {
  expect(A.classifyRisk('EXECUTABLE', 'INVENTORY', ['assets/owner-login-app.js'])).toBe('HIGH');
  expect(A.classifyRisk('EXECUTABLE', 'SECURITY', ['assets/app/he-ui.js'])).toBe('HIGH');
  // A sensitive subsystem but only test/doc files changed -> not HIGH.
  expect(A.classifyRisk('TEST', 'INVENTORY', ['tests/specs/inventory-safety.spec.js'])).toBe('LOW');
  expect(A.classifyRisk('EXECUTABLE', 'CALENDAR', ['assets/owner-login-app.js'])).toBe('MEDIUM');
  expect(A.classifyRisk('DOCS', 'DOCS', ['docs/x.md'])).toBe('LOW');
});

test('owner-visible = shipped html/js/css moved', () => {
  expect(A.ownerVisible(['assets/owner-login-app.js'])).toBe(true);
  expect(A.ownerVisible(['owner-login.html'])).toBe(true);
  expect(A.ownerVisible(['tests/specs/x.spec.js', 'docs/y.md'])).toBe(false);
});

test('parseLog reads the NUL-delimited machine format into commits', () => {
  const raw = 'COMMIT\x00abc123def\x001792366526\x00security: fix\ntests/tools/css-lint.js\n\n'
    + 'COMMIT\x00def456abc\x001792365858\x00docs: note\ndocs/ops/NOTE.md\n';
  const commits = A.parseLog(raw);
  expect(commits.length).toBe(2);
  expect(commits[0].sha).toBe('abc123def');
  expect(commits[0].subject).toBe('security: fix');
  expect(commits[0].files).toEqual(['tests/tools/css-lint.js']);
  expect(commits[1].files).toEqual(['docs/ops/NOTE.md']);
});

test('end-to-end on fixed synthetic commits: tallies are exact and complete', () => {
  const raw = [
    'COMMIT\x001111111111\x001792366526\x00inventory: low-stock fix\nassets/owner-login-app.js\n',
    'COMMIT\x002222222222\x001792366000\x00docs: record state\ndocs/ops/X.md\n',
    'COMMIT\x003333333333\x001792365000\x00tests: add spec\ntests/specs/y.spec.js\n',
    'COMMIT\x004444444444\x001792364000\x00tt: convert panel\nassets/owner-login-app.js\nowner-login.html\n',
  ].join('');
  const rows = A.classifyAll(A.parseLog(raw));
  expect(rows.length).toBe(4);
  expect(A.tally(rows, 'type')).toEqual({ EXECUTABLE: 2, DOCS: 1, TEST: 1 });
  expect(rows.map(r => r.category)).toEqual(['INVENTORY', 'DOCS', 'TEST_INFRA', 'TRUSTED_TYPES']);
  // Every row is fully classified — no undefined axis.
  for (const r of rows) {
    expect(typeof r.risk).toBe('string');
    expect(typeof r.ownerVisible).toBe('boolean');
    expect(r.sha.length).toBe(9);
  }
});

test('the live branch classifies cleanly: every commit gets a category and the counts sum', () => {
  const { rows } = A.collect();
  expect(rows.length).toBeGreaterThan(400);
  // No commit is left uncategorised in an unexpected way: OTHER stays a small minority.
  const other = rows.filter(r => r.category === 'OTHER').length;
  expect(other).toBeLessThan(rows.length * 0.1);
  // Type tally covers every commit.
  const byType = A.tally(rows, 'type');
  expect(Object.values(byType).reduce((a, b) => a + b, 0)).toBe(rows.length);
});
