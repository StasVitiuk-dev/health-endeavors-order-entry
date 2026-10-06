// Extra powers for the mock backend, used by the inventory-safety tests.
//
// The shared mock (mock-supabase.js) answers reads from synthetic data and
// applies updates, but it does not keep inserts or deletes. Tests that check
// stock arithmetic need to read back exactly what was saved, and need to
// simulate the network failing at a chosen moment. This file adds that on
// top of one backend instance, without changing the shared mock:
//
//   enableWrites(backend, ['inventory', ...])
//       inserts, upserts (on_conflict) and deletes on those tables are kept
//   backend.dropNext(table, method, { applied })
//       the next matching request fails like a dropped connection; with
//       applied: true the database saves it first and only the reply is lost
//   backend.failNext(table, method, { status, body })
//       the next matching request gets an error reply (nothing is saved)
//   backend.beforeNext(table, method, fn)
//       runs fn(tables) just before the next matching request is handled,
//       to simulate another person changing the data in between
//   backend.replyNext(table, method, { status, contentType, body, applied })
//       the next matching request gets this exact raw reply (for example an
//       HTML gateway page or a cut-off JSON body); with applied: true the
//       database saves it first (EXT4)
//   backend.delayNext(table, method, ms)
//       the next matching request is answered normally, but only after ms
//
// Everything stays inside the test browser; nothing reaches the internet.

function enableWrites(backend, tables) {
  const persisted = new Set(tables);
  const hooks = [];
  const addHook = (kind, table, method, extra) => hooks.push({ kind, table, method, ...extra });
  backend.dropNext = (table, method, { applied = false } = {}) => addHook('drop', table, method, { applied });
  backend.failNext = (table, method, { status = 500, body = { message: 'Synthetic server error' } } = {}) =>
    addHook('fail', table, method, { status, body });
  backend.beforeNext = (table, method, fn) => addHook('before', table, method, { fn });
  backend.replyNext = (table, method, { status = 200, contentType = 'application/json', body = '', applied = false } = {}) =>
    addHook('reply', table, method, { status, contentType, body, applied });
  backend.delayNext = (table, method, ms) => addHook('delay', table, method, { ms });

  const originalHandle = backend.handle.bind(backend);
  backend.handle = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : null;
    const i = hooks.findIndex(h => h.table === table && h.method === req.method());
    if (i === -1) return originalHandle(route);
    const hook = hooks.splice(i, 1)[0];
    if (hook.kind === 'before') {
      hook.fn(backend.tables);
      return originalHandle(route);
    }
    if (hook.kind === 'delay') {
      await new Promise(r => setTimeout(r, hook.ms));
      return originalHandle(route);
    }
    if (hook.kind === 'reply') {
      if (hook.applied) await originalHandle({ request: () => req, fulfill: async () => {} });
      backend.requests.push({ method: req.method(), table, rawReply: true, applied: hook.applied });
      return route.fulfill({ status: hook.status, contentType: hook.contentType, body: hook.body });
    }
    if (hook.kind === 'fail') {
      backend.requests.push({ method: req.method(), table, failed: true });
      return route.fulfill({ status: hook.status, contentType: 'application/json', body: JSON.stringify(hook.body) });
    }
    if (hook.applied) {
      await originalHandle({ request: () => req, fulfill: async () => {} });
    } else {
      backend.requests.push({ method: req.method(), table, dropped: true });
    }
    return route.abort('connectionreset');
  };

  const originalRest = backend.handleRest.bind(backend);
  backend.handleRest = (route, entry) => {
    const prefer = entry.headers['prefer'] || '';
    const wantsObject = (entry.headers['accept'] || '').includes('vnd.pgrst.object');
    const reply = (status, rows) => {
      const data = prefer.includes('return=representation') ? (wantsObject ? rows[0] : rows) : undefined;
      return route.fulfill({ status, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) });
    };
    if (!persisted.has(entry.table)) return originalRest(route, entry);
    const rows = backend.tables[entry.table] = backend.tables[entry.table] || [];
    const search = new URLSearchParams(entry.query);

    if (entry.method === 'POST') {
      const incoming = Array.isArray(entry.body) ? entry.body : [entry.body];
      const conflict = search.get('on_conflict');
      const saved = incoming.map(body => {
        const existing = conflict && rows.find(r => String(r[conflict]) === String(body[conflict]));
        if (existing) return Object.assign(existing, body);
        const row = { id: entry.table + '-' + (rows.length + 1), ...body };
        rows.push(row);
        return row;
      });
      return reply(201, saved);
    }
    if (entry.method === 'PATCH' && wantsObject) {
      const matched = rows.filter(r => entry.params.every(([k, v]) => ['select'].includes(k) || !v.startsWith('eq.') || String(r[k]) === v.slice(3)));
      matched.forEach(r => Object.assign(r, entry.body));
      return reply(200, matched);
    }
    if (entry.method === 'DELETE') {
      const hit = r => entry.params.every(([k, v]) => !v.startsWith('eq.') || String(r[k]) === v.slice(3));
      const deleted = rows.filter(hit);
      backend.tables[entry.table] = rows.filter(r => !hit(r));
      // Like PostgREST: with return=representation the deleted rows come back.
      if (prefer.includes('return=representation')) return reply(200, deleted);
      return route.fulfill({ status: 204, body: '' });
    }
    return originalRest(route, entry);
  };
}

module.exports = { enableWrites };
