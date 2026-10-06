// The safety wall for the dashboard tests.
//
// Every request the test browser makes goes through installMocks():
//   - dashboard files are served straight from this repository,
//   - the Supabase library is served from node_modules (no CDN),
//   - every request to the Supabase project is answered by FakeSupabase
//     below, from synthetic data, and never forwarded to the internet,
//   - anything else is blocked and recorded, so a test can fail on it.
//
// Nothing in here holds a real key, password or customer record.

const fs = require('fs');
const { checkWrite } = require('./db-constraints');
const path = require('path');
const { buildTables, OWNER_USER } = require('../fixtures/synthetic-data');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DASHBOARD_ORIGIN = 'http://dashboard.test';
// The production project the dashboard is hard-wired to. Requests to it are
// intercepted here and answered locally; they never leave the test browser.
const SUPABASE_HOST = 'uizrazyehilyzmwttsrn.supabase.co';
const SUPABASE_CDN_PREFIX = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const SUPABASE_UMD = path.join(REPO_ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Query parameters PostgREST uses for shaping rather than filtering.
const NON_FILTER_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// An unsigned, obviously fake token. The dashboard only stores and resends it;
// nothing in the test ever checks a signature.
function fakeJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
    'synthetic-signature',
  ].join('.');
}

function parseInList(raw) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  if (!inner) return [];
  return inner.split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
}

function jsonEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]));
}

