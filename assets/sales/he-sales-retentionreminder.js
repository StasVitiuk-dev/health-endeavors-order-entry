// Sales & Growth — RETENTION reorder-reminder drafts (pure, synthetic).
//
// Builds on he-sales-retention (classification + reorder interval) and
// he-sales-followup (stopping rules) to draft reorder reminders from synthetic
// purchase history. It NEVER messages anyone — it prepares drafts for the owner.
//
// The reorder CADENCE is an EXPLICIT assumption, surfaced on every result:
//   * if the customer's own reorder interval is known, that is the cadence
//     (basis 'customer-interval');
//   * otherwise an explicit default is used (basis 'explicit-default',
//     DEFAULT_CADENCE_DAYS, overridable per call).
//
// Guards (draft-only, nothing sent):
//   * consent / opt-out / DNC / bounced → SUPPRESSED, never drafted;
//   * a recent order (within cadence) → NOT_DUE;
//   * duplicate reminders → a reminder already sent within the cadence is
//     'too soon' (reuses followup min-gap), so no second reminder this cycle;
//   * stopping rule → at most `maxReminders` (default 3); after that STOPPED;
//   * a newer order/reply after the last reminder supersedes a pending one.
//
// Pure. Dual-mode (Node require + browser HE.sales registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-retentionreminder'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Lists come from data: anything that is not a list is treated as empty, and
  // empty rows are dropped, so one bad row cannot crash a whole page.
  const rowsOf = (x) => {
    const a = Array.isArray(x) ? x : ((x && typeof x === 'object' && typeof x[Symbol.iterator] === 'function') ? Array.from(x) : []);
    return a.some(function (r) { return r == null; }) ? a.filter(function (r) { return r != null; }) : a;
  };

  const DEFAULT_CADENCE_DAYS = 45; // explicit assumption when a customer's own interval is unknown
  const DEFAULT_MAX_REMINDERS = 3;

  function asData(text) {
    const s = String(text == null ? '' : text);
    let out = '';
    for (const ch of s) { const c = ch.codePointAt(0);
      out += (c < 0x20 || c === 0x7f || (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029 || c === 0xfeff) ? ' ' : ch; }
    return out.replace(/[ \t]+/g, ' ').trim();
  }

  // Draft one reorder reminder. retentionApi = he-sales-retention, followupApi =
  // he-sales-followup, claims = he-sales-claims — all injected so this is pure.
  // reminderState (optional): { optedOut, declined, bounced, doNotContact,
  //   lastReminderAt, lastOrderAt, remindersSent } — the history of reminders.
  function reminderDraft(req) {
    const r = req || {};
    const retention = r.retention; const followup = r.followup; const claims = r.claims;
    if (!retention || typeof retention.classify !== 'function') throw new Error('he-sales-retentionreminder: inject he-sales-retention');
    if (!followup || typeof followup.nextFollowup !== 'function') throw new Error('he-sales-retentionreminder: inject he-sales-followup');
    if (!claims || typeof claims.scan !== 'function') throw new Error('he-sales-retentionreminder: inject he-sales-claims');
    const c = r.customer || {};
    const asOf = r.asOf;
    const st = r.reminderState || {};
    const cls = retention.classify(c, asOf, r.opts);

    // Cadence is explicit and surfaced: the customer's own interval if known,
    // else the explicit default (overridable).
    const explicitDefault = Number(r.cadenceDays) || DEFAULT_CADENCE_DAYS;
    const cadenceDays = cls.reorderIntervalDays != null ? cls.reorderIntervalDays : explicitDefault;
    const cadenceBasis = cls.reorderIntervalDays != null ? 'customer-interval' : 'explicit-default';
    const base = { id: c.id || null, storeName: c.storeName || null, segment: cls.segment,
      cadenceDays: cadenceDays, cadenceBasis: cadenceBasis, sinceLastDays: cls.sinceLastDays,
      published: false, sent: false, synthetic: true, label: 'SIMULATED' };

    // 1) consent / opt-out / suppression — never drafted.
    if (cls.suppressed === true) return { ...base, status: 'SUPPRESSED', reason: 'consent/opt-out/DNC — not contacted' };

    // 2) no history → nothing to remind about yet.
    if (cls.sinceLastDays == null) return { ...base, status: 'NOT_DUE', reason: 'no order history' };

    // 3) a recent order (within cadence) → not due.
    if (cls.sinceLastDays < cadenceDays) return { ...base, status: 'NOT_DUE', reason: 'ordered recently (' + cls.sinceLastDays + 'd < ' + cadenceDays + 'd cadence)' };

    // 4) reminder-specific opt-out (distinct from the retention suppression above):
    //    a customer who opted out of reminders is never drafted, even the first.
    if (st.optedOut || st.declined || st.bounced || st.doNotContact) return { ...base, status: 'SUPPRESSED', reason: 'opted out of reminders (opt-out / declined / bounced / DNC)' };

    const maxReminders = Number(r.maxReminders) || DEFAULT_MAX_REMINDERS;
    const remindersSent = Number(st.remindersSent) || 0;
    // 5) stopping / duplicate rules. The FIRST reminder (none sent yet) is due now
    //    — the follow-up model's "no prior contact" guard is for replies to prior
    //    outreach, not a first reorder reminder. For SECOND+ reminders, reuse
    //    he-sales-followup for the cap, the minimum gap (= cadence, so no duplicate
    //    reminder within one cycle) and newer-order supersession.
    if (remindersSent > 0) {
      const nowMs = asOf ? +new Date(asOf) : Date.now();
      const fu = followup.nextFollowup({
        optedOut: !!st.optedOut, declined: !!st.declined, bounced: !!st.bounced, doNotContact: !!st.doNotContact,
        lastContactAt: st.lastReminderAt || null,
        lastReplyAt: st.lastOrderAt || null, // a newer order supersedes a pending reminder
        sequenceSent: remindersSent,
        now: nowMs, maxSequence: maxReminders, minGapDays: cadenceDays,
      });
      if (!fu.due) {
        const status = /cap reached/.test(fu.reason) ? 'STOPPED'
          : /too soon/.test(fu.reason) ? 'DUPLICATE'
          : /newer reply|supersed/.test(fu.reason) ? 'SUPERSEDED'
          : /suppressed/.test(fu.reason) ? 'SUPPRESSED' : 'NOT_DUE';
        return { ...base, status: status, reason: fu.reason };
      }
    }

    // 6) compose a claim-clean draft for owner review. Never sent.
    const product = asData(r.product || (c.product) || 'your usual order');
    const text = 'Hi ' + asData(c.storeName || 'there') + ' — it has been about ' + cls.sinceLastDays
      + ' days since your last order of ' + product + '. Ready to restock? (Draft for owner review.)';
    const scan = claims.scan(text);
    if (!scan.ok) return { ...base, status: 'BLOCKED', text: text, claimFindings: scan.findings, reason: 'prohibited claim in reminder wording (fail closed)' };
    return { ...base, status: 'DRAFT', text: text, claimFindings: [], reminderNumber: remindersSent + 1, maxReminders: maxReminders };
  }

  // Plan reminders for many customers. states = { [customerId]: reminderState }.
  function planReminders(customers, asOf, opts, deps) {
    const d = deps || {};
    const states = (opts && opts.states) || {};
    const rows = rowsOf(customers).map(c => reminderDraft({
      customer: c, asOf: asOf, opts: opts, product: opts && opts.product,
      cadenceDays: opts && opts.cadenceDays, maxReminders: opts && opts.maxReminders,
      reminderState: states[c.id] || {}, retention: d.retention, followup: d.followup, claims: d.claims,
    }));
    const by = (s) => rows.filter(x => x.status === s).length;
    return {
      rows: rows,
      counts: { draft: by('DRAFT'), suppressed: by('SUPPRESSED'), notDue: by('NOT_DUE'), duplicate: by('DUPLICATE'), stopped: by('STOPPED'), superseded: by('SUPERSEDED'), blocked: by('BLOCKED') },
      cadenceDefault: (opts && opts.cadenceDays) || DEFAULT_CADENCE_DAYS,
      note: 'SIMULATED — draft reminders for owner review; nothing is sent.',
      published: false, sent: false, synthetic: true, label: 'SIMULATED',
    };
  }

  // Synthetic purchase history covering each guard.
  function fixtures() {
    return {
      asOf: '2026-11-09',
      customers: [
        { id: 'C-DUE', storeName: 'Cedar Day Spa', product: 'Shea Body Butter', orderDates: ['2026-07-01', '2026-08-15', '2026-09-20'] }, // regular cadence, now overdue
        { id: 'C-RECENT', storeName: 'Bloom Beauty Bar', product: 'Sea Foam', orderDates: ['2026-09-01', '2026-10-25', '2026-11-05'] }, // ordered recently
        { id: 'C-OPTOUT', storeName: 'Tide Mercantile', product: 'Shea Body Butter', optOut: true, orderDates: ['2026-06-01', '2026-08-01'] },
        { id: 'C-NEW', storeName: 'Fern Apothecary', product: 'Shea Body Butter', orderDates: [] }, // no history
      ],
    };
  }

  return { DEFAULT_CADENCE_DAYS, DEFAULT_MAX_REMINDERS, asData, reminderDraft, planReminders, fixtures };
}));
