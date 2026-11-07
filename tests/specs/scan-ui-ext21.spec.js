// Scan Shipment view-model layer — unit tests (Phase 1 pt 2). Pure, Node-only.
// Checks masking, the always-confirm rule, carried-forward extraction, and the
// mapping from engine ranking/attach outcomes to flow states.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const scan = require('../../assets/scan/he-scan.js');
const ui = require('../../assets/scan/he-scan-ui.js');
const fx = require('../../assets/scan/he-scan-fixtures.js');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Node-only tests; run once');
});

test('masking never reveals the full name or ZIP', () => {
  expect(ui.maskName('SYNTHETIC Dana Rivers')).toBe('SYNTHETIC D. R.');
  expect(ui.maskZip('97201')).toBe('972••');
  expect(ui.maskZip('')).toBe('—');
  const d = ui.maskDestination({ recipient_name: 'SYNTHETIC Glow Boutique', dest_zip: '10001', channel: 'wholesale' });
  expect(d.zip).toBe('100••');
  expect(d.name).not.toContain('Boutique'); // masked
});

test('captureStep falls back when the camera is denied', () => {
  const ok = ui.captureStep({ cameraAvailable: true });
  expect(ok.state).toBe('OK');
  expect(ok.methods).toContain('manual');
  const denied = ui.captureStep({ cameraDenied: true });
  expect(denied.state).toBe('BLOCKED_CAMERA');
  expect(denied.fallback).toContain('manual');
  expect(denied.cameraAvailable).toBe(false);
});

test('reviewExtraction labels fields and flags an invalid tracking number', () => {
  const good = ui.reviewExtraction(fx.SCANS.exact_match);
  expect(good.invalidTracking).toBe(false);
  expect(good.fields.carrier.value).toBe('ups');
  expect(good.trackingLink).toMatch(/^https:\/\/www\.ups\.com\//);
  const bad = ui.reviewExtraction(fx.SCANS.invalid_tracking);
  expect(bad.invalidTracking).toBe(true);
  // a field that was not read stays UNKNOWN, never a guess
  const sparse = ui.reviewExtraction({ tracking: fx.SAMPLE_UPS, carrier: 'ups' });
  expect(sparse.fields.orderRef.label).toBe('UNKNOWN');
});

test('confirmStep: a single match still requires explicit confirmation', () => {
  const ranked = scan.rankOrders(fx.SCANS.exact_match, fx.ORDERS, fx.accessibleFor('owner'));
  const vm = ui.confirmStep(fx.SCANS.exact_match, ranked);
  expect(vm.kind).toBe('single_match');
  expect(vm.cards.length).toBe(1);
  expect(vm.cards[0].requireConfirm).toBe(true);      // even though strong
  expect(vm.cards[0].strong).toBe(true);
  expect(vm.cards[0].actions).toEqual(expect.arrayContaining(['confirm', 'correct', 'retake', 'pick_different']));
  expect(vm.cards[0].destination.name).toBe('SYNTHETIC G. B.'); // masked
});

test('confirmStep: same-name accounts produce a chooser, never an auto-pick', () => {
  const ranked = scan.rankOrders(fx.SCANS.same_name, fx.ORDERS, fx.accessibleFor('owner'));
  const vm = ui.confirmStep(fx.SCANS.same_name, ranked);
  expect(vm.kind).toBe('multiple_matches');
  expect(vm.chooser).toBe(true);
  expect(vm.cards.length).toBe(2);
});

test('confirmStep: ZIP-only / no match asks to search, carrying the extraction forward', () => {
  const ranked = scan.rankOrders(fx.SCANS.zip_only, fx.ORDERS, fx.accessibleFor('owner'));
  const vm = ui.confirmStep(fx.SCANS.zip_only, ranked);
  expect(vm.state).toBe('NEEDS_SEARCH');
  expect(vm.cards.length).toBe(0);
  expect(vm.extracted).toBe(fx.SCANS.zip_only); // fields preserved for search/manual
});

test('resultStep maps attach outcomes to flow states', () => {
  const okPlan = scan.planAttach({ shipmentId: 'SYN-s1', orderId: 'SYN-o3', tracking: fx.SAMPLE_UPS, carrier: 'ups', channel: 'wholesale', actor: 'owner', now: 'T', existingKeys: [] });
  const okVm = ui.resultStep(okPlan);
  expect(okVm.state).toBe('OK');
  expect(okVm.queued.map(q => q.kind).sort()).toEqual(['notification', 'tracking_check']);

  const dupKey = scan.shipmentTrackingKey('SYN-s1', fx.SAMPLE_UPS);
  const dupVm = ui.resultStep(scan.planAttach({ shipmentId: 'SYN-s1', tracking: fx.SAMPLE_UPS, carrier: 'ups', existingKeys: [dupKey] }));
  expect(dupVm.state).toBe('DUPLICATE');

  const badVm = ui.resultStep(scan.planAttach({ shipmentId: 'SYN-s2', tracking: fx.BAD_UPS, carrier: 'ups', existingKeys: [] }));
  expect(badVm.state).toBe('INVALID');
});
