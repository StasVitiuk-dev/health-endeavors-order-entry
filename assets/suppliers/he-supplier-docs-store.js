// Supplier document storage adapter — the dashboard side of
// docs/ops/sql/drafts/36 (owner decisions of Nov 16-17).
//
// OFF unless the caller passes enabled: true, and the screen only does that
// behind its own switch AND after a probe finds the tables installed. Until the
// owner approves and installs drafts/36, nothing here can save anything.
//
// Pure apart from the database client it is GIVEN (supabase-js shaped: from(),
// rpc()); it never creates one and never reads keys. The database enforces every
// rule again on its own (drafts/36); this file gives plain-English messages
// earlier and maps the shapes onto the checklist engine (he-supplier-docs.js):
//   * staff, administrators and the owner may record that a document arrived
//   * ONLY the owner approves, rejects, corrects, withdraws an approved document
//     or changes the checklist
//   * every recording carries a request key; the page keeps the same key until
//     the save succeeds, so a retry after a lost reply never records twice
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.suppliers = root.HE.suppliers || {})['he-supplier-docs-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  // Every column read. A test checks each one against the CREATE TABLEs in drafts/36.
  const COLUMNS = {
    supplier_document_types: ['key', 'label', 'subject_kind', 'profile', 'profile_label', 'stages', 'also_when_paid', 'is_active', 'sort_order'],
    supplier_type_document_profiles: ['supplier_type', 'profiles'],
    supplier_document_supplier_profiles: ['supplier_id', 'profiles'],
    supplier_document_subjects: ['supplier_id', 'subject_kind', 'subject_ref', 'label', 'is_active'],
    supplier_documents: ['id', 'supplier_id', 'kind', 'subject_kind', 'subject_ref', 'subject_label', 'reference', 'received_on', 'document_date',
      'expires_on', 'status', 'recorded_by', 'recorded_at', 'record_note', 'reviewed_by', 'reviewed_at', 'review_note', 'withdrawn_by', 'withdrawn_at', 'withdraw_note'],
    supplier_document_events: ['id', 'document_id', 'area', 'event', 'by_user', 'at', 'note', 'detail'],
  };
  const RPC = {
    record: { name: 'record_supplier_document', params: ['p_request_key', 'p_supplier_id', 'p_kind', 'p_subject_kind', 'p_subject_ref', 'p_subject_label', 'p_reference', 'p_received_on', 'p_document_date', 'p_expires_on', 'p_note'] },
    review: { name: 'review_supplier_document', params: ['p_id', 'p_decision', 'p_note'] },
    withdraw: { name: 'withdraw_supplier_document', params: ['p_id', 'p_note'] },
    typeProfiles: { name: 'set_supplier_type_document_profiles', params: ['p_supplier_type', 'p_profiles'] },
    typeActive: { name: 'set_supplier_document_type_active', params: ['p_key', 'p_active'] },
  };
  const ROLES_MAY_RECORD = new Set(['owner', 'administrator', 'employee']);
  const MAX_DOCS = 1000, MAX_EVENTS = 300;
  const OFF_MESSAGE = 'Supplier document storage is off. Nothing was saved. (It needs the owner-approved database step drafts/36 and a reviewed switch.)';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const isUuid = (v) => typeof v === 'string' && UUID.test(v);
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const text = (v) => (v == null ? '' : String(v)).trim();
  const day = (v) => { const s = text(v).slice(0, 10); return DAY.test(s) ? s : null; };
  const rows = (res) => (Array.isArray(res && res.data) ? res.data : []);

  function friendlyError(err) {
    if (err == null) return 'The database did not say what went wrong.';
    const code = err.code != null ? String(err.code) : '';
    const msg = err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Supplier document storage is not installed in the database yet (drafts/36 needs the owner\'s approval). Nothing was saved.';
    }
    // drafts/36 words every refusal for people; only Postgres's own wording is replaced
    if (code === '42501') return !msg || /^permission denied|row-level security/i.test(msg) ? 'You do not have permission to do that. Nothing was changed.' : msg;
    if (code === '23514') return 'A value is outside what the database accepts. Nothing was changed. (' + msg + ')';
    if (code === '23505') return 'That would duplicate an existing record. Nothing was changed.';
    if (code === '22023' || code === 'P0002') return msg || 'The database refused the request.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }

  // The checklist the database holds, in the shape he-supplier-docs.js takes.
  // Switched-off document types drop out of every checklist.
  function checklistFrom(types, typeProfiles) {
    const active = (types || []).filter(function (t) { return t && t.is_active !== false; })
      .slice().sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });
    const doc = function (t) {
      const d = { key: text(t.key), label: text(t.label), per: text(t.subject_kind) };
      if (t.profile === 'purchase') { d.stages = Array.isArray(t.stages) ? t.stages.slice() : []; if (t.also_when_paid === true) d.alsoWhenPaid = true; }
      return d;
    };
    const profiles = {};
    active.filter(function (t) { return t.profile !== 'purchase'; }).forEach(function (t) {
      const p = text(t.profile);
      if (!profiles[p]) profiles[p] = { label: text(t.profile_label) || p, documents: [] };
      profiles[p].documents.push(doc(t));
    });
    const byType = {};
    (typeProfiles || []).forEach(function (r) {
      if (r && text(r.supplier_type)) byType[text(r.supplier_type)] = (Array.isArray(r.profiles) ? r.profiles : []).filter(function (p) { return profiles[p]; });
    });
    return { purchase: active.filter(function (t) { return t.profile === 'purchase'; }).map(doc), profiles: profiles, profilesByType: byType };
  }

  // One stored document in the engine's shape. Withdrawn ones are left out of
  // the checklist (they are history, not documents on file).
  function documentFrom(r) {
    if (!isObj(r)) return null;
    return {
      id: r.id, supplier_id: r.supplier_id, kind: text(r.kind), subjectKind: text(r.subject_kind), subjectId: text(r.subject_ref),
      subjectLabel: r.subject_label || null, reference: r.reference || null,
      status: r.status === 'received' ? 'received' : text(r.status),
      receivedAt: day(r.received_on), documentDate: day(r.document_date), expiresOn: day(r.expires_on),
      recordedBy: r.recorded_by || null, recordedAt: r.recorded_at || null,
      reviewedBy: r.status === 'approved' || r.status === 'rejected' || r.status === 'withdrawn' ? (r.reviewed_by || null) : null,
      reviewedAt: r.reviewed_at || null, reviewNote: r.review_note || r.withdraw_note || null,
      withdrawnBy: r.withdrawn_by || null, withdrawnAt: r.withdrawn_at || null,
    };
  }

  function createStore(options) {
    const o = options || {};
    const client = o.client || null;
    const enabled = o.enabled === true;
    const role = o.role == null ? null : String(o.role);
    const inFlight = new Set();
    const isOwner = role === 'owner';

    function off() { return { ok: false, off: true, message: OFF_MESSAGE }; }
    function refuse(message, extra) { return Object.assign({ ok: false, message: message }, extra || {}); }
    function ready() {
      if (!enabled) return off();
      if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') return refuse('No database connection was given. Nothing was saved.');
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); }
      catch (e) { return refuse(friendlyError(e), { error: true }); }
      finally { inFlight.delete(key); }
    }
    async function call(rpc, values) {
      const args = {}; rpc.params.forEach(function (p, i) { args[p] = values[i] === undefined ? null : values[i]; });
      const res = await client.rpc(rpc.name, args);
      if (res && res.error) return { error: friendlyError(res.error) };
      return { data: isObj(res && res.data) ? res.data : {} };
    }

    async function probe() {
      const r = ready(); if (r) return r;
      return once('probe', async function () {
        const res = await client.from('supplier_documents').select('id').limit(1);
        if (res && res.error) { const m = friendlyError(res.error); return refuse(m, { installed: !/not installed/.test(m) }); }
        return { ok: true, installed: true, message: 'Supplier document storage is installed and readable.' };
      });
    }

    // Everything the checklist screen needs, read fresh (so a page refresh shows
    // exactly what the database holds).
    async function load() {
      const r = ready(); if (r) return r;
      return once('load', async function () {
        const q = function (t, cols) { return client.from(t).select(cols.join(',')); };
        const [types, tp, sp, subj, docs, ev, sups, pos] = await Promise.all([
          q('supplier_document_types', COLUMNS.supplier_document_types).order('sort_order'),
          q('supplier_type_document_profiles', COLUMNS.supplier_type_document_profiles),
          q('supplier_document_supplier_profiles', COLUMNS.supplier_document_supplier_profiles),
          q('supplier_document_subjects', COLUMNS.supplier_document_subjects).eq('is_active', true),
          q('supplier_documents', COLUMNS.supplier_documents).order('recorded_at', { ascending: false }).limit(MAX_DOCS),
          q('supplier_document_events', COLUMNS.supplier_document_events).order('id', { ascending: false }).limit(MAX_EVENTS),
          client.from('suppliers').select('id,name,supplier_type,is_active').eq('is_active', true),
          client.from('purchase_orders').select('id,po_number,supplier_id,status,payment_status,deleted_at'),
        ]);
        for (const res of [types, tp, sp, subj, docs, ev, sups, pos]) if (res && res.error) return refuse(friendlyError(res.error));
        const overrides = {}; rows(sp).forEach(function (x) { overrides[x.supplier_id] = Array.isArray(x.profiles) ? x.profiles : []; });
        const suppliers = rows(sups).map(function (s) {
          const out = { id: s.id, name: s.name, supplier_type: s.supplier_type, is_active: s.is_active };
          if (overrides[s.id]) out.documentProfiles = overrides[s.id].slice();
          return out;
        });
        const context = { purchaseOrders: rows(pos), formulas: [], batches: [], components: [], artworks: [] };
        const SUB = { formula: 'formulas', batch: 'batches', component: 'components', artwork: 'artworks' };
        rows(subj).forEach(function (x) { const k = SUB[x.subject_kind]; if (k) context[k].push({ id: x.subject_ref, name: x.label, supplier_id: x.supplier_id }); });
        const all = rows(docs).map(documentFrom).filter(Boolean);
        return {
          ok: true, checklist: checklistFrom(rows(types), rows(tp)), types: rows(types), suppliers: suppliers, context: context,
          documents: all.filter(function (d) { return d.status !== 'withdrawn'; }), allDocuments: all,
          history: rows(ev), truncated: rows(docs).length === MAX_DOCS,
        };
      });
    }

    // Record that a document arrived. input.requestKey must be a uuid the page
    // keeps until the save succeeds.
    async function record(input) {
      const r = ready(); if (r) return r;
      const i = input || {};
      if (role != null && !ROLES_MAY_RECORD.has(role)) return refuse('Only staff, an administrator or the owner can record a supplier document.');
      if (!isUuid(i.requestKey)) return refuse('Not saved: the page did not give this save a request key, so a retry could not be recognised.');
      if (!isUuid(i.supplierId)) return refuse('Not saved: choose the supplier.');
      if (!text(i.kind)) return refuse('Not saved: choose the document type.');
      if (!text(i.subjectRef)) return refuse('Not saved: say what the document is for.');
      const received = i.receivedOn == null || i.receivedOn === '' ? null : day(i.receivedOn);
      if (i.receivedOn != null && i.receivedOn !== '' && !received) return refuse('Not saved: the date received is not a date.');
      const docDate = i.documentDate ? day(i.documentDate) : null;
      const expires = i.expiresOn ? day(i.expiresOn) : null;
      if (i.expiresOn && !expires) return refuse('Not saved: the expiry is not a date.');
      if (docDate && expires && expires < docDate) return refuse('Not saved: the expiry is before the document date.');
      return once('record:' + i.requestKey, async function () {
        const res = await call(RPC.record, [i.requestKey, i.supplierId, text(i.kind), text(i.subjectKind), text(i.subjectRef),
          text(i.subjectLabel) || null, text(i.reference) || null, received, docDate, expires, text(i.note) || null]);
        if (res.error) return refuse(res.error);
        const d = res.data;
        return { ok: true, id: d.id, duplicate: d.duplicate === true, status: d.status,
          message: d.duplicate === true ? 'Already recorded. Nothing was added twice.' : 'Recorded. It now waits for the owner\'s review.' };
      });
    }

    async function review(id, decision, note) {
      const r = ready(); if (r) return r;
      if (!isUuid(id)) return refuse('Not reviewed: that is not a stored document.');
      if (role != null && !isOwner) return refuse('Only the owner can approve or reject a supplier document.');
      if (decision !== 'approved' && decision !== 'rejected') return refuse('A review is either approved or rejected.');
      if (decision === 'rejected' && text(note).length < 5) return refuse('Say why the document is rejected.');
      return once('review:' + id, async function () {
        const res = await call(RPC.review, [id, decision, text(note) || null]);
        if (res.error) return refuse(res.error);
        const d = res.data;
        if (d.already_decided === true) return { ok: d.ok === true, alreadyDecided: true, status: d.status, message: 'Already ' + d.status + '. Nothing changed.' };
        return { ok: true, alreadyDecided: false, status: d.status, message: decision === 'approved' ? 'Approved.' : 'Rejected. A new copy can be recorded.' };
      });
    }

    async function withdraw(id, note) {
      const r = ready(); if (r) return r;
      if (!isUuid(id)) return refuse('Not withdrawn: that is not a stored document.');
      if (text(note).length < 5) return refuse('Say why the document is withdrawn.');
      return once('withdraw:' + id, async function () {
        const res = await call(RPC.withdraw, [id, text(note)]);
        if (res.error) return refuse(res.error);
        const d = res.data;
        if (d.ok === false) return refuse(d.reason || 'Not withdrawn.');
        return { ok: true, alreadyWithdrawn: d.already_withdrawn === true, message: d.already_withdrawn === true ? 'Already withdrawn. Nothing changed.' : 'Withdrawn. It stays in the history.' };
      });
    }

    async function setTypeProfiles(supplierType, profiles) {
      const r = ready(); if (r) return r;
      if (role != null && !isOwner) return refuse('Only the owner can change the supplier document checklist.');
      return once('typeProfiles:' + supplierType, async function () {
        const res = await call(RPC.typeProfiles, [text(supplierType), Array.isArray(profiles) ? profiles.map(text) : []]);
        if (res.error) return refuse(res.error);
        return { ok: true, message: 'Checklist updated for this kind of supplier.' };
      });
    }

    async function setTypeActive(key, active) {
      const r = ready(); if (r) return r;
      if (role != null && !isOwner) return refuse('Only the owner can change the supplier document checklist.');
      return once('typeActive:' + key, async function () {
        const res = await call(RPC.typeActive, [text(key), active !== false]);
        if (res.error) return refuse(res.error);
        return { ok: true, message: active === false ? 'That document is no longer on the checklist.' : 'That document is back on the checklist.' };
      });
    }

    return { enabled: enabled, probe: probe, load: load, record: record, review: review, withdraw: withdraw, setTypeProfiles: setTypeProfiles, setTypeActive: setTypeActive };
  }

  return { VERSION: VERSION, COLUMNS: COLUMNS, RPC: RPC, OFF_MESSAGE: OFF_MESSAGE, friendlyError: friendlyError,
    checklistFrom: checklistFrom, documentFrom: documentFrom, createStore: createStore };
}));
