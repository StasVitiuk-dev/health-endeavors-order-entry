// Scan Shipment — DETERMINISTIC engine core (Phase 1, local/synthetic).
//
// Pure: no DOM, no camera, no network. Dual-mode (Node require + browser
// registry), same pattern as the sales engine. This file holds only the
// reproducible logic the scanner depends on:
//   - tracking-number normalization + carrier detection + carrier-rule
//     validation (check digits where the rule is public, format-only otherwise),
//   - trusted carrier tracking links,
//   - role-scoped order ranking from extracted fields (exact order reference is
//     strongest; ZIP / recipient name are weak SUPPORTING clues only — a ZIP or
//     a name on its own is never a match),
//   - stable dedup keys per shipment and per notification,
//   - the simulated tracking-check and shipping-notification state machines
//     (queued / sent / failed / held; accepted / in_transit / delivered /
//     exception) — a scan never proves carrier acceptance.
//
// Nothing here attaches a real tracking number, contacts a carrier, or sends a
// notification. The dashboard layer that uses this must keep all of that mocked
// until the owner approves real integration (see NOV7_BUILD_HANDOFF_2026-11-07).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-scan'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- carriers -----------------------------------------------------------
  const CARRIERS = ['ups', 'usps', 'fedex'];
  const CARRIER_LABELS = { ups: 'UPS', usps: 'USPS', fedex: 'FedEx', unknown: 'Unknown carrier' };

  // Trusted tracking URLs only. The tracking number is encodeURIComponent-ed by
  // the caller's renderer; these are the ONLY hosts the scanner ever links to.
  const CARRIER_HOSTS = {
    ups: 'https://www.ups.com/track?tracknum=',
    usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
    fedex: 'https://www.fedex.com/fedextrack/?trknbr=',
  };

  function normalizeTracking(raw) {
    return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // UPS 1Z check digit: digits count as themselves, letters as (value-based)
  // per the published UPS algorithm (A=2,B=3,...). Odd positions ×1, even ×2,
  // check digit = (ceil(sum/10)*10 - sum) % 10.
  function validUps(t) {
    if (!/^1Z[0-9A-Z]{16}$/.test(t)) return false;
    const body = t.slice(2, 17); // 15 chars between 1Z and the check digit
    const check = t.charCodeAt(17) - 48; // last char as digit (only valid if 0-9)
    if (check < 0 || check > 9) return false;
    let sum = 0;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      const v = /[0-9]/.test(c) ? Number(c) : ((c.charCodeAt(0) - 65) % 10 + 2) % 10;
      sum += (i % 2 === 0) ? v : v * 2;
    }
    const cd = (Math.ceil(sum / 10) * 10 - sum) % 10;
    return cd === check;
  }

  // USPS S10 / UPU: 2 letters, 9 digits (8 + 1 check), 2 letters. Check digit
  // weights 8,6,4,2,3,5,9,7; cd = 11 - (sum % 11); 10 -> 5, 11 -> 0.
  function validUspsS10(t) {
    if (!/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(t)) return false;
    const d = t.slice(2, 10).split('').map(Number);
    const w = [8, 6, 4, 2, 3, 5, 9, 7];
    let sum = 0; for (let i = 0; i < 8; i++) sum += d[i] * w[i];
    let cd = 11 - (sum % 11); if (cd === 10) cd = 5; else if (cd === 11) cd = 0;
    return cd === Number(t[10]);
  }

  // USPS IMpb / USS: 20, 22, 26 or 30 digits, mod-10 (3×/1× from the right,
  // excluding the check digit). Used by most domestic USPS labels.
  function validUspsNumeric(t) {
    if (!/^[0-9]{20,34}$/.test(t)) return false;
    const digits = t.split('').map(Number);
    const check = digits.pop();
    let sum = 0;
    // weight 3 on the rightmost of the remaining, alternating 3,1,3,1...
    for (let i = digits.length - 1, k = 0; i >= 0; i--, k++) sum += digits[i] * (k % 2 === 0 ? 3 : 1);
    return ((10 - (sum % 10)) % 10) === check;
  }

  // FedEx express/ground are 12 or 15 digits (ground also 20/22). The public
  // check-digit rule is not uniform across their formats, so we validate FORMAT
  // only and label the confidence accordingly.
  function fedexFormat(t) { return /^[0-9]{12}$|^[0-9]{15}$|^[0-9]{20}$|^[0-9]{22}$/.test(t); }

  // Detect the carrier from a normalized tracking number. Returns null when no
  // known pattern matches (the operator can still pick a carrier by hand).
  function detectCarrier(tracking) {
    const t = normalizeTracking(tracking);
    if (/^1Z[0-9A-Z]{16}$/.test(t)) return 'ups';
    if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(t)) return 'usps';
    if (/^(94|93|92|95|82)[0-9]{18,32}$/.test(t)) return 'usps';
    if (fedexFormat(t)) return 'fedex';
    return null;
  }

  // Validate a normalized tracking number against a carrier's rule.
  // Returns { valid, confidence: 'checkdigit'|'format'|'none', reason }.
  function validateTracking(tracking, carrier) {
    const t = normalizeTracking(tracking);
    if (!t) return { valid: false, confidence: 'none', reason: 'empty' };
    const c = carrier || detectCarrier(t);
    if (c === 'ups') return validUps(t) ? { valid: true, confidence: 'checkdigit', reason: 'UPS check digit OK' } : { valid: false, confidence: 'checkdigit', reason: 'UPS check digit failed' };
    if (c === 'usps') {
      if (validUspsS10(t)) return { valid: true, confidence: 'checkdigit', reason: 'USPS S10 check digit OK' };
      if (validUspsNumeric(t)) return { valid: true, confidence: 'checkdigit', reason: 'USPS mod-10 check digit OK' };
      return { valid: false, confidence: 'checkdigit', reason: 'USPS check digit failed' };
    }
    if (c === 'fedex') return fedexFormat(t) ? { valid: true, confidence: 'format', reason: 'FedEx length OK (format only)' } : { valid: false, confidence: 'format', reason: 'FedEx length not recognized' };
    return { valid: false, confidence: 'none', reason: 'no known carrier pattern' };
  }

  function carrierLink(carrier, tracking) {
    const host = CARRIER_HOSTS[carrier];
    const t = normalizeTracking(tracking);
    if (!host || !t) return null;
    return host + encodeURIComponent(t);
  }

  // ---- order ranking ------------------------------------------------------
  // Score each order the signed-in role can access against the extracted
  // fields. Signals and weights:
  //   exact order reference .......... 100 (decisive)
  //   destination ZIP match ...........  25 (supporting)
  //   recipient / store name match ....  15 (weak)
  //   fulfillment state 'ready/unfulfilled/processing' ... 10 (supporting)
  // A candidate is a MATCH only if it has the exact order reference, OR at least
  // two independent supporting signals. A ZIP alone or a name alone never makes
  // a match — it is returned as `weak:true` so the UI can show it but must not
  // auto-pick it. `accessible(order)` enforces the role boundary (pure callback).
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function digits(s) { return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }

  const OPEN_FULFILLMENT = new Set(['ready', 'unfulfilled', 'processing', 'open', 'awaiting_fulfillment', 'partially_fulfilled']);

  function rankOrders(extracted, orders, accessible) {
    const ex = extracted || {};
    const canSee = typeof accessible === 'function' ? accessible : function () { return true; };
    const exRef = norm(ex.orderRef);
    const exZip = digits(ex.destZip).slice(0, 5);
    const exName = norm(ex.name);
    const out = [];
    (orders || []).forEach(function (o) {
      if (!canSee(o)) return; // role boundary
      const reasons = [];
      let score = 0, strong = false, supporting = 0;
      if (exRef && (norm(o.order_number) === exRef || norm(o.id) === exRef)) { score += 100; strong = true; reasons.push('Exact order reference'); }
      if (exZip && digits(o.dest_zip).slice(0, 5) === exZip && exZip.length === 5) { score += 25; supporting++; reasons.push('Destination ZIP matches'); }
      if (exName && norm(o.recipient_name) && norm(o.recipient_name).indexOf(exName) !== -1) { score += 15; reasons.push('Recipient / store name matches'); }
      if (ex.fulfillmentHint && OPEN_FULFILLMENT.has(norm(o.fulfillment_status))) { score += 10; supporting++; reasons.push('Order is awaiting fulfillment'); }
      if (score === 0) return;
      // name is weak evidence on its own: it adds to a match but never creates one
      const isMatch = strong || supporting >= 2 || (supporting >= 1 && reasons.some(function (r) { return /name/.test(r); }));
      out.push({ order: o, score: score, reasons: reasons, strong: strong, match: isMatch, weak: !isMatch });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  // Classify the ranking into an outcome the UI can act on, without ever
  // auto-confirming: the handoff requires confirmation on EVERY package.
  function rankingOutcome(ranked) {
    const matches = (ranked || []).filter(function (r) { return r.match; });
    if (!ranked || !ranked.length) return { kind: 'no_match', matches: [], candidates: [] };
    if (matches.length === 1) return { kind: 'single_match', matches: matches, candidates: ranked };
    if (matches.length > 1) return { kind: 'multiple_matches', matches: matches, candidates: ranked };
    return { kind: 'weak_only', matches: [], candidates: ranked }; // clues but nothing decisive
  }

  // ---- dedup keys ---------------------------------------------------------
  // One stable key per (shipment, tracking) so a double scan of the same label
  // attaches once; one per (shipment, channel, kind) so a notification is not
  // queued twice.
  function shipmentTrackingKey(shipmentId, tracking) {
    return 'ship:' + norm(shipmentId) + '|trk:' + normalizeTracking(tracking);
  }
  function notificationKey(shipmentId, channel, kind) {
    return 'notif:' + norm(shipmentId) + '|ch:' + norm(channel) + '|' + norm(kind || 'shipped');
  }

  // ---- simulated state machines (no real sends) ---------------------------
  // Notification delivery: queued -> sent | failed | held; failed -> queued
  // (safe retry); held -> queued (owner releases). 'sent' and 'failed' are
  // terminal except failed's explicit retry.
  const NOTIF_STATES = ['queued', 'sent', 'failed', 'held'];
  const NOTIF_TRANSITIONS = { queued: ['sent', 'failed', 'held'], failed: ['queued'], held: ['queued'], sent: [] };
  function canNotifTransition(from, to) { return !!(NOTIF_TRANSITIONS[from] && NOTIF_TRANSITIONS[from].indexOf(to) !== -1); }

  // Tracking lifecycle (what a simulated carrier check can report). A scan does
  // NOT set any of these — acceptance must be observed, never assumed.
  const TRACK_STATES = ['label_created', 'accepted', 'in_transit', 'delivered', 'exception'];
  const TRACK_TRANSITIONS = {
    label_created: ['accepted', 'exception'],
    accepted: ['in_transit', 'exception'],
    in_transit: ['delivered', 'exception'],
    exception: ['in_transit', 'delivered'],
    delivered: [],
  };
  function canTrackTransition(from, to) { return !!(TRACK_TRANSITIONS[from] && TRACK_TRANSITIONS[from].indexOf(to) !== -1); }

  // Build the record for attaching a tracking number to a shipment. Pure: it
  // returns the intended write + the queued side effects; it performs none of
  // them. `existingKeys` lets the caller enforce "attach once / queue once".
  function planAttach(opts) {
    const o = opts || {};
    const tracking = normalizeTracking(o.tracking);
    const carrier = o.carrier || detectCarrier(tracking);
    const v = validateTracking(tracking, carrier);
    const trkKey = shipmentTrackingKey(o.shipmentId, tracking);
    const notifKey = notificationKey(o.shipmentId, o.channel || 'unknown', 'shipped');
    const seen = o.existingKeys instanceof Set ? o.existingKeys : new Set(o.existingKeys || []);
    const duplicateAttach = seen.has(trkKey);
    const duplicateNotif = seen.has(notifKey);
    return {
      ok: v.valid && !duplicateAttach,
      duplicateAttach: duplicateAttach,
      validation: v,
      attach: duplicateAttach ? null : {
        shipment_id: o.shipmentId, order_id: o.orderId, carrier: carrier, tracking_number: tracking,
        confirmed_by: o.actor || null, confirmed_at: o.now || null, tracking_state: 'label_created',
        synthetic: true, dedup_key: trkKey,
      },
      // the tracking check and the ONE shipping notification are queued, not run
      queued: duplicateAttach ? [] : [
        { kind: 'tracking_check', dedup_key: trkKey, state: 'queued', synthetic: true },
      ].concat(duplicateNotif ? [] : [
        { kind: 'notification', channel: o.channel || 'unknown', dedup_key: notifKey, state: 'queued', synthetic: true },
      ]),
      note: 'SIMULATED — a scan does not prove carrier acceptance and sends nothing.',
    };
  }

  return {
    CARRIERS: CARRIERS, CARRIER_LABELS: CARRIER_LABELS,
    normalizeTracking: normalizeTracking, detectCarrier: detectCarrier, validateTracking: validateTracking,
    carrierLink: carrierLink,
    rankOrders: rankOrders, rankingOutcome: rankingOutcome,
    shipmentTrackingKey: shipmentTrackingKey, notificationKey: notificationKey,
    NOTIF_STATES: NOTIF_STATES, canNotifTransition: canNotifTransition,
    TRACK_STATES: TRACK_STATES, canTrackTransition: canTrackTransition,
    planAttach: planAttach,
  };
}));
