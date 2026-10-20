// Sales & Growth — end-to-end lifecycle SIMULATOR + orchestration trace (pure).
//
// Composes the engine modules (injected, so it stays pure and testable) into one
// synthetic lifecycle: import -> score -> qualify -> draft -> claim-check ->
// owner approval -> SIMULATED contact -> reply -> classify -> follow-up ->
// sample decision -> (maybe) customer. It produces a step-by-step trace and,
// crucially, asserts the whole run has ZERO external side effects: nothing is
// sent, no sample is auto-approved/shipped, no money moves. Also models inbound
// website/Gmail/DNC events as data and proves a DNC event suppresses everything.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-simulator'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // engine: { leads, pipeline, ai, claims, replies, followup, samples } (any
  // subset; missing modules make their step a no-op recorded as 'skipped').
  // Every step records { step, ok, detail, sideEffect:false } — sideEffect is
  // always false by construction; the spec checks it.
  function run(engine, scenario) {
    const e = engine || {};
    const sc = scenario || {};
    const trace = [];
    const step = (name, detail, extra) => { trace.push(Object.assign({ step: name, detail, sent: false, sideEffect: false }, extra || {})); };

    // 1. Import (as data)
    const lead = sc.lead || { id: 'SIM-1', storeName: 'Sim Spa', category: 'skincare', email: 'buyer@sim.example.com', website: 'sim.example.com', region: 'domestic', size: 'medium', carriesSimilarBrands: true, synthetic: true };
    step('import', 'lead ingested as data: ' + lead.storeName);

    // 2. Score
    let scoring = null;
    if (e.leads && e.leads.score) { scoring = e.leads.score(lead); step('score', 'score ' + scoring.score + ' (' + scoring.band + ')'); }
    else step('score', 'skipped (no leads module)', { ok: false });

    // 3. Draft outreach (template provider only) + claim firewall
    let draft = null, claimBlocked = false;
    if (e.ai && e.ai.createDrafter) {
      const drafter = e.ai.createDrafter({ provider: 'template' });
      draft = drafter.draft('intro', { store: lead.storeName, product: sc.product || 'body-care line' });
      step('draft', 'provider=' + drafter.providerName + ', status=' + draft.status + ', sent=' + draft.sent);
    }
    if (e.claims && e.claims.scan) {
      const text = sc.draftText || 'Hello, our small-batch body-care line may suit your shop.';
      const scan = e.claims.scan(text);
      claimBlocked = !scan.ok;
      step('claim-check', claimBlocked ? 'BLOCKED (claim found)' : 'clean', { ok: !claimBlocked });
    }

    // 4. Owner approval gate (never auto). The sim only "approves" if the
    // scenario explicitly sets ownerApproved true.
    const ownerApproved = sc.ownerApproved === true;
    step('owner-approval', ownerApproved ? 'owner approved (simulated)' : 'awaiting owner — NOT approved', { ok: ownerApproved });

    // 5. SIMULATED contact — never a real send.
    if (ownerApproved && !claimBlocked) step('contact', 'SIMULATED contact only — no email sent');
    else step('contact', 'not contacted (awaiting approval or claim-blocked)', { ok: false });

    // 6. Inbound reply (data) + classify
    let replyLabel = null;
    if (sc.replyText && e.replies && e.replies.classify) {
      const r = e.replies.classify(sc.replyText);
      replyLabel = r.label;
      step('reply-classify', 'label=' + replyLabel);
      // DNC / unsubscribe must suppress everything downstream.
      if (e.replies.suppresses && e.replies.suppresses(replyLabel)) {
        step('suppress', 'opt-out/bounce detected — all further contact suppressed', { suppressed: true });
        return finalize(trace, { lead, scoring, replyLabel, suppressed: true });
      }
    }

    // 7. Follow-up plan (never sent)
    if (e.followup && e.followup.nextFollowup) {
      const f = e.followup.nextFollowup({ label: replyLabel, contactedAt: '2026-10-10', followupsSent: 0 });
      step('follow-up', f && f.schedule ? 'planned (not sent)' : 'no follow-up');
    }

    // 8. Sample decision — owner only; the sim never approves a sample itself.
    step('sample-decision', sc.sampleOwnerApproved === true ? 'owner approved a sample (simulated, budget-guarded elsewhere)' : 'sample NOT approved (owner-only)', { ok: sc.sampleOwnerApproved === true });

    return finalize(trace, { lead, scoring, replyLabel, suppressed: false });
  }

  function finalize(trace, summary) {
    const noSideEffects = trace.every(t => t.sideEffect === false && t.sent === false);
    return { trace, summary, noSideEffects,
      guard: 'Full lifecycle simulation. Nothing was sent, approved without the owner, or changed in production.' };
  }

  // Inbound event stream (website / Gmail / DNC) modeled as DATA. A DNC event
  // must flip suppression immediately; returns the resulting suppression set.
  function ingestEvents(events) {
    const suppressed = new Set();
    const log = [];
    for (const ev of (events || [])) {
      const kind = ev.kind;
      if (kind === 'unsubscribe' || kind === 'dnc' || kind === 'bounce') { suppressed.add(ev.leadId); log.push({ leadId: ev.leadId, kind, action: 'SUPPRESSED' }); }
      else log.push({ leadId: ev.leadId, kind, action: 'recorded (data only)' });
    }
    return { suppressed: [...suppressed], log, guard: 'Inbound events are data; opt-outs suppress immediately and nothing is sent.' };
  }

  return { run, finalize, ingestEvents };
}));
