// Sales & Growth — wholesale lead pipeline as an explicit state machine.
//
// Same discipline as the high-risk operation machine (he-ops): ONE explicit table
// of allowed transitions; anything not in the table throws (a bug, never a silent
// wrong move). Three safety rules are enforced in the machine itself, not left to
// the UI:
//   * a lead that is DECLINED or DO_NOT_CONTACT can never be contacted again;
//   * advancing a drafted outreach to OWNER_APPROVED requires explicit owner
//     approval (opts.ownerApproved === true);
//   * advancing a sample to SAMPLE_APPROVED requires explicit owner approval too.
// AI/code may propose; only the owner approves. Moving a card NEVER sends anything.
//
// Pure: no DOM, no network. Dual-mode (Node require + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-pipeline', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATES = ['NEW', 'RESEARCHING', 'QUALIFIED', 'NOT_A_FIT', 'READY_FOR_OUTREACH',
    'OUTREACH_DRAFTED', 'OWNER_APPROVED', 'CONTACTED', 'FOLLOW_UP_DUE', 'REPLIED',
    'INTERESTED', 'NEEDS_INFORMATION', 'NOT_NOW', 'DECLINED', 'SAMPLE_CONSIDERATION',
    'SAMPLE_APPROVED', 'SAMPLE_SENT', 'WHOLESALE_DISCUSSION', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT'];

  // from -> allowed next states.
  const NEXT = {
    NEW: ['RESEARCHING', 'QUALIFIED', 'NOT_A_FIT', 'LOST', 'DO_NOT_CONTACT'],
    RESEARCHING: ['QUALIFIED', 'NOT_A_FIT', 'LOST', 'DO_NOT_CONTACT'],
    QUALIFIED: ['READY_FOR_OUTREACH', 'NOT_A_FIT', 'LOST', 'DO_NOT_CONTACT'],
    NOT_A_FIT: ['QUALIFIED', 'LOST'],                 // owner may reconsider
    READY_FOR_OUTREACH: ['OUTREACH_DRAFTED', 'LOST', 'DO_NOT_CONTACT'],
    OUTREACH_DRAFTED: ['OWNER_APPROVED', 'READY_FOR_OUTREACH', 'LOST', 'DO_NOT_CONTACT'],
    OWNER_APPROVED: ['CONTACTED', 'LOST', 'DO_NOT_CONTACT'],   // CONTACTED = after a manual/controlled send
    CONTACTED: ['REPLIED', 'FOLLOW_UP_DUE', 'DECLINED', 'DO_NOT_CONTACT', 'LOST'],
    FOLLOW_UP_DUE: ['OUTREACH_DRAFTED', 'REPLIED', 'NOT_NOW', 'DECLINED', 'DO_NOT_CONTACT', 'LOST'],
    REPLIED: ['INTERESTED', 'NEEDS_INFORMATION', 'NOT_NOW', 'DECLINED', 'DO_NOT_CONTACT'],
    NEEDS_INFORMATION: ['INTERESTED', 'NOT_NOW', 'DECLINED', 'DO_NOT_CONTACT', 'LOST'],
    INTERESTED: ['SAMPLE_CONSIDERATION', 'WHOLESALE_DISCUSSION', 'NOT_NOW', 'LOST', 'DO_NOT_CONTACT'],
    NOT_NOW: ['FOLLOW_UP_DUE', 'LOST', 'DO_NOT_CONTACT'],
    DECLINED: ['DO_NOT_CONTACT', 'LOST'],             // near-terminal; may escalate to DNC
    SAMPLE_CONSIDERATION: ['SAMPLE_APPROVED', 'INTERESTED', 'WHOLESALE_DISCUSSION', 'LOST', 'DO_NOT_CONTACT'],
    SAMPLE_APPROVED: ['SAMPLE_SENT', 'LOST'],
    SAMPLE_SENT: ['WHOLESALE_DISCUSSION', 'CUSTOMER', 'NOT_NOW', 'LOST'],
    WHOLESALE_DISCUSSION: ['CUSTOMER', 'SAMPLE_CONSIDERATION', 'NOT_NOW', 'LOST', 'DO_NOT_CONTACT'],
    CUSTOMER: [],                                     // terminal (won)
    LOST: [],                                         // terminal
    DO_NOT_CONTACT: [],                               // terminal — reversing needs explicit owner authorization
  };

  // Transitions that only the owner may authorise (AI/code can never do them alone).
  const OWNER_APPROVAL_REQUIRED = new Set(['OWNER_APPROVED', 'SAMPLE_APPROVED']);
  // States from which a lead must never be contacted again.
  const DO_NOT_CONTACT_STATES = new Set(['DECLINED', 'DO_NOT_CONTACT']);

  function createPipeline() {
    const rec = new Map(); // key -> { state, history: [[from,to,reason,actor]] }
    const get = key => rec.get(key) || { state: 'NEW', history: [] };

    function move(key, to, reason, opts) {
      const r = get(key);
      if (!(NEXT[r.state] && NEXT[r.state].includes(to))) {
        throw new Error('he-sales-pipeline: refused transition ' + r.state + ' -> ' + to + ' for ' + key);
      }
      if (OWNER_APPROVAL_REQUIRED.has(to) && !(opts && opts.ownerApproved === true)) {
        throw new Error('he-sales-pipeline: ' + to + ' requires explicit owner approval (opts.ownerApproved===true) for ' + key);
      }
      const actor = (opts && opts.actor) || (OWNER_APPROVAL_REQUIRED.has(to) ? 'owner' : 'system');
      const next = { state: to, history: r.history.concat([[r.state, to, reason || '', actor]]).slice(-100) };
      rec.set(key, next);
      return to;
    }

    return {
      states: STATES,
      state: key => get(key).state,
      history: key => get(key).history.slice(),
      move,
      canContact: key => !DO_NOT_CONTACT_STATES.has(get(key).state),
      isTerminal: key => (NEXT[get(key).state] || []).length === 0,
    };
  }

  return { createPipeline, PIPELINE_STATES: STATES, PIPELINE_NEXT: NEXT, OWNER_APPROVAL_REQUIRED, DO_NOT_CONTACT_STATES };
}));
