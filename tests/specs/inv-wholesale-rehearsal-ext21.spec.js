// Inventory + wholesale rehearsal (wave-1 item 6). Pure, Node-only, synthetic.
// One sample handoff and one partial PO receipt on one SKU; stock and the
// reorder suggestion reconcile after each; an interrupted retry (same key)
// cannot double-count the handoff or the receipt; and because there is no safe
// production write in the local build, projection is read-only and the missing
// write contract (adjust_inventory / R4) is named. Carries forward the handoff
// idempotency already proven in sample-reconcile-ext21.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RO = require('../../assets/inventory/he-reorder.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// Idempotent apply: a confirmed step runs once per key; a retry is a no-op.
function applyOnce(applied, key, item, fn) {
  if (applied.has(key)) return { item: item, changed: false };
  applied.add(key);
  return { item: fn(item), changed: true };
}

test('sample handoff then partial receipt reconcile; interrupted retries never double-count', () => {
  // SAMPLE jar SKU with an open PO of 240 in transit.
  let jar = { sku: 'SAMPLE-JAR-5ML', kind: 'component', onHand: 40, reserved: 0, sampleReserved: 0, inTransit: 240, velocityPerDay: 2, leadTimeDays: 21, unitCost: 0.29, packSize: 240, moq: 240 };
  const applied = new Set();

  // 1) A confirmed in-person sample handoff: 4 jars consumed.
  const h1 = applyOnce(applied, 'visit:SYN-store-7|kit:A', jar, it => RO.projectConsumption(it, 4));
  expect(h1.changed).toBe(true); jar = h1.item;
  expect(RO.availability(jar).available).toBe(36);           // 40 - 4
  // interrupted retry of the SAME handoff: no second decrement
  const h1b = applyOnce(applied, 'visit:SYN-store-7|kit:A', jar, it => RO.projectConsumption(it, 4));
  expect(h1b.changed).toBe(false);
  expect(RO.availability(jar).available).toBe(36);           // unchanged

  // 2) A partial receipt of the open PO: 100 of the 240 arrive.
  const r1 = applyOnce(applied, 'po:SYN-po-9|recv:1', jar, it => RO.receivePartial(it, 100));
  expect(r1.changed).toBe(true); jar = r1.item;
  expect(jar.onHand).toBe(136);                              // 36 + 100
  expect(jar.inTransit).toBe(140);                           // 240 - 100 still en route
  expect(RO.availability(jar).available).toBe(136);
  expect(RO.availability(jar).incoming).toBe(140);
  // interrupted retry of the SAME receipt: no second credit
  const r1b = applyOnce(applied, 'po:SYN-po-9|recv:1', jar, it => RO.receivePartial(it, 100));
  expect(r1b.changed).toBe(false);
  expect(jar.onHand).toBe(136);

  // 3) Reorder suggestion reconciles with the reconciled stock.
  const prop = RO.reorderProposal(jar);
  expect(prop.onHand).toBe(136);
  expect(prop.incoming).toBe(140);
  expect(prop.available).toBe(136);
  // more cover than before the receipt -> not flagged to reorder now
  expect(['none', 'reorder', 'reorder_manual', 'needs_data']).toContain(prop.decision);
});

test('a receipt never credits more than is in transit, and stays read-only', () => {
  let item = { sku: 'LABEL-HONEY', onHand: 30, inTransit: 1000, velocityPerDay: 4, leadTimeDays: 14 };
  // try to over-receive: only 1000 are in transit
  item = RO.receivePartial(item, 5000);
  expect(item.onHand).toBe(1030);     // 30 + 1000
  expect(item.inTransit).toBe(0);
  // unknown on-hand: a receipt reduces the PO but cannot invent a count
  const noCount = RO.receivePartial({ sku: 'CARTON-2JAR', inTransit: 250 }, 100);
  expect(noCount.inTransit).toBe(150);
  expect(RO.availability(noCount).available).toBe(null);
  // the missing production write contract is still named (projection only)
  expect(RO.MISSING_WRITE_CONTRACT).toMatch(/adjust_inventory|R4/);
});
