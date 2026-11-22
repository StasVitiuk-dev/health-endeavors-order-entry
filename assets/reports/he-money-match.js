// Money matching (owner request of Nov 22): does the money the business should
// have received and paid show up in the bank, exactly once and in full?
//
//   1 parseStatement(text)   reads a bank or card export (CSV) as downloaded:
//                            the Chase business checking layout, the Wells Fargo
//                            card layout (no header row), or any file with a date,
//                            a description and an amount (or debit/credit) column.
//                            It never guesses: a row it cannot read is listed as a
//                            problem, never turned into $0.00.
//   2 checkPayouts(payouts, transactions)
//                            each Shopify payout must equal the sum of its own
//                            charges, refunds, fees and adjustments.
//   3 matchDeposits(expected, bankRows, opts)
//                            every expected deposit (a Shopify payout, a wholesale
//                            payment by ACH, wire or check) is matched to ONE bank
//                            credit of exactly the same amount within its date
//                            window; every expected outgoing refund to one debit.
//   4 matchCard(expenses, cardRows, opts)
//                            every card purchase should be recorded as an expense
//                            (same amount, close date); a purchase with no expense
//                            is flagged so nothing goes unrecorded.
//
// Outcomes, each with a plain sentence and whether it needs a person to look:
//   MATCHED            found once, same amount, inside the window
//   PENDING            not in the bank yet, but its window has not closed
//   MISSING            not in the bank and the window has closed
//   AMOUNT_DIFFERS     a bank line that looks like it (same source, inside the
//                      window) has a different amount: short or over
//   DOUBLED            the same deposit appears twice in the bank
//   UNEXPECTED         money in or out of the bank that nothing in the dashboard
//                      explains (for example a transfer you made yourself)
//   NOT_RECORDED       a card purchase with no expense recorded
//   UNKNOWN            an amount or a date is missing; never counted as matched
//
// Pure: no network, no storage. It reads only what it is given and changes
// nothing; deciding what a difference means is a person's job. Amounts are in
// whole cents throughout. Dual-mode (Node require + browser HE.reports registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-money-match'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2026-11-22';
  const MAX_BYTES = 5 * 1024 * 1024;       // a year of statements is far below this
  const MAX_ROWS = 20000;
  const NEEDS_LOOK = { MATCHED: false, PENDING: false, MISSING: true, AMOUNT_DIFFERS: true, DOUBLED: true, UNEXPECTED: true, NOT_RECORDED: true, UNKNOWN: true };
  // How many days after the expected date the money may arrive (owner can change).
  const DEFAULT_WINDOWS = { shopify_payout: 5, ach: 3, wire: 2, check: 10, card: 0, cash: 3, other: 5, refund: 5, expense: 3 };
  // Words a bank puts in the description of a Shopify payout.
  const SHOPIFY_WORDS = /shopify/i;

  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const rowsOf = (x) => (Array.isArray(x) ? x : []).filter(isObj);
  const text = (v) => (v == null ? '' : String(v)).trim();
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const fmt = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ---- money and dates --------------------------------------------------------
  // "1,234.56", "$1,234.56", "-12.00", "(12.00)", "12" -> cents; anything else -> null.
  function toCents(v) {
    if (typeof v === 'number') return isFinite(v) && Math.abs(v) < 1e11 ? Math.round(v * 100) : null;
    let s = text(v);
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
    s = s.replace(/^\$/, '').replace(/^-\$/, '-').replace(/\$/g, '');
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1).trim(); }
    if (s.startsWith('+')) s = s.slice(1).trim();
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
    const [whole, frac] = s.replace(/,/g, '').split('.');
    const c = Number(whole) * 100 + Number(((frac || '') + '00').slice(0, 2));
    return neg ? -c : c;
  }
  // "11/20/2026", "2026-11-20", "11/20/26" -> "2026-11-20"; anything else -> null.
  function toDay(v) {
    const s = text(v);
    let y, m, d, x;
    if ((x = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) { m = +x[1]; d = +x[2]; y = +x[3]; if (y < 100) y += 2000; }
    else return null;
    const t = Date.UTC(y, m - 1, d);
    const back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  const dayNum = (day) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86400000;

  // ---- CSV --------------------------------------------------------------------
  function csvRows(src) {
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); out.push(row); row = []; cell = '';
        if (out.length > MAX_ROWS + 1) break;
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    return out.filter(r => r.some(c => text(c) !== ''));
  }
  const norm = (h) => text(h).toLowerCase().replace(/[^a-z#]+/g, ' ').trim();

  // Which column is which. Returns { layout, date, desc, amount | debit+credit, type?, ref?, header: bool }.
  function detectLayout(rows) {
    const first = rows[0] || [];
    const hdr = first.map(norm);
    const find = (...names) => hdr.findIndex(h => names.includes(h));
    const date = find('posting date', 'date', 'transaction date', 'trans date', 'post date');
    const desc = find('description', 'payee', 'memo', 'name', 'details description');
    const amount = find('amount', 'transaction amount');
    const debit = find('debit', 'withdrawal', 'withdrawals', 'debits');
    const credit = find('credit', 'deposit', 'deposits', 'credits');
    if (date >= 0 && desc >= 0 && (amount >= 0 || (debit >= 0 && credit >= 0))) {
      const chase = hdr[0] === 'details' && find('posting date') >= 0 && find('balance') >= 0;
      return { layout: chase ? 'chase_checking' : 'header', header: true, date, desc, amount, debit, credit,
        type: find('type'), ref: find('check or slip #', 'check number', 'reference', 'ref') };
    }
    // Wells Fargo card and checking exports: no header; "date","amount","*","","description"
    const wf = rows.slice(0, 5).every(r => r.length >= 5 && toDay(r[0]) && toCents(r[1]) != null);
    if (wf) return { layout: 'wells_fargo', header: false, date: 0, desc: 4, amount: 1, debit: -1, credit: -1, type: -1, ref: -1 };
    return null;
  }

  // text -> { ok, layout, rows: [{ n, date, description, cents, type, ref }], problems: [{ line, reason }] }
  // Money in is positive, money out negative, as on the statement.
  function parseStatement(input) {
    const src = typeof input === 'string' ? input.replace(/^﻿/, '') : '';
    if (!src.trim()) return { ok: false, reason: 'The file is empty.', layout: null, rows: [], problems: [] };
    if (src.length > MAX_BYTES) return { ok: false, reason: 'The file is larger than 5 MB; export a shorter period.', layout: null, rows: [], problems: [] };
    const rows = csvRows(src);
    if (rows.length > MAX_ROWS + 1) return { ok: false, reason: 'The file has more than ' + MAX_ROWS + ' lines; export a shorter period.', layout: null, rows: [], problems: [] };
    const L = detectLayout(rows);
    if (!L) return { ok: false, reason: 'This does not look like a bank or card export: no date, description and amount columns were found. Download the statement as CSV from your bank.', layout: null, rows: [], problems: [] };
    const out = [], problems = [];
    rows.slice(L.header ? 1 : 0).forEach((r, i) => {
      const line = i + (L.header ? 2 : 1);
      const day = toDay(r[L.date]);
      let c = null;
      if (L.amount >= 0) c = toCents(r[L.amount]);
      else {
        const d = text(r[L.debit]) ? toCents(r[L.debit]) : 0, cr = text(r[L.credit]) ? toCents(r[L.credit]) : 0;
        c = d == null || cr == null ? null : cr - Math.abs(d);
      }
      if (!day) { problems.push({ line, reason: 'no readable date' }); return; }
      if (c == null) { problems.push({ line, reason: 'no readable amount' }); return; }
      out.push({ n: out.length + 1, line, date: day, description: text(r[L.desc]).slice(0, 200), cents: c,
        type: L.type >= 0 ? text(r[L.type]).slice(0, 40) : '', ref: L.ref >= 0 ? text(r[L.ref]).slice(0, 40) : '' });
    });
    if (!out.length) return { ok: false, reason: 'No transaction in the file could be read.', layout: L.layout, rows: [], problems };
    const days = out.map(r => r.date).sort();
    return { ok: true, layout: L.layout, rows: out, problems, from: days[0], to: days[days.length - 1],
      moneyIn: out.filter(r => r.cents > 0).reduce((t, r) => t + r.cents, 0), moneyOut: out.filter(r => r.cents < 0).reduce((t, r) => t + r.cents, 0) };
  }

  // ---- Shopify payouts against their own transactions -------------------------
  // payouts: [{ id, date, amountCents, status }]
  // transactions: [{ id, payoutId, type: 'charge'|'refund'|'adjustment'|'fee'|..., amountCents, feeCents, orderRef }]
  // Shopify reports each transaction's amount and fee; the payout pays out the
  // net. A payout whose transactions do not add up to it is flagged.
  function checkPayouts(payouts, transactions) {
    const tx = rowsOf(transactions);
    const items = rowsOf(payouts).map(p => {
      const mine = tx.filter(t => text(t.payoutId) === text(p.id));
      const amt = Number.isInteger(p.amountCents) ? p.amountCents : null;
      const bad = mine.find(t => !Number.isInteger(t.amountCents) || (t.feeCents != null && !Number.isInteger(t.feeCents)));
      if (amt == null || bad) return item('UNKNOWN', { kind: 'shopify_payout', ref: text(p.id), date: toDay(p.date), expected: amt, found: null,
        why: amt == null ? 'the payout amount is missing' : 'a transaction in this payout has no readable amount' });
      const net = mine.reduce((s, t) => s + t.amountCents - (Number.isInteger(t.feeCents) ? t.feeCents : 0), 0);
      if (net === amt) return item('MATCHED', { kind: 'shopify_payout', ref: text(p.id), date: toDay(p.date), expected: amt, found: net,
        why: 'its ' + plural(mine.length, 'transaction') + (mine.length === 1 ? ' adds' : ' add') + ' up to the payout' });
      return item('AMOUNT_DIFFERS', { kind: 'shopify_payout', ref: text(p.id), date: toDay(p.date), expected: amt, found: net,
        why: 'its ' + plural(mine.length, 'transaction') + (mine.length === 1 ? ' adds' : ' add') + ' up to ' + fmt(net) + ', but the payout is ' + fmt(amt) });
    });
    return summary(items);
  }

  // ---- expected deposits and refunds against the bank ------------------------
  // expected: [{ ref, kind: 'shopify_payout'|'ach'|'wire'|'check'|'cash'|'other'|'refund', date, amountCents, label }]
  //   (a refund is money going OUT: amountCents positive, matched to a debit)
  // bankRows: parseStatement(...).rows
  // opts: { asOf: 'YYYY-MM-DD' (today), windows: { kind: days }, statementFrom, statementTo }
  function matchDeposits(expected, bankRows, opts) {
    const o = opts || {};
    const W = Object.assign({}, DEFAULT_WINDOWS, isObj(o.windows) ? o.windows : {});
    const asOf = toDay(o.asOf);
    const bank = rowsOf(bankRows).filter(r => toDay(r.date) && Number.isInteger(r.cents));
    const used = new Set();
    const items = [];
    const exp = rowsOf(expected).map((e, i) => ({ e, i, day: toDay(e.date), c: Number.isInteger(e.amountCents) ? e.amountCents : toCents(e.amount) }));
    // the earliest expectations first, so each takes the first fitting bank line
    exp.sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999') || a.i - b.i);
    const seenRef = new Map();
    exp.forEach(({ e, day, c }) => {
      const kind = text(e.kind) || 'other';
      const out = kind === 'refund';
      const base = { kind, ref: text(e.ref), label: text(e.label), date: day, expected: c };
      if (c == null || c <= 0 || !day) { items.push(item('UNKNOWN', Object.assign(base, { found: null, why: c == null || c <= 0 ? 'the amount is missing' : 'the date is missing' }))); return; }
      const key = kind + '|' + base.ref;
      if (base.ref && seenRef.has(key)) { items.push(item('DOUBLED', Object.assign(base, { found: null, why: 'the dashboard lists ' + base.ref + ' twice; only the first is matched' }))); return; }
      seenRef.set(key, true);
      const win = Number.isInteger(W[kind]) ? W[kind] : DEFAULT_WINDOWS.other;
      const lo = dayNum(day) - 1, hi = dayNum(day) + win;   // a bank may post a day early
      const sign = out ? -1 : 1;
      const inWin = (r) => !used.has(r.n) && dayNum(r.date) >= lo && dayNum(r.date) <= hi && Math.sign(r.cents) === sign;
      const exact = bank.filter(r => inWin(r) && Math.abs(r.cents) === c)
        .sort((a, b) => Math.abs(dayNum(a.date) - dayNum(day)) - Math.abs(dayNum(b.date) - dayNum(day)));
      if (exact.length) {
        used.add(exact[0].n);
        items.push(item('MATCHED', Object.assign(base, { found: c, bankLine: exact[0], why: (out ? 'paid out' : 'deposited') + ' on ' + exact[0].date })));
        return;
      }
      // the same source in the window with another amount: short or over
      const looks = bank.filter(r => inWin(r) && (kind === 'shopify_payout' ? SHOPIFY_WORDS.test(r.description) : (base.ref && r.description.toUpperCase().includes(base.ref.toUpperCase()))));
      if (looks.length) {
        const r = looks[0]; used.add(r.n);
        const diff = Math.abs(r.cents) - c;
        items.push(item('AMOUNT_DIFFERS', Object.assign(base, { found: Math.abs(r.cents), bankLine: r,
          why: (out ? 'paid out ' : 'deposited ') + fmt(Math.abs(r.cents)) + ' on ' + r.date + ', ' + fmt(Math.abs(diff)) + (diff < 0 ? ' short' : ' over') })));
        return;
      }
      const closes = hi;
      const covered = o.statementTo ? dayNum(toDay(o.statementTo) || '1970-01-01') >= closes : (asOf ? dayNum(asOf) > closes : true);
      if (!covered) { items.push(item('PENDING', Object.assign(base, { found: null, why: 'not in the bank yet; expected by ' + new Date(closes * 86400000).toISOString().slice(0, 10) }))); return; }
      items.push(item('MISSING', Object.assign(base, { found: null, why: (out ? 'no matching payment out' : 'no matching deposit') + ' between ' + new Date(lo * 86400000).toISOString().slice(0, 10) + ' and ' + new Date(hi * 86400000).toISOString().slice(0, 10) })));
    });
    // the same amount deposited twice for one expectation: a bank line right next
    // to a matched one, same amount and description, nothing else explains it
    bank.forEach(r => {
      if (used.has(r.n)) return;
      const twin = items.find(it => it.outcome === 'MATCHED' && it.bankLine && it.bankLine.cents === r.cents && it.bankLine.description === r.description && Math.abs(dayNum(it.bankLine.date) - dayNum(r.date)) <= 3);
      if (twin) {
        used.add(r.n);
        items.push(item('DOUBLED', { kind: twin.kind, ref: twin.ref, label: twin.label, date: r.date, expected: twin.expected, found: Math.abs(r.cents), bankLine: r,
          why: 'the same ' + fmt(Math.abs(r.cents)) + ' appears again on ' + r.date }));
      }
    });
    // money in that nothing explains (money out is the card/expense side's job unless opts.flagDebits)
    bank.forEach(r => {
      if (used.has(r.n)) return;
      if (r.cents > 0 || o.flagDebits) items.push(item('UNEXPECTED', { kind: 'bank', ref: r.ref || '', label: r.description, date: r.date, expected: null, found: Math.abs(r.cents), bankLine: r,
        why: (r.cents > 0 ? 'money in' : 'money out') + ' that nothing in the dashboard explains (for example a transfer you made yourself)' }));
    });
    return summary(items);
  }

  // ---- card purchases against recorded expenses -------------------------------
  // expenses: [{ id, date, amountCents, vendor, category }]   cardRows: parseStatement(...).rows (purchases negative)
  function matchCard(expenses, cardRows, opts) {
    const o = opts || {};
    const win = Number.isInteger(o.windowDays) ? o.windowDays : DEFAULT_WINDOWS.expense;
    const exp = rowsOf(expenses).map(x => ({ x, day: toDay(x.date), c: Number.isInteger(x.amountCents) ? x.amountCents : toCents(x.amount) }));
    const used = new Set();
    const items = [];
    rowsOf(cardRows).filter(r => toDay(r.date) && Number.isInteger(r.cents)).forEach(r => {
      if (r.cents >= 0) return;     // payments to the card and credits are not purchases
      const c = -r.cents;
      const hit = exp.map((e, i) => ({ e, i })).filter(({ e, i }) => !used.has(i) && e.day && e.c === c && Math.abs(dayNum(e.day) - dayNum(r.date)) <= win)
        .sort((a, b) => Math.abs(dayNum(a.e.day) - dayNum(r.date)) - Math.abs(dayNum(b.e.day) - dayNum(r.date)))[0];
      if (hit) {
        used.add(hit.i);
        items.push(item('MATCHED', { kind: 'card', ref: text(hit.e.x.id), label: r.description, date: r.date, expected: c, found: c, bankLine: r, why: 'recorded as an expense on ' + hit.e.day }));
      } else {
        items.push(item('NOT_RECORDED', { kind: 'card', ref: '', label: r.description, date: r.date, expected: null, found: c, bankLine: r,
          why: 'a card purchase of ' + fmt(c) + ' with no expense of the same amount within ' + plural(win, 'day') }));
      }
    });
    return summary(items);
  }

  function item(outcome, f) {
    return Object.assign({ outcome: outcome, needsLook: NEEDS_LOOK[outcome] === true }, f);
  }
  function summary(items) {
    const counts = {};
    items.forEach(it => { counts[it.outcome] = (counts[it.outcome] || 0) + 1; });
    const look = items.filter(it => it.needsLook);
    return { ok: true, items, counts, needsLook: look.length,
      headline: look.length ? plural(look.length, 'difference') + ' to look at' : 'Everything matched' };
  }

  // ---- made-up example: a week of Chase deposits and Wells Fargo card lines ----
  function fixtures() {
    const chase = [
      'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #,',
      'CREDIT,11/17/2026,"SHOPIFY PAYMENTS   PAYOUT SYN1001  PPD ID: 0000000000",412.07,ACH_CREDIT,5412.07,,',
      'CREDIT,11/18/2026,"ORIG CO NAME:SYN CEDAR SPA  SYN-INV-0001",129.99,ACH_CREDIT,5542.36,,',
      'CREDIT,11/19/2026,"SHOPIFY PAYMENTS   PAYOUT SYN1002  PPD ID: 0000000000",250.00,ACH_CREDIT,5792.36,,',
      'DSLIP,11/20/2026,"REMOTE ONLINE DEPOSIT #  1",75.00,DEPOSIT,5867.36,1,',
      'CREDIT,11/20/2026,"ONLINE TRANSFER FROM SAVINGS",500.00,ACCT_XFER,6367.36,,',
      'DEBIT,11/21/2026,"ACH PMT SYN BOUTIQUE REFUND",-48.00,ACH_DEBIT,6319.36,,',
    ].join('\n');
    const wells = [
      '"11/16/2026","-86.40","*","","SYN LABEL PRINTER CO"',
      '"11/18/2026","-32.15","*","","SYN SHIPPING SUPPLIES"',
      '"11/20/2026","-19.99","*","","SYN SOFTWARE SUBSCRIPTION"',
      '"11/21/2026","500.00","*","","ONLINE PAYMENT THANK YOU"',
    ].join('\n');
    return {
      asOf: '2026-11-24',
      chase, wells,
      // SYN1001 matches; SYN1002 arrived $11.87 short; SYN1003 does not add up inside Shopify ($1.00) and is not due yet
      payouts: [{ id: 'SYN1001', date: '2026-11-16', amountCents: 41207 }, { id: 'SYN1002', date: '2026-11-18', amountCents: 26187 }, { id: 'SYN1003', date: '2026-11-23', amountCents: 9900 }],
      transactions: [
        { id: 't1', payoutId: 'SYN1001', type: 'charge', amountCents: 25000, feeCents: 755, orderRef: 'SYN-1101' },
        { id: 't2', payoutId: 'SYN1001', type: 'charge', amountCents: 17500, feeCents: 538, orderRef: 'SYN-1102' },
        { id: 't3', payoutId: 'SYN1002', type: 'charge', amountCents: 27000, feeCents: 813, orderRef: 'SYN-1103' },
        { id: 't4', payoutId: 'SYN1003', type: 'charge', amountCents: 10100, feeCents: 300, orderRef: 'SYN-1104' },
      ],
      wholesale: [{ ref: 'SYN-INV-0001', kind: 'ach', date: '2026-11-17', amountCents: 12999, label: 'SYN Cedar Spa' }, { ref: 'SYN-INV-0002', kind: 'check', date: '2026-11-12', amountCents: 6000, label: 'SYN Lotus Boutique' }],
      refunds: [{ ref: 'SYN-RF-01', kind: 'refund', date: '2026-11-20', amountCents: 4800, label: 'SYN Boutique refund' }],
      expenses: [{ id: 'e1', date: '2026-11-16', amountCents: 8640, vendor: 'SYN Label Printer' }, { id: 'e2', date: '2026-11-20', amountCents: 1999, vendor: 'SYN Software' }],
    };
  }
  // The worked example: all three checks on the made-up week.
  function example() {
    const f = fixtures();
    const bank = parseStatement(f.chase), card = parseStatement(f.wells);
    const payoutCheck = checkPayouts(f.payouts, f.transactions);
    const expected = f.payouts.map(p => ({ ref: p.id, kind: 'shopify_payout', date: p.date, amountCents: p.amountCents, label: 'Shopify payout ' + p.id }))
      .concat(f.wholesale, f.refunds);
    const deposits = matchDeposits(expected, bank.rows, { asOf: f.asOf, statementTo: bank.to });
    const cardCheck = matchCard(f.expenses, card.rows);
    return { asOf: f.asOf, bank, card, payoutCheck, deposits, cardCheck, label: 'SIMULATED',
      needsLook: payoutCheck.needsLook + deposits.needsLook + cardCheck.needsLook };
  }

  return { VERSION, MAX_BYTES, MAX_ROWS, DEFAULT_WINDOWS, NEEDS_LOOK, toCents, toDay, parseStatement, checkPayouts, matchDeposits, matchCard, fixtures, example };
}));
