// Query C reader (Nov 27, 2026). Turns the CSV the owner downloads after running
// docs/ops/sql/02_READONLY_C_agents.sql into a plain-English answer to one question:
// "Is anything else already changing stock, so that installing the stock steps
// R1-R5 (drafts 10 and 21) must wait?"  Works on the file only: no database
// connection, nothing sent anywhere, nothing written.
//
//   node tests/tools/query-c-reader.js <query-c.csv> [--json]
//
// Verdicts (the worst one found wins):
//   STOP     something already writes stock behind the dashboard (an active scheduled
//            job that reaches stock, an enabled trigger that writes stock, a stock
//            writer anyone signed out can call, a stock table anyone can write with no
//            row rules). R1-R5 wait until each one has its own plan and your approval.
//   REVIEW   a person reads the item first (a stock-writing function that exists but
//            nothing seems to fire; signed-in users may write stock tables directly;
//            Shopify order sync switched ON; ...).
//   CLEAR    the file is complete and none of the above was found.
//   UNKNOWN  the file is not a complete Query C result (a section is missing, a row
//            cannot be read). Never shown as clear: a missing answer proves nothing.
// Pattern flags in Query C are text matches, not proof; this reader repeats them, it
// does not add certainty. A person decides.
'use strict';
const fs = require('fs');
const { parseCsv } = require('./interpret-query-results.js');

const RANK = { CLEAR: 0, NOTE: 0, REVIEW: 1, UNKNOWN: 2, STOP: 3 };
const SECTIONS = ['0 counts', '1 agents', '2 switches', '3 agent #1 invoices', '4 shopify sync',
  '5 scheduled jobs', '6 stock writers', '7 triggers', '8 direct writes', '9 value rules', '10 audit coverage'];
// Sections whose absence makes the stock answer unknown (the others are context).
const NEEDED = ['5 scheduled jobs', '6 stock writers', '7 triggers', '8 direct writes'];
// The reviewed stock functions themselves (drafts 10 and 21, R1-R5). Once installed they are
// the intended path into stock, not a second one.
const REVIEWED = ['_he_apply_stock_change', 'adjust_inventory', 'receive_purchase_order', 'quarantine_recall', 'receive_return', 'delete_unused_product'];
const reviewed = (item) => REVIEWED.includes(String(item).replace(/^public\./, ''));

// "a=1; b=x, y; c=true" -> { a: '1', b: 'x, y', c: 'true' }. The masked agent error is
// last in its row and may itself hold "; ", so everything after "last_error=" is kept whole.
function fields(text) {
  const out = {};
  let s = String(text == null ? '' : text);
  const le = s.indexOf('last_error=');
  if (le >= 0) { out.last_error = s.slice(le + 'last_error='.length); s = s.slice(0, le); }
  for (const part of s.split('; ')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim().replace(/;\s*$/, '');
  }
  return out;
}
const yes = (v) => String(v).trim().toLowerCase() === 'true';

