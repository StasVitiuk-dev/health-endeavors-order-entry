// "Ready to launch" (owner, Nov 24: "Ready to launch page: yes"). One page that says,
// line by line, what is ready for the first real day and what is not. Two kinds of line:
//   - checked by the dashboard: it reads the records and says Ready / To do / Could not check;
//   - confirmed by you: things the dashboard cannot see (the printers, the business email,
//     a restored backup, a test order). The owner or an administrator marks them done.
// Two-step sign-in is the last line on purpose (owner, Nov 24: "later ... one of the last").
//
//   LINES                         the lines, in order
//   build(input)               -> { lines, ready, total, left, state }
//   tick(ticks, key, on, who, now) -> ticks          mark one "confirmed by you" line
//   merge(a, b)                -> ticks              two devices: the later mark of each line wins
//   clean(value)               -> ticks              what is kept, checked again on the way in
//
// A line that could not be read is "Could not check", never "Ready". Pure: no page, no database.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-launch'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = (v, max) => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, max || 120);
  const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const OPEN_QUESTION = ['needs_review', 'new'];

  const LINES = Object.freeze([
    { key: 'steps', kind: 'auto', title: 'The database steps are installed', page: 'flagsPanel', pageName: 'Feature Flags',
      why: 'Each feature that saves real records needs its step in the database. You run each one after approving it.' },
    { key: 'products', kind: 'auto', title: 'Your products are in, each with a price', page: 'inventoryPanel', pageName: 'Inventory',
      why: 'An order can only be read correctly for a product the dashboard knows.' },
    { key: 'stock', kind: 'auto', title: 'Stock is counted, and every product has an alert level', page: 'inventoryPanel', pageName: 'Inventory',
      why: 'Without a count the dashboard cannot warn you before you run out.' },
    { key: 'shopify', kind: 'auto', title: 'Orders arrive from Shopify by themselves', page: 'flagsPanel', pageName: 'Feature Flags',
      why: 'The order feed is switched on, and at least one order has come through it in the last 30 days.' },
    { key: 'tax', kind: 'auto', title: 'Your sales tax rate is confirmed', page: 'taxRecordsPanel', pageName: 'Tax Records',
      why: 'An invoice uses only a rate you confirmed yourself; tax is never guessed.' },
    { key: 'questions', kind: 'auto', title: 'No customer is waiting for an answer', page: 'inquiriesPanel', pageName: 'Customer Inquiries',
      why: 'Start the first day with an empty list.' },
    { key: 'email', kind: 'yours', title: 'The business email on your own address is working',
      why: 'Customers and stores should hear from the business, not from a personal address. Needed before anything is sent.' },
    { key: 'people', kind: 'yours', title: 'Everyone who will work has their own account', page: 'activityPanel', pageName: 'Employee Activity',
      why: 'One account per person, so the history shows who did what. Nobody shares a sign-in.' },
    { key: 'printers', kind: 'yours', title: 'Both printers printed their test page', page: 'ordersPanel', pageName: 'Orders',
      why: 'The label printer and the paper printer: the frame shows on all four sides and the square measures one inch.' },
    { key: 'backups', kind: 'yours', title: 'A backup was restored once, as a test',
      why: 'A backup that was never restored is a hope, not a backup. One restore into a throwaway copy, then delete it.' },
    { key: 'rehearsal', kind: 'yours', title: 'One real test order went all the way through',
      why: 'From the store to a packed box: the order arrives, the slip and the label print, stock goes down, the customer is told. Do it when the printers are here.' },
    { key: 'agents', kind: 'yours', title: 'You chose which agents run on the first day', page: 'aiPanel', pageName: 'AI Agent Activity',
      why: 'Every agent is a switch. Start with few; nothing reaches a customer without your approval.' },
    { key: 'policies', kind: 'yours', title: 'The store shows its shipping, returns and privacy rules',
      why: 'Customers look for them before they buy, and the answers the dashboard drafts refer to them.' },
    { key: 'twostep', kind: 'yours', last: true, title: 'Two-step sign-in is on for the accounts behind the dashboard',
      why: 'The last step, on purpose: turn it on just before the first employee starts (the database, the code and the store sign-ins).' },
  ].map(l => Object.freeze(l)));
  const YOURS = LINES.filter(l => l.kind === 'yours').map(l => l.key);

  // ----- marks made by a person -----
  function clean(value) {
    const src = isObj(value) && isObj(value.ticks) ? value.ticks : isObj(value) ? value : {};
    const out = {};
    YOURS.forEach(k => {
      const t = src[k];
      if (!isObj(t) || typeof t.on !== 'boolean' || !(typeof t.at === 'number' && isFinite(t.at) && t.at > 0 && t.at < 8.0e15)) return;
      out[k] = { on: t.on, at: Math.floor(t.at), by: text(t.by, 80) };
    });
    return out;
  }
  function tick(ticks, key, on, who, now) {
    const out = clean(ticks);
    if (!YOURS.includes(key)) return out;
    const t = typeof now === 'number' && isFinite(now) && now > 0 && now < 8.0e15 ? Math.floor(now) : Date.now();
    out[key] = { on: on === true, at: Math.max(t, out[key] ? out[key].at + 1 : 0), by: text(who, 80) };   // a new mark is always later than the one it replaces
    return out;
  }
  function merge(a, b) {
    const x = clean(a), y = clean(b), out = {};
    YOURS.forEach(k => { const p = x[k], q = y[k]; if (p && q) out[k] = q.at > p.at ? q : p; else if (p || q) out[k] = p || q; });
    return out;
  }

  // ----- lines the dashboard checks itself -----
  const unknown = (detail) => ({ state: 'unknown', detail: detail || 'Could not be read just now. Open the page again to try once more.' });
  const AUTO = {
    steps(i) {
      const s = i.steps;
      if (!Array.isArray(s) || !s.length) return unknown();
      const need = s.filter(x => isObj(x) && x.needsStep !== false);
      const missing = need.filter(x => x.state === 'not_installed'), unsure = need.filter(x => x.state !== 'installed' && x.state !== 'not_installed');
      const done = need.length - missing.length - unsure.length;
      if (unsure.length && !missing.length) return unknown(done + ' of ' + need.length + ' installed; ' + count(unsure.length, 'step', 'steps') + ' could not be checked.');
      if (!missing.length) return { state: 'ready', detail: 'All ' + need.length + ' are installed.' };
      return { state: 'todo', detail: done + ' of ' + need.length + ' installed. Still to install: ' + missing.slice(0, 12).map(x => text(x.name, 60)).join('; ') + '.'
        + (unsure.length ? ' ' + count(unsure.length, 'step', 'steps') + ' could not be checked.' : '') };
    },
    products(i) {
      if (!Array.isArray(i.products)) return unknown();
      const live = i.products.filter(p => isObj(p) && p.id != null && p.is_active !== false && text(p.status, 30) !== 'discontinued');
      if (!live.length) return { state: 'todo', detail: 'No product for sale yet. Add your products on Inventory (or import the list).' };
      const noPrice = live.filter(p => !(Number(p.retail_price) > 0));
      if (noPrice.length) return { state: 'todo', detail: count(live.length, 'product', 'products') + ' for sale; ' + noPrice.length + ' with no price: ' + noPrice.slice(0, 5).map(p => text(p.name, 60) || text(p.sku, 40) || 'no name').join('; ') + '.' };
      return { state: 'ready', detail: count(live.length, 'product', 'products') + ' for sale, each with a price.' };
    },
    stock(i) {
      if (!Array.isArray(i.products) || !Array.isArray(i.stock)) return unknown();
      const live = i.products.filter(p => isObj(p) && p.id != null && p.is_active !== false && text(p.status, 30) !== 'discontinued');
      if (!live.length) return { state: 'todo', detail: 'No product for sale yet, so there is nothing to count.' };
      const by = Object.create(null); i.stock.forEach(s => { if (isObj(s) && s.product_id != null) by[s.product_id] = s; });
      const none = live.filter(p => !(by[p.id] && Number(by[p.id].available) > 0));
      const noLevel = live.filter(p => !(by[p.id] && by[p.id].low_stock_threshold != null && isFinite(Number(by[p.id].low_stock_threshold))));
      if (!none.length && !noLevel.length) return { state: 'ready', detail: 'Every product has a count above zero and an alert level.' };
      const parts = [];
      if (none.length) parts.push(count(none.length, 'product has', 'products have') + ' nothing counted');
      if (noLevel.length) parts.push(count(noLevel.length, 'product has', 'products have') + ' no alert level');
      return { state: 'todo', detail: parts.join('; ') + '.' };
    },
    shopify(i) {
      const s = i.shopify;
      if (!isObj(s) || (s.switchOn !== true && s.switchOn !== false && s.switchOn !== 'missing') || !(Number.isInteger(s.orders) && s.orders >= 0)) return unknown();
      if (s.switchOn === 'missing') return { state: 'todo', detail: 'The Shopify order switch does not exist in the database yet.' };
      if (!s.switchOn) return { state: 'todo', detail: 'The Shopify order switch is off. It is kept off on purpose until the stock steps are installed; it is one of the last switches to turn on.' };
      if (!s.orders) return { state: 'todo', detail: 'The switch is on, but no order has come from Shopify in the last 30 days. The test order will show it.' };
      return { state: 'ready', detail: 'The switch is on; ' + count(s.orders, 'order has', 'orders have') + ' come from Shopify in the last 30 days.' };
    },
    tax(i) {
      const t = i.tax;
      if (!isObj(t) || !['installed', 'not_installed', 'off'].includes(t.state)) return unknown();
      if (t.state === 'not_installed') return { state: 'todo', detail: 'Its database step is not installed yet (Feature Flags shows which).' };
      if (t.state === 'off') return { state: 'todo', detail: 'The step is installed. Turn on "Confirmed tax rates" on Feature Flags, then confirm your rate on Tax Records.' };
      if (!(Number.isInteger(t.inForce) && t.inForce >= 0)) return unknown();
      return t.inForce ? { state: 'ready', detail: count(t.inForce, 'rate is', 'rates are') + ' confirmed and in force today.' } : { state: 'todo', detail: 'No rate is confirmed for today. Confirm it on Tax Records.' };
    },
    questions(i) {
      if (!Array.isArray(i.questions)) return unknown();
      const open = i.questions.filter(q => isObj(q) && q.id != null && OPEN_QUESTION.includes(text(q.status, 40))).length;
      return open ? { state: 'todo', detail: count(open, 'customer is', 'customers are') + ' waiting for an answer.' } : { state: 'ready', detail: 'Nobody is waiting.' };
    },
  };

  function build(input) {
    const i = isObj(input) ? input : {};
    const ticks = clean(i.ticks);
    const lines = LINES.map(l => {
      const base = { key: l.key, kind: l.kind, title: l.title, why: l.why, page: l.page || '', pageName: l.pageName || '', last: l.last === true };
      if (l.kind === 'auto') { let r; try { r = AUTO[l.key](i); } catch (e) { r = unknown(); } return Object.assign(base, { state: r.state, detail: r.detail, tick: null }); }
      const t = ticks[l.key] || null;
      return Object.assign(base, { state: t && t.on ? 'ready' : 'todo', detail: '', tick: t });
    });
    const ready = lines.filter(l => l.state === 'ready').length, unsure = lines.filter(l => l.state === 'unknown').length;
    return { lines: lines, ready: ready, total: lines.length, left: lines.length - ready, unknown: unsure,
      state: ready === lines.length ? 'ready' : unsure ? 'unknown' : 'todo' };
  }

  return { LINES, YOURS, build, tick, merge, clean };
}));
