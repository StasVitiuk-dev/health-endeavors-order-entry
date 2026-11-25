// "Ask the dashboard" (owner, Nov 24: "something like a Siri of my app ... that can tell
// me everything if I forget something, or I can ask any questions"). The owner types or
// talks in the search box; this file works out what was asked and words the answer. The
// page reads the records and shows (and, unless quiet, speaks) what this file returns.
//
//   understand(text, { last })  -> { intent, period, person, title }   what was asked ('none' when not a question it knows)
//   label(asked)                -> the line shown in the search box ("Answer: orders, this week")
//   needs(asked)                -> which records the page must read: 'orders', 'before', 'questions', 'stock', 'launch', 'week', 'activity'
//   periodBounds(period, nowMs) -> { from, to, label, prevFrom, before }   on the viewer's own calendar
//   compose(asked, data)        -> { title, lines: [{ label, value }], say, page, pageName }
//   EXAMPLES                    what a person can ask
//
// It answers a fixed set of kinds of question with exact figures from the records it is
// given. A part that could not be read says so, in the lines and in the spoken sentence;
// it is never worded as zero. No customer's name is ever in an answer: counts only.
// "Remind me to ..." is not answered here: the page opens the existing "New reminder"
// box with the words filled in, and the person presses Add. Pure: no page, no database,
// no microphone.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-ask'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const MAX_TEXT = 300;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PERIODS = Object.freeze({ today: 'today', yesterday: 'yesterday', week: 'this week', lastweek: 'last week', month: 'this month', lastmonth: 'last month' });
  const WITH_PERIOD = ['orders', 'sales', 'did'];
  const EXAMPLES = Object.freeze(['Brief me', 'How many orders this week?', 'How much did we sell yesterday?', 'Is any customer waiting?', 'What is low on stock?',
    'What is left before launch?', 'Read me the weekly report', 'What did everyone do today?', 'Remind me to call the supplier']);
  const clean = (v) => (typeof v === 'string' ? v : '').slice(0, MAX_TEXT).replace(/\s+/g, ' ').trim();
  const plain = (v) => clean(v).toLowerCase().replace(/[’`]/g, '\'').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const nowOf = (nowMs) => (typeof nowMs === 'number' && isFinite(nowMs) && Math.abs(nowMs) < 8.0e15 ? nowMs : Date.now());

  function periodOf(t) {
    if (/\b(last|previous|past) week\b/.test(t)) return 'lastweek';
    if (/\b(last|previous) month\b/.test(t)) return 'lastmonth';
    if (/\bthis week\b|\bso far this week\b|\bthe week\b|\bweek so far\b/.test(t)) return 'week';
    if (/\bthis month\b|\bthe month\b|\bmonth so far\b/.test(t)) return 'month';
    if (/\byesterday\b/.test(t)) return 'yesterday';
    if (/\b(today|so far today|right now|now)\b/.test(t)) return 'today';
    return '';
  }

  function understand(text, context) {
    const raw = clean(text), t = plain(text);
    const last = isObj(context) && isObj(context.last) ? context.last : null;
    const none = { intent: 'none', period: '', person: '', title: '' };
    if (!t) return none;
    // "remind me to call the supplier": the words after it, as they were typed
    let end = raw.length; while (end > 0 && '.!?'.includes(raw.charAt(end - 1))) end -= 1;        // the full stop at the end is not part of the reminder
    const r = /^(?:please )?(?:remind me(?: to| about| that)?|remember to|note to self|add a reminder(?: to| for)?)\s+(.+)$/i.exec(raw.slice(0, end));
    if (r && clean(r[1]).length >= 2) { const words = clean(r[1]); return { intent: 'remind', period: '', person: '', title: words.charAt(0).toUpperCase() + words.slice(1) }; }
    if (/^(help|what can (you|i) (do|ask|say))\b/.test(t)) return { intent: 'help', period: '', person: '', title: '' };
    const period = periodOf(t);
    const asked = (intent, fallback, person) => ({ intent: intent, period: WITH_PERIOD.includes(intent) ? (period || fallback || 'today') : '', person: person || '', title: '' });
    if (/\b(weekly report|week report|last week'?s report|report (for|of) last week)\b/.test(t)) return asked('weekly');
    const who = /\bwhat (?:did|has|have) (.+?) (?:do|done|did)\b/.exec(t);
    if (who || /\bwho did what\b/.test(t)) {
      const name = who ? who[1].replace(/\b(the|my)\b/g, ' ').replace(/\s+/g, ' ').trim() : '';
      return asked('did', 'today', !name || /^(everyone|everybody|people|the team|team|staff|we|they|employees|all)$/.test(name) ? '' : name.slice(0, 60));
    }
    if (/\b(brief me|briefing|brief|what needs me|what do i need|what did i forget|anything i forgot|did i forget|what's up|whats up|how are we doing|good morning|start my day|my day|catch me up|what's new|whats new)\b/.test(t)) return asked('brief');
    if (/\b(customers?|questions?|messages?|inquir\w*|anyone|anybody|someone|somebody|who)\b.*\b(waiting|unanswered|not answered|open|pending)\b/.test(t) || /\b(waiting|unanswered|not answered|pending)\b.*\b(customers?|questions?|messages?|inquir\w*)\b/.test(t) || /\bwaiting for (an |my )?(answer|reply)\b/.test(t)) return asked('waiting');
    if (/\b(low stock|low on stock|running low|run out|running out|out of stock|reorder|re order|stock|inventory)\b/.test(t) && !/\bopen\b/.test(t)) return asked('stock');
    if (/\b(launch|go live|going live)\b/.test(t)) return asked('launch');
    if (/\b(sales|revenue|money|income|earn\w*|how much (did|have) (we|i) (sell|sold|make|made))\b/.test(t)) return asked('sales', 'today');
    if (/\b(how many|number of|count)\b.*\borders?\b/.test(t) || /^orders?\b/.test(t) && period) return asked('orders', 'today');
    // a follow-up: only a period ("and last week?"), asked right after an answer that has one
    if (period && last && WITH_PERIOD.includes(last.intent) && /^(and |what about |how about )?(the )?(so far )?(today|yesterday|this week|last week|previous week|past week|this month|last month|previous month|now)( so far)?$/.test(t)) {
      return { intent: last.intent, period: period, person: typeof last.person === 'string' ? last.person.slice(0, 60) : '', title: '' };
    }
    return none;
  }

  const NAMES = { orders: 'orders', sales: 'sales', waiting: 'customers waiting', stock: 'low stock', launch: 'what is left before launch', weekly: 'the weekly report', brief: 'your briefing', help: 'what you can ask' };
  function label(asked) {
    const a = isObj(asked) ? asked : {};
    if (a.intent === 'remind') return 'Add a reminder: ' + clean(a.title);
    if (a.intent === 'did') return 'Answer: what ' + (a.person ? clean(a.person) : 'everyone') + ' did, ' + (PERIODS[a.period] || 'today');
    if (!NAMES[a.intent]) return '';
    return 'Answer: ' + NAMES[a.intent] + (a.period && PERIODS[a.period] ? ', ' + PERIODS[a.period] : '');
  }

  function needs(asked) {
    const i = isObj(asked) ? asked.intent : '';
    return i === 'orders' || i === 'sales' ? ['orders', 'before'] : i === 'waiting' ? ['questions'] : i === 'stock' ? ['stock'] : i === 'launch' ? ['launch']
      : i === 'weekly' ? ['week'] : i === 'did' ? ['activity'] : i === 'brief' ? ['orders', 'before', 'questions', 'stock', 'launch'] : [];
  }

  // The viewer's own calendar (docs/ops/TIMEZONE_CONTRACT.md); built with calendar dates.
  // prevFrom..from is the period just before it, of the same kind, for "the day/week/month before".
  function periodBounds(period, nowMs) {
    const n = new Date(nowOf(nowMs)), y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
    const sinceMonday = (n.getDay() + 6) % 7;
    const at = (yy, mm, dd) => new Date(yy, mm, dd);
    const day = (x) => MONTHS[x.getMonth()] + ' ' + x.getDate();
    let from, to, prev, text, before;
    if (period === 'yesterday') { from = at(y, m, d - 1); to = at(y, m, d); prev = at(y, m, d - 2); text = 'yesterday'; before = 'The day before'; }
    else if (period === 'week') { from = at(y, m, d - sinceMonday); to = at(y, m, d + 1); prev = at(y, m, d - sinceMonday - 7); text = 'this week (since Monday)'; before = 'Last week (the whole week)'; }
    else if (period === 'lastweek') { from = at(y, m, d - sinceMonday - 7); to = at(y, m, d - sinceMonday); prev = at(y, m, d - sinceMonday - 14); text = 'last week (' + day(from) + ' – ' + day(at(y, m, d - sinceMonday - 1)) + ')'; before = 'The week before'; }
    else if (period === 'month') { from = at(y, m, 1); to = at(y, m, d + 1); prev = at(y, m - 1, 1); text = 'this month'; before = 'Last month (the whole month)'; }
    else if (period === 'lastmonth') { from = at(y, m - 1, 1); to = at(y, m, 1); prev = at(y, m - 2, 1); text = 'last month'; before = 'The month before'; }
    else { from = at(y, m, d); to = at(y, m, d + 1); prev = at(y, m, d - 1); text = 'today'; before = 'Yesterday'; }
    return { period: PERIODS[period] ? period : 'today', from: from.toISOString(), to: to.toISOString(), prevFrom: prev.toISOString(), label: text, before: before };
  }

  // ----- wording -----
  const UNKNOWN = 'could not be read';
  const pad = (n) => String(n).padStart(2, '0');
  const shown = (c, cur) => (cur === 'USD' ? '$' : '') + String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + pad(Math.abs(c) % 100) + (cur === 'USD' ? '' : ' ' + cur);
  const spoken = (c, cur) => { const whole = Math.floor(Math.abs(c) / 100), part = Math.abs(c) % 100; return cur === 'USD' ? count(whole, 'dollar', 'dollars') + (part ? ' and ' + count(part, 'cent', 'cents') : '') : whole + '.' + pad(part) + ' ' + cur; };
  const moneyShown = (rows) => (rows && rows.length ? rows.map(r => shown(r.cents, r.currency)).join(' + ') : shown(0, 'USD'));
  const moneySpoken = (rows) => (rows && rows.length ? rows.map(r => spoken(r.cents, r.currency)).join(' plus ') : 'nothing');
  const out = (title, lines, say, page, pageName) => ({ title: title, lines: lines, say: say, page: page || '', pageName: pageName || '' });

  function salesPart(s, text, said, before) {
    if (!isObj(s) || s.state !== 'ok') return { lines: [{ label: 'Orders, ' + text, value: UNKNOWN }], say: 'I could not read the orders just now.' };
    const lines = [{ label: 'Orders placed, ' + text, value: String(s.orders) }, { label: 'Order totals (tax and shipping included)', value: moneyShown(s.byCurrency) }];
    if (s.notCounted) lines.push({ label: 'Cancelled or refunded (not in the totals)', value: String(s.notCounted) });
    if (isObj(s.before) && s.before.state === 'ok') lines.push({ label: before || 'The period before', value: count(s.before.orders, 'order', 'orders') + ', ' + moneyShown(s.before.byCurrency) });
    const say = s.orders ? count(s.orders, 'order', 'orders') + ' ' + said + ', ' + moneySpoken(s.byCurrency) + '.' + (s.notCounted ? ' ' + s.notCounted + ' cancelled or refunded, not counted in the money.' : '') : 'No orders ' + said + '.';
    return { lines: lines, say: say };
  }
  function waitingPart(q) {
    if (!isObj(q) || q.state !== 'ok' || q.waiting == null) return { lines: [{ label: 'Customers waiting for an answer', value: UNKNOWN }], say: 'I could not read the customer questions just now.' };
    const days = q.oldestDays == null ? '' : q.oldestDays === 0 ? 'less than a day' : count(q.oldestDays, 'day', 'days');
    const lines = [{ label: 'Customers waiting for an answer', value: String(q.waiting) }];
    if (q.waiting && days) lines.push({ label: 'The oldest has waited', value: days });
    return { lines: lines, say: q.waiting ? count(q.waiting, 'customer is', 'customers are') + ' waiting for an answer.' + (days ? ' The oldest has waited ' + days + '.' : '') : 'No customer is waiting.' };
  }
  function stockPart(s) {
    if (!isObj(s) || s.state !== 'ok') return { lines: [{ label: 'Stock', value: UNKNOWN }], say: 'I could not read the stock just now.' };
    const lines = [{ label: 'Products at or under their alert level', value: String(s.lowCount) }];
    s.low.slice(0, 10).forEach(l => lines.push({ label: l.name, value: l.available + ' left, alert at ' + l.level }));
    if (s.noLevel) lines.push({ label: 'Products with no alert level set', value: String(s.noLevel) });
    let say = s.lowCount ? count(s.lowCount, 'product is', 'products are') + ' low on stock: ' + s.low.slice(0, 3).map(l => l.name + ', ' + l.available + ' left').join('; ') + (s.lowCount > 3 ? '; and ' + (s.lowCount - 3) + ' more.' : '.') : 'Nothing is low on stock.';
    if (s.noLevel) say += ' ' + count(s.noLevel, 'product has', 'products have') + ' no alert level, so ' + (s.noLevel === 1 ? 'it' : 'they') + ' can never show as low.';
    return { lines: lines, say: say };
  }
  function launchPart(l) {
    if (!isObj(l) || !Array.isArray(l.lines) || !Number.isInteger(l.ready) || !Number.isInteger(l.total)) return { lines: [{ label: 'Ready to launch', value: UNKNOWN }], say: 'I could not read the launch list just now.' };
    const todo = l.lines.filter(x => isObj(x) && x.state !== 'ready');
    const lines = [{ label: 'Ready to launch', value: l.ready + ' of ' + l.total }];
    todo.slice(0, 14).forEach(x => lines.push({ label: x.state === 'unknown' ? 'Could not check' : 'To do', value: clean(x.title) }));
    const say = todo.length ? l.ready + ' of ' + l.total + ' launch lines are ready. Next: ' + todo.slice(0, 3).map(x => clean(x.title)).join('; ') + (todo.length > 3 ? '; and ' + (todo.length - 3) + ' more.' : '.') : 'All ' + l.total + ' launch lines are ready.';
    return { lines: lines, say: say };
  }

  function compose(asked, data) {
    const a = isObj(asked) ? asked : {}, d = isObj(data) ? data : {};
    const text = isObj(d.bounds) && typeof d.bounds.label === 'string' ? d.bounds.label : (PERIODS[a.period] || 'today');
    const said = PERIODS[a.period] || 'today', before = isObj(d.bounds) && typeof d.bounds.before === 'string' ? d.bounds.before : '';
    if (a.intent === 'orders' || a.intent === 'sales') { const p = salesPart(d.sales, text, said, before); return out((a.intent === 'sales' ? 'Sales, ' : 'Orders, ') + text, p.lines, p.say, 'ordersPanel', 'Orders'); }
    if (a.intent === 'waiting') { const p = waitingPart(d.questions); return out('Customers waiting', p.lines, p.say, 'inquiriesPanel', 'Customer Inquiries'); }
    if (a.intent === 'stock') { const p = stockPart(d.stock); return out('Low stock, right now', p.lines, p.say, 'inventoryPanel', 'Inventory'); }
    if (a.intent === 'launch') { const p = launchPart(d.launch); return out('What is left before launch', p.lines, p.say, d.launchPage ? 'launchPanel' : '', d.launchPage ? 'Ready to launch' : ''); }
    if (a.intent === 'weekly') {
      const w = d.week;
      if (!isObj(w) || !Array.isArray(w.lines) || !w.lines.length) return out('The weekly report', [{ label: 'Weekly report', value: UNKNOWN }], 'I could not read the weekly report just now.', 'backupsPanel', 'Backups & Printouts');
      const lines = w.lines.filter(l => isObj(l)).slice(0, 60).map(l => ({ label: clean(l.label) || clean(l.section), value: clean(l.value) + (l.note ? ' (' + clean(l.note) + ')' : '') }));
      const pick = (name) => { const l = w.lines.find(x => isObj(x) && x.label === name); return l ? clean(l.value) : ''; };
      const bits = [];
      if (pick('Orders placed')) bits.push(pick('Orders placed') + ' orders, totals ' + pick('Order totals (tax and shipping included)'));
      if (pick('New questions in the week')) bits.push(pick('New questions in the week') + ' new customer questions, ' + pick('Waiting for an answer right now') + ' waiting now');
      if (pick('Returns opened')) bits.push(pick('Returns opened') + ' returns opened');
      if (pick('Products at or under their alert level')) bits.push(pick('Products at or under their alert level') + ' products low on stock');
      const missing = w.lines.filter(l => isObj(l) && l.value === UNKNOWN).length;
      return out('Weekly report, ' + clean(w.label), lines, 'The week of ' + clean(w.label).replace(' – ', ' to ') + ': ' + (bits.length ? bits.join('. ') + '.' : 'nothing could be read.') + (missing ? ' ' + count(missing, 'part', 'parts') + ' could not be read.' : ''), 'backupsPanel', 'Backups & Printouts');
    }
    if (a.intent === 'did') {
      const p = d.people, who = clean(a.person);
      if (!isObj(p) || p.state !== 'ok') return out('What ' + (who || 'everyone') + ' did, ' + text, [{ label: 'Recorded changes', value: UNKNOWN }], 'I could not read the activity just now.', 'activityPanel', 'Employee Activity');
      const rows = who ? p.rows.filter(r => clean(r.name).toLowerCase().includes(who.toLowerCase())) : p.rows;
      const lines = rows.slice(0, 20).map(r => ({ label: clean(r.name) + (r.account ? ' · #' + clean(r.account) : ''), value: count(r.actions, 'change', 'changes') }));
      if (!rows.length) lines.push({ label: who ? 'Nobody with that name made a recorded change' : 'Recorded changes', value: '0' });
      const say = rows.length ? rows.slice(0, 4).map(r => clean(r.name) + ', ' + count(r.actions, 'recorded change', 'recorded changes')).join('; ') + ' ' + said + '.' + (p.capped ? ' The list was too long to read to the end, so these are at least.' : '')
        : (who ? 'I found no recorded change by ' + who + ' ' + said + '.' : 'Nobody made a recorded change ' + said + '.');
      return out('What ' + (who || 'everyone') + ' did, ' + text, lines, say, 'activityPanel', 'Employee Activity');
    }
    if (a.intent === 'brief') {
      const parts = [salesPart(d.sales, 'today', 'today', 'Yesterday'), waitingPart(d.questions), stockPart(d.stock)];
      if (d.launch !== undefined) parts.push(launchPart(d.launch));
      const lines = [].concat.apply([], parts.map(p => p.lines));
      const feed = clean(d.feedSummary);
      if (feed) lines.unshift({ label: 'On Home', value: feed });
      return out('Your briefing', lines, (feed ? feed.replace(/ · /g, ': ') + '. ' : '') + parts.map(p => p.say).join(' '), 'attentionPanel', 'Home');
    }
    if (a.intent === 'help') return out('What you can ask', EXAMPLES.map(e => ({ label: e, value: '' })), 'You can ask about orders, sales, customers waiting, low stock, what is left before launch, the weekly report, or what someone did. Or say: remind me to, and what to remember.', '', '');
    return null;
  }

  return { PERIODS, EXAMPLES, understand, label, needs, periodBounds, compose };
}));
