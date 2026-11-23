// Sales & Growth — PRIVACY center + retention-policy draft (pure, local, advisory).
//
// Inventories the fields the sales subsystem handles, classifies each as
// BUSINESS / PERSONAL / SENSITIVE / NOT_NEEDED, recommends data minimization,
// and offers DRAFT retention-policy options (nothing is finalized here — the
// owner/legal decide). Also a helper to minimize an audit payload by dropping
// personal/sensitive fields. No data is deleted or changed; this only advises.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-privacy'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CLASSES = ['BUSINESS', 'PERSONAL', 'SENSITIVE', 'NOT_NEEDED'];

  // Field name -> classification. Business contact facts are BUSINESS; a named
  // human contact is PERSONAL; anything that looks like a secret/credential is
  // SENSITIVE and should never be stored here; internal scratch is NOT_NEEDED.
  const FIELD_CLASS = {
    id: 'BUSINESS', storeName: 'BUSINESS', website: 'BUSINESS', category: 'BUSINESS',
    size: 'BUSINESS', region: 'BUSINESS', city: 'BUSINESS', state: 'BUSINESS', source: 'BUSINESS',
    pipelineState: 'BUSINESS', scoring: 'BUSINESS', carriesSimilarBrands: 'BUSINESS',
    contactName: 'PERSONAL', email: 'PERSONAL', phone: 'PERSONAL', personalNotes: 'PERSONAL',
    password: 'SENSITIVE', apiKey: 'SENSITIVE', token: 'SENSITIVE', ssn: 'SENSITIVE', card: 'SENSITIVE',
    _scratch: 'NOT_NEEDED', _raw: 'NOT_NEEDED', debug: 'NOT_NEEDED',
  };
  const SENSITIVE_HINT = /(password|secret|api[_-]?key|token|ssn|social.?security|card|cvv|routing|iban)/i;

  function classifyField(name) {
    if (FIELD_CLASS[name]) return FIELD_CLASS[name];
    if (SENSITIVE_HINT.test(name)) return 'SENSITIVE';
    return 'BUSINESS'; // default: treat unknown business-record fields as business data
  }

  // Inventory the fields actually present on a record (or a list of names).
  function inventory(recordOrNames) {
    const names = Array.isArray(recordOrNames) ? recordOrNames : Object.keys(recordOrNames || {});
    const rows = names.map(n => {
      const cls = classifyField(n);
      const recommend = cls === 'SENSITIVE' ? 'REMOVE — must never be stored in this public repo app'
        : cls === 'NOT_NEEDED' ? 'drop — internal scratch, not needed'
        : cls === 'PERSONAL' ? 'keep only what outreach needs; minimize'
        : 'keep (business fact)';
      return { field: n, class: cls, recommend };
    });
    const byClass = {}; for (const c of CLASSES) byClass[c] = 0;
    for (const r of rows) byClass[r.class]++;
    return { rows, byClass, hasSensitive: byClass.SENSITIVE > 0,
      guard: 'Advisory inventory only. No field is removed or changed; the owner decides.' };
  }

  // DRAFT retention options (PROPOSED — never applied here).
  function retentionPolicyOptions() {
    return { status: 'PROPOSED — owner/legal decide; nothing is enforced here', options: [
      { topic: 'Lead records', choices: ['keep while active', '18 months after last contact', '36 months'], default: 'keep while active' },
      { topic: 'Do-not-contact list', choices: ['keep indefinitely (suppression must persist)'], default: 'keep indefinitely (suppression must persist)' },
      { topic: 'Outreach drafts', choices: ['90 days', '12 months', 'keep'], default: '12 months' },
      { topic: 'AI run logs', choices: ['30 days', '90 days', '12 months'], default: '90 days' },
      { topic: 'Sample history', choices: ['keep (audit)', '36 months'], default: 'keep (audit)' },
    ] };
  }

  // Return a minimized copy of an audit payload: PERSONAL fields masked, SENSITIVE
  // and NOT_NEEDED dropped entirely. Pure (returns a new object).
  function minimizeAudit(payload) {
    const out = {};
    for (const [k, v] of Object.entries(payload || {})) {
      const cls = classifyField(k);
      if (cls === 'SENSITIVE' || cls === 'NOT_NEEDED') continue;
      out[k] = cls === 'PERSONAL' ? '[minimized]' : v;
    }
    return out;
  }

  return { CLASSES, FIELD_CLASS, classifyField, inventory, retentionPolicyOptions, minimizeAudit };
}));
