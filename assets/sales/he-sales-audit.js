// Sales & Growth — AUDIT TRAIL (pure, local, advisory).
//
// Records the lifecycle of a lead's handling as an append-only trail whose
// entries are explicitly typed by STAGE, so audit evidence always distinguishes
// a machine SUGGESTION from a human REVIEW from an owner APPROVAL from a
// SIMULATED_OUTCOME (Reserve IV Wave H9). Nothing in the trail is a real
// external action: every entry carries externalSideEffect:false, and there is
// no SENT/SHIPPED/CHARGED stage at all.
//
// The trail is append-only: record() returns a new frozen entry and there is no
// edit or delete path, so earlier evidence cannot be rewritten. Timestamps are
// supplied by the caller (no hidden clock) so the trail is deterministic and
// testable. It stores nothing beyond the in-memory trail and sends nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-audit'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The lifecycle, in order. An APPROVAL should not precede the REVIEW that
  // should not precede the SUGGESTION; lifecycleOrderOk() checks that.
  const STAGES = ['SUGGESTION', 'REVIEW', 'APPROVAL', 'SIMULATED_OUTCOME'];
  const STAGE_RANK = {}; STAGES.forEach((s, i) => { STAGE_RANK[s] = i; });

  function createTrail() {
    const entries = [];
    let seq = 0;

    // Append one typed evidence entry. Throws on an unknown stage (a bug, never
    // a silent mislabel). Returns the frozen entry.
    function record(stage, info) {
      if (STAGE_RANK[stage] == null) throw new Error('audit: unknown stage "' + stage + '"');
      const i = info || {};
      const entry = Object.freeze({
        seq: seq++,
        stage,
        leadId: i.leadId || null,
        actor: i.actor || (stage === 'SUGGESTION' ? 'engine' : stage === 'APPROVAL' ? 'owner' : null),
        detail: i.detail || '',
        fingerprint: i.fingerprint || null,  // for APPROVAL entries: the approved draft's fingerprint
        at: i.at || null,
        externalSideEffect: false,           // always — the trail records advice/simulation only
      });
      entries.push(entry);
      return entry;
    }

    function all() { return entries.slice(); }
    function forLead(leadId) { return entries.filter(e => e.leadId === leadId); }

    function summary() {
      const counts = {}; for (const s of STAGES) counts[s] = 0;
      for (const e of entries) counts[e.stage] += 1;
      return { total: entries.length, counts,
        noExternalSideEffects: entries.every(e => e.externalSideEffect === false) };
    }

    // A lead's evidence is coherent when its stages never go backwards in the
    // lifecycle (e.g. no APPROVAL logged before any SUGGESTION/REVIEW). Repeats
    // of the same stage are allowed (e.g. several suggestions).
    function lifecycleOrderOk(leadId) {
      const seqs = forLead(leadId);
      let maxRank = -1;
      for (const e of seqs) {
        const r = STAGE_RANK[e.stage];
        if (r < maxRank) return false;
        maxRank = Math.max(maxRank, r);
      }
      return true;
    }

    return { record, all, forLead, summary, lifecycleOrderOk,
      guard: 'Append-only synthetic audit trail. Records suggestion/review/approval/simulated outcome; never a real send, shipment, or charge.' };
  }

  return { STAGES, STAGE_RANK, createTrail };
}));
