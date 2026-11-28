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
// The first sittings word their answers differently; the expectations are still read from the guides.
// STAND-IN for production's switches table (as in production_shape_install_test.sh; its columns are the
// open read-only look in LAUNCH_PLAN_2_WEEKS.md)
const FLAGS = "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false);" +
  " insert into public.feature_flags (flag_key, label, enabled) values ('shopify_order_sync', 'Shopify order sync', false);";
function sqlBlocks(section) { return [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1]); }
function runCase(name, setup, drafts, checks) {
  const DB = 'he_guide_check_x';
  psql('postgres', ['-c', 'drop database if exists ' + DB + ' with (force)']);
  psql('postgres', ['-c', 'create database ' + DB + ' template he_real']);
  try {
    if (setup) psql(DB, ['-c', setup]);
    for (const n of drafts) psql(DB, ['-f', draft(n)]);
    for (const [what, sql, exp] of checks) {
      const got = psql(DB, [], sql).trim().split('\n').filter(Boolean).map(l => tf(l.replace(/\|/g, ' | '))).join(' / ');
      if (got === exp) { pass++; console.log('  ok   ' + name + ', ' + what + ': ' + got.slice(0, 120)); }
      else { fail++; console.log('  FAIL ' + name + ', ' + what + ': the guide expects [' + exp + '], the check gives [' + got + ']'); }
    }
  } catch (e) { fail++; console.log('  FAIL ' + name + ': ' + String(e.stderr || e.message).split('\n')[0]); }
  psql('postgres', ['-c', 'drop database if exists ' + DB + ' with (force)']);
}
{
  const t = fs.readFileSync(path.join(R, fs.readdirSync(R).find(x => x.startsWith('ITEM_20_'))), 'utf8');
  const sec = t.slice(t.search(/^## After each step/m)); const b = sqlBlocks(sec);
  const rows = Number((sec.match(/\*\*After draft 10\*\* \((\d+) rows, each `([^`]+)`\)/) || [])[1]);
  const each = (sec.match(/\*\*After draft 10\*\* \(\d+ rows, each `([^`]+)`\)/) || [])[1];
  const fp = (sec.match(/one value, `([0-9a-f]{32})`/) || [])[1];
  const n21 = Number((sec.match(/\*\*After draft 21\*\* \((\d+) rows, each `([^`]+)`\)/) || [])[1]);
  const each21 = (sec.match(/\*\*After draft 21\*\* \(\d+ rows, each `([^`]+)`\)/) || [])[1];
  const fns = ['_he_apply_stock_change', 'adjust_inventory', 'delete_unused_product', 'quarantine_recall', 'receive_purchase_order', 'receive_return'];
  const sw = ['stock_fn_adjust', 'stock_fn_delete_product', 'stock_fn_recall', 'stock_fn_receive_po', 'stock_fn_return'];
  runCase('item 20 (drafts/10, then 21)', FLAGS, ['10', '21'], [
    ['after draft 10, ' + rows + ' functions', b[0], rows === fns.length ? fns.map(f => f + ' | ' + each).join(' / ') : 'the guide says ' + rows + ' rows'],
    ['the fingerprint', b[1], fp],
    ['after draft 21, ' + n21 + ' switches', b[2], n21 === sw.length ? sw.map(k => k + ' | ' + each21).join(' / ') : 'the guide says ' + n21 + ' rows']]);
}
{
  const t = fs.readFileSync(path.join(R, fs.readdirSync(R).find(x => x.startsWith('ITEM_21_'))), 'utf8');
  const sec = t.slice(t.search(/^## After running/m)); const [both] = sqlBlocks(sec);
  const [q1, q2] = both.split(';').map(x => x.trim()).filter(Boolean);
  const row = (sec.match(/one row `([^`]+)`/) || [])[1];
  const most = Number((sec.match(/up to (\d+)/) || [])[1]);
  // the first answer varies with the database (tables that exist); check its bound, then the exact second answer
  runCase('item 21 (drafts/19, then 27)', FLAGS, ['19', '27'], [
    ['tables with a request key, at most ' + most, 'select (' + q1 + ') between 1 and ' + most, 'true'],
    ['the switch', q2, row]]);
}
console.log('guide after-checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
