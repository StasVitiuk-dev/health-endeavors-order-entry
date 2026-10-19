// Sales & Growth — AI cost control + model routing (KEEP IT CHEAP).
//
// Two jobs:
//  1) route(task) decides which model tier a task needs. Routine, deterministic
//     work (counting, sorting, filtering, dedupe, totals, status, scoring,
//     scheduling) routes to 'none' — NO AI call at all. Only genuine
//     reasoning/drafting routes to a paid tier, and a strong model only for the
//     hard/high-value cases. A second opinion is opt-in, never automatic, so we
//     never double-bill by calling two providers for everything.
//  2) a cost ledger estimates spend per agent/day/month against configurable
//     budgets with a warning threshold and a HARD STOP.
//
// All rates/budgets here are SYNTHETIC placeholders the owner replaces later —
// never hard-coded production spend. Deterministic, pure, dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-cost'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Tasks that must NEVER call an AI model — handled by deterministic code.
  const DETERMINISTIC_TASKS = new Set(['count', 'sort', 'filter', 'dedupe', 'dates', 'totals',
    'status', 'pagination', 'rules', 'lead_score', 'sample_candidate_score', 'budget_check',
    'similarity', 'search', 'metrics']);
  // Tasks that may use the cheap model.
  const CHEAP_TASKS = new Set(['classify_reply', 'draft_followup', 'summarize', 'basic_draft', 'next_best_action']);
  // Tasks that justify the strong model.
  const STRONG_TASKS = new Set(['draft_intro_personalized', 'draft_reply_difficult', 'content_nuanced', 'chief_of_staff']);

  // route(task, opts) -> { tier: 'none'|'cheap'|'strong', secondOpinion: bool, reason }
  function route(task, opts) {
    const o = opts || {};
    if (DETERMINISTIC_TASKS.has(task)) return { tier: 'none', secondOpinion: false, reason: 'deterministic — no AI' };
    if (STRONG_TASKS.has(task)) {
      // A second opinion only for explicitly high-value AND ambiguous cases.
      const secondOpinion = !!(o.highValue && o.ambiguous);
      return { tier: 'strong', secondOpinion, reason: secondOpinion ? 'strong + opt-in second opinion (high-value & ambiguous)' : 'needs the strong model' };
    }
    if (CHEAP_TASKS.has(task)) return { tier: 'cheap', secondOpinion: false, reason: 'routine reasoning — cheap model' };
    // Unknown task: default to the cheapest reasoning tier, never strong, never auto second opinion.
    return { tier: 'cheap', secondOpinion: false, reason: 'unknown task — defaulting to cheap, no escalation' };
  }

  // SYNTHETIC per-1k-token USD rates (placeholders). none = free.
  const DEFAULT_RATES = { none: { in: 0, out: 0 }, cheap: { in: 0.0008, out: 0.004 }, strong: { in: 0.003, out: 0.015 } };

  function estimateCost(tier, tokensIn, tokensOut, rates) {
    const r = (rates || DEFAULT_RATES)[tier] || DEFAULT_RATES.none;
    const cost = (Math.max(0, tokensIn || 0) / 1000) * r.in + (Math.max(0, tokensOut || 0) / 1000) * r.out;
    return Math.round(cost * 1e6) / 1e6; // micro-dollar precision
  }

  // createLedger({ dailyBudget, monthlyBudget, warnFraction, rates })
  function createLedger(cfg) {
    const c = cfg || {};
    const dailyBudget = typeof c.dailyBudget === 'number' ? c.dailyBudget : 1.0;   // SYNTHETIC $1/day
    const monthlyBudget = typeof c.monthlyBudget === 'number' ? c.monthlyBudget : 20.0; // SYNTHETIC $20/mo
    const warnFraction = typeof c.warnFraction === 'number' ? c.warnFraction : 0.8;
    const rates = c.rates || DEFAULT_RATES;
    const byDay = {}; const byMonth = {}; const byAgent = {};

    function totals(day, month) {
      return { day, month, daySpent: byDay[day] || 0, monthSpent: byMonth[month] || 0, dailyBudget, monthlyBudget };
    }
    return {
      DETERMINISTIC_TASKS, dailyBudget, monthlyBudget,
      route, estimateCost: (tier, ti, to) => estimateCost(tier, ti, to, rates),
      // Would this spend be allowed? Deterministic 'none' work is always free/allowed.
      canSpend(estCost, day, month) {
        const d = byDay[day] || 0, m = byMonth[month] || 0;
        if (d + estCost > dailyBudget) return { ok: false, reason: 'daily budget ' + dailyBudget + ' would be exceeded' };
        if (m + estCost > monthlyBudget) return { ok: false, reason: 'monthly budget ' + monthlyBudget + ' would be exceeded' };
        const warn = (d + estCost) >= dailyBudget * warnFraction || (m + estCost) >= monthlyBudget * warnFraction;
        return { ok: true, warn, reason: warn ? 'approaching budget' : 'ok' };
      },
      // Record an actual (estimated) spend; throws on hard-stop so runaway usage
      // is impossible. A tier:'none' task records nothing and never throws.
      spend(agent, tier, tokensIn, tokensOut, when) {
        const est = estimateCost(tier, tokensIn, tokensOut, rates);
        if (est === 0) return { spent: 0, blocked: false };
        const day = (when && when.day) || new Date().toISOString().slice(0, 10);
        const month = (when && when.month) || day.slice(0, 7);
        const check = this.canSpend(est, day, month);
        if (!check.ok) throw new Error('he-sales-cost: hard stop — ' + check.reason + ' (agent ' + agent + ')');
        byDay[day] = (byDay[day] || 0) + est;
        byMonth[month] = (byMonth[month] || 0) + est;
        byAgent[agent] = (byAgent[agent] || 0) + est;
        return { spent: est, blocked: false, warn: !!check.warn };
      },
      totals, agentTotals: () => Object.assign({}, byAgent),
    };
  }

  return { route, estimateCost, createLedger, DETERMINISTIC_TASKS, CHEAP_TASKS, STRONG_TASKS, DEFAULT_RATES };
}));
