#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-25). Never contacts Supabase.
// Runs the New Employee page's helper program core
// (docs/ops/edge-drafts/people-accounts/people-core.mjs) against a throwaway copy of the
// local database with drafts/62 and 64 installed (made to look like production by
// people_levels_stand_in.sql), and a MADE-UP sign-in provider. The database is asked as
// the signed-in person (role authenticated + their id), as the real program asks it.
// The made-up provider adds the new account's row the way production is expected to (a
// row switched off, level employee); one case leaves it out to prove the new sign-in is
// then blocked. All accounts and values are made up.
// Usage: node people_accounts_core_test.mjs -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../../edge-drafts/people-accounts/people-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_people_accounts_test';
const STAND_IN = path.join(HERE, 'people_levels_stand_in.sql');
const ROLE = path.join(HERE, '..', 'drafts', '62_DRAFT_manager_role.sql');
const INSTALL = path.join(HERE, '..', 'drafts', '64_DRAFT_people_levels.sql');
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const psql = (db, sql) => execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const file = (db, f) => execFileSync('psql', CONN.concat(['-d', db, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', f]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";

const O = '00000000-0000-4000-8000-000000000c01', G = '00000000-0000-4000-8000-000000000c02';
const A = '00000000-0000-4000-8000-000000000c03', B = '00000000-0000-4000-8000-000000000c04';
const M = '00000000-0000-4000-8000-000000000c05', E = '00000000-0000-4000-8000-000000000c07';
const X = '00000000-0000-4000-8000-000000000c09';
const DASH = 'https://dashboard.example.test';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const tokenOf = (sub) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub, role: 'authenticated' }) + '.c2lnbmF0dXJlLW1hZGUtdXA';
const subOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;

// the database, asked as the signed-in person (PostgREST-shaped answers)
const calls = { db: [], provider: [] };
const userDb = {
  async rpc(token, name, args) {
    calls.db.push(name);
    const named = Object.entries(args).map(([k, v]) => k + ' := ' + (k === 'p_person' ? lit(v) + '::uuid' : lit(v))).join(', ');
    const sql = '\\set VERBOSITY verbose\nbegin;\nset local role authenticated;\nset local request.jwt.claim.sub = ' + lit(subOf(token)) + ';\nselect to_jsonb(public.' + name + '(' + named + '));\ncommit;\n';
    const r = spawnSync('psql', CONN.concat(['-d', DB, '-qtAX', '-v', 'ON_ERROR_STOP=1']), { input: sql, encoding: 'utf8' });
    if (r.status === 0) return { status: 200, body: JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop()) };
    const m = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/.exec(r.stderr || '');
    const code = m ? m[1] : 'XX000', message = m ? m[2] : (r.stderr || '').slice(0, 200);
    return { status: code === '42501' ? 403 : code === '42883' ? 404 : 400, body: { code, message } };
  },
};
// the made-up sign-in provider
let addRow = true;
const bans = {}, passwords = {};
const authAdmin = {
  async createUser(attrs) {
    calls.provider.push(['create', attrs.email, attrs.email_confirm === true]);
    if (psql(DB, 'select count(*) from profiles where lower(email) = lower(' + lit(attrs.email) + ')') !== '0') {
      return { status: 422, body: { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' } };
    }
    const id = randomUUID();
    if (addRow) psql(DB, "insert into profiles (id, email, role, is_active, is_break_glass, account_number, created_at) values (" + lit(id) + ', ' + lit(attrs.email) + ", 'employee', false, false, " + lit('93' + String(Date.now()).slice(-7)) + ', now())');
    passwords[id] = attrs.password;
    return { status: 200, body: { id, email: attrs.email } };
  },
  async updateUser(id, attrs) {
    calls.provider.push(['update', id, Object.keys(attrs).join(',')]);
    if (attrs.ban_duration) bans[id] = attrs.ban_duration;
    if (attrs.password) passwords[id] = attrs.password;
    return { status: 200, body: { id } };
  },
};
const deps = { config: { allowedOrigin: DASH, workDomain: '' }, userDb, authAdmin };
const replies = [];
const ask = async (who, body, extra) => {
  calls.db = []; calls.provider = [];
  const req = Object.assign({ method: 'POST', origin: DASH, authorization: who ? 'Bearer ' + tokenOf(who) : '', body }, extra || {});
  const out = await C.handle(req, (extra && extra.deps) || deps);
  replies.push(out);
  return out;
};
const PW = 'Correct-Horse-Battery-7';
const state = (email) => psql(DB, "select role::text || '/' || is_active || '/' || coalesce(display_name, '') || '/' || coalesce(department, '') from profiles where email = " + lit(email));

// ---- set-up -----------------------------------------------------------------------
psql('postgres', 'drop database if exists ' + DB + ' with (force)');
psql('postgres', 'create database ' + DB + ' template ' + SRC);
file(DB, STAND_IN);
file(DB, ROLE);
psql(DB, "update profiles set role = 'manager' where id = '" + M + "'");
file(DB, INSTALL);
console.log('The New Employee helper program (throwaway database ' + DB + ')');

console.log(' 1. who may call it at all');
let r = await ask(null, null, { method: 'OPTIONS' });
ok('the dashboard\'s own address may ask (the browser\'s pre-check)', [r.status, r.headers['access-control-allow-origin']], [204, DASH]);
r = await ask(null, null, { method: 'OPTIONS', origin: 'https://elsewhere.example.test' });
ok('another address may not', [r.status, r.headers['access-control-allow-origin'] || null], [403, null]);
r = await ask(A, { action: 'create' }, { method: 'GET' });
ok('only POST is answered', r.status, 404);
r = await ask(A, { action: 'create', name: 'New Person', email: 'p1@example.test', role: 'employee', password: PW }, { origin: 'https://elsewhere.example.test' });
ok('a request from another address is refused before anything is asked', [r.status, calls.db.length, calls.provider.length], [403, 0, 0]);
r = await ask(null, { action: 'create', name: 'New Person', email: 'p1@example.test', role: 'employee', password: PW });
ok('without a sign-in: refused, nothing asked', [r.status, calls.db.length, calls.provider.length], [401, 0, 0]);
r = await ask(A, { action: 'create' }, { authorization: 'Bearer not-a-token' });
ok('with something that is not a sign-in: refused', r.status, 401);
r = await C.handle({ method: 'POST', origin: DASH, authorization: 'Bearer ' + tokenOf(A), body: { action: 'block', person: E } }, { config: { allowedOrigin: DASH } });
ok('a helper without its settings refuses and changes nothing', r.status, 500);

console.log(' 2. the request\'s own fields, checked before anything is asked');
r = await ask(A, { action: 'delete', person: E });
ok('an unknown request (there is no delete)', [r.status, r.body.message, calls.db.length], [400, 'Unknown request.', 0]);
r = await ask(O, { action: 'create', name: 'New Owner', email: 'o2@example.test', role: 'owner', password: PW });
ok('an owner cannot be created, even by the owner', [r.status, r.body.message, calls.provider.length], [400, 'An owner cannot be created from this page.', 0]);
r = await ask(A, { action: 'create', name: 'X', email: 'not-an-email', role: 'employee', password: 'short' });
ok('name, email and password problems all listed at once', r.body.problems, ['The name must be 2 to 80 characters.', 'That is not an email address.', 'The password needs at least 10 characters.']);
r = await ask(A, { action: 'create', name: 'Sam Doe', email: 'samdoe@example.test', role: 'employee', password: 'xxsamdoexx99' });
ok('a password with the email in it is refused', r.body.problems, ['The password must not contain the email address.']);
r = await ask(A, { action: 'create', name: 'Sam Doe', email: 'sam@example.test', role: 'employee', password: 'aaaaaaaaaaaa' });
ok('one character repeated is refused', r.body.problems, ['The password cannot be one character repeated.']);
r = await C.handle({ method: 'POST', origin: DASH, authorization: 'Bearer ' + tokenOf(A), body: { action: 'create', name: 'Sam Doe', email: 'sam@gmail.example', role: 'employee', password: PW } },
  Object.assign({}, deps, { config: { allowedOrigin: DASH, workDomain: 'business.example.test' } }));
ok('with a work domain set, a personal address is refused', r.body.problems, ['Use their work address (it ends with @business.example.test), not a personal one.']);
r = await ask(A, { action: 'password', person: 'not-an-id', password: PW });
ok('a person who is not an id', [r.status, r.body.message], [400, 'That person was not found.']);

console.log(' 3. creating an account: the database decides, then the provider, then the account is switched on');
r = await ask(E, { action: 'create', name: 'New Person', email: 'p1@example.test', role: 'employee', password: PW });
ok('an employee cannot create anyone; the provider is not asked', [r.status, calls.provider.length], [403, 0]);
r = await ask(M, { action: 'create', name: 'Made By Manager', email: 'p2@example.test', role: 'administrator', password: PW });
ok('a manager cannot create an administrator; the provider is not asked', [r.status, calls.provider.length], [403, 0]);
r = await ask(M, { action: 'create', name: 'Made By  Manager', email: 'P3@Example.test', role: 'employee', department: 'Packing', password: PW });
ok('a manager creates an employee', [r.status, r.body.ok, r.body.message], [200, true, 'Made By Manager can now sign in with p3@example.test.']);
ok('  the database was asked first, then the provider once, the email already confirmed', [calls.db, calls.provider], [['people_allow', 'people_register'], [['create', 'p3@example.test', true]]]);
ok('  the account is on, at level employee, with the name and department', state('p3@example.test'), 'employee/true/Made By Manager/Packing');
r = await ask(A, { action: 'create', name: 'Made By Admin', email: 'p4@example.test', role: 'manager', password: PW });
ok('an administrator creates a manager', [r.status, state('p4@example.test')], [200, 'manager/true/Made By Admin/']);
r = await ask(A, { action: 'create', name: 'Second Admin', email: 'p5@example.test', role: 'administrator', password: PW });
ok('an administrator cannot create another administrator; the provider is not asked', [r.status, calls.provider.length], [403, 0]);
r = await ask(O, { action: 'create', name: 'Made By Owner', email: 'p6@example.test', role: 'administrator', password: PW });
ok('the owner creates an administrator', [r.status, state('p6@example.test')], [200, 'administrator/true/Made By Owner/']);
r = await ask(M, { action: 'create', name: 'Made Again', email: 'p3@example.test', role: 'employee', password: PW });
ok('the same email twice: one account, a plain answer', [r.status, r.body.message, psql(DB, "select count(*) from profiles where email = 'p3@example.test'")],
  [409, 'An account with that email address already exists. Nothing was created.', '1']);
r = await ask(X, { action: 'create', name: 'From Switched Off', email: 'p7@example.test', role: 'employee', password: PW });
ok('a switched-off account cannot create anyone', [r.status, calls.provider.length], [403, 0]);
addRow = false;
r = await ask(A, { action: 'create', name: 'No Row', email: 'p8@example.test', role: 'employee', password: PW });
addRow = true;
ok('when the account cannot be switched on, the new sign-in is blocked at once and the answer says so',
  [r.status, r.body.blocked, bans[r.body.id], /could not be switched on/.test(r.body.message), /blocked, so nobody can use it/.test(r.body.message)], [502, true, C.BLOCK_FOR, true, true]);

console.log(' 4. password, block and unblock: only accounts below your level');
r = await ask(A, { action: 'password', person: E, password: 'Another-Good-Pass-8' });
ok('an administrator sets an employee\'s password', [r.status, passwords[E]], [200, 'Another-Good-Pass-8']);
for (const [who, target, label] of [[A, B, 'another administrator'], [A, O, 'the owner'], [A, G, 'the emergency account'], [A, A, 'their own account'], [M, A, 'an administrator (by a manager)'], [E, E, 'their own account (an employee)']]) {
  r = await ask(who, { action: 'password', person: target, password: 'Yet-Another-Pass-9' });
  ok('  not for ' + label + '; the provider is not asked', [r.status, calls.provider.length], [403, 0]);
}
r = await ask(M, { action: 'block', person: E });
ok('a manager blocks an employee\'s sign-in', [r.status, bans[E]], [200, C.BLOCK_FOR]);
r = await ask(M, { action: 'unblock', person: E });
ok('  and lets it sign in again', [r.status, bans[E]], [200, 'none']);
r = await ask(M, { action: 'block', person: O });
ok('nobody blocks the owner', [r.status, calls.provider.length], [403, 0]);
r = await ask(A, { action: 'block', person: '00000000-0000-4000-8000-0000000000ff' });
ok('a person who does not exist', [r.status, calls.provider.length], [403, 0]);

console.log(' 5. plain answers when something is missing');
const fakeDb = (answer) => ({ rpc: async () => answer });
r = await C.handle({ method: 'POST', origin: DASH, authorization: 'Bearer ' + tokenOf(A), body: { action: 'block', person: E } }, { config: deps.config, authAdmin, userDb: fakeDb({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }) });
ok('database step not installed', [r.status, /not installed in the database yet/.test(r.body.message)], [503, true]);
r = await C.handle({ method: 'POST', origin: DASH, authorization: 'Bearer ' + tokenOf(A), body: { action: 'block', person: E } }, { config: deps.config, authAdmin, userDb: fakeDb({ status: 401, body: { code: 'PGRST301', message: 'JWT expired' } }) });
ok('a sign-in that has run out', [r.status, r.body.message], [401, 'Your sign-in has ended. Sign in again; nothing was changed.']);
r = await C.handle({ method: 'POST', origin: DASH, authorization: 'Bearer ' + tokenOf(A), body: { action: 'block', person: E } }, { config: deps.config, userDb, authAdmin: { updateUser: async () => ({ status: 500, body: { msg: 'down' } }) } });
ok('the provider failing', [r.status, r.body.message], [502, 'The sign-in provider did not block the sign-in (500). Nothing was changed.']);

console.log(' 6. nothing secret in any answer');
const all = JSON.stringify(replies);
ok('no password in any answer', [PW, 'Another-Good-Pass-8', 'Yet-Another-Pass-9'].some(p => all.includes(p)), false);
ok('every answer is marked not to be kept', replies.every(x => x.headers['cache-control'] === 'no-store'), true);

psql('postgres', 'drop database if exists ' + DB + ' with (force)');
console.log('\npassed: ' + pass + '   failed: ' + fail);
process.exit(fail ? 1 : 0);
