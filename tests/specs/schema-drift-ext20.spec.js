// EXT20 schema drift detector (tests/tools/schema-drift.js), without a database:
// a synthetic Query A export is generated from the local real-shape schema, then
// changed one way at a time (the schema "mutants"); each change must be named.
// The same tool on real Query A / A2 output is tested against PostgreSQL in
// docs/ops/sql/local-test/schema_drift_test.sh (DB suite).
const { test, expect } = require('@playwright/test');
const D = require('../tools/schema-drift');
const sc = require('../tools/schema-contract');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node only; once'); });

// Query A rows for the 18 exported tables, as the real query prints them.
function exportFrom(local, tweak = (t, c, info) => info) {
  const rows = ['?column?,tbl,?column?'];
  for (const [t, cols] of Object.entries(local)) {
    let i = 0;
    for (const [c, info0] of Object.entries(cols)) {
      const info = tweak(t, c, info0);
      i++;
      if (!info) continue;
      rows.push(`1 column,${t},"${i} ${c} ${info.type}${info.notNull ? ' NOT NULL' : ''}"`);
    }
    rows.push(`4 rls,${t},row level security ON`);
  }
  return rows.join('\r\n') + '\r\n';
}
const local = () => D.localTyped();
const kinds = r => r.findings.filter(f => f.level !== 'INFO' || f.kind !== 'not exported').map(f => `${f.level} ${f.kind} ${f.object}`);

test('the local schema exported as-is: PASS, nothing invented for tables that were not exported', () => {
  const r = D.diff(exportFrom(local()));
  expect(r.overall).toBe('PASS');
  expect(r.findings.filter(f => f.level !== 'INFO')).toEqual([]);
  const notExported = r.findings.filter(f => f.kind === 'not exported' && f.note.startsWith('the page')).map(f => f.object);
  expect(notExported.sort()).toEqual([...sc.OUTSIDE].sort()); // exactly the 24 "outside" tables, sent to Query A2
});

test('schema mutants: each production difference is named with the right level', () => {
  const L = local();
  // a column the page reads is renamed in production (the EXT19 full_name bug, the other way round)
  let r = D.diff(exportFrom(L, (t, c, i) => (t === 'profiles' && c === 'display_name' ? null : i)));
  expect(r.overall).toBe('FAIL');
  expect(kinds(r)).toContain('FAIL missing column profiles.display_name');
  // a table the page reads does not exist in production
  r = D.diff(exportFrom(L).replace(/^1 column,returns,.*\r\n/gm, '').replace(/^4 rls,returns,.*\r\n/m, '0 table missing,returns,not found in schema public\r\n'));
  expect(kinds(r)).toContain('FAIL missing table returns');
  // type and NOT NULL differences: WARN (local tests may not match production)
  r = D.diff(exportFrom(L, (t, c, i) => (t === 'expenses' && c === 'amount' ? { ...i, type: 'double precision' } : t === 'tasks' && c === 'title' ? { ...i, notNull: !i.notNull } : i)));
  expect(r.overall).toBe('WARN');
  expect(kinds(r)).toEqual(expect.arrayContaining(['WARN type mismatch expenses.amount', 'WARN nullability mismatch tasks.title']));
  // production has an extra column: INFO only
  r = D.diff(exportFrom(L) + '1 column,orders,"99 synthetic_extra text"\r\n');
  expect(r.findings).toContainEqual(expect.objectContaining({ level: 'INFO', kind: 'extra column', object: 'orders.synthetic_extra' }));
  expect(r.overall).toBe('PASS');
});

test('draft columns are never assumed live: absent in production is "draft not installed", not a page failure', () => {
  const L = local();
  const withDraft = JSON.parse(JSON.stringify(L));
  withDraft.tasks.client_request_id = { type: 'uuid', notNull: false };
  const r = D.diff(exportFrom(L), { local: withDraft });
  expect(r.findings).toContainEqual(expect.objectContaining({ level: 'INFO', kind: 'draft not installed', object: 'tasks.client_request_id' }));
  expect(r.findings.filter(f => f.level === 'FAIL')).toEqual([]);
});

test('CSV reading: quoted commas, doubled quotes, CRLF, header row', () => {
  expect(D.csvRows('a,b,c\r\n1 column,t,"1 x text, odd ""q"""\r\n')).toEqual([['a', 'b', 'c'], ['1 column', 't', '1 x text, odd "q"']]);
  const p = D.parseExport('section,item,detail\n1 column,t,"3 total numeric NOT NULL DEFAULT 0"\n0 table missing,u,not found in schema public\n');
  expect(p.tables.t.total).toEqual({ type: 'numeric', notNull: true });
  expect([...p.missing]).toEqual(['u']);
  expect(D.normType('character varying(40)')).toBe('text');
});
