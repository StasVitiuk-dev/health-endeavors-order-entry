// Sales & Growth — follow-up sequence planner (DRAFT ONLY, never sends).
//
// Decides whether a follow-up is DUE and which one. Hard rules (no endless
// nudging, fail closed):
//   * opted-out / declined / bounced / do-not-contact → never;
//   * a reply newer than the last outreach supersedes → never (don't nudge
//     someone who already replied);
//   * at most `maxSequence` follow-ups (default 3);
//   * respect a minimum gap since the last contact.
// Deterministic (dates/counts — no AI). Pure. Dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-followup'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SEQUENCE = ['FIRST_FOLLOW_UP', 'SECOND_FOLLOW_UP', 'FINAL_CLOSE_THE_LOOP'];
  const DAY = 86400000;

  // nextFollowup(state) -> { due, which?, reason }
  // state: { optedOut, declined, bounced, doNotContact, lastContactAt, lastReplyAt,
  //          sequenceSent, now, maxSequence?, minGapDays? }
  function nextFollowup(state) {
    const s = state || {};
    const max = typeof s.maxSequence === 'number' ? s.maxSequence : SEQUENCE.length;
    const minGapDays = typeof s.minGapDays === 'number' ? s.minGapDays : 4;
    const now = s.now != null ? +new Date(s.now) : Date.now();
    const sent = s.sequenceSent || 0;

    if (s.optedOut || s.declined || s.bounced || s.doNotContact) return { due: false, reason: 'suppressed (opt-out / declined / bounced / do-not-contact)' };
    if (!s.lastContactAt) return { due: false, reason: 'no prior contact — nothing to follow up on' };
    // A reply after the last outreach supersedes any pending follow-up.
    if (s.lastReplyAt && +new Date(s.lastReplyAt) >= +new Date(s.lastContactAt)) return { due: false, reason: 'a newer reply supersedes the follow-up' };
    if (sent >= max) return { due: false, reason: 'follow-up cap reached (' + sent + '/' + max + ')' };
    const gapDays = (now - +new Date(s.lastContactAt)) / DAY;
    if (gapDays < minGapDays) return { due: false, reason: 'too soon (' + gapDays.toFixed(1) + 'd < ' + minGapDays + 'd)' };
    return { due: true, which: SEQUENCE[Math.min(sent, SEQUENCE.length - 1)], reason: 'follow-up ' + (sent + 1) + ' of ' + max + ' due' };
  }

  return { nextFollowup, SEQUENCE };
}));
