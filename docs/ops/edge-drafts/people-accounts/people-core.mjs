// DRAFT (2026-11-25). NOT DEPLOYED. The core of the "people-accounts" helper program
// (owner, Nov 24: the New Employee page; the owner, administrators and managers create
// an account with a button; the new person types their own password; nobody deletes).
// Runs inside a Supabase Edge Function (index.ts) once the owner approves drafts/62 and
// 64 and this program; tested locally against a throwaway database with drafts/62 and
// 64 installed and a made-up sign-in provider
// (docs/ops/sql/local-test/people_accounts_core_test.mjs).
//
// Why a helper program at all: creating a sign-in, setting a password and blocking a
// sign-in need the provider's own key, and that key must never reach the dashboard.
// The program holds the key, and does exactly four things, each only AFTER the database
// has said yes for the signed-in person who asked (people_allow, drafts/64, asked with
// that person's OWN sign-in, so the database rules decide, not this program):
//
//   create    a sign-in for a new person (work email, the password they typed), then
//             switches the account on at the level chosen (people_register, again with
//             the asker's own sign-in). If that second step is refused, the new sign-in
//             is blocked at once so nobody can use it, and the answer says so.
//   password  sets a new password for an account below the asker's level
//   block     stops an account below the asker's level from signing in or renewing
//             its sign-in (an open page keeps its current pass until it runs out)
//   unblock   lets that account sign in again
//
// It never deletes a sign-in or an account, never reads or changes anything else, never
// sends an email, never writes a password or a key into an answer or a log.
//
// Pure apart from what it is given: deps.userDb (the database, as the asker),
// deps.authAdmin (the sign-in provider, with the key) and deps.config. Works in Deno
// (the Edge Function) and in Node (the test).

export const ACTIONS = Object.freeze(['create', 'password', 'block', 'unblock']);
export const ROLES = Object.freeze(['administrator', 'manager', 'employee']);    // never owner from here
export const BLOCK_FOR = '876000h';                                               // about 100 years: until someone unblocks
export const NAME_MIN = 2, NAME_MAX = 80, DEPT_MAX = 60, EMAIL_MAX = 254, PW_MIN = 10, PW_MAX = 72;
const EMAIL = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, max);

// the answer headers: only the dashboard's own address may call from a browser
export function corsHeaders(origin, config) {
  const allowed = text(isObj(config) ? config.allowedOrigin : '', 200);
  const h = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin' };
  if (allowed && origin === allowed) {
    h['access-control-allow-origin'] = allowed;
    h['access-control-allow-methods'] = 'POST, OPTIONS';
    h['access-control-allow-headers'] = 'authorization, content-type, apikey, x-client-info';
    h['access-control-max-age'] = '600';
  }
  return h;
}

