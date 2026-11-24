// The day pack (owner, Nov 24: "I want to be able to print backup for all day,
// clients list and everything when I need"). One calendar day on paper: every
// order of the day with its items, the clients of the day, and the totals. This
// file is the arithmetic; the Backups & Printouts page reads the orders and prints.
//
//   checkDay(text)                 -> { ok, day, reason }          a real YYYY-MM-DD date
//   bounds(day)                    -> [fromIso, toIso] | null      that day on the viewer's own calendar
//   build({ day, orders, items })  -> { day, orders, clients, totals }
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

  return { NOT_COUNTED, MAX_ORDERS, checkDay, bounds, build };
}));
