// assets/app/he-ops.js — high-risk operation states: one explicit state per record for
// operations that change stock or money (purchase-order receipt first).
// EXT16: new module (not moved code). It owns no DOM and talks to no database; the
// screen that runs an operation reports what happened, and this module refuses the
// transitions that would be unsafe:
//   * a second send while one is in flight (double click, second handler);
//   * a new send after the result was CONFIRMED (no second receipt);
//   * any send after RESULT_UNKNOWN unless the database step is idempotent
//     (an unknown result is never retried automatically, and a person may only
//     press again when the database itself refuses a duplicate);
//   * leaving RESULT_UNKNOWN except through an explicit read-back check.
// Transitions that are not in the table throw: a bug, never a silent success.
window.HE.modules.define('he-ops', { api: 1, needs: [] }, function () {
  const STATES = ['READY', 'VALIDATING', 'SENDING', 'CONFIRMED', 'FAILED_BEFORE_EFFECT', 'RESULT_UNKNOWN',
    'READBACK_CHECKING', 'RESOLVED', 'CONFLICT', 'SESSION_EXPIRED', 'PERMISSION_DENIED'];
  // from -> allowed next states
  const NEXT = {
    READY: ['VALIDATING', 'SENDING'],
    VALIDATING: ['READY', 'SENDING'],
    SENDING: ['CONFIRMED', 'FAILED_BEFORE_EFFECT', 'RESULT_UNKNOWN', 'CONFLICT', 'SESSION_EXPIRED', 'PERMISSION_DENIED'],
    FAILED_BEFORE_EFFECT: ['READY', 'VALIDATING', 'SENDING'],
    RESULT_UNKNOWN: ['READBACK_CHECKING'],            // + SENDING only for idempotent steps (see begin)
    READBACK_CHECKING: ['RESOLVED', 'RESULT_UNKNOWN', 'CONFLICT'],
    CONFLICT: ['READY'],
    SESSION_EXPIRED: ['READY'],
    PERMISSION_DENIED: ['READY'],
    CONFIRMED: [],                                    // final for this record
    RESOLVED: ['READY'],                              // a read-back said it is safe to start again
  };
  function createOpTracker(name) {
    const rec = new Map(); // key -> { state, idempotent, history: [[from,to,reason]] }
    const get = key => rec.get(key) || { state: 'READY', idempotent: false, history: [] };
    function move(key, to, reason) {
      const r = get(key);
      const ok = NEXT[r.state] && NEXT[r.state].includes(to);
      if (!ok) throw new Error(name + ': refused transition ' + r.state + ' -> ' + to + ' for ' + key);
      const next = { state: to, idempotent: r.idempotent, history: r.history.concat([[r.state, to, reason || '']]).slice(-20) };
      rec.set(key, next);
      return to;
    }
    return {
      name,
      state: key => get(key).state,
      history: key => get(key).history.slice(),
      // Returns true when a send may start now; false (and nothing changes) when it may not.
      begin(key, opts) {
        const r = get(key);
        const idempotent = !!(opts && opts.idempotent);
        // one source of truth: the transition table (found by the mutation run: begin() kept its
        // own list, so a wrong table entry for CONFIRMED went unnoticed)
        const allowed = NEXT[r.state].includes('SENDING')
          || (r.state === 'RESULT_UNKNOWN' && r.idempotent && idempotent);
        if (!allowed) return false;
        rec.set(key, { state: 'SENDING', idempotent, history: r.history.concat([[r.state, 'SENDING', 'begin']]).slice(-20) });
        return true;
      },
      confirmed: (key, why) => move(key, 'CONFIRMED', why),
      failedBeforeEffect: (key, why) => move(key, 'FAILED_BEFORE_EFFECT', why),
      unknown: (key, why) => move(key, 'RESULT_UNKNOWN', why),
      conflict: (key, why) => move(key, 'CONFLICT', why),
      sessionExpired: (key, why) => move(key, 'SESSION_EXPIRED', why),
      permissionDenied: (key, why) => move(key, 'PERMISSION_DENIED', why),
      // An explicit read-back (a person pressed "Check this order now").
      startReadback(key) { return get(key).state === 'RESULT_UNKNOWN' ? move(key, 'READBACK_CHECKING', 'check') : null; },
      // Read-back results are only valid at the end of a read-back (found by the
      // property test: 'still unknown' during a send used to be accepted silently).
      resolved(key, why) { if (get(key).state !== 'READBACK_CHECKING') throw new Error(name + ': resolved outside a read-back for ' + key); return move(key, 'RESOLVED', why); },
      stillUnknown(key, why) { if (get(key).state !== 'READBACK_CHECKING') throw new Error(name + ': still-unknown outside a read-back for ' + key); return move(key, 'RESULT_UNKNOWN', why); },
      // After a conflict / expiry / refusal is shown and the list re-read.
      reset(key, why) { const s = get(key).state; if (NEXT[s] && NEXT[s].includes('READY')) move(key, 'READY', why || 'reset'); return get(key).state; },
      isUnknown: key => get(key).state === 'RESULT_UNKNOWN' && !get(key).idempotent,
      isInFlight: key => ['SENDING', 'READBACK_CHECKING'].includes(get(key).state),
    };
  }
  return { createOpTracker, OP_STATES: STATES, OP_NEXT: NEXT };
});
