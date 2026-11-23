// LOCAL ONLY: answers some of the page's database calls from a REAL Postgres
// (a throwaway copy of the local database with a draft installed), instead of
// the in-browser stand-in (mock-supabase.js). Used where the point of the test
// is that the DATABASE enforces a rule — who may approve, a retried save, data
// surviving a refresh — which the stand-in cannot prove.
//
//   const bridge = await pgBridge(page, { tables, rpcs, role, setupSql, install })
//
// * tables / rpcs: the only REST tables and functions sent to Postgres; every
//   other call falls through to the stand-in as usual.
// * role: the signed-in test person's role IN POSTGRES. Their id is the stand-in
//   owner's id, so "who recorded it" lines up with the page. The page's own idea
//   of the role comes from the stand-in profile, which a test may set differently
//   (to show the database refusing when the page's check is bypassed).
// * storage: true also answers the storage service's upload and signed-link
//   calls (Nov 21, drafts/38) from the database's storage rules, as the signed-in
//   person; installs a minimal stand-in of Supabase's storage schema first, then
//   opts.storageInstall (e.g. drafts/38).
// * Each call creates its own database from a template, and drops it at the end.
//
// Needs the local Postgres (HE_PG_ARGS, default the throwaway server of
// docs/ops/sql/local-test). Where it is not running (GitHub CI), pgAvailable()
// is false and the tests that need it skip, saying so. Never points at Supabase.
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
const { OWNER_USER } = require('../fixtures/synthetic-data');

const ARGS = (process.env.HE_PG_ARGS || '-h /var/tmp/hepg -p 5499 -U postgres').split(/\s+/).filter(Boolean);
const SRC = 'he_real';
let available = null;
function pgAvailable() {
  if (available !== null) return available;
  try { execFileSync('psql', ARGS.concat(['-d', SRC, '-qtAX', '-c', 'select 1']), { stdio: 'pipe', timeout: 5000 }); available = true; }
  catch (e) { available = false; }
  return available;
}
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
// a list of records (as PostgREST sends a JSON array to a jsonb argument) goes as jsonb; a list of plain values as text[]
const val = (v) => Array.isArray(v) && v.length && v.every(x => x !== null && typeof x === 'object') ? lit(JSON.stringify(v)) + '::jsonb'
  : Array.isArray(v) ? 'array[' + v.map(lit).join(',') + ']::text[]'
  : (v !== null && typeof v === 'object') ? lit(JSON.stringify(v)) + '::jsonb' : (typeof v === 'boolean' || typeof v === 'number') ? String(v) : lit(v);
const IDENT = /^[a-z_][a-z0-9_]*$/;

