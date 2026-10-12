// Request-key test helpers (EXT9/EXT10). Imitates drafts/19's
// `create unique index … (client_request_id) where client_request_id is not null`
// at the network edge: a repeated key on the same table gets 409 / 23505.
// Pass the same `shared` object to several pages/contexts to imitate one
// database seen from two tabs or two people.
function keysOn(backend, on = true) {
  backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => f.flag_key !== 'request_keys')
    .concat([{ id: 'ff-rk', flag_key: 'request_keys', label: 'Request keys', description: 'SYNTHETIC', enabled: on }]);
}
// With `backend`, a key counts as taken only when a saved row carries it (so a
// request that was lost before saving is not a repeat), like the real index.
async function uniqueKeys(context, tables, shared = { seen: {}, sent: [] }, backend = null) {
  for (const table of tables) {
    shared.seen[table] = shared.seen[table] || new Set();
    await context.route(new RegExp('/rest/v1/' + table + '(\\?|$)'), async route => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      const body = JSON.parse(req.postData() || '{}');
      const key = (Array.isArray(body) ? body[0] : body).client_request_id;
      shared.sent.push({ table, key, body });
      const taken = backend ? (backend.tables[table] || []).some(r => r.client_request_id === key) : shared.seen[table].has(key);
      if (key && taken) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "' + table + '_client_request_id_key"', details: 'Key (client_request_id)=(' + key + ') already exists.' }) });
      }
      if (key) shared.seen[table].add(key);
      return route.fallback();
    });
  }
  return shared;
}
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
module.exports = { keysOn, uniqueKeys, UUID4 };
