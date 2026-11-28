#!/usr/bin/env node
// The dashboard's calls to database functions, checked against the functions the SQL drafts define
// (Nov 28). For every call written as rpc('name', { p_... }), rpc('name') with no values, callStockFunction('name', { p_... }),
// or through a constant (RPC.x, or const NAME = 'fn'), the function must exist in a draft with every
// argument name the page sends, and the page must send every argument that has no default. A draft
// that renames an argument, or a page that misspells one, fails here before anything is installed.
// Calls to functions no draft defines (production's own, such as employee_activity) are listed, not
// judged. Reads files only. Usage: node tests/tools/rpc-contract.js [--json]
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function splitTop(s) {
  const out = []; let d = 0, cur = '', q = false;
  for (const ch of s) {
    if (ch === "'") q = !q;
    if (!q && ch === '(') d++;
    if (!q && ch === ')') d--;
    if (!q && d === 0 && ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// { name: [{ file, params: [{ name, opt }] }] } from SQL text (rollback files are skipped by the caller)
function definitions(sqlByFile) {
  const defs = {};
  for (const [file, text] of Object.entries(sqlByFile)) {
    const s = text.replace(/--[^\n]*/g, '');
    const re = /create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(/gi; let m;
    while ((m = re.exec(s))) {
      let j = re.lastIndex, d = 1;
      while (d && j < s.length) { if (s[j] === '(') d++; if (s[j] === ')') d--; j++; }
      const params = splitTop(s.slice(re.lastIndex, j - 1)).map(p => p.trim()).filter(Boolean)
        .map(p => ({ name: p.split(/\s+/)[0].toLowerCase(), opt: /\bdefault\b|=/i.test(p) }));
      (defs[m[1]] = defs[m[1]] || []).push({ file, params });
    }
  }
  return defs;
}

// [{ file, line, name, keys }] from JavaScript text
function calls(jsByFile) {
  const out = [];
  for (const [file, s] of Object.entries(jsByFile)) {
    const consts = {};
    const mm = s.match(/const RPC = \{([^}]*)\}/);
    if (mm) for (const kv of mm[1].split(',')) { const k = kv.split(':'); if (k[1] && /^\s*'\w+'\s*$/.test(k[1])) consts['RPC.' + k[0].trim()] = k[1].trim().replace(/'/g, ''); }
    for (const c of s.matchAll(/\b([A-Z][A-Z0-9_]*) = '(\w+)'/g)) consts[c[1]] = c[2];   // const RPC = 'fn' (also in a comma list)
    const re = /(?:\.rpc|callStockFunction|\bcall)\(\s*(?:[^,()]+,\s*)?(?:'(\w+)'|(RPC\.\w+|\w+))\s*,\s*(?:versionArgs\()?\{([^{}]*)\}/g; let m;
    while ((m = re.exec(s))) {
      const name = m[1] || consts[m[2]];
      if (!name) continue;
      const body = m[3];
      const keys = new Set();
      for (const k of body.matchAll(/\b(p_\w+)\s*:/g)) keys.add(k[1]);
      for (const k of body.matchAll(/(?:^|,)\s*(p_\w+)\s*(?=,|$)/g)) keys.add(k[1]);   // shorthand { p_x }
      out.push({ file, line: s.slice(0, m.index).split('\n').length, name, keys: [...keys] });
    }
    // calls that send no values at all: rpc('fn') (every argument of its draft must then have a default)
    for (const c of s.matchAll(/\.rpc\(\s*'(\w+)'\s*\)/g)) out.push({ file, line: s.slice(0, c.index).split('\n').length, name: c[1], keys: [] });
    // install probes written as ['fn', { p_... }] pairs (he-data.js: the stock steps' switches)
    for (const p of s.matchAll(/\[\s*'(\w+)'\s*,\s*\{([^{}]*)\}\s*\]/g)) {
      const keys = [...new Set([...p[2].matchAll(/\b(p_\w+)\s*:/g)].map(k => k[1]))];
      if (keys.length) out.push({ file, line: s.slice(0, p.index).split('\n').length, name: p[1], keys });
    }
  }
  return out;
}

function check(defs, found) {
  const problems = [], notDraft = new Set(); let checked = 0;
  for (const c of found) {
    const ds = defs[c.name];
    if (!ds) { notDraft.add(c.name); continue; }
    checked++;
    const fits = ds.some(d => c.keys.every(k => d.params.some(p => p.name === k)) && d.params.filter(p => !p.opt).every(p => c.keys.includes(p.name)));
    if (!fits) problems.push(c.file + ':' + c.line + ' ' + c.name + '(' + c.keys.join(', ') + ') but ' +
      ds.map(d => d.file + ' defines (' + d.params.map(p => p.name + (p.opt ? ' (optional)' : '')).join(', ') + ')').join(' or '));
  }
  return { checked, problems, notDraft: [...notDraft].sort() };
}

function readRepo(root) {
  const D = path.join(root, 'docs', 'ops', 'sql', 'drafts');
  const sql = {};
  for (const f of fs.readdirSync(D).filter(f => /\.sql$/.test(f) && !/rollback/i.test(f))) sql['drafts/' + f] = fs.readFileSync(path.join(D, f), 'utf8');
  const js = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) js[path.relative(root, p)] = fs.readFileSync(p, 'utf8');
    }
  })(path.join(root, 'assets'));
  return { sql, js };
}

function run(root) {
  const { sql, js } = readRepo(root || ROOT);
  const found = calls(js);
  return Object.assign({ calls: found.length }, check(definitions(sql), found));
}

module.exports = { definitions, calls, check, run };

if (require.main === module) {
  const r = run(ROOT);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log('database function calls found in the dashboard: ' + r.calls + '; checked against the drafts: ' + r.checked);
    console.log('functions not from a draft (production\'s own, not judged): ' + (r.notDraft.join(', ') || 'none'));
    console.log(r.problems.length ? 'MISMATCH:\n  ' + r.problems.join('\n  ') : 'every checked call matches its draft');
  }
  process.exit(r.problems.length ? 1 : 0);
}
