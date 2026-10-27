// Sales & Growth — NEXT-BEST-ACTION v2 (pure, local, advisory).
//
// For a single wholesale lead, recommends the ONE next step the owner should
// take, with a plain reason, whether it needs an owner decision, and a
// confidence. It is a suggestion engine: every action is a label the owner acts
// on by hand. It can never send, approve, reserve, ship, charge, or contact
// anyone — `externalSideEffect` is always false, and a do-not-contact / declined
// lead can only ever be recommended to STOP.
//
// Deterministic: the same lead state always yields the same recommendation, so
// it is testable and explainable. It reads a snapshot (pipeline state + a few
// signals) and returns advice; it mutates nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-nextaction'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Stages from which contact must never be recommended again.
  const NO_CONTACT = new Set(['DECLINED', 'DO_NOT_CONTACT']);
  // Finished stages: nothing to do.
  const DONE = new Set(['CUSTOMER', 'LOST', 'NOT_A_FIT']);

  function rec(action, reason, opts) {
    const o = opts || {};
    return { action, reason,
      ownerDecisionRequired: !!o.ownerDecisionRequired,
      externalSideEffect: false, // always — this engine cannot act
      confidence: o.confidence == null ? 'MEDIUM' : o.confidence,
      alternatives: o.alternatives || [] };
  }

  // Recommend the next step for one lead snapshot.
  // lead: { state, daysInStage, hasReply, replyLabel, sampleEligible }
  function recommend(lead) {
    const l = lead || {};
    const state = l.state || 'NEW';

    // Safety first: a suppressed lead gets exactly one recommendation — stop.
    if (NO_CONTACT.has(state) || l.dnc === true || l.optOut === true) {
      return rec('STOP — do not contact', 'Lead is declined or on the do-not-contact list; all outreach is suppressed', { confidence: 'HIGH' });
    }
    if (DONE.has(state)) {
      return rec('NONE — closed', 'This lead is in a finished stage; no next step', { confidence: 'HIGH' });
    }

    // A reply that reads as an opt-out/complaint routes to suppression review,
    // never to a follow-up.
    if (l.hasReply && (l.replyLabel === 'OPT_OUT' || l.replyLabel === 'COMPLAINT')) {
      return rec('REVIEW — suppress', 'Reply looks like an opt-out/complaint; confirm suppression by hand', { ownerDecisionRequired: true, confidence: 'HIGH' });
    }
    if (l.hasReply && l.replyLabel === 'UNKNOWN') {
      return rec('REVIEW — read reply', 'A reply could not be classified; read it and decide', { ownerDecisionRequired: true, confidence: 'LOW' });
    }

    switch (state) {
      case 'NEW':
      case 'RESEARCHING':
        return rec('QUALIFY', 'Confirm the account is a fit before investing effort', { confidence: 'MEDIUM' });
      case 'QUALIFIED':
        return rec('DRAFT OUTREACH', 'A qualified lead with no outreach yet; draft an intro (claim-checked)', { confidence: 'HIGH' });
      case 'READY_FOR_OUTREACH':
        return rec('DRAFT OUTREACH', 'Ready for outreach; prepare the draft for your review', { confidence: 'HIGH' });
      case 'OUTREACH_DRAFTED':
        return rec('REVIEW & APPROVE DRAFT', 'A draft is waiting; approve it, then send by hand (approve ≠ send)', { ownerDecisionRequired: true, confidence: 'HIGH' });
      case 'OWNER_APPROVED':
        return rec('SEND BY HAND', 'Approved draft ready; you send it manually — the system never sends', { ownerDecisionRequired: true, confidence: 'MEDIUM' });
      case 'CONTACTED':
        return (l.daysInStage != null && l.daysInStage >= 5)
          ? rec('DRAFT FOLLOW-UP', 'No reply after several days; draft a suppression-checked follow-up', { confidence: 'MEDIUM', alternatives: ['WAIT'] })
          : rec('WAIT', 'Recently contacted; give it a few days before following up', { confidence: 'MEDIUM' });
      case 'FOLLOW_UP_DUE':
        return rec('DRAFT FOLLOW-UP', 'A follow-up is due; draft it (suppression-checked)', { confidence: 'HIGH' });
      case 'REPLIED':
        return rec('REVIEW REPLY', 'They replied; read it and decide the next move', { ownerDecisionRequired: true, confidence: 'MEDIUM' });
      case 'NEEDS_INFORMATION':
        return rec('SEND INFO (BY HAND)', 'They asked for information; prepare approved facts and send manually', { ownerDecisionRequired: true, confidence: 'MEDIUM' });
      case 'INTERESTED':
        return l.sampleEligible
          ? rec('CONSIDER SAMPLE', 'Interested and sample-eligible; weigh a sample (owner-approved, budget-checked)', { ownerDecisionRequired: true, confidence: 'MEDIUM', alternatives: ['OPEN WHOLESALE DISCUSSION'] })
          : rec('OPEN WHOLESALE DISCUSSION', 'Interested; move toward terms (wholesale facts must be set first)', { ownerDecisionRequired: true, confidence: 'MEDIUM' });
      case 'NOT_NOW':
        return rec('SCHEDULE FOLLOW-UP', 'Not now; set a later follow-up (suppression-checked)', { confidence: 'LOW' });
      case 'SAMPLE_CONSIDERATION':
        return rec('DECIDE SAMPLE', 'A sample is under consideration; approve or decline (budget-checked)', { ownerDecisionRequired: true, confidence: 'HIGH' });
      case 'SAMPLE_APPROVED':
        return rec('SHIP SAMPLE (BY HAND)', 'Sample approved; you arrange shipping — nothing ships automatically', { ownerDecisionRequired: true, confidence: 'MEDIUM' });
      case 'SAMPLE_SENT':
        return rec('FOLLOW UP ON SAMPLE', 'Sample sent; check in after a reasonable window', { confidence: 'MEDIUM' });
      case 'WHOLESALE_DISCUSSION':
        return rec('ADVANCE TERMS', 'In discussion; progress the wholesale terms (owner-set facts only)', { ownerDecisionRequired: true, confidence: 'MEDIUM' });
      default:
        return rec('REVIEW', 'No specific rule for this stage; review by hand', { confidence: 'LOW' });
    }
  }

  // Recommend for a list; each carries its leadId. Nothing is acted on.
  function recommendAll(leads) {
    const rows = (leads || []).map(l => Object.assign({ leadId: (l && l.id) || null, state: (l && l.state) || 'NEW' }, recommend(l)));
    return { rows, count: rows.length,
      ownerDecisions: rows.filter(r => r.ownerDecisionRequired).length,
      noExternalSideEffects: rows.every(r => r.externalSideEffect === false),
      guard: 'Advisory next-step suggestions only. Sends nothing, approves nothing, ships nothing.' };
  }

  return { NO_CONTACT, DONE, recommend, recommendAll };
}));
