// Scan Shipment engine — unit tests (Phase 1). Pure, Node-only, synthetic.
// Exercises tracking validation, carrier detection + trusted links, role-scoped
// order ranking (exact reference strongest; ZIP/name weak and never a match on
// their own), dedup keys, the simulated attach plan and the state machines.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const scan = require('../../assets/scan/he-scan.js');
const fx = require('../../assets/scan/he-scan-fixtures.js');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Node-only tests; run once');
});

test('normalizeTracking strips separators and upper-cases', () => {
  expect(scan.normalizeTracking(' 1z999aa1 0123456784 ')).toBe('1Z999AA10123456784');
  expect(scan.normalizeTracking(null)).toBe('');
});

test('detectCarrier recognizes UPS, USPS and FedEx formats, null otherwise', () => {
  expect(scan.detectCarrier(fx.SAMPLE_UPS)).toBe('ups');
  expect(scan.detectCarrier(fx.SAMPLE_USPS_S10)).toBe('usps');
  expect(scan.detectCarrier('9400111899223817993004')).toBe('usps'); // IMpb prefix
  expect(scan.detectCarrier('231300687629630')).toBe('fedex');       // 15-digit
  expect(scan.detectCarrier('HELLO123')).toBe(null);
});

test('validateTracking: real UPS + USPS check digits pass, tampered fails', () => {
  expect(scan.validateTracking(fx.SAMPLE_UPS, 'ups')).toMatchObject({ valid: true, confidence: 'checkdigit' });
  expect(scan.validateTracking(fx.BAD_UPS, 'ups').valid).toBe(false);
  expect(scan.validateTracking(fx.SAMPLE_USPS_S10, 'usps')).toMatchObject({ valid: true, confidence: 'checkdigit' });
  // FedEx is format-only (no uniform public check digit)
  expect(scan.validateTracking('231300687629630', 'fedex')).toMatchObject({ valid: true, confidence: 'format' });
  expect(scan.validateTracking('', 'ups')).toMatchObject({ valid: false, confidence: 'none' });
});

