// assets/app/he-data.js — database access: the Supabase client (row-cap aware), request generation, paged reads, guarded updates, request keys, stock functions, uploads, error kinds
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-data', { api: 1, needs: ['INVENTORY_BUCKET_LABELS','ROW_CAP','STOCK_FN_FLAGS','SUPABASE_ANON_KEY','SUPABASE_URL','classifyOrderStatus','explainDbError','isNetworkError','keyFingerprint','newRequestKey','toast'] }, function (ctx) {
    const { INVENTORY_BUCKET_LABELS, ROW_CAP, STOCK_FN_FLAGS, SUPABASE_ANON_KEY, SUPABASE_URL, classifyOrderStatus, explainDbError, isNetworkError, keyFingerprint, newRequestKey, toast } = ctx;
 // orders offered in the "log a return" menu (EXT8)
    // EXT8: lists that show only the most recent rows (recycle bins, history)
    // say how many there are in all and can show more, so nothing - an old
    // deleted order to restore, say - is out of reach.
    // EXT8: "latest request wins". A slow, older load (e.g. the Today figures
    // after you already clicked All Time) must not draw over a newer one.
    const LOAD_TOKENS = {};
    function newLoadToken(key){ const t = (LOAD_TOKENS[key] || 0) + 1; LOAD_TOKENS[key] = t; return () => LOAD_TOKENS[key] === t; }
    const LIST_LIMITS = {};
    const listLimit = key => LIST_LIMITS[key] || 50;
    function appendMore(wrapId, key, shown, total, noun, reload){
      const wrap = document.getElementById(wrapId);
      if (!wrap || total == null || total <= shown) return;
      const p = document.createElement('p');
      p.className = 'hint listMore';
      p.style.margin = '8px 0 0';
      p.textContent = 'Showing the ' + shown + ' most recent of ' + total + ' ' + noun + '. ';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'small secondary'; b.textContent = 'Show more';
      b.addEventListener('click', () => { b.disabled = true; LIST_LIMITS[key] = listLimit(key) + 50; reload(); });
      p.appendChild(b);
      wrap.appendChild(p);
    }
    const rowCapTables = new Set();
    function noteRowCap(table){
      if (rowCapTables.has(table)) return;
      rowCapTables.add(table);
      const el = document.getElementById('rowCapNotice');
      if (!el) return;
      el.textContent = 'A list on this dashboard reached the 1,000-record reading limit (' + Array.from(rowCapTables).join(', ') + '), so it may be missing older records. Totals and money figures are not affected: they are read in full. The list needs paging; please report this.';
      el.style.display = 'block';
    }
    // EXT18: how many changes (anything but a read) have been sent and are still
    // waiting for their reply. A sign-out elsewhere during that time must not be
    // reported as "nothing was sent": the change was sent and may have landed.
    let writesWaiting = 0;
    const writesInFlight = () => writesWaiting;
    function capAwareFetch(input, init){
      const method = String((init && init.method) || 'GET').toUpperCase();
      let isWrite = false;
      try {
        const p = new URL(typeof input === 'string' ? input : input.url).pathname;
        isWrite = method !== 'GET' && method !== 'HEAD' && (p.indexOf('/rest/v1/') === 0 || p.indexOf('/storage/v1/') === 0);
      } catch (_) { /* unknown address: not counted */ }
      if (isWrite) writesWaiting++;
      const settled = () => { if (isWrite) writesWaiting--; };
      return fetch(input, init).then(res => {
        settled();
        try {
          const url = new URL(typeof input === 'string' ? input : input.url);
          if (method === 'GET' && res.ok && url.pathname.indexOf('/rest/v1/') === 0 && !url.searchParams.has('limit')) {
            res.clone().json().then(rows => {
              if (Array.isArray(rows) && rows.length >= ROW_CAP) noteRowCap(url.pathname.slice('/rest/v1/'.length));
            }).catch(() => {});
          }
        } catch (_) { /* never break a read over the notice */ }
        return res;
      }, err => { settled(); throw err; });
    }
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: capAwareFetch } });
    const verifyOnly = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'he_password_check_only',
        // Skip the shared cross-tab lock entirely. This client has no session
        // to protect, and waiting on that lock is what made the prompt hang.
        lock: (name, acquireTimeout, fn) => fn(),
      },
    });
    function errorKind(text){
      const t = String(text || '');
      if (/connection|network|offline|dropped|cannot tell|may or may not/i.test(t)) return 'connection / outcome unknown';
      if (/permission|not permitted|row-level|only the owner|sign in again/i.test(t)) return 'permission / sign-in';
      if (/changed since|changed elsewhere|already changed|someone else/i.test(t)) return 'conflict (changed elsewhere)';
      if (/not installed|switch/i.test(t)) return 'switch / database step missing';
      return 'other';
    }

    // ---------- guarded changes (same idea as Task buttons v2) ----------
    // Changes one row only while it still looks the way this page last saw
    // it. The database checks the condition and applies the change in one
    // step, so a stale tab, a second person or a double click can never
    // silently overwrite a newer decision: they get "already changed" instead.
    //   expected: { column: value }      value must still match
    //             { column: [a, b] }     value must be one of these
    //             { column: null }       value must still be empty
    //             { column: { notIs: true } }  value must not be true (null or false)
    // Returns true only when exactly one row changed. Zero rows means the row
    // moved on, was removed, or row-level security refused it.
    // id is the row's id, or an object of key columns, e.g. { agent_num: 7 }.
    async function updateIfUnchanged(table, id, patch, expected){
      let q = supabase.from(table).update(patch);
      // Read back only the key column(s) used, so tables keyed by something
      // other than id (agent_controls.agent_num) work whether or not they
      // also have an id column.
      let keyCols = 'id';
      if (id !== null && typeof id === 'object') { Object.keys(id).forEach(k => { q = q.eq(k, id[k]); }); keyCols = Object.keys(id).join(','); }
      else q = q.eq('id', id);
      Object.keys(expected || {}).forEach(col => {
        const v = expected[col];
        if (Array.isArray(v)) q = q.in(col, v);
        else if (v === null || v === undefined) q = q.is(col, null);
        else if (typeof v === 'object' && 'notIs' in v) q = q.not(col, 'is', v.notIs);
        else if (typeof v === 'boolean') q = q.is(col, v);
        else q = q.eq(col, v);
      });
      const { data, error } = await q.select(keyCols);
      if (error) throw error;
      return Array.isArray(data) && data.length === 1;
    }
    // Compare-and-set stock change for one product. Reads the stock row,
    // works out the new numbers, and writes them only if nobody changed those
    // numbers in between: the write carries the numbers it read as its
    // condition. If someone did (another person, tab or agent), it reads
    // again and retries, up to 5 times. Two saves at once can then never
    // silently overwrite each other, and the below-zero check always uses
    // fresh numbers. (Stock and its history are still two writes; the
    // all-or-nothing version is the adjust_inventory database function, R4.)
    //   deltas: { available: 5, recalled: -5 }
    // Throws an Error with .belowZero = { bucket, current, result } when a
    // bucket would go negative; nothing is written in that case.
    // X11-02/03: after a dropped connection on a claim (a status change that
    // gates a stock move), read the row back once: 'not_saved' (still in the
    // old status), 'saved' (already in the new one: the stock step after the
    // claim never ran from this screen) or 'unknown' (could not read).
    async function claimOutcomeAfterDrop(table, id, fromStatus, toStatus){
      try {
        const { data, error } = await supabase.from(table).select('status').eq('id', id).maybeSingle();
        if (error || !data) return 'unknown';
        if (data.status === fromStatus) return 'not_saved';
        if (data.status === toStatus) return 'saved';
        return 'unknown';
      } catch (_) { return 'unknown'; }
    }
    async function changeStock(productId, deltas, uid){
      const buckets = Object.keys(deltas);
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: inv, error: readErr } = await supabase
          .from('inventory').select('*').eq('product_id', productId).maybeSingle();
        if (readErr) throw readErr;
        const before = {}, after = {};
        const patch = { updated_at: new Date().toISOString(), updated_by: uid };
        for (const b of buckets) {
          before[b] = Number((inv && inv[b]) || 0);
          after[b] = before[b] + Number(deltas[b]);
          if (!Number.isFinite(before[b]) || !Number.isFinite(after[b])) {
            throw new Error('The saved ' + (INVENTORY_BUCKET_LABELS[b] || b) + ' number for this product isn\'t a valid number, so nothing was changed. It needs fixing by hand before stock can move.');
          }
          if (after[b] < 0) {
            const e = new Error('That would leave ' + (INVENTORY_BUCKET_LABELS[b] || b) + ' at ' + after[b] + ', which isn\'t allowed — only ' + before[b] + ' available in that bucket right now.');
            e.belowZero = { bucket: b, current: before[b], result: after[b] };
            throw e;
          }
          patch[b] = after[b];
        }
        if (!inv) {
          const { error: insErr } = await supabase.from('inventory').insert({ product_id: productId, ...patch });
          if (!insErr) return { before, after };
          if (String(insErr.code) === '23505') continue; // created by someone else a moment ago: read it and retry
          insErr.stockAttempt = { before, after }; // EXT17: lets a lost reply be checked afterwards
          throw insErr;
        }
        let q = supabase.from('inventory').update(patch).eq('product_id', productId);
        for (const b of buckets) q = (inv[b] === null || inv[b] === undefined) ? q.is(b, null) : q.eq(b, inv[b]);
        const { data: changed, error: updErr } = await q.select('product_id');
        if (updErr) { updErr.stockAttempt = { before, after }; throw updErr; } // EXT17: see above
        if (Array.isArray(changed) && changed.length === 1) return { before, after };
        // No row changed. Either someone changed the numbers (retry), or the
        // database's rules refused this user (row-level security answers with
        // "0 rows", not an error). If the numbers are exactly as read, it was
        // a refusal: stop and say so instead of retrying.
        const { data: again, error: againErr } = await supabase
          .from('inventory').select('*').eq('product_id', productId).maybeSingle();
        if (againErr) throw againErr;
        if (again && buckets.every(b => String(again[b]) === String(inv[b]))) {
          const e = new Error('You do not have permission to change stock (only the Owner or an Administrator can). Nothing was changed.');
          e.permissionDenied = true;
          throw e;
        }
      }
      throw new Error('The stock for this product kept changing while saving (someone else is adjusting it right now). Nothing was changed on this try — refresh and try again.');
    }
    async function stockFunctionOn(kind){
      try {
        const { data, error } = await supabase.from('feature_flags').select('enabled').eq('flag_key', STOCK_FN_FLAGS[kind]).maybeSingle();
        return !error && !!data && data.enabled === true;
      } catch (e) { return false; }
    }
    // Calls one of the functions. Throws an Error whose .kind says what the
    // person can do next: 'missing' (switched on, not installed: nothing ran),
    // 'unknown' (no reply: it may or may not have happened) or 'refused' (the
    // database said no inside its transaction: nothing was changed).
    async function callStockFunction(name, args){
      let res;
      try { res = await supabase.rpc(name, args); }
      catch (e) { const er = new Error(String((e && e.message) || e)); er.kind = 'unknown'; throw er; }
      const err = res && res.error;
      if (err) {
        const code = String(err.code || '');
        const er = new Error(explainDbError(err.message || String(err)));
        er.code = code; er.hint = err.hint || '';
        er.kind = (code === 'PGRST202' || code === '42883' || /could not find the function/i.test(err.message || '')) ? 'missing'
          : (isNetworkError(err) || /^5\d\d$/.test(code) || !code) ? 'unknown' : 'refused';
        throw er;
      }
      return (res && res.data) || {};
    }
    // Before a stock switch can be turned ON: is its function installed? Each
    // probe is a call the function refuses at its very first check (or finds
    // nothing to do), so it never changes anything. true = installed, false =
    // not installed, null = could not tell (connection).
    const ZERO_ID = '00000000-0000-0000-0000-000000000000';
    const STOCK_FN_PROBES = {
      stock_fn_receive_po: ['receive_purchase_order', { p_po_id: ZERO_ID, p_lots: 'not-a-list' }],
      stock_fn_recall: ['quarantine_recall', { p_recall_id: ZERO_ID }],
      stock_fn_return: ['receive_return', { p_return_id: ZERO_ID, p_disposition: '' }],
      stock_fn_adjust: ['adjust_inventory', { p_product_id: ZERO_ID, p_bucket: 'available', p_change: 0 }],
      stock_fn_delete_product: ['delete_unused_product', { p_product_id: ZERO_ID }],
    };
    async function stockFunctionInstalled(flagKey){
      const probe = STOCK_FN_PROBES[flagKey];
      if (!probe) return true;
      try { await callStockFunction(probe[0], probe[1]); return true; }
      catch (err) { return err.kind === 'missing' ? false : err.kind === 'unknown' ? null : true; }
    }
    // EXT9: request keys (drafts/19). With the 'request_keys' switch on, a
    // create sends a random key made for that attempt and kept until it
    // succeeds, so a repeat after a lost reply is refused by the database's
    // unique index instead of saving a second record. Off, missing or
    // unreadable switch = no key is sent (today's behaviour). Must stay off
    // until drafts/19 is installed (an unknown column fails every save).
    async function requestKeysOn(){
      try {
        const { data, error } = await supabase.from('feature_flags').select('enabled').eq('flag_key', 'request_keys').maybeSingle();
        return !error && !!data && data.enabled === true;
      } catch (e) { return false; }
    }
    // The key belongs to the form until a save succeeds (a retry reuses it).
    // EXT10 (U42) lifecycle: the key is also tied to the signed-in person
    // (another person in the same tab gets a new key) and, when the caller
    // passes what is being saved, to that content: different content more
    // than KEY_FRESH_MS after the first attempt is a new entry, not a retry,
    // so it gets a new key. Different content sooner keeps the key (a quick
    // edit right after a lost reply is refused as a repeat and the person is
    // told, rather than risking a duplicate). Reload = no key (the page then
    // says to check the list first).
    const KEY_FRESH_MS = 10 * 60 * 1000;
    async function formRequestKey(form, payload){
      if (!(await requestKeysOn())) return null;
      const d = form.dataset;
      const uid = (await currentUserId().catch(() => null)) || '';
      const fp = payload === undefined ? null : keyFingerprint(payload);
      const stale = !!d.requestKey && (d.requestKeyUser !== uid
        || (fp !== null && !!d.requestKeyFp && d.requestKeyFp !== fp && Date.now() - Number(d.requestKeyAt || 0) > KEY_FRESH_MS));
      if (!d.requestKey || stale) { d.requestKey = newRequestKey(); d.requestKeyAt = String(Date.now()); }
      d.requestKeyUser = uid;
      if (fp !== null) d.requestKeyFp = fp;
      return d.requestKey;
    }
    function clearRequestKey(form){
      if (!form) return;
      ['requestKey', 'requestKeyAt', 'requestKeyUser', 'requestKeyFp'].forEach(k => delete form.dataset[k]);
    }
    // fixedRequestKey(text) (helpers): a key made from a fixed text, for an action
    // that may happen only once per record (escalating to an incident).
    // One create, with a request key when the switch is on. A repeat of an
    // attempt that was in fact saved is reported (toast) and counts as done;
    // a lost reply says whether pressing again is safe.
    async function insertOnce(el, table, row, what){
      const rk = el ? await formRequestKey(el, row) : null;
      const { error } = await supabase.from(table).insert(withRequestKey(row, rk));
      if (isRequestKeyRepeat(error)) { clearRequestKey(el); toast(what + REPEAT_NOTE); return { error: null, repeated: true }; }
      if (!error) { clearRequestKey(el); return { error: null, repeated: false }; }
      if (isNetworkError(error)) {
        const it = what.charAt(0).toLowerCase() + what.slice(1);
        return { error: new Error(rk
          ? 'The connection dropped, so it is not clear whether ' + it + ' was saved. Pressing the button again is safe: it will not be added twice.'
          : 'The connection dropped, so ' + it + ' may or may not have been saved. Check the list before adding it again.'), repeated: false };
      }
      return { error, repeated: false };
    }
    function withRequestKey(row, key){ return key ? Object.assign({}, row, { client_request_id: key }) : row; }
    function isRequestKeyRepeat(err){ return !!err && String(err.code) === '23505' && /client_request_id/.test(String(err.message || '') + String(err.details || '')); }
    const REPEAT_NOTE = ' was already saved by an earlier attempt (its reply was lost), so it was not added again. Check the list: if you changed anything since, those changes were not saved.';
    function stockFunctionError(err, what, retrySafe){
      if (err.kind === 'missing') return 'The all-or-nothing database function for ' + what + ' is switched on but is not installed, so nothing was changed. Turn its switch off on Feature Switches (or install the function), then try again.';
      if (err.kind === 'unknown') return 'The connection dropped, so the dashboard cannot tell whether ' + what + ' happened. '
        + (retrySafe ? 'Reload and look first; trying again is safe — the database does it only once.' : 'Reload the page and check the stock and its history before trying again.');
      return 'Nothing was changed: ' + err.message;
    }
    // Reads every matching row, a page at a time. One request returns at most
    // Supabase's "Max rows" setting (1,000 by default) and does NOT say when it
    // stopped short, so a report that adds rows up in the browser would quietly
    // undercount (finding N14). This asks for the exact total with the first
    // page and keeps reading until it has every row; if rows go missing it
    // throws rather than return a partial list. Ordered by id so pages don't
    // overlap. Long-term the totals belong in a database function (one small
    // row back) — that needs the schema check first.
    // EXT5: pages continue AFTER the last id read (keyset), not at a position.
    // With positions, a record created or soft-deleted between two pages
    // shifted everything by one, so one record was counted twice and another
    // missed, silently, in money totals. Stops at a short page once every
    // counted record is in, otherwise reads on to an empty page (a server set
    // to cap pages below PAGE is still read to the end); the first page's
    // exact count is used to notice records that went missing.
    async function fetchAllRows(table, columns, applyFilters){
      const PAGE = 1000;
      const rows = [];
      const seen = new Set();
      let total = null, lastId = null;
      for (let pageNo = 0; pageNo < 10000; pageNo++) {
        let q = supabase.from(table).select(columns, pageNo === 0 ? { count: 'exact' } : undefined);
        q = applyFilters(q);
        if (lastId !== null) q = q.gt('id', lastId);
        q = q.order('id', { ascending: true }).range(0, PAGE - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        if (pageNo === 0) total = (typeof count === 'number') ? count : null;
        const batch = data || [];
        for (const r of batch) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
        // A page shorter than asked for is the end of the data (PAGE equals
        // Supabase's default per-reply limit, so a capped page is never short),
        // once every counted record is in. Saves an extra request, and keeps a
        // long id list (fetchAllRowsIn) from growing past URL limits.
        if (batch.length && batch.length < PAGE && (total === null || rows.length >= total)) return rows;
        if (!batch.length) {
          if (total !== null && rows.length < total) {
            throw new Error('Only ' + rows.length + ' of ' + total + ' ' + table + ' records could be read, so this total would be wrong. Refresh to try again.');
          }
          return rows;
        }
        lastId = batch[batch.length - 1].id;
      }
      throw new Error('Too many ' + table + ' records to add up in the browser.');
    }

    // fetchAllRows for "rows whose <column> is one of these values". A long
    // .in() list goes into the URL, and real gateways reject URLs past a few
    // KB (2,500 order ids would be ~90 KB), so the list is sent in chunks.
    async function fetchAllRowsIn(table, columns, column, values, applyFilters){
      const CHUNK = 150;
      const out = [];
      for (let i = 0; i < values.length; i += CHUNK) {
        const part = values.slice(i, i + CHUNK);
        out.push(...await fetchAllRows(table, columns, q => {
          q = q.in(column, part);
          return applyFilters ? applyFilters(q) : q;
        }));
      }
      return out;
    }


    // Uploads a file, then saves the record that points at it
    // (saveRecord(path) → { error }). If the record is refused, the file is
    // removed again, so nothing is left that no page can show. If the
    // connection dropped while saving, the record may have been saved anyway
    // (only the reply lost): it looks first, so a saved record never loses
    // its file. Returns normally only when the record is saved.
    async function uploadThenSave(bucket, table, column, path, file, saveRecord){
      const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadErr) throw uploadErr;
      const { error } = await saveRecord(path);
      if (!error) return;
      if (isNetworkError(error)) {
        const { data: saved, error: checkErr } = await supabase.from(table).select('id').eq(column, path).maybeSingle();
        if (!checkErr && saved) return;
        if (checkErr) {
          throw new Error('The connection dropped while saving, so it isn’t clear whether it was saved. The uploaded file was kept ("' + path + '"). Reload and check the list before trying again.');
        }
      }
      const { error: cleanupErr } = await supabase.storage.from(bucket).remove([path]);
      if (cleanupErr) {
        throw new Error((error.message || error) + ' — and the uploaded file could not be removed again; tell the owner it is left in storage as "' + path + '".');
      }
      throw error;
    }
    // One rule, used by Accounting and by the Home checks (EXT6 / EXT8):
    // manual orders that count as revenue but have no order lines.
    async function manualOrdersWithoutItems(orders){
      const counted = orders.filter(o => {
        const c = classifyOrderStatus(o.status);
        return o.source === 'manual' && !(c.isCancelled || (c.isRefund && !c.isPartialRefund));
      });
      const lines = counted.length ? await fetchAllRowsIn('order_items', 'id, order_id', 'order_id', counted.map(o => o.id)) : [];
      const withItems = new Set(lines.map(l => l.order_id));
      return counted.filter(o => !withItems.has(o.id));
    }
    // Re-reads an order's status straight from the database. Used before
    // changes that can't carry their own condition (adding/removing lines),
    // so a page left open doesn't edit an order that has moved on.
    async function poStatusNow(poId){
      const { data, error } = await supabase.from('purchase_orders').select('status').eq('id', poId).maybeSingle();
      if (error) throw error;
      return data ? data.status : null;
    }

    // Privacy Access Logging: records that customer personal info (name/email) was
    // displayed in the dashboard, so there's an audit trail of who viewed what and when.
    // Best-effort — if the log call fails, we don't want that to break order viewing.
    function logCustomerAccess(rows, reason) {
      try {
        const emails = [...new Set((rows || []).map(o => o.customer_email).filter(Boolean))];
        emails.forEach(email => {
          supabase.rpc('log_customer_data_access', { p_customer_email: email, p_reason: reason })
            .then(({ error }) => { if (error) console.warn('Privacy log failed:', error.message); });
        });
      } catch (err) {
        console.warn('Privacy log failed:', err);
      }
    }

    // ---------- Inventory (manual stock tracking, per product) ----------
    async function currentUserId(){
      const { data } = await supabase.auth.getSession();
      return data && data.session ? data.session.user.id : null;
    }


    // How refunds recorded on the Returns page count against revenue. This is
    // an accounting decision for the owner (finding N4), kept in one place so
    // Accounting and Tax Records always agree:
    //   'status_only' (today's behaviour): revenue drops only when an order's
    //       own status says cancelled / refunded; Returns refunds are ignored.
    //   'subtract_return_refunds': also subtract refund_amount recorded on
    //       Returns, in the period of refunded_at — except for orders in the
    //       same list already excluded by their status, so nothing is taken
    //       off twice.
    // (typed as a plain string: the other policy is a real, owner-selectable option — N4 —
    // not dead code; EXT15 type-check pilot)
    const ACCOUNTING_REFUND_POLICY = /** @type {string} */ ('status_only');
    async function returnRefundsIn(start, end){
      if (ACCOUNTING_REFUND_POLICY !== 'subtract_return_refunds') return [];
      return fetchAllRows('returns', 'id, order_id, refund_amount, refunded_at', q => {
        q = q.not('refund_amount', 'is', null);
        if (start) q = q.gte('refunded_at', start.toISOString());
        if (end) q = q.lt('refunded_at', end.toISOString());
        return q;
      });
    }

  return { writesInFlight, newLoadToken, LIST_LIMITS, listLimit, appendMore, supabase, verifyOnly, updateIfUnchanged, claimOutcomeAfterDrop, changeStock, stockFunctionOn, callStockFunction, STOCK_FN_PROBES, stockFunctionInstalled, requestKeysOn, formRequestKey, clearRequestKey, insertOnce, withRequestKey, isRequestKeyRepeat, REPEAT_NOTE, stockFunctionError, fetchAllRows, fetchAllRowsIn, uploadThenSave, currentUserId, logCustomerAccess, poStatusNow, ACCOUNTING_REFUND_POLICY, returnRefundsIn, manualOrdersWithoutItems, errorKind };
});
