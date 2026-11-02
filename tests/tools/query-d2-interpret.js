#!/usr/bin/env node
// Query D2 result interpreter. Reads the pasted D2 result (TSV/CSV or the
// "check_id | object | detail" text) on stdin or a file arg, and classifies each
// owner-rights function, never calling an incomplete result safe.
//
// Usage: node tests/tools/query-d2-interpret.js [result.txt]
// Exit 0 = interpretable (may still contain FAIL rows, which it prints);
// exit 2 = result is INCOMPLETE/UNTRUSTWORTHY (false-green guard tripped).
'use strict';
const fs = require('fs');
// The 10 functions FIX 3 targets; interpreter must see rights info for each or report missing.
const EXPECTED = [
  'check_adverse_event_deadlines','check_break_glass_usage','check_stale_privacy_deletion_requests',
  'escalate_overdue_tasks','generate_daily_report','log_customer_data_access','raise_activity_alert',
  'record_alert','detect_unusual_activity','generate_account_number'];
const raw = fs.readFileSync(process.argv[2] || 0, 'utf8').trim();
if (!raw) { console.error('INCOMPLETE: empty result (nothing pasted).'); process.exit(2); }
// split into rows; accept tab, " | " or comma between the three columns
const rows = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  .map(l => { const m = l.split(/\t| \| /).map(s => s.replace(/^"|"$/g,'').trim()); return m; })
  .filter(c => c.length >= 2 && /^D2 /.test(c[0]));
if (!rows.length) { console.error('INCOMPLETE: no "D2 ..." rows found — wrong query, wrong project, or a partial paste.'); process.exit(2); }
const byKind = k => rows.filter(r => r[0] === k);
const rightsRows = byKind('D2 rights');
const codeRows = byKind('D2 code');
const jobRows = byKind('D2 scheduled job');
const summaryRows = byKind('D2 summary');
// false-green guards
if (!summaryRows.length) { console.error('INCOMPLETE: no "D2 summary" row — the result was cut off before the end.'); process.exit(2); }
if (!rightsRows.length) { console.error('INCOMPLETE: no "D2 rights" rows — cannot judge any function.'); process.exit(2); }
// which expected functions have a rights row (match by bare name before "(")
const nameOf = s => (s || '').split('(')[0].replace(/^public\./,'').trim();
const present = new Set(rightsRows.map(r => nameOf(r[1])));
const missing = EXPECTED.filter(f => !present.has(f));
const out = []; let worst = 'OK';
const bump = v => { const order = ['OK','REVIEW','FAIL','INCOMPLETE']; if (order.indexOf(v) > order.indexOf(worst)) worst = v; };
for (const f of EXPECTED) {
  if (!present.has(f)) { out.push(`  MISSING  ${f}  -> cannot confirm; treat as UNKNOWN, never PASS`); bump('INCOMPLETE'); continue; }
  const rr = rightsRows.find(r => nameOf(r[1]) === f);
  const detail = (rr[2] || '') + ' ' + (codeRows.find(c => nameOf(c[1]) === f)?.[2] || '');
  const anon = /anon=|default: everyone|\{=/.test(rr[2] || '');   // anon or PUBLIC execute present
  const usedByCron = jobRows.some(j => nameOf(j[1]) === f);
  const gated = /auth\.uid\(\)|current_role\(\)|is_owner_or_admin\(\)|request\.jwt/.test(detail);
  const unpinned = /search_path/i.test(detail) ? '' : ' [search_path: confirm pinned]';
  let verdict;
  if (!anon) verdict = 'OK (visitors already cannot call it)';
  else if (gated) { verdict = 'REVIEW (visitor-callable but gates on caller - read the gate)'; bump('REVIEW'); }
  else { verdict = 'FAIL (visitor-callable, no caller gate -> FIX 3 target)'; bump('FAIL'); }
  out.push(`  ${verdict}  ${f}${usedByCron ? ' [used by a scheduled job -> keep privileged role]' : ''}${unpinned}`);
}
console.log('Query D2 interpretation:'); console.log(out.join('\n'));
console.log(`\nScheduled jobs referencing these functions: ${jobRows.length}`);
console.log(`Summary: ${summaryRows.map(r => r[2]).join('; ')}`);
if (missing.length) console.log(`\nFALSE-GREEN GUARD: ${missing.length} expected function(s) absent from the result; NOT safe to call this a pass.`);
console.log(`\nOverall: ${worst === 'OK' ? 'all expected functions already safe' : worst === 'REVIEW' ? 'some need the gate read' : worst === 'FAIL' ? 'FIX 3 targets confirmed; proceed to prepare approval' : 'INCOMPLETE - re-run or re-paste the full result'}`);
process.exit(worst === 'INCOMPLETE' ? 2 : 0);
