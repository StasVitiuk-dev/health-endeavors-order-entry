// Inventory — PARTIAL RECEIVING AND RETURNS, a synthetic prototype for the owner's
// review of the stock rules (decision D-ops-5, backlog INV-17). Owner request of
// Nov 21: "an order for 20 units where 8 arrive first, 12 arrive later, and 3 are
// returned; show the remaining quantity and stock movement at each step; for
// customer returns, distinguish sellable units from damaged ones; test duplicate
// submissions, over-receiving, over-returning, and audit history."
//
// PROTOTYPE ONLY. It works on an in-memory ledger of made-up stock and never
// writes real stock: live stock changes stay with the database functions of
// drafts/10 (receive_purchase_order, receive_return), behind their switches, and
// these rules go live only after the owner has reviewed them (D-ops-5).
//
// The rules it enforces (each one is listed for review in
// docs/ops/PARTIAL_RECEIVING_RULES_2026-11-21.md):
//   R1 whole units only; at least one unit per submission
//   R2 a receipt never exceeds what is still to come on that order line
//   R3 a receipt is all or nothing across its lines
//   R4 received units go to Available, or to Damaged when marked damaged on arrival
//   R5 a return to the supplier never exceeds what was received and kept on that
//      line, nor what the chosen stock bucket holds; it does not reopen the line
//   R6 a customer return never exceeds what was sold and not yet returned on that
//      sale line; sellable units go to Available, damaged ones to Damaged
//   R7 a submission carries a request key: sent again, it changes nothing; the
//      same key with different contents is refused
//   R8 only the owner or an administrator changes stock (as today, Query A)
//   R9 every change writes one movement per stock bucket (before, change, after,
//      why, who, when, what it came from) and one history entry; refusals are
//      recorded too, and change nothing; nothing is ever edited or deleted
//
// Pure. Dual-mode (Node require + browser HE.inventory registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-receiving'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BUCKETS = ['available', 'damaged'];
  const STOCK_ROLES = ['owner', 'administrator'];
  const LIVE_PATH = 'receive_purchase_order and receive_return (drafts/10), behind their stock_fn_* switches; partial quantities need a reviewed change after D-ops-5';
  const MAX_UNITS = 1000000;

  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const text = (v) => (v == null ? '' : String(v)).trim();
  const units = (v) => (v === undefined || v === null || v === '') ? 0 : (Number.isInteger(v) && v >= 0 && v <= MAX_UNITS ? v : NaN);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));

  function createLedger(seed) {
    const s = isObj(seed) ? seed : {};
    const ledger = { products: {}, purchaseOrders: {}, sales: {}, movements: [], history: [], refusals: [], keys: {}, synthetic: true, label: 'SIMULATED', livePath: LIVE_PATH };
    (Array.isArray(s.products) ? s.products : []).forEach(p => {
      if (!isObj(p) || !text(p.sku)) return;
      ledger.products[text(p.sku)] = { sku: text(p.sku), name: text(p.name) || text(p.sku), available: units(p.available) || 0, damaged: units(p.damaged) || 0 };
    });
    (Array.isArray(s.purchaseOrders) ? s.purchaseOrders : []).forEach(po => {
      if (!isObj(po) || !text(po.id)) return;
      ledger.purchaseOrders[text(po.id)] = { id: text(po.id), number: text(po.number) || text(po.id), supplier: text(po.supplier),
        lines: (Array.isArray(po.lines) ? po.lines : []).filter(l => isObj(l) && ledger.products[text(l.sku)] && units(l.ordered) > 0)
          .map(l => ({ sku: text(l.sku), ordered: l.ordered, received: 0, damagedOnArrival: 0, returnedToSupplier: 0 })) };
    });
    (Array.isArray(s.sales) ? s.sales : []).forEach(so => {
      if (!isObj(so) || !text(so.id)) return;
      ledger.sales[text(so.id)] = { id: text(so.id), number: text(so.number) || text(so.id), customer: text(so.customer),
        lines: (Array.isArray(so.lines) ? so.lines : []).filter(l => isObj(l) && ledger.products[text(l.sku)] && units(l.sold) > 0)
          .map(l => ({ sku: text(l.sku), sold: l.sold, returnedSellable: 0, returnedDamaged: 0 })) };
    });
    return ledger;
  }

  // ---- shared plumbing ----------------------------------------------------
  function refuse(ledger, kind, req, reason) {
    if (ledger && Array.isArray(ledger.refusals)) ledger.refusals.push({ kind: kind, requestKey: text(req && req.requestKey) || null, by: text(req && req.by) || null, at: (req && req.at) || null, reason: reason });
    return { ok: false, reason: reason, movements: [] };
  }
  function guard(ledger, kind, req, fingerprint) {
    if (!ledger || !isObj(ledger.products)) return { stop: { ok: false, reason: 'not a ledger', movements: [] } };
    if (!isObj(req)) return { stop: refuse(ledger, kind, {}, 'nothing was submitted') };
    const key = text(req.requestKey);
    if (!key) return { stop: refuse(ledger, kind, req, 'the page gave this submission no request key, so a retry could not be recognised') };
    if (STOCK_ROLES.indexOf(text(req.role)) < 0) return { stop: refuse(ledger, kind, req, 'only the owner or an administrator can change stock') };
    const seen = ledger.keys[key];
    if (seen) {
      if (seen.fingerprint === fingerprint) return { stop: { ok: true, duplicate: true, reason: 'already recorded; nothing changed', movements: [] } };
      return { stop: refuse(ledger, kind, req, 'that request key was already used for a different submission') };
    }
    return { key: key };
  }
  function move(ledger, sku, bucket, change, why, req, source) {
    const p = ledger.products[sku];
    const before = p[bucket];
    p[bucket] = before + change;
    const m = { n: ledger.movements.length + 1, sku: sku, bucket: bucket, before: before, change: change, after: p[bucket], why: why, by: text(req.by) || null, at: req.at || null, source: source };
    ledger.movements.push(m);
    return m;
  }
  function record(ledger, key, fingerprint, entry) {
    ledger.keys[key] = { fingerprint: fingerprint };
    entry.n = ledger.history.length + 1;
    ledger.history.push(entry);
  }

  // ---- receiving ------------------------------------------------------------
  // req: { requestKey, poId, lines: [{ sku, good, damaged }], by, role, at, note }
  function receive(ledger, req) {
    const r = isObj(req) ? req : {};
    const lines = Array.isArray(r.lines) ? r.lines.filter(isObj).map(l => ({ sku: text(l.sku), good: units(l.good), damaged: units(l.damaged) })) : [];
    const fp = JSON.stringify(['receive', text(r.poId), lines.slice().sort((a, b) => a.sku < b.sku ? -1 : 1)]);
    const g = guard(ledger, 'receive', r, fp); if (g.stop) return g.stop;
    const po = ledger.purchaseOrders[text(r.poId)];
    if (!po) return refuse(ledger, 'receive', r, 'that purchase order is not in this ledger');
    if (!lines.length) return refuse(ledger, 'receive', r, 'no lines were submitted');
    const seenSku = {};
    for (const l of lines) {
      if (Number.isNaN(l.good) || Number.isNaN(l.damaged)) return refuse(ledger, 'receive', r, 'quantities must be whole units (no fractions, no negatives)');
      if (seenSku[l.sku]) return refuse(ledger, 'receive', r, l.sku + ' is listed twice; put it on one line');
      seenSku[l.sku] = true;
      const line = po.lines.find(x => x.sku === l.sku);
      if (!line) return refuse(ledger, 'receive', r, l.sku + ' is not on ' + po.number);
      const qty = l.good + l.damaged;
      if (qty < 1) return refuse(ledger, 'receive', r, 'receive at least one unit of ' + l.sku);
      const toCome = line.ordered - line.received;
      if (qty > toCome) return refuse(ledger, 'receive', r, 'would receive ' + plural(qty, 'unit') + ' of ' + l.sku + ', but only ' + toCome + ' of the ' + line.ordered + ' ordered are still to come; nothing was received');
    }
    // all checks passed: apply every line (R3 all or nothing)
    const moved = [];
    for (const l of lines) {
      const line = po.lines.find(x => x.sku === l.sku);
      if (l.good) moved.push(move(ledger, l.sku, 'available', l.good, 'received on ' + po.number, r, { poId: po.id }));
      if (l.damaged) moved.push(move(ledger, l.sku, 'damaged', l.damaged, 'received damaged on ' + po.number, r, { poId: po.id }));
      line.received += l.good + l.damaged; line.damagedOnArrival += l.damaged;
    }
    record(ledger, g.key, fp, { kind: 'receive', poId: po.id, by: text(r.by) || null, at: r.at || null, note: text(r.note) || null,
      what: lines.map(l => l.sku + ': ' + (l.good + l.damaged) + (l.damaged ? ' (' + l.damaged + ' damaged)' : '')).join(', ') + ' received on ' + po.number });
    return { ok: true, duplicate: false, movements: moved, status: poStatus(ledger, po.id) };
  }

  // req: { requestKey, poId, sku, quantity, from: 'available'|'damaged', reason, by, role, at }
  function returnToSupplier(ledger, req) {
    const r = isObj(req) ? req : {};
    const qty = units(r.quantity), from = text(r.from) || 'available';
    const fp = JSON.stringify(['returnToSupplier', text(r.poId), text(r.sku), qty, from]);
    const g = guard(ledger, 'returnToSupplier', r, fp); if (g.stop) return g.stop;
    const po = ledger.purchaseOrders[text(r.poId)];
    if (!po) return refuse(ledger, 'returnToSupplier', r, 'that purchase order is not in this ledger');
    const line = po.lines.find(x => x.sku === text(r.sku));
    if (!line) return refuse(ledger, 'returnToSupplier', r, text(r.sku) + ' is not on ' + po.number);
    if (Number.isNaN(qty) || qty < 1) return refuse(ledger, 'returnToSupplier', r, 'return at least one whole unit');
    if (BUCKETS.indexOf(from) < 0) return refuse(ledger, 'returnToSupplier', r, 'say whether the units come from Available or Damaged stock');
    if (text(r.reason).length < 5) return refuse(ledger, 'returnToSupplier', r, 'say why the units go back to the supplier');
    const kept = line.received - line.returnedToSupplier;
    if (qty > kept) return refuse(ledger, 'returnToSupplier', r, 'would send back ' + plural(qty, 'unit') + ' of ' + line.sku + ', but only ' + kept + ' received on ' + po.number + ' can still go back; nothing was returned');
    const have = ledger.products[line.sku][from];
    if (qty > have) return refuse(ledger, 'returnToSupplier', r, 'only ' + have + ' of ' + line.sku + ' are in ' + (from === 'available' ? 'Available' : 'Damaged') + ' stock; nothing was returned');
    const m = move(ledger, line.sku, from, -qty, 'returned to the supplier of ' + po.number + ': ' + text(r.reason), r, { poId: po.id });
    line.returnedToSupplier += qty;
    record(ledger, g.key, fp, { kind: 'returnToSupplier', poId: po.id, by: text(r.by) || null, at: r.at || null, note: text(r.reason),
      what: plural(qty, 'unit') + ' of ' + line.sku + ' returned to the supplier of ' + po.number + ' (from ' + from + ')' });
    return { ok: true, duplicate: false, movements: [m], status: poStatus(ledger, po.id) };
  }

  // req: { requestKey, saleId, sku, sellable, damaged, reason, by, role, at }
  function customerReturn(ledger, req) {
    const r = isObj(req) ? req : {};
    const sellable = units(r.sellable), damaged = units(r.damaged);
    const fp = JSON.stringify(['customerReturn', text(r.saleId), text(r.sku), sellable, damaged]);
    const g = guard(ledger, 'customerReturn', r, fp); if (g.stop) return g.stop;
    const so = ledger.sales[text(r.saleId)];
    if (!so) return refuse(ledger, 'customerReturn', r, 'that customer order is not in this ledger');
    const line = so.lines.find(x => x.sku === text(r.sku));
    if (!line) return refuse(ledger, 'customerReturn', r, text(r.sku) + ' is not on ' + so.number);
    if (Number.isNaN(sellable) || Number.isNaN(damaged)) return refuse(ledger, 'customerReturn', r, 'quantities must be whole units (no fractions, no negatives)');
    const qty = sellable + damaged;
    if (qty < 1) return refuse(ledger, 'customerReturn', r, 'a return needs at least one unit, sellable or damaged');
    if (text(r.reason).length < 3) return refuse(ledger, 'customerReturn', r, 'say why the customer returned it');
    const open = line.sold - line.returnedSellable - line.returnedDamaged;
    if (qty > open) return refuse(ledger, 'customerReturn', r, 'would take back ' + plural(qty, 'unit') + ' of ' + line.sku + ', but only ' + open + ' of the ' + line.sold + ' sold on ' + so.number + ' have not been returned yet; nothing was taken back');
    const moved = [];
    if (sellable) moved.push(move(ledger, line.sku, 'available', sellable, 'customer return on ' + so.number + ', sellable', r, { saleId: so.id }));
    if (damaged) moved.push(move(ledger, line.sku, 'damaged', damaged, 'customer return on ' + so.number + ', damaged', r, { saleId: so.id }));
    line.returnedSellable += sellable; line.returnedDamaged += damaged;
    record(ledger, g.key, fp, { kind: 'customerReturn', saleId: so.id, by: text(r.by) || null, at: r.at || null, note: text(r.reason),
      what: plural(qty, 'unit') + ' of ' + line.sku + ' returned on ' + so.number + ': ' + sellable + ' sellable, ' + damaged + ' damaged' });
    return { ok: true, duplicate: false, movements: moved, status: saleStatus(ledger, so.id) };
  }

  // ---- read-outs ------------------------------------------------------------
  function poStatus(ledger, poId) {
    const po = ledger && ledger.purchaseOrders && ledger.purchaseOrders[text(poId)];
    if (!po) return null;
    const lines = po.lines.map(l => ({ sku: l.sku, ordered: l.ordered, received: l.received, damagedOnArrival: l.damagedOnArrival, toCome: l.ordered - l.received, returnedToSupplier: l.returnedToSupplier, kept: l.received - l.returnedToSupplier }));
    const got = lines.reduce((t, l) => t + l.received, 0), want = lines.reduce((t, l) => t + l.ordered, 0);
    return { id: po.id, number: po.number, status: got === 0 ? 'OPEN' : got < want ? 'PARTLY_RECEIVED' : 'RECEIVED', lines: lines };
  }
  function saleStatus(ledger, saleId) {
    const so = ledger && ledger.sales && ledger.sales[text(saleId)];
    if (!so) return null;
    return { id: so.id, number: so.number, lines: so.lines.map(l => ({ sku: l.sku, sold: l.sold, returnedSellable: l.returnedSellable, returnedDamaged: l.returnedDamaged, stillReturnable: l.sold - l.returnedSellable - l.returnedDamaged })) };
  }
  function stock(ledger, sku) {
    const p = ledger && ledger.products && ledger.products[text(sku)];
    return p ? { sku: p.sku, available: p.available, damaged: p.damaged } : null;
  }
  // Re-adds every movement from the starting figures: the ledger must agree with itself.
  function reconcile(ledger, start) {
    const out = [];
    Object.keys(ledger.products).forEach(sku => {
      const s0 = (start && start[sku]) || { available: 0, damaged: 0 };
      BUCKETS.forEach(b => {
        const sum = ledger.movements.filter(m => m.sku === sku && m.bucket === b).reduce((t, m) => t + m.change, s0[b] || 0);
        if (sum !== ledger.products[sku][b]) out.push(sku + ' ' + b + ': movements add up to ' + sum + ', stock says ' + ledger.products[sku][b]);
      });
    });
    return { ok: out.length === 0, problems: out };
  }

  // ---- the worked example the owner asked for --------------------------------
  const SKU = 'SYN-HONEY-8OZ';
  function fixtures() {
    return {
      products: [{ sku: SKU, name: 'Honey Milk lotion 8 oz (made-up)', available: 5, damaged: 0 }],
      purchaseOrders: [{ id: 'po-syn-20', number: 'SYN-PO-020', supplier: 'SYN Lotion Lab', lines: [{ sku: SKU, ordered: 20 }] }],
      sales: [{ id: 'so-syn-5', number: 'SYN-1005', customer: 'A made-up customer', lines: [{ sku: SKU, sold: 5 }] }],
    };
  }
  function workedExample() {
    const L = createLedger(fixtures());
    const start = { [SKU]: { available: 5, damaged: 0 } };
    const owner = { by: 'owner', role: 'owner' };
    const steps = [];
    const snap = (title, res, kind) => {
      const po = poStatus(L, 'po-syn-20').lines[0], so = saleStatus(L, 'so-syn-5').lines[0], st = stock(L, SKU);
      steps.push({ n: steps.length, title: title, kind: kind, ok: res ? res.ok : true, duplicate: !!(res && res.duplicate), reason: res && !res.ok ? res.reason : (res && res.duplicate ? res.reason : null),
        movements: res ? res.movements.map(m => ({ bucket: m.bucket, change: m.change, before: m.before, after: m.after })) : [],
        poStatus: poStatus(L, 'po-syn-20').status, ordered: po.ordered, received: po.received, toCome: po.toCome, returnedToSupplier: po.returnedToSupplier, kept: po.kept,
        sold: so.sold, customerReturned: so.returnedSellable + so.returnedDamaged, stillReturnable: so.stillReturnable, available: st.available, damaged: st.damaged });
    };
    snap('Start: purchase order SYN-PO-020 for 20 units; 5 already in stock; a customer bought 5 earlier', null, 'start');
    const r1 = { requestKey: 'k-receipt-1', poId: 'po-syn-20', lines: [{ sku: SKU, good: 8 }], at: '2026-11-21T10:00:00Z', ...owner };
    snap('First delivery: 8 units arrive', receive(L, r1), 'receive');
    snap('The same delivery is sent again (double click, or a retry after a lost reply)', receive(L, Object.assign({}, r1, { at: '2026-11-21T10:00:05Z' })), 'duplicate');
    snap('Someone tries to receive 13 (one more than is still to come)', receive(L, { requestKey: 'k-receipt-2-wrong', poId: 'po-syn-20', lines: [{ sku: SKU, good: 13 }], at: '2026-11-24T09:00:00Z', ...owner }), 'refused');
    snap('Second delivery: the other 12 units arrive', receive(L, { requestKey: 'k-receipt-2', poId: 'po-syn-20', lines: [{ sku: SKU, good: 12 }], at: '2026-11-24T09:05:00Z', ...owner }), 'receive');
    snap('3 units go back to the supplier (wrong scent on the labels)', returnToSupplier(L, { requestKey: 'k-rts-1', poId: 'po-syn-20', sku: SKU, quantity: 3, from: 'available', reason: 'Wrong scent printed on the labels', at: '2026-11-24T11:00:00Z', ...owner }), 'returnToSupplier');
    snap('Someone tries to send back 18 more (only 17 received units are left on that order)', returnToSupplier(L, { requestKey: 'k-rts-2', poId: 'po-syn-20', sku: SKU, quantity: 18, from: 'available', reason: 'Testing the limit', at: '2026-11-24T11:05:00Z', ...owner }), 'refused');
    snap('A staff member tries to receive stock (only the owner or an administrator changes stock)', receive(L, { requestKey: 'k-staff', poId: 'po-syn-20', lines: [{ sku: SKU, good: 1 }], by: 'staff', role: 'employee', at: '2026-11-24T12:00:00Z' }), 'refused');
    const cr = { requestKey: 'k-cust-1', saleId: 'so-syn-5', sku: SKU, sellable: 2, damaged: 1, reason: 'Did not like the scent; one jar cracked in transit', at: '2026-11-25T15:00:00Z', ...owner };
    snap('The customer returns 3 of the 5 they bought: 2 sellable, 1 damaged', customerReturn(L, cr), 'customerReturn');
    snap('The same return is submitted again', customerReturn(L, Object.assign({}, cr, { at: '2026-11-25T15:00:09Z' })), 'duplicate');
    snap('Someone tries to take back 3 more (only 2 of that sale are still out)', customerReturn(L, { requestKey: 'k-cust-2', saleId: 'so-syn-5', sku: SKU, sellable: 3, damaged: 0, reason: 'Testing the limit', at: '2026-11-25T15:10:00Z', ...owner }), 'refused');
    return { sku: SKU, steps: steps, history: L.history.slice(), movements: L.movements.slice(), refusals: L.refusals.slice(), reconcile: reconcile(L, start), label: 'SIMULATED', livePath: LIVE_PATH };
  }

  return { VERSION: '2026-11-21', BUCKETS: BUCKETS, STOCK_ROLES: STOCK_ROLES, LIVE_PATH: LIVE_PATH,
    createLedger: createLedger, receive: receive, returnToSupplier: returnToSupplier, customerReturn: customerReturn,
    poStatus: poStatus, saleStatus: saleStatus, stock: stock, reconcile: reconcile, fixtures: fixtures, workedExample: workedExample };
}));
