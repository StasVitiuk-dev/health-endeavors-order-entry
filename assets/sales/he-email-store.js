// Saved email campaigns — the dashboard side of docs/ops/sql/drafts/56 (owner, Nov 24:
// approve the wording once, then choose who it goes to; a sending guard keeps the
// business out of spam). Saves a campaign the owner approved and the list of who it
// goes to in the database. NOTHING HERE SENDS: the database only keeps the records;
// the sending program is separate and not connected.
//
//   recipients(kind, rows, opts)      -> what the database is given per address: the email,
//                                        the name, and only the fill-ins the wording uses
//   campaignName(kind, subject, day)  -> a name to start from
//   STATUS_WORDS, tally(rows)         -> counts of what happened to a campaign's emails
//   friendlyError(err)                -> one plain sentence
//   createStore({ client, enabled })  -> state(), saveAndQueue(), campaigns(kind),
//                                        setStatus(), suppress()
//
// Pure apart from the database client it is GIVEN (supabase-js shaped).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-email-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_AT_ONCE = 500;                      // the database takes at most this many addresses at a time
  const KINDS = Object.freeze(['store', 'customer']);
  const STATUS_WORDS = Object.freeze({ approved: 'Ready to send (nothing is sent yet)', paused: 'Paused', stopped: 'Stopped', done: 'Finished' });
  const EMAIL = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const str = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\r\n?/g, '\n').trim().slice(0, max || 4000);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  // Only what an email needs leaves the page: the address, the name, and the fill-ins.
  // opts.firstName: how a customer's first name is read (he-customer-campaign firstName).
  function recipients(kind, rows, opts) {
    const o = isObj(opts) ? opts : {}, out = [], seen = Object.create(null);
    if (!KINDS.includes(kind)) return out;
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (out.length >= MAX_AT_ONCE || !isObj(r)) return;
      const email = str(r.email, 254).toLowerCase(), name = str(r.name, 160);
      if (!EMAIL.test(email) || seen[email]) return;
      seen[email] = true;
      const fields = kind === 'store' ? { store: name, city: str(r.city, 120) }
        : { name: typeof o.firstName === 'function' ? str(o.firstName(name), 60) || 'there' : 'there' };
      out.push({ email: email, name: name, fields: fields });
    });
    return out;
  }

  function campaignName(kind, subject, day) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(str(day, 10)) ? str(day, 10) : '';
    const s = str(subject, 60).replace(/\{[^{}]*\}/g, '').replace(/\s+/g, ' ').trim();
    return ((kind === 'store' ? 'Stores' : 'Customers') + (d ? ' ' + d : '') + (s ? ': ' + s : '')).slice(0, 120);
  }

  // rows: [{ campaign_id, status }] -> { [campaignId]: { queued, sent, skipped, failed, back, total } }
  function tally(rows) {
    const by = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!isObj(r) || typeof r.campaign_id !== 'string') return;
      const t = by[r.campaign_id] || (by[r.campaign_id] = { queued: 0, sent: 0, skipped: 0, failed: 0, back: 0, total: 0 });
      const s = str(r.status, 20);
      if (s === 'bounced' || s === 'complaint') { t.back += 1; t.sent += 1; }      // it was sent, then came back or was marked as spam
      else if (Object.prototype.hasOwnProperty.call(t, s) && s !== 'back' && s !== 'total') t[s] += 1;
      t.total += 1;
    });
    return by;
  }

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Saving campaigns is not installed in the database yet (drafts/56 needs the owner\'s approval).';
    }
    if (code === '42501') return /^(Only |An approved campaign|This campaign|An email|Who an email)/.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '23514') return /health or medical claim/.test(msg) ? msg : 'The database refused a value (a name, subject, email or address that is too short, too long or not allowed). Nothing was saved.';
    if (code === 'P0002') return 'That campaign was not found. Nothing was changed.';
    if (code === '22023') return msg || 'The database refused the request. Nothing was changed.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '. Nothing was changed.';
  }
  const notInstalled = (err) => {
    const code = err && err.code != null ? String(err.code) : '', msg = err && err.message != null ? String(err.message) : '';
    return code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(msg);
  };

  function createStore(deps) {
    const d = deps || {}, client = d.client;
    const usable = !!(client && typeof client.from === 'function' && typeof client.rpc === 'function' && d.enabled !== false);
    const refuse = (message, extra) => Object.assign({ ok: false, message: message }, extra || {});
    let busy = false;                                              // one save at a time: a second tap never saves twice

    // -> 'installed' | 'not_installed' | 'unknown' | 'off'
    async function state() {
      if (d.enabled === false) return 'off';
      if (!usable) return 'unknown';
      try {
        const res = await client.from('email_campaigns').select('id').limit(0);
        if (!res || !res.error) return 'installed';
        return notInstalled(res.error) ? 'not_installed' : 'unknown';
      } catch (e) { return 'unknown'; }
    }

    // Saves the approved wording, then the list of who it goes to. Sends nothing.
    async function saveAndQueue(input, list) {
      if (!usable) return refuse('Saving campaigns is not switched on.');
      const i = isObj(input) ? input : {};
      const kind = KINDS.includes(i.kind) ? i.kind : '';
      const name = str(i.name, 120), subject = str(i.subject, 200), body = str(i.body, 4000), address = str(i.postalAddress, 300);
      const day = /^\d{4}-\d{2}-\d{2}$/.test(str(i.startDay, 10)) ? str(i.startDay, 10) : null;
      const recips = (Array.isArray(list) ? list : []).filter(r => isObj(r) && EMAIL.test(str(r.email, 254)));
      if (!kind) return refuse('Choose a campaign for stores or for customers.');
      if (name.length < 3) return refuse('Give the campaign a name (at least 3 characters).');
      if (address.length < 10) return refuse('Type the business postal address first. Every marketing email must carry it.');
      if (!recips.length) return refuse('There is nobody to write to. Press "Show who would get it" first.');
      if (recips.length > MAX_AT_ONCE) return refuse('At most ' + MAX_AT_ONCE + ' addresses at a time. Choose fewer.');
      if (busy) return refuse('It is being saved. Wait a moment.');
      busy = true;
      try {
        const a = await client.rpc('approve_email_campaign', { p_kind: kind, p_name: name, p_subject: subject, p_body: body, p_postal_address: address });
        if (a && a.error) return refuse(friendlyError(a.error));
        const id = a && isObj(a.data) && typeof a.data.id === 'string' ? a.data.id : '';
        if (!UUID.test(id)) return refuse('The database did not say the campaign was saved. Nothing was queued.');
        const q = await client.rpc('queue_campaign_emails', { p_campaign: id, p_recipients: recips.map(r => ({ email: str(r.email, 254).toLowerCase(), name: str(r.name, 160), fields: isObj(r.fields) ? r.fields : {} })), p_start: day });
        if (q && q.error) return refuse('The campaign was saved, but its emails could not be queued (' + friendlyError(q.error) + ') Stop the saved campaign below, or try again with a new one.', { saved: true, id: id });
        const out = q && isObj(q.data) ? q.data : {};
        const skipped = (Array.isArray(out.skipped) ? out.skipped : []).filter(isObj).slice(0, 500).map(s => ({ email: str(s.email, 254), why: str(s.why, 200) }));
        return { ok: true, message: '', id: id, queued: Number.isInteger(out.queued) ? out.queued : 0, skipped: skipped,
          firstDay: typeof out.first_day === 'string' ? out.first_day.slice(0, 10) : '', lastDay: typeof out.last_day === 'string' ? out.last_day.slice(0, 10) : '', sent: false };
      } catch (e) { return refuse(friendlyError(e)); } finally { busy = false; }
    }

    // the saved campaigns of one kind, newest first, with what happened to their emails
    async function campaigns(kind) {
      if (!usable) return refuse('Saving campaigns is not switched on.', { rows: [] });
      if (!KINDS.includes(kind)) return refuse('Unknown kind of campaign.', { rows: [] });
      try {
        const c = await client.from('email_campaigns').select('id, kind, name, subject, status, stop_reason, approved_at').eq('kind', kind).order('approved_at', { ascending: false }).limit(20);
        if (c && c.error) return refuse(friendlyError(c.error), { rows: [], notInstalled: notInstalled(c.error) });
        const list = (c && Array.isArray(c.data) ? c.data : []).filter(r => isObj(r) && typeof r.id === 'string');
        let counts = Object.create(null);
        if (list.length) {
          const o = await client.from('email_outbox').select('campaign_id, status').in('campaign_id', list.map(r => r.id)).limit(10000);
          if (o && o.error) return refuse(friendlyError(o.error), { rows: [] });
          counts = tally(o && Array.isArray(o.data) ? o.data : []);
        }
        return { ok: true, message: '', rows: list.map(r => ({ id: r.id, name: str(r.name, 120), subject: str(r.subject, 200), status: str(r.status, 20), stopReason: str(r.stop_reason, 500),
          approvedAt: typeof r.approved_at === 'string' ? r.approved_at : '', counts: counts[r.id] || { queued: 0, sent: 0, skipped: 0, failed: 0, back: 0, total: 0 } })) };
      } catch (e) { return refuse(friendlyError(e), { rows: [] }); }
    }

    async function setStatus(id, status, reason) {
      if (!usable) return refuse('Saving campaigns is not switched on.');
      if (!UUID.test(str(id, 40)) || !['approved', 'paused', 'stopped'].includes(status)) return refuse('A campaign can be paused, resumed or stopped.');
      try {
        const res = await client.rpc('set_email_campaign_status', { p_campaign: id, p_status: status, p_reason: str(reason, 400) || null });
        if (res && res.error) return refuse(friendlyError(res.error));
        const out = res && isObj(res.data) ? res.data : {};
        return { ok: true, message: '', status: str(out.status, 20) || status, skipped: Number.isInteger(out.skipped) ? out.skipped : 0 };
      } catch (e) { return refuse(friendlyError(e)); }
    }

    // someone asked not to be emailed: the address goes on the do-not-email list for good
    async function suppress(email, note) {
      if (!usable) return refuse('Saving campaigns is not switched on.');
      const e = str(email, 254).toLowerCase();
      if (!EMAIL.test(e)) return refuse('That is not an email address.');
      try {
        const res = await client.rpc('add_email_suppression', { p_email: e, p_reason: 'unsubscribed', p_note: str(note, 500) || null });
        if (res && res.error) return refuse(friendlyError(res.error));
        const out = res && isObj(res.data) ? res.data : {};
        return { ok: true, message: '', email: e, added: out.added === true, skipped: Number.isInteger(out.skipped) ? out.skipped : 0 };
      } catch (err) { return refuse(friendlyError(err)); }
    }

    return { state, saveAndQueue, campaigns, setStatus, suppress };
  }

  return { MAX_AT_ONCE, KINDS, STATUS_WORDS, recipients, campaignName, tally, friendlyError, createStore };
}));
