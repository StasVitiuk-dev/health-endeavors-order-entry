// Sales & Growth — APPROVAL INTEGRITY (pure, local, advisory).
//
// An owner approval must apply to EXACTLY the draft that was approved. If the
// content, recipient, subject, attachments, product facts, or commercial terms
// change after approval, the approval no longer applies and must be re-done.
// This module makes that explicit: it fingerprints the approval-material fields
// of a draft, records an approval against that fingerprint, and later reports
// whether a (possibly edited) draft is still covered.
//
// Three safety facts are baked in, not left to the UI:
//   * APPROVED NEVER MEANS SENT. Every approval record carries sent:false and
//     says so; this module has no send path (B4).
//   * Any change to an approval-material field INVALIDATES the approval (B5).
//   * A confirmed suppression (DNC/opt-out) cannot be approved at all, and an
//     approval can never override it (B3) — isApprovable() refuses.
//
// It is NOT a second permission system: it is the integrity check for the
// existing owner-approval step. It stores nothing and sends nothing.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-approval'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The fields whose change invalidates an approval. Explicit and ordered.
  const APPROVAL_FIELDS = ['kind', 'recipient', 'subject', 'body', 'attachments', 'productFacts', 'commercialTerms'];

  // Canonical, stable serialization (sorted keys) so the fingerprint does not
  // depend on property order or whitespace.
  function canonical(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }

  // FNV-1a 32-bit over the canonical string: deterministic, dependency-free,
  // identical in Node and the browser. Not a security hash — a change detector.
  function fingerprint(draft) {
    const d = draft || {};
    const material = {};
    for (const f of APPROVAL_FIELDS) material[f] = d[f] === undefined ? null : d[f];
    const s = canonical(material);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  // Which approval-material fields differ between two drafts.
  function changedFields(a, b) {
    const out = [];
    for (const f of APPROVAL_FIELDS) {
      if (canonical((a || {})[f] === undefined ? null : a[f]) !== canonical((b || {})[f] === undefined ? null : b[f])) out.push(f);
    }
    return out;
  }

  // A draft is approvable only if it is not blocked: not suppressed (DNC/opt-out)
  // and not carrying a claim-firewall failure. The caller passes those facts in;
  // this module does not re-run them, but it refuses to approve when they say no.
  function isApprovable(draft) {
    const d = draft || {};
    if (d.suppressed === true || d.dnc === true || d.optOut === true) return { ok: false, reason: 'lead is suppressed (DNC/opt-out); cannot be approved' };
    if (d.claimBlocked === true) return { ok: false, reason: 'claim firewall blocked this draft; cannot be approved' };
    return { ok: true };
  }

  // Record an approval against the draft's current fingerprint. Never sent.
  function approve(draft, approver, atISO) {
    const gate = isApprovable(draft);
    if (!gate.ok) return { status: 'REFUSED', sent: false, reason: gate.reason };
    return { status: 'APPROVED', sent: false, // approved is NOT sent
      fingerprint: fingerprint(draft),
      approvedBy: approver || null,
      approvedAt: atISO || null,
      note: 'Approved for the owner to send/act by hand. Approval is not a send, delivery, contact, shipment, or payment.' };
  }

  // Is an approval still valid for the current (possibly edited) draft?
  function check(approval, currentDraft) {
    if (!approval || approval.status !== 'APPROVED') return { valid: false, reason: 'no approval on record' };
    // A suppression that appeared after approval wins (B3): never valid.
    const gate = isApprovable(currentDraft);
    if (!gate.ok) return { valid: false, reason: gate.reason, superseded: true };
    const now = fingerprint(currentDraft);
    if (now !== approval.fingerprint) {
      // We store only the fingerprint, not the old draft, so we report the
      // invalidation itself; callers holding the old draft can use
      // changedFields() to show exactly what changed.
      return { valid: false, reason: 'draft changed since approval — re-approval required', invalidated: true };
    }
    return { valid: true, sent: false, note: 'Approval still applies to this exact draft. Still not sent.' };
  }

  return { APPROVAL_FIELDS, fingerprint, changedFields, isApprovable, approve, check };
}));
