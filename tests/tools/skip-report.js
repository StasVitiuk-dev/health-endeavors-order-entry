#!/usr/bin/env node
// Accounts for every skipped and expected-to-fail test in a Playwright JSON
// report, so a "clean" run cannot hide tests that silently did not run.
//
// Usage (from the repo root):
//   PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --config tests/playwright.config.js --reporter=dot,json
//   node tests/tools/skip-report.js results.json [--markdown]
//
// A skip is "by design" only when it is a screen-size scope skip: the test
// runs once at the other size (logic, static and Node-only checks run at
// desktop size; touch-only checks at iPhone size). Anything else is listed as
// UNEXPLAINED and the tool exits 1.
'use strict';
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('usage: node tests/tools/skip-report.js results.json [--markdown]'); process.exit(2); }
const md = process.argv.includes('--markdown');
const report = JSON.parse(fs.readFileSync(file, 'utf8'));

const rows = [];
function walk(suite, trail) {
  const t = suite.title ? trail.concat(suite.title) : trail;
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const last = (test.results || [])[test.results.length - 1] || {};
      const notes = (test.annotations || []).concat(last.annotations || []);
      rows.push({
        file: spec.file, title: t.slice(1).concat(spec.title).join(' › '), project: test.projectName,
        status: last.status, expected: test.expectedStatus, outcome: test.status,
        reason: (notes.find(a => a.type === 'skip' || a.type === 'fixme') || {}).description || '',
      });
    }
  }
  for (const s of suite.suites || []) walk(s, t);
}
for (const s of report.suites || []) walk(s, []);

// A skip whose other-size twin actually ran is a scope skip.
const ran = new Set(rows.filter(r => r.status && r.status !== 'skipped').map(r => r.file + '|' + r.title));
const skipped = rows.filter(r => r.status === 'skipped');
const scope = skipped.filter(r => ran.has(r.file + '|' + r.title));
const unexplained = skipped.filter(r => !ran.has(r.file + '|' + r.title));
const expectedFail = rows.filter(r => r.expected === 'failed');
const failed = rows.filter(r => r.outcome === 'unexpected');
const flaky = rows.filter(r => r.outcome === 'flaky');

const byReason = {};
for (const r of scope) {
  const key = `${r.project} skipped: ${r.reason || '(no reason given)'}`;
  byReason[key] = (byReason[key] || 0) + 1;
}

const out = [];
const p = s => out.push(s);
p(md ? '| Measure | Count |\n|---|---|' : 'SUMMARY');
const line = (k, v) => p(md ? `| ${k} | ${v} |` : `  ${k}: ${v}`);
line('tests in report', rows.length);
line('ran and passed (incl. expected failures that failed)', rows.filter(r => r.outcome === 'expected' && r.status !== 'skipped').length);
line('failed', failed.length);
line('flaky', flaky.length);
line('skipped, other screen size ran it (by design)', scope.length);
line('skipped, NOT run at any size (unexplained)', unexplained.length);
line('expected failures (known bugs marked test.fail)', expectedFail.length);
p('');
p(md ? '**By-design skips, by reason**\n' : 'BY-DESIGN SKIPS BY REASON');
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) p(md ? `- ${v} × ${k}` : `  ${v} × ${k}`);
if (expectedFail.length) {
  p('');
  p(md ? '**Expected failures (known, documented bugs)**\n' : 'EXPECTED FAILURES');
  for (const r of expectedFail) p(`${md ? '-' : ' '} [${r.project}] ${r.file} › ${r.title}`);
}
for (const [name, list] of [['UNEXPLAINED SKIPS', unexplained], ['FAILED', failed], ['FLAKY', flaky]]) {
  if (!list.length) continue;
  p('');
  p(md ? `**${name}**\n` : name);
  for (const r of list) p(`${md ? '-' : ' '} [${r.project}] ${r.file} › ${r.title}${r.reason ? ' (' + r.reason + ')' : ''}`);
}
console.log(out.join('\n'));
process.exit(unexplained.length || failed.length ? 1 : 0);
