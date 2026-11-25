// Scan Shipment — pure VIEW-MODEL layer (Phase 1 pt 2).
//
// Turns engine outputs (he-scan.js) into the exact flow/card states the DOM
// renderer will draw, with honest labels. Pure: no DOM, no camera, no network.
// The DOM/camera wiring is a later increment and will consume these view models
// with the shared safe builder h() only (Trusted-Types safe).
//
// Privacy: the confirmation card exposes a MASKED destination (never the full
// recipient name or ZIP) and requires explicit confirmation on EVERY package,
// including a strong match — a scan never auto-confirms and never proves carrier
// acceptance. Everything is labelled SIMULATED in the local build.
(function (root, factory) {
  'use strict';
  const api = factory(root && root.HE && root.HE.scan && root.HE.scan['he-scan']);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-scan-ui'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (injectedEngine) {
  'use strict';
  const engine = injectedEngine || (typeof require !== 'undefined' ? require('./he-scan.js') : null);

  const CAPTURE_METHODS = ['camera', 'photo', 'scan_from_order', 'manual'];

  function maskName(name) {
    const parts = String(name == null ? '' : name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '—';
    const first = parts[0];
    const rest = parts.slice(1).map(function (p) { return p[0].toUpperCase() + '.'; }).join(' ');
    return (rest ? first + ' ' + rest : first);
  }
  function maskZip(zip) {
    const z = String(zip == null ? '' : zip).replace(/[^0-9]/g, '');
    if (z.length < 3) return z ? '••' : '—';
    return z.slice(0, 3) + '••'; // ZIP3 only — enough to sanity-check, not the full code
  }
  function maskDestination(order) {
    const o = order || {};
    return { name: maskName(o.recipient_name), zip: maskZip(o.dest_zip), channel: o.channel || 'unknown' };
  }

  // The capture step view model. Camera opens only on a deliberate tap; a denied
  // camera must fall back to photo-pick or manual. Extracted fields are carried
  // through every later step so switching to search or manual never loses them.
  function captureStep(opts) {
    const o = opts || {};
    return {
      step: 'capture', state: o.cameraDenied ? 'BLOCKED_CAMERA' : 'OK',
      methods: CAPTURE_METHODS,
      cameraAvailable: o.cameraAvailable !== false && !o.cameraDenied,
      fallback: (o.cameraDenied || o.cameraAvailable === false) ? ['photo', 'manual'] : null,
      note: 'SIMULATED capture. Camera opens only when you tap Scan.',
    };
  }

  // Normalize an extraction into labelled fields + validation, for the review
  // step. Recognition that came from a fixture is labelled SIMULATED; a field we
  // could not read is UNKNOWN (never a guessed value).
  function reviewExtraction(extracted) {
    const ex = extracted || {};
    const tracking = engine ? engine.normalizeTracking(ex.tracking) : String(ex.tracking || '');
    const carrier = ex.carrier || (engine ? engine.detectCarrier(tracking) : null);
    const validation = engine ? engine.validateTracking(tracking, carrier) : { valid: false, confidence: 'none' };
    const f = function (v) { return (v == null || v === '') ? { value: '—', label: 'UNKNOWN' } : { value: v, label: 'SIMULATED' }; };
    return {
      step: 'review', state: 'OK',
      fields: {
        carrier: carrier ? { value: carrier, label: 'SIMULATED' } : { value: '—', label: 'UNKNOWN' },
        tracking: tracking ? { value: tracking, label: 'SIMULATED' } : { value: '—', label: 'UNKNOWN' },
        orderRef: f(ex.orderRef), destZip: f(ex.destZip), name: f(ex.name),
      },
      tracking: tracking, carrier: carrier, validation: validation,
      trackingLink: (carrier && engine) ? engine.carrierLink(carrier, tracking) : null,
      invalidTracking: !validation.valid,
      note: 'SIMULATED extraction — correct any field, retake, or type it in.',
    };
  }

  // The search/confirmation step. Always carries `extracted` forward. Produces:
  //   single_match  -> one confirmation card (still requires confirm)
  //   multiple_matches -> a chooser of cards (no auto-pick)
  //   weak_only / no_match -> prompt to search or enter manually (never guess)
  function confirmStep(extracted, ranked) {
    const outcome = engine ? engine.rankingOutcome(ranked) : { kind: 'no_match', candidates: ranked || [] };
    const card = function (r) {
      return {
        order_id: r.order.id, order_number: r.order.order_number, channel: r.order.channel,
        destination: maskDestination(r.order),
        carrier: (extracted || {}).carrier || null,
        tracking: engine ? engine.normalizeTracking((extracted || {}).tracking) : (extracted || {}).tracking,
        intendedRecipient: maskName(r.order.recipient_name),
        reasons: r.reasons, strong: r.strong, match: r.match,
        requireConfirm: true,           // ALWAYS — even a strong match
        actions: ['confirm', 'correct', 'retake', 'pick_different'],
        label: 'SIMULATED',
      };
    };
    const vm = { step: 'confirm', kind: outcome.kind, extracted: extracted || {}, requireConfirm: true };
    if (outcome.kind === 'single_match') { vm.state = 'OK'; vm.cards = outcome.matches.map(card); }
    else if (outcome.kind === 'multiple_matches') { vm.state = 'OK'; vm.chooser = true; vm.cards = outcome.matches.map(card); }
    else { vm.state = 'NEEDS_SEARCH'; vm.cards = []; vm.candidates = (outcome.candidates || []).map(card); vm.note = 'No confident match — search by order number or enter the order by hand. Never picked from a ZIP or name alone.'; }
    return vm;
  }

  // The result step after Confirm & start tracking: show the attach outcome and
  // the queued/sent/failed/held side effects, each retryable where safe.
  function resultStep(plan) {
    const p = plan || {};
    if (p.duplicateAttach) return { step: 'result', state: 'DUPLICATE', note: 'This label is already attached to the shipment — nothing was added or sent again.', queued: [] };
    if (!p.ok) return { step: 'result', state: 'INVALID', note: (p.validation && p.validation.reason) || 'Could not attach this tracking number.', queued: [] };
    return {
      step: 'result', state: 'OK',
      attached: { carrier: p.attach.carrier, tracking: p.attach.tracking_number, trackingState: p.attach.tracking_state, confirmedBy: p.attach.confirmed_by, confirmedAt: p.attach.confirmed_at },
      queued: (p.queued || []).map(function (q) { return { kind: q.kind, channel: q.channel || null, state: q.state, retryable: q.state === 'failed' || q.state === 'held', label: 'SIMULATED' }; }),
      noticeBy: p.noticeBy || 'dashboard',
      note: (p.noticeBy && p.noticeBy !== 'dashboard')
        ? 'SIMULATED — queued a tracking check. The shipping email for this order comes from ' + p.noticeBy.charAt(0).toUpperCase() + p.noticeBy.slice(1) + ' once the tracking number is added there; the dashboard sends none, so the customer gets one, not two. A scan does not prove carrier acceptance.'
        : (p.note || 'SIMULATED — queued a tracking check and one shipping notification. A scan does not prove carrier acceptance.'),
    };
  }

  return {
    CAPTURE_METHODS: CAPTURE_METHODS,
    maskName: maskName, maskZip: maskZip, maskDestination: maskDestination,
    captureStep: captureStep, reviewExtraction: reviewExtraction, confirmStep: confirmStep, resultStep: resultStep,
  };
}));
