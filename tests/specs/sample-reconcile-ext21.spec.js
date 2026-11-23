// Sample handoff <-> inventory reconciliation (Phase 2 acceptance item 2).
// One synthetic store visit hands over 1 Honey Milk + 1 Vegan sample jar. We
// capture the confirmed consumption ONCE (idempotent via a dedup key) and show
// the forecast impact on sample-jar stock. There is no safe WRITE contract in the
// local build, so this is a read-only PROJECTION and the missing contract is named.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RO = require('../../assets/inventory/he-reorder.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('a confirmed in-person sample handoff lowers sample-jar cover (read-only projection)', () => {
  const jar = { sku: 'SAMPLE-JAR-5ML', kind: 'component', onHand: 40, sampleReserved: 0, velocityPerDay: 2, leadTimeDays: 21, unitCost: 0.29, packSize: 240, moq: 240 };
  const before = RO.reorderProposal(jar);
  // Store visit: 1 Honey Milk + 1 Vegan jar handed over = 2 sample jars consumed.
  const after = RO.reorderProposal(RO.projectConsumption(jar, 2));
  expect(after.available).toBe(before.available - 2);
  // cover is a number here (velocity known); it must not increase after consumption
  expect(after.daysOfCover).toBeLessThanOrEqual(before.daysOfCover);
});

test('confirmed consumption is captured once (idempotent via a dedup key)', () => {
  const jar = { sku: 'SAMPLE-JAR-5ML', kind: 'component', onHand: 40, velocityPerDay: 2, leadTimeDays: 21 };
  const applied = new Set();
  const key = 'visit:SYN-store-1|kit:SYN-kitA'; // one confirmed handoff
  function confirmOnce(item, units, k) {
    if (applied.has(k)) return { item: item, changed: false };
    applied.add(k);
    return { item: RO.projectConsumption(item, units), changed: true };
  }
  const first = confirmOnce(jar, 2, key);
  expect(first.changed).toBe(true);
  expect(RO.availability(first.item).available).toBe(38);
  // Re-confirming the same handoff does nothing (no double-decrement).
  const second = confirmOnce(first.item, 2, key);
  expect(second.changed).toBe(false);
  expect(RO.availability(second.item).available).toBe(38);
});

test('unknown on-hand cannot be projected (never invents a count) and the missing write contract is named', () => {
  const noCount = { sku: 'SAMPLE-JAR-5ML', velocityPerDay: 2 };
  expect(RO.availability(RO.projectConsumption(noCount, 2)).available).toBe(null);
  expect(RO.MISSING_WRITE_CONTRACT).toMatch(/adjust_inventory|R4/);
  expect(RO.MISSING_WRITE_CONTRACT).toMatch(/read-only|not available/i);
});
