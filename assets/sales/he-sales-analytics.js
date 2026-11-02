// Sales & Growth — read-only analytics: safe metrics, funnel SIMULATION, and the
// sample economics calculator. No money movement, no AI, no production data.
//
// Three deterministic tools:
//  * rate()/metrics() — compute reply/interest/conversion rates etc. with SAFE
//    denominators: an unknown or zero denominator returns null (UNKNOWN), never a
//    misleading 0%.
//  * funnelSimulation() — a hypothetical funnel from owner-adjustable conversion
//    rates. Everything it returns is labelled SIMULATION, not a forecast of fact.
//  * sampleEconomics() — break-even and max sensible sample spend from
//    configurable synthetic costs. No production inventory assumptions.
//
// Pure. Dual-mode (Node require + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-analytics'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // A rate with a safe denominator. Returns null (UNKNOWN) when the denominator
  // is missing, non-finite or zero — never a fake 0%.
  function rate(numerator, denominator) {
    const n = Number(numerator), d = Number(denominator);
    if (!isFinite(n) || !isFinite(d) || d <= 0) return null;
    return Math.round((n / d) * 1000) / 1000;
  }

  // Standard sales metrics. Any rate whose denominator is unknown/zero is null.
  function metrics(counts) {
    const c = counts || {};
    return {
      replyRate: rate(c.replies, c.contacted),
      interestRate: rate(c.interested, c.replies),
      customerConversion: rate(c.customers, c.contacted),
      sampleConversion: rate(c.sampleConversions, c.samplesSent),
      costPerLead: rate(c.spend, c.leads),
      costPerCustomer: rate(c.spend, c.customers),
      // raw counts passed through for display
      counts: { leads: c.leads || 0, contacted: c.contacted || 0, replies: c.replies || 0, interested: c.interested || 0, customers: c.customers || 0 },
    };
  }

  // Hypothetical funnel. rates = { draft, contact, reply, interest, sample, customer }
  // each 0..1 (owner-adjustable). Everything is a SIMULATION.
  function funnelSimulation(qualifiedLeads, rates) {
    const r = rates || {};
    const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
    const start = Math.max(0, Math.floor(Number(qualifiedLeads) || 0));
    const drafts = Math.round(start * clamp(r.draft != null ? r.draft : 1));
    const contacts = Math.round(drafts * clamp(r.contact != null ? r.contact : 1));
    const replies = Math.round(contacts * clamp(r.reply));
    const interested = Math.round(replies * clamp(r.interest));
    const samples = Math.round(interested * clamp(r.sample));
    const customers = Math.round((samples || interested) * clamp(r.customer));
    return { label: 'SIMULATION', note: 'hypothetical, not a forecast of fact',
      qualifiedLeads: start, drafts, contacts, replies, interested, samples, customers };
  }

  // Sample economics from configurable synthetic inputs. No accounting writes.
  // expectedOrder = expected first wholesale order value; margin = 0..1 gross margin.
  function sampleEconomics(inp) {
    const i = inp || {};
    const bottle = Number(i.bottleCost) || 0, ship = Number(i.shipCost) || 0, pack = Number(i.packCost) || 0;
    const sampleCost = bottle + ship + pack;
    const expectedOrder = Number(i.expectedOrder) || 0;
    const margin = Math.max(0, Math.min(1, Number(i.margin) || 0));
    const grossPerOrder = expectedOrder * margin;
    const conv = (i.conversionRate != null) ? Math.max(0, Math.min(1, Number(i.conversionRate))) : null;
    // Expected gross profit per sample given a conversion rate.
    const expectedGrossPerSample = conv == null ? null : grossPerOrder * conv;
    // Break-even conversion: fraction of samples that must convert to cover cost.
    const breakEvenConversion = grossPerOrder > 0 ? Math.round((sampleCost / grossPerOrder) * 1000) / 1000 : null;
    // Max sensible spend per acquired customer = gross profit per converted order.
    return {
      sampleCost,
      grossPerOrder,
      expectedGrossPerSample,
      breakEvenConversion,                 // null when we cannot compute (no margin/order)
      maxSensibleSpendPerCustomer: grossPerOrder || null,
      costBasis: (bottle || ship || pack) ? 'CONFIGURED' : 'UNKNOWN',
    };
  }

  return { rate, metrics, funnelSimulation, sampleEconomics };
}));
