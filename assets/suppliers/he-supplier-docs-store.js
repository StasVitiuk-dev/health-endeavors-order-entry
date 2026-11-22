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
      'expires_on', 'status', 'recorded_by', 'recorded_at', 'record_note', 'reviewed_by', 'reviewed_at', 'review_note', 'withdrawn_by', 'withdrawn_at', 'withdraw_note',
      'file_path', 'file_sha256', 'file_bytes', 'file_type', 'file_attached_at', 'approved_file_sha256'],
    supplier_document_handoffs: ['id', 'supplier_id', 'kind', 'po_text', 'reference', 'received_on', 'note', 'status', 'handed_by', 'handed_at', 'resolved_by', 'resolved_at', 'resolve_note', 'document_id'],
    supplier_document_events: ['id', 'document_id', 'area', 'event', 'by_user', 'at', 'note', 'detail'],
  };
  const RPC = {
    record: { name: 'record_supplier_document', params: ['p_request_key', 'p_supplier_id', 'p_kind', 'p_subject_kind', 'p_subject_ref', 'p_subject_label', 'p_reference', 'p_received_on', 'p_document_date', 'p_expires_on', 'p_note'] },
    review: { name: 'review_supplier_document', params: ['p_id', 'p_decision', 'p_note'] },
    withdraw: { name: 'withdraw_supplier_document', params: ['p_id', 'p_note'] },
    typeProfiles: { name: 'set_supplier_type_document_profiles', params: ['p_supplier_type', 'p_profiles'] },
    typeActive: { name: 'set_supplier_document_type_active', params: ['p_key', 'p_active'] },
    attachFile: { name: 'attach_supplier_document_file', params: ['p_id', 'p_path', 'p_sha256', 'p_bytes', 'p_type'] },
    handOff: { name: 'hand_off_supplier_document', params: ['p_request_key', 'p_supplier_id', 'p_kind', 'p_po_text', 'p_reference', 'p_received_on', 'p_note'] },
    resolveHandoff: { name: 'resolve_supplier_document_handoff', params: ['p_id', 'p_po_id'] },
    dismissHandoff: { name: 'dismiss_supplier_document_handoff', params: ['p_id', 'p_note'] },
  };
  const BUCKET = 'supplier-documents';
  const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_FILE_BYTES = 10485760;        // 10 MB, as the bucket allows
  const LINK_SECONDS = 60;
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

  // SHA-256 of a file's bytes, as lowercase hex. Used only where the browser's
  // own crypto.subtle is missing (it is only offered on https pages); same result.
  const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256Hex(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const n = b.length, total = Math.ceil((n + 9) / 64) * 64;
    const m = new Uint8Array(total); m.set(b); m[n] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(n / 0x20000000)); dv.setUint32(total - 4, (n * 8) >>> 0);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    const rot = (x, r) => (x >>> r) | (x << (32 - r));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  // The page's fingerprint of a chosen file: the browser's own when offered, otherwise sha256Hex.
  async function fileSha256(file) {
    const buf = await file.arrayBuffer();
    const subtle = typeof crypto !== 'undefined' && crypto && crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
      try { const dig = await subtle.digest('SHA-256', buf); return Array.from(new Uint8Array(dig)).map(x => x.toString(16).padStart(2, '0')).join(''); }
      catch (e) { /* fall through to the built-in one */ }
    }
    return sha256Hex(new Uint8Array(buf));
  }

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
    const active = (Array.isArray(types) ? types : []).filter(function (t) { return t && typeof t === 'object' && t.is_active !== false; })
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
    (Array.isArray(typeProfiles) ? typeProfiles : []).forEach(function (r) {
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
      filePath: r.file_path || null, fileSha256: r.file_sha256 || null, fileBytes: r.file_bytes == null ? null : Number(r.file_bytes),
      fileType: r.file_type || null, approvedFileSha256: r.approved_file_sha256 || null,
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
        const [types, tp, sp, subj, docs, ev, sups, pos, hos] = await Promise.all([
          q('supplier_document_types', COLUMNS.supplier_document_types).order('sort_order'),
          q('supplier_type_document_profiles', COLUMNS.supplier_type_document_profiles),
          q('supplier_document_supplier_profiles', COLUMNS.supplier_document_supplier_profiles),
          q('supplier_document_subjects', COLUMNS.supplier_document_subjects).eq('is_active', true),
          q('supplier_documents', COLUMNS.supplier_documents).order('recorded_at', { ascending: false }).limit(MAX_DOCS),
          q('supplier_document_events', COLUMNS.supplier_document_events).order('id', { ascending: false }).limit(MAX_EVENTS),
          client.from('suppliers').select('id,name,supplier_type,is_active').eq('is_active', true),
          client.from('purchase_orders').select('id,po_number,supplier_id,status,payment_status,deleted_at'),
          q('supplier_document_handoffs', COLUMNS.supplier_document_handoffs).order('handed_at', { ascending: false }).limit(MAX_EVENTS),
        ]);
        for (const res of [types, tp, sp, subj, docs, ev, sups, pos, hos]) if (res && res.error) return refuse(friendlyError(res.error));
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
          history: rows(ev), handoffs: rows(hos), truncated: rows(docs).length === MAX_DOCS,
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

    // A purchase document for an order this person cannot see: hand it to the owner.
    async function handOff(input) {
      const r = ready(); if (r) return r;
      const i = input || {};
      if (role != null && !ROLES_MAY_RECORD.has(role)) return refuse('Only staff, an administrator or the owner can hand a document to the owner.');
      if (!isUuid(i.requestKey)) return refuse('Not sent: the page did not give this hand-off a request key.');
      if (!isUuid(i.supplierId)) return refuse('Not sent: choose the supplier.');
      if (!text(i.kind)) return refuse('Not sent: choose the document type.');
      if (!text(i.poText)) return refuse('Not sent: write the order number as printed on the paper.');
      return once('handoff:' + i.requestKey, async function () {
        const res = await call(RPC.handOff, [i.requestKey, i.supplierId, text(i.kind), text(i.poText).slice(0, 120), text(i.reference) || null, i.receivedOn ? day(i.receivedOn) : null, text(i.note) || null]);
        if (res.error) return refuse(res.error);
        const d = res.data;
        return { ok: true, id: d.id, duplicate: d.duplicate === true, message: d.duplicate === true ? 'Already handed to the owner. Nothing was added twice.' : 'Handed to the owner, who will link it to the right order.' };
      });
    }
    async function resolveHandoff(id, poId) {
      const r = ready(); if (r) return r;
      if (role != null && !isOwner) return refuse('Only the owner can link a handed-off document.');
      if (!isUuid(id) || !isUuid(poId)) return refuse('Choose the purchase order this document belongs to.');
      return once('resolve:' + id, async function () {
        const res = await call(RPC.resolveHandoff, [id, poId]);
        if (res.error) return refuse(res.error);
        const d = res.data;
        return { ok: d.ok !== false, alreadyResolved: d.already_resolved === true, documentId: d.document_id || null,
          message: d.already_resolved === true ? 'Already ' + d.status + '. Nothing changed.' : 'Linked and recorded. It now waits for your review.' };
      });
    }
    async function dismissHandoff(id, note) {
      const r = ready(); if (r) return r;
      if (role != null && !isOwner) return refuse('Only the owner can dismiss a handed-off document.');
      if (text(note).length < 5) return refuse('Say why the hand-off is dismissed.');
      return once('dismiss:' + id, async function () {
        const res = await call(RPC.dismissHandoff, [id, text(note)]);
        if (res.error) return refuse(res.error);
        return { ok: true, message: res.data.already_resolved === true ? 'Already resolved. Nothing changed.' : 'Dismissed. It stays in the history.' };
      });
    }
    // Upload the one file of a document, then attach it. The storage rules let
    // only its recorder (or the owner) upload, and only while it waits for review.
    //   file: { name, type, size, sha256, body }  (sha256: lowercase hex, computed by the page)
    async function attachFile(id, file) {
      const r = ready(); if (r) return r;
      const f = file || {};
      if (!isUuid(id)) return refuse('Not attached: that is not a stored document.');
      if (FILE_TYPES.indexOf(f.type) < 0) return refuse('Only a PDF, JPEG or PNG file can be attached.');
      if (!(Number(f.size) > 0) || Number(f.size) > MAX_FILE_BYTES) return refuse('The file must be between 1 byte and 10 MB.');
      if (!/^[0-9a-f]{64}$/.test(String(f.sha256 || ''))) return refuse('Not attached: the file fingerprint could not be computed.');
      if (!client.storage || typeof client.storage.from !== 'function') return refuse('File storage is not available. Nothing was attached.');
      const ext = f.type === 'application/pdf' ? 'pdf' : f.type === 'image/png' ? 'png' : 'jpg';
      const path = id + '/' + f.sha256.slice(0, 16) + '.' + ext;
      return once('file:' + id, async function () {
        const up = await client.storage.from(BUCKET).upload(path, f.body, { contentType: f.type, upsert: false });
        if (up && up.error && /bucket not found/i.test(String(up.error.message || ''))) return refuse('File storage is not installed yet (drafts/38 needs the owner\'s approval). Nothing was attached.');
        if (up && up.error && !/exists|duplicate/i.test(String(up.error.message || ''))) {
          // A retry after a lost reply: the storage rules refuse a second upload
          // once the document has its file. Read the document back; if this very
          // file is already attached, the earlier try succeeded.
          let back = null;
          try { back = await client.from('supplier_documents').select('file_path,file_sha256').eq('id', id).maybeSingle(); } catch (e) { back = null; }
          const d = back && !back.error && back.data;
          if (d && d.file_path === path && d.file_sha256 === f.sha256) return { ok: true, path: path, alreadyAttached: true, message: 'That file is already attached.' };
          return refuse('The file was not stored: ' + String(up.error.message || 'refused') + '.');
        }
        const res = await call(RPC.attachFile, [id, path, f.sha256, Number(f.size), f.type]);
        if (res.error) return refuse(res.error);
        return { ok: true, path: path, alreadyAttached: res.data.already_attached === true, message: res.data.already_attached === true ? 'That file is already attached.' : 'File attached. Only the owner can open it.' };
      });
    }
    // A link to the file that works for 60 seconds. Only the owner gets one:
    // for anyone else the storage service finds no such file.
    async function openFile(doc) {
      const r = ready(); if (r) return r;
      const d = doc || {};
      if (!d.filePath) return refuse('This document has no file.');
      if (role != null && !isOwner) return refuse('Only the owner can open supplier document files.');
      if (!client.storage || typeof client.storage.from !== 'function') return refuse('File storage is not available.');
      return once('open:' + d.filePath, async function () {
        const res = await client.storage.from(BUCKET).createSignedUrl(d.filePath, LINK_SECONDS);
        if (res && res.error) return refuse('The file could not be opened: ' + String(res.error.message || 'refused') + '.');
        const url = res && res.data && (res.data.signedUrl || res.data.signedURL);
        if (!url) return refuse('The file could not be opened.');
        return { ok: true, url: url, expiresInSeconds: LINK_SECONDS };
      });
    }

    return { enabled: enabled, probe: probe, load: load, record: record, review: review, withdraw: withdraw, setTypeProfiles: setTypeProfiles, setTypeActive: setTypeActive,
      handOff: handOff, resolveHandoff: resolveHandoff, dismissHandoff: dismissHandoff, attachFile: attachFile, openFile: openFile };
  }

  return { VERSION: VERSION, COLUMNS: COLUMNS, RPC: RPC, BUCKET: BUCKET, FILE_TYPES: FILE_TYPES, MAX_FILE_BYTES: MAX_FILE_BYTES, OFF_MESSAGE: OFF_MESSAGE, friendlyError: friendlyError,
    sha256Hex: sha256Hex, fileSha256: fileSha256,
    checklistFrom: checklistFrom, documentFrom: documentFrom, createStore: createStore };
}));
