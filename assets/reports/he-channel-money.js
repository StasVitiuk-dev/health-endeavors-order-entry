// Money per channel (owner, Nov 24, gap 4): what each sales channel really paid,
// read from the channel's own money report, so it can be compared with the bank
// and with the fee estimates used for Real profit.
//
//   parseReport(text, channel?)  the channel's exported report (CSV text) ->
//                                plain rows: day, kind, order, gross, fees, tax, net
//   summarize(rows)              sales, refunds, fees, postage, tax held, net, payouts
//   feeCheck(summary, estimate)  the real fee rate against the owner's estimate
//   expectedDeposits(parsed)     the payouts, shaped for the bank matching
//
// Formats:
//   Etsy    monthly statement CSV: Date, Type, Title, Info, Currency, Amount,
//           Fees & Taxes, Net (column names as Etsy's help pages describe them)
//   Amazon  date range "transaction" report CSV: found by its column names
//           (date/time, type, order id, product sales, selling fees, total ...)
//   TikTok  Shop statement sheet saved as CSV: found by its column names
//           (order id, type, revenue, fees, settlement amount ...)
// Amazon and TikTok layouts are read by column NAME and are TO CONFIRM against
// the owner's first real export: the result always says which columns were used
// (`used`), and a file whose columns are not recognised is refused with a plain
// reason. Nothing is guessed: a line that cannot be read is listed in `problems`.
//
// Pure. Dual-mode (Node require + browser HE.reports registry). Never writes;
// the file never leaves the browser.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-channel-money'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_BYTES = 5 * 1024 * 1024, MAX_ROWS = 20000;
  const CHANNELS = Object.freeze({
    etsy:   { name: 'Etsy', confirmed: true, how: 'Etsy: Shop Manager, Finances, Monthly statements, choose the month, Download CSV.' },
    amazon: { name: 'Amazon', confirmed: false, how: 'Amazon: Seller Central, Payments, Reports Repository (Date Range Reports), Transaction report for the month, download the CSV.' },
    tiktok: { name: 'TikTok Shop', confirmed: false, how: 'TikTok Shop: Seller Center, Finance, Statements, export; open the file and save the order details sheet as CSV.' },
  });
  const KIND_WORD = { sale: 'Sale', refund: 'Refund', fee: 'Fee', postage: 'Postage label', tax: 'Sales tax held by the channel', payout: 'Payout to the bank', other: 'Other' };

  const text = (v) => (v == null ? '' : String(v)).trim();
  const norm = (h) => text(h).toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim();
  const fmt = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // "$1,234.56", "-$12.00", "($12.00)", "US$ 5", "12" -> cents; "--" or "" -> 0 when
  // blankIsZero, else null; anything else -> null
  function toCents(v, blankIsZero) {
    if (typeof v === 'number') return isFinite(v) && Math.abs(v) < 1e11 ? Math.round(v * 100) : null;
    let s = text(v).slice(0, 40);                           // an amount is short; a long cell is not one
    if (!s || /^-{1,2}$/.test(s) || s === '—') return blankIsZero ? 0 : null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
    if (/^[-−]/.test(s)) { neg = !neg; s = s.slice(1).trim(); }
    s = s.replace(/^(US)?\$\s*/i, '').replace(/ ?USD$/i, '').trim();
    if (/^[-−]/.test(s)) { neg = !neg; s = s.slice(1).trim(); }
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
    const parts = s.replace(/,/g, '').split('.');
    const c = Number(parts[0]) * 100 + Number(((parts[1] || '') + '00').slice(0, 2));
    return neg ? -c : c;
  }
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  // "2026-11-20...", "11/20/2026 ...", "Nov 20, 2026 ...", "20 November, 2026" -> "2026-11-20"
  function toDay(v) {
    const s = text(v);
    let y, m, d, x;
    if ((x = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/.exec(s))) { m = +x[1]; d = +x[2]; y = +x[3]; if (y < 100) y += 2000; }
    else if ((x = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})\b/.exec(s))) { m = MONTHS[x[1].toLowerCase()]; d = +x[2]; y = +x[3]; }
    else if ((x = /^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.?,? (\d{4})\b/.exec(s))) { d = +x[1]; m = MONTHS[x[2].toLowerCase()]; y = +x[3]; }
    else return null;
    if (!m) return null;
    const back = new Date(Date.UTC(y, m - 1, d));
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function csvRows(src) {
    const out = []; let row = [], cell = '', q = false;
    const sep = (src.split(/\r?\n/, 12).filter(l => l.indexOf('\t') >= 0).length >= 6 && src.indexOf(',') < 0) ? '\t' : ',';
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); out.push(row); row = []; cell = '';
        if (out.length > MAX_ROWS + 60) break;
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    return out.filter(r => r.some(c => text(c) !== ''));
  }

  // the first of the given column names found in the header -> its index, or -1
  const col = (header, names) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
  const cols = (header, names) => names.map(n => header.indexOf(n)).filter(i => i >= 0);

  // ---- layouts ----------------------------------------------------------------
  // each returns null (not this layout) or { channel, headerRow, used, read(cells) -> row | { problem } | null }
  function etsyLayout(rows) {
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const h = rows[r].map(norm);
      const date = h.indexOf('date'), type = h.indexOf('type'), title = h.indexOf('title'), amount = h.indexOf('amount'), fees = h.indexOf('fees & taxes'), net = h.indexOf('net');
      if (date < 0 || type < 0 || title < 0 || amount < 0 || fees < 0 || net < 0) continue;
      const info = h.indexOf('info');
      return { channel: 'etsy', headerRow: r, used: { day: 'Date', kind: 'Type', label: 'Title', order: 'Info', gross: 'Amount', fees: 'Fees & Taxes', net: 'Net' },
        read(c) {
          const day = toDay(c[date]); const t = norm(c[type]); const label = text(c[title]);
          if (!day) return { problem: 'the date "' + text(c[date]).slice(0, 30) + '" could not be read' };
          const a = toCents(c[amount], true), f = toCents(c[fees], true), n = toCents(c[net], true);
          if (a == null || f == null || n == null) return { problem: 'an amount could not be read' };
          const order = (/order #?(\d+)/i.exec(text(info >= 0 ? c[info] : '') + ' ' + label) || [])[1] || '';
          if (t === 'deposit') {                                  // "$123.45 sent to your bank account"
            const m = /((?:US)?\$\s?[\d,]+(?:\.\d{1,2})?)/i.exec(label); const p = m ? toCents(m[1]) : null;
            if (p == null) return { problem: 'the deposit amount could not be read from "' + label.slice(0, 40) + '"' };
            return { day, kind: 'payout', order: '', label, gross: 0, fees: 0, tax: 0, net: 0, payout: p };
          }
          if (t === 'sale') return { day, kind: 'sale', order, label, gross: a, fees: f, tax: 0, net: n };
          if (t === 'refund') return { day, kind: 'refund', order, label, gross: a, fees: f, tax: 0, net: n };
          if (t === 'tax' || t === 'vat') return { day, kind: 'tax', order, label, gross: 0, fees: 0, tax: a + f, net: n };
          if (t === 'shipping') return { day, kind: 'postage', order, label, gross: 0, fees: a + f, tax: 0, net: n };
          if (t === 'fee' || t === 'marketing') return { day, kind: 'fee', order, label, gross: 0, fees: a + f, tax: 0, net: n };
          return { day, kind: 'other', order, label: label || text(c[type]), gross: 0, fees: 0, tax: 0, net: n, other: a + f };
        } };
    }
    return null;
  }

  function amazonLayout(rows) {
    for (let r = 0; r < Math.min(rows.length, 40); r++) {              // the report starts with a few lines of notes
      const h = rows[r].map(norm);
      const date = col(h, ['date time', 'date']), type = h.indexOf('type'), total = h.indexOf('total'), sales = h.indexOf('product sales'), selling = h.indexOf('selling fees');
      if (date < 0 || type < 0 || total < 0 || sales < 0 || selling < 0) continue;
      const order = h.indexOf('order id'), desc = h.indexOf('description');
      const grossCols = cols(h, ['product sales', 'shipping credits', 'gift wrap credits', 'promotional rebates']);
      const taxCols = cols(h, ['product sales tax', 'shipping credits tax', 'giftwrap credits tax', 'gift wrap credits tax', 'promotional rebates tax', 'marketplace withheld tax', 'tax on regulatory fee']);
      const feeCols = cols(h, ['selling fees', 'fba fees', 'other transaction fees', 'regulatory fee']);
      const otherCol = h.indexOf('other');
      const name = (i) => text(rows[r][i]);
      return { channel: 'amazon', headerRow: r, used: { day: name(date), kind: name(type), order: order >= 0 ? name(order) : '(none)', gross: grossCols.map(name).join(' + '), fees: feeCols.map(name).join(' + '), tax: taxCols.map(name).join(' + ') || '(none)', net: name(total) },
        read(c) {
          const day = toDay(c[date]); const t = norm(c[type]);
          if (!day) return { problem: 'the date "' + text(c[date]).slice(0, 30) + '" could not be read' };
          const sum = (list) => { let s = 0; for (const i of list) { const v = toCents(c[i], true); if (v == null) return null; s += v; } return s; };
          const g = sum(grossCols), tx = sum(taxCols), f = sum(feeCols), o = otherCol >= 0 ? toCents(c[otherCol], true) : 0, n = toCents(c[total], true);
          if (g == null || tx == null || f == null || o == null || n == null) return { problem: 'an amount could not be read' };
          const ord = order >= 0 ? text(c[order]) : '', label = desc >= 0 ? text(c[desc]) : '';
          if (t === 'transfer') return { day, kind: 'payout', order: '', label: label || 'Transfer to the bank', gross: 0, fees: 0, tax: 0, net: 0, payout: -n };
          if (t === 'order') return { day, kind: 'sale', order: ord, label, gross: g, fees: f + o, tax: tx, net: n };
          if (t === 'refund') return { day, kind: 'refund', order: ord, label, gross: g, fees: f + o, tax: tx, net: n };
          if (/fee/.test(t)) return { day, kind: 'fee', order: ord, label: label || text(c[type]), gross: 0, fees: n, tax: 0, net: n };
          return { day, kind: 'other', order: ord, label: label || text(c[type]) || 'Other', gross: 0, fees: 0, tax: 0, net: n, other: n };
        } };
    }
    return null;
  }

  function tiktokLayout(rows) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const h = rows[r].map(norm);
      const net = col(h, ['total settlement amount', 'settlement amount']), rev = col(h, ['total revenue', 'revenue']), fees = col(h, ['total fees', 'fees', 'total fee']);
      const date = col(h, ['order settled time', 'settled time', 'statement date', 'order created time', 'date']);
      if (net < 0 || rev < 0 || fees < 0 || date < 0) continue;
      const order = col(h, ['order adjustment id', 'order id', 'related order id']), type = col(h, ['type', 'transaction type']);
      const name = (i) => text(rows[r][i]);
      return { channel: 'tiktok', headerRow: r, used: { day: name(date), kind: type >= 0 ? name(type) : '(none)', order: order >= 0 ? name(order) : '(none)', gross: name(rev), fees: name(fees), net: name(net) },
        read(c) {
          const day = toDay(c[date]);
          if (!day) return { problem: 'the date "' + text(c[date]).slice(0, 30) + '" could not be read' };
          const g = toCents(c[rev], true), f = toCents(c[fees], true), n = toCents(c[net], true);
          if (g == null || f == null || n == null) return { problem: 'an amount could not be read' };
          const t = type >= 0 ? norm(c[type]) : 'order';
          const kind = /refund|return/.test(t) ? 'refund' : /order|sale/.test(t) ? 'sale' : (g !== 0 ? 'sale' : 'other');
          const row = { day, kind, order: order >= 0 ? text(c[order]) : '', label: type >= 0 ? text(c[type]) : '', gross: kind === 'other' ? 0 : g, fees: kind === 'other' ? 0 : f, tax: 0, net: n };
          if (kind === 'other') row.other = n;
          return row;
        } };
    }
    return null;
  }
  const LAYOUTS = { etsy: etsyLayout, amazon: amazonLayout, tiktok: tiktokLayout };

  // text: the exported file as text. channel: 'etsy' | 'amazon' | 'tiktok' (the file
  // must be THAT channel's report), or omitted to recognise it from its columns.
  function parseReport(input, channel) {
    const bad = (reason) => ({ ok: false, reason, channel: channel || null, rows: [], problems: [], used: null });
    const src = typeof input === 'string' ? input.replace(/^﻿/, '') : '';
    if (!src.trim()) return bad('The file is empty.');
    if (src.length > MAX_BYTES) return bad('The file is larger than 5 MB; export a shorter period.');
    if (channel != null && !LAYOUTS[channel]) return bad('This channel is not known.');
    const rows = csvRows(src);
    if (rows.length > MAX_ROWS + 40) return bad('The file has more than ' + MAX_ROWS + ' lines; export a shorter period.');
    let L = null;
    for (const k of (channel ? [channel] : ['etsy', 'amazon', 'tiktok'])) { L = LAYOUTS[k](rows); if (L) break; }
    if (!L) {
      return bad(channel
        ? 'This does not look like the ' + CHANNELS[channel].name + ' report: its columns were not found. ' + CHANNELS[channel].how
        : 'The columns of this file were not recognised as an Etsy, Amazon or TikTok Shop money report.');
    }
    const out = [], problems = [];
    for (let i = L.headerRow + 1; i < rows.length; i++) {
      let r;
      try { r = L.read(rows[i]); } catch (e) { r = { problem: 'the line could not be read' }; }
      if (!r) continue;
      if (r.problem) { if (problems.length < 20) problems.push('Line ' + (i + 1) + ': ' + r.problem + '.'); continue; }
      r.line = i + 1; r.label = text(r.label).slice(0, 120); r.order = text(r.order).slice(0, 60);
      out.push(r);
    }
    if (!out.length) return Object.assign(bad('No line in the file could be read.'), { channel: L.channel, problems });
    const days = out.map(r => r.day).sort();
    return { ok: true, channel: L.channel, name: CHANNELS[L.channel].name, confirmed: CHANNELS[L.channel].confirmed, used: L.used,
      rows: out, problems, skipped: rows.length - 1 - L.headerRow - out.length, from: days[0], to: days[days.length - 1] };
  }

  // sales and refunds are what customers paid and got back (without the tax the
  // channel holds); fees and postage are negative amounts; net is what the channel owes
  function summarize(rows) {
    const s = { lines: 0, orders: 0, sales: 0, refunds: 0, fees: 0, postage: 0, tax: 0, other: 0, net: 0, payouts: [], payoutTotal: 0, from: null, to: null };
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!r || typeof r !== 'object' || !r.day) return;
      s.lines++;
      if (!s.from || r.day < s.from) s.from = r.day;
      if (!s.to || r.day > s.to) s.to = r.day;
      if (r.kind === 'payout') { const p = Number.isInteger(r.payout) ? r.payout : 0; s.payouts.push({ day: r.day, cents: p, label: r.label || '' }); s.payoutTotal += p; return; }
      const g = Number.isInteger(r.gross) ? r.gross : 0, f = Number.isInteger(r.fees) ? r.fees : 0, t = Number.isInteger(r.tax) ? r.tax : 0;
      if (r.kind === 'sale') { s.sales += g; if (r.order ? !seen.has(r.order) : true) { s.orders++; if (r.order) seen.add(r.order); } }
      else if (r.kind === 'refund') s.refunds += g;
      if (r.kind === 'postage') s.postage += f; else s.fees += f;
      s.tax += t;
      s.other += Number.isInteger(r.other) ? r.other : 0;
      s.net += Number.isInteger(r.net) ? r.net : 0;
    });
    // fees as a share of sales after refunds (a rate only when there are sales)
    const base = s.sales + s.refunds;
    s.feePercent = base > 0 ? Math.round(-s.fees * 1000 / base) / 10 : null;
    s.balance = s.net - s.payoutTotal;                        // earned in the period and not yet paid out (or paid from earlier)
    return s;
  }

  // the real fees against the owner's estimate ({ percent, perOrder } in dollars)
  function feeCheck(summary, estimate) {
    const s = summary || {}, e = estimate || {};
    const pct = e.percent == null || e.percent === '' ? null : Number(e.percent), per = e.perOrder == null || e.perOrder === '' ? null : Number(e.perOrder);
    const base = (s.sales || 0) + (s.refunds || 0);
    if (!(base > 0) || s.feePercent == null) return { verdict: 'unknown', message: 'No sales in this report, so there is no fee rate to compare.' };
    const actual = -s.fees;
    if (pct == null || per == null || !isFinite(pct) || !isFinite(per)) {
      return { verdict: 'no_estimate', actualCents: actual, actualPercent: s.feePercent, message: 'Fees were ' + fmt(actual) + ', ' + s.feePercent + '% of sales. There is no estimate for this channel yet.' };
    }
    const est = Math.round(base * pct / 100) + Math.round(per * 100) * (s.orders || 0);
    const diff = actual - est;
    const close = Math.abs(diff) <= Math.max(100, Math.round(actual * 0.05));     // within $1 or 5%
    return { verdict: close ? 'close' : diff > 0 ? 'higher' : 'lower', actualCents: actual, actualPercent: s.feePercent, estimateCents: est, differenceCents: diff,
      message: 'Fees were ' + fmt(actual) + ' (' + s.feePercent + '% of sales). Your estimate gives ' + fmt(est) + ': ' +
        (close ? 'close enough.' : diff > 0 ? 'the real fees are ' + fmt(diff) + ' higher. Raise the estimate.' : 'the real fees are ' + fmt(-diff) + ' lower. You can lower the estimate.') };
  }

  // the payouts as "expected deposits" for the bank matching (he-money-match matchDeposits)
  function expectedDeposits(parsed) {
    const p = parsed || {}; const name = (CHANNELS[p.channel] || {}).name || 'Channel';
    return summarize(p.rows).payouts.filter(x => x.cents > 0).map((x, i) => ({ ref: (p.channel || 'channel') + '-payout-' + x.day + '-' + (i + 1), kind: 'other', date: x.day, amountCents: x.cents, label: name + ' payout of ' + fmt(x.cents) }));
  }

  return { MAX_BYTES, MAX_ROWS, CHANNELS, KIND_WORD, toCents, toDay, parseReport, summarize, feeCheck, expectedDeposits, fmt };
}));
