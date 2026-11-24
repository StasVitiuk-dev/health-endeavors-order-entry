// Delivery watch (owner, Nov 24: "it must work like a Swiss watch, to the smallest
// detail"). Looks at every parcel that is not finished (drafts/48, order_parcels) and
// says which ones need the owner, how urgently, what to do next, and a suggested
// message to the customer (copied by the owner, never sent from here).
//
// Rules (time measured from the parcel's last status change):
//   label made, not handed over ........ 24 h → today; 3 days → urgent
//   dropped off, no carrier update ...... only when carrier tracking is connected:
//                                         3 days → today; 6 days → urgent
//   in transit .......................... 5 days → today; 10 days → urgent
//   out for delivery, not delivered ..... 1 day → urgent
//   delivery problem (exception) ........ at once → urgent
//   returned to sender .................. at once → urgent
//   delivered, cancelled ................ never
// Until carrier tracking is connected, a dropped-off parcel is never called stuck:
// the dashboard simply has not heard from the carrier yet.
//
// Pure. Dual-mode (Node require + browser HE.scan registry). Never writes.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-delivery-watch'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOUR = 3600000, DAY = 24 * HOUR;
  const CARRIER = { ups: 'UPS', usps: 'USPS', fedex: 'FedEx', dhl: 'DHL', other: 'the carrier' };
  const time = (v) => { if (v == null || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(String(v)); return isFinite(t) ? t : null; };
  const text = (v, max) => { const s = (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim(); return s.length > (max || 200) ? s.slice(0, (max || 200) - 1) + '…' : s; };
  const days = (ms) => Math.floor(ms / DAY);
  const ago = (ms) => (ms >= 2 * DAY ? days(ms) + ' days' : ms >= DAY ? '1 day' : Math.max(1, Math.floor(ms / HOUR)) + (Math.floor(ms / HOUR) === 1 ? ' hour' : ' hours'));

  function rule(s, age, opts) {
    switch (s.status) {
      case 'label_created':
        if (age >= 3 * DAY) return { level: 'urgent', title: 'Label made ' + ago(age) + ' ago, parcel not handed over', next: 'Drop it off today, or cancel the label if the order changed.', customer: null };
        if (age >= DAY) return { level: 'today', title: 'Label made ' + ago(age) + ' ago, parcel not handed over', next: 'Drop it off, then give the dashboard the drop-off receipt.', customer: null };
        return null;
      case 'dropped_off':
        if (!opts.trackingConnected) return null;
        if (age >= 6 * DAY) return { level: 'urgent', title: 'No carrier update for ' + ago(age) + ' since drop-off', next: 'Open the tracking page; if it shows nothing, call the carrier with the receipt.', customer: 'late' };
        if (age >= 3 * DAY) return { level: 'today', title: 'No carrier update for ' + ago(age) + ' since drop-off', next: 'Open the tracking page and check the parcel was scanned in.', customer: null };
        return null;
      case 'in_transit':
        if (age >= 10 * DAY) return { level: 'urgent', title: 'In transit for ' + ago(age), next: 'Ask the carrier to trace it; tell the customer; decide whether to send a replacement.', customer: 'late' };
        if (age >= 5 * DAY) return { level: 'today', title: 'In transit for ' + ago(age), next: 'Check the tracking page; consider letting the customer know.', customer: 'late' };
        return null;
      case 'out_for_delivery':
        if (age >= DAY) return { level: 'urgent', title: 'Out for delivery since ' + ago(age) + ' ago, not delivered', next: 'Check the tracking page for a failed attempt or a wrong address.', customer: 'attempt' };
        return null;
      case 'exception':
        return { level: 'urgent', title: 'Delivery problem', next: 'Open the tracking page for the reason (address, damage, held); fix it with the carrier and tell the customer.', customer: 'problem' };
      case 'returned':
        return { level: 'urgent', title: 'Returned to you', next: 'Contact the customer: confirm the address and send it again, or refund. Check the parcel when it arrives.', customer: 'returned' };
      default:
        return null;
    }
  }

  // a suggested message to the customer; the owner copies, edits and sends it
  function customerDraft(kind, s, order) {
    const who = text(order && order.customer_name, 60);
    const hi = who ? 'Hi ' + who.split(' ')[0] + ',' : 'Hi,';
    const ref = order && order.order_number ? ' (order #' + text(order.order_number, 30) + ')' : '';
    const track = ' Tracking: ' + (CARRIER[s.carrier] || 'carrier') + ' ' + s.tracking_number + '.';
    const sign = '\n\nThank you for your patience,\nHealth Endeavors';
    switch (kind) {
      case 'late': return hi + '\n\nYour parcel' + ref + ' is taking longer than usual with ' + (CARRIER[s.carrier] || 'the carrier') + '. We are keeping an eye on it and will make sure it reaches you.' + track + sign;
      case 'attempt': return hi + '\n\nThe carrier tried to deliver your parcel' + ref + ' but it has not been delivered yet. Could you check for a notice, or confirm your address with us?' + track + sign;
      case 'problem': return hi + '\n\nThe carrier reported a problem delivering your parcel' + ref + '. We are sorting it out with them and will update you shortly.' + track + sign;
      case 'returned': return hi + '\n\nYour parcel' + ref + ' was returned to us by the carrier. Could you confirm your shipping address? We will send it again right away, or refund you if you prefer.' + sign;
      default: return null;
    }
  }

  // shipments: rows of drafts/48 (order_parcels); ordersById: { id: { order_number, customer_name } }
  function watch(shipments, opts) {
    const o = opts || {};
    const now = time(o.now) != null ? time(o.now) : Date.now();
    const orders = o.ordersById || {};
    const out = [];
    (Array.isArray(shipments) ? shipments : []).forEach(s => {
      if (!s || typeof s !== 'object' || !s.id || !s.status) return;
      const since = time(s.status_at) != null ? time(s.status_at) : time(s.created_at);
      if (since == null) return;
      const r = rule(s, Math.max(0, now - since), { trackingConnected: o.trackingConnected === true });
      if (!r) return;
      const order = orders[s.order_id] || null;
      out.push({
        id: String(s.id), level: r.level, status: s.status, since: since,
        title: r.title, next: r.next,
        carrier: s.carrier, tracking: text(s.tracking_number, 40),
        orderId: s.order_id || null, order: order && order.order_number ? String(order.order_number) : '',
        customerMessage: r.customer ? customerDraft(r.customer, s, order) : null,
      });
    });
    const rank = { urgent: 0, today: 1 };
    out.sort((a, b) => (rank[a.level] - rank[b.level]) || (a.since - b.since));
    return out;
  }

  return { watch, customerDraft };
}));
