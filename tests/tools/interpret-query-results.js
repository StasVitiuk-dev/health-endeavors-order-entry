// Read-only query result interpreter (EXT10b, missions 90-92). Works on a CSV
// downloaded from Supabase (SQL Editor -> Export -> CSV); no database
// connection, nothing sent anywhere. Prints one line per row with PASS /
// WARN / FAIL / INFO / UNKNOWN and an overall verdict, and warns when the
// file seems to hold personal data (an e-mail address) that should not be
// stored in this public repository.
//   node tests/tools/interpret-query-results.js <D|E|F|G|H> <file.csv> [--run-date YYYY-MM-DD]
// Query C has no pass/fail meaning (it is an inventory): use it as reading.
//
// EXT11: one summary for a whole read-only session (missions 17, 19-24, 10):
//   node tests/tools/interpret-query-results.js session --env production --run-date 2026-10-15 \
//     [--D d.csv] [--E e.csv] [--F f.csv] [--G g.csv] [--H h.csv] \
//     [--backup-nightly green:2026-10-14] [--backup-restore green:2026-10-01] [--backup-minutes ok|out]
// --env is required (production / staging / local); anything else stops with
// UNKNOWN: a result whose environment is not known proves nothing.
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
// EXT11: backup answer intake (V1). Thresholds from PRODUCTION_READONLY_VERIFICATION_EXT10 §1:
// nightly backup <= 2 days old, restore test <= 35 days old, Actions minutes left.
const DAY = 86400000;
const toDay = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').trim()); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
function parseRun(v) {
  const m = /^(green|red):(\d{4}-\d{2}-\d{2})$/i.exec(String(v || '').trim());
  return m ? { color: m[1].toLowerCase(), day: toDay(m[2]) } : null;
}
function backupStatus({ nightly, restore, minutes, checkedOn }) {
  const n = parseRun(nightly), r = parseRun(restore), today = toDay(checkedOn);
  if (!n || !r || !today || !/^(ok|out)$/i.test(String(minutes || ''))) return { status: 'UNKNOWN', why: 'answer incomplete: need nightly and restore as green|red:YYYY-MM-DD, minutes ok|out, and the date checked', expires: null };
  if (n.color === 'red' || r.color === 'red') return { status: 'FAILED', why: (n.color === 'red' ? 'newest nightly backup is red' : 'newest restore test is red'), expires: null };
  if (String(minutes).toLowerCase() === 'out') return { status: 'STALE', why: 'Actions minutes have run out, so the schedule will stop', expires: null };
  const nAge = (today - n.day) / DAY, rAge = (today - r.day) / DAY;
  if (nAge < 0 || rAge < 0) return { status: 'UNKNOWN', why: 'a run date is after the date checked', expires: null };
  if (nAge > 2 || rAge > 35) return { status: 'STALE', why: 'nightly ' + nAge + ' days old (limit 2), restore test ' + rAge + ' days old (limit 35)', expires: null };
  return { status: 'VERIFIED HEALTHY', why: 'nightly ' + nAge + ' days old, restore test ' + rAge + ' days old', expires: new Date(today + 7 * DAY).toISOString().slice(0, 10) };
}
// EXT11: how long a result may be used for planning (evidence expiry).
// backups 7 days; the queries 30 days; a function fingerprint and the drift
// check must be re-run after ANY production step, whatever their age.
const EVIDENCE_DAYS = { backup: 7, C: 30, D: 30, E: 30, F: 30, G: 30, H: 30 };
function evidenceAge(kind, runDate, today) {
  const a = toDay(runDate), t = toDay(today);
  if (a === null || t === null) return 'UNKNOWN';
  const limit = EVIDENCE_DAYS[kind];
  if (!limit) return 'UNKNOWN';
  return (t - a) / DAY <= limit ? 'CURRENT' : 'STALE';
}
const ENVIRONMENTS = ['production', 'staging', 'local'];
function sessionSummary({ env, runDate, results, backup }) {
  if (!ENVIRONMENTS.includes(String(env || '').toLowerCase())) {
    return { overall: 'UNKNOWN', lines: ['UNKNOWN: the environment was not stated (use --env production, staging or local). A result whose environment is not known proves nothing.'] };
  }
  if (!toDay(runDate)) return { overall: 'UNKNOWN', lines: ['UNKNOWN: --run-date YYYY-MM-DD is required.'] };
  const lines = ['Read-only session — environment: ' + String(env).toUpperCase() + ', run ' + runDate];
  let worst = 'PASS';
  const bump = st => { if ((RANK[st] === undefined ? 1 : RANK[st]) > RANK[worst]) worst = RANK[st] === undefined ? 'UNKNOWN' : st; };
  for (const L of ['D', 'E', 'F', 'G', 'H']) {
    if (!results[L]) { lines.push('Query ' + L + ': NOT RUN'); continue; }
    let r;
    try { r = interpret(L, results[L]); } catch (e) { lines.push('Query ' + L + ': UNKNOWN — ' + e.message); bump('UNKNOWN'); continue; }
    lines.push('Query ' + L + ': ' + r.overall + ' (' + r.rows.length + ' rows)' + (/WARNING/.test(r.privacy) ? ' — ' + r.privacy : ''));
    bump(r.overall);
  }
  if (backup) {
    const b = backupStatus(Object.assign({ checkedOn: runDate }, backup));
    lines.push('Backups (V1): ' + b.status + ' — ' + b.why + (b.expires ? '; re-check by ' + b.expires + ' and on the day of any production step' : ''));
    bump(b.status === 'VERIFIED HEALTHY' ? 'PASS' : b.status === 'STALE' ? 'WARN' : b.status === 'FAILED' ? 'FAIL' : 'UNKNOWN');
  } else { lines.push('Backups (V1): NOT CHECKED'); bump('UNKNOWN'); }
  if (String(env).toLowerCase() !== 'production') lines.push('NOTE: this was not production, so it does not verify production.');
  lines.push('OVERALL: ' + worst);
  return { overall: worst, lines };
}
module.exports = { parseCsv, interpret, backupStatus, evidenceAge, sessionSummary, EVIDENCE_DAYS };

if (require.main === module && process.argv[2] === 'session') {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const results = {};
  for (const L of ['D', 'E', 'F', 'G', 'H']) if (arg('--' + L)) results[L] = fs.readFileSync(arg('--' + L), 'utf8');
  const backup = arg('--backup-nightly') || arg('--backup-restore') ? { nightly: arg('--backup-nightly'), restore: arg('--backup-restore'), minutes: arg('--backup-minutes') } : null;
  const res = sessionSummary({ env: arg('--env'), runDate: arg('--run-date'), results, backup });
  console.log(res.lines.join('\n'));
  process.exitCode = res.overall === 'FAIL' ? 1 : res.overall === 'UNKNOWN' ? 2 : 0;
} else if (require.main === module) {
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