// Personal data that should not be stored or pasted anywhere public.
function privacy(rows) {
  const hits = [];
  for (const r of rows) {
    const t = [r.section, r.item, r.result].join(' ');
    if (/[^\s@,;()<>"']+@[^\s@,;()<>"']+\.[a-z]{2,}/i.test(t)) hits.push(r.section + ' / ' + r.item + ': looks like an e-mail address');
    else if (/(?:^|[^A-Za-z0-9])\+?\d[\d ().-]{8,}\d(?:$|[^A-Za-z0-9])/.test(r.section === '1 agents' ? String(r.result) : '')) hits.push(r.section + ' / ' + r.item + ': looks like a phone number');
    else if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(t)) hits.push(r.section + ' / ' + r.item + ': looks like a key or token');
  }
  return hits;
}

function read(text) {
  const findings = [];
  const add = (level, section, item, what) => findings.push({ level, section, item, what });
  let rows;
  try { rows = parseCsv(String(text || '').replace(/^﻿/, '')); } catch (e) { rows = []; }
  const cols = rows.length ? Object.keys(rows[0]) : [];
  if (!['section', 'item', 'result'].every(c => cols.includes(c))) {
    add('UNKNOWN', '-', '-', 'This is not a Query C result: it needs the three columns section, item and result.');
    return finish(findings, rows, false);
  }
  const by = (s) => rows.filter(r => r.section === s);
  const present = SECTIONS.filter(s => by(s).length);
  for (const s of NEEDED) if (!by(s).length) add('UNKNOWN', s, '-', 'This section is missing from the file, so the stock question cannot be answered. Run the whole query again and download all rows.');
  const strange = [...new Set(rows.map(r => r.section))].filter(s => !SECTIONS.includes(s));
  if (strange.length) add('UNKNOWN', strange.join(', '), '-', 'Sections Query C does not produce: this may be another query or an edited file.');

  // 5 scheduled jobs
  const s5 = by('5 scheduled jobs');
  const cronRow = s5.find(r => r.item === '(pg_cron installed)');
  const totalRow = s5.find(r => r.item === '(total)');
  if (s5.length && (!cronRow || !totalRow)) add('UNKNOWN', '5 scheduled jobs', '-', 'The summary rows "(total)" and "(pg_cron installed)" are missing: the job list may be cut short.');
  if (cronRow && /^NO/i.test(cronRow.result)) add('NOTE', '5 scheduled jobs', '(pg_cron installed)', 'No database timer is installed, so no database-scheduled job can change stock. Agents that run elsewhere (GitHub, edge functions) are not visible here.');
  for (const r of s5.filter(r => !/^\(/.test(r.item))) {
    const f = fields(r.result);
    if (!('reaches stock' in f) || !('active' in f)) { add('UNKNOWN', '5 scheduled jobs', r.item, 'This job row cannot be read.'); continue; }
    if (yes(f['reaches stock']) && yes(f.active)) add('STOP', '5 scheduled jobs', r.item, 'An active scheduled job reaches the stock tables (' + (f.calls || '?') + '). It would change stock outside R1-R5: pause it or route it through R1-R5 first.');
    else if (yes(f['reaches stock'])) add('REVIEW', '5 scheduled jobs', r.item, 'A paused scheduled job reaches the stock tables. It must stay paused, or be rewritten, before R1-R5.');
    else if (f.edge_function && f.edge_function !== 'none') add('REVIEW', '5 scheduled jobs', r.item, 'This job calls the program "' + f.edge_function + '" outside the database; what that program writes is not visible here.');
  }

  // 6 stock writers
  const s6 = by('6 stock writers');
  const installed = s6.filter(r => reviewed(r.item)).map(r => r.item.replace(/^public\./, ''));
  if (installed.length) add('NOTE', '6 stock writers', installed.join(', '), 'The reviewed stock functions (R1-R5, drafts 10 and 21) are installed: they are the intended path, not a second one.');
  for (const r of s6.filter(r => !/^\(/.test(r.item) && !reviewed(r.item))) {
    const f = fields(r.result);
    if (!('anon_can_execute' in f)) { add('UNKNOWN', '6 stock writers', r.item, 'This row cannot be read.'); continue; }
    const callable = f.kind !== 'trigger function';            // a trigger function cannot be called on its own
    const fired = f.fired_by_triggers && f.fired_by_triggers !== 'none' && /\(enabled\)|\(always\)/.test(f.fired_by_triggers);
    const jobs = [f.called_by_jobs, f.called_via_wrapper_by_jobs].filter(x => x && x !== 'none');
    if (callable && yes(f.anon_can_execute)) add('STOP', '6 stock writers', r.item, 'Anyone who is not signed in can call this function, and it writes stock. Close it (a reviewed draft) before anything else.');
    else if (fired) add('STOP', '6 stock writers', r.item, 'An enabled trigger runs this stock-writing function automatically (' + f.fired_by_triggers + '). It is a second path into stock that R1-R5 would not protect.');
    else if (jobs.length) add('STOP', '6 stock writers', r.item, 'A scheduled job calls this stock-writing function (' + jobs.join(', ') + ').');
    else if (callable && yes(f.authenticated_can_execute)) add('REVIEW', '6 stock writers', r.item, 'Any signed-in account can call this stock-writing function' + (yes(f.checks_caller) ? ' (it does check who is calling)' : ' and it does NOT check who is calling') + '. Decide: keep, replace by R1-R5, or close.');
    else add('REVIEW', '6 stock writers', r.item, callable ? 'A stock-writing function exists but nothing visible calls it. A person reads it before R1-R5.' : 'A stock-writing trigger function that no enabled trigger runs. It must stay unused, or be removed by a reviewed draft.');
  }
  const wrap = s6.find(r => r.item === '(functions that call a stock writer)');
  if (s6.length && !wrap) add('UNKNOWN', '6 stock writers', '-', 'The summary row "(functions that call a stock writer)" is missing.');
  if (wrap && wrap.result && wrap.result !== 'none') {
    const pairs = wrap.result.split(', ').filter(p => { const [a, b] = p.split(' -> '); return !(reviewed(a) && reviewed(b)); });
    if (pairs.length) add('REVIEW', '6 stock writers', '(functions that call a stock writer)', 'These functions reach stock through another function: ' + pairs.join(', ') + '.');
  }

  // 7 triggers
  for (const r of by('7 triggers')) {
    const f = fields(r.result);
    if (!('writes stock' in f)) { add('UNKNOWN', '7 triggers', r.item, 'This trigger row cannot be read.'); continue; }
    if (yes(f['writes stock']) && f.state !== 'DISABLED') add('STOP', '7 triggers', r.item, 'This trigger changes stock automatically (' + (f.function || '?') + ', ' + f.state + ').');
    else if (yes(f['writes stock'])) add('REVIEW', '7 triggers', r.item, 'A disabled trigger would change stock if switched back on. It must stay off, or be removed by a reviewed draft.');
  }

  // 8 direct writes
  const s8 = by('8 direct writes');
  for (const r of s8) {
    const f = fields(r.result);
    if (!('insert' in f) || !('row_security' in f)) { add('UNKNOWN', '8 direct writes', r.item, 'This row cannot be read.'); continue; }
    const writes = ['insert', 'update', 'delete'].filter(k => yes(f[k]));
    const anon = /^anon /.test(r.item);
    if (writes.length && /^OFF/.test(f.row_security)) add('STOP', '8 direct writes', r.item, 'This role may ' + writes.join('/') + ' the stock table and row rules are OFF: nothing stops a direct change.');
    else if (writes.length && anon) add('REVIEW', '8 direct writes', r.item, 'Signed-out visitors hold ' + writes.join('/') + ' rights on this stock table; only the row rules stop them. Removing those rights is a reviewed draft (INV-20).');
    else if (writes.length) add('NOTE', '8 direct writes', r.item, 'Signed-in accounts may ' + writes.join('/') + ' this stock table directly (the row rules decide who). Expected today; closed later by INV-20, after R1-R5 are the only path.');
  }
  if (s8.length && s8.length < 6) add('UNKNOWN', '8 direct writes', '-', 'Expected 6 rows (anon and authenticated on three stock tables), found ' + s8.length + '.');

  // context: Shopify sync, system mode, catalogue, agents, audit of feature_flags
  const sync = by('4 shopify sync').find(r => r.item === 'flag shopify_order_sync');
  if (sync && /^ON/.test(sync.result)) add('REVIEW', '4 shopify sync', sync.item, 'Shopify order sync is switched ON. It should be off until launch (R9).');
  const fromShopify = by('4 shopify sync').find(r => /orders that came from Shopify/.test(r.item));
  if (fromShopify && Number(fromShopify.result) > 0) add('NOTE', '4 shopify sync', fromShopify.item, fromShopify.result + ' order(s) came from Shopify: something has imported orders before.');
  const mode = by('2 switches').find(r => r.item === 'system mode');
  if (mode) add('NOTE', '2 switches', 'system mode', 'System mode: ' + mode.result + '.');
  const products = by('0 counts').find(r => r.item === 'products');
  if (products && (products.result === '0' || /not found/.test(products.result))) add('NOTE', '0 counts', 'products', 'No products in the catalogue yet (R8 waits on the product list from the lab).');
  const agentsOn = by('1 agents').filter(r => /switch=ON/.test(r.result)).map(r => r.item);
  if (agentsOn.length) add('NOTE', '1 agents', agentsOn.join(', '), 'Agent switches ON. Agents that run outside the database are only visible through what they record; check that none changes stock.');
  const ffAudit = by('10 audit coverage').find(r => r.item === 'feature_flags');
  if (ffAudit) {
    const f = fields(ffAudit.result);
    const cols = String(f.who_when_columns || '');
    if (!/updated_at/.test(cols) || !/updated_by/.test(cols)) add('NOTE', '10 audit coverage', 'feature_flags', 'The switches table lacks updated_by/updated_at (has: ' + (cols || 'none') + '). Finding X3-17: the Emergency switch-off needs its fallback.');
  }
  return finish(findings, rows, present.length === SECTIONS.length);
}

function finish(findings, rows, complete) {
  const worst = findings.reduce((w, f) => (RANK[f.level] > RANK[w] ? f.level : w), 'CLEAR');
  const verdict = worst === 'NOTE' ? 'CLEAR' : worst;
  const count = (l) => findings.filter(f => f.level === l).length;
  const headline = {
    STOP: count('STOP') + ' thing(s) already change stock outside the dashboard. R1-R5 (drafts 10 and 21) wait until each has its own plan and your approval.',
    UNKNOWN: 'The file is not a complete Query C result, so the stock question is not answered. Nothing here is a green light.',
    REVIEW: 'Nothing was found that changes stock by itself, but ' + count('REVIEW') + ' item(s) need a person to read them before R1-R5.',
    CLEAR: 'Nothing else was found that writes stock. Next: your approval, then draft 10 (item 20).',
  }[verdict];
  return { verdict, headline, findings, rows: rows.length, complete, privacy: privacy(rows) };
}

function format(res) {
  const out = ['Query C — ' + res.verdict + ': ' + res.headline, ''];
  for (const l of ['STOP', 'UNKNOWN', 'REVIEW', 'NOTE']) {
    for (const f of res.findings.filter(x => x.level === l)) out.push(l.padEnd(8) + f.section + ' · ' + f.item + ': ' + f.what);
  }
  if (res.privacy.length) {
    out.push('', 'PRIVATE DATA: do not store or share this file publicly; delete these cells first:');
    for (const p of res.privacy) out.push('  - ' + p);
  }
  out.push('', res.rows + ' row(s) read. Query C flags are text matches, not proof: a person decides.');
  return out.join('\n');
}

module.exports = { read, format, fields, privacy };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tests/tools/query-c-reader.js <query-c.csv> [--json]'); process.exit(2); }
  const res = read(fs.readFileSync(file, 'utf8'));
  console.log(process.argv.includes('--json') ? JSON.stringify(res, null, 2) : format(res));
  process.exit(res.verdict === 'CLEAR' || res.verdict === 'REVIEW' ? 0 : 1);
}
