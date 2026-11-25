// People and their accounts — the rules behind the "New Employee" page (owner,
// Nov 24: the owner, administrators and managers create an account with a button;
// the new person gets a work email and types their own password; nobody else ever
// knows it). The owner's decisions this file keeps:
//
//   * Four roles, highest first: owner, administrator, manager, employee.
//   * A person creates and manages only accounts BELOW their own level.
//   * Nobody creates an owner, and nobody changes or deactivates an owner's account.
//   * Nobody manages their own account from this page.
//
//   canOpen(role)                         -> who sees the page
//   assignable(actorRole)                 -> the roles this person may give
//   canManage(actor, target)              -> { ok, reason }
//   checkNew(form, actorRole, opts)       -> { ok, problems, value }
//   checkPassword(pw, again, about)       -> { ok, problems }
//   tempPassword(bytes)                   -> 'Abcd-EFgh-2345-jkmn' (for someone not in the room)
//   workCounts(rows, when)                -> { [person]: { today, week } }
//   listView(people, actor, counts)       -> rows for the page, with what may be done to each
//   friendlyError(err)                    -> one plain sentence
//
// Pure: no page, no database, no network. The page and the database enforce the
// same rules again; this file is what the page shows and checks before asking.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-people'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROLES = Object.freeze(['owner', 'administrator', 'manager', 'employee']);       // highest first
  const RANK = Object.freeze({ owner: 4, administrator: 3, manager: 2, employee: 1 });
  const ROLE_WORD = Object.freeze({ owner: 'Owner', administrator: 'Administrator', manager: 'Manager', employee: 'Employee' });
  // one short line under each role, so whoever creates the account sees what it means
  const ROLE_LINE = Object.freeze({
    owner: 'Everything, including switching the whole system off. Cannot be given from this page.',
    administrator: 'Almost everything the owner can: approvals, money pages, switches, backups, adding managers and employees. Not the system switch, not the owner\'s accounts.',
    manager: 'Runs the daily work and adds employees. No money approvals, no switches, no backups.',
    employee: 'The daily work pages only: orders, stock, tasks. No money pages, no settings.' });
  const NAME_MIN = 2, NAME_MAX = 80, EMAIL_MAX = 254, DEPT_MAX = 60;
  const PW_MIN = 10, PW_MAX = 72;                 // 72: the longest a password can usefully be where it is kept
  const EMAIL = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';   // 56 characters: no 0/O/o, no 1/l/I
  const text = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\s+/g, ' ').trim().slice(0, max || 400);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const rank = (role) => (Object.prototype.hasOwnProperty.call(RANK, role) ? RANK[role] : 0);

  function canOpen(role) { return rank(role) >= RANK.manager; }

  // the roles this person may give: every role strictly below their own, never owner
  function assignable(actorRole) {
    const r = rank(actorRole);
    return ROLES.filter(x => RANK[x] < r && x !== 'owner');
  }

  // may `actor` reset, deactivate or change `target`?
  function canManage(actor, target) {
    const a = isObj(actor) ? actor : {}, t = isObj(target) ? target : {};
    if (!canOpen(a.role)) return { ok: false, reason: 'Your role cannot manage accounts.' };
    if (!rank(t.role)) return { ok: false, reason: 'This kind of account is not managed here.' };
    if (a.id != null && a.id === t.id) return { ok: false, reason: 'Your own account is not changed from this page.' };
    if (t.role === 'owner') return { ok: false, reason: 'An owner\'s account cannot be changed from this page.' };
    if (rank(t.role) >= rank(a.role)) return { ok: false, reason: 'You can manage only accounts below your own level.' };
    return { ok: true, reason: '' };
  }

  // opts.workDomain: when set (for example "example.com"), only addresses on it are accepted
  function checkNew(form, actorRole, opts) {
    const f = isObj(form) ? form : {}, o = isObj(opts) ? opts : {}, problems = [];
    const name = text(f.name, NAME_MAX + 1), email = text(f.email, EMAIL_MAX + 1).toLowerCase(), role = text(f.role, 20), department = text(f.department, DEPT_MAX);
    const domain = text(o.workDomain, 120).toLowerCase().replace(/^@/, '');
    if (name.length < NAME_MIN) problems.push('Type the person\'s name.');
    if (name.length > NAME_MAX) problems.push('The name is too long (' + NAME_MAX + ' characters at most).');
    if (!email) problems.push('Type their work email address.');
    else if (email.length > EMAIL_MAX || !EMAIL.test(email)) problems.push('That is not an email address.');
    else if (domain && email.slice(email.lastIndexOf('@') + 1) !== domain) problems.push('Use their work address (it ends with @' + domain + '), not a personal one.');
    if (!canOpen(actorRole)) problems.push('Your role cannot add people.');
    else if (role === 'owner') problems.push('An owner cannot be created from this page.');
    else if (!assignable(actorRole).includes(role)) problems.push(role && rank(role) ? 'You can give only roles below your own level.' : 'Choose a role.');
    return { ok: problems.length === 0, problems: problems, value: problems.length ? null : { name: name, email: email, role: role, department: department } };
  }

  // the password the new person types themselves; `about` is only used to refuse the obvious
  function checkPassword(pw, again, about) {
    const p = typeof pw === 'string' ? pw : '', q = typeof again === 'string' ? again : '', a = isObj(about) ? about : {}, problems = [];
    const lower = p.toLowerCase(), mail = text(a.email, EMAIL_MAX).toLowerCase(), local = mail.split('@')[0];
    if (p.length < PW_MIN) problems.push('The password needs at least ' + PW_MIN + ' characters.');
    if (p.length > PW_MAX) problems.push('The password is too long (' + PW_MAX + ' characters at most).');
    if (p && p !== q) problems.push('The two passwords are not the same. Type it again.');
    if (p.length >= PW_MIN && ((mail && lower.includes(mail)) || (local.length >= 4 && lower.includes(local)))) problems.push('The password must not contain the email address.');
    if (p.length >= PW_MIN && /^(.)\1+$/.test(p)) problems.push('The password cannot be one character repeated.');
    return { ok: problems.length === 0, problems: problems };
  }

  // A password for someone who is not in the room: shown once, changed at the first sign-in.
  // `bytes(n)` returns n numbers 0-255 (given, so this stays testable); without one the
  // system's own secure random numbers are used. Never Math.random.
  function tempPassword(bytes) {
    const take = typeof bytes === 'function' ? bytes : (n) => {
      const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
      if (!c || typeof c.getRandomValues !== 'function') return [];
      return Array.from(c.getRandomValues(new Uint8Array(n)));
    };
    const out = [], limit = 256 - (256 % ALPHABET.length);             // numbers at or above this would favour some letters
    for (let round = 0; round < 50 && out.length < 16; round += 1) {
      const got = take(32);
      if (!Array.isArray(got) || !got.length) break;
      for (let i = 0; i < got.length && out.length < 16; i += 1) {
        const b = got[i];
        if (Number.isInteger(b) && b >= 0 && b < limit) out.push(ALPHABET[b % ALPHABET.length]);
      }
    }
    if (out.length < 16) return '';                                      // no safe randomness: no password, the page says so
    return [0, 4, 8, 12].map(i => out.slice(i, i + 4).join('')).join('-');
  }

  // rows: [{ person, at }] (at: a time in ms or an ISO text); when: { todayStart, weekStart } in ms
  function workCounts(rows, when) {
    const w = isObj(when) ? when : {}, by = Object.create(null);
    const today = Number(w.todayStart), week = Number(w.weekStart);
    (Array.isArray(rows) ? rows : []).slice(0, 20000).forEach(r => {
      if (!isObj(r)) return;
      const who = text(r.person, 80); if (!who) return;
      const t = typeof r.at === 'number' ? r.at : Date.parse(text(r.at, 40));
      if (!isFinite(t)) return;
      const c = by[who] || (by[who] = { today: 0, week: 0 });
      if (isFinite(week) && t >= week) c.week += 1;
      if (isFinite(today) && t >= today) c.today += 1;
    });
    return by;
  }

  // people: [{ id, name, email, role, active, accountNumber, lastSignIn, emergency }]
  function listView(people, actor, counts) {
    const c = isObj(counts) ? counts : {};
    return (Array.isArray(people) ? people : []).filter(isObj).slice(0, 500).map(p => {
      const role = text(p.role, 20), may = canManage(actor, { id: p.id, role: role });
      const key = text(p.accountNumber, 40) || text(p.id, 80);
      const n = isObj(c[key]) ? c[key] : { today: 0, week: 0 };
      return { id: p.id, name: text(p.name, NAME_MAX) || '(no name)', email: text(p.email, EMAIL_MAX), role: role, roleWord: ROLE_WORD[role] || 'Other',
        active: p.active === true, accountNumber: text(p.accountNumber, 40), lastSignIn: text(p.lastSignIn, 40), emergency: p.emergency === true,
        today: Number.isInteger(n.today) && n.today > 0 ? n.today : 0, week: Number.isInteger(n.week) && n.week > 0 ? n.week : 0,
        canManage: may.ok, why: may.reason, roles: may.ok ? assignable(isObj(actor) ? actor.role : '').filter(x => x !== role) : [] };
    }).sort((a, b) => (Number(b.active) - Number(a.active)) || ((RANK[b.role] || 0) - (RANK[a.role] || 0)) || a.name.localeCompare(b.name));
  }

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Managing people is not installed in the database yet (its database step needs the owner\'s approval).';
    }
    if (code === 'email_exists' || code === '23505' || /already (registered|exists)/i.test(msg)) return 'An account with that email address already exists. Nothing was created.';
    if (code === '42501') return /^(Only |An owner|You can |Your own)/.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === 'P0002') return 'That person was not found. Nothing was changed.';
    if (code === '22023' || code === '23514') return msg || 'The database refused a value. Nothing was changed.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The request was refused: ' + (msg || code || 'no reason given') + '. Nothing was changed.';
  }

  return { ROLES, RANK, ROLE_WORD, ROLE_LINE, PW_MIN, PW_MAX, canOpen, assignable, canManage, checkNew, checkPassword, tempPassword, workCounts, listView, friendlyError };
}));
