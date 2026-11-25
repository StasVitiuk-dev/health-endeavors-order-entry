// Reading a receipt's text (owner, Nov 24: "receipt inbox ... turns a photo into an
// expense draft"; decision: free reading first). The owner copies the text of a
// receipt on the phone (press on the photo, Copy All) or the browser reads it where
// it can; this file finds the total, the date and the shop's name in that text, to
// FILL IN the expense form. It never saves, and anything it is not sure of it says:
// the owner checks every field before saving.
//
//   parse(text, nowMs) -> { total, totalHow, date, vendor, found, notes }
//       total     dollars as a number, or null
//       totalHow  'total line' | 'largest amount' | ''        (the second is a guess)
//       date      'YYYY-MM-DD' or null (never a day in the future)
//       vendor    the first line that looks like a name, or ''
//
// Pure: no page, no database, no network.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-receipt-text'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_CHARS = 20000, MAX_LINES = 400, MAX_AMOUNT = 100000;
  const MONEY = /(?:^|[^\d.,])\$?\s?(\d{1,3}(?:,\d{3})+|\d{1,6})\.(\d{2})(?!\d)/g;
  const TOTAL_WORD = /\b(grand\s+total|total\s+due|amount\s+due|balance\s+due|total\s+paid|amount\s+paid|total)\b/i;
  const NOT_TOTAL = /\b(sub\s*-?\s*total|total\s+savings|total\s+items|total\s+discount|tax\s+total|total\s+tax|points)\b/i;
  // a month only when the word is a real month name or its usual short form (never "Octember")
  const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function monthOf(word) {
    const w = String(word || '').toLowerCase();
    const full = MONTH_NAMES.indexOf(w);
    if (full >= 0) return full + 1;
    if (w === 'sept') return 9;
    const short = w.length === 3 ? MONTH_NAMES.findIndex(m => m.slice(0, 3) === w) : -1;
    return short >= 0 ? short + 1 : null;
  }
  const pad = (n) => String(n).padStart(2, '0');

  function amountsIn(line) {
    const out = []; let m; MONEY.lastIndex = 0;
    while ((m = MONEY.exec(line)) !== null) { const v = Number(m[1].replace(/,/g, '') + '.' + m[2]); if (v > 0 && v <= MAX_AMOUNT) out.push(v); }
    return out;
  }

  function realDay(y, mo, d, now) {
    if (!(y >= 2015 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    const t = new Date(Date.UTC(y, mo - 1, d, 12));
    if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    if (t.getTime() > now + 36 * 3600000) return null;                    // a receipt is not from the future
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function dateIn(line, now) {
    let m = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(line);
    if (m) return realDay(Number(m[1]), Number(m[2]), Number(m[3]), now);
    m = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/.exec(line);     // US order: month, day, year
    if (m) return realDay(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[1]), Number(m[2]), now);
    m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/.exec(line);
    if (m && monthOf(m[1])) return realDay(Number(m[3]), monthOf(m[1]), Number(m[2]), now);
    m = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2})\b/.exec(line);
    if (m && monthOf(m[2])) return realDay(Number(m[3]), monthOf(m[2]), Number(m[1]), now);
    return null;
  }

  function parse(text, nowMs) {
    const now = typeof nowMs === 'number' && Math.abs(nowMs) <= 8.0e15 ? nowMs : Date.now();
    const raw = typeof text === 'string' ? text.slice(0, MAX_CHARS).replace(/\r\n?/g, '\n') : '';
    const lines = raw.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, MAX_LINES);
    const out = { total: null, totalHow: '', date: null, vendor: '', found: 0, notes: [] };
    if (!lines.length) { out.notes.push('There is no text to read.'); return out; }
    // the total: the last line that says "total" (not subtotal, not tax); else the largest amount, said as a guess
    let all = [];
    for (const line of lines) {
      const a = amountsIn(line); all = all.concat(a);
      if (a.length && TOTAL_WORD.test(line) && !NOT_TOTAL.test(line)) { out.total = a[a.length - 1]; out.totalHow = 'total line'; }
    }
    if (out.total == null && all.length) { out.total = Math.max(...all); out.totalHow = 'largest amount'; out.notes.push('No line says "total", so the largest amount was taken. Check it.'); }
    if (out.total == null) out.notes.push('No amount was found. Type it in.');
    for (const line of lines) { const d = dateIn(line, now); if (d) { out.date = d; break; } }
    if (!out.date) out.notes.push('No date was found. Choose it.');
    // the shop: the first line with letters that is not a date, an amount, an address line or a receipt word
    for (const line of lines.slice(0, 8)) {
      if (!/[A-Za-z]{3}/.test(line) || amountsIn(line).length || dateIn(line, now)) continue;
      if (/^(receipt|invoice|order|thank|welcome|tel|phone|www\.|http|store\s*#|cashier|date|time)\b/i.test(line) || /\d{5}(-\d{4})?$/.test(line) || /@/.test(line)) continue;
      out.vendor = line.replace(/[^\w &'.,\-]/g, '').trim().slice(0, 60); if (out.vendor) break;
    }
    if (!out.vendor) out.notes.push('The shop\'s name was not found. Type it in.');
    out.found = (out.total != null ? 1 : 0) + (out.date ? 1 : 0) + (out.vendor ? 1 : 0);
    return out;
  }

  return { MAX_CHARS, MAX_LINES, MAX_AMOUNT, parse };
}));
