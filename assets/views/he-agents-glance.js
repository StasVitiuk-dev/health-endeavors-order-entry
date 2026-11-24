// Agents at a glance (owner, Nov 24: "how am I going to see them working, where
// will I be able to turn them off"). The short list at the top of the AI Agents
// page: every agent on one line with what it is doing now and when it last ran,
// and how many are on, paused, off on purpose, or need a look. It only words what
// the page already knows about each agent; anything unknown stays "unknown".
//
//   bucketOf(truthKey)         -> 'on' | 'paused' | 'off' | 'look'
//   lastRan(iso, nowMs)        -> "12 minutes ago" | "never recorded" | ...
//   summarise(rows)            -> { on, paused, off, look, total, line }
//       rows: [{ num, name, truthKey }]
//
// Pure: no page, no database.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-agents-glance'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // the page's honest states (assets/app/he-agents.js, agentTruth) in four plain groups
  const BUCKETS = Object.freeze({ enabled: 'on', dryrun: 'on', calc: 'on', disabled: 'paused', 'off-intended': 'off', failed: 'look', stale: 'look', unknown: 'look' });
  const WORDS = Object.freeze({ on: 'working', paused: 'paused', off: 'off on purpose', look: 'need a look' });
  function bucketOf(truthKey) { return (typeof truthKey === 'string' && Object.prototype.hasOwnProperty.call(BUCKETS, truthKey)) ? BUCKETS[truthKey] : 'look'; }

  function lastRan(iso, nowMs) {
    const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
    const now = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : Date.now();
    if (isNaN(t)) return 'never recorded';
    const mins = Math.floor((now - t) / 60000);
    if (mins < 0) return 'just now';                       // a clock a little ahead is not a future run
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    const hours = Math.floor(mins / 60);
    if (hours < 48) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    return Math.floor(hours / 24) + ' days ago';
  }

  function summarise(rows) {
    const out = { on: 0, paused: 0, off: 0, look: 0, total: 0 };
    (Array.isArray(rows) ? rows : []).forEach(r => { if (r && typeof r === 'object') { out[bucketOf(r.truthKey)] += 1; out.total += 1; } });
    out.line = ['on', 'paused', 'off', 'look'].filter(k => out[k] > 0).map(k => out[k] + ' ' + (k === 'look' && out[k] === 1 ? 'needs a look' : WORDS[k])).join(' · ') || 'No agents listed.';
    return out;
  }

  return { BUCKETS, WORDS, bucketOf, lastRan, summarise };
}));
