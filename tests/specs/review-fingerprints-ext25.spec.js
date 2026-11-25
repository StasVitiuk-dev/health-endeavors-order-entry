// Every review guide names the CURRENT fingerprint (and line count) of each SQL
// draft it lists. The owner checks the fingerprint of the file they paste
// against these tables before a database sitting; a stale one would either
// stop a correct sitting or, worse, approve a file nobody reviewed. Found on
// Nov 25: the guided-runs table still showed draft 46 from before PR #99.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const DRAFTS = path.join(ROOT, 'docs', 'ops', 'sql', 'drafts');
const REVIEW = path.join(ROOT, 'docs', 'ops', 'sql-review');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

function current() {
  const out = {};
  for (const f of fs.readdirSync(DRAFTS).filter(x => x.endsWith('.sql'))) {
    const b = fs.readFileSync(path.join(DRAFTS, f));
    out[f] = { sha: crypto.createHash('sha256').update(b).digest('hex').slice(0, 16), lines: b.toString('utf8').split('\n').length - 1 };
  }
  return out;
}

test('every fingerprint (and line count) a review guide gives for a draft is the draft as it is now', () => {
  const now = current();
  const stale = [];
  let checked = 0;
  for (const doc of fs.readdirSync(REVIEW).filter(x => x.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join(REVIEW, doc), 'utf8').split('\n');
    for (const line of lines) {
      for (const f of Object.keys(now)) {
        if (!line.includes(f)) continue;
        const fps = [...line.matchAll(/`([0-9a-f]{16})`/g)].map(m => m[1]);
        if (!fps.length) continue;
        checked++;
        if (!fps.includes(now[f].sha)) stale.push(doc + ': ' + f + ' says ' + fps.join('/') + ', is ' + now[f].sha);
        // a table row "| file | lines | `fingerprint` |": the line count must match too
        const m = line.match(new RegExp('\\|\\s*(\\d+)\\s*\\|\\s*`' + now[f].sha + '`'));
        if (fps.includes(now[f].sha) && line.match(/\|\s*\d+\s*\|\s*`[0-9a-f]{16}`/) && !m) stale.push(doc + ': ' + f + ' line count is not ' + now[f].lines);
        if (m && Number(m[1]) !== now[f].lines) stale.push(doc + ': ' + f + ' says ' + m[1] + ' lines, has ' + now[f].lines);
      }
    }
  }
  expect(stale).toEqual([]);
  expect(checked).toBeGreaterThan(20);   // the check really looked at the guides
});

test('the check catches a stale fingerprint (a planted one)', () => {
  const now = current();
  const f = '46_DRAFT_tax_rates.sql';
  const planted = '| 8 | `' + f + '` | ' + now[f].lines + ' | `536e2c569fdfd262` |';
  const fps = [...planted.matchAll(/`([0-9a-f]{16})`/g)].map(m => m[1]);
  expect(fps.includes(now[f].sha)).toBe(false);
});
