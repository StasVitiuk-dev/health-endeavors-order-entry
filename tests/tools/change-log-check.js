#!/usr/bin/env node
// Validates docs/ops/PRODUCTION_CHANGE_LOG.md: every "## <date> · FIX ..." entry
// must carry the required evidence rows. Fails loudly (exit 1) if any is missing,
// so a future entry cannot be recorded without approval/rollback/verification.
const fs = require('fs');
const path = 'docs/ops/PRODUCTION_CHANGE_LOG.md';
const src = fs.readFileSync(path, 'utf8');
// Each production entry begins "## <date> · ". Split on that heading.
const parts = src.split(/\n## /).slice(1).filter(s => /^\d{4}-\d{2}-\d{2} · /.test(s));
const required = [
  { name: 'approved/run by', re: /approved and run by/i },
  { name: 'purpose (Found by / What the fix does)', re: /found by|what the fix does/i },
  { name: 'precondition/tested before', re: /tested before|precondition/i },
  { name: 'exact SQL', re: /```sql[\s\S]*?```/i },
  { name: 'rollback', re: /rollback/i },
  { name: 'verification result', re: /result[\s\S]{0,60}(reported|checked|returned|verif)/i },
  { name: 'downtime', re: /downtime/i },
  { name: 'dashboard impact', re: /dashboard change|dashboard impact/i },
];
let failed = 0;
if (parts.length === 0) { console.error('change-log-check: no production entries found'); process.exit(1); }
for (const p of parts) {
  const title = p.split('\n')[0].trim();
  const missing = required.filter(r => !r.re.test(p)).map(r => r.name);
  if (missing.length) { failed++; console.error(`FAIL  ${title}\n      missing: ${missing.join('; ')}`); }
  else console.log(`ok    ${title}`);
}
if (failed) { console.error(`\nchange-log-check: ${failed} entr${failed===1?'y':'ies'} missing required evidence`); process.exit(1); }
console.log(`\nchange-log-check: ${parts.length} entr${parts.length===1?'y':'ies'}, all carry required evidence`);
