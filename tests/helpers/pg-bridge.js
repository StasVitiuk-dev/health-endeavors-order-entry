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
const val = (v) => Array.isArray(v) ? 'array[' + v.map(lit).join(',') + ']::text[]'
  : (v !== null && typeof v === 'object') ? lit(JSON.stringify(v)) + '::jsonb' : (typeof v === 'boolean' || typeof v === 'number') ? String(v) : lit(v);
const IDENT = /^[a-z_][a-z0-9_]*$/;

let counter = 0;
async function pgBridge(page, opts) {
  const o = opts || {};
  const db = 'he_bridge_' + process.pid + '_' + (++counter) + '_' + Date.now().toString(36);
  const psql = (sql, database) => run('psql', ARGS.concat(['-d', database || db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { maxBuffer: 1 << 24 });
  await psql('create database ' + db + ' template ' + SRC, 'postgres');
  if (o.install) await run('psql', ARGS.concat(['-d', db, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', o.install]), { maxBuffer: 1 << 24 });
  const uid = OWNER_USER.id;
  await psql("delete from profiles where id = " + lit(uid) + "; insert into profiles (id, email, role, is_active, display_name, account_number) values (" +
    lit(uid) + ", 'bridge@example.test', " + lit(o.role || 'owner') + ", true, 'Synthetic Owner', '500000001');" + (o.setupSql || ''));
  const calls = [];

  async function asUser(sql) {
    const wrapped = 'begin; set local role authenticated; set local request.jwt.claim.sub = ' + lit(uid) + ";\nselect coalesce(jsonb_agg(t), '[]'::jsonb) from (" + sql + ') t;\ncommit;';
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
    if (!(o.tables || []).includes(table) || req.method() !== 'GET') return route.fallback();
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
      await psql('drop database if exists ' + db + ' with (force)', 'postgres').catch(() => {});
    },
  };
}

module.exports = { pgBridge, pgAvailable };
