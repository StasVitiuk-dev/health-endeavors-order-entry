#!/usr/bin/env node
// RLS policy analyzer. Reads a Query G result (CSV with columns
// check_id,level,object,detail) and classifies every UPDATE/ALL policy,
// flagging the two patterns that mattered in EXT20B:
//   (1) a user can edit their OWN row (id = auth.uid()) on a table that has a
//       security-sensitive column  -> the profiles.role self-escalation shape;
//   (2) any active signed-in staff member can UPDATE a table with no role gate.
// Read-only, offline. Usage: node tests/tools/rls-analyzer.js <queryG.csv>
'use strict';
const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('usage: rls-analyzer.js <queryG.csv>'); process.exit(1); }
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
const SENSITIVE = /\b(role|is_admin|is_owner|admin|access_level|is_active|active|deleted_at|is_deleted|approval_status|is_break_glass|break_glass|privilege|can_[a-z]+|is_super|owner)\b/i;
const SELFROW = /\b\w*(id|user_id|owner_id)\s*=\s*auth\.uid\(\)/i;
const selfSensitive = [], activeStaffNoRole = [], selfRowBenign = [];
for (const r of pol) {
  const obj = r[2], d = r[3] || '';
  const table = obj.split(' · ')[0];
  if (!/\b(UPDATE|ALL)\b for/.test(d)) continue;
  // remove the common "profiles role lookup" subquery so we only see row-ownership on THIS table
  const stripped = d.replace(/profiles\.\w+/g, '').replace(/EXISTS \( SELECT 1\s*FROM profiles[^)]*\)/gi, '');
  const isSelfRow = SELFROW.test(stripped) && table !== 'profiles';
  const usingHalf = d.split('check:')[0];
  const activeStaff = /is_active\s*=\s*true/.test(d) && !/role/.test(usingHalf) && /\bUPDATE\b for/.test(d);
  if (isSelfRow) {
    (SENSITIVE.test(d) ? selfSensitive : selfRowBenign).push(`${table} :: ${obj.split(' · ').slice(1).join(' · ')}`);
  }
  if (activeStaff) activeStaffNoRole.push(table);
}
console.log('RLS POLICY ANALYSIS (from Query G, offline)\n');
console.log('== Self-row edits on tables with a SENSITIVE column (the profiles.role shape) ==');
if (!selfSensitive.length) console.log('  NONE — no table lets its own subject edit a sensitive column (profiles is guarded by FIX 2).');
else selfSensitive.forEach(x => console.log('  *** REVIEW *** ' + x));
console.log('\n== Self-row edits on tables with NO sensitive column (benign by design) ==');
selfRowBenign.length ? selfRowBenign.forEach(x => console.log('  ok  ' + x)) : console.log('  none');
console.log('\n== Tables any ACTIVE STAFF can UPDATE with no role gate (expected for an internal tool; review separation-of-duties) ==');
[...new Set(activeStaffNoRole)].sort().forEach(t => console.log('  ' + t));
const flagged = selfSensitive.length;
console.log(`\nVerdict: ${flagged ? flagged + ' sensitive self-row policy(ies) need review' : 'no profiles-style self-escalation found'}.`);
process.exit(flagged ? 2 : 0);
