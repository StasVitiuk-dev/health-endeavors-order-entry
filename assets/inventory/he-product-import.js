// Product list import (owner request of Nov 23): the owner's real product list
// arrives as a spreadsheet; this checks it BEFORE anything is added, so the
// catalogue starts correct (exact SKUs are launch item R8: deliveries, returns
// and Shopify all find products by SKU).
//
//   templateCsv()             the file to fill in (two EXAMPLE rows to delete)
//   checkFile(text, opts)     reads a CSV saved from Numbers, Excel or Google
//                             Sheets and checks every row:
//     ERROR   must be fixed in the file first (nothing is added while any remain):
//             no name; no SKU (a suggestion is offered); a SKU with spaces or
//             odd characters; the same SKU twice in the file; a price that is
//             not a plain amount, is negative or has too many decimals;
//             wholesale higher than retail; an unknown status; an active
//             product without a retail price; a leftover EXAMPLE row.
//     WARNING worth a look, does not block: sells below cost; no cost; the same
//             name twice; the name of a product already in the dashboard under
//             another SKU; an unusually high price; a column that is ignored.
//   Each row's outcome: NEW (will be added), SAME (already in the dashboard,
//   identical: skipped), DIFFERS (same SKU already there with other details:
//   listed, never changed by the import), ERROR.
//   toCsv(result)             the checked list, cleaned, as CSV (for records).
//
// Pure: no network, no storage. Never guesses a price or a SKU: a suggested
// SKU is used only when the person asks for it (opts.useSuggestedSkus).
// Dual-mode (Node require + browser HE.inventory registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-product-import'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2026-11-23';
  const MAX_BYTES = 1024 * 1024;      // a product list is a few kilobytes
  const MAX_ROWS = 500;
  const MAX_PRICE_CENTS = 100000000;  // $1,000,000, the same limit as the Add product form
  const HIGH_PRICE_CENTS = 50000;     // $500: worth a second look for a lotion
  const STATUSES = ['draft', 'active', 'discontinued'];
  const FIELDS = ['name', 'size', 'sku', 'retail_price', 'wholesale_price', 'cost', 'status', 'packaging_info'];
  const LABELS = { name: 'name', size: 'size', sku: 'sku', retail_price: 'retail_price', wholesale_price: 'wholesale_price', cost: 'cost', status: 'status', packaging_info: 'packaging' };
  // header text (lower case, letters and spaces) -> field
  const HEADER_NAMES = {
    'name': 'name', 'product': 'name', 'product name': 'name', 'title': 'name',
    'size': 'size', 'volume': 'size',
    'sku': 'sku', 'product code': 'sku', 'code': 'sku', 'item code': 'sku',
    'retail price': 'retail_price', 'retail': 'retail_price', 'price': 'retail_price',
    'wholesale price': 'wholesale_price', 'wholesale': 'wholesale_price',
    'cost': 'cost', 'unit cost': 'cost', 'cost price': 'cost',
    'status': 'status', 'selling now': 'status',
    'packaging': 'packaging_info', 'packaging info': 'packaging_info',
  };

  const text = (v) => (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const fmt = (c) => '$' + (c / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ---- CSV ------------------------------------------------------------------------
  function csvRows(src) {
    const out = []; let row = [], cell = '', q = false;
    const s = String(src || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); out.push(row); row = []; cell = '';
        if (out.length > MAX_ROWS + 2) break;
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    return out;
  }
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    // a cell starting with = + - @ would run as a formula when opened in a spreadsheet
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const headerKey = (h) => text(h).toLowerCase().replace(/[_\-]+/g, ' ').replace(/[^a-z ]+/g, '').replace(/\s+/g, ' ').trim();

  // ---- values ---------------------------------------------------------------------
  // "12", "12.5", "$12.50", "1,234.50" -> cents; "" -> null (blank); anything else -> { error }
  function money(v, decimals) {
    const s0 = text(v);
    if (!s0) return { cents: null };
    if (s0.length > 40) return { error: 'is not an amount (' + s0.slice(0, 20) + '…)' };
    let s = s0.replace(/^\$\s*/, '');
    if (s.toLowerCase().endsWith('usd')) s = s.slice(0, -3).trim();
    if (/^-/.test(s) || /^\(.*\)$/.test(s)) return { error: 'is negative (' + s0 + ')' };
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    if (/,/.test(s)) return { error: 'is not a plain amount (' + s0 + '); use a dot for cents, for example 12.50' };
    if (!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) return { error: 'is not an amount (' + s0 + ')' };
    const dec = (s.split('.')[1] || '').length;
    if (dec > decimals) return { error: 'has more than ' + decimals + ' decimals (' + s0 + ')' };
    const n = Number(s);
    if (!isFinite(n)) return { error: 'is not an amount (' + s0 + ')' };
    const cents = Math.round(n * 100);
    if (cents > MAX_PRICE_CENTS) return { error: 'is larger than $1,000,000 (' + s0 + ')' };
    return { cents: cents, value: Number(s) };
  }
  function status(v) {
    const s = text(v).toLowerCase();
    if (!s) return { status: 'draft', defaulted: true };
    if (['active', 'now', 'yes', 'y', 'selling', 'selling now', 'for sale', 'on sale', 'live'].includes(s)) return { status: 'active' };
    if (['draft', 'later', 'no', 'n', 'not yet', 'soon', 'coming soon', 'not selling'].includes(s)) return { status: 'draft' };
    if (['discontinued', 'stopped', 'retired'].includes(s)) return { status: 'discontinued' };
    return { error: 'status "' + text(v) + '" is not one of: active (selling now), draft (later), discontinued' };
  }
  const SKU_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
  // "Lavender Body Lotion", "8 oz" -> "HE-LAVENDER-BODY-LOTION-8OZ" (letters/digits only, at most 32 characters)
  function suggestSku(name, size) {
    const words = text(name).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(' ').filter(w => w && !['THE', 'AND', 'OF', 'WITH', 'HE', 'HEALTH', 'ENDEAVORS'].includes(w));
    const sz = text(size).toUpperCase().replace(/[^A-Z0-9.]+/g, '').replace(/\.$/, '');
    let core = words.slice(0, 4).map(w => w.slice(0, 10)).join('-');
    if (!core) return '';
    let sku = 'HE-' + core + (sz && !core.endsWith(sz) ? '-' + sz : '');
    while (sku.length > 32 && core.includes('-')) { core = core.slice(0, core.lastIndexOf('-')); sku = 'HE-' + core + (sz ? '-' + sz : ''); }
    sku = sku.slice(0, 32);
    while (sku.endsWith('-')) sku = sku.slice(0, -1);
    return sku;
  }
  function fullName(name, size) {
    const n = text(name), s = text(size);
    if (!s) return n;
    const squash = (x) => x.toLowerCase().replace(/\s+/g, '');
    return squash(n).includes(squash(s)) ? n : n + ' ' + s;
  }

  // ---- the template ---------------------------------------------------------------
  function templateCsv() {
    const head = FIELDS.map(f => LABELS[f]);
    const rows = [
      ['EXAMPLE Lavender Body Lotion (delete this row)', '8 oz', 'HE-LAVENDER-8OZ', '24.00', '12.00', '4.50', 'active', '8 oz glass jar'],
      ['EXAMPLE Unscented Hand Cream (delete this row)', '2 oz', '', '12.00', '6.00', '', 'later', 'tube'],
    ];
    return '﻿' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ---- the check -------------------------------------------------------------------
  // opts: { existing: [{ id, sku, name, status, cost, retail_price, wholesale_price, packaging_info }], useSuggestedSkus }
  function checkFile(src, opts) {
    const o = opts || {};
    const fail = (reason) => ({ ok: false, reason: reason, rows: [], counts: { total: 0, new: 0, same: 0, differs: 0, error: 0, warning: 0 }, ignoredColumns: [], ready: [] });
    if (typeof src !== 'string') return fail('the file could not be read as text');
    if (src.length > MAX_BYTES) return fail('the file is larger than 1 MB; a product list should be much smaller (is it the right file?)');
    const all = csvRows(src);
    const nonEmpty = all.map((r, i) => ({ r, line: i + 1 })).filter(x => x.r.some(c => text(c) !== ''));
    if (!nonEmpty.length) return fail('the file is empty');
    const head = nonEmpty[0].r.map(headerKey);
    const col = {};
    const ignored = [];
    head.forEach((h, i) => {
      const f = HEADER_NAMES[h];
      if (f && col[f] === undefined) col[f] = i;
      else if (text(nonEmpty[0].r[i])) ignored.push(text(nonEmpty[0].r[i]));
    });
    if (col.name === undefined) return fail('the first row must be the column names, with at least a "name" column (download the template to see the layout)');
    const body = nonEmpty.slice(1);
    if (!body.length) return fail('the file has the column names but no products');
    if (body.length > MAX_ROWS) return fail('the file has more than ' + MAX_ROWS + ' products; split it into smaller files');

    const existing = (Array.isArray(o.existing) ? o.existing : []).filter(p => p && typeof p === 'object');
    const bySku = new Map(); const byName = new Map();
    existing.forEach(p => { if (text(p.sku)) bySku.set(text(p.sku).toLowerCase(), p); if (text(p.name)) byName.set(text(p.name).toLowerCase(), p); });
    const seenSku = new Map(); const seenName = new Map(); const suggestedTaken = new Set(Array.from(bySku.keys()));
    const cell = (r, f) => (col[f] === undefined ? '' : r[col[f]]);

    const rows = body.map(({ r, line }) => {
      const problems = [], warnings = [];
      const input = {}; FIELDS.forEach(f => { input[f] = text(cell(r, f)); });
      const name = fullName(input.name, input.size);
      if (!input.name) problems.push('no product name');
      else if (/^example\b/i.test(input.name)) problems.push('this is an EXAMPLE row from the template: delete it');
      else if (name.length > 120) problems.push('the name is longer than 120 characters');
      if (input.size.length > 30) problems.push('the size is longer than 30 characters');
      if (input.packaging_info.length > 200) problems.push('the packaging text is longer than 200 characters');

      let sku = input.sku; let suggested = '';
      const sameName = !sku && name ? byName.get(name.toLowerCase()) : null;
      if (sameName && text(sameName.sku)) {
        // no SKU in the file, but this product is already in the dashboard under a SKU:
        // that SKU, never a new one (a new one would add the same product twice)
        suggested = text(sameName.sku);
        if (o.useSuggestedSkus) { sku = suggested; warnings.push('no SKU in the file: matched by name to ' + suggested + ', already in the dashboard'); }
        else problems.push('no SKU (this product is already in the dashboard as ' + suggested + ')');
      } else if (!sku) {
        suggested = suggestSku(input.name, input.size);
        if (suggested) { let s2 = suggested, n = 2; while (suggestedTaken.has(s2.toLowerCase())) { s2 = suggested.slice(0, 29) + '-' + n; n++; } suggested = s2; }
        if (o.useSuggestedSkus && suggested && input.name && !/^example\b/i.test(input.name)) { sku = suggested; warnings.push('SKU suggested: ' + suggested + ' (use the same SKU in Shopify)'); }
        else problems.push('no SKU' + (suggested ? ' (suggestion: ' + suggested + ')' : ''));
      } else if (!SKU_OK.test(sku)) problems.push('the SKU "' + sku + '" may use only letters, digits, dashes, dots and underscores, no spaces, at most 40 characters');
      if (sku) suggestedTaken.add(sku.toLowerCase());

      const retail = money(input.retail_price, 2), wholesale = money(input.wholesale_price, 2), cost = money(input.cost, 4);
      if (retail.error) problems.push('retail price ' + retail.error);
      if (wholesale.error) problems.push('wholesale price ' + wholesale.error);
      if (cost.error) problems.push('cost ' + cost.error);
      const st = status(input.status);
      if (st.error) problems.push(st.error);
      const rc = retail.cents, wc = wholesale.cents, cc = cost.cents;
      if (!retail.error && !wholesale.error && rc != null && wc != null && wc > rc) problems.push('the wholesale price (' + fmt(wc) + ') is higher than the retail price (' + fmt(rc) + ')');
      if (st.status === 'active' && !retail.error && rc == null) problems.push('an active product needs a retail price');
      if (st.status === 'draft' && st.defaulted) warnings.push('no status: added as draft (not for sale yet)');
      if (st.status !== 'active' && !retail.error && rc == null) warnings.push('no retail price yet');
      if (!cost.error && cc == null) warnings.push('no cost: profit cannot be worked out');
      if (!cost.error && cc != null) {
        if (!retail.error && rc != null && rc < cc) warnings.push('retail price is below cost (sells at a loss)');
        if (!wholesale.error && wc != null && wc < cc) warnings.push('wholesale price is below cost (sells at a loss)');
      }
      if (!retail.error && rc === 0) warnings.push('retail price is $0.00');
      if (!retail.error && rc != null && rc > HIGH_PRICE_CENTS) warnings.push('retail price ' + fmt(rc) + ' is unusually high: check it');

      if (sku) {
        const k = sku.toLowerCase();
        if (seenSku.has(k)) problems.push('the same SKU as line ' + seenSku.get(k) + ' (SKUs must be unique; capital letters do not make a difference)');
        else seenSku.set(k, line);
      }
      if (name) {
        const k = name.toLowerCase();
        if (seenName.has(k)) warnings.push('the same name as line ' + seenName.get(k));
        else seenName.set(k, line);
      }

      const product = {
        name: name, sku: sku || null, status: st.status || null,
        cost: cost.error || cc == null ? null : cost.value,
        retail_price: retail.error || rc == null ? null : rc / 100,
        wholesale_price: wholesale.error || wc == null ? null : wc / 100,
        packaging_info: input.packaging_info || null,
      };
      let outcome = problems.length ? 'ERROR' : 'NEW';
      let differences = [];
      if (!problems.length && sku) {
        const ex = bySku.get(sku.toLowerCase());
        if (ex) {
          const same = (a, b) => (a == null || a === '' ? null : String(a)) === (b == null || b === '' ? null : String(b));
          const num = (a, b) => (a == null || a === '') && (b == null || b === '') ? true : (a != null && a !== '' && b != null && b !== '' && Math.abs(Number(a) - Number(b)) < 1e-9);
          if (!same(text(ex.name), product.name)) differences.push('name: "' + text(ex.name) + '" in the dashboard');
          if (!same(ex.status, product.status)) differences.push('status: ' + (ex.status || 'none') + ' in the dashboard');
          if (!num(ex.retail_price, product.retail_price)) differences.push('retail price: ' + (ex.retail_price == null ? 'none' : fmt(Math.round(Number(ex.retail_price) * 100))) + ' in the dashboard');
          if (!num(ex.wholesale_price, product.wholesale_price)) differences.push('wholesale price: ' + (ex.wholesale_price == null ? 'none' : fmt(Math.round(Number(ex.wholesale_price) * 100))) + ' in the dashboard');
          if (!num(ex.cost, product.cost)) differences.push('cost: ' + (ex.cost == null ? 'none' : String(ex.cost)) + ' in the dashboard');
          if (!same(text(ex.packaging_info), product.packaging_info)) differences.push('packaging: "' + text(ex.packaging_info) + '" in the dashboard');
          outcome = differences.length ? 'DIFFERS' : 'SAME';
        } else {
          const exName = byName.get(name.toLowerCase());
          if (exName) warnings.push('a product with this name is already in the dashboard under SKU ' + (text(exName.sku) || '(none)'));
        }
      }
      return { line: line, input: input, product: product, outcome: outcome, problems: problems, warnings: warnings, differences: differences, suggestedSku: suggested || null };
    });
    const counts = {
      total: rows.length,
      new: rows.filter(x => x.outcome === 'NEW').length,
      same: rows.filter(x => x.outcome === 'SAME').length,
      differs: rows.filter(x => x.outcome === 'DIFFERS').length,
      error: rows.filter(x => x.outcome === 'ERROR').length,
      warning: rows.filter(x => x.warnings.length).length,
    };
    const ready = counts.error ? [] : rows.filter(x => x.outcome === 'NEW').map(x => Object.assign({}, x.product));
    return { ok: true, reason: null, rows: rows, counts: counts, ignoredColumns: ignored, ready: ready,
      summary: counts.error
        ? plural(counts.error, 'line needs', 'lines need') + ' fixing in the file before anything can be added.'
        : (counts.new ? plural(counts.new, 'product') + ' ready to add.' : 'Nothing new to add.')
          + (counts.same ? ' ' + plural(counts.same, 'is', 'are') + ' already in the dashboard, unchanged.' : '')
          + (counts.differs ? ' ' + plural(counts.differs, 'is', 'are') + ' already in the dashboard with other details (not changed by the import).' : '') };
  }

  // the checked list as CSV (canonical columns; the name already includes the size)
  function toCsv(result) {
    const rows = (result && Array.isArray(result.rows) ? result.rows : []);
    const head = ['line', 'outcome', 'name', 'sku', 'status', 'retail_price', 'wholesale_price', 'cost', 'packaging', 'problems', 'warnings'];
    const lines = rows.map(x => [x.line, x.outcome, x.product.name, x.product.sku || '', x.product.status || '',
      x.product.retail_price == null ? '' : x.product.retail_price.toFixed(2), x.product.wholesale_price == null ? '' : x.product.wholesale_price.toFixed(2),
      x.product.cost == null ? '' : String(x.product.cost), x.product.packaging_info || '', x.problems.join('; '), x.warnings.concat(x.differences).join('; ')]);
    return '﻿' + [head].concat(lines).map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  return { VERSION, MAX_BYTES, MAX_ROWS, FIELDS, STATUSES, templateCsv, checkFile, toCsv, suggestSku, money, status, csvRows };
}));
