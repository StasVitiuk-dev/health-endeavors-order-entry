// Scan Shipment — synthetic fixtures (Phase 1, local only).
//
// Deterministic fake orders and fake "scan extractions" that exercise every
// branch the scanner must handle: a clean exact-reference match, same-name
// accounts, multiple packages for one order, a weak ZIP/name-only clue, no
// match, and an invalid tracking number. NOTHING here is real: ids are SYN-*,
// recipients are example people/stores, tracking numbers are public sample
// formats used only to exercise validation. No real customer data.
//
// Pure, dual-mode, same pattern as he-scan.js.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-scan-fixtures'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Public, format-valid sample tracking numbers (hand-verified check digits
  // for UPS and USPS-S10; see he-scan.js). Used only to drive validation.
  const SAMPLE_UPS = '1Z999AA10123456784';     // valid UPS check digit
  const SAMPLE_USPS_S10 = 'EJ958083578US';     // valid USPS S10 check digit
  const BAD_UPS = '1Z999AA10123456780';        // same as SAMPLE_UPS, wrong check digit

  // Synthetic orders (retail + wholesale), role-tagged so the ranking's role
  // boundary can be exercised. dest_zip / recipient_name / fulfillment_status
  // are the ranking signals.
  const ORDERS = [
    { id: 'SYN-o1', order_number: 'SYN-1001', channel: 'retail', dest_zip: '97201', recipient_name: 'SYNTHETIC Dana Rivers', fulfillment_status: 'ready', owner_only: false },
    { id: 'SYN-o2', order_number: 'SYN-1002', channel: 'retail', dest_zip: '97201', recipient_name: 'SYNTHETIC Dana Rivers', fulfillment_status: 'ready', owner_only: false }, // SAME name + ZIP as o1
    { id: 'SYN-o3', order_number: 'SYN-1003', channel: 'wholesale', dest_zip: '10001', recipient_name: 'SYNTHETIC Glow Boutique', fulfillment_status: 'unfulfilled', owner_only: false },
    { id: 'SYN-o4', order_number: 'SYN-1004', channel: 'wholesale', dest_zip: '60614', recipient_name: 'SYNTHETIC Serene Spa', fulfillment_status: 'fulfilled', owner_only: true }, // owner-only (role boundary)
    { id: 'SYN-o5', order_number: 'SYN-1005', channel: 'retail', dest_zip: '94110', recipient_name: 'SYNTHETIC Alex Kim', fulfillment_status: 'ready', owner_only: false },
  ];

  // Scan extractions keyed by scenario. Each is what the capture/recognition
  // step would hand the engine after reading an image (or manual entry).
  const SCANS = {
    exact_match: { carrier: 'ups', tracking: SAMPLE_UPS, orderRef: 'SYN-1003', destZip: '10001', name: 'SYNTHETIC Glow Boutique', fulfillmentHint: true },
    same_name: { carrier: 'usps', tracking: SAMPLE_USPS_S10, orderRef: '', destZip: '97201', name: 'SYNTHETIC Dana Rivers', fulfillmentHint: true },
    multi_package: { carrier: 'ups', tracking: SAMPLE_UPS, orderRef: 'SYN-1003', destZip: '10001', name: 'SYNTHETIC Glow Boutique', packages: 3 },
    zip_only: { carrier: 'usps', tracking: SAMPLE_USPS_S10, orderRef: '', destZip: '94110', name: '', fulfillmentHint: false },
    name_only: { carrier: 'usps', tracking: SAMPLE_USPS_S10, orderRef: '', destZip: '', name: 'SYNTHETIC Alex Kim', fulfillmentHint: false },
    no_match: { carrier: 'fedex', tracking: '231300687629630', orderRef: 'SYN-9999', destZip: '00000', name: 'SYNTHETIC Nobody', fulfillmentHint: false },
    invalid_tracking: { carrier: 'ups', tracking: BAD_UPS, orderRef: 'SYN-1005', destZip: '94110', name: 'SYNTHETIC Alex Kim', fulfillmentHint: true },
  };

  // A staff role can see non-owner-only orders; owner/admin see all.
  function accessibleFor(role) {
    return function (o) { return (role === 'owner' || role === 'administrator') ? true : !o.owner_only; };
  }

  return { SAMPLE_UPS: SAMPLE_UPS, SAMPLE_USPS_S10: SAMPLE_USPS_S10, BAD_UPS: BAD_UPS, ORDERS: ORDERS, SCANS: SCANS, accessibleFor: accessibleFor };
}));
