// FU4 scanner journey — gaps beyond the scan guard. Pure, Node-only, synthetic.
// The standalone Scan Shipment entry (Home/Orders), camera/photo/manual capture,
// same-name chooser, no-match-asks-to-search, invalid tracking, duplicate scan,
// provider outage and the cross-order/split-shipment guards are already covered
// (scan-flow / scan-ui / scan-engine / scan-recovery). This closes the remaining
// gaps: a no-name receipt, multiple packages for one order each needing its own
// confirm + notification, masked destination + match reasons, and INDEPENDENT
// tracking-check vs email-notification failure. No carrier/OCR/email providers.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const S = require('../../assets/scan/he-scan.js');
const UI = require('../../assets/scan/he-scan-ui.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const orders = [
  { id: 'O1', order_number: 'HE-1', recipient_name: 'SYNTHETIC Bright Market', dest_zip: '97201', fulfillment_status: 'unfulfilled' },
  { id: 'O2', order_number: 'HE-2', recipient_name: 'SYNTHETIC Coast Co', dest_zip: '97201', fulfillment_status: 'unfulfilled' },
];
const UPS = '1Z999AA10123456784';
const FEDEX = '231300687629630';

test('a no-name receipt never auto-picks: ZIP-only is weak (ask to search), ref is decisive', () => {
  // only a destination ZIP, no name, no reference -> weak for all, never a match
  const z = S.rankOrders({ destZip: '97201' }, orders, () => true);
  expect(S.rankingOutcome(z).kind).toBe('weak_only');
  expect(z.every(r => r.match === false)).toBe(true);
  // a reference alone (still no name) is decisive
  const r = S.rankOrders({ orderRef: 'HE-1' }, orders, () => true);
  expect(S.rankingOutcome(r).kind).toBe('single_match');
  expect(r[0].order.id).toBe('O1');
});

test('the review shows a masked destination and the match reasons', () => {
  const ranked = S.rankOrders({ orderRef: 'HE-1', destZip: '97201' }, orders, () => true);
  expect(ranked[0].reasons).toEqual(expect.arrayContaining(['Exact order reference']));
  // destination is masked for display (never the full name/ZIP)
  const masked = UI.maskDestination({ recipient_name: 'SYNTHETIC Bright Market', dest_zip: '97201' });
  const shown = JSON.stringify(masked);
  expect(shown).not.toContain('Bright Market'); // name redacted
  expect(shown).not.toContain('97201');          // full ZIP redacted
  expect(masked.name).not.toBe('SYNTHETIC Bright Market');
  expect(masked.zip).not.toBe('97201');
});

test('multiple packages for ONE order: each package attaches once with its own notification', () => {
  const seen = new Set(); const assigned = {};
  const box1 = S.planAttach({ shipmentId: 'O1-box1', orderId: 'O1', tracking: UPS, carrier: 'ups', channel: 'email', assignedTo: assigned, existingKeys: seen });
  expect(box1.ok).toBe(true);
  seen.add(box1.attach.dedup_key); box1.queued.forEach(q => seen.add(q.dedup_key)); assigned[box1.attach.tracking_number] = box1.attach.shipment_id;
  const box2 = S.planAttach({ shipmentId: 'O1-box2', orderId: 'O1', tracking: FEDEX, carrier: 'fedex', channel: 'email', assignedTo: assigned, existingKeys: seen });
  expect(box2.ok).toBe(true);
  // two distinct packages, each queued exactly one shipping notification
  expect(box1.queued.filter(q => q.kind === 'notification')).toHaveLength(1);
  expect(box2.queued.filter(q => q.kind === 'notification')).toHaveLength(1);
  expect(box1.attach.dedup_key).not.toBe(box2.attach.dedup_key);
});

test('tracking-check and email notification fail INDEPENDENTLY; the attach is preserved', () => {
  const plan = S.planAttach({ shipmentId: 's1', orderId: 'O1', tracking: UPS, channel: 'email' });
  expect(plan.ok).toBe(true);
  expect(plan.queued.map(q => q.kind)).toEqual(['tracking_check', 'notification']); // two independent side effects
  // email provider outage: the notification is held for safe retry...
  expect(S.canNotifTransition('queued', 'held')).toBe(true);
  expect(S.canNotifTransition('held', 'queued')).toBe(true); // retried later
  // ...while the tracking lifecycle is unaffected and proceeds on its own
  expect(S.canTrackTransition('label_created', 'accepted')).toBe(true);
  expect(S.canTrackTransition('accepted', 'in_transit')).toBe(true);
  // the confirmed shipment attachment stands regardless of the email outcome
  expect(plan.attach.tracking_state).toBe('label_created');
  expect(plan.note).toMatch(/sends nothing/);
});
