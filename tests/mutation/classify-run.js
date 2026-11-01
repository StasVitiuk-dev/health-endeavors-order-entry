// Classify one Playwright run's output for the page-mutation runner, so the
// CAUGHT / INFRA FAILURE / NOT CAUGHT / NO TEST RAN decision is a pure, unit-
// tested function that cannot silently drift (tests/specs/mutation-classify-ext.spec.js).
//
// A "N failed" summary line is only a legitimate kill when the test actually
// RAN and the failure is a test assertion. An infrastructure failure (browser
// can't launch, a run timeout, no tests found, the page/browser closed, a
// network/protocol error) ALSO prints "N failed" and must not be scored as a
// killed mutant (a false green). We key on infra signatures, never on
// "0 passed" (a single-test grep legitimately kills with 0 co-tests passing).
// This guard is not a substitute for a green unmutated baseline.
'use strict';

const INFRA = /browserType\.launch|Executable doesn't exist|Looks like Playwright Test or Playwright was just installed|No tests found|Target (page|frame), context or browser has been closed|Target closed|Protocol error|net::ERR|page\.goto:|Test timeout of \d+ms exceeded/;

function classifyRun(out) {
  const plain = String(out == null ? '' : out).replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); // strip terminal colour codes
  const failed = (plain.match(/^\s*(\d+) failed\s*$/m) || [])[1];
  const passed = (plain.match(/^\s*(\d+) passed\b/m) || [])[1];
  const infra = INFRA.test(plain);
  if (failed && infra) return { kind: 'INFRA', text: 'INFRA FAILURE (not a legitimate kill): ' + (plain.match(INFRA) || ['infra'])[0].slice(0, 80) + ` (${failed} failed, ${passed || 0} passed)` };
  if (failed) return { kind: 'CAUGHT', text: `CAUGHT (${failed} failed, ${passed || 0} passed)` };
  if (!passed) return { kind: 'NO_TEST', text: 'NO TEST RAN (spec did not load or filter matched nothing): ' + (plain.match(/Error: [^\n]*/) || ['no error text'])[0].slice(0, 160) };
  return { kind: 'NOT_CAUGHT', text: `NOT CAUGHT (${passed} passed)` };
}

module.exports = { classifyRun, INFRA };
