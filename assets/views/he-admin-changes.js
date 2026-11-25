// What administrators changed, told to the owner on Home (owner, Nov 24: an administrator is
// "almost like owner", and the owner is told what an administrator did). Reads the existing
// change history (the employee_activity function, the same one the Employee Activity page
// uses); writes nothing. Only the owner sees it; the owner marks it seen, in this browser.
//
//   summarize(rows, seenUpTo) -> { total, people, newest, deletes, accounts }
//   sentence(summary)         -> one plain line for Home
//
// Pure: no page, no database. Dual-mode (Node + HE.views).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-admin-changes'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROLES = Object.freeze(['administrator']);      // whose changes the owner is told about
  const ACCOUNT_TABLES = Object.freeze(['profiles']);   // a change to someone's account is named on its own
  const MAX_AREAS = 4, MAX_PEOPLE = 6;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = (v, max) => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, max);
  const when = (v) => { const t = typeof v === 'number' ? v : Date.parse(text(v, 40)); return isFinite(t) ? t : NaN; };

  // rows: employee_activity rows; seenUpTo: a time in ms (changes at or before it were seen)
  function summarize(rows, seenUpTo) {
    const seen = Number(seenUpTo), by = new Map();
    let total = 0, newest = 0, deletes = 0, accounts = 0;
    (Array.isArray(rows) ? rows : []).slice(0, 5000).forEach(r => {
      if (!isObj(r) || !ROLES.includes(text(r.person_role, 20))) return;
      const t = when(r.happened_at); if (!isFinite(t)) return;
      if (isFinite(seen) && t <= seen) return;
      const key = text(r.person_account_number, 20) || text(r.person_id, 60) || text(r.person_name, 80) || '?';
      const p = by.get(key) || { name: text(r.person_name, 80) || 'An administrator', account: text(r.person_account_number, 20), count: 0, areas: new Map(), deletes: 0, accounts: 0 };
      const area = text(r.area, 60) || text(r.table_name, 60) || 'Other';
      p.count += 1; p.areas.set(area, (p.areas.get(area) || 0) + 1);
      if (text(r.action, 10) === 'DELETE') { p.deletes += 1; deletes += 1; }
      if (ACCOUNT_TABLES.includes(text(r.table_name, 60))) { p.accounts += 1; accounts += 1; }
      by.set(key, p);
      total += 1; if (t > newest) newest = t;
    });
    const people = [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, MAX_PEOPLE).map(p => ({
      name: p.name, account: p.account, count: p.count, deletes: p.deletes, accounts: p.accounts,
      areas: [...p.areas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_AREAS) }));
    return { total, people, newest, deletes, accounts, morePeople: Math.max(0, by.size - MAX_PEOPLE) };
  }

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  // one line per person: "Sam: Orders 5, Tasks 2 · 1 account changed · 1 deletion"
  function personLine(p) {
    if (!isObj(p)) return '';
    const areas = Array.isArray(p.areas) ? p.areas.filter(a => Array.isArray(a)) : [];
    const parts = [areas.map(a => text(String(a[0]), 60) + ' ' + (Number(a[1]) || 0)).join(', ')];
    if (p.accounts) parts.push(plural(p.accounts, 'account change'));
    if (p.deletes) parts.push(plural(p.deletes, 'deletion'));
    return (text(p.name, 80) || 'An administrator') + ': ' + parts.join(' · ');
  }
  function sentence(s, capped) {
    if (!isObj(s) || !s.total) return 'No changes by administrators since you last looked.';
    return plural(s.total, 'change') + (capped ? ' or more' : '') + ' by ' + (s.people.length + s.morePeople === 1 ? 'an administrator' : 'administrators') + ' since you last looked.';
  }

  return { ROLES, summarize, personLine, sentence };
}));
