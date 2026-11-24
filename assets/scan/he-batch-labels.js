// Batch stickers (owner, Nov 24: the barcode printed on a bottle says which
// product it is, not which batch, and nothing else on the bottle carries the
// batch; "we will have to print it on label"). The dashboard prints a small
// sticker per bottle with the batch number in words and as a barcode a phone
// camera or a scanner reads. This file is the arithmetic: the barcode, what the
// sticker says, how many fit on a label. No page, no database, no printing.
//
//   payload(lot)                -> { ok, text, reason }       "B-" + the batch number
//   parse(scanned)              -> { ok, lot }                the other way round
//   encode(text)                -> { ok, widths, modules, checksum, reason }   Code 128 (set B)
//   bars(text, quiet)           -> { ok, bars: [{ x, w }], width }   black bars, in modules
//   plan({ lot, count, layout })-> { ok, reason, text, count, pages, perPage, moduleInch, ... }
//
// Code 128 is the common shipping-label barcode: every printable character of a
// US keyboard, a check character, readable by iPhone and Android cameras and by
// any handheld scanner. Set B only (letters, digits, punctuation).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-batch-labels'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PREFIX = 'B-';
  const MAX_LOT = 24;
  const MAX_COUNT = 500;
  const QUIET = 10;                 // empty modules each side, as the standard asks
  const BEST_MODULE_INCH = 0.010;   // a comfortable bar width for a thermal printer and a phone camera
  const MIN_MODULE_INCH = 0.0075;   // thinner than this is not printed or read reliably
  // The 107 Code 128 patterns: bar, space, bar, space, ... widths in modules.
  const PATTERNS = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
    '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 ' +
    '131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 ' +
    '213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
    '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 ' +
    '421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 ' +
    '2331112').split(' ');
  const START_B = 104, STOP = 106;

  // where the stickers are printed (inches)
  const LAYOUTS = Object.freeze({
    roll: Object.freeze({ key: 'roll', name: 'Small label roll, 2.25 × 1.25 inch: one sticker per label', page: '2.25in 1.25in', perPage: 1, usable: 2.05 }),
    sheet: Object.freeze({ key: 'sheet', name: '4 × 6 label: 8 strips to cut apart', page: '4in 6in', perPage: 8, usable: 3.5 }),
  });

  const str = (v) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''));
  const printable = (t) => /^[\x20-\x7e]+$/.test(t);

  function payload(lot) {
    const t = str(lot).trim().slice(0, 200);
    if (!t) return { ok: false, text: '', reason: 'This batch has no number.' };
    if (t.length > MAX_LOT) return { ok: false, text: '', reason: 'This batch number is too long for a sticker (' + MAX_LOT + ' characters at most).' };
    if (!printable(t)) return { ok: false, text: '', reason: 'This batch number has a character a barcode cannot hold (plain letters, digits and punctuation only).' };
    return { ok: true, text: PREFIX + t, reason: '' };
  }

  // what a scanner or the camera read -> the batch number, if it is one of ours
  function parse(scanned) {
    const t = str(scanned).trim().slice(0, 200);
    if (t.length <= PREFIX.length || t.slice(0, PREFIX.length) !== PREFIX) return { ok: false, lot: '' };
    const lot = t.slice(PREFIX.length);
    if (lot.length > MAX_LOT || !printable(lot) || lot !== lot.trim()) return { ok: false, lot: '' };
    return { ok: true, lot: lot };
  }

  function encode(text) {
    const t = str(text);
    if (!t || t.length > 60 || !printable(t)) return { ok: false, widths: '', modules: 0, checksum: null, reason: 'This text cannot be made into a barcode.' };
    const values = [START_B];
    for (let i = 0; i < t.length; i += 1) values.push(t.charCodeAt(i) - 32);
    let sum = START_B;
    for (let i = 1; i < values.length; i += 1) sum += values[i] * i;
    const checksum = sum % 103;
    values.push(checksum, STOP);
    const widths = values.map(v => PATTERNS[v]).join('');
    let modules = 0;
    for (let i = 0; i < widths.length; i += 1) modules += widths.charCodeAt(i) - 48;
    return { ok: true, widths: widths, modules: modules, checksum: checksum, reason: '' };
  }

  // the black bars only, left to right, in modules, with the quiet zone before and after
  function bars(text, quiet) {
    const e = encode(text);
    if (!e.ok) return { ok: false, bars: [], width: 0 };
    const q = Number.isInteger(quiet) && quiet >= 0 && quiet <= 40 ? quiet : QUIET;
    const out = [];
    let x = q;
    for (let i = 0; i < e.widths.length; i += 1) {
      const w = e.widths.charCodeAt(i) - 48;
      if (i % 2 === 0) out.push({ x: x, w: w });
      x += w;
    }
    return { ok: true, bars: out, width: x + q };
  }

  function plan(input) {
    const d = input !== null && typeof input === 'object' ? input : {};
    const layout = LAYOUTS[str(d.layout)] || null;
    const none = (reason) => ({ ok: false, reason: reason, text: '', count: 0, pages: 0, perPage: layout ? layout.perPage : 0, layout: layout ? layout.key : '', moduleInch: 0, widthInch: 0 });
    if (!layout) return none('Choose where the stickers are printed.');
    const p = payload(d.lot);
    if (!p.ok) return none(p.reason);
    const n = typeof d.count === 'number' ? d.count : Number(str(d.count).trim());
    if (!Number.isInteger(n) || n < 1) return none('Type how many stickers to print (a whole number, 1 or more).');
    if (n > MAX_COUNT) return none('At most ' + MAX_COUNT + ' stickers at a time; print the rest in a second run.');
    const b = bars(p.text);
    const moduleInch = Math.min(BEST_MODULE_INCH, layout.usable / b.width);
    if (moduleInch < MIN_MODULE_INCH) {
      return none(layout.key === 'roll'
        ? 'This batch number is too long for the small label: its barcode would be too fine to read. Choose the 4 × 6 label.'
        : 'This batch number is too long for a readable barcode.');
    }
    return { ok: true, reason: '', text: p.text, count: n, perPage: layout.perPage, pages: Math.ceil(n / layout.perPage), layout: layout.key,
      moduleInch: Math.round(moduleInch * 100000) / 100000, widthInch: Math.round(moduleInch * b.width * 1000) / 1000 };
  }

  return { PREFIX, MAX_LOT, MAX_COUNT, QUIET, MIN_MODULE_INCH, BEST_MODULE_INCH, LAYOUTS, payload, parse, encode, bars, plan };
}));