// checks the request's own fields; returns { ok, problems, value }
export function checkRequest(body, config) {
  const b = isObj(body) ? body : {}, c = isObj(config) ? config : {}, problems = [];
  const action = text(b.action, 20);
  if (!ACTIONS.includes(action)) return { ok: false, problems: ['Unknown request.'], value: null };
  const value = { action };
  const pw = typeof b.password === 'string' ? b.password : '';
  const checkPw = (email) => {
    if (pw.length < PW_MIN) problems.push('The password needs at least ' + PW_MIN + ' characters.');
    else if (pw.length > PW_MAX) problems.push('The password is too long (' + PW_MAX + ' characters at most).');
    else if (/^(.)\1+$/.test(pw)) problems.push('The password cannot be one character repeated.');
    else if (email) {
      const lower = pw.toLowerCase(), local = email.split('@')[0];
      if (lower.includes(email) || (local.length >= 4 && lower.includes(local))) problems.push('The password must not contain the email address.');
    }
    value.password = pw;
  };
  if (action === 'create') {
    const name = text(b.name, NAME_MAX + 1), email = text(b.email, EMAIL_MAX + 1).toLowerCase();
    const role = text(b.role, 20), department = text(b.department, DEPT_MAX + 1);
    const domain = text(c.workDomain, 120).toLowerCase().replace(/^@/, '');
    if (name.length < NAME_MIN || name.length > NAME_MAX) problems.push('The name must be ' + NAME_MIN + ' to ' + NAME_MAX + ' characters.');
    if (!email || email.length > EMAIL_MAX || !EMAIL.test(email)) problems.push('That is not an email address.');
    else if (domain && email.slice(email.lastIndexOf('@') + 1) !== domain) problems.push('Use their work address (it ends with @' + domain + '), not a personal one.');
    if (!ROLES.includes(role)) problems.push(role === 'owner' ? 'An owner cannot be created from this page.' : 'Choose a role.');
    if (department.length > DEPT_MAX) problems.push('The department must be ' + DEPT_MAX + ' characters at most.');
    checkPw(EMAIL.test(email) ? email : '');
    Object.assign(value, { name, email, role, department });
  } else {
    const person = text(b.person, 40);
    if (!UUID.test(person)) problems.push('That person was not found.');
    value.person = person.toLowerCase();
    if (action === 'password') checkPw(text(b.email, EMAIL_MAX).toLowerCase());
  }
  return { ok: problems.length === 0, problems, value: problems.length ? null : value };
}

// a database answer (PostgREST shape) -> { ok, status, message }
function dbAnswer(r, what) {
  const st = r && Number.isInteger(r.status) ? r.status : 0, body = r && r.body;
  if (st >= 200 && st < 300) return { ok: true, status: 200, data: body };
  const code = isObj(body) && body.code != null ? String(body.code) : '';
  const msg = isObj(body) && typeof body.message === 'string' ? body.message.slice(0, 300) : '';
  if (st === 401 || code === 'PGRST301' || code === 'PGRST302') return { ok: false, status: 401, message: 'Your sign-in has ended. Sign in again; nothing was changed.' };
  if (code === 'PGRST202' || code === '42883' || code === 'PGRST205' || code === '42P01') {
    return { ok: false, status: 503, message: 'Managing people is not installed in the database yet (its database step needs the owner\'s approval). Nothing was changed.' };
  }
  if (code === '42501') return { ok: false, status: 403, message: msg || 'You do not have permission to do that. Nothing was changed.' };
  if (code === '22023' || code === '23514') return { ok: false, status: 400, message: msg || 'The database refused a value. Nothing was changed.' };
  return { ok: false, status: 502, message: 'The database did not answer ' + what + ' (' + (code || st || 'no answer') + '). Nothing was changed.' };
}

// a provider answer -> { ok, status, message, id }
function providerAnswer(r, what) {
  const st = r && Number.isInteger(r.status) ? r.status : 0, body = r && r.body;
  if (st >= 200 && st < 300) {
    const id = isObj(body) ? (isObj(body.user) ? body.user.id : body.id) : null;
    return { ok: true, status: 200, id: typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : null };
  }
  const code = isObj(body) ? String(body.error_code || body.code || '') : '';
  const msg = isObj(body) ? String(body.msg || body.message || body.error_description || '') : '';
  if (code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered|already exists/i.test(msg)) {
    return { ok: false, status: 409, message: 'An account with that email address already exists. Nothing was created.' };
  }
  if (code === 'weak_password' || /password/i.test(msg)) return { ok: false, status: 400, message: 'The sign-in provider refused that password. Choose a longer one; nothing was changed.' };
  if (st === 404 || code === 'user_not_found') return { ok: false, status: 404, message: 'That person has no sign-in. Nothing was changed.' };
  return { ok: false, status: 502, message: 'The sign-in provider did not ' + what + ' (' + (code || st || 'no answer') + '). Nothing was changed.' };
}

const reply = (status, headers, body) => ({ status, headers, body });

