// Owner evidence intake (EXT12). LOCAL ONLY: reads a file or a typed answer
// the owner sends back, never connects to any database or service.
//
//   node tests/tools/evidence.js interpret <TYPE> <file> --env production --run-date 2026-10-15
//       read and judge only (nothing stored)
//   node tests/tools/evidence.js intake <TYPE> <file> --env production --run-date 2026-10-15 \
//       --operator Stas [--version <query fingerprint prefix>]
//       judge, then append ONE sanitized line to docs/ops/evidence/ledger.jsonl
//   node tests/tools/evidence.js status            latest state of every evidence type
//   node tests/tools/evidence.js diff <TYPE>       last two results of one type
//
// TYPE: BACKUP QUERY_C QUERY_D QUERY_E QUERY_F QUERY_G QUERY_H AGENT_STATUS
//       GITHUB_ACCESS REAL_DEVICE OWNER_DECISION ACCOUNTANT_DECISION
//       LAWYER_DECISION PROVIDER_DECISION AGENT_SOURCE
// Status words: NOT RECEIVED · RECEIVED · MALFORMED · INCOMPLETE · CONFLICT ·
// PASS · WARN · FAIL · UNKNOWN · STALE. Nothing is ever inferred as PASS: a
// verdict comes only from the content, and anything unreadable is UNKNOWN.
// A file containing a key or token is refused and NOT stored; e-mail
// addresses are replaced by [email] before anything is stored (public repo).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Q = require('./interpret-query-results');

const ROOT = path.resolve(__dirname, '..', '..');
const LEDGER = path.join(ROOT, 'docs', 'ops', 'evidence', 'ledger.jsonl');
const TYPES = ['BACKUP', 'QUERY_C', 'QUERY_D', 'QUERY_E', 'QUERY_F', 'QUERY_G', 'QUERY_H', 'AGENT_STATUS', 'GITHUB_ACCESS', 'REAL_DEVICE',
  'OWNER_DECISION', 'ACCOUNTANT_DECISION', 'LAWYER_DECISION', 'PROVIDER_DECISION', 'AGENT_SOURCE'];
const ENVIRONMENTS = ['production', 'staging', 'local'];
const DAY = 86400000;
// How long a result may be used for planning (null = until superseded).
// Query H and the fingerprint must also be re-run after EVERY production step
// (DEPLOYMENT_SIMULATION_EXT12.md); a decision stays valid until changed.
const STALE_DAYS = { BACKUP: 7, QUERY_C: 30, QUERY_D: 30, QUERY_E: 30, QUERY_F: 30, QUERY_G: 30, QUERY_H: 30, AGENT_STATUS: 30,
  GITHUB_ACCESS: 90, REAL_DEVICE: null, OWNER_DECISION: null, ACCOUNTANT_DECISION: null, LAWYER_DECISION: null, PROVIDER_DECISION: null, AGENT_SOURCE: null };

// ---------- privacy ----------
const SECRET_PATTERNS = [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /\bsk_(live|test)_[A-Za-z0-9]{8,}/, /\bsbp_[A-Za-z0-9]{20,}/, /\bghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bxox[bp]-[A-Za-z0-9-]{10,}/,
  /service[_]role[^\n]{0,20}[:=]\s*\S{16,}/i, /\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}/i];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
function privacyCheck(text) {
  const t = String(text || '');
  const secret = SECRET_PATTERNS.some(re => re.test(t));
  return { secret, emails: (t.match(EMAIL) || []).length, redacted: t.replace(EMAIL, '[email]') };
}

// ---------- Query C (an inventory: judged only on completeness and a few facts) ----------
const C_SECTIONS = ['0 counts', '1 agents', '2 switches', '3 agent #1 invoices', '4 shopify sync', '5 scheduled jobs', '6 stock writers',
  '7 triggers', '8 direct writes', '9 value rules', '10 audit coverage'];
// Tables whose changes must be traceable (ENGINEERING_CATALOG_EXT11.md §3).
const AUDIT_REQUIRED = ['tasks', 'orders', 'inventory', 'inventory_adjustments', 'purchase_orders', 'returns', 'recalls', 'products', 'approval_requests',
  'business_rules', 'feature_flags', 'system_mode'];
