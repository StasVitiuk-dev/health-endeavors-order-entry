// EXT19 schema contract: every table and column the dashboard names in a
// Supabase call (.from('t') … .select('a, b, rel(c)') / .eq('col') / .order('col')
// / .in('col') / insert/update object keys are not parsed) is compared with
// the local real-shape schema (docs/ops/sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql,
// itself built from the owner's Query A export). Names the page uses that the
// schema does not have are drift: either the page is wrong or the local schema
// is out of date. Known tables outside that export are listed in OUTSIDE.
//   node tests/tools/schema-contract.js           → summary, exit 1 on drift
//   node tests/tools/schema-contract.js --json    → the full contract
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SCHEMA = path.join(ROOT, 'docs/ops/sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql');
// Tables the page uses that are not in the Query A export (EXT8 / Query D): checked in production by Query D, not here.
const OUTSIDE = new Set(['agent_controls', 'ai_decision_log', 'ai_model_config', 'adverse_event_reports', 'business_rules', 'calendar_events', 'calendar_notes',
  'customer_inquiries', 'feature_flags', 'feature_requests', 'incidents', 'integrity_check_results', 'integrity_check_runs', 'legal_holds',
  'manual_attention_items', 'needs_attention', 'owner_dashboard_recent_activity', 'owner_dashboard_summary', 'personal_calendar_events', 'quality_checks',
  'service_status', 'sop_documents', 'system_mode', 'daily_reports']);
// Columns the SQL drafts add (not installed in production): read only when their switch is on.
const DRAFT_COLUMNS = new Set(['client_request_id', 'run_id']);

function schema() {
  const text = fs.readFileSync(SCHEMA, 'utf8');
  const tables = {};
  for (const m of text.matchAll(/create table (\w+) \(([\s\S]*?)\n\);/gi)) {
    tables[m[1]] = new Set([...m[2].matchAll(/^\s+(\w+)\s+(?!KEY|CHECK)\w/gm)].map(x => x[1]).filter(c => !/^(constraint|primary|unique|foreign|check)$/i.test(c)));
  }
  // columns added later in the file
  for (const m of text.matchAll(/alter table (?:public\.)?(\w+) add column (?:if not exists )?(\w+)/gi)) if (tables[m[1]]) tables[m[1]].add(m[2]);
  return tables;
}

function appFiles() {
  return ['assets/owner-login-app.js', 'assets/dashboard-page.js', 'assets/search-page.js', 'assets/manual-order-entry.js', 'assets/change-password.js',
    ...fs.readdirSync(path.join(ROOT, 'assets/app')).filter(f => f.endsWith('.js')).map(f => 'assets/app/' + f)];
}

// columns named in a select list, with relation sub-selects: "id, name, suppliers(name), purchase_order_items(*)"
function parseSelect(sel) {
  const out = { cols: [], rels: [] };
  let depth = 0, cur = '';
  const flush = () => {
    const t = cur.trim(); cur = '';
    if (!t || t === '*') return;
    const rel = /^(?:(\w+):)?(\w+)(?:!\w+)?\s*\(([\s\S]*)\)$/.exec(t);
    if (rel) { out.rels.push({ table: rel[2], sub: parseSelect(rel[3]) }); return; }
    const col = /^(?:\w+:)?(\w+)(?:::\w+)?$/.exec(t);
    if (col) out.cols.push(col[1]);
  };
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) flush(); else cur += ch;
  }
  flush();
  return out;
}

function contract() {
  const uses = {}; // table -> Set(columns)
  const where = {};
  const add = (t, c, at) => { (uses[t] = uses[t] || new Set()); if (c) uses[t].add(c); (where[t + '.' + (c || '')] = where[t + '.' + (c || '')] || at); };
  for (const f of appFiles()) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/\.from\(\s*'(\w+)'\s*\)/g)) {
      const at = f + ':' + (text.slice(0, m.index).split('\n').length);
      const t = m[1];
      add(t, null, at);
      // the rest of this call chain: up to the next statement end
      // (stops at the next .from( so a Promise.all of several queries is not mixed up)
      const tail = text.slice(m.index + m[0].length, m.index + 1200).split(/;\s*\n|\n\s*\n|\.from\(|fetchAllRows/)[0];
      for (const s of tail.matchAll(/\.select\(\s*'([^']*)'/g)) {
        const walk = (table, p) => { p.cols.forEach(c => add(table, c, at)); p.rels.forEach(r => { add(r.table, null, at); walk(r.table, r.sub); }); };
        walk(t, parseSelect(s[1]));
      }
      for (const s of tail.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|in|is|order|ilike|like|not)\(\s*'(\w+)'/g)) add(t, s[1], at);
    }
    // paged readers: fetchAllRows('t', 'cols', q => q…) and fetchAllRowsIn('t', 'cols', 'col', ids)
    for (const m of text.matchAll(/fetchAllRows(In)?\(\s*'(\w+)'\s*,\s*'([^']*)'(?:\s*,\s*'(\w+)')?/g)) {
      const at = f + ':' + (text.slice(0, m.index).split('\n').length);
      const walk = (table, p) => { p.cols.forEach(c => add(table, c, at)); p.rels.forEach(r => { add(r.table, null, at); walk(r.table, r.sub); }); };
      add(m[2], null, at); walk(m[2], parseSelect(m[3])); if (m[4]) add(m[2], m[4], at);
      const tail = text.slice(m.index + m[0].length, m.index + 600).split(/\)\s*\.then|;\s*\n|\n\s*\n|\.from\(|fetchAllRows/)[0];
      for (const s of tail.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|in|is|order|ilike|like|not)\(\s*'(\w+)'/g)) add(m[2], s[1], at);
    }
  }
  return { uses, where };
}

function check() {
  const db = schema();
  const { uses, where } = contract();
  const drift = [], outside = [];
  for (const [t, cols] of Object.entries(uses)) {
    if (!db[t]) { if (OUTSIDE.has(t)) outside.push(t); else drift.push(`unknown table ${t} (${where[t + '.']})`); continue; }
    for (const c of cols) if (!db[t].has(c) && !DRAFT_COLUMNS.has(c)) drift.push(`unknown column ${t}.${c} (${where[t + '.' + c]})`);
  }
  return { tables: Object.keys(uses).length, columns: Object.values(uses).reduce((n, s) => n + s.size, 0), schemaTables: Object.keys(db).length, outside: outside.sort(), drift };
}

if (require.main === module) {
  if (process.argv.includes('--json')) { const { uses } = contract(); console.log(JSON.stringify(Object.fromEntries(Object.entries(uses).map(([t, s]) => [t, [...s].sort()])), null, 1)); process.exit(0); }
  const r = check();
  r.drift.forEach(d => console.log('DRIFT ' + d));
  console.log(`SCHEMA CONTRACT: ${r.drift.length ? 'FAIL (' + r.drift.length + ')' : 'PASS'} (${r.tables} tables, ${r.columns} columns named by the page; ${r.schemaTables} tables in the local real-shape schema; ${r.outside.length} known tables outside the Query A export)`);
  process.exit(r.drift.length ? 1 : 0);
}
module.exports = { check, contract, schema, parseSelect, OUTSIDE, DRAFT_COLUMNS };
