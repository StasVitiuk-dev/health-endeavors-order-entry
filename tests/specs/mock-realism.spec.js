// Mock realism (2026-10-06, extension 4, workstream AA). The mock database's
// value rules (tests/helpers/db-constraints.js) must match the schema
// evidence (docs/ops/sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql,
// transcribed from the owner's read-only Query A). If either side changes
// without the other, this fails, so tests can never pass against rules the
// real database does not have (or miss rules it does have).

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { ALLOWED, NON_NEGATIVE, POSITIVE, NOT_NULL } = require('../helpers/db-constraints');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const SCHEMA = fs.readFileSync(path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'local-test', '01_REAL_SHAPE_schema_for_local_tests.sql'), 'utf8');

// table -> { column -> [values] } for every "col = ANY (ARRAY['a'::text, ...])" rule,
// plus ">= 0" and "> 0" rules, and NOT NULL columns.
function evidence() {
  const allowed = {}, nonNeg = {}, pos = {}, notNull = {};
  for (const m of SCHEMA.matchAll(/create table (\w+) \(([\s\S]*?)\n\);/g)) {
    const [, table, body] = m;
    for (const c of body.matchAll(/CHECK \(\((\w+) = ANY \(ARRAY\[([^\]]+)\]\)\)\)/g)) {
      (allowed[table] = allowed[table] || {})[c[1]] = [...c[2].matchAll(/'([^']+)'::text/g)].map(x => x[1]);
    }
    for (const c of body.matchAll(/CHECK \(\((\w+) >= \(?0\)?(?:::numeric)?\)\)/g)) (nonNeg[table] = nonNeg[table] || []).push(c[1]);
    for (const c of body.matchAll(/CHECK \(\((\w+) > \(?0\)?(?:::numeric)?\)\)/g)) (pos[table] = pos[table] || []).push(c[1]);
    for (const c of body.matchAll(/^\s+(\w+) [^,\n]*NOT NULL/gm)) (notNull[table] = notNull[table] || []).push(c[1]);
  }
  return { allowed, nonNeg, pos, notNull };
}
const E = evidence();
const sorted = o => JSON.parse(JSON.stringify(o, (k, v) => (Array.isArray(v) ? [...v].sort() : v)));

test('the schema evidence was parsed (sanity)', () => {
  expect(Object.keys(E.allowed).length).toBeGreaterThanOrEqual(10);
  expect(E.allowed.returns.status).toContain('refunded');
});

test('every value list in the mock matches the schema evidence exactly, and none is missing', () => {
  expect(sorted(ALLOWED)).toEqual(sorted(E.allowed));
});

test('">= 0" and "> 0" rules in the mock match the schema evidence', () => {
  const pick = (src, tables) => Object.fromEntries(tables.map(t => [t, [...(src[t] || [])].sort()]));
  const tables = [...new Set([...Object.keys(NON_NEGATIVE), ...Object.keys(E.nonNeg)])];
  expect(pick(NON_NEGATIVE, tables)).toEqual(pick(E.nonNeg, tables));
  const ptables = [...new Set([...Object.keys(POSITIVE), ...Object.keys(E.pos)])];
  expect(pick(POSITIVE, ptables)).toEqual(pick(E.pos, ptables));
});

test('columns the mock treats as NOT NULL really are NOT NULL in the schema evidence', () => {
  const wrong = [];
  for (const [t, cols] of Object.entries(NOT_NULL)) for (const c of cols) if (!(E.notNull[t] || []).includes(c)) wrong.push(`${t}.${c}`);
  expect(wrong).toEqual([]);
});
