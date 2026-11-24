// Agent diary (owner, Nov 24: "love it"). Every automatic step an agent records in
// the existing log (ai_decision_log: agent, summary, confidence, passed to a person,
// when) shown as a plain diary: who did what and when, grouped by day, filterable
// by agent; and the steps an agent passed to a person become items in the
// attention feed. No database change: it only reads what the agents already write.
//
// Pure. Dual-mode (Node require + browser HE.views registry). Never writes.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-agent-diary'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_ROWS = 500;
  const text = (v, max) => { const s = (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim(); return s.length > (max || 300) ? s.slice(0, (max || 300) - 1) + '…' : s; };
  const time = (v) => { if (v == null || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(String(v)); return isFinite(t) ? t : null; };
  // "shipping_tracking_agent", "Shipping/Tracking Agent", "agent-5" -> comparable words
  const words = (v) => text(v, 120).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bagent\b/g, ' ').replace(/\s+/g, ' ').trim();

  // the agent's name from the registry ({ num, name }), by its key; an unknown key
  // is shown tidied ("pricing_helper_agent" -> "Pricing helper agent")
  function agentName(key, registry) {
    const k = words(key);
    if (!k) return 'Unknown agent';
    const list = Array.isArray(registry) ? registry : [];
    const byWords = list.find(a => a && words(a.name) === k);
    if (byWords) return '#' + String(byWords.num) + ' ' + text(byWords.name, 60);
    const num = /^(?:agent )?(\d{1,2})$/.exec(k);
    const byNum = num ? list.find(x => x && Number(x.num) === Number(num[1])) : null;
    if (byNum) return '#' + String(byNum.num) + ' ' + text(byNum.name, 60);
    const raw = text(key, 60).replace(/[_-]+/g, ' ');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // one diary line per log row, newest first; days in the owner's time zone
  function entries(rows, opts) {
    const o = opts || {};
    const tz = o.timeZone || 'America/Chicago';
    let dayFmt = null, timeFmt = null;
    try {
      dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });
      timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    } catch (e) { dayFmt = null; timeFmt = null; }
    const out = [];
    (Array.isArray(rows) ? rows : []).slice(0, MAX_ROWS).forEach(r => {
      if (!r || typeof r !== 'object') return;
      const at = time(r.created_at);
      if (at == null) return;
      const d = new Date(at);
      const conf = Number(r.confidence);
      out.push({
        id: text(r.id, 80) || String(at),
        agentKey: text(r.agent_key, 80),
        agent: agentName(r.agent_key, o.registry),
        what: text(r.output_summary, 300) || 'Recorded a step (no summary given).',
        passedToPerson: r.escalated_to_human === true,
        confidence: isFinite(conf) && r.confidence != null ? Math.round(Math.max(0, Math.min(1, conf)) * 100) : null,
        at: at,
        day: dayFmt ? dayFmt.format(d) : d.toISOString().slice(0, 10),
        time: timeFmt ? timeFmt.format(d) : d.toISOString().slice(11, 16),
      });
    });
    out.sort((x, y) => y.at - x.at);
    return out;
  }

  // the diary as the page shows it: the agents present (for the filter), and the
  // entries of the chosen agent grouped by day
  function view(list, agentKey) {
    const all = (Array.isArray(list) ? list : []).filter(e => e && typeof e === 'object');   // a broken row is skipped, never a crash
    const agents = [];
    const seen = new Set();
    all.forEach(e => { if (!seen.has(e.agentKey)) { seen.add(e.agentKey); agents.push({ key: e.agentKey, name: e.agent, count: all.filter(x => x.agentKey === e.agentKey).length }); } });
    agents.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    const chosen = agentKey && seen.has(agentKey) ? agentKey : '';
    const shown = chosen ? all.filter(e => e.agentKey === chosen) : all;
    const days = [];
    shown.forEach(e => { const last = days[days.length - 1]; if (last && last.day === e.day) last.entries.push(e); else days.push({ day: e.day, entries: [e] }); });
    return { agents: agents, agent: chosen, days: days, count: shown.length, passedToPerson: shown.filter(e => e.passedToPerson).length };
  }

  // steps an agent passed to a person in the last `days` days: for the feed
  function needsPerson(list, opts) {
    const o = opts || {};
    const now = time(o.now) != null ? time(o.now) : Date.now();
    const since = now - (Number(o.days) > 0 ? Number(o.days) : 7) * 86400000;
    return (Array.isArray(list) ? list : []).filter(e => e && e.passedToPerson && e.at >= since);
  }

  return { MAX_ROWS, agentName, entries, view, needsPerson };
}));