function interpretC(text) {
  const head = (String(text).split(/\r?\n/)[0] || '').toLowerCase().replace(/"/g, '').split(',').map(s => s.trim());
  if (!['section', 'item', 'result'].every(c => head.includes(c))) {
    return { status: /permission denied|timeout|canceling statement/i.test(text) ? 'UNKNOWN' : 'MALFORMED', rows: [], note: 'not a Query C result (expected columns section, item, result); if the query stopped with an error, send a screenshot of it' };
  }
  const rows = Q.parseCsv(text);
  const present = new Set(rows.map(r => r.section));
  const missing = C_SECTIONS.filter(s => !present.has(s));
  const out = [];
  for (const r of rows.filter(r => r.section === '1 agents')) {
    const sw = (/switch=([A-Za-z]+)/.exec(r.result) || [])[1] || 'unknown';
    const st = (/last_run_status=([A-Za-z]+)/.exec(r.result) || [])[1] || 'none';
    const status = /^(error|failed)$/i.test(st) ? 'WARN' : sw.toLowerCase() === 'unknown' ? 'UNKNOWN' : 'PASS';
    out.push({ name: r.item, status, note: 'switch ' + sw + ', last run ' + st });
  }
  for (const r of rows.filter(r => r.section === '10 audit coverage')) {
    if (!AUDIT_REQUIRED.includes(r.item)) continue;
    const none = /audit_trigger=NONE/i.test(r.result);
    out.push({ name: 'audit ' + r.item, status: none ? 'WARN' : 'PASS', note: none ? 'no audit trigger (who/when columns only)' : (/audit_trigger=([^;]+)/.exec(r.result) || [])[1] });
  }
  for (const t of AUDIT_REQUIRED) if (present.has('10 audit coverage') && !rows.some(r => r.section === '10 audit coverage' && r.item === t)) out.push({ name: 'audit ' + t, status: 'UNKNOWN', note: 'table not listed' });
  const writers = rows.filter(r => r.section === '6 stock writers' && !/^none|no functions/i.test(r.result));
  if (writers.length) out.push({ name: 'other stock writers', status: 'WARN', note: writers.length + ' function(s) write stock tables: read them before installing R1–R5' });
  let status = missing.length ? 'INCOMPLETE' : out.some(r => r.status === 'WARN') ? 'WARN' : out.some(r => r.status === 'UNKNOWN') ? 'UNKNOWN' : out.length ? 'PASS' : 'UNKNOWN';
  return { status, rows: out, note: missing.length ? 'missing sections: ' + missing.join(', ') : '' };
}

// ---------- typed answers ----------
function interpretBackup(text, runDate) {
  const a = {};
  for (const m of String(text).matchAll(/(nightly|restore|minutes)\s*[:=]?\s*(green:\d{4}-\d{2}-\d{2}|red:\d{4}-\d{2}-\d{2}|ok|out)/gi)) a[m[1].toLowerCase()] = m[2].toLowerCase();
  const b = Q.backupStatus({ nightly: a.nightly, restore: a.restore, minutes: a.minutes, checkedOn: runDate });
  const map = { 'VERIFIED HEALTHY': 'PASS', STALE: 'WARN', FAILED: 'FAIL', UNKNOWN: Object.keys(a).length ? 'INCOMPLETE' : 'UNKNOWN' };
  return { status: map[b.status], rows: [{ name: 'backups', status: map[b.status], note: b.status + ' — ' + b.why }], note: b.expires ? 're-check by ' + b.expires : '' };
}
function kv(text) {
  const o = {};
  for (const line of String(text).split(/\r?\n/)) { const m = /^\s*([A-Za-z_ #0-9-]+?)\s*[:=]\s*(.+?)\s*$/.exec(line); if (m) o[m[1].trim().toLowerCase().replace(/\s+/g, '_')] = m[2]; }
  return o;
}
// GitHub access (X6-17). Closed only when ALL of: the session account is
// stasvitiuk-reos, its role is write (not admin / maintain), it cannot see the
// backups repository, and the protect-main bypass list is admin-only.
function interpretGithub(text) {
  const o = kv(text);
  const need = ['account', 'role', 'backups_repo_visible', 'bypass'];
  const miss = need.filter(k => !(k in o));
  if (miss.length) return { status: 'INCOMPLETE', rows: [], note: 'missing: ' + miss.join(', ') + ' (see OWNER_EVIDENCE_GUIDE_EXT12.md, GitHub)' };
  const rows = [
    { name: 'account', status: /^stasvitiuk-reos$/i.test(o.account) ? 'PASS' : 'FAIL', note: o.account },
    { name: 'role', status: /^write$/i.test(o.role) ? 'PASS' : /^(admin|maintain)$/i.test(o.role) ? 'FAIL' : 'UNKNOWN', note: o.role },
    { name: 'backups repository hidden', status: /^(no|false)$/i.test(o.backups_repo_visible) ? 'PASS' : /^(yes|true)$/i.test(o.backups_repo_visible) ? 'FAIL' : 'UNKNOWN', note: o.backups_repo_visible },
    { name: 'protect-main bypass admin-only', status: /^admin[- ]only$/i.test(o.bypass) ? 'PASS' : /^(none)$/i.test(o.bypass) ? 'PASS' : 'FAIL', note: o.bypass },
  ];
  return { status: worst(rows.map(r => r.status)), rows, note: worst(rows.map(r => r.status)) === 'PASS' ? 'X6-17 can be marked CLOSED' : 'X6-17 stays OPEN' };
}
const DEVICES = ['iphone safari', 'mac safari', 'voiceover', 'chrome'];
function interpretDevice(text) {
  const o = kv(text);
  if (!o.device || !DEVICES.includes(o.device.toLowerCase())) return { status: 'INCOMPLETE', rows: [], note: 'device must be one of: ' + DEVICES.join(', ') };
  if (!/^[0-9a-f]{7,40}$/i.test(o.sha || '')) return { status: 'INCOMPLETE', rows: [], note: 'the tested commit (sha) is required: a device result is tied to one version of the page' };
  const steps = Object.entries(o).filter(([k]) => !['device', 'sha', 'tester', 'date'].includes(k));
  if (!steps.length) return { status: 'INCOMPLETE', rows: [], note: 'no steps reported' };
  const rows = steps.map(([k, v]) => ({ name: k, status: /^pass$/i.test(v) ? 'PASS' : /^fail/i.test(v) ? 'FAIL' : 'UNKNOWN', note: v }));
  return { status: worst(rows.map(r => r.status)), rows, note: 'tested on ' + o.sha, sha: o.sha.toLowerCase(), device: o.device.toLowerCase() };
}

// ---------- decisions ----------
const DECISIONS = {
  thresholds: { options: ['as written', 'custom'], safe: 'as written', unlocks: ['nightly check P9', 'Home stuck-work rows'] },
  low_stock_levels: { options: ['global', 'per product', 'no alerts'], safe: 'no alerts', unlocks: ['Home low-stock rows', 'D4'] },
  partial_returns: { options: ['partial quantity', 'whole line'], safe: 'whole line', unlocks: ['R3 quantity parameter', 'return form quantity field'] },
  staging_location: { options: ['private artifact page', 'local only', 'separate private repository'], safe: 'private artifact page', unlocks: ['staging review URL'] },
  rpo_rto: { options: ['24h/4h', 'custom'], safe: null, unlocks: ['restore drill target (U17)'] },
  backup_row: { options: ['approve', 'not yet'], safe: 'not yet', unlocks: ['P11 backup status on Home'] },
  week_definition: { options: ['last 7 days', 'calendar week', 'both'], safe: 'last 7 days', unlocks: ['report windows'] },
  employee_approval: { options: ['yes', 'no'], safe: 'no', unlocks: ['approval permission draft (before hiring)'] },
  recall_per_lot: { options: ['one per lot', 'several allowed'], safe: 'several allowed', unlocks: ['INV-16 unique rule'] },
  orders_without_items: { options: ['A: count as revenue (today)', 'B: exclude until items added'], safe: 'A: count as revenue (today)', unlocks: ['revenue rule on Accounting/Tax'] },
  document_categories: { options: ['keep 7', 'add categories'], safe: 'keep 7', unlocks: ['document form'] },
  order_number_rule: { options: ['unique in the database', 'page check only (today)'], safe: 'page check only (today)', unlocks: ['optional unique rule on orders (after Query C/F)'] },
  // EXT13: decisions found in older documents and merged into OWNER_ATTENTION_SESSION_EXT13.md §6
  rollout_order: { options: ['R1→R4→R2→R3→R5', 'R1-R4-R2-R3-R5', 'other'], safe: 'R1→R4→R2→R3→R5', unlocks: ['stock switch order (P4)'] },
  switch_tables_owner_only: { options: ['owner/admin only', 'leave'], safe: 'leave', unlocks: ['owner-only policy draft for switch tables (after Query G)'] },
  next_automation: { options: ['Query F nightly first', 'other D-item', 'none'], safe: 'none', unlocks: ['the chosen D-item package'] },
  ci_required_check: { options: ['on', 'off'], safe: 'off', unlocks: ['CI workflow PR for owner review'] },
  manual_order_catalogue_picker: { options: ['yes', 'no'], safe: 'no', unlocks: ['manual order product picker (post-launch)'] },
  input_border_contrast: { options: ['darker', 'keep'], safe: 'keep', unlocks: ['form border colour (post-launch)'] },
  refund_rule_n4: { options: ['a', 'b', 'c'], safe: 'a', unlocks: ['refund subtraction on Accounting/Tax'], party: 'ACCOUNTANT_DECISION' },
  tax_export_review: { options: ['ok', 'changes needed'], safe: null, unlocks: ['tax export confidence'], party: 'ACCOUNTANT_DECISION' },
  legal_hold_vs_delete: { options: ['1', '2'], safe: '2', unlocks: ['delete buttons check holds'], party: 'LAWYER_DECISION' },
  data_retention: { options: ['to be written'], safe: 'delete nothing', unlocks: ['none until decided'], party: 'LAWYER_DECISION' },
  claims_review_queue: { options: ['needed', 'not needed'], safe: 'not built', unlocks: ['claims review queue D8 (website launch)'], party: 'LAWYER_DECISION' },
  email_provider: { options: ['provider name'], safe: 'none', unlocks: ['R10 adapter (no send until approved)'], party: 'PROVIDER_DECISION' },
};
function interpretDecision(text, type) {
  const o = kv(text);
  const d = DECISIONS[(o.decision || '').toLowerCase()];
  if (!d) return { status: 'INCOMPLETE', rows: [], note: 'decision must be one of: ' + Object.keys(DECISIONS).join(', ') };
  const expectedType = d.party || 'OWNER_DECISION';
  if (type !== expectedType) return { status: 'CONFLICT', rows: [], note: o.decision + ' is answered by ' + expectedType + ', not ' + type };
  if (/^revoked$/i.test(o.choice || '')) return { status: 'RECEIVED', rows: [{ name: o.decision, status: 'UNKNOWN', note: 'REVOKED: back to open; dependents reopen: ' + d.unlocks.join(', ') }], decision: o.decision, revoked: true };
  const freeText = d.options.length === 1 || o.decision === 'email_provider';
  if (!o.choice || (!freeText && !d.options.map(x => x.toLowerCase()).includes(o.choice.toLowerCase()))) return { status: 'INCOMPLETE', rows: [], note: 'choice must be one of: ' + d.options.join(' / ') };
  if (!o.decided_by) return { status: 'INCOMPLETE', rows: [], note: 'decided_by is required' };
  return { status: 'PASS', rows: [{ name: o.decision, status: 'PASS', note: o.choice + ' (by ' + o.decided_by + '); unlocks: ' + d.unlocks.join(', ') }], decision: o.decision, choice: o.choice };
}
function interpretAgentSource(text) {
  const o = kv(text);
  const need = ['agent', 'reads', 'writes', 'schedule', 'failure_recorded_as', 'second_run_duplicates'];
  const miss = need.filter(k => !o[k]);
  if (miss.length) return { status: 'INCOMPLETE', rows: [], note: 'missing: ' + miss.join(', ') + ' (packet E)' };
  const dup = /^(no|never)$/i.test(o.second_run_duplicates) ? 'PASS' : /^(yes|sometimes)$/i.test(o.second_run_duplicates) ? 'FAIL' : 'UNKNOWN';
  return { status: dup, rows: [{ name: 'agent ' + o.agent + ' second run', status: dup, note: o.second_run_duplicates }], note: 'map to the agent contract (ENGINEERING_CATALOG_EXT11.md §8) and write its contract tests' };
}

const RANK = { PASS: 0, RECEIVED: 0, UNKNOWN: 1, INCOMPLETE: 1, WARN: 2, CONFLICT: 2, MALFORMED: 3, FAIL: 3 };
function worst(list) { return list.reduce((w, s) => ((RANK[s] ?? 1) > (RANK[w] ?? 0) ? s : w), list.length ? 'PASS' : 'UNKNOWN'); }

// ---------- one entry point ----------
function interpret(type, text, opts = {}) {
  const T = String(type || '').toUpperCase();
  if (!TYPES.includes(T)) return { status: 'MALFORMED', rows: [], note: 'unknown evidence type ' + type };
  const env = String(opts.env || '').toLowerCase();
  if (!ENVIRONMENTS.includes(env)) return { status: 'UNKNOWN', rows: [], note: 'environment not stated (production, staging or local): a result whose environment is unknown proves nothing' };
  // A result that expires must say when it was run; otherwise its age (and so its validity) is unknown.
  if (STALE_DAYS[T] && !/^\d{4}-\d{2}-\d{2}$/.test(String(opts.runDate || ''))) return { status: 'UNKNOWN', rows: [], note: 'run date missing or not written as YYYY-MM-DD (for example --run-date 2026-10-20): without it nobody can tell whether the result is still valid' };
  const p = privacyCheck(text);
  if (p.secret) return { status: 'MALFORMED', rows: [], note: 'REFUSED: the text contains what looks like a key, token or password. Nothing was stored. Remove it and send again.', refused: true };
  if (!String(text || '').trim()) return { status: 'NOT RECEIVED', rows: [], note: 'empty' };
  let r;
  if (/^QUERY_[DEFGH]$/.test(T)) {
    try { const q = Q.interpret(T.slice(-1), text); r = { status: q.rows.length ? q.overall : 'UNKNOWN', rows: q.rows }; }
    catch (e) { r = { status: 'MALFORMED', rows: [], note: e.message }; }
  } else if (T === 'QUERY_C' || T === 'AGENT_STATUS') r = interpretC(text);
  else if (T === 'BACKUP') r = interpretBackup(text, opts.runDate);
  else if (T === 'GITHUB_ACCESS') r = interpretGithub(text);
  else if (T === 'REAL_DEVICE') r = interpretDevice(text);
  else if (T === 'AGENT_SOURCE') r = interpretAgentSource(text);
  else r = interpretDecision(text, T);
  if (env !== 'production' && /^(QUERY_|BACKUP|AGENT_STATUS)/.test(T)) r.note = ((r.note || '') + ' NOT PRODUCTION: does not verify production.').trim();
  r.emailsRedacted = p.emails;
  return r;
}

// ---------- re-entry: what happens next for each result (never a production action) ----------
function nextSteps(type, result) {
  const T = String(type).toUpperCase(), s = result.status, steps = [];
  if (s === 'MALFORMED' || s === 'NOT RECEIVED') return ['Ask the owner to send it again (a screenshot of any error is enough). Nothing changes.'];
  if (s === 'UNKNOWN' || s === 'INCOMPLETE') steps.push('Not usable as proof yet: ask for the missing part. Do not continue any rollout step that depends on it.');
  if (T === 'BACKUP') steps.push(s === 'PASS' ? 'Backup prerequisite met for 7 days; still look again on the day of each database step.' : s === 'FAIL' ? 'STOP every production change. Owner looks at why the backup failed (do not open or change the backups repository from here).' : 'Database steps stay blocked until a healthy, recent backup is seen.');
  for (const row of result.rows || []) {
    if (T === 'QUERY_G' && row.status === 'FAIL') {
      if (/G03/.test(row.name)) steps.push('Write the task-update fix draft (owner/admin or assignee only) with its exact rollback, test it on local roles: install → test → rollback → reinstall.');
      else if (/G04/.test(row.name)) steps.push('Write a revoke draft for the anon rights listed (' + row.name + ') with a grant-back rollback; test locally.');
      else if (/G01/.test(row.name)) steps.push('Write enable-RLS + policy draft for ' + row.name + '; test locally.');
      else if (/^G08/.test(row.name)) steps.push('STOP: a policy lets signed-in users write audit lines directly (forged history possible). Draft dropping that policy plus revoking INSERT, with rollback; owner approves before anything else.');
      else steps.push('Read ' + row.name + ' and propose a draft.');
    }
    // EXT20: audit findings F1 / F2 (AUTHORIZATION_CONTRACT_EXT18.md)
    if (T === 'QUERY_G' && /^G08/.test(row.name) && row.status === 'WARN') steps.push('F1 confirmed: signed-in users hold the INSERT right on audit_log (refused today only because no INSERT policy exists). Prepare the revoke-INSERT draft with grant-back rollback; prove locally the audit trigger still writes. Owner approves and runs it.');
    if (T === 'QUERY_G' && /^G09/.test(row.name) && row.status === 'WARN') steps.push('F2 confirmed: every signed-in user can read every audit line. OWNER DECISION: owner-only, owner+admin, or leave as is (OWNER_ACTIONS_EXT20.md). Nothing changes until the owner decides.');
    if (T === 'QUERY_G' && row.status === 'WARN' && /G05/.test(row.name)) steps.push('Duplicate read policies on ' + row.name + ': draft dropping the looser one after confirming the stricter covers every read.');
    if ((T === 'QUERY_C' || T === 'AGENT_STATUS') && /^audit /.test(row.name) && row.status === 'WARN') steps.push('Audit gap on ' + row.name.slice(6) + ': draft one audit trigger using the existing audit function named in section 10, with drop-trigger rollback.');
    if ((T === 'QUERY_C' || T === 'AGENT_STATUS') && /^agent /.test(row.name) && row.status !== 'PASS') steps.push('Update the agent row for ' + row.name + ' (' + row.note + '); no change to the agent.');
    if (T === 'QUERY_C' && row.name === 'other stock writers') steps.push('Read each listed stock-writing function before installing R1–R5 (P2 precondition).');
    if (T === 'QUERY_H' && row.status === 'FAIL') steps.push('STOP: ' + row.name + ' — ' + (row.note || 'do what its ACTION says (usually switch OFF)') + '. No next switch until it is PASS.');
    if (T === 'QUERY_E' && row.status === 'FAIL') steps.push('Mismatch ' + row.name + ': a person investigates and corrects by hand with a note; no automatic repair; integrity rules (P6) wait until it is 0.');
    if (T === 'QUERY_F' && row.status !== 'PASS') steps.push(row.name + ': look at the listed records; correct by hand if wrong (nothing is deleted automatically).');
    if (T === 'QUERY_D' && row.status === 'FAIL') steps.push('Function ' + row.name + ' can be misused: write a revoke / caller-check draft before launch.');
    if (T === 'GITHUB_ACCESS' && row.status !== 'PASS') steps.push('X6-17 stays open: ' + row.name + ' = ' + row.note + '.');
    if (T === 'REAL_DEVICE' && row.status === 'FAIL') steps.push('Reopen the area for "' + row.name + '" on ' + (result.device || 'that device') + ': reproduce in the browser tests (mobile-cards, a11y-basics, a11y-ext8, responsive-widths) and fix.');
  }
  if (T === 'GITHUB_ACCESS' && s === 'PASS') steps.push('Mark X6-17 CLOSED in the unblock center with the date.');
  if (/DECISION$/.test(T) && s === 'PASS') steps.push('Record it; then the work it unlocks can be prepared: ' + (result.rows[0] || {}).note);
  if (result.revoked) steps.push('Decision revoked: dependent work goes back to waiting.');
  if (s === 'PASS' && !steps.length) steps.push('Nothing to do.');
  return steps;
}

// ---------- ledger, status, staleness, conflicts, diff ----------
function pageFingerprint() {
  const h = crypto.createHash('sha256');
  // EXT15: the page, its stylesheet and every script it loads (registry and module files included)
  for (const f of ['owner-login.html', 'assets/owner-login.css', ...require('../helpers/page-source').PAGE_SCRIPTS['owner-login.html']]) h.update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest('hex').slice(0, 12);
}
function makeRecord(type, text, opts) {
  const r = interpret(type, text, opts);
  if (r.refused) return { record: null, result: r };
  return {
    result: r,
    record: {
      type: String(type).toUpperCase(), status: r.status, receivedAt: opts.now || new Date().toISOString(), runDate: opts.runDate || null,
      environment: String(opts.env || '').toLowerCase(), version: opts.version || null, relatedSha: opts.sha || null, operator: opts.operator || null,
      pageFingerprint: String(type).toUpperCase() === 'REAL_DEVICE' ? (opts.pageFingerprint || null) : null,
      summary: r.note || '', rows: (r.rows || []).map(x => ({ name: privacyCheck(x.name).redacted, status: x.status, note: privacyCheck(String(x.note || '')).redacted.slice(0, 160) })),
      decision: r.decision || null, choice: r.choice || null, revoked: !!r.revoked,
    },
  };
}
function readLedger(file = LEDGER) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}
function appendLedger(record, file = LEDGER) { fs.appendFileSync(file, JSON.stringify(record) + '\n'); }
function ageStatus(rec, today, currentFingerprint) {
  const limit = STALE_DAYS[rec.type];
  if (rec.type === 'REAL_DEVICE' && currentFingerprint && rec.pageFingerprint && rec.pageFingerprint !== currentFingerprint) return 'STALE';
  if (!limit) return rec.status;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rec.runDate || ''))) return 'UNKNOWN'; // undated: never counts as fresh
  return (Date.parse(today) - Date.parse(rec.runDate)) / DAY > limit ? 'STALE' : rec.status;
}
// Facts the documents state as expected; evidence that says otherwise is a CONFLICT to be read by a person (never auto-fixed).
const EXPECTED = [
  { type: 'QUERY_G', row: /^G04/, bad: s => s === 'FAIL', says: 'docs expect no write rights for anon (PERMISSION_RLS_MAP_EXT9.md)' },
  { type: 'QUERY_G', row: /^G03/, bad: s => s === 'FAIL', says: 'docs expect only owner/admin/assignee to change tasks' },
  { type: 'QUERY_H', row: /^H0[3-7]/, bad: s => s === 'FAIL', says: 'every stock switch must be OFF unless its function passes H01' },
  { type: 'QUERY_C', row: /^agent #0?[2378]$/, bad: (s, note) => /switch ON/i.test(note), says: 'agents #2/#3/#7/#8 are documented as off on purpose' },
];
function conflicts(rec) {
  const out = [];
  for (const e of EXPECTED) if (e.type === rec.type) for (const r of rec.rows) if (e.row.test(r.name) && e.bad(r.status, r.note)) out.push(r.name + ': ' + e.says);
  return out;
}
function statusBoard(records, today, currentFingerprint) {
  const board = {};
  for (const t of TYPES) board[t] = { status: 'NOT RECEIVED' };
  const decisions = {};
  for (const rec of records) {
    if (/DECISION$/.test(rec.type) && rec.decision) { decisions[rec.decision] = rec; continue; }
    const prev = board[rec.type].latest;
    const same = prev && prev.runDate && prev.runDate === rec.runDate && prev.environment === rec.environment && prev.status !== rec.status;
    board[rec.type] = { latest: rec, status: same ? 'CONFLICT' : ageStatus(rec, today, currentFingerprint), conflicts: conflicts(rec) };
    if (board[rec.type].conflicts.length && board[rec.type].status !== 'STALE') board[rec.type].status = 'CONFLICT';
    if (rec.environment !== 'production' && /^(QUERY_|BACKUP|AGENT_STATUS)/.test(rec.type)) board[rec.type].status = 'UNKNOWN';
  }
  const open = Object.keys(DECISIONS).filter(d => !decisions[d] || decisions[d].revoked);
  return { board, decisions, openDecisions: open };
}
function diff(prev, next) {
  const before = new Map((prev ? prev.rows : []).map(r => [r.name, r.status]));
  const out = [];
  for (const r of next.rows) {
    const was = before.get(r.name);
    const bad = s => s === 'FAIL' || s === 'WARN';
    if (was === undefined) out.push({ name: r.name, change: r.status === 'UNKNOWN' ? 'NEW UNKNOWN' : bad(r.status) ? 'NEW FAILURE' : 'NEW', status: r.status });
    else if (!bad(was) && bad(r.status)) out.push({ name: r.name, change: 'NEW FAILURE', status: r.status });
    else if (bad(was) && r.status === 'PASS') out.push({ name: r.name, change: 'RESOLVED', status: r.status });
    else if (was !== 'UNKNOWN' && r.status === 'UNKNOWN') out.push({ name: r.name, change: 'NEW UNKNOWN', status: r.status });
    else out.push({ name: r.name, change: 'UNCHANGED', status: r.status });
  }
  return out;
}

module.exports = { TYPES, STALE_DAYS, DECISIONS, AUDIT_REQUIRED, interpret, interpretC, nextSteps, makeRecord, readLedger, appendLedger, statusBoard, diff, privacyCheck, pageFingerprint, conflicts };

if (require.main === module) {
  const [cmd, type, file] = process.argv.slice(2);
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const opts = { env: arg('--env'), runDate: arg('--run-date'), operator: arg('--operator'), version: arg('--version'), sha: arg('--sha') };
  if (cmd === 'interpret' || cmd === 'intake') {
    if (!type || !file) { console.error('usage: node tests/tools/evidence.js ' + cmd + ' <TYPE> <file> --env production --run-date YYYY-MM-DD [--operator NAME] [--version FP]'); process.exit(2); }
    if (!fs.existsSync(file)) { console.error('No such file: ' + file + ' (paths are relative to the folder you are in; run from the repository root).'); process.exit(2); }
    const text = fs.readFileSync(file, 'utf8');
    if (String(type).toUpperCase() === 'REAL_DEVICE') opts.pageFingerprint = pageFingerprint();
    const { record, result } = makeRecord(type, text, opts);
    console.log(String(type).toUpperCase() + ': ' + result.status + (result.note ? ' — ' + result.note : ''));
    for (const r of result.rows || []) console.log('  ' + r.status.padEnd(10) + ' ' + r.name + (r.note ? ' — ' + privacyCheck(String(r.note)).redacted : ''));
    if (result.emailsRedacted) console.log('  (' + result.emailsRedacted + ' e-mail address(es) replaced by [email])');
    console.log('NEXT:'); for (const s of nextSteps(type, result)) console.log('  - ' + s);
    if (cmd === 'intake' && record) { if (!opts.operator) { console.error('intake needs --operator'); process.exit(2); } appendLedger(record); console.log('Stored one sanitized line in docs/ops/evidence/ledger.jsonl'); }
    if (cmd === 'intake' && !record) console.log('Nothing stored.');
    process.exitCode = /FAIL|MALFORMED/.test(result.status) ? 1 : 0;
  } else if (cmd === 'status') {
    const { board, openDecisions } = statusBoard(readLedger(), arg('--today') || new Date().toISOString().slice(0, 10), pageFingerprint());
    for (const t of TYPES.filter(t => !/DECISION$/.test(t))) console.log(t.padEnd(20) + board[t].status + (board[t].latest ? '  (' + board[t].latest.runDate + ', ' + board[t].latest.environment + ')' : '') + ((board[t].conflicts || []).length ? '  CONFLICT: ' + board[t].conflicts.join('; ') : ''));
    console.log('Open decisions: ' + (openDecisions.join(', ') || 'none'));
  } else if (cmd === 'diff') {
    const recs = readLedger().filter(r => r.type === String(type || '').toUpperCase());
    if (recs.length < 2) { console.log('Need two results of ' + type + ' to compare (have ' + recs.length + ').'); process.exit(0); }
    for (const d of diff(recs[recs.length - 2], recs[recs.length - 1])) console.log(d.change.padEnd(12) + ' ' + d.name + ' (' + d.status + ')');
  } else {
    console.error('commands: interpret | intake | status | diff'); process.exit(2);
  }
}