test('USPS numeric mod-10 is internally consistent (valid passes, tamper fails)', () => {
  // Build a valid 22-digit IMpb number with the engine's own rule, then tamper.
  function imbpCheck(body20) {
    const d = body20.split('').map(Number); let sum = 0;
    for (let i = d.length - 1, k = 0; i >= 0; i--, k++) sum += d[i] * (k % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10;
  }
  const body = '9400111899223817993' + '00'; // 21 digits before the check digit (total 22)
  const good = body + imbpCheck(body);
  expect(scan.validateTracking(good, 'usps').valid).toBe(true);
  const bad = body + ((imbpCheck(body) + 1) % 10);
  expect(scan.validateTracking(bad, 'usps').valid).toBe(false);
});

test('carrierLink uses only trusted hosts and encodes the number', () => {
  expect(scan.carrierLink('ups', fx.SAMPLE_UPS)).toBe('https://www.ups.com/track?tracknum=' + fx.SAMPLE_UPS);
  expect(scan.carrierLink('usps', fx.SAMPLE_USPS_S10)).toMatch(/^https:\/\/tools\.usps\.com\//);
  expect(scan.carrierLink('fedex', '231300687629630')).toMatch(/^https:\/\/www\.fedex\.com\//);
  expect(scan.carrierLink('unknown', 'x')).toBe(null);
});

test('rankOrders: an exact order reference is the decisive match', () => {
  const ranked = scan.rankOrders(fx.SCANS.exact_match, fx.ORDERS, fx.accessibleFor('owner'));
  expect(ranked.length).toBeGreaterThan(0);
  expect(ranked[0].order.order_number).toBe('SYN-1003');
  expect(ranked[0].strong).toBe(true);
  expect(ranked[0].match).toBe(true);
  expect(scan.rankingOutcome(ranked).kind).toBe('single_match');
});

test('rankOrders: same name + ZIP returns multiple matches, none auto-picked', () => {
  const ranked = scan.rankOrders(fx.SCANS.same_name, fx.ORDERS, fx.accessibleFor('owner'));
  const matches = ranked.filter(r => r.match);
  expect(matches.length).toBe(2); // o1 and o2 share name + ZIP + open fulfillment
  expect(scan.rankingOutcome(ranked).kind).toBe('multiple_matches');
});

test('rankOrders: a ZIP alone or a name alone is never a match', () => {
  const zipOnly = scan.rankOrders(fx.SCANS.zip_only, fx.ORDERS, fx.accessibleFor('owner'));
  expect(zipOnly.every(r => !r.match)).toBe(true);
  expect(scan.rankingOutcome(zipOnly).kind).toBe('weak_only');

  const nameOnly = scan.rankOrders(fx.SCANS.name_only, fx.ORDERS, fx.accessibleFor('owner'));
  expect(nameOnly.every(r => !r.match)).toBe(true);
  expect(scan.rankingOutcome(nameOnly).kind).toBe('weak_only');
});

test('rankOrders: no matching clues yields no_match', () => {
  const ranked = scan.rankOrders(fx.SCANS.no_match, fx.ORDERS, fx.accessibleFor('owner'));
  expect(scan.rankingOutcome(ranked).kind).toBe('no_match');
});

test('rankOrders enforces the role boundary (staff cannot see an owner-only order)', () => {
  const ex = { orderRef: 'SYN-1004', destZip: '60614', name: 'SYNTHETIC Serene Spa', fulfillmentHint: true };
  const asOwner = scan.rankOrders(ex, fx.ORDERS, fx.accessibleFor('owner'));
  const asStaff = scan.rankOrders(ex, fx.ORDERS, fx.accessibleFor('staff'));
  const has1004 = list => list.some(r => r.order.order_number === 'SYN-1004');
  // Owner sees the owner-only order and it is the decisive match.
  expect(has1004(asOwner)).toBe(true);
  expect(asOwner[0].order.order_number).toBe('SYN-1004');
  expect(asOwner[0].strong).toBe(true);
  // Staff never see it — no match, not even as a weak clue.
  expect(has1004(asStaff)).toBe(false);
});

test('dedup keys are stable and normalize the tracking number', () => {
  const a = scan.shipmentTrackingKey('SYN-s1', ' 1z999aa1 0123456784 ');
  const b = scan.shipmentTrackingKey('SYN-s1', '1Z999AA10123456784');
  expect(a).toBe(b);
  expect(scan.notificationKey('SYN-s1', 'retail', 'shipped')).toBe('notif:syn-s1|ch:retail|shipped');
});

test('planAttach: a valid scan attaches once and queues a check + one notification', () => {
  const plan = scan.planAttach({ shipmentId: 'SYN-s1', orderId: 'SYN-o3', tracking: fx.SAMPLE_UPS, carrier: 'ups', channel: 'wholesale', actor: 'owner', now: '2026-11-07T00:00:00Z', existingKeys: [] });
  expect(plan.ok).toBe(true);
  expect(plan.attach).toMatchObject({ tracking_number: fx.SAMPLE_UPS, carrier: 'ups', tracking_state: 'label_created', synthetic: true });
  const kinds = plan.queued.map(q => q.kind).sort();
  expect(kinds).toEqual(['notification', 'tracking_check']);
  expect(plan.queued.every(q => q.state === 'queued' && q.synthetic)).toBe(true);
});

test('planAttach: an invalid tracking number does not attach', () => {
  const plan = scan.planAttach({ shipmentId: 'SYN-s2', orderId: 'SYN-o5', tracking: fx.BAD_UPS, carrier: 'ups', channel: 'retail', existingKeys: [] });
  expect(plan.ok).toBe(false);
  expect(plan.validation.valid).toBe(false);
});

test('planAttach: a duplicate scan of the same label attaches nothing and queues nothing', () => {
  const key = scan.shipmentTrackingKey('SYN-s1', fx.SAMPLE_UPS);
  const plan = scan.planAttach({ shipmentId: 'SYN-s1', orderId: 'SYN-o3', tracking: fx.SAMPLE_UPS, carrier: 'ups', channel: 'wholesale', existingKeys: [key] });
  expect(plan.duplicateAttach).toBe(true);
  expect(plan.ok).toBe(false);
  expect(plan.attach).toBe(null);
  expect(plan.queued).toEqual([]);
});

test('planAttach: an already-notified shipment re-attaches tracking without a second notification', () => {
  const notifKey = scan.notificationKey('SYN-s3', 'retail', 'shipped');
  const plan = scan.planAttach({ shipmentId: 'SYN-s3', orderId: 'SYN-o5', tracking: fx.SAMPLE_UPS, carrier: 'ups', channel: 'retail', existingKeys: [notifKey] });
  expect(plan.ok).toBe(true);
  expect(plan.queued.map(q => q.kind)).toEqual(['tracking_check']); // notification suppressed by dedup
});

test('state machines: only legal transitions are allowed; a scan never jumps to accepted/sent', () => {
  expect(scan.canTrackTransition('label_created', 'accepted')).toBe(true);
  expect(scan.canTrackTransition('label_created', 'delivered')).toBe(false); // must be observed step by step
  expect(scan.canTrackTransition('delivered', 'in_transit')).toBe(false);
  expect(scan.canNotifTransition('queued', 'sent')).toBe(true);
  expect(scan.canNotifTransition('failed', 'queued')).toBe(true); // safe retry
  expect(scan.canNotifTransition('sent', 'queued')).toBe(false);
  expect(scan.canNotifTransition('held', 'queued')).toBe(true);   // owner releases
});
