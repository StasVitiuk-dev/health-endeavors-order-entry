// The page-mutation runner's run classifier is pure and must never score an
// infrastructure failure as a killed mutant (that would be a false green).
// These fixtures pin CAUGHT / INFRA FAILURE / NOT CAUGHT / NO TEST RAN against
// representative Playwright outputs. Node-only.
const { test, expect } = require('@playwright/test');
const { classifyRun } = require('../mutation/classify-run');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('a real assertion failure with co-passing tests is CAUGHT', () => {
  expect(classifyRun('  1 failed\n  10 passed (12.3s)\n').kind).toBe('CAUGHT');
});

test('a single-test grep kill (0 co-tests) is still CAUGHT', () => {
  // 0 passed must NOT be treated as infra: a -g that selects one test kills with 0 co-passes.
  expect(classifyRun('  1 failed\n').kind).toBe('CAUGHT');
});

test('a browser launch failure is INFRA FAILURE, never CAUGHT', () => {
  const r = classifyRun("Error: browserType.launch: Executable doesn't exist at /opt/pw/headless_shell\n  11 failed\n");
  expect(r.kind).toBe('INFRA');
  expect(r.text).not.toMatch(/^CAUGHT/);
});

test('a run timeout is INFRA FAILURE, not a legitimate kill', () => {
  expect(classifyRun('  Test timeout of 30000ms exceeded.\n  1 failed\n').kind).toBe('INFRA');
});

test('page.goto / network / closed-target errors are INFRA FAILURE', () => {
  expect(classifyRun('  page.goto: net::ERR_CONNECTION_REFUSED\n  1 failed\n').kind).toBe('INFRA');
  expect(classifyRun('  Target page, context or browser has been closed\n  2 failed\n').kind).toBe('INFRA');
});

test('a mutant that changed nothing observable is NOT CAUGHT', () => {
  expect(classifyRun('  11 passed (9s)\n').kind).toBe('NOT_CAUGHT');
});

test('no summary line at all is NO TEST RAN (spec did not load / filter matched nothing)', () => {
  expect(classifyRun('Error: No tests found\n').kind).toBe('NO_TEST');
  expect(classifyRun('').kind).toBe('NO_TEST');
});

test('terminal colour codes do not fool the parser', () => {
  expect(classifyRun('\x1b[31m  1 failed\x1b[0m\n\x1b[32m  10 passed (3s)\x1b[0m\n').kind).toBe('CAUGHT');
});
