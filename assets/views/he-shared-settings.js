// Settings shared by every device — the dashboard side of docs/ops/sql/drafts/50
// (owner, Nov 24: "I need everything to be updated everywhere right away ... a
// bunch of phones and the computer at the same time"). A setting the owner types
// once is read from the database by every phone and computer, instead of living
// in one browser. First use: the Real profit estimates (key "profit_estimates").
// Nov 24: also the day up to which the daily recap was printed (key "recap_printed"),
// so the Home reminder clears on every device, not only where Print was pressed;
// and the shorter menu the owner chose (key "menu_layout", readable by every employee).
// Also the owner's drafts: the wording on Store Campaigns, Customer Emails and the Content
// Helper (keys "store_campaign", "customer_emails", "content_helper"; owner and administrators).
// Lists of stores and customers are never part of a setting.
//
//   get(key)          -> { state: 'installed' | 'not_installed' | 'unknown',
//                          value: object | null, updatedAt, updatedBy }
//   set(key, value)   -> { ok, message, updatedAt }   (set_shared_setting; the owner and administrators,
//                          the database checks again on its own)
//
// Until drafts/50 is installed, get() says 'not_installed' and the page keeps the
// value in the browser as before. Never holds passwords, keys or tokens: a value
// with such a name in it is refused before it is sent.
//
// Pure apart from the database client it is GIVEN (supabase-js shaped).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-shared-settings'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TABLE = 'shared_settings';
  const RPC = 'set_shared_setting';
  const KEYS = Object.freeze({ profitEstimates: 'profit_estimates', recapPrinted: 'recap_printed', menuLayout: 'menu_layout',
    storeCampaign: 'store_campaign', customerEmails: 'customer_emails', contentHelper: 'content_helper',
    handoffsHandled: 'handoffs_handled', launchList: 'launch_list' });   // launchList: the launch lines a person marked done (owner and administrators)
  const KEY_OK = /^[a-z][a-z0-9_]{1,59}$/;
  const MAX_CHARS = 8000;
  const SECRET_NAME = /pass(word|code)?|secret|token|api[_-]?key|private[_-]?key|credential|recovery/i;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Settings for every device are not installed in the database yet (drafts/50 needs the owner\'s approval).';
    }
    if (code === '42501') return /^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '23514') return 'The database refused the value (too large, or not a list of named values).';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }
  const notInstalled = (err) => {
    const code = err && err.code != null ? String(err.code) : '', msg = err && err.message != null ? String(err.message) : '';
    return code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(msg);
  };

  // every key name inside the value, however deep (bounded)
  function namesIn(value, out, depth) {
    if (depth > 6 || out.length > 500) return out;
    if (Array.isArray(value)) value.slice(0, 200).forEach(v => namesIn(v, out, depth + 1));
    else if (isObj(value)) Object.keys(value).slice(0, 200).forEach(k => { out.push(k); namesIn(value[k], out, depth + 1); });
    return out;
  }
  // a value that may be saved: a plain object, small, with nothing named like a secret
  function checkValue(key, value) {
    if (!KEY_OK.test(String(key == null ? '' : key))) return { ok: false, reason: 'This setting has no valid name.' };
    if (!isObj(value)) return { ok: false, reason: 'A setting must be a list of named values.' };
    let text;
    try { text = JSON.stringify(value); } catch (e) { return { ok: false, reason: 'This setting could not be written down.' }; }
    if (typeof text !== 'string' || text.length > MAX_CHARS) return { ok: false, reason: 'This setting is too large to save.' };
    if (namesIn(value, [], 0).some(n => SECRET_NAME.test(n))) return { ok: false, reason: 'Passwords, keys and tokens are never saved as settings.' };
    return { ok: true, value: JSON.parse(text) };
  }

  // the latest of several days written YYYY-MM-DD (anything else is ignored); null when none
  function latestDay() {
    let best = null;
    for (let i = 0; i < arguments.length; i += 1) {
      const d = typeof arguments[i] === 'string' ? arguments[i].slice(0, 10) : '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (best === null || d > best)) best = d;
    }
    return best;
  }

  function createStore(deps) {
    const d = deps || {};
    const client = d.client;
    const usable = !!(client && typeof client.from === 'function' && d.enabled !== false);

    async function get(key) {
      const none = (state, message) => ({ state: state, value: null, updatedAt: null, updatedBy: null, message: message || '' });
      if (d.enabled === false) return none('not_installed', 'Settings for every device are not in use yet.');   // nothing is requested
      if (!usable) return none('unknown', 'The database is not available here.');
      if (!KEY_OK.test(String(key == null ? '' : key))) return none('unknown', 'This setting has no valid name.');
      try {
        const res = await client.from(TABLE).select('key, value, updated_at, updated_by').eq('key', key).limit(1);
        if (res && res.error) return notInstalled(res.error) ? none('not_installed', friendlyError(res.error)) : none('unknown', friendlyError(res.error));
        const row = res && Array.isArray(res.data) ? res.data[0] : null;
        if (!row || !isObj(row.value)) return none('installed');
        return { state: 'installed', value: row.value, updatedAt: row.updated_at || null, updatedBy: row.updated_by || null, message: '' };
      } catch (e) { return none('unknown', friendlyError(e)); }
    }

    async function set(key, value, audience) {
      if (!usable || typeof client.rpc !== 'function') return { ok: false, message: 'The database is not available here.' };
      const c = checkValue(key, value);
      if (!c.ok) return { ok: false, message: c.reason };
      try {
        const res = await client.rpc(RPC, { p_key: key, p_value: c.value, p_audience: audience === 'staff' ? 'staff' : 'owner_admin' });
        if (res && res.error) return { ok: false, message: friendlyError(res.error), notInstalled: notInstalled(res.error) || String(res.error.code || '') === 'PGRST202' };
        const out = res && isObj(res.data) ? res.data : {};
        return { ok: true, message: '', updatedAt: out.updated_at || null };
      } catch (e) { return { ok: false, message: friendlyError(e) }; }
    }

    return { get: get, set: set };
  }

  // One person's own settings (drafts/58): the same on every device that person signs in to.
  // Each person reads and saves only their own; nobody else sees them, the owner included.
  const MY_TABLE = 'my_settings', MY_RPC = 'set_my_setting';
  const MY_KEYS = Object.freeze({ feedSnooze: 'feed_snooze', weekSeen: 'week_report_seen' });   // weekSeen: the newest weekly report this person opened
  function createPersonalStore(deps) {
    const d = deps || {};
    const client = d.client;
    const usable = !!(client && typeof client.from === 'function' && d.enabled !== false);
    const mine = (err) => { const t = friendlyError(err); return t.replace('Settings for every device are not installed in the database yet (drafts/50 needs the owner\'s approval).', 'Your own settings on every device are not installed in the database yet (drafts/58 needs the owner\'s approval).'); };

    async function get(key) {
      const none = (state, message) => ({ state: state, value: null, updatedAt: null, message: message || '' });
      if (d.enabled === false) return none('not_installed', 'Your own settings on every device are not in use yet.');   // nothing is requested
      if (!usable) return none('unknown', 'The database is not available here.');
      if (!KEY_OK.test(String(key == null ? '' : key))) return none('unknown', 'This setting has no valid name.');
      try {
        const res = await client.from(MY_TABLE).select('key, value, updated_at').eq('key', key).limit(1);
        if (res && res.error) return notInstalled(res.error) ? none('not_installed', mine(res.error)) : none('unknown', mine(res.error));
        const row = res && Array.isArray(res.data) ? res.data[0] : null;
        if (!row || !isObj(row.value)) return none('installed');
        return { state: 'installed', value: row.value, updatedAt: row.updated_at || null, message: '' };
      } catch (e) { return none('unknown', mine(e)); }
    }

    async function set(key, value) {
      if (!usable || typeof client.rpc !== 'function') return { ok: false, message: 'The database is not available here.' };
      const c = checkValue(key, value);
      if (!c.ok) return { ok: false, message: c.reason };
      try {
        const res = await client.rpc(MY_RPC, { p_key: key, p_value: c.value });
        if (res && res.error) return { ok: false, message: mine(res.error), notInstalled: notInstalled(res.error) || String(res.error.code || '') === 'PGRST202' };
        const out = res && isObj(res.data) ? res.data : {};
        return { ok: true, message: '', updatedAt: out.updated_at || null };
      } catch (e) { return { ok: false, message: mine(e) }; }
    }

    return { get: get, set: set };
  }

  return { TABLE, RPC, KEYS, MY_TABLE, MY_RPC, MY_KEYS, MAX_CHARS, checkValue, friendlyError, latestDay, createStore, createPersonalStore };
}));
