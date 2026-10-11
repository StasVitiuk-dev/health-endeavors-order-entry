// Read-only query result interpreter (EXT10b, missions 90-92). Works on a CSV
// downloaded from Supabase (SQL Editor -> Export -> CSV); no database
// connection, nothing sent anywhere. Prints one line per row with PASS /
// WARN / FAIL / INFO / UNKNOWN and an overall verdict, and warns when the
// file seems to hold personal data (an e-mail address) that should not be
// stored in this public repository.
//   node tests/tools/interpret-query-results.js <D|E|F|G|H> <file.csv> [--run-date YYYY-MM-DD]
// Query C has no pass/fail meaning (it is an inventory): use it as reading.
const fs = require('fs');

// RFC 4180 CSV (quotes, doubled quotes, commas and line breaks inside quotes).
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  return rows.filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
}
const RANK = { PASS: 0, INFO: 0, 'NOT INSTALLED': 0, UNKNOWN: 1, WARN: 2, FAIL: 3 };
const RULES = {
  // Query H: the query already says it
  H: r => ({ name: r.id + ' ' + r.item, status: (r.status || 'UNKNOWN').toUpperCase(), note: r.action }),
  // Query G: level column
  G: r => ({ name: r.check_id + (r.object ? ' ' + r.object : ''), status: (r.level || 'UNKNOWN').toUpperCase(), note: r.detail }),
  // Query F: findings count; wrong references / impossible values are FAIL
  F: r => {
    const n = Number(r.findings);
    if (r.findings === '' || !Number.isFinite(n)) return { name: r.section + ' ' + r.check_name, status: 'UNKNOWN', note: 'count unreadable' };
    return { name: r.section + ' ' + r.check_name, status: n === 0 ? 'PASS' : /wrong thing|impossible/i.test(r.section) ? 'FAIL' : 'WARN', note: n ? n + ' found' : '' };
  },
  // Query E: "0" / "none" pass; information rows and lists are INFO
  E: r => {
    const v = String(r.result || '').trim();
    const info = /information|first 25/i.test(r.check_name || '');
    if (v === '0' || v === 'none') return { name: r.section + ' ' + r.check_name, status: 'PASS', note: '' };
    if (info) return { name: r.section + ' ' + r.check_name, status: 'INFO', note: v.slice(0, 120) };
    if (/no items/i.test(r.check_name || '')) return { name: r.section + ' ' + r.check_name, status: 'WARN', note: v + ' (owner decision X6-14)' };
    return { name: r.section + ' ' + r.check_name, status: v === '' ? 'UNKNOWN' : 'FAIL', note: v.slice(0, 120) };
  },
  // Query D: classification letter
  D: r => {
    const c = String(r.classification || '');
    const status = /^E /.test(c) ? 'FAIL' : /^D /.test(c) ? 'WARN' : /^C /.test(c) ? 'WARN' : /^[AB] /.test(c) ? 'PASS' : 'UNKNOWN';
    return { name: r.function_name, status, note: c + (status === 'WARN' ? ' — read this function next' : '') };
  },
};
const COLUMNS = { H: ['id', 'item', 'status'], G: ['check_id', 'level'], F: ['section', 'check_name', 'findings'], E: ['section', 'check_name', 'result'], D: ['function_name', 'classification'] };
function interpret(letter, text) {
  const L = String(letter).toUpperCase();
  const rule = RULES[L];
  if (!rule) throw new Error('Query ' + letter + ' has no pass/fail reading (Query C is an inventory: read it as it is).');
  const parsed = parseCsv(text);
  const head = (text.split(/\r?\n/)[0] || '').toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const missing = COLUMNS[L].filter(c => !head.includes(c));
  if (missing.length) throw new Error('This file does not look like a Query ' + L + ' result (missing columns: ' + missing.join(', ') + '). If the query stopped with an error, send a screenshot of the error instead.');
  const rows = parsed.map(rule);
  const worst = rows.reduce((w, r) => (RANK[r.status] === undefined ? 'UNKNOWN' : RANK[r.status] > RANK[w] ? r.status : w), rows.length ? 'PASS' : 'UNKNOWN');
  const privacy = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text) ? 'WARNING: this file contains an e-mail address. Do not commit it; send only the summary.' : 'No e-mail addresses found.';
  return { rows, overall: rows.length ? worst : 'UNKNOWN', privacy };
}
module.exports = { parseCsv, interpret };

if (require.main === module) {
  const [letter, file] = process.argv.slice(2);
  const dIdx = process.argv.indexOf('--run-date');
  if (!letter || !file) { console.error('usage: node tests/tools/interpret-query-results.js <D|E|F|G|H> <file.csv> [--run-date YYYY-MM-DD]'); process.exit(2); }
  let res;
  try { res = interpret(letter, fs.readFileSync(file, 'utf8')); }
  catch (e) { console.log('UNKNOWN: ' + e.message); process.exit(2); }
  console.log('Query ' + letter.toUpperCase() + ' result from ' + file + (dIdx > 0 ? ' (run ' + process.argv[dIdx + 1] + ')' : ' (run date not given)'));
  for (const r of res.rows) console.log(r.status.padEnd(13) + ' ' + r.name + (r.note ? ' — ' + r.note : ''));
  console.log('OVERALL: ' + res.overall + '   (' + res.rows.length + ' rows)');
  console.log(res.privacy);
  process.exitCode = res.overall === 'FAIL' ? 1 : 0;
}
