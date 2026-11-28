// Every call the dashboard makes to a database function matches the function its SQL draft defines:
// the name exists, every argument name the page sends exists, and every argument without a default is
// sent (Nov 28). Runs once, in Node, no browser. The tool: tests/tools/rpc-contract.js.
const { test, expect } = require('@playwright/test');
const C = require('../tools/rpc-contract.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('every checked call from the dashboard matches its draft', () => {
  const r = C.run();
  expect(r.problems).toEqual([]);
  // the tool really reads the calls (it can never pass by finding nothing)
  expect(r.checked).toBeGreaterThanOrEqual(31);
  // production's own functions are listed, not judged; a new name here means a call with no draft
  expect(r.notDraft).toEqual(['employee_activity', 'global_search', 'log_customer_data_access', 'revoke_my_session']);
});

test('the check catches a misspelt argument, a missing required one and an unknown function (planted)', () => {
  const defs = C.definitions({ 'drafts/99_X.sql': "-- a comment (p_x int)\ncreate or replace function public.save_x(p_id uuid, p_lines jsonb default '[]'::jsonb, p_note text default null) returns jsonb as $$ select null $$;" });
  const js = (body) => C.calls({ 'assets/x.js': body });
  expect(C.check(defs, js("client.rpc('save_x', { p_id: id, p_note: n })")).problems).toEqual([]);
  expect(C.check(defs, js("callStockFunction('save_x', { p_id })")).problems).toEqual([]);   // shorthand
  expect(C.check(defs, js("const RPC = { save: 'save_x' };\nclient.rpc(RPC.save, { p_id: id, p_lnes: l })")).problems[0]).toContain('save_x(p_id, p_lnes) but drafts/99_X.sql defines (p_id, p_lines (optional), p_note (optional))');
  expect(C.check(defs, js("const RPC = 'save_x';\nclient.rpc(RPC, { p_note: n })")).problems).toHaveLength(1);   // p_id has no default
  expect(C.check(defs, js("supabase.rpc('who_knows', { p_a: 1 })")).notDraft).toEqual(['who_knows']);
});

// Feature Flags says "Installed" for a database step when the table or function it looks for exists.
// After each evening the guides tell the owner to look for that word, so each one must look for
// something its own draft creates.
test('every Feature Flags install check looks for a table or function its own draft creates', () => {
  const fs = require('fs'), path = require('path');
  const ROOT = path.resolve(__dirname, '..', '..');
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'views', 'he-record-switches.js'), 'utf8');
  const D = path.join(ROOT, 'docs', 'ops', 'sql', 'drafts'), files = fs.readdirSync(D);
  const seen = [];
  for (const m of src.matchAll(/\{ key: '(\w+)'[^}]*?draft: '([^']*)'[^}]*?(?:probe: '(\w+)'|rpc: '(\w+)')/g)) {
    const nums = [...new Set([...m[2].matchAll(/(?:drafts\/|\band )(\d{2})\b/g)].map(x => x[1]))];
    if (!nums.length) { expect(m[2]).toMatch(/No database step/); continue; }
    const text = nums.map(n => files.find(f => f.startsWith(n + '_DRAFT_') && !/rollback/i.test(f))).filter(Boolean)
      .map(f => fs.readFileSync(path.join(D, f), 'utf8')).join('\n');
    const re = m[3] ? new RegExp('create table (if not exists )?public\\.' + m[3] + '\\b', 'i') : new RegExp('function public\\.' + m[4] + '\\b', 'i');
    expect(re.test(text), m[1] + ' looks for ' + (m[3] || m[4]) + ' in drafts ' + nums.join(', ')).toBe(true);
    seen.push(m[1]);
  }
  expect(seen.length).toBeGreaterThanOrEqual(13);
});
