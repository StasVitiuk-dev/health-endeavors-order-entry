// Real profit (owner, Nov 24, gap 5): profit per order, per product and per sales
// channel, after product cost, platform fees, postage and packaging.
//
//   revenue      = what the customer paid for goods and shipping, WITHOUT the sales
//                  tax collected for the state (subtotal + shipping; or total - tax)
//   product cost = quantity x the product's true unit cost: the newest landed cost
//                  from a received purchase order (goods + shipping + tax shared),
//                  else the cost typed on the product. No cost known -> the order
//                  is counted as "missing a cost" and its profit is not guessed.
//   fees         = the channel's fee estimate (percent of revenue + per order),
//                  editable by the owner; an empty estimate is "unknown", never 0
//   postage, packaging = per-order estimates the owner enters (unknown if empty)
//   profit       = revenue - product cost - fees - postage - packaging
// Cancelled and refunded orders are left out (listed separately); partly refunded
// orders are counted but marked to check. Figures in cents, no rounding drift.
//
// Pure. Dual-mode (Node require + browser HE.reports registry). Never writes.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-profit'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Estimates to check against each platform's own fee page; the owner edits them.
  // An empty value means unknown (never counted as zero).
  const DEFAULT_FEES = Object.freeze({
    shopify:   { percent: 2.9, perOrder: 0.30, note: 'Shopify Payments, online card rate on the Basic plan' },
    amazon:    { percent: 15,  perOrder: 0,    note: 'Amazon referral fee for Beauty (8% when the item is $10 or less); the monthly plan fee is not per order' },
    etsy:      { percent: 9.5, perOrder: 0.45, note: 'Etsy: 6.5% transaction + 3% processing; $0.25 processing + $0.20 listing per order' },
    tiktok:    { percent: null, perOrder: null, note: 'TikTok Shop: enter the commission from Seller Center' },
    manual:    { percent: 0,   perOrder: 0,    note: 'Orders entered by hand (wholesale, markets): no platform fee' },
    wholesale: { percent: 0,   perOrder: 0,    note: 'Wholesale: no platform fee' },
  });
  const CHANNEL_NAMES = { shopify: 'Shopify (website)', amazon: 'Amazon', etsy: 'Etsy', tiktok: 'TikTok Shop', manual: 'Entered by hand', wholesale: 'Wholesale' };
  const LEFT_OUT = ['cancelled', 'canceled', 'refunded', 'voided'];

  const cents = (v) => { if (v == null || v === '') return null; const n = Number(v); return isFinite(n) ? Math.round(n * 100) : null; };
  const num = (v) => { if (v == null || v === '') return null; const n = Number(v); return isFinite(n) ? n : null; };
  const key = (v) => String(v == null ? '' : v).trim().toLowerCase();
  const channelOf = (o) => { const c = key(o && typeof o === 'object' ? (o.channel || o.source) : ''); return c.includes('amazon') ? 'amazon' : c.includes('etsy') ? 'etsy' : c.includes('tiktok') ? 'tiktok' : c.includes('wholesale') ? 'wholesale' : c === 'manual' ? 'manual' : c.includes('shopify') || c === 'web' || c === 'online' ? 'shopify' : (c || 'unknown'); };

  // true unit cost per product: newest landed cost from received purchase-order
  // lines (product_id), else products.cost; null when none is known
  function unitCosts(products, poLines) {
    const out = {};
    const newest = {};
    (Array.isArray(poLines) ? poLines : []).forEach(l => {
      if (!l || !l.product_id) return;
      const c = cents(l.landed_unit_cost != null ? l.landed_unit_cost : null);
      if (c == null || !(Number(l.quantity_received) > 0)) return;
      const at = String(l.received_at || l.created_at || '');
      if (!newest[l.product_id] || at > newest[l.product_id].at) newest[l.product_id] = { at: at, c: c };
    });
    (Array.isArray(products) ? products : []).forEach(p => {
      if (!p || !p.id) return;
      const c = newest[p.id] ? newest[p.id].c : cents(p.cost);
      const entry = { cost: c, source: newest[p.id] ? 'landed' : (c != null ? 'product' : null), name: String(p.name || p.sku || 'Product') };
      out['id:' + p.id] = entry;
      if (p.sku) out['sku:' + key(p.sku)] = entry;
    });
    return out;
  }

  // Packaging by box size (owner's list, Nov 24: "packaging cost per box type").
  // The owner says which boxes exist: a name, how many bottles fit, what one costs.
  // An order goes out in the smallest box that holds it; a larger order fills the
  // biggest box as often as needed and the rest goes in the smallest box that fits.
  // An ESTIMATE from the number of bottles: which box was really used is not recorded.
  const MAX_BOXES = 4, MAX_BOX_UNITS = 500;
  function cleanBoxes(list) {
    const out = [], seen = {};
    (Array.isArray(list) ? list : []).slice(0, 20).forEach(b => {
      if (!b || typeof b !== 'object') return;
      const upTo = Number(b.upTo), costC = cents(b.cost);
      const name = String(b.name == null ? '' : b.name).trim().slice(0, 40);
      if (!name || !Number.isInteger(upTo) || upTo < 1 || upTo > MAX_BOX_UNITS || costC == null || costC < 0 || seen[upTo]) return;
      seen[upTo] = true; out.push({ name: name, upTo: upTo, costC: costC });
    });
    return out.sort((a, b) => a.upTo - b.upTo).slice(0, MAX_BOXES);
  }
  function boxesFor(units, boxes) {
    const n = Math.ceil(Number(units));
    if (!Array.isArray(boxes) || !boxes.length || !(n >= 1) || n > 1000000) return null;
    const big = boxes[boxes.length - 1];
    const full = Math.floor((n - 1) / big.upTo), rest = n - full * big.upTo;      // rest is 1..big.upTo
    const last = boxes.find(b => b.upTo >= rest);
    const label = full === 0 ? last.name : last === big ? (full + 1) + ' × ' + big.name : full + ' × ' + big.name + ' + ' + last.name;
    return { cents: full * big.costC + last.costC, count: full + 1, label: label };
  }

  function feeFor(channel, revenueC, fees) {
    const f = (fees && fees[channel]) || null;
    if (!f) return null;
    const pct = num(f.percent), per = num(f.perOrder);
    if (pct == null || per == null) return null;          // a blank part is unknown, never 0
    return Math.round((revenueC || 0) * pct / 100) + Math.round(per * 100);
  }

  // orders: { id, order_number, channel|source, status, subtotal, shipping_total, tax_total, total, placed_at }
  // items: { order_id, sku, product_name, quantity, unit_price, line_total, product_id? }
  function compute(input) {
    const i = input || {};
    const costs = unitCosts(i.products, i.poLines);
    const fees = Object.assign({}, DEFAULT_FEES, i.fees || {});
    const postC = cents(i.postagePerOrder), packC = cents(i.packagingPerOrder);
    const boxes = cleanBoxes(i.boxes);                      // box sizes, when the owner filled them in
    // the real fee and postage of an order, where they were saved (docs/ops/sql/drafts/52):
    // an exact figure replaces the estimate for that part of that order
    const exact = {};
    (Array.isArray(i.orderCosts) ? i.orderCosts : []).forEach(c => {
      if (!c || typeof c !== 'object' || !c.order_id) return;
      const f = Number.isInteger(c.fee_cents) && c.fee_cents >= 0 ? c.fee_cents : null;
      const p = Number.isInteger(c.postage_cents) && c.postage_cents >= 0 ? c.postage_cents : null;
      if (f != null || p != null) exact[c.order_id] = { fee: f, postage: p };
    });
    const itemsBy = {};
    (Array.isArray(i.items) ? i.items : []).forEach(it => { if (it && it.order_id) (itemsBy[it.order_id] = itemsBy[it.order_id] || []).push(it); });
    const orders = [], leftOut = [];
    (Array.isArray(i.orders) ? i.orders : []).forEach(o => {
      if (!o || !o.id || o.deleted_at) return;
      const status = key(o.status);
      if (LEFT_OUT.includes(status)) { leftOut.push({ id: o.id, order: o.order_number || '', status: status }); return; }
      const channel = channelOf(o);
      const sub = cents(o.subtotal), ship = cents(o.shipping_total), tax = cents(o.tax_total), tot = cents(o.total);
      const revenue = sub != null ? sub + (ship || 0) : tot != null ? tot - (tax || 0) : null;
      const lines = (itemsBy[o.id] || []).map(it => {
        const c = costs['id:' + it.product_id] || costs['sku:' + key(it.sku)] || null;
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 0;
        const lineRev = cents(it.line_total) != null ? cents(it.line_total) : cents(it.unit_price) != null ? cents(it.unit_price) * qty : null;
        return { name: (c && c.name) || String(it.product_name || it.sku || 'Item'), sku: key(it.sku), qty: qty, revenue: lineRev,
          cost: c && c.cost != null ? c.cost * qty : null, costKnown: !!(c && c.cost != null) };
      });
      const missing = [];
      if (revenue == null) missing.push('sale amount');
      if (!lines.length) missing.push('items');
      if (lines.some(l => !l.costKnown)) missing.push('product cost');
      const real = exact[o.id] || {};
      const feeExact = real.fee != null, postageExact = real.postage != null;
      const fee = feeExact ? real.fee : feeFor(channel, revenue, fees);
      const postage = postageExact ? real.postage : postC;
      if (fee == null) missing.push('fee estimate');
      if (postage == null) missing.push('postage estimate');
      // packaging: by box size from the number of bottles; else the one amount per order
      const boxed = boxesFor(lines.reduce((s, l) => s + l.qty, 0), boxes);
      const pack = boxed ? boxed.cents : packC;
      if (pack == null) missing.push('packaging estimate');
      const productCost = lines.length && lines.every(l => l.costKnown) ? lines.reduce((s, l) => s + l.cost, 0) : null;
      const complete = revenue != null && productCost != null && fee != null && postage != null && pack != null;
      orders.push({ id: o.id, order: String(o.order_number || ''), channel: channel, placedAt: o.placed_at || null,
        revenue: revenue, productCost: productCost, fee: fee, postage: postage, packaging: pack, box: boxed ? boxed.label : null,
        feeExact: feeExact, postageExact: postageExact,
        profit: complete ? revenue - productCost - fee - postage - pack : null, missing: missing,
        check: status === 'partially_refunded' ? 'partly refunded: check the refund' : null, lines: lines });
    });
    // by channel and by product (only complete orders count toward profit)
    const byChannel = {}, byProduct = {};
    orders.forEach(o => {
      const ch = byChannel[o.channel] = byChannel[o.channel] || { channel: o.channel, name: CHANNEL_NAMES[o.channel] || o.channel, orders: 0, complete: 0, revenue: 0, profit: 0 };
      ch.orders++;
      if (o.profit == null) return;
      ch.complete++; ch.revenue += o.revenue; ch.profit += o.profit;
      const lineRevTotal = o.lines.reduce((s, l) => s + (l.revenue || 0), 0);
      o.lines.forEach(l => {
        const p = byProduct[l.sku || l.name] = byProduct[l.sku || l.name] || { product: l.name, units: 0, revenue: 0, profit: 0 };
        // the order's fees, postage and packaging are shared by the lines' share of sales
        const share = lineRevTotal > 0 && l.revenue != null ? l.revenue / lineRevTotal : 1 / o.lines.length;
        const lineRev = Math.round(o.revenue * share);
        p.units += l.qty; p.revenue += lineRev;
        p.profit += lineRev - l.cost - Math.round((o.fee + o.postage + o.packaging) * share);
      });
    });
    const complete = orders.filter(o => o.profit != null);
    const sum = (k) => complete.reduce((s, o) => s + o[k], 0);
    const pct = (p, r) => (r > 0 ? Math.round(p * 1000 / r) / 10 : null);
    const totals = { orders: orders.length, complete: complete.length, missing: orders.length - complete.length,
      revenue: sum('revenue'), productCost: sum('productCost'), fees: sum('fee'), postage: sum('postage'), packaging: sum('packaging'), profit: sum('profit') };
    totals.margin = pct(totals.profit, totals.revenue);
    // how many of the counted orders use a real figure instead of an estimate
    totals.exactFees = complete.filter(o => o.feeExact).length;
    totals.exactPostage = complete.filter(o => o.postageExact).length;
    totals.boxed = complete.filter(o => o.box != null).length;                 // packaging worked out from a box size
    const channels = Object.values(byChannel).map(c => Object.assign(c, { margin: pct(c.profit, c.revenue) })).sort((a, b) => b.revenue - a.revenue);
    const products = Object.values(byProduct).map(p => Object.assign(p, { margin: pct(p.profit, p.revenue) })).sort((a, b) => b.profit - a.profit);
    const missingWhy = {};
    orders.forEach(o => o.missing.forEach(m => { missingWhy[m] = (missingWhy[m] || 0) + 1; }));
    return { totals: totals, channels: channels, products: products, orders: orders, leftOut: leftOut, missingWhy: missingWhy };
  }

  // the owner's fee and cost estimates, checked (percent 0-50, per order 0-50 dollars)
  function checkEstimates(form) {
    const f = form || {}, out = { fees: {}, problems: [] };
    Object.keys(DEFAULT_FEES).forEach(ch => {
      const pct = String((f[ch + '_percent'] == null ? '' : f[ch + '_percent'])).trim(), per = String((f[ch + '_per'] == null ? '' : f[ch + '_per'])).trim();
      const p = pct === '' ? null : Number(pct), q = per === '' ? null : Number(per);
      if (p != null && !(isFinite(p) && p >= 0 && p <= 50)) out.problems.push((CHANNEL_NAMES[ch] || ch) + ': the percent must be between 0 and 50.');
      if (q != null && !(isFinite(q) && q >= 0 && q <= 50)) out.problems.push((CHANNEL_NAMES[ch] || ch) + ': the amount per order must be between $0 and $50.');
      out.fees[ch] = { percent: p != null && isFinite(p) ? p : null, perOrder: q != null && isFinite(q) ? q : null };
    });
    ['postage', 'packaging'].forEach(k => {
      const v = String(f[k] == null ? '' : f[k]).trim();
      const n = v === '' ? null : Number(v);
      if (n != null && !(isFinite(n) && n >= 0 && n <= 100)) out.problems.push('The ' + k + ' estimate must be between $0 and $100 per order.');
      out[k] = n != null && isFinite(n) ? n : null;
    });
    // box sizes: a row is either empty or complete
    out.boxes = [];
    const sizes = {};
    for (let n = 1; n <= MAX_BOXES; n += 1) {
      const get = (k) => String(f['box' + n + '_' + k] == null ? '' : f['box' + n + '_' + k]).trim();
      const name = get('name').slice(0, 200), upto = get('upto'), cost = get('cost');
      if (!name && !upto && !cost) continue;
      const u = Number(upto), c = Number(cost);
      if (!name || !upto || !cost) { out.problems.push('Box ' + n + ': fill in the name, how many bottles fit and what one costs, or clear the whole row.'); continue; }
      if (name.length > 40) { out.problems.push('Box ' + n + ': the name is too long (40 characters at most).'); continue; }
      if (!(Number.isInteger(u) && u >= 1 && u <= MAX_BOX_UNITS)) { out.problems.push('Box ' + n + ': how many bottles fit must be a whole number from 1 to ' + MAX_BOX_UNITS + '.'); continue; }
      if (!(isFinite(c) && c >= 0 && c <= 100)) { out.problems.push('Box ' + n + ': the cost must be between $0 and $100.'); continue; }
      if (sizes[u]) { out.problems.push('Box ' + n + ': another box already holds up to ' + u + '. Give each box a different size.'); continue; }
      sizes[u] = true; out.boxes.push({ name: name, upTo: u, cost: c });
    }
    out.boxes.sort((a, b) => a.upTo - b.upTo);
    out.ok = out.problems.length === 0;
    return out;
  }

  return { DEFAULT_FEES, CHANNEL_NAMES, MAX_BOXES, MAX_BOX_UNITS, channelOf, unitCosts, feeFor, cleanBoxes, boxesFor, compute, checkEstimates };
}));
