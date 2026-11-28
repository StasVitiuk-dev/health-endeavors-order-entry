#!/usr/bin/env node
// RLS policy analyzer. Reads a Query G result (CSV with columns
// check_id,level,object,detail) and classifies every UPDATE/ALL policy,
// flagging the two patterns that mattered in EXT20B:
//   (1) a user can edit their OWN row (id = auth.uid()) on a table that has a
//       security-sensitive column  -> the profiles.role self-escalation shape;
//   (2) any active signed-in staff member can UPDATE a table with no role gate.
// Query G does not list a table's columns, so (1) needs them from Query A
// (00_READONLY_A_schema.sql, its "1 column" rows): pass that file second. A
// self-row table whose columns are not known is REVIEW, never "benign".
// Corrected Nov 27, 2026: (1) used to look for sensitive WORDS in the policy text,
// so a gated policy ("... current_role() = 'owner'") was flagged and an ungated
// self-edit on a table with a role column was called benign; and only *_id columns
// counted as "own row", so created_by = auth.uid() was not seen at all
// (tests/specs/rls-analyzer-ext27.spec.js).
// Read-only, offline. Usage: node tests/tools/rls-analyzer.js <queryG.csv> [queryA.csv]
'use strict';
const fs = require('fs');
const path = process.argv[2], schemaPath = process.argv[3];
if (!path) { console.error('usage: rls-analyzer.js <queryG.csv> [queryA.csv]'); process.exit(1); }
// Proper CSV parse: fields may be quoted and span multiple physical lines
// (Query G policy USING/CHECK clauses contain newlines inside quotes).
function parseCsv(text) {
  const recs = []; let row = [], field = '', inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inq = false; }
      else field += ch;
    } else if (ch === '"') inq = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') recs.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); recs.push(row); }
  return recs;
}
const rows = parseCsv(fs.readFileSync(path, 'utf8'));
const pol = rows.filter(r => r[0] === 'G02 policy');
if (!rows.some(r => /^G0\d/.test(r[0] || ''))) { console.error('INCOMPLETE: no Query G rows found (wrong file?).'); process.exit(3); }
// columns per table, from Query A's "1 column" rows ("<n> <column> <type> ...")
const cols = {};
if (schemaPath) for (const r of parseCsv(fs.readFileSync(schemaPath, 'utf8'))) {
  if (r[0] === '1 column' && r[1]) (cols[r[1]] = cols[r[1]] || []).push(String(r[2] || '').split(' ')[1]);
}
const SENSITIVE_COL = /^(role|is_admin|is_owner|admin|access_level|is_active|active|deleted_at|is_deleted|approval_status|approved_by|is_break_glass|break_glass|privilege|can_[a-z_]+|is_super)$/i;
// tables a person checked by hand: no privileged column (the source says when and where)
const REVIEWED_BENIGN = { personal_calendar_events: 'reviewed by hand 2026-10-18 (EXT20B section 2): personal calendar entries, no privileged column' };
// any column compared with the caller (created_by = auth.uid() counts too, not only *_id)
const SELFROW = /\b\w+\s*=\s*auth\.uid\(\)|auth\.uid\(\)\s*=\s*\w+\b/i;
const selfSensitive = [], selfUnknown = [], activeStaffNoRole = [], selfRowBenign = [];
let profilesSelf = false;
for (const r of pol) {
  const obj = r[2], d = r[3] || '';
  const table = obj.split(' · ')[0];
  if (!/\b(UPDATE|ALL)\b for/.test(d)) continue;
  // remove the common "profiles role lookup" subquery so we only see row-ownership on THIS table
  const stripped = d.replace(/profiles\.\w+/g, '').replace(/EXISTS \( SELECT 1\s*FROM profiles[^)]*\)/gi, '');
  // Supabase's recommended form "user_id = (select auth.uid())" is printed "( SELECT auth.uid() AS uid)": the same caller
  const selfText = stripped.replace(/\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+\w+)?\s*\)/gi, 'auth.uid()');
  const usingHalf = d.split('check:')[0];
  const activeStaff = /is_active\s*=\s*true/.test(d) && !/role/.test(usingHalf) && /\bUPDATE\b for/.test(d);
  if (SELFROW.test(selfText)) {
    const where = `${table} :: ${obj.split(' · ').slice(1).join(' · ')}`;
    if (table === 'profiles') profilesSelf = true;
    else if (cols[table]) {
      const hit = cols[table].filter(c => SENSITIVE_COL.test(c));
      if (hit.length) selfSensitive.push(`${where}  (sensitive column: ${hit.join(', ')})`);
      else selfRowBenign.push(`${where}  (columns checked: none sensitive)`);
    } else if (REVIEWED_BENIGN[table]) selfRowBenign.push(`${where}  (${REVIEWED_BENIGN[table]})`);
    else selfUnknown.push(`${where}  (columns not known: not in the Query A file${schemaPath ? '' : ', none given'})`);
  }
  if (activeStaff) activeStaffNoRole.push(table);
}
console.log('RLS POLICY ANALYSIS (from Query G, offline)\n');
console.log('== Self-row edits on tables with a SENSITIVE column (the profiles.role shape) ==');
if (!selfSensitive.length) console.log('  NONE among the tables whose columns are known.');
else selfSensitive.forEach(x => console.log('  *** REVIEW *** ' + x));
console.log('\n== Self-row edits on tables whose columns are NOT known (look at the table by eye) ==');
selfUnknown.length ? selfUnknown.forEach(x => console.log('  *** REVIEW *** ' + x)) : console.log('  none');
console.log('\n== Self-row edits on tables with NO sensitive column (benign by design) ==');
selfRowBenign.length ? selfRowBenign.forEach(x => console.log('  ok  ' + x)) : console.log('  none');
if (profilesSelf) console.log('\nprofiles: people may edit their own row; its privileged columns are protected only by the FIX 2 guard. Confirm the guard with the drift check (11_READONLY_security_fix_drift_check.sql).');
console.log('\n== Tables any ACTIVE STAFF can UPDATE with no role gate (expected for an internal tool; review separation-of-duties) ==');
[...new Set(activeStaffNoRole)].sort().forEach(t => console.log('  ' + t));
const flagged = selfSensitive.length + selfUnknown.length;
console.log(`\nVerdict: ${flagged ? flagged + ' self-row policy(ies) need review' : 'no profiles-style self-escalation found'}.`);
process.exit(flagged ? 2 : 0);
