// #17 Public intake protections. Pure, synthetic. A defensive request limiter
// for the public intake surfaces (customer / wholesale inquiries, contact
// messages): a per-submitter sliding-window cap plus an optional cooldown, with
// GRACEFUL rejection — an over-limit submission is refused with a clear reason
// and a retry-after, never silently dropped and never a crash. It only decides
// allow/deny; it stores nothing sensitive and sends nothing.
//
// Pure. Dual-mode (Node require + browser HE registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.intake = root.HE.intake || {})['he-intake-guard'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = { windowMs: 60000, maxPerWindow: 5, cooldownMs: 0, maxTracked: 5000 };

  // A submitter key is never trusted content: blank/absent collapses to one
  // shared 'anonymous' bucket (still limited), so a missing id cannot bypass.
  function keyOf(submitterId) {
    const s = String(submitterId == null ? '' : submitterId).trim().toLowerCase().slice(0, 200);
    return s || 'anonymous';
  }

  function createIntakeLimiter(opts) {
    const o = opts || {};
    const windowMs = o.windowMs > 0 ? o.windowMs : DEFAULTS.windowMs;
    const maxPerWindow = o.maxPerWindow > 0 ? o.maxPerWindow : DEFAULTS.maxPerWindow;
    const cooldownMs = o.cooldownMs > 0 ? o.cooldownMs : 0;
    const maxTracked = o.maxTracked > 0 ? o.maxTracked : DEFAULTS.maxTracked;
    const hits = new Map(); // key -> [timestamps within window]

    function prune(list, now) {
      let i = 0; while (i < list.length && list[i] <= now - windowMs) i += 1;
      return i ? list.slice(i) : list;
    }

    // Decide whether a submission is allowed; record it when allowed. Never throws.
    function check(submitterId, nowMs, opts2) {
      const dry = !!(opts2 && opts2.dryRun);
      const now = typeof nowMs === 'number' ? nowMs : Date.now();
      const key = keyOf(submitterId);
      let list = hits.get(key) || [];
      list = prune(list, now);
      const last = list.length ? list[list.length - 1] : null;

      // cooldown: too soon after the previous accepted submission.
      if (cooldownMs && last != null && now - last < cooldownMs) {
        return { allowed: false, reason: 'cooldown — one submission at a time; please wait', retryAfterMs: cooldownMs - (now - last), count: list.length, limit: maxPerWindow };
      }
      // window cap reached.
      if (list.length >= maxPerWindow) {
        const retry = list[0] + windowMs - now;
        return { allowed: false, reason: 'too many submissions — try again shortly', retryAfterMs: retry > 0 ? retry : 0, count: list.length, limit: maxPerWindow };
      }
      if (!dry) {
        list.push(now);
        hits.set(key, list);
        // Bound memory: if we track too many keys, drop the ones with the oldest
        // most-recent hit (they are least likely to be mid-burst).
        if (hits.size > maxTracked) {
          const entries = Array.from(hits.entries()).sort((a, b) => (a[1][a[1].length - 1]) - (b[1][b[1].length - 1]));
          const drop = hits.size - maxTracked;
          for (let i = 0; i < drop; i++) hits.delete(entries[i][0]);
        }
      }
      return { allowed: true, reason: null, retryAfterMs: 0, count: dry ? list.length : list.length, limit: maxPerWindow };
    }

    return {
      check: check,
      // Current count in the window for a submitter (for display/tests). Read-only.
      countFor: function (submitterId, nowMs) { const now = typeof nowMs === 'number' ? nowMs : Date.now(); return prune(hits.get(keyOf(submitterId)) || [], now).length; },
      trackedKeys: function () { return hits.size; },
      reset: function () { hits.clear(); },
      config: { windowMs: windowMs, maxPerWindow: maxPerWindow, cooldownMs: cooldownMs },
    };
  }

  return { DEFAULTS, keyOf, createIntakeLimiter };
}));
