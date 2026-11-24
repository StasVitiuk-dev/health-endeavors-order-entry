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
//   PLANNED                    -> the agents the owner approved on Nov 24 that do not run yet
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

  // Approved by the owner on Nov 24 ("let's add them as well"). None of these runs or
  // sends anything yet: the list says honestly what exists today. An agent moves from
  // here to the real list above only when it really runs.
  const PLANNED = Object.freeze([
    { key: 'store_finder', name: 'Store finder', what: 'Builds and scores the list of stores worth contacting.',
      sends: 'Nothing.', now: 'Not running. Lead and scoring pages exist on example data (Sales & Growth). Needs a source of real store data.' },
    { key: 'store_outreach', name: 'Store outreach', what: 'Drafts the first email and the follow-ups to a store. You approve the wording once, then choose how many stores and which first.',
      sends: 'Email, only after you approve the wording.', now: 'Not running. Draft pages exist on example data (Outreach Studio). Real sending is not built.' },
    { key: 'customer_email', name: 'Customer email', what: 'Drafts campaigns for customers who ordered or subscribed: welcome, time to reorder, new product, win-back.',
      sends: 'Email, only after you approve the wording, and only to people who ordered or subscribed.', now: 'Not running. Reorder reminder drafts exist on example data.' },
    { key: 'review_request', name: 'Review request', what: 'A few days after delivery, drafts a short "how was it" email.',
      sends: 'Email, only after you approve the wording.', now: 'Not built yet.' },
    { key: 'receipt_inbox', name: 'Receipt inbox', what: 'Turns a forwarded receipt or a photo into an expense draft for you to check.',
      sends: 'Nothing.', now: 'Not built yet. An expense can already carry a photo of its receipt.' },
    { key: 'morning_summary', name: 'Morning summary', what: 'One message each morning: what needs you today.',
      sends: 'To you only.', now: 'Not built yet. Home already lists what needs you.' },
    { key: 'sending_guard', name: 'Sending guard', what: 'Works inside the two email agents: keeps the daily limit and the slow start, never writes to the same store twice within 90 days, removes addresses that bounce, honours every unsubscribe, and stops a campaign by itself if emails come back or are marked as spam.',
      sends: 'Nothing.', now: 'Not running. Its rules are built and tested (Store Campaigns shows the slow start and who is left out).' },
    { key: 'content_helper', name: 'Content helper', what: 'Turns one product story into post, ad and email drafts.',
      sends: 'Nothing. It never posts and never spends money.', now: 'Not running. Draft pages exist on example data (Content Planner, Ad Variants, Content Repurposing).' },
  ].map(a => Object.freeze(a)));

  function summarise(rows) {
    const out = { on: 0, paused: 0, off: 0, look: 0, total: 0 };
    (Array.isArray(rows) ? rows : []).forEach(r => { if (r && typeof r === 'object') { out[bucketOf(r.truthKey)] += 1; out.total += 1; } });
    out.line = ['on', 'paused', 'off', 'look'].filter(k => out[k] > 0).map(k => out[k] + ' ' + (k === 'look' && out[k] === 1 ? 'needs a look' : WORDS[k])).join(' · ') || 'No agents listed.';
    return out;
  }

  return { BUCKETS, WORDS, PLANNED, bucketOf, lastRan, summarise };
}));
