// SQL package linter (EXT14). Every SQL file under docs/ops/sql must be listed
// in docs/ops/sql/MANIFEST.json, live in the folder its class allows, and pass
// the safety rules for that class. Change drafts carry a metadata header that
// is generated from the manifest, so the two cannot drift apart.
//
//   node tests/tools/sql-lint.js            check everything (exit 1 on any problem)
//   node tests/tools/sql-lint.js --graph    print the install / rollback graph
//   node tests/tools/sql-lint.js --headers  (re)write the metadata headers from the manifest
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SQL = path.join(ROOT, 'docs', 'ops', 'sql');
const BEGIN = '-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@';
const END = '-- @@ end metadata @@';
const WARN = /approval|DO NOT RUN|NOT INSTALLED|NOT FOR PRODUCTION/i;
const WRITE = /^\s*(insert|update|delete|drop|alter|create|grant|revoke|truncate|comment\s+on|reindex|vacuum|cluster)\b/i;

function loadManifest(file = path.join(SQL, 'MANIFEST.json')) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function listSql(dir = SQL, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...listSql(path.join(dir, e.name), rel));
    else if (e.name.endsWith('.sql')) out.push(rel);
  }
  return out.sort();
}
// Remove comments and string literals (keeps dollar-quoted bodies: they are code).
function strip(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
}
const statements = sql => strip(sql).split(';').map(s => s.trim()).filter(Boolean);

