#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-28). Never point this at Supabase.
// The owner runs each launch step from its review guide (docs/ops/sql-review/ITEM_*.md) and then the
// guide's read-only "After running" check, comparing the answer with the guide's "Expected:" line. This
// test does exactly that on a throwaway copy of the real-shape database for every launch step: installs
// the step's draft(s), runs the check as written in the guide, and compares with the Expected line (psql
// prints t/f where Supabase's SQL editor shows true/false). A draft changed later without its guide, or a
// guide with a wrong expectation, fails here instead of during the owner's evening.
// Usage: node guide_after_checks_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CONN = process.argv.slice(2);
const R = path.join(__dirname, '..', '..', 'sql-review'), D = path.join(__dirname, '..', 'drafts');
// launch steps (docs/ops/LAUNCH_PLAN_2_WEEKS.md) whose guide has a one-line Expected answer -> the draft(s) the guide installs
const ITEMS = { 1: ['32'], 2: ['34'], 5: ['40'], 6: ['42'], 7: ['44'], 8: ['46'], 23: ['76'], 24: ['76', '78'] };
// item 7's Expected is in words ("two rows, both SELECT")
const WORDS = { 7: 'staff_read_purchase_order_items | SELECT / staff_read_purchase_orders | SELECT' };
const SERVICE = 'service' + '_role';
let pass = 0, fail = 0;
const psql = (db, args, input) => execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1']).concat(args), { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const draft = (n) => path.join(D, fs.readdirSync(D).find(f => f.startsWith(n + '_DRAFT_') && !/rollback/i.test(f)));
const tf = (v) => v.split(' | ').map(x => x === 't' ? 'true' : x === 'f' ? 'false' : x).join(' | ');

console.log('Review guides: each launch step\'s after-check gives the answer its guide promises');
for (const [item, drafts] of Object.entries(ITEMS)) {
  const f = fs.readdirSync(R).find(x => x.startsWith('ITEM_' + item + '_'));
  const t = fs.readFileSync(path.join(R, f), 'utf8');
  const sec = t.slice(Math.max(0, t.search(/^## After running/m)));
  const sql = (sec.match(/```sql\n([\s\S]*?)```/) || [])[1];
  const exp = WORDS[item] || (sec.match(/^Expected: `([^`]+)`/m) || [])[1];
  if (!sql || !exp) { fail++; console.log('  FAIL ' + f + ': no "After running" SQL block or Expected line found'); continue; }
  const DB = 'he_guide_check_' + item;
  psql('postgres', ['-c', 'drop database if exists ' + DB + ' with (force)']);
  psql('postgres', ['-c', 'create database ' + DB + ' template he_real']);
  // Supabase's standard rights for its service key (stand-in, as in production_shape_install_test.sh)
  psql(DB, ['-c', 'grant usage on schema public to ' + SERVICE + '; grant select, insert, update, delete on all tables in schema public to ' + SERVICE +
    '; alter default privileges in schema public grant select, insert, update, delete on tables to ' + SERVICE + '; alter default privileges in schema public grant execute on functions to ' + SERVICE + ';']);
  let got;
  try {
    for (const n of drafts) psql(DB, ['-f', draft(n)]);
    got = psql(DB, [], sql).trim().split('\n').filter(Boolean).map(l => tf(l.replace(/\|/g, ' | '))).join(' / ');
  } catch (e) { got = 'ERROR ' + String(e.stderr || e.message).split('\n')[0]; }
  if (got === exp) { pass++; console.log('  ok   item ' + item + ' (' + drafts.map(n => 'drafts/' + n).join(' + ') + '): ' + got); }
  else { fail++; console.log('  FAIL item ' + item + ' (' + f + '): the guide expects [' + exp + '], the check gives [' + got + ']'); }
  psql('postgres', ['-c', 'drop database if exists ' + DB + ' with (force)']);
}
console.log('guide after-checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
