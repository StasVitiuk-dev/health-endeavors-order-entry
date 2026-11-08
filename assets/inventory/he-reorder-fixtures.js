// Inventory reorder planning — synthetic fixtures (Phase 2, local only).
// Deterministic fake stock for Sea Foam finished variants and packaging
// components, chosen to exercise every branch on the planning screen: a normal
// velocity reorder, a partial receipt (some of a PO still in transit), unknown
// demand (manual threshold), zero activity, missing unit cost, and unknown
// on-hand. SYN/HE-* ids only — no real data.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-reorder-fixtures'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ITEMS = [
    // Finished variants
    { sku: 'HE-HONEY-8OZ', name: 'SYNTHETIC Honey Milk 8 oz', kind: 'finished', onHand: 40, reserved: 6, damaged: 2, sampleReserved: 2, inTransit: 24, velocityPerDay: 4, leadTimeDays: 20, unitCost: 6.0, packSize: 12, moq: 24 },
    { sku: 'HE-VEGAN-8OZ', name: 'SYNTHETIC Vegan 8 oz', kind: 'finished', onHand: 900, reserved: 0, damaged: 0, inTransit: 0, velocityPerDay: 3, leadTimeDays: 20, unitCost: 6.0, packSize: 12 },
    { sku: 'HE-GIFT-DUO', name: 'SYNTHETIC Honey+Vegan gift duo', kind: 'finished', onHand: 8, reserved: 0, velocityPerDay: null, reorderThreshold: 20, unitCost: 13.0, packSize: 6 }, // unknown demand -> manual threshold
    { sku: 'HE-LTD-LAV', name: 'SYNTHETIC Limited Lavender (discontinued)', kind: 'finished', onHand: 15, reserved: 0, velocityPerDay: 0, leadTimeDays: 20, unitCost: 6.0 }, // zero activity
    // Packaging components
    { sku: 'BOTTLE-8OZ', name: 'SYNTHETIC 8 oz amber bottle', kind: 'component', onHand: 120, reserved: 0, inTransit: 0, velocityPerDay: 7, leadTimeDays: 30 }, // missing unit cost
    { sku: 'PUMP-BLACK', name: 'SYNTHETIC black pump', kind: 'component', onHand: 80, velocityPerDay: 7, leadTimeDays: 30, unitCost: 0.22, packSize: 100, moq: 500 },
    { sku: 'LABEL-HONEY', name: 'SYNTHETIC Honey Milk label', kind: 'component', onHand: 30, inTransit: 1000, velocityPerDay: 4, leadTimeDays: 14, unitCost: 0.08, packSize: 500 }, // partial receipt: big PO en route
    { sku: 'CARTON-2JAR', name: 'SYNTHETIC two-jar carton', kind: 'component', velocityPerDay: null, reorderThreshold: 200, unitCost: 0.4, packSize: 250 }, // unknown on-hand -> needs data
    { sku: 'SAMPLE-JAR-5ML', name: 'SYNTHETIC 5 mL sample jar', kind: 'component', onHand: 40, sampleReserved: 20, velocityPerDay: 2, leadTimeDays: 21, unitCost: 0.29, packSize: 240, moq: 240 },
  ];
  return { ITEMS: ITEMS };
}));