let counter = 0;
async function pgBridge(page, opts) {
  const o = opts || {};
  const db = 'he_bridge_' + process.pid + '_' + (++counter) + '_' + Date.now().toString(36);
  const psql = (sql, database) => run('psql', ARGS.concat(['-d', database || db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { maxBuffer: 1 << 24 });
  await psql('create database ' + db + ' template ' + SRC, 'postgres');
  if (o.install) await run('psql', ARGS.concat(['-d', db, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', o.install]), { maxBuffer: 1 << 24 });
  if (o.storage) {
    // STAND-IN for Supabase's storage schema (the shape its rules run against)
    await psql("create schema storage; create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);" +
      "create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid default auth.uid(), created_at timestamptz default now(), metadata jsonb, unique (bucket_id, name));" +
      "alter table storage.objects enable row level security; grant usage on schema storage to authenticated, anon; grant select, insert, update, delete on storage.objects to authenticated, anon; grant select on storage.buckets to authenticated, anon;");
    if (o.storageInstall) await run('psql', ARGS.concat(['-d', db, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', o.storageInstall]), { maxBuffer: 1 << 24 });
  }
  const uid = OWNER_USER.id;
  await psql("delete from profiles where id = " + lit(uid) + "; insert into profiles (id, email, role, is_active, display_name, account_number) values (" +
    lit(uid) + ", 'bridge@example.test', " + lit(o.role || 'owner') + ", true, 'Synthetic Owner', '500000001');" + (o.setupSql || ''));
  const calls = [];

  async function asUser(sql, plain) {
    // plain: a statement run as is (an insert with no RETURNING, which needs
    // only the insert rule, as the storage service's upload does)
    const wrapped = 'begin; set local role authenticated; set local request.jwt.claim.sub = ' + lit(uid) + ";\n" + (plain ? sql + ';' : "select coalesce(jsonb_agg(t), '[]'::jsonb) from (" + sql + ') t;') + '\ncommit;';
    try {
      const { stdout } = await new Promise((resolve, reject) => {
        const child = execFile('psql', ARGS.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']), { maxBuffer: 1 << 24 },
          (err, stdout, stderr) => err ? reject(Object.assign(err, { stderr })) : resolve({ stdout }));
        child.stdin.end(wrapped);
      });
      const line = stdout.split('\n').map(s => s.trim()).filter(s => s.startsWith('['))[0];
      return { data: JSON.parse(line || '[]') };
    } catch (e) {
      const t = String(e.stderr || e.message);
      const m = t.match(/ERROR:\s+([0-9A-Z]{5}):\s+(.*)/);
      return { error: m ? { code: m[1], message: m[2].trim(), details: null, hint: null } : { code: 'XX000', message: t.split('\n')[0] } };
    }
  }
  const status = (code) => code === '42501' ? 403 : code === 'P0002' ? 404 : 400;
  const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
  const reply = (route, code, body) => route.fulfill({ status: code, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  const dropOnce = new Set(o.dropReplyOnce || []);   // rpc names: the database saves, then the reply is lost once

  // Requests still being answered when the test ends are finished first, and
  // nothing is answered after close() (the page may already be gone).
  const pending = new Set();
  let closed = false;
  const handler = (route) => {
    if (closed) return route.fallback().catch(() => {});
    // "already handled": the browser cancelled the request while the database
    // was answering; nobody is waiting for the reply, so it is dropped.
    const p = answer(route).catch(e => { if (!closed && !/already handled|closed|Target page/i.test(String(e && e.message))) throw e; });
    pending.add(p); p.finally(() => pending.delete(p));
    return p;
  };
  await page.route(/\/rest\/v1\//, handler);
  const storageHandler = (route) => {
    if (closed) return route.fallback().catch(() => {});
    const p = answerStorage(route).catch(e => { if (!closed && !/already handled|closed|Target page/i.test(String(e && e.message))) throw e; });
    pending.add(p); p.finally(() => pending.delete(p));
    return p;
  };
  if (o.storage) await page.route(/\/storage\/v1\/object\//, storageHandler);
  // upload: POST /storage/v1/object/<bucket>/<name>; signed link: POST /storage/v1/object/sign/<bucket>/<name>
  async function answerStorage(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: Object.assign({ 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': '*' }, CORS) });
    const rest = decodeURIComponent(new URL(req.url()).pathname.split('/storage/v1/object/')[1] || '');
    const sign = rest.startsWith('sign/');
    const parts = (sign ? rest.slice(5) : rest).split('/');
    const bucket = parts.shift(), name = parts.join('/');
    if (!IDENT.test(bucket.replace(/-/g, '_')) || !name) return reply(route, 400, { statusCode: '400', error: 'InvalidKey', message: 'Invalid key' });
    if (req.method() !== 'POST') return reply(route, 400, { statusCode: '400', error: 'NotSupported', message: 'Only uploads and signed links are emulated' });
    if (sign) {
      calls.push('storage sign ' + bucket + '/' + name);
      const r = await asUser('select name from storage.objects where bucket_id = ' + lit(bucket) + ' and name = ' + lit(name));
      if (r.error || !r.data.length) return reply(route, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return reply(route, 200, { signedURL: '/object/sign/' + bucket + '/' + name + '?token=synthetic-test-token' });
    }
    calls.push('storage upload ' + bucket + '/' + name);
    const b = await asUser('select 1 from storage.buckets where id = ' + lit(bucket));
    if (!b.error && !b.data.length) return reply(route, 400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
    const r = await asUser('insert into storage.objects (bucket_id, name) values (' + lit(bucket) + ', ' + lit(name) + ')', true);
    if (r.error) return reply(route, 400, { statusCode: r.error.code === '23505' ? '409' : '403', error: r.error.code === '23505' ? 'Duplicate' : 'Unauthorized', message: r.error.code === '23505' ? 'The resource already exists' : r.error.message });
    return reply(route, 200, { Key: bucket + '/' + name, Id: name });
  }
  async function answer(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fallback();
    const url = new URL(req.url());
    const parts = url.pathname.split('/rest/v1/')[1].split('/');
    if (parts[0] === 'rpc') {
      const fn = parts[1];
      if (!(o.rpcs || []).includes(fn) || !IDENT.test(fn)) return route.fallback();
      const args = req.postDataJSON() || {};
      const keys = Object.keys(args).filter(k => IDENT.test(k));
      calls.push('rpc ' + fn);
      const r = await asUser('select public.' + fn + '(' + keys.map(k => k + ' => ' + val(args[k])).join(', ') + ') as r');
      if (r.error) return reply(route, status(r.error.code), r.error);
      if (dropOnce.has(fn)) { dropOnce.delete(fn); calls.push('reply lost ' + fn); return route.abort('connectionreset'); }
      return reply(route, 200, r.data[0].r);
    }
    const table = parts[0];
    if (!(o.tables || []).includes(table) || (req.method() !== 'GET' && req.method() !== 'PATCH')) return route.fallback();
    const cols = (url.searchParams.get('select') || '*').split(',').map(s => s.trim());
    if (!cols.every(c => c === '*' || IDENT.test(c))) return route.fallback();   // joins etc. stay with the stand-in
    const where = [];
    let order = null, limit = null;
    for (const [k, v] of url.searchParams) {
      if (k === 'select') continue;
      if (k === 'order') { const [c, dir] = v.split('.'); if (IDENT.test(c)) order = c + (dir === 'desc' ? ' desc' : ''); continue; }
      if (k === 'limit') { limit = Math.max(0, parseInt(v, 10) || 0); continue; }
      if (k === 'offset') continue;
      const m = v.match(/^eq\.(.*)$/);
      if (IDENT.test(k) && m) where.push(k + ' = ' + lit(m[1]));
      else return route.fallback();
    }
    // Nov 23: an update (supabase-js .update().eq()), as the signed-in person, so
    // the table's own row rules and triggers decide. Never without a filter.
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() || {};
      const sets = Object.keys(body).filter(k => IDENT.test(k)).map(k => k + ' = ' + val(body[k]));
      if (!where.length || !sets.length) return route.fallback();
      calls.push('update ' + table);
      const r = await asUser('with u as (update public.' + table + ' set ' + sets.join(', ') + ' where ' + where.join(' and ') + ' returning *) select coalesce(jsonb_agg(to_jsonb(u)), \'[]\'::jsonb) from u', true);
      if (r.error) return reply(route, status(r.error.code), r.error);
      if (!/return=representation/.test(req.headers()['prefer'] || '')) return route.fulfill({ status: 204, headers: CORS, body: '' });
      return reply(route, 200, r.data.map(row => { const x = {}; for (const c of cols) { if (c === '*') return row; x[c] = row[c]; } return x; }));
    }
    calls.push('select ' + table);
    const r = await asUser('select ' + cols.join(',') + ' from public.' + table + (where.length ? ' where ' + where.join(' and ') : '') + (order ? ' order by ' + order : '') + (limit != null ? ' limit ' + limit : ''));
    if (r.error) return reply(route, status(r.error.code), r.error);
    // .single(): the API returns one object, or 406 when there is not exactly one row
    if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) {
      if (r.data.length !== 1) return reply(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
      return reply(route, 200, r.data[0]);
    }
    return reply(route, 200, r.data);
  }

  return {
    db, uid, calls,
    query: async (sql) => (await psql(sql)).stdout.trim(),
    close: async () => {
      closed = true;
      await Promise.allSettled([...pending]);
      try { await page.unroute(/\/rest\/v1\//, handler); } catch (e) { /* page closed */ }
      if (o.storage) { try { await page.unroute(/\/storage\/v1\/object\//, storageHandler); } catch (e) { /* page closed */ } }
      await psql('drop database if exists ' + db + ' with (force)', 'postgres').catch(() => {});
    },
  };
}

module.exports = { pgBridge, pgAvailable };
