// The day pack (owner, Nov 24: "I want to be able to print backup for all day,
// clients list and everything when I need"). One calendar day on paper: every
// order of the day with its items, the clients of the day, and the totals. This
// file is the arithmetic; the Backups & Printouts page reads the orders and prints.
//
//   checkDay(text)                 -> { ok, day, reason }          a real YYYY-MM-DD date
//   bounds(day)                    -> [fromIso, toIso] | null      that day on the viewer's own calendar
//   build({ day, orders, items })  -> { day, orders, clients, totals }
//   PERIODS, periodBounds(key, nowMs) -> [fromIso | null, toIso]    for the client list
//   clientList(orders)             -> { clients, totals }          every client in those orders, once
//
// Every figure is exact for the orders listed: nothing is estimated. Cancelled and
// refunded orders are listed (the paper is a record) but not added to the totals.
// Pure: no page, no database.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-day-pack'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NOT_COUNTED = ['cancelled', 'canceled', 'refunded', 'voided'];
  const MAX_ORDERS = 5000;
  const text = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  const cents = (v) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return isFinite(n) ? Math.round(n * 100) : null; };

  function checkDay(value) {
    const t = text(value, 20);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m) return { ok: false, day: '', reason: 'Choose a day.' };
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (y < 2020 || y > 2100 || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return { ok: false, day: '', reason: 'That is not a real date.' };
    return { ok: true, day: t, reason: '' };
  }

  // the day as the person looking at the dashboard has it on their calendar (docs/ops/TIMEZONE_CONTRACT.md)
  function bounds(day) {
    const c = checkDay(day);
    if (!c.ok) return null;
    const p = c.day.split('-').map(Number);
    return [new Date(p[0], p[1] - 1, p[2]).toISOString(), new Date(p[0], p[1] - 1, p[2] + 1).toISOString()];
  }

  function build(input) {
    const i = input !== null && typeof input === 'object' ? input : {};
    const day = checkDay(i.day).day;
    const linesBy = Object.create(null);
    (Array.isArray(i.items) ? i.items : []).forEach(it => {
      if (!it || typeof it !== 'object' || it.order_id == null) return;
      const qty = Number(it.quantity);
      (linesBy[it.order_id] = linesBy[it.order_id] || []).push({ qty: isFinite(qty) && qty > 0 ? qty : 0, name: text(it.product_name, 120) || text(it.sku, 60) || 'Item', sku: text(it.sku, 60) });
    });
    const orders = [];
    (Array.isArray(i.orders) ? i.orders : []).slice(0, MAX_ORDERS).forEach(o => {
      if (!o || typeof o !== 'object' || o.id == null || o.deleted_at) return;
      const status = text(o.status, 40).toLowerCase();
      orders.push({ id: o.id, number: text(o.order_number, 60) || '(no number)', placedAt: typeof o.placed_at === 'string' ? o.placed_at : null,
        customer: text(o.customer_name, 120), email: text(o.customer_email, 200), status: status || 'unknown',
        currency: (text(o.currency, 8) || 'USD').toUpperCase(), totalCents: cents(o.total), counted: !NOT_COUNTED.includes(status),
        lines: linesBy[o.id] || [] });
    });
    orders.sort((a, b) => String(a.placedAt || '').localeCompare(String(b.placedAt || '')) || a.number.localeCompare(b.number));
    // the clients of the day: one line per person, by email, else by name
    const byClient = Object.create(null), clients = [];
    orders.forEach(o => {
      const key = o.email ? 'e:' + o.email.toLowerCase() : o.customer ? 'n:' + o.customer.toLowerCase() : 'none';
      let c = byClient[key];
      if (!c) { c = byClient[key] = { name: o.customer || (key === 'none' ? 'No name on the order' : ''), email: o.email, orders: [] }; clients.push(c); }
      if (!c.name && o.customer) c.name = o.customer;
      c.orders.push(o.number);
    });
    clients.sort((a, b) => (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase()));
    const counted = orders.filter(o => o.counted);
    const money = Object.create(null);
    counted.forEach(o => { if (o.totalCents != null) money[o.currency] = (money[o.currency] || 0) + o.totalCents; });
    const totals = { orders: orders.length, counted: counted.length, notCounted: orders.length - counted.length,
      noAmount: counted.filter(o => o.totalCents == null).length,
      units: counted.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.qty, 0), 0),
      byCurrency: Object.keys(money).sort().map(cur => ({ currency: cur, cents: money[cur] })), clients: clients.length };
    return { day: day, orders: orders, clients: clients, totals: totals };
  }

  // The client list (owner, Nov 24: "clients list ... when I need"). Every client who
  // placed an order in the period, once: how many orders, what they add up to, the first
  // and the last order. Worked out from the orders themselves, so every figure is exact.
  // Cancelled and refunded orders are not counted; a client with only such orders is
  // still listed, with 0 counted orders, because the paper is a record.
  const PERIODS = Object.freeze([
    Object.freeze({ key: '30', name: 'The last 30 days', days: 30 }),
    Object.freeze({ key: '90', name: 'The last 90 days', days: 90 }),
    Object.freeze({ key: '365', name: 'The last 12 months', days: 365 }),
    Object.freeze({ key: 'all', name: 'All orders', days: null })]);
  function periodBounds(key, nowMs) {
    const p = PERIODS.find(x => x.key === key) || PERIODS[1];
    // a time a calendar cannot hold (far outside any real date) is treated as "now"
    const now = typeof nowMs === 'number' && Math.abs(nowMs) <= 8.0e15 ? nowMs : Date.now();
    return { key: p.key, name: p.name, from: p.days == null ? null : new Date(now - p.days * 86400000).toISOString(), to: new Date(now).toISOString() };
  }
  const MAX_LIST_ORDERS = 50000;
  function clientList(orders) {
    const by = Object.create(null), clients = [];
    let counted = 0, listed = 0;
    (Array.isArray(orders) ? orders : []).slice(0, MAX_LIST_ORDERS).forEach(o => {
      if (!o || typeof o !== 'object' || o.id == null || o.deleted_at) return;
      listed += 1;
      const name = text(o.customer_name, 120), email = text(o.customer_email, 200);
      const key = email ? 'e:' + email.toLowerCase() : name ? 'n:' + name.toLowerCase() : 'none';
      let c = by[key];
      if (!c) { c = by[key] = { name: name || (key === 'none' ? 'No name on the order' : ''), email: email, orders: 0, notCounted: 0, money: Object.create(null), first: null, last: null }; clients.push(c); }
      if (!c.name && name) c.name = name;
      const day = typeof o.placed_at === 'string' && !isNaN(Date.parse(o.placed_at)) ? o.placed_at : null;
      if (day && (c.first === null || day < c.first)) c.first = day;
      if (day && (c.last === null || day > c.last)) c.last = day;
      if (NOT_COUNTED.includes(text(o.status, 40).toLowerCase())) { c.notCounted += 1; return; }
      c.orders += 1; counted += 1;
      const amount = cents(o.total), cur = (text(o.currency, 8) || 'USD').toUpperCase();
      if (amount != null) c.money[cur] = (c.money[cur] || 0) + amount;
    });
    const out = clients.map(c => ({ name: c.name, email: c.email, orders: c.orders, notCounted: c.notCounted, first: c.first, last: c.last,
      byCurrency: Object.keys(c.money).sort().map(cur => ({ currency: cur, cents: c.money[cur] })) }));
    out.sort((a, b) => (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase()) || a.email.localeCompare(b.email));
    return { clients: out, totals: { clients: out.length, orders: listed, counted: counted, repeat: out.filter(c => c.orders > 1).length } };
  }

  return { NOT_COUNTED, MAX_ORDERS, MAX_LIST_ORDERS, PERIODS, checkDay, bounds, build, periodBounds, clientList };
}));