// req: { method, origin, authorization, body }
export async function handle(req, deps) {
  const r = isObj(req) ? req : {}, d = isObj(deps) ? deps : {}, config = isObj(d.config) ? d.config : {};
  const headers = corsHeaders(r.origin, config);
  if (r.method === 'OPTIONS') return reply(headers['access-control-allow-origin'] ? 204 : 403, headers, null);
  if (r.method !== 'POST') return reply(404, headers, { ok: false, message: 'Not found.' });
  if (!headers['access-control-allow-origin']) return reply(403, headers, { ok: false, message: 'This helper answers the dashboard only.' });
  const auth = typeof r.authorization === 'string' ? r.authorization : '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!TOKEN.test(token)) return reply(401, headers, { ok: false, message: 'Sign in first. Nothing was changed.' });
  if (!d.userDb || typeof d.userDb.rpc !== 'function' || !d.authAdmin) return reply(500, headers, { ok: false, message: 'The helper is not set up (a setting is missing). Nothing was changed.' });

  const checked = checkRequest(r.body, config);
  if (!checked.ok) return reply(400, headers, { ok: false, message: checked.problems.join(' '), problems: checked.problems });
  const v = checked.value;

  // 1. the database decides, for the person who asked, with their own sign-in
  const allow = dbAnswer(await d.userDb.rpc(token, 'people_allow', {
    p_action: v.action === 'create' ? 'create' : v.action === 'password' ? 'password' : 'sign_out',
    p_person: v.action === 'create' ? null : v.person,
    p_role: v.action === 'create' ? v.role : null,
  }), 'the permission question');
  if (!allow.ok) return reply(allow.status, headers, { ok: false, message: allow.message });

  // 2. only then the provider, with the key
  if (v.action === 'create') {
    const made = providerAnswer(await d.authAdmin.createUser({ email: v.email, password: v.password, email_confirm: true }), 'create the sign-in');
    if (!made.ok) return reply(made.status, headers, { ok: false, message: made.message });
    if (!made.id) return reply(502, headers, { ok: false, message: 'The sign-in provider did not say which sign-in it created. Ask the owner to check the provider\'s user list before trying again.' });
    // 3. switch the account on at the chosen level, again as the asker
    const reg = dbAnswer(await d.userDb.rpc(token, 'people_register', {
      p_person: made.id, p_role: v.role, p_display_name: v.name, p_department: v.department,
    }), 'switching the account on');
    if (!reg.ok) {
      const blocked = providerAnswer(await d.authAdmin.updateUser(made.id, { ban_duration: BLOCK_FOR }), 'block the sign-in');
      return reply(502, headers, { ok: false, id: made.id, blocked: blocked.ok,
        message: 'The sign-in was created, but the account could not be switched on: ' + reg.message.replace(/ Nothing was changed\.$/, '') + ' ' +
          (blocked.ok ? 'The new sign-in is blocked, so nobody can use it. Tell the owner.' : 'The new sign-in could NOT be blocked either. Tell the owner now.') });
    }
    return reply(200, headers, { ok: true, id: made.id, message: v.name + ' can now sign in with ' + v.email + '.' });
  }
  const patch = v.action === 'password' ? { password: v.password } : { ban_duration: v.action === 'block' ? BLOCK_FOR : 'none' };
  const done = providerAnswer(await d.authAdmin.updateUser(v.person, patch),
    v.action === 'password' ? 'set the password' : v.action === 'block' ? 'block the sign-in' : 'unblock the sign-in');
  if (!done.ok) return reply(done.status, headers, { ok: false, message: done.message });
  const said = { password: 'The new password is set. Give it to the person in person; it is not shown again.',
    block: 'This person can no longer sign in. A page they already have open keeps working until its sign-in runs out (at most an hour).',
    unblock: 'This person can sign in again.' };
  return reply(200, headers, { ok: true, id: v.person, message: said[v.action] });
}
