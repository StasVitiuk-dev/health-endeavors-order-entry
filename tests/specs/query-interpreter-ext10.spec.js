// EXT10b (missions 90-92): the offline interpreter for downloaded read-only
// query results. Node-only; synthetic CSVs shaped like each query's output.
const { test, expect } = require('@playwright/test');
const { parseCsv, interpret } = require('../tools/interpret-query-results');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('CSV parsing handles quotes, commas and line breaks inside cells', () => {
  const rows = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",2\n');
  expect(rows).toEqual([{ a: 'x, y', b: 'line1\nline2' }, { a: 'say "hi"', b: '2' }]);
});
test('Query H: overall is the worst status; NOT INSTALLED counts as normal', () => {
  const ok = interpret('H', 'id,item,expected,observed,status,action\nH01,R1-R5,x,0 present,NOT INSTALLED,Normal\nH10,guard,x,present,PASS,Nothing\n');
  expect(ok.overall).toBe('PASS');
  const bad = interpret('H', 'id,item,expected,observed,status,action\nH03,switch,x,ON,FAIL,STOP\nH04,switch,x,OFF,PASS,Nothing\n');
  expect(bad.overall).toBe('FAIL');
  expect(bad.rows[0].note).toBe('STOP');
});
test('Query F: wrong references / impossible values FAIL, stuck work WARN, unreadable UNKNOWN', () => {
  const r = interpret('F', 'section,check_name,findings,examples\nF01 stuck work,tasks,2,a\nF12 impossible value,totals,0,\nF10 points at the wrong thing,returns,1,b\nF07 probable duplicate,sup,,\n');
  expect(r.rows.map(x => x.status)).toEqual(['WARN', 'PASS', 'FAIL', 'UNKNOWN']);
  expect(r.overall).toBe('FAIL');
});
test('Query G uses its level column; Query D maps classification letters', () => {
  expect(interpret('G', 'check_id,level,object,detail\nG01,PASS,tasks,\nG03,WARN,tasks,x\n').overall).toBe('WARN');
  const d = interpret('D', 'function_name,classification\npublic.a(),A trigger only\npublic.b(),B not callable by anon\npublic.c(),E anon + no gate WRITES\n');
  expect(d.rows.map(x => x.status)).toEqual(['PASS', 'PASS', 'FAIL']);
});
test('Query E: 0 and none pass, information rows are INFO, orders without items are a WARN (owner decision)', () => {
  const e = interpret('E', 'section,check_name,result\n1 stock,buckets differ,0\n3 deliveries,no expense,none\n4 lots,lots hold more (information),2\n5 orders,orders with no items,3\n3 deliveries,duplicate expense,PO-1 (2)\n');
  expect(e.rows.map(x => x.status)).toEqual(['PASS', 'PASS', 'INFO', 'WARN', 'FAIL']);
});
test('an empty result is UNKNOWN, never PASS; Query C is refused', () => {
  expect(interpret('H', 'id,item,expected,observed,status,action\n').overall).toBe('UNKNOWN');
  expect(() => interpret('C', 'a\n1\n')).toThrow(/inventory/);
});
test('privacy: a file with an e-mail address is flagged', () => {
  expect(interpret('G', 'check_id,level,object,detail\nG02,INFO,x,owner@example.test\n').privacy).toMatch(/WARNING/);
  expect(interpret('G', 'check_id,level,object,detail\nG02,INFO,x,none\n').privacy).toMatch(/No e-mail/);
});
test('Query H output from the local database parses (real column names)', () => {
  const sample = 'id,item,expected,observed,status,action\nH01,R1-R5 stock functions (drafts/10),"6 functions, fingerprint 3df2bf7a07b451f12f9359ceca1c85df","6 present, fingerprint 3df2bf7a07b451f12f9359ceca1c85df",PASS,Nothing to do.\n';
  expect(interpret('H', sample).rows[0]).toMatchObject({ status: 'PASS', name: 'H01 R1-R5 stock functions (drafts/10)' });
});

test('a file that is not the query output (e.g. an error message) is refused, never read as PASS', () => {
  expect(() => interpret('H', 'psql: ERROR:  relation "public.feature_flags" does not exist\n')).toThrow(/does not look like a Query H result/);
});
