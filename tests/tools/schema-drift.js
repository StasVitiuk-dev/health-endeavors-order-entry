// EXT20 schema drift detector. Reads a production schema export in the Query A
// three-column format (section, item, detail), from Query A
// (docs/ops/sql/00_READONLY_A_schema.sql) and/or Query A2 (08_READONLY_A2_outside_tables.sql),
// and compares it with:
//   * the local real-shape schema the tests run on (01_REAL_SHAPE_schema_for_local_tests.sql);
//   * every table and column the dashboard names (tests/tools/schema-contract.js).
// Findings:
//   FAIL  missing table / missing column the PAGE uses (the page would break in production)
//   WARN  missing column the local schema has but the page does not use; type or NOT NULL
//         differs from the local schema (local tests may not match production)
//   INFO  extra column in production that the local schema does not have
// Columns added by the SQL drafts (client_request_id, run_id) are never assumed to be
// live: if production lacks them that is reported as "draft not installed" (INFO), and
// if the page reads them without its switch that is the schema contract's job.
// Nothing is guessed: a table not in the export is "not exported", not "missing".
//   node tests/tools/schema-drift.js --export a.csv [--export a2.csv] [--json]
// It only reads files. It never connects to any database.
const fs = require('fs');
const path = require('path');
const sc = require('./schema-contract');
const ROOT = path.join(__dirname, '..', '..');
const SCHEMA = path.join(ROOT, 'docs/ops/sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql');

