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
  // `now` says what exists today; `page` is where it lives and `switchKey`/`switchName` the
  // Feature Flags switch that shows that page. None of them runs or sends by itself.
  const PLANNED = Object.freeze([
    { key: 'store_finder', name: 'Store finder', what: 'Builds and scores the list of stores worth contacting.',
      sends: 'Nothing.', now: 'Not running by itself. Built: on Store Campaigns you paste a list of stores and each one gets a score with the reasons. Finding stores by itself needs your own account with a listings service.',
      page: 'storeCampaignsPanel', switchKey: 'he_store_campaigns', switchName: 'Store Campaigns' },
    { key: 'store_outreach', name: 'Store outreach', what: 'Drafts the first email and the follow-ups to a store. You approve the wording once, then choose how many stores and which first.',
      sends: 'Email, only after you approve the wording.', now: 'Not running. Built: on Store Campaigns you write the email, it is checked, you approve it once and see who would get it on which day. Nothing is sent: real sending waits for your approval, a business email address and a database step.',
      page: 'storeCampaignsPanel', switchKey: 'he_store_campaigns', switchName: 'Store Campaigns' },
    { key: 'customer_email', name: 'Customer email', what: 'Drafts campaigns for customers who ordered from you directly: welcome, time to reorder, something new, we miss you.',
      sends: 'Email, only after you approve the wording, and never to people who bought through Amazon, Etsy or TikTok Shop.', now: 'Not running. Built: on Customer Emails you choose the email, approve the wording once and see exactly who would get it. Nothing is sent.',
      page: 'customerEmailsPanel', switchKey: 'he_customer_emails', switchName: 'Customer Emails' },
    { key: 'review_request', name: 'Review request', what: 'A while after an order, drafts a short "how was it" email. It never asks for a good review and offers nothing for one.',
      sends: 'Email, only after you approve the wording.', now: 'Not running. Built: the "How was it?" email on Customer Emails. Nothing is sent.',
      page: 'customerEmailsPanel', switchKey: 'he_customer_emails', switchName: 'Customer Emails' },
    { key: 'receipt_inbox', name: 'Receipt inbox', what: 'Turns a forwarded receipt or a photo into an expense draft for you to check.',
      sends: 'Nothing.', now: 'Not running by itself. Built: on Expenses you can fill an expense in from the text of a receipt, and you check it before saving. Reading forwarded emails is not built.',
      page: 'expensesPanel', switchKey: 'he_receipt_reader', switchName: 'Fill in from a receipt' },
    { key: 'morning_summary', name: 'Morning summary', what: 'One message each morning: what needs you today.',
      sends: 'To you only.', now: 'Not running by itself. Built: on Home, "Copy this as a morning summary" gives you the summary with one press. Sending it to you each morning is not built.',
      page: 'attentionPanel', switchKey: 'he_attention_feed', switchName: 'One attention feed' },
    { key: 'sending_guard', name: 'Sending guard', what: 'Works inside the two email agents: keeps the daily limit and the slow start, never writes to the same store twice within 90 days, removes addresses that bounce, honours every unsubscribe, and stops a campaign by itself if emails come back or are marked as spam.',
      sends: 'Nothing.', now: 'Not running. Its rules are built and tested twice: on the pages (the slow start, who is left out) and as a database draft that is not installed.',
      page: '', switchKey: '', switchName: '' },
    { key: 'content_helper', name: 'Content helper', what: 'Turns one product story into ready drafts: a post, an ad, an email paragraph, a short video and a week\'s plan.',
      sends: 'Nothing. It never posts and never spends money.', now: 'Not running by itself. Built: on the Content Helper page you get several ready drafts in three tones, others on request, your own version and six looks. Every draft passes the health-claim check.',
      page: 'contentHelperPanel', switchKey: 'he_content_helper', switchName: 'Content Helper' },
  ].map(a => Object.freeze(a)));

  function summarise(rows) {
    const out = { on: 0, paused: 0, off: 0, look: 0, total: 0 };
    (Array.isArray(rows) ? rows : []).forEach(r => { if (r && typeof r === 'object') { out[bucketOf(r.truthKey)] += 1; out.total += 1; } });
    out.line = ['on', 'paused', 'off', 'look'].filter(k => out[k] > 0).map(k => out[k] + ' ' + (k === 'look' && out[k] === 1 ? 'needs a look' : WORDS[k])).join(' · ') || 'No agents listed.';
    return out;
  }

  return { BUCKETS, WORDS, PLANNED, bucketOf, lastRan, summarise };
}));
