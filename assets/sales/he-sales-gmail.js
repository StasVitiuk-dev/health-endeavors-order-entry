// Sales & Growth — dedicated B2B sales mailbox: connector CONTRACT + test double.
//
// NO REAL GMAIL is created, connected, authorized, or sent through here. This is
// the architecture only, plus a deterministic synthetic double for tests. The
// three Gmail capabilities are modelled as completely separate switches:
//   READ   — see replies
//   DRAFT  — prepare drafts
//   SEND   — actually send  ← HARD-DISABLED in this program
// The intended future mode is READ + DRAFT with SEND OFF. send() refuses unless
// SEND is explicitly enabled AND the message carries an owner approval record AND
// it is not a duplicate AND the recipient is not suppressed (do-not-contact /
// unsubscribed / bounced). Even with the synthetic double, "sending" only marks a
// record — it never contacts anyone.
//
// Deterministic, no network. Pure. Dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-gmail', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CAPABILITIES = ['read', 'draft', 'send'];
  // The real default for the dashboard: not connected, send OFF.
  const REAL_DEFAULT = { connected: false, capabilities: { read: false, draft: false, send: false } };

  function createMailbox(cfg) {
    const c = cfg || {};
    const cap = Object.assign({ read: false, draft: false, send: false }, c.capabilities);
    const connected = !!c.connected;
    const outbox = new Map();     // key -> record
    const sentKeys = new Set();   // duplicate-send protection
    const suppressed = new Map(); // email -> reason

    const can = k => !!cap[k];
    const normEmail = e => String(e == null ? '' : e).trim().toLowerCase();

    return {
      CAPABILITIES, connected,
      state: connected ? 'CONNECTED' : 'NOT_CONNECTED',
      can,
      suppress(email, reason) { suppressed.set(normEmail(email), reason || 'suppressed'); },
      isSuppressed: email => suppressed.has(normEmail(email)),

      // Prepare a draft (offline, synthetic). Needs the DRAFT capability.
      draft(msg) {
        if (!can('draft')) throw new Error('he-sales-gmail: DRAFT capability is off');
        const m = msg || {};
        const key = m.key || (m.leadId + ':' + (m.subject || ''));
        const rec = { key, leadId: m.leadId, to: normEmail(m.to), threadId: m.threadId || null,
          subject: m.subject, body: m.body, status: 'DRAFT', provenance: m.provenance || 'sales-system', approval: null };
        outbox.set(key, rec);
        return rec;
      },

      // Attach an owner approval to a draft so it is eligible for a future send.
      // Approval != send.
      attachApproval(key, approval) {
        const rec = outbox.get(key);
        if (!rec) throw new Error('he-sales-gmail: no such draft ' + key);
        if (!approval || !approval.owner) throw new Error('he-sales-gmail: approval needs an owner actor');
        rec.approval = { owner: approval.owner, at: approval.at || null, meaning: 'READY_FOR_CONTROLLED_SEND' };
        rec.status = 'APPROVED_FOR_SEND';
        return rec;
      },

      // The send path. In this program it ALWAYS refuses because SEND is off. The
      // guards below are the contract that will protect a future real send.
      send(key) {
        const rec = outbox.get(key);
        if (!rec) throw new Error('he-sales-gmail: no such message ' + key);
        if (!can('send')) throw new Error('he-sales-gmail: SEND is disabled — messages are prepared, never sent');
        if (!connected) throw new Error('he-sales-gmail: mailbox is not connected');
        if (!rec.approval) throw new Error('he-sales-gmail: refusing to send without an owner approval');
        if (this.isSuppressed(rec.to)) throw new Error('he-sales-gmail: recipient is suppressed (do-not-contact/unsubscribe/bounce)');
        if (sentKeys.has(key)) throw new Error('he-sales-gmail: duplicate send blocked for ' + key);
        sentKeys.add(key);
        rec.status = 'SENT';            // synthetic double only — no real email leaves
        return rec;
      },

      // Synthetic inbound handling (test double): record a reply, or a
      // bounce/unsubscribe/OOO that updates suppression.
      receive(inbound) {
        const m = inbound || {};
        const from = normEmail(m.from);
        if (m.kind === 'BOUNCE' || m.kind === 'UNSUBSCRIBE') this.suppress(from, m.kind);
        return { from, threadId: m.threadId || null, kind: m.kind || 'REPLY', body: m.body || '', suppressedNow: this.isSuppressed(from) };
      },

      outboxSize: () => outbox.size,
      get: key => outbox.get(key) || null,
    };
  }

  return { createMailbox, CAPABILITIES, REAL_DEFAULT };
}));