function matchesFilter(row, column, expr) {
  const value = row[column];
  const dot = expr.indexOf('.');
  if (dot === -1) return true;
  let op = expr.slice(0, dot);
  let arg = expr.slice(dot + 1);
  let negate = false;
  if (op === 'not') {
    negate = true;
    const dot2 = arg.indexOf('.');
    op = arg.slice(0, dot2);
    arg = arg.slice(dot2 + 1);
  }
  let result;
  const str = value === null || value === undefined ? null : String(value);
  switch (op) {
    case 'eq':
      // jsonb columns compare by meaning (PostgREST casts the text to jsonb)
      if (value !== null && typeof value === 'object') { try { result = jsonEqual(value, JSON.parse(arg)); } catch (e) { result = false; } }
      else result = str === arg;
      break;
    case 'neq': result = str !== arg; break;
    case 'in': result = parseInList(arg).includes(str); break;
    case 'is':
      if (arg === 'null') result = value === null || value === undefined;
      else if (arg === 'true') result = value === true;
      else if (arg === 'false') result = value === false;
      else result = true;
      break;
    case 'ilike':
    case 'like': {
      // SQL LIKE: % = any run, _ = one character, backslash escapes the next one.
      let re = '';
      for (let i = 0; i < arg.length; i++) {
        const ch = arg[i];
        if (ch === '\\' && i + 1 < arg.length) { re += arg[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
        if (ch === '%') re += '[\\s\\S]*';
        else if (ch === '_') re += '[\\s\\S]';
        else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      result = str !== null && new RegExp('^' + re + '$', op === 'ilike' ? 'i' : '').test(str);
      break;
    }
    case 'gt': result = str !== null && str > arg; break;
    case 'gte': result = str !== null && str >= arg; break;
    case 'lt': result = str !== null && str < arg; break;
    case 'lte': result = str !== null && str <= arg; break;
    // Anything fancier is not needed by the synthetic data; don't filter on it.
    default: result = true;
  }
  return negate ? !result : result;
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [key, expr] of params) {
    if (NON_FILTER_PARAMS.has(key) || key === 'or' || key === 'and') continue;
    out = out.filter(row => matchesFilter(row, key, expr));
  }
  return out;
}

function applyOrder(rows, orderParam) {
  if (!orderParam) return rows;
  const [column, dir = 'asc', nulls] = orderParam.split(',')[0].split('.');
  const sign = dir === 'desc' ? -1 : 1;
  const nullsFirst = nulls === 'nullsfirst';
  return [...rows].sort((a, b) => {
    const av = a[column], bv = b[column];
    if (av == null && bv == null) return 0;
    if (av == null) return nullsFirst ? -1 : 1;
    if (bv == null) return nullsFirst ? 1 : -1;
    return av < bv ? -sign : av > bv ? sign : 0;
  });
}

class FakeSupabase {
  constructor() {
    this.tables = buildTables();
    this.rpc = {};
    this.requests = [];        // every Supabase request the page made
    this.blocked = [];         // every non-dashboard, non-Supabase request (should stay empty)
    this.delayMs = {};         // optional per-table response delay, for timing tests
    this.nextTaskUpdateHook = null;
    this.cdnRequests = [];     // every request for the Supabase library
    this.cdnBody = null;       // optional replacement bytes for the library (integrity tests)
    this.maxRows = null;       // optional per-reply row cap, like Supabase's "Max rows" (default 1000 there)
    this.maxUrlLength = null;  // optional URL length limit (real gateways reject very long URLs)
    this.constraintViolations = []; // writes the real database would refuse (db-constraints.js)
    this.expectViolations = false;  // a test that provokes one on purpose sets this
    this.allowImpossibleData = false; // a test seeding deliberately impossible rows (XSS payloads) sets this
  }

  // Changes the page asked for on any table (updates, inserts, deletes).
  tableWrites() {
    return this.requests.filter(r => r.table && !['GET', 'HEAD'].includes(r.method));
  }

  taskUpdates() {
    return this.requests.filter(r => r.method === 'PATCH' && r.table === 'tasks');
  }

  async handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    let body = null;
    const raw = req.postData();
    if (raw) { try { body = JSON.parse(raw); } catch (e) { body = raw; } }
    const entry = { method, path: url.pathname, query: url.search, params: [...url.searchParams], body, headers: req.headers() };

    if (url.pathname.startsWith('/auth/v1/')) {
      this.requests.push(entry);
      return this.handleAuth(route, url, method, body);
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      entry.rpc = url.pathname.slice('/rest/v1/rpc/'.length);
      this.requests.push(entry);
      // A test may give a function to answer like the real function would
      // (e.g. honouring p_limit / p_offset); otherwise a fixed reply.
      const v = Object.prototype.hasOwnProperty.call(this.rpc, entry.rpc) ? this.rpc[entry.rpc] : [];
      const result = typeof v === 'function' ? v(entry.body || {}) : v;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      entry.table = url.pathname.slice('/rest/v1/'.length);
      this.requests.push(entry);
      // Like the real gateway, refuse very long URLs (e.g. a huge .in() list).
      if (this.maxUrlLength != null && req.url().length > this.maxUrlLength) {
        return route.fulfill({ status: 414, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'URI Too Long' });
      }
      // Like the real database: refuse a write that breaks a value rule.
      if (entry.method === 'POST' || entry.method === 'PATCH') {
        const isInsert = entry.method === 'POST' && !String(entry.headers['prefer'] || '').includes('merge-duplicates');
        const bad = checkWrite(entry.table, entry.body, { isInsert });
        if (bad.length) {
          this.constraintViolations.push(...bad);
          const b = bad[0];
          return route.fulfill({
            status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify({ code: '23514', details: null, hint: null,
              message: `new row for relation "${b.table}" violates check constraint "${b.constraint}"` }),
          });
        }
      }
      const delay = this.delayMs[entry.table];
      if (delay) await new Promise(r => setTimeout(r, delay));
      return this.handleRest(route, entry);
    }
    // Storage, edge functions, anything else on the project: answer empty.
    this.requests.push(entry);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  }

  handleAuth(route, url, method, body) {
    const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    const user = {
      id: OWNER_USER.id, aud: 'authenticated', role: 'authenticated', email: OWNER_USER.email,
      app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
    };
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password' && (!body || body.email !== OWNER_USER.email || body.password !== OWNER_USER.password)) {
        return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      const now = Math.floor(Date.now() / 1000);
      return json(200, {
        access_token: fakeJwt(user), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
        refresh_token: 'synthetic-refresh-token', user,
      });
    }
    if (url.pathname === '/auth/v1/user') return json(200, user);
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
    return json(200, {});
  }

  handleRest(route, entry) {
    const { method, table, headers } = entry;
    const params = entry.params;
    const search = new URLSearchParams(entry.query);
    const rows = this.tables[table] || [];
    const prefer = headers['prefer'] || '';
    const wantsObject = (headers['accept'] || '').includes('vnd.pgrst.object');
    // Like the real API gateway: cross-origin reads allowed, and Content-Range
    // (where the exact row count travels) exposed to the page.
    const respond = (status, data, extraHeaders = {}) => route.fulfill({
      status, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extraHeaders },
      body: data === undefined ? '' : JSON.stringify(data),
    });

    if (method === 'GET' || method === 'HEAD') {
      let matched = applyOrder(applyFilters(rows, params), search.get('order'));
      const total = matched.length;
      const offset = Number(search.get('offset') || 0);
      const limit = search.get('limit') != null ? Number(search.get('limit')) : undefined;
      matched = matched.slice(offset, limit != null ? offset + limit : undefined);
      // Like Supabase's "Max rows" API setting: one reply never holds more
      // than this many rows, and nothing in the reply says it was cut short.
      if (this.maxRows != null) matched = matched.slice(0, this.maxRows);
      const extra = {};
      if (prefer.includes('count=')) {
        extra['content-range'] = matched.length ? `${offset}-${offset + matched.length - 1}/${total}` : `*/${total}`;
      }
      if (method === 'HEAD') return respond(200, undefined, extra);
      if (wantsObject) {
        if (matched.length !== 1) return respond(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${matched.length} rows` });
        return respond(200, matched[0], extra);
      }
      return respond(200, matched, extra);
    }

    if (method === 'PATCH') {
      if (table === 'tasks' && this.nextTaskUpdateHook) {
        const hook = this.nextTaskUpdateHook;
        this.nextTaskUpdateHook = null;
        hook(this);
      }
      const matched = applyFilters(rows, params);
      matched.forEach(row => Object.assign(row, entry.body));
      if (prefer.includes('return=representation')) return respond(200, matched);
      return respond(204, undefined);
    }

    if (method === 'POST') {
      // Inserts are recorded but not stored: no test here needs them to persist.
      return respond(201, prefer.includes('return=representation') ? [] : undefined);
    }
    // Deletes are recorded but not applied; with return=representation the
    // rows that would be deleted come back, like PostgREST.
    if (method === 'DELETE') return prefer.includes('return=representation') ? respond(200, applyFilters(rows, params)) : respond(204, undefined);
    return respond(200, []);
  }
}

function serveRepoFile(route, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(REPO_ROOT, rel);
  if (!file.startsWith(REPO_ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return route.fulfill({ status: 404, body: 'not found' });
  }
  const type = CONTENT_TYPES[path.extname(file)] || 'application/octet-stream';
  return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
}

async function installMocks(page) {
  const backend = new FakeSupabase();
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === DASHBOARD_ORIGIN) return serveRepoFile(route, url);
    if (url.href.startsWith(SUPABASE_CDN_PREFIX)) {
      // The pages load the library with crossorigin="anonymous" + integrity,
      // so (like the real CDN) the reply must allow cross-origin reads.
      // backend.cdnBody lets a test serve altered bytes to prove the
      // integrity check refuses them.
      backend.cdnRequests.push(url.href);
      return route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: backend.cdnBody != null ? backend.cdnBody : fs.readFileSync(SUPABASE_UMD),
      });
    }
    if (url.host === SUPABASE_HOST) return backend.handle(route);
    backend.blocked.push(url.href);
    return route.abort('blockedbyclient');
  });
  // Belt and braces: no websocket (e.g. Supabase realtime) can open either.
  await page.context().routeWebSocket(/.*/, ws => { backend.blocked.push(ws.url()); ws.close(); });
  return backend;
}

module.exports = { installMocks, FakeSupabase, DASHBOARD_ORIGIN, SUPABASE_HOST, OWNER_USER };