// Minimal CSV reader (quoted fields, doubled quotes, CRLF).
function csvRows(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const TYPE_ALIASES = { int4: 'integer', int: 'integer', int8: 'bigint', bool: 'boolean', timestamptz: 'timestamp with time zone', 'character varying': 'text', varchar: 'text', float8: 'double precision' };
const normType = t => { const s = String(t || '').toLowerCase().replace(/\(.*\)/, '').trim(); return TYPE_ALIASES[s] || s; };

// Production shape from export rows: { exported: Set(table), missing: Set(table), tables: { t: { col: { type, notNull } } } }
function parseExport(text) {
  const out = { exported: new Set(), missing: new Set(), tables: {} };
  for (const r of csvRows(text)) {
    const [section, item, detail] = r.map(x => (x || '').trim());
    if (/^section$|^\?column\?$/i.test(section)) continue; // header
    if (/^0 table missing/.test(section)) { out.missing.add(item); out.exported.add(item); continue; }
    if (/^1 column/.test(section)) {
      const m = /^\d+\s+(\w+)\s+(.+?)(\s+NOT NULL)?(\s+DEFAULT\s.*)?$/.exec(detail);
      if (!m) continue;
      out.exported.add(item);
      (out.tables[item] = out.tables[item] || {})[m[1]] = { type: normType(m[2]), notNull: !!m[3] };
    }
    if (/^4 rls/.test(section)) out.exported.add(item);
  }
  return out;
}

// Local real-shape schema with types and NOT NULL.
function localTyped(text = fs.readFileSync(SCHEMA, 'utf8')) {
  const tables = {};
  for (const m of text.matchAll(/create table (\w+) \(([\s\S]*?)\n\);/gi)) {
    const cols = {};
    for (const line of m[2].split('\n')) {
      const c = /^\s+(\w+)\s+(.+?)\s*,?\s*$/.exec(line);
      if (!c || /^(constraint|primary|unique|foreign|check)$/i.test(c[1])) continue;
      const rest = c[2];
      const type = /^(timestamp with time zone|timestamp without time zone|double precision|character varying(?:\(\d+\))?|\w+(?:\[\])?)/i.exec(rest);
      cols[c[1]] = { type: normType(type ? type[1] : rest.split(' ')[0]).replace(/\[\]$/, ' array'), notNull: /NOT NULL/i.test(rest) || /PRIMARY KEY/i.test(rest) };
    }
    tables[m[1]] = cols;
  }
  for (const m of text.matchAll(/alter table (?:public\.)?(\w+) add column (?:if not exists )?(\w+)\s+([\w ]+?)(?:\s+(?:not null|default|references)[^;]*)?;/gi)) {
    if (tables[m[1]]) tables[m[1]][m[2]] = { type: normType(m[3]), notNull: /not null/i.test(m[0]) };
  }
  return tables;
}
const isArrayType = t => /array$|^array$/.test(t);

function diff(exportsText, opts = {}) {
  const prod = { exported: new Set(), missing: new Set(), tables: {} };
  for (const text of [].concat(exportsText)) {
    const p = parseExport(text);
    p.exported.forEach(x => prod.exported.add(x)); p.missing.forEach(x => prod.missing.add(x));
    Object.assign(prod.tables, p.tables);
  }
  const local = opts.local || localTyped();
  const { uses } = opts.uses ? { uses: opts.uses } : sc.contract();
  const findings = [];
  const add = (level, kind, object, note) => findings.push({ level, kind, object, note });
  const tables = new Set([...Object.keys(uses), ...Object.keys(local)]);
  for (const t of [...tables].sort()) {
    const pageCols = uses[t] ? [...uses[t]] : [];
    if (!prod.exported.has(t)) { add('INFO', 'not exported', t, uses[t] ? 'the page uses it; run Query ' + (sc.OUTSIDE.has(t) ? 'A2' : 'A') + ' to check it' : 'local only'); continue; }
    if (prod.missing.has(t)) {
      add(uses[t] ? 'FAIL' : 'WARN', 'missing table', t, uses[t] ? 'the page reads this table; in production it does not exist' : 'in the local schema, not in production');
      continue;
    }
    const pc = prod.tables[t] || {};
    for (const c of pageCols) {
      if (pc[c]) continue;
      if (sc.DRAFT_COLUMNS.has(c)) add('INFO', 'draft not installed', t + '.' + c, 'added by an SQL draft; must stay behind its switch until installed');
      else add('FAIL', 'missing column', t + '.' + c, 'the page reads it; production has no such column');
    }
    const lc = local[t] || {};
    for (const [c, info] of Object.entries(lc)) {
      if (!pc[c]) { if (!pageCols.includes(c)) add(sc.DRAFT_COLUMNS.has(c) ? 'INFO' : 'WARN', sc.DRAFT_COLUMNS.has(c) ? 'draft not installed' : 'missing column', t + '.' + c, 'in the local test schema, not in production'); continue; }
      const pt = pc[c].type, ltp = info.type;
      if (pt !== ltp && !(isArrayType(pt) && isArrayType(ltp)) && !(pt === 'user-defined')) add('WARN', 'type mismatch', t + '.' + c, `production ${pt}, local ${ltp}`);
      if (pc[c].notNull !== info.notNull) add('WARN', 'nullability mismatch', t + '.' + c, `production ${pc[c].notNull ? 'NOT NULL' : 'nullable'}, local ${info.notNull ? 'NOT NULL' : 'nullable'}`);
    }
    if (local[t]) for (const c of Object.keys(pc)) if (!lc[c]) add('INFO', 'extra column', t + '.' + c, 'production has it; the local test schema does not');
  }
  const overall = findings.some(f => f.level === 'FAIL') ? 'FAIL' : findings.some(f => f.level === 'WARN') ? 'WARN' : 'PASS';
  return { overall, findings, exportedTables: prod.exported.size };
}

if (require.main === module) {
  const files = []; const a = process.argv;
  for (let i = 2; i < a.length; i++) if (a[i] === '--export' && a[i + 1]) files.push(a[++i]);
  if (!files.length) { console.log('usage: node tests/tools/schema-drift.js --export query-a.csv [--export query-a2.csv] [--json]'); process.exit(2); }
  const r = diff(files.map(f => fs.readFileSync(f, 'utf8')));
  if (a.includes('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(r.overall === 'FAIL' ? 1 : 0); }
  for (const f of r.findings.filter(x => x.kind !== 'not exported' || x.note.startsWith('the page'))) console.log(`${f.level.padEnd(4)} ${f.kind}: ${f.object} — ${f.note}`);
  console.log(`SCHEMA DRIFT: ${r.overall} (${r.exportedTables} tables in the export; ${r.findings.filter(f => f.level === 'FAIL').length} FAIL, ${r.findings.filter(f => f.level === 'WARN').length} WARN)`);
  process.exit(r.overall === 'FAIL' ? 1 : 0);
}
module.exports = { diff, parseExport, localTyped, csvRows, normType };
