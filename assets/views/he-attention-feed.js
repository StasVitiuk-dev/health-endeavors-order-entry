// One attention feed (owner request, Nov 23): everything that needs the owner,
// in ONE list, most urgent first, like a chat. It merges what the Home page
// already knows: reminders, tasks, approvals and other items (needs_attention),
// the fixed checks, the nightly check, customer questions waiting for a reply,
// money differences and a tax rate that is due for a re-check.
//
// Each item: { id, kind, level: 'urgent'|'today'|'info', title, detail, when,
//   page, actions: [...], message? }. "urgent" = act now (data that cannot be
//   right, overdue, high priority, a sensitive customer question); "today" =
//   something to do; "info" = worth knowing.
// Snooze is personal and stored in this browser only (a { getItem, setItem }
// adapter); it never changes a record. An item snoozed until tomorrow comes
// back by itself, and comes back at once if it changes (its signature differs).
//
// Pure. Dual-mode (Node require + browser HE.views registry). Never writes.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-attention-feed'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LEVELS = ['urgent', 'today', 'info'];
  const RANK = { urgent: 0, today: 1, info: 2 };
  const KINDS = Object.freeze({
    message: 'Message', task: 'Task', approval: 'Approval', reminder: 'Reminder', check: 'Check',
    nightly: 'Nightly check', money: 'Money', tax: 'Tax', stock: 'Stock', incident: 'Incident', delivery: 'Delivery', agent: 'Agent', other: 'Item' });
  const FILTERS = Object.freeze([
    { key: 'all', label: 'All' }, { key: 'urgent', label: 'Urgent' }, { key: 'message', label: 'Messages' },
    { key: 'work', label: 'Tasks and approvals' }, { key: 'delivery', label: 'Deliveries' }, { key: 'checks', label: 'Checks' }, { key: 'money', label: 'Money and tax' }]);
  const MAX_TEXT = 600;
  const SNOOZE_KEY = 'he_feed_snooze';
  const DAY = 86400000;

  const text = (v, max) => { const s = (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim(); return s.length > (max || MAX_TEXT) ? s.slice(0, (max || MAX_TEXT) - 1) + '…' : s; };
  // a message keeps its line breaks (greeting, paragraphs, signature); only spaces
  // within a line are tidied and very long texts are cut
  const para = (v, max) => { const s = (v == null ? '' : String(v)).replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim(); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
  const time = (v) => { if (v == null || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(String(v)); return isFinite(t) ? t : null; };
  const startOfNextDay = (now) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); };
  // a short fingerprint of a text, so a snooze ends when the text changes without
  // keeping the text itself in this browser
  const fp = (v) => { const t = v == null ? '' : String(v); let x = 5381; for (let i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return t ? x.toString(36) : ''; };
  const asList = (v) => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []);

  // needs_attention rows (tasks, approvals, compliance, incidents, calendar, reminders)
  const NA_KIND = { task: 'task', approval: 'approval', manual: 'reminder', incident: 'incident', alert: 'stock',
    purchase_order: 'stock', quality_check: 'stock', compliance: 'task', privacy_deletion: 'task', calendar_event: 'task' };
  const NA_PAGE = { task: 'tasksPanel', approval: 'approvalsPanel', incident: 'incidentsPanel', purchase_order: 'purchaseOrdersPanel',
    calendar_event: 'calendarPanel', quality_check: 'qualityControlPanel' };
  function fromAttention(rows, now, labels) {
    return asList(rows).map(r => {
      const type = text(r.item_type, 40) || 'other';
      const due = time(r.due_at);
      const overdue = due != null && due < now;
      const dueToday = due != null && due < startOfNextDay(now);
      const level = r.priority === 'high' || overdue ? 'urgent' : (dueToday || due == null) ? 'today' : 'info';
      const kind = NA_KIND[type] || 'other';
      const actions = [];
      if (NA_PAGE[type]) actions.push({ kind: 'open', label: 'Open', page: NA_PAGE[type] });
      if (type === 'manual' && r.source_id) actions.push({ kind: 'dismiss', label: 'Dismiss', id: String(r.source_id) });
      return { id: 'na:' + type + ':' + text(r.source_id, 80), kind: kind, badge: (labels && labels[type]) || KINDS[kind],
        level: level, title: text(r.title, 200) || 'Untitled', detail: text(r.detail), when: due, overdue: overdue,
        page: NA_PAGE[type] || null, actions: actions, signature: [fp(r.title), fp(r.detail), r.due_at, r.priority].join('|') };
    });
  }

  // fixed checks on Home (findings from attentionFindings)
  const CHECK_LEVEL = { critical: 'urgent', unknown: 'today', action: 'today', info: 'info' };
  const CHECK_BADGE = { critical: 'Data problem', unknown: 'Could not check', action: 'To do', info: 'Info' };
  const CHECK_KIND = { negativeStock: 'stock', receivedNotStocked: 'stock', lowStock: 'stock', lateDeliveries: 'stock',
    lowStockNotSet: 'stock', retiredWithStock: 'stock', returnsWaiting: 'stock', duplicatePoExpense: 'money',
    overdueTasks: 'task', pendingApprovals: 'approval', urgentIncidents: 'incident', otherIncidents: 'incident', questionsToReview: 'message' };
  // a summary check is left out when the same things are listed one by one in the feed
  const COVERED_BY = { questionsToReview: 'questions', overdueTasks: 'attention', pendingApprovals: 'attention' };
  function fromChecks(findings, covered) {
    return asList(findings).filter(f => !(COVERED_BY[f.key] && covered && covered[COVERED_BY[f.key]] && f.level !== 'unknown')).map(f => {
      const key = text(f.key, 80);
      const kind = CHECK_KIND[key] || 'check';
      return { id: 'check:' + key, kind: kind, badge: CHECK_BADGE[f.level] || 'Check', level: CHECK_LEVEL[f.level] || 'info',
        title: text(f.title, 200) + (f.count != null ? ': ' + text(f.count, 20) : ''), detail: text(f.action || f.why),
        when: time(f.oldest), page: f.page || null, actions: f.page ? [{ kind: 'open', label: 'Open', page: f.page }] : [],
        signature: [f.level, f.count, f.oldest].join('|') };
    });
  }

  // nightly integrity check results: { state: 'ok'|'problems'|'unknown', problems: [{ key, title, count, page }] }
  function fromNightly(nightly) {
    if (!nightly || typeof nightly !== 'object') return [];
    if (nightly.state === 'unknown') return [{ id: 'nightly:unknown', kind: 'nightly', badge: 'Could not check', level: 'today',
      title: 'The nightly check could not be read', detail: text(nightly.reason) || 'Open Home to see why.', when: null, page: null, actions: [], signature: text(nightly.reason) }];
    return asList(nightly.problems).map(p => ({ id: 'nightly:' + text(p.key, 80), kind: 'nightly', badge: 'Nightly check', level: p.level === 'today' ? 'today' : 'urgent',
      title: text(p.title, 200) + (p.count != null ? ': ' + text(p.count, 20) : ''), detail: text(p.detail),
      when: time(p.at), page: p.page || null, actions: p.page ? [{ kind: 'open', label: 'Open', page: p.page }] : [], signature: String(p.count) }));
  }

  // customer questions waiting for a reply: shown as a chat (the customer's words,
  // and the drafted reply if there is one). Replying is copy + mark answered on the
  // Customer Questions page: nothing is sent from the dashboard.
  function fromQuestions(rows, now) {
    return asList(rows).filter(q => q.id != null && q.status !== 'answered').map(q => {
      const at = time(q.created_at);
      const ageH = at == null ? 0 : (now - at) / 3600000;
      const sensitive = q.sensitive === true || q.severity === 'high';
      const level = sensitive || ageH >= 24 ? 'urgent' : 'today';
      const who = text(q.customer_name, 80) || 'A customer';
      const channel = text(q.channel, 40);
      const actions = [{ kind: 'open', label: 'Answer', page: 'inquiriesPanel' }];
      if (text(q.ai_draft_reply)) actions.unshift({ kind: 'copy', label: 'Copy reply', text: para(q.ai_draft_reply, 4000) });
      return { id: 'q:' + text(q.id, 80), kind: 'message', badge: 'Message', level: level,
        title: who + (channel ? ' · ' + channel : ''), detail: sensitive ? 'Sensitive: check before replying.' : (ageH >= 24 ? 'Waiting more than a day.' : ''),
        when: at, page: 'inquiriesPanel', actions: actions,
        message: { from: who, text: para(q.question_text, 2000), draft: para(q.ai_draft_reply, 4000) || null },
        signature: [q.status, q.severity, fp(q.question_text), fp(q.ai_draft_reply)].join('|') };
    });
  }

  // money differences (open count) and a tax rate due for a re-check
  function fromMoney(money) {
    if (!money || !(Number(money.open) > 0)) return [];
    const n = Number(money.open);
    return [{ id: 'money:open', kind: 'money', badge: 'Money', level: Number(money.urgent) > 0 ? 'urgent' : 'today',
      title: n + (n === 1 ? ' money difference' : ' money differences') + ' to look at', detail: text(money.detail) || 'Payouts or bank lines that do not match.',
      when: time(money.oldest), page: 'accountingPanel', actions: [{ kind: 'open', label: 'Open', page: 'accountingPanel' }], signature: String(n) }];
  }
  function fromTax(tax) {
    // either the rates themselves ([{ place, due }]) or just how many are due ({ count })
    if (tax && !Array.isArray(tax) && typeof tax === 'object') {
      const c = Math.floor(Number(tax.count));
      return c > 0 ? fromTax([{ place: '', count: c }]) : [];
    }
    return asList(tax).map(t => ({ id: 'tax:' + (text(t.place, 80) || 'due'), kind: 'tax', badge: 'Tax', level: 'today',
      title: t.count ? t.count + (t.count === 1 ? ' sales tax rate needs' : ' sales tax rates need') + ' a re-check' : 'Re-check the sales tax rate: ' + text(t.place, 80), detail: 'A January 1 or July 1 passed since it was last checked. New sales stay TAX PENDING until it is re-checked.',
      when: time(t.due), page: 'taxRecordsPanel', actions: [{ kind: 'open', label: 'Open', page: 'taxRecordsPanel' }], signature: text(t.due, 20) + '|' + (t.count || '') }));
  }

  // parcels that need the owner (he-delivery-watch.js), each with the next step and,
  // where it helps, a suggested message to the customer (copied, never sent)
  function fromDelivery(rows) {
    return asList(rows).filter(d => d.id && LEVELS.includes(d.level)).map(d => {
      const actions = [{ kind: 'open', label: 'Open Orders', page: 'ordersPanel' }];
      if (d.customerMessage) actions.unshift({ kind: 'copy', label: 'Copy message', text: para(d.customerMessage, 4000) });
      return { id: 'parcel:' + text(d.id, 80), kind: 'delivery', badge: 'Delivery', level: d.level,
        title: text(d.title, 200) + (d.order ? ' · order #' + text(d.order, 30) : ''),
        detail: text(d.next) + (d.tracking ? ' Tracking ' + text(d.tracking, 40) + '.' : ''),
        when: time(d.since), page: 'ordersPanel', actions: actions,
        suggestion: d.customerMessage ? para(d.customerMessage, 4000) : null,
        signature: [d.status, d.level, d.title].join('|') };
    });
  }

  // steps an agent passed to a person (he-agent-diary.js needsPerson)
  function fromAgents(rows) {
    return asList(rows).filter(e => e.id && e.passedToPerson).map(e => ({
      id: 'agent:' + text(e.id, 80), kind: 'agent', badge: 'Agent', level: 'today',
      title: text(e.agent, 80) + ' passed this to you', detail: text(e.what, 300),
      when: time(e.at), page: 'aiPanel', actions: [{ kind: 'open', label: 'Open AI Agents', page: 'aiPanel' }],
      signature: text(e.what, 80) }));
  }

  function buildFeed(src, now) {
    const s = src || {};
    const t = time(now) != null ? time(now) : Date.now();
    const items = [].concat(
      fromQuestions(s.questions, t), fromAttention(s.attention, t, s.labels),
      fromChecks(s.checks, { questions: Array.isArray(s.questions), attention: Array.isArray(s.attention) }),
      fromNightly(s.nightly), fromMoney(s.money), fromTax(s.tax), fromDelivery(s.delivery), fromAgents(s.agents));
    const seen = new Set();
    const unique = items.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    // most urgent first; within a level, overdue / oldest first, then undated
    unique.sort((a, b) => (RANK[a.level] - RANK[b.level])
      || ((a.when == null) - (b.when == null))
      || ((a.when || 0) - (b.when || 0))
      || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
    return unique;
  }

  function matchesFilter(item, key) {
    switch (key) {
      case 'urgent': return item.level === 'urgent';
      case 'message': return item.kind === 'message';
      case 'work': return ['task', 'approval', 'reminder', 'incident', 'agent'].includes(item.kind);
      case 'checks': return ['check', 'nightly', 'stock'].includes(item.kind) || item.id.indexOf('check:') === 0;
      case 'money': return item.kind === 'money' || item.kind === 'tax';
      case 'delivery': return item.kind === 'delivery';
      default: return true;
    }
  }

  // ---- snooze (this browser only) -------------------------------------------
  function readSnoozes(store) {
    try { const raw = store && store.getItem(SNOOZE_KEY); const v = raw ? JSON.parse(raw) : {}; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    catch (e) { return {}; }
  }
  function writeSnoozes(store, v) { try { if (store) store.setItem(SNOOZE_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function snooze(store, item, now) {
    if (!item || !item.id) return false;
    const v = readSnoozes(store); const t = time(now) != null ? time(now) : Date.now();
    v[item.id] = { until: startOfNextDay(t), sig: String(item.signature || '') };
    // forget snoozes that ended more than a week ago, so the list stays small
    Object.keys(v).forEach(k => { if (!v[k] || !(Number(v[k].until) > t - 7 * DAY)) delete v[k]; });
    return writeSnoozes(store, v);
  }
  function unsnoozeAll(store) { return writeSnoozes(store, {}); }
  function isSnoozed(snoozes, item, now) {
    const s = snoozes && item && snoozes[item.id];
    return !!(s && Number(s.until) > now && String(s.sig) === String(item.signature || ''));
  }

  // what the page shows: the filtered items, the snoozed ones set aside, and counts
  function view(items, opts) {
    const o = opts || {}; const now = time(o.now) != null ? time(o.now) : Date.now();
    const snoozes = o.snoozes || {};
    const all = asList(items);
    const visible = [], snoozed = [];
    all.forEach(i => (isSnoozed(snoozes, i, now) ? snoozed : visible).push(i));
    const counts = { urgent: 0, today: 0, info: 0 };
    visible.forEach(i => { counts[i.level] = (counts[i.level] || 0) + 1; });
    const filter = FILTERS.some(f => f.key === o.filter) ? o.filter : 'all';
    return { items: visible.filter(i => matchesFilter(i, filter)), filter: filter, counts: counts,
      needYou: counts.urgent + counts.today, snoozed: snoozed.length, caughtUp: counts.urgent + counts.today === 0 };
  }

  return { LEVELS, KINDS, FILTERS, SNOOZE_KEY, buildFeed, matchesFilter, view, readSnoozes, snooze, unsnoozeAll, isSnoozed,
    _from: { fromAttention, fromChecks, fromNightly, fromQuestions, fromMoney, fromTax, fromDelivery, fromAgents } };
}));
