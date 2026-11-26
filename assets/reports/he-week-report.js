// The weekly owner report (owner, Nov 24: "Weekly owner report, let's add it").
// One page for one finished week, Monday to Sunday: what was sold, what customers
// asked, returns, stock that is low right now, tasks and incidents, reviews, and
// how much each person did. This file is the arithmetic; the Backups & Printouts
// page reads the records and shows, prints or copies the report.
//
//   weekOf(nowMs, back)   -> { key, first, last, from, to, prevFrom, label }
//                            the last finished week on the viewer's own calendar
//                            (back = 1: the week before that, and so on)
//   weeks(nowMs, n)       -> the last n finished weeks, newest first
//   build(input)          -> the report (see below)
//   lines(report)         -> [{ section, label, value, note }]   what the page shows
//   toText(report)        -> the same as plain text, for "Copy"
//   due(nowMs, seenKey)   -> { due, week }    the Home reminder: until that week was opened
//
// Every figure is exact for the records it was given: nothing is estimated. A part
// that could not be read says so; it is never shown as zero. A part that was not
// asked for (a switch is off, or the person may not see it) is left out.
//   input.<part> === undefined  -> left out          (state 'off')
//   input.<part> === null/false -> could not be read (state 'unknown')
// Cancelled and refunded orders are counted as orders placed but not added to the
// money, the same rule as the day pack. Pure: no page, no database.
//
// Profit (Nov 26, the to-build list item 4: "a profit line, once the owner's costs are
// entered"): input.profit is what assets/reports/he-profit.js compute() gave for the
// orders of the week. It is the one part that uses estimates (the owner's fee, postage
// and packaging figures, where no real figure was saved for an order), and it says so.
// An order whose cost is not known is left out of the profit and counted as such; the
// profit is never shown as $0 because costs are missing.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-week-report'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NOT_COUNTED = ['cancelled', 'canceled', 'refunded', 'voided'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MAX_ROWS = 50000, TOP = 5, MAX_LOW = 25, MAX_PEOPLE = 50, MAX_WEEKS = 26;
  const OPEN_QUESTION = ['needs_review', 'new'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const text = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  const cents = (v) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return isFinite(n) ? Math.round(n * 100) : null; };
  const list = (v) => (Array.isArray(v) ? v.slice(0, MAX_ROWS) : []);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const stateOf = (v) => (v === undefined ? 'off' : Array.isArray(v) ? 'ok' : 'unknown');
  const ms = (v) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return isFinite(t) ? t : null; };
  const nowOf = (nowMs) => (typeof nowMs === 'number' && isFinite(nowMs) && Math.abs(nowMs) < 8.0e15 ? nowMs : Date.now());

  // The viewer's own calendar (docs/ops/TIMEZONE_CONTRACT.md). Built with calendar
  // dates, not by adding hours, so a week with a clock change is still Monday to Sunday.
  function weekOf(nowMs, back) {
    const n = new Date(nowOf(nowMs));
    const b = Number.isInteger(back) && back > 0 && back < 520 ? back : 0;
    const sinceMonday = (n.getDay() + 6) % 7;
    const day = (offset) => new Date(n.getFullYear(), n.getMonth(), n.getDate() - sinceMonday + offset);
    const first = day(-7 * (b + 1)), last = day(-7 * (b + 1) + 6), end = day(-7 * b), prev = day(-7 * (b + 2));
    const label = MONTHS[first.getMonth()] + ' ' + first.getDate() + ' – ' + MONTHS[last.getMonth()] + ' ' + last.getDate() + ', ' + last.getFullYear();
    return { key: ymd(first), first: ymd(first), last: ymd(last), from: first.toISOString(), to: end.toISOString(), prevFrom: prev.toISOString(), label: label };
  }
  function weeks(nowMs, n) {
    const count = Number.isInteger(n) && n > 0 ? Math.min(n, MAX_WEEKS) : 8;
    return Array.from({ length: count }, (_, i) => weekOf(nowMs, i));
  }

  function moneyOf(orders) {
    const by = Object.create(null);
    orders.forEach(o => { if (o.totalCents != null) by[o.currency] = (by[o.currency] || 0) + o.totalCents; });
    return Object.keys(by).sort().map(cur => ({ currency: cur, cents: by[cur] }));
  }
  function cleanOrders(rows) {
    const out = [];
    list(rows).forEach(o => {
      if (!isObj(o) || o.id == null || o.deleted_at) return;
      const status = text(o.status, 40).toLowerCase();
      const name = text(o.customer_name, 120), email = text(o.customer_email, 200).toLowerCase();
      out.push({ id: o.id, currency: (text(o.currency, 8) || 'USD').toUpperCase(), totalCents: cents(o.total), counted: !NOT_COUNTED.includes(status),
        client: email ? 'e:' + email : name ? 'n:' + name.toLowerCase() : 'none' });
    });
    return out;
  }

  function sales(input) {
    const state = stateOf(input.orders);
    if (state !== 'ok') return { state: state };
    const orders = cleanOrders(input.orders), counted = orders.filter(o => o.counted);
    const ids = Object.create(null); counted.forEach(o => { ids[o.id] = true; });
    const out = { state: 'ok', orders: orders.length, counted: counted.length, notCounted: orders.length - counted.length,
      noAmount: counted.filter(o => o.totalCents == null).length, byCurrency: moneyOf(counted),
      clients: Object.keys(orders.reduce((m, o) => { m[o.client] = true; return m; }, Object.create(null))).length,
      items: stateOf(input.items) === 'ok' ? 'ok' : 'unknown', units: null, top: [] };
    if (out.items === 'ok') {
      const by = Object.create(null); let units = 0;
      list(input.items).forEach(it => {
        if (!isObj(it) || it.order_id == null || !ids[it.order_id]) return;
        const qty = Number(it.quantity); if (!(isFinite(qty) && qty > 0)) return;
        const name = text(it.product_name, 120) || text(it.sku, 60) || 'Item';
        by[name] = (by[name] || 0) + qty; units += qty;
      });
      out.units = units;
      out.top = Object.keys(by).map(name => ({ name: name, qty: by[name] })).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).slice(0, TOP);
    }
    // the week before, for comparison: orders always; money only when both weeks are in one and the same currency
    const beforeState = stateOf(input.prevOrders);
    if (beforeState === 'ok') {
      const prev = cleanOrders(input.prevOrders), prevCounted = prev.filter(o => o.counted), prevMoney = moneyOf(prevCounted);
      const same = out.byCurrency.length <= 1 && prevMoney.length <= 1 && (!out.byCurrency.length || !prevMoney.length || out.byCurrency[0].currency === prevMoney[0].currency);
      out.before = { state: 'ok', orders: prev.length, byCurrency: prevMoney, ordersChange: orders.length - prev.length,
        centsChange: same && (out.byCurrency.length || prevMoney.length) ? (out.byCurrency.length ? out.byCurrency[0].cents : 0) - (prevMoney.length ? prevMoney[0].cents : 0) : null,
        currency: same ? ((out.byCurrency[0] || prevMoney[0] || {}).currency || null) : null };
    } else out.before = { state: beforeState };
    return out;
  }

  // questions: how many arrived in the week; how many are waiting right now, and since when
  function questions(input, now) {
    const a = stateOf(input.questions), b = stateOf(input.waiting);
    if (a === 'off' && b === 'off') return { state: 'off' };
    const out = { state: 'ok', arrived: null, waiting: null, oldestDays: null };
    if (a === 'ok') out.arrived = list(input.questions).filter(q => isObj(q) && q.id != null).length;
    if (b === 'ok') {
      const open = list(input.waiting).filter(q => isObj(q) && q.id != null && OPEN_QUESTION.includes(text(q.status, 40)));
      out.waiting = open.length;
      const oldest = open.map(q => ms(q.created_at)).filter(t => t != null).sort((x, y) => x - y)[0];
      out.oldestDays = oldest == null ? null : Math.max(0, Math.floor((now - oldest) / 86400000));
    }
    if (out.arrived === null && out.waiting === null) out.state = 'unknown';
    return out;
  }

  function returns(input, week) {
    const state = stateOf(input.returns);
    if (state !== 'ok') return { state: state };
    const from = ms(week.from), to = ms(week.to);
    const inWeek = (v) => { const t = ms(v); return t != null && t >= from && t < to; };
    const rows = list(input.returns).filter(r => isObj(r) && r.id != null);
    const refunded = rows.filter(r => inWeek(r.refunded_at));
    let refundCents = 0, noAmount = 0;
    refunded.forEach(r => { const c = cents(r.refund_amount); if (c == null) noAmount += 1; else refundCents += c; });
    return { state: 'ok', opened: rows.filter(r => inWeek(r.created_at)).length, refunded: refunded.length, refundCents: refundCents, refundNoAmount: noAmount };
  }

  // stock is "right now", not "during the week": a count from last Tuesday cannot be read back
  function stock(input) {
    const state = stateOf(input.stock);
    if (state !== 'ok') return { state: state };
    const names = Object.create(null);
    list(input.products).forEach(p => { if (isObj(p) && p.id != null) names[p.id] = text(p.name, 120) || text(p.sku, 60); });
    const low = []; let noLevel = 0, products = 0;
    list(input.stock).forEach(s => {
      if (!isObj(s) || s.product_id == null) return;
      products += 1;
      const have = Number(s.available), level = s.low_stock_threshold == null || s.low_stock_threshold === '' ? null : Number(s.low_stock_threshold);
      if (level == null || !isFinite(level)) { noLevel += 1; return; }
      if (isFinite(have) && have <= level) low.push({ name: names[s.product_id] || 'A product', available: have, level: level });
    });
    low.sort((a, b) => a.available - b.available || a.name.localeCompare(b.name));
    return { state: 'ok', products: products, lowCount: low.length, low: low.slice(0, MAX_LOW), noLevel: noLevel };
  }

  function work(input) {
    const a = stateOf(input.tasks), b = stateOf(input.incidents);
    if (a === 'off' && b === 'off') return { state: 'off' };
    const count = (v) => (Array.isArray(v) ? list(v).filter(r => isObj(r) && r.id != null).length : null);
    const out = { state: 'ok', tasks: count(input.tasks), incidents: count(input.incidents) };
    if (out.tasks === null && out.incidents === null) out.state = 'unknown';
    return out;
  }

  // reviews received in the week (by the day written on the review; else the day it was added)
  function reviews(input, week) {
    const state = stateOf(input.reviews);
    if (state !== 'ok') return { state: state };
    const from = ms(week.from), to = ms(week.to);
    const mine = list(input.reviews).filter(r => {
      if (!isObj(r) || !(Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 5) || r.status === 'removed') return false;
      if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) return r.date >= week.first && r.date <= week.last;
      const t = typeof r.addedAt === 'number' && isFinite(r.addedAt) ? r.addedAt : ms(r.addedAt);
      return t != null && t >= from && t < to;
    });
    const sum = mine.reduce((s, r) => s + r.stars, 0);
    return { state: 'ok', count: mine.length, low: mine.filter(r => r.stars <= 2).length, five: mine.filter(r => r.stars === 5).length,
      averageTenths: mine.length ? Math.round(sum * 10 / mine.length) : null };
  }

  // profit after product cost, fees, postage and packaging (he-profit.js compute() for the week)
  function profit(input) {
    const p = input.profit;
    if (p === undefined) return { state: 'off' };
    if (!isObj(p) || !isObj(p.totals)) return { state: 'unknown' };
    const t = p.totals;
    const int = (v) => (Number.isInteger(v) ? v : null);
    const orders = int(t.orders), complete = int(t.complete);
    if (orders === null || complete === null || orders < 0 || complete < 0 || complete > orders) return { state: 'unknown' };
    const why = isObj(p.missingWhy) ? Object.keys(p.missingWhy).filter(k => Number.isInteger(p.missingWhy[k]) && p.missingWhy[k] > 0)
      .map(k => ({ what: text(k, 60), orders: p.missingWhy[k] })).sort((a, b) => b.orders - a.orders || a.what.localeCompare(b.what)) : [];
    const out = { state: 'ok', orders: orders, complete: complete, missing: orders - complete, why: why,
      revenueCents: null, profitCents: null, marginTenths: null, exactFees: int(t.exactFees) || 0, exactPostage: int(t.exactPostage) || 0 };
    if (complete > 0) {
      if (int(t.revenue) === null || int(t.profit) === null) return { state: 'unknown' };
      out.revenueCents = t.revenue; out.profitCents = t.profit;
      out.marginTenths = t.revenue > 0 ? Math.round(t.profit * 1000 / t.revenue) : null;
    }
    return out;
  }

  // how much each person did: one line per person, the number of recorded changes
  function people(input) {
    const state = stateOf(input.activity);
    if (state !== 'ok') return { state: state };
    const by = Object.create(null), seen = Object.create(null); let total = 0;
    list(input.activity).forEach(r => {
      if (!isObj(r)) return;
      if (r.id != null) { if (seen[r.id]) return; seen[r.id] = true; }
      const account = text(r.person_account_number, 20), name = text(r.person_name, 120);
      const key = account ? '#' + account : name ? 'n:' + name.toLowerCase() : 'none';
      const p = by[key] = by[key] || { name: name || 'No name recorded', role: text(r.person_role, 40), account: account, actions: 0 };
      p.actions += 1; total += 1;
    });
    const rows = Object.keys(by).map(k => by[k]).sort((a, b) => b.actions - a.actions || a.name.localeCompare(b.name));
    return { state: 'ok', total: total, people: rows.length, rows: rows.slice(0, MAX_PEOPLE), capped: input.activityCapped === true };
  }

  function build(input) {
    const i = isObj(input) ? input : {};
    const now = nowOf(i.now);
    const w = isObj(i.week) && typeof i.week.first === 'string' && typeof i.week.last === 'string' && ms(i.week.from) != null && ms(i.week.to) != null ? i.week : weekOf(now, 0);
    const week = { key: text(w.key, 10) || text(w.first, 10), first: text(w.first, 10), last: text(w.last, 10), from: w.from, to: w.to, label: text(w.label, 60) || text(w.first, 10) + ' – ' + text(w.last, 10) };
    return { week: week, sales: sales(i), profit: profit(i), questions: questions(i, now), returns: returns(i, week), stock: stock(i), work: work(i), reviews: reviews(i, week), people: people(i) };
  }

  // ----- what the page shows -----
  const money = (c, cur) => { const neg = c < 0, a = Math.abs(c); return (neg ? '-' : '') + (cur === 'USD' ? '$' : '') + String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + pad(a % 100) + (cur === 'USD' ? '' : ' ' + cur); };
  const moneyList = (rows) => (rows.length ? rows.map(m => money(m.cents, m.currency)).join(' + ') : null);
  const signed = (n) => (n > 0 ? '+' + n : String(n));
  const UNKNOWN = 'could not be read';

  function lines(report) {
    const r = isObj(report) ? report : build({});
    const out = [];
    const add = (section, label, value, note) => out.push({ section: section, label: label, value: value, note: note || '' });
    const s = r.sales || { state: 'off' };
    if (s.state === 'unknown') add('Sales', 'Orders of the week', UNKNOWN);
    if (s.state === 'ok') {
      add('Sales', 'Orders placed', String(s.orders), s.before && s.before.state === 'ok' ? 'the week before: ' + s.before.orders + ' (' + signed(s.before.ordersChange) + ')' : s.before && s.before.state === 'unknown' ? 'the week before ' + UNKNOWN : '');
      add('Sales', 'Order totals (tax and shipping included)', moneyList(s.byCurrency) || (s.counted ? '—' : money(0, 'USD')),
        s.before && s.before.state === 'ok' ? 'the week before: ' + (moneyList(s.before.byCurrency) || money(0, s.before.currency || 'USD')) + (s.before.centsChange == null ? '' : ' (' + (s.before.centsChange > 0 ? '+' : '') + money(s.before.centsChange, s.before.currency || 'USD') + ')') : '');
      add('Sales', 'Bottles and other items sold', s.units == null ? UNKNOWN : String(s.units));
      add('Sales', 'Clients who ordered', String(s.clients));
      if (s.notCounted) add('Sales', 'Cancelled or refunded (not in the totals)', String(s.notCounted));
      if (s.noAmount) add('Sales', 'Orders with no amount saved (not in the totals)', String(s.noAmount));
      s.top.forEach((t, n) => add('Sales', n === 0 ? 'Sold most' : '', t.qty + ' × ' + t.name));
    }
    const pf = r.profit || { state: 'off' };
    if (pf.state === 'unknown') add('Profit', 'Profit after costs', UNKNOWN);
    if (pf.state === 'ok') {
      const tenths = (n) => (n < 0 ? '-' : '') + Math.floor(Math.abs(n) / 10) + '.' + (Math.abs(n) % 10);
      const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
      const reasons = pf.why.map(w => w.what + ' (' + plural(w.orders, 'order', 'orders') + ')').join(', ');
      if (pf.orders === 0) add('Profit', 'Profit after costs', '—', 'no orders to count');
      else if (pf.complete === 0) add('Profit', 'Profit after costs', 'not worked out yet', 'a cost is missing on every order' + (reasons ? ': ' + reasons : '') + '; enter it under Accounting, Real profit');
      else {
        add('Profit', 'Profit after costs', money(pf.profitCents, 'USD'),
          (pf.marginTenths == null ? '' : tenths(pf.marginTenths) + '% of ') + money(pf.revenueCents, 'USD') + ' in sales without sales tax · ' + pf.complete + ' of ' + plural(pf.orders, 'order', 'orders'));
        if (pf.missing) add('Profit', 'Orders not in the profit (a cost is missing)', String(pf.missing), reasons);
        const real = [];
        if (pf.exactFees) real.push('the real fee on ' + plural(pf.exactFees, 'order', 'orders'));
        if (pf.exactPostage) real.push('the real postage on ' + plural(pf.exactPostage, 'order', 'orders'));
        add('Profit', 'Worked out with', 'product cost, fees, postage and packaging', 'fees, postage and packaging are your estimates' + (real.length ? ', except ' + real.join(' and ') : ''));
      }
    }
    const q = r.questions || { state: 'off' };
    if (q.state === 'unknown') add('Customers', 'Customer questions', UNKNOWN);
    if (q.state === 'ok') {
      add('Customers', 'New questions in the week', q.arrived == null ? UNKNOWN : String(q.arrived));
      add('Customers', 'Waiting for an answer right now', q.waiting == null ? UNKNOWN : String(q.waiting),
        q.waiting && q.oldestDays != null ? 'the oldest has waited ' + (q.oldestDays === 0 ? 'less than a day' : q.oldestDays === 1 ? '1 day' : q.oldestDays + ' days') : '');
    }
    const rv = r.reviews || { state: 'off' };
    if (rv.state === 'unknown') add('Customers', 'Reviews', UNKNOWN);
    if (rv.state === 'ok') add('Customers', 'Reviews received', String(rv.count),
      rv.count ? 'average ' + Math.floor(rv.averageTenths / 10) + '.' + (rv.averageTenths % 10) + ' of 5 · ' + rv.five + ' with five stars · ' + rv.low + ' with one or two' : '');
    const rt = r.returns || { state: 'off' };
    if (rt.state === 'unknown') add('Returns', 'Returns', UNKNOWN);
    if (rt.state === 'ok') {
      add('Returns', 'Returns opened', String(rt.opened));
      add('Returns', 'Refunds given', String(rt.refunded), rt.refunded ? money(rt.refundCents, 'USD') + (rt.refundNoAmount ? ' (' + rt.refundNoAmount + ' with no amount saved)' : '') : '');
    }
    const st = r.stock || { state: 'off' };
    if (st.state === 'unknown') add('Stock right now', 'Stock', UNKNOWN);
    if (st.state === 'ok') {
      add('Stock right now', 'Products at or under their alert level', String(st.lowCount), st.products ? 'of ' + st.products + (st.products === 1 ? ' product' : ' products') : '');
      st.low.forEach(l => add('Stock right now', '', l.name, l.available + ' left, alert at ' + l.level));
      if (st.lowCount > st.low.length) add('Stock right now', '', 'and ' + (st.lowCount - st.low.length) + ' more', 'see Inventory');
      if (st.noLevel) add('Stock right now', 'Products with no alert level set', String(st.noLevel), 'these can never show as low');
    }
    const wk = r.work || { state: 'off' };
    if (wk.state === 'unknown') add('Work', 'Tasks and incidents', UNKNOWN);
    if (wk.state === 'ok') {
      add('Work', 'Tasks opened', wk.tasks == null ? UNKNOWN : String(wk.tasks));
      add('Work', 'Incidents opened', wk.incidents == null ? UNKNOWN : String(wk.incidents));
    }
    const pp = r.people || { state: 'off' };
    if (pp.state === 'unknown') add('People', 'What each person did', UNKNOWN);
    if (pp.state === 'ok') {
      add('People', 'Recorded changes in the week', (pp.capped ? 'at least ' : '') + pp.total, pp.capped ? 'the list was too long to read to the end; see Employee Activity' : pp.people + (pp.people === 1 ? ' person' : ' people'));
      pp.rows.forEach(p => add('People', '', p.name + (p.account ? ' · #' + p.account : ''), p.actions + (p.actions === 1 ? ' change' : ' changes') + (p.role ? ' · ' + p.role : '')));
    }
    return out;
  }

  function toText(report) {
    const r = isObj(report) ? report : build({});
    const out = ['Weekly report, ' + ((r.week && r.week.label) || ''), ''];
    let section = null;
    lines(r).forEach(l => {
      if (l.section !== section) { if (section !== null) out.push(''); section = l.section; out.push(l.section.toUpperCase()); }
      out.push((l.label ? l.label + ': ' : '  ') + l.value + (l.note ? ' (' + l.note + ')' : ''));
    });
    out.push('', footNote(r));
    return out.join('\n');
  }

  // the line under the report: the profit is the one part that can use estimates
  function footNote(report) {
    const pf = isObj(report) && isObj(report.profit) ? report.profit : null;
    return pf && pf.state === 'ok' && pf.complete > 0
      ? 'Exact figures from the records. Only the profit uses your fee, postage and packaging estimates.'
      : 'Exact figures from the records. Nothing is estimated.';
  }

  // the Home reminder: the newest finished week, until it was opened (on any device, when that is shared)
  function due(nowMs, seenKey) {
    const w = weekOf(nowMs, 0);
    const seen = typeof seenKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(seenKey) ? seenKey : '';
    return { due: seen < w.key, week: w };
  }

  return { NOT_COUNTED, MAX_ROWS, MAX_LOW, MAX_PEOPLE, TOP, weekOf, weeks, build, lines, toText, footNote, due };
}));
