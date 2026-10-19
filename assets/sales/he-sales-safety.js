// Sales & Growth — SAFETY CENTER, global kill switch, per-agent pause, budgets.
//
// One place that describes every sales safety control and its state, plus a
// global kill switch and per-agent pause. Hard invariants that can never be
// turned off from here: there is no SEND mode, Gmail is not connected, the
// production DB is not connected, and samples stay owner-only. assertInvariants()
// throws (fails closed) if any of those are violated.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-safety'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The safety baseline. Anything not supplied defaults to the safe value.
  function defaults() {
    return {
      featureFlag: false,        // Sales & Growth OFF by default
      pauseAll: false,           // global kill switch (false = not paused)
      gmailConnected: false,     // never connected in this mode
      sendEnabled: false,        // there is NO send mode
      sampleOwnerOnly: true,     // samples require an owner actor
      claimFirewall: true,       // always on
      dncProtection: true,       // always on
      productionDbConnected: false, // drafts/synthetic only
      dailyBudget: 1,            // synthetic $ hard stop
      monthlyBudget: 10,
    };
  }

  // Hard invariants — these must always hold, regardless of input state.
  function assertInvariants(state) {
    const s = Object.assign(defaults(), state || {});
    if (s.sendEnabled) throw new Error('safety invariant: sendEnabled must never be true (no send mode)');
    if (s.gmailConnected) throw new Error('safety invariant: Gmail must not be connected in this mode');
    if (s.productionDbConnected) throw new Error('safety invariant: production DB must not be connected');
    if (!s.sampleOwnerOnly) throw new Error('safety invariant: samples must stay owner-only');
    if (!s.claimFirewall) throw new Error('safety invariant: claim firewall must stay on');
    if (!s.dncProtection) throw new Error('safety invariant: DNC protection must stay on');
    return true;
  }

  // A labelled snapshot for the Safety Center page. `on` = the safe/protective
  // state is active; `status` is human text.
  function safetyCenter(state) {
    const s = Object.assign(defaults(), state || {});
    assertInvariants(s);
    const rows = [
      { key: 'Sales & Growth feature flag', on: s.featureFlag, status: s.featureFlag ? 'ON (pages visible)' : 'OFF (hidden — default)', protective: !s.featureFlag },
      { key: 'All agents paused (kill switch)', on: s.pauseAll, status: s.pauseAll ? 'PAUSED — no AI runs' : 'running allowed', protective: s.pauseAll },
      { key: 'Gmail connection', on: s.gmailConnected, status: 'NOT CONNECTED', protective: true },
      { key: 'Send', on: s.sendEnabled, status: 'DISABLED (no send mode)', protective: true },
      { key: 'Samples', on: s.sampleOwnerOnly, status: 'OWNER-ONLY, budget-guarded', protective: true },
      { key: 'Claim firewall', on: s.claimFirewall, status: 'ON (fails closed)', protective: true },
      { key: 'Do-not-contact protection', on: s.dncProtection, status: 'ON', protective: true },
      { key: 'Production database', on: s.productionDbConnected, status: 'NOT CONNECTED (drafts/synthetic only)', protective: true },
      { key: 'AI budget', on: true, status: `daily $${s.dailyBudget} / monthly $${s.monthlyBudget} hard stop`, protective: true },
    ];
    return { rows, allProtectionsOn: rows.every(r => r.protective),
      guard: 'These controls are enforced in code; the page only reflects them.' };
  }

  // Global kill switch. Returns new state + the effect.
  function killSwitch(state, on) {
    const s = Object.assign(defaults(), state || {});
    s.pauseAll = !!on;
    return { state: s, aiRunsAllowed: !s.pauseAll,
      effect: s.pauseAll ? 'No new AI runs. Deterministic pages stay readable; no workflow needing AI advances.' : 'AI runs allowed again (still draft-only, nothing sends).' };
  }

  // Can an AI run proceed? Only when the flag is on AND not globally paused AND
  // that specific agent is not paused.
  function canRunAI(state, pausedAgents, agentId) {
    const s = Object.assign(defaults(), state || {});
    if (!s.featureFlag) return { ok: false, reason: 'feature flag OFF' };
    if (s.pauseAll) return { ok: false, reason: 'global kill switch engaged' };
    if (agentId && (pausedAgents || {})[agentId]) return { ok: false, reason: 'agent paused' };
    return { ok: true };
  }

  function pauseAgent(pausedAgents, agentId, paused) {
    const next = Object.assign({}, pausedAgents || {});
    if (paused) next[agentId] = true; else delete next[agentId];
    return next;
  }

  // Budget guard: warns at 80%, hard-stops at/over 100%.
  function budgetGuard(spent, budget) {
    if (budget == null || budget <= 0) return { ok: false, reason: 'no budget set', remaining: null };
    const remaining = +(budget - spent).toFixed(4);
    if (spent >= budget) return { ok: false, hardStop: true, reason: 'budget exhausted', remaining: 0 };
    return { ok: true, warn: spent >= budget * 0.8, remaining };
  }

  return { defaults, assertInvariants, safetyCenter, killSwitch, canRunAI, pauseAgent, budgetGuard };
}));
