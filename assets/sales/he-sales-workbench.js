// Sales & Growth — OUTREACH WORKBENCH (pure state, SIMULATED, nothing is sent).
//
// The owner's Nov 3 brief asked for the sales workflow to be runnable end to
// end, with state that is kept and clearly labelled, and a reset:
//   import a store list -> check rows, show likely duplicates ->
//   qualify with reasons -> draft from APPROVED facts only (claim-checked) ->
//   edit -> approve (owner or administrator; an edit cancels the approval) ->
//   SIMULATED send (refused without a valid approval, for a suppressed
//   address, or a second time) -> record a reply -> next step -> audit.
//
// Every step is a pure function: it takes the state and returns
// { ok, state, message } with a NEW state (the old one is never changed). The
// engines it uses are passed in (`deps`), so this file has no hidden
// dependency and works the same in Node and in the browser. It never contacts
// anyone: the "send" only adds a line to the simulated outbox.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-workbench'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const MAX_ROWS = 200;           // a store list larger than this is refused, not truncated
  const MAX_BODY = 5000;          // characters in an edited email body
  const ROLES_MAY_APPROVE = new Set(['owner', 'administrator']);   // owner decision #5 (Nov 14)
  const GUARD = 'SIMULATED — nothing is sent, and no one is contacted. Saved in this browser only.';

  // The owner-approved facts drafts may use. Anything not listed here, or not
  // APPROVED, is never put into an email.
  const DEFAULT_FACTS = Object.freeze({
    productName: { value: 'Shea Body Butter', source: 'owner (example)', status: 'APPROVED' },
    senderName: { value: 'Health Endeavors', source: 'owner (example)', status: 'APPROVED' },
    wholesalePrice: { value: 'not set', source: 'none', status: 'MISSING' },
  });

  // Example store list (synthetic): one clean store, one duplicate of it, one
  // weak fit, one unreachable row, one that will reply "remove me".
  function exampleRows() {
    return [
      { storeName: 'SYN Cedar Spa', email: 'buyer@cedarspa.example', website: 'cedarspa.example', city: 'Chicago', state: 'IL', source: 'example list', sourceDate: '2026-11-01', category: 'skincare', size: 'medium', region: 'domestic', carriesSimilarBrands: true },
      { storeName: 'Cedar Spa (SYN)', email: 'Buyer@CedarSpa.example', city: 'Chicago', state: 'IL', source: 'example list', sourceDate: '2026-11-02', category: 'skincare', size: 'medium', region: 'domestic' },
      { storeName: 'SYN Harbor Wellness', email: 'hello@harborwellness.example', city: 'Evanston', state: 'IL', source: 'example list', sourceDate: '2026-11-03', category: 'wellness', size: 'small', region: 'domestic', carriesSimilarBrands: true },
      { storeName: 'SYN Corner Hardware', email: 'info@cornerhardware.example', city: 'Joliet', state: 'IL', source: 'example list', category: 'other', size: 'small', region: 'domestic' },
      { storeName: '', email: 'not-an-email', source: '' },
    ];
  }

  function empty() {
    return { version: VERSION, stores: [], duplicates: [], drafts: {}, approvals: {}, outbox: [], suppressed: [], replies: [], audit: [], seq: 0, label: 'SIMULATED' };
  }

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const fail = (state, message) => ({ ok: false, state: state, message: message });
  const normEmail = (e) => String(e == null ? '' : e).trim().toLowerCase();
  function log(s, action, storeId, detail, who) {
    s.seq += 1;
    s.audit.push({ n: s.seq, action: action, storeId: storeId || null, detail: detail || '', by: who || null, externalSideEffect: false });
  }
  const findStore = (s, id) => s.stores.find(function (x) { return x.id === id; }) || null;

  // The fields whose change cancels an approval (he-sales-approval APPROVAL_FIELDS).
  function material(store, draft) {
    return { kind: draft.kind, recipient: store.email || null, subject: draft.subject, body: draft.body,
      attachments: [], productFacts: draft.factsUsed || [], commercialTerms: null };
  }

  // ---- steps -----------------------------------------------------------------

  // Import a store list. Rows are checked and scored; likely duplicates are
  // shown for review and never merged. Importing again replaces the list and
  // clears what was built on the old one (drafts, approvals, outbox, replies).
  function importRows(state, rows, deps, who) {
    const d = deps || {};
    if (!d.import || !d.leads) return fail(state, 'The import tools are not available.');
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return fail(state, 'The store list is empty.');
    if (list.length > MAX_ROWS) return fail(state, 'The list has ' + list.length + ' rows; the limit here is ' + MAX_ROWS + '. Nothing was imported.');
    const prev = d.import.importPreview(list);
    const s = empty();
    s.suppressed = (state && Array.isArray(state.suppressed)) ? state.suppressed.slice() : [];   // a do-not-contact list survives a new import
    s.audit = (state && Array.isArray(state.audit)) ? state.audit.slice() : [];
    s.seq = (state && state.seq) || 0;
    s.stores = prev.prepared.map(function (p, i) {
      const raw = p.raw || {};
      const lead = { id: 'S' + (i + 1), storeName: p.normalized.storeName, email: p.normalized.email || '', website: raw.website || '',
        category: raw.category || '', size: raw.size || '', region: raw.region || '', carriesSimilarBrands: raw.carriesSimilarBrands === true };
      const usable = p.problems.indexOf('missing business name') === -1 && p.problems.indexOf('no email and no website — not reachable') === -1;
      const scoring = usable ? d.leads.score(lead) : null;
      return Object.assign(lead, { problems: p.problems.slice(), scoring: scoring, status: usable ? 'IMPORTED' : 'NOT_USABLE' });
    });
    s.duplicates = prev.duplicates.map(function (c) { return c.members.map(function (m) { return 'S' + (m + 1); }); });
    s.duplicates.forEach(function (group) {
      group.slice(1).forEach(function (id) { const st = findStore(s, id); if (st && st.status === 'IMPORTED') st.status = 'LIKELY_DUPLICATE'; });
    });
    log(s, 'IMPORTED', null, s.stores.length + ' rows; ' + s.duplicates.length + ' likely duplicate group(s); ' + s.stores.filter(function (x) { return x.status === 'NOT_USABLE'; }).length + ' not usable', who && who.by);
    return { ok: true, state: s, message: 'Imported ' + s.stores.length + ' rows. Likely duplicates are marked, not merged.' };
  }

  // Draft an introduction for one store, from approved facts only.
  function draftFor(state, storeId, deps, who) {
    const d = deps || {};
    if (!state || !Array.isArray(state.stores)) return fail(state, 'Import a store list first.');
    const st = findStore(state, storeId);
    if (!st) return fail(state, 'No such store.');
    if (st.status === 'NOT_USABLE') return fail(state, 'This row cannot be used: ' + st.problems.join('; ') + '.');
    if (st.status === 'LIKELY_DUPLICATE') return fail(state, 'This row looks like a duplicate of another store. Use the first one.');
    if (state.suppressed.indexOf(normEmail(st.email)) !== -1) return fail(state, 'This store asked not to be contacted. No draft is made.');
    if (!d.outreach || !d.ai || !d.claims) return fail(state, 'The drafting tools are not available.');
    const r = d.outreach.buildOutreach({ kind: 'intro', lead: st, facts: (who && who.facts) || DEFAULT_FACTS,
      drafter: d.ai.createDrafter({ provider: 'template' }), claims: d.claims });
    const s = clone(state);
    if (r.status !== 'DRAFT') {
      log(s, 'DRAFT_BLOCKED', storeId, r.reason, who && who.by);
      return { ok: false, state: s, message: 'No draft: ' + r.reason + '.' };
    }
    s.drafts[storeId] = { kind: r.kind, subject: r.subject, body: r.body, factsUsed: r.factsUsed, version: 1, provider: r.provider };
    delete s.approvals[storeId];
    findStore(s, storeId).status = 'DRAFTED';
    log(s, 'DRAFTED', storeId, 'from approved facts: ' + r.factsUsed.map(function (f) { return f.fact; }).join(', '), who && who.by);
    return { ok: true, state: s, message: 'Draft ready for review. Nothing has been sent.' };
  }

  // Edit the body. Any change cancels an approval; the edit is claim-checked.
  function editDraft(state, storeId, body, deps, who) {
    const d = deps || {};
    if (!state || !state.drafts || !state.drafts[storeId]) return fail(state, 'There is no draft for this store.');
    const text = String(body == null ? '' : body);
    if (!text.trim()) return fail(state, 'The email cannot be empty.');
    if (text.length > MAX_BODY) return fail(state, 'The email is ' + text.length + ' characters; the limit is ' + MAX_BODY + '.');
    if (text === state.drafts[storeId].body) return fail(state, 'Nothing changed.');
    if (d.claims) {
      const scan = d.claims.scan(state.drafts[storeId].subject + '\n' + text);
      if (!scan.ok) return fail(state, 'Not saved: the edit makes a health claim (' + scan.findings.map(function (f) { return f.match; }).join(', ') + ').');
    }
    const s = clone(state);
    const had = !!s.approvals[storeId];
    s.drafts[storeId].body = text;
    s.drafts[storeId].version += 1;
    delete s.approvals[storeId];
    findStore(s, storeId).status = 'DRAFTED';
    log(s, 'EDITED', storeId, 'version ' + s.drafts[storeId].version + (had ? '; the approval was cancelled' : ''), who && who.by);
    return { ok: true, state: s, message: had ? 'Saved. The earlier approval no longer applies — approve this version again.' : 'Saved.' };
  }

  // Approve the current version. Owner or administrator only.
  function approve(state, storeId, deps, who) {
    const d = deps || {}; const w = who || {};
    if (!ROLES_MAY_APPROVE.has(w.role)) return fail(state, 'Only the owner or an administrator can approve an email.');
    if (!state || !state.drafts || !state.drafts[storeId]) return fail(state, 'There is no draft for this store.');
    if (!d.approval) return fail(state, 'The approval tools are not available.');
    const st = findStore(state, storeId);
    const suppressed = state.suppressed.indexOf(normEmail(st.email)) !== -1;
    const a = d.approval.approve(Object.assign(material(st, state.drafts[storeId]), { dnc: suppressed }), w.by || w.role, w.at || null);
    if (a.status !== 'APPROVED') return fail(state, 'Not approved: ' + a.reason + '.');
    const s = clone(state);
    s.approvals[storeId] = { fingerprint: a.fingerprint, by: a.approvedBy, at: a.approvedAt, version: s.drafts[storeId].version };
    findStore(s, storeId).status = 'APPROVED';
    log(s, 'APPROVED', storeId, 'version ' + s.drafts[storeId].version, w.by || w.role);
    return { ok: true, state: s, message: 'Approved. Approval is not sending — use "Send (simulated)" to see what would happen.' };
  }

  // SIMULATED send: only a line in the outbox. Every guard a real send would need.
  function simulateSend(state, storeId, deps, who) {
    const d = deps || {}; const w = who || {};
    if (!state || !state.drafts || !state.drafts[storeId]) return fail(state, 'There is no draft for this store.');
    const st = findStore(state, storeId);
    if (state.suppressed.indexOf(normEmail(st.email)) !== -1) return fail(state, 'Not sent: this address asked not to be contacted.');
    if (state.outbox.some(function (o) { return o.storeId === storeId; })) return fail(state, 'Not sent: this email was already sent once (a repeat is blocked).');
    const ap = state.approvals[storeId];
    if (!ap) return fail(state, 'Not sent: the email has not been approved.');
    if (!d.approval) return fail(state, 'The approval tools are not available.');
    const check = d.approval.check({ status: 'APPROVED', fingerprint: ap.fingerprint }, material(st, state.drafts[storeId]));
    if (!check.valid) return fail(state, 'Not sent: ' + check.reason + '.');
    const s = clone(state);
    s.outbox.push({ storeId: storeId, to: st.email, subject: s.drafts[storeId].subject, version: s.drafts[storeId].version, at: w.at || null, status: 'SIMULATED_SENT', delivered: false });
    findStore(s, storeId).status = 'CONTACTED (SIMULATED)';
    log(s, 'SIMULATED_SEND', storeId, 'version ' + s.drafts[storeId].version + ' — nothing left this page', w.by || w.role);
    return { ok: true, state: s, message: 'Recorded in the simulated outbox. No email was sent.' };
  }

  // Record a reply the store "sent". It is read, a next step is suggested, and
  // an opt-out, a "no" or a bounce adds the address to the do-not-contact list.
  function recordReply(state, storeId, text, deps, who) {
    const d = deps || {};
    if (!state || !Array.isArray(state.outbox)) return fail(state, 'Nothing to reply to.');
    if (!state.outbox.some(function (o) { return o.storeId === storeId; })) return fail(state, 'This store has not been contacted (even in simulation).');
    const t = String(text == null ? '' : text).trim();
    if (!t) return fail(state, 'Type or choose a reply first.');
    if (!d.replies || !d.nextaction) return fail(state, 'The reply tools are not available.');
    const c = d.replies.classify(t.slice(0, 2000));
    const next = d.nextaction.recommend({ state: 'REPLIED', hasReply: true, replyLabel: c.label });
    const s = clone(state);
    const st = findStore(s, storeId);
    s.replies.push({ storeId: storeId, text: t.slice(0, 2000), label: c.label, confidence: c.confidence, next: next.action, why: next.reason });
    if (d.replies.suppresses(c.label) && s.suppressed.indexOf(normEmail(st.email)) === -1) s.suppressed.push(normEmail(st.email));
    st.status = d.replies.suppresses(c.label) ? 'DO NOT CONTACT' : 'REPLIED';
    log(s, 'REPLY', storeId, c.label + ' → ' + next.action, who && who.by);
    return { ok: true, state: s, message: 'Reply read as ' + c.label + '. Suggested next step: ' + next.action + '.' };
  }

  // ---- saving ------------------------------------------------------------------
  // Saved as plain JSON in this browser. A saved copy that is damaged or from a
  // different version is never half-used: the workbench starts empty and says so.
  function serialize(state) { return JSON.stringify(state); }
  function restore(text) {
    if (text == null || text === '') return { ok: true, state: empty(), restored: false, message: '' };
    let s = null;
    try { s = JSON.parse(text); } catch (e) { s = null; }
    const shapeOk = s && typeof s === 'object' && s.version === VERSION && Array.isArray(s.stores) && Array.isArray(s.outbox)
      && Array.isArray(s.audit) && Array.isArray(s.suppressed) && Array.isArray(s.replies) && Array.isArray(s.duplicates)
      && s.drafts && typeof s.drafts === 'object' && s.approvals && typeof s.approvals === 'object';
    if (!shapeOk) return { ok: false, state: empty(), restored: false, message: 'The saved workbench could not be read, so it starts empty. Nothing else was affected.' };
    return { ok: true, state: s, restored: true, message: '' };
  }

  function summary(state) {
    const s = state || empty();
    return { stores: (s.stores || []).length, drafts: Object.keys(s.drafts || {}).length, approved: Object.keys(s.approvals || {}).length,
      simulatedSent: (s.outbox || []).length, replies: (s.replies || []).length, doNotContact: (s.suppressed || []).length,
      noExternalSideEffects: (s.audit || []).every(function (a) { return a.externalSideEffect === false; }) && (s.outbox || []).every(function (o) { return o.delivered === false; }) };
  }

  return { VERSION, MAX_ROWS, MAX_BODY, ROLES_MAY_APPROVE, GUARD, DEFAULT_FACTS, exampleRows, empty,
    importRows, draftFor, editDraft, approve, simulateSend, recordReply, serialize, restore, summary };
}));