function headerFor(c) {
  const lines = [BEGIN,
    `-- @migration:   ${c.id}   (${c.class}${c.step ? ', step ' + c.step : ''}${c.rollbackOf ? ', rolls back ' + c.rollbackOf : ''})`,
    '-- @environment: production only after the owner\'s written approval; tested on the local throwaway database',
    `-- @depends-on:  ${c.dependsOn && c.dependsOn.length ? c.dependsOn.join(', ') : 'none'}`,
    `-- @risk:        ${c.risk}`,
    `-- @precheck:    ${c.precheck}`,
    `-- @effect:      ${c.effect}`,
    `-- @postcheck:   ${c.postcheck}`,
    `-- @rollback:    ${c.rollback ? 'drafts/' + c.rollback : c.rollbackOf ? '(this file is the rollback of drafts/' + c.rollbackOf + ')' : 'none'}`,
    END];
  return lines.join('\n');
}
function writeHeaders(m = loadManifest()) {
  const changed = [];
  for (const c of m.changes) {
    const p = path.join(SQL, c.file);
    let t = fs.readFileSync(p, 'utf8');
    const block = headerFor(c);
    // remove an old block, then put the new one right after the file's own warning line
    t = t.replace(new RegExp(escapeRe(BEGIN) + '[\\s\\S]*?' + escapeRe(END) + '\\n'), '');
    const lines = t.split('\n');
    let at = lines.slice(0, 12).findIndex(l => WARN.test(l));
    if (at < 0) at = 0;
    lines.splice(at + 1, 0, block);
    t = lines.join('\n');
    if (t !== fs.readFileSync(p, 'utf8')) { fs.writeFileSync(p, t); changed.push(c.file); }
  }
  return changed;
}
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lint(m = loadManifest(), files = listSql(), dir = SQL) {
  const problems = [];
  const P = (file, msg) => problems.push(file + ': ' + msg);
  const entries = [
    ...m.readonly.map(r => ({ ...r, class: 'PRODUCTION-READONLY' })),
    ...m.changes,
    ...m.local,
  ];
  const byFile = new Map();
  for (const e of entries) { if (byFile.has(e.file)) P(e.file, 'listed twice in the manifest'); byFile.set(e.file, e); }
  for (const f of files) if (!byFile.has(f)) P(f, 'not listed in MANIFEST.json');
  for (const e of entries) if (!files.includes(e.file)) P(e.file, 'listed in MANIFEST.json but the file does not exist');

  for (const f of files) {
    const e = byFile.get(f); if (!e) continue;
    const folder = path.posix.dirname('docs/ops/sql/' + f);
    const allowed = m.folders[folder] || [];
    if (!allowed.includes(e.class)) P(f, `${e.class} is not allowed in ${folder}`);
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    // the first lines of the file's own text (the generated block does not count)
    const head = text.replace(new RegExp(escapeRe(BEGIN) + '[\\s\\S]*?' + escapeRe(END) + '\\n?'), '').split('\n').slice(0, 6).join('\n');
    const stmts = statements(text);
    const writes = stmts.filter(s => (WRITE.test(s) || /^\s*execute\b/i.test(s.split('\n').pop()) || /\bexecute\s+format\s*\(/i.test(s)) && !/^\s*create\s+temp(orary)?\b/i.test(s));

    if (e.class === 'PRODUCTION-READONLY') {
      if (!/^\d\d_READONLY_/.test(path.basename(f))) P(f, 'read-only file name must start NN_READONLY_');
      if (!/READ[- ]ONLY/i.test(head)) P(f, 'no READ-ONLY banner in the first lines');
      if (writes.length) P(f, 'read-only file contains a write statement: ' + writes[0].slice(0, 60));
    }
    if (e.class === 'PRODUCTION-CHANGE-DRAFT' || e.class === 'ROLLBACK') {
      if (!/DRAFT/.test(path.basename(f))) P(f, 'change/rollback file name must contain DRAFT');
      if (!WARN.test(head)) P(f, 'no owner-approval / DO NOT RUN warning in the first lines');
      if (!writes.length) P(f, 'change draft contains no write statement (a read-only query stored in drafts/?)');
      if (!/^\s*begin\b/im.test(strip(text))) P(f, 'missing BEGIN (must run as one transaction)');
      if (!/^\s*commit\b/im.test(strip(text))) P(f, 'missing COMMIT');
      if (/security\s+definer/i.test(strip(text))) P(f, 'SECURITY DEFINER is not allowed');
      const fnHeads = strip(text).split(/create\s+(?:or\s+replace\s+)?function/i).slice(1);
      for (const h of fnHeads) { const decl = h.split(/\bas\s+\$/i)[0]; if (!/set\s+search_path/i.test(decl)) P(f, 'a function without SET search_path'); }
      for (const s of stmts) {
        if (/^(update)\b/i.test(s) && !/\bwhere\b/i.test(s)) P(f, 'UPDATE without WHERE: ' + s.slice(0, 60));
        if (/^(delete\s+from)\b/i.test(s) && !/\bwhere\b/i.test(s)) P(f, 'DELETE without WHERE: ' + s.slice(0, 60));
        if (/^drop\b/i.test(s) && !/\bif\s+exists\b/i.test(s)) P(f, 'DROP without IF EXISTS: ' + s.slice(0, 60));
        if (/^grant\b/i.test(s) && /\bto\s+(public|anon)\b/i.test(s)) P(f, 'GRANT to public/anon: ' + s.slice(0, 60));
        if (/^truncate\b/i.test(s)) P(f, 'TRUNCATE is not allowed in a draft');
      }
      if (/\bexecute\s+(format|'|\w+\s*\|\|)/i.test(text) && !e.dynamicSql) P(f, 'dynamic SQL (EXECUTE) without a dynamicSql justification in the manifest');
      if (!text.includes(BEGIN) || !text.includes(headerFor(e))) P(f, 'metadata header missing or out of date (run npm run sql:headers)');
      for (const k of ['precheck', 'effect', 'postcheck', 'risk']) if (!e[k]) P(f, 'manifest entry has no ' + k);
    }
    if (e.class === 'PRODUCTION-CHANGE-DRAFT') {
      const rb = m.changes.find(c => c.id === e.rollback);
      if (!rb) P(f, 'no rollback draft (rollback id ' + e.rollback + ')');
      else if (rb.rollbackOf !== e.id) P(f, 'rollback ' + rb.id + ' does not point back to ' + e.id);
    }
    if (e.class === 'ROLLBACK' && !m.changes.some(c => c.id === e.rollbackOf && c.class === 'PRODUCTION-CHANGE-DRAFT')) P(f, 'rolls back an unknown change ' + e.rollbackOf);
    if ((e.class === 'LOCAL-TEST' || e.class === 'FIXTURE') && writes.length && !/LOCAL|NEVER RUN ON SUPABASE|throwaway|rolls? back|ROLLBACK/i.test(text.split('\n').slice(0, 12).join('\n'))) P(f, 'local file that writes must say LOCAL ONLY in its first lines');
  }
  // dependency graph: every reference exists, no cycles
  const ids = new Map(m.changes.map(c => [c.id, c]));
  for (const c of m.changes) for (const d of c.dependsOn || []) if (!ids.has(d)) P(c.file, 'depends on unknown draft ' + d);
  const order = topo(m.changes, problems);
  return { problems, order };
}
function topo(changes, problems) {
  const ids = new Map(changes.map(c => [c.id, c]));
  const state = {}; const out = [];
  const visit = (id, trail) => {
    if (state[id] === 2) return;
    if (state[id] === 1) { problems.push('dependency cycle: ' + [...trail, id].join(' → ')); return; }
    state[id] = 1;
    for (const d of (ids.get(id) || {}).dependsOn || []) if (ids.has(d)) visit(d, [...trail, id]);
    state[id] = 2; out.push(id);
  };
  for (const c of changes.filter(x => x.class === 'PRODUCTION-CHANGE-DRAFT')) visit(c.id, []);
  return out;
}
function graph(m = loadManifest()) {
  const lines = ['Install graph (draft → needs):'];
  for (const c of m.changes.filter(x => x.class === 'PRODUCTION-CHANGE-DRAFT')) lines.push(`  ${c.id.padStart(2)} ${c.step.padEnd(28)} needs: ${(c.dependsOn || []).join(', ') || '—'}   rollback: ${c.rollback}`);
  lines.push('Rollback graph (rollback → roll back first):');
  for (const c of m.changes.filter(x => x.class === 'ROLLBACK')) lines.push(`  ${c.id.padStart(2)} undoes ${c.rollbackOf.padEnd(3)} first: ${(c.dependsOn || []).join(', ') || '—'}`);
  return lines.join('\n');
}
module.exports = { loadManifest, listSql, lint, headerFor, writeHeaders, statements, strip, graph, BEGIN, END };

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--headers') { const ch = writeHeaders(); console.log(ch.length ? 'Updated headers: ' + ch.join(', ') : 'Headers already up to date.'); }
  else if (arg === '--graph') console.log(graph());
  else {
    const { problems, order } = lint();
    for (const p of problems) console.log('PROBLEM ' + p);
    console.log(problems.length ? problems.length + ' problem(s).' : 'OK: ' + listSql().length + ' SQL files, all classified and safe. Install order (dependencies first): ' + order.join(' → '));
    process.exitCode = problems.length ? 1 : 0;
  }
}
