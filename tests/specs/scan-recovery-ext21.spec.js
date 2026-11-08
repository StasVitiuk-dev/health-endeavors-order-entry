// Scanner recovery (wave-1 item 7). Pure, Node-only, synthetic. The failure
// modes a scan must survive: a tracking number already assigned to a DIFFERENT
// order (refused, not silently reattached), a split shipment (two boxes, two
// trackings, one order — both attach), and a notification outage that holds the
// message while PRESERVING the confirmed shipment. No carrier is contacted and
// nothing is sent (the plan only queues side effects). Camera-denied and the
// provider-outage UI path are covered through the UI in scan-flow-ext21.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const SCAN = require('../../assets/scan/he-scan.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const UPS_1 = '1Z999AA10123456784';     // valid UPS check digit
const FEDEX_2 = '231300687629630';       // a different, valid (format) FedEx label

test('a tracking number already assigned to a different order is refused (not reattached)', () => {
  // UPS_1 is already attached to shipment S-A (order O-A).
  const assignedTo = {}; assignedTo[SCAN.normalizeTracking(UPS_1)] = 'SYN-ship-A';
  // scanning it onto a DIFFERENT shipment S-B is refused
  const r = SCAN.planAttach({ shipmentId: 'SYN-ship-B', orderId: 'SYN-order-B', tracking: UPS_1, assignedTo: assignedTo, channel: 'email' });
  expect(r.ok).toBe(false);
  expect(r.crossAssigned).toBe(true);
  expect(r.crossAssignedTo).toBe('SYN-ship-A');
  expect(r.attach).toBe(null);
  expect(r.queued).toEqual([]);                 // nothing queued on a refused attach
  expect(r.reason).toMatch(/already assigned to a different shipment/);
  // re-scanning onto its OWN shipment is a duplicate, not a cross-assignment
  const same = SCAN.planAttach({ shipmentId: 'SYN-ship-A', orderId: 'SYN-order-A', tracking: UPS_1, assignedTo: assignedTo, existingKeys: new Set([SCAN.shipmentTrackingKey('SYN-ship-A', UPS_1)]) });
  expect(same.crossAssigned).toBe(false);
  expect(same.duplicateAttach).toBe(true);
});

test('a split shipment: two boxes of one order get two trackings; both attach once', () => {
  const seen = new Set(); const assignedTo = {};
  // box 1
  const b1 = SCAN.planAttach({ shipmentId: 'SYN-ship-1a', orderId: 'SYN-order-1', tracking: UPS_1, assignedTo: assignedTo, channel: 'email' });
  expect(b1.ok).toBe(true);
  seen.add(b1.attach.dedup_key); assignedTo[b1.attach.tracking_number] = b1.attach.shipment_id;
  // box 2 — same order, different tracking (and carrier)
  const b2 = SCAN.planAttach({ shipmentId: 'SYN-ship-1b', orderId: 'SYN-order-1', tracking: FEDEX_2, carrier: 'fedex', assignedTo: assignedTo, existingKeys: seen, channel: 'email' });
  expect(b2.ok).toBe(true);
  expect(b2.crossAssigned).toBe(false);          // different tracking -> no conflict
  expect(b2.attach.shipment_id).toBe('SYN-ship-1b');
  // the two boxes are distinct attachments, each queued one notification
  expect(b1.attach.dedup_key).not.toBe(b2.attach.dedup_key);
});

test('a notification outage holds the message but the confirmed shipment is preserved', () => {
  const r = SCAN.planAttach({ shipmentId: 'SYN-ship-9', orderId: 'SYN-order-9', tracking: UPS_1, channel: 'email', actor: 'owner' });
  expect(r.ok).toBe(true);
  expect(r.attach.tracking_state).toBe('label_created'); // the shipment attachment exists
  // the queued notification hits a provider outage: queued -> held (legal)
  expect(SCAN.canNotifTransition('queued', 'held')).toBe(true);
  // held is NOT delivered; it can be retried later: held -> queued
  expect(SCAN.canNotifTransition('held', 'queued')).toBe(true);
  // a held notification cannot jump straight to sent (must be re-queued first)
  expect(SCAN.canNotifTransition('held', 'sent')).toBe(false);
  // the attach is independent of the notification outcome -> shipment preserved
  expect(r.attach.tracking_number).toBe(SCAN.normalizeTracking(UPS_1));
  // nothing was actually sent or checked — only queued
  expect(r.note).toMatch(/sends nothing/);
});
