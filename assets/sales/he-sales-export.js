// Sales & Growth — SAFE CSV export + field selection (pure, local).
//
// Builds CSV text from synthetic sales rows with two hard protections:
//   1. Formula-injection defence — any cell beginning with = + - @ (or a tab/CR)
//      is prefixed with a single quote so spreadsheets never execute it.
//   2. Field minimization — SENSITIVE/NOT_NEEDED fields (per he-sales-privacy
//      classification, injected) are never exported; PERSONAL fields are only
//      exported when the owner explicitly includes them.
// It returns a string; it does not touch the filesystem, network or clipboard.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-export'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DANGEROUS = /^[=+\-@\t\r]/;

  // Make one cell CSV-safe: neutralize formula triggers, then quote/escape.
  function cell(value) {
    let s = value == null ? '' : String(value);
    if (DANGEROUS.test(s)) s = "'" + s;                 // formula-injection guard
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; // RFC-4180 quoting
    return s;
  }

  // Choose which fields to export. `classify` (from he-sales-privacy) decides a
  // field's class; SENSITIVE/NOT_NEEDED are always dropped; PERSONAL only if
  // opts.includePersonal === true. `fields` optionally restricts/orders columns.
  function chooseFields(rows, classify, opts) {
    const o = opts || {};
    const present = new Set();
    for (const r of (rows || [])) for (const k of Object.keys(r || {})) present.add(k);
    let fields = o.fields && o.fields.length ? o.fields.filter(f => present.has(f)) : [...present];
    const cls = typeof classify === 'function' ? classify : () => 'BUSINESS';
    const dropped = [];
    fields = fields.filter(f => {
      const c = cls(f);
      if (c === 'SENSITIVE' || c === 'NOT_NEEDED') { dropped.push({ field: f, class: c }); return false; }
      if (c === 'PERSONAL' && o.includePersonal !== true) { dropped.push({ field: f, class: c }); return false; }
      return true;
    });
    return { fields, dropped };
  }

  // Build CSV text. Returns { csv, fields, dropped, rows }.
  function toCsv(rows, classify, opts) {
    const { fields, dropped } = chooseFields(rows, classify, opts);
    const lines = [fields.map(cell).join(',')];
    for (const r of (rows || [])) lines.push(fields.map(f => cell(r ? r[f] : '')).join(','));
    return { csv: lines.join('\r\n'), fields, dropped, rows: (rows || []).length,
      guard: 'Export is built in memory only; sensitive/not-needed fields are dropped and every cell is formula-injection-safe.' };
  }

  return { DANGEROUS, cell, chooseFields, toCsv };
}));
