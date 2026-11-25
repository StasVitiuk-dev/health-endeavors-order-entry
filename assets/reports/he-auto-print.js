// Automatic daily printing — the dashboard's part (owner, Nov 24: "every day it should
// print automatically on my printer"; decided: yesterday's day pack, at 8:00 AM, on the
// Mac next to the printer). A page in a browser cannot wake up by itself, so something
// on the Mac opens the dashboard with a special link each morning; the dashboard then
// prints yesterday's day pack, once a day per browser. This file is the arithmetic.
//
//   wants(search)          -> true when the page was opened by the daily link (?print=daypack)
//   yesterday(nowMs)       -> the day before today on the viewer's own calendar, YYYY-MM-DD
//   due(lastDay, nowMs)    -> { due, day }     once per day: not again for a day already printed
//   link(href)             -> the link to open every morning, made from the page's own address
//
// Pure: no page, no database, no printing.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-auto-print'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PARAM = 'print', VALUE = 'daypack';
  const pad = (n) => String(n).padStart(2, '0');

  function wants(search) {
    const t = typeof search === 'string' ? search.slice(0, 2000) : '';
    const q = t.charAt(0) === '?' || t.charAt(0) === '#' ? t.slice(1) : t;
    return q.split('&').some(part => { const i = part.indexOf('='); return i > 0 && part.slice(0, i) === PARAM && part.slice(i + 1) === VALUE; });
  }

  // the viewer's own calendar (docs/ops/TIMEZONE_CONTRACT.md); an impossible time is read as now
  function yesterday(nowMs) {
    const ms = typeof nowMs === 'number' && isFinite(nowMs) && Math.abs(nowMs) < 8.0e15 ? nowMs : Date.now();
    const d = new Date(ms);
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function due(lastDay, nowMs) {
    const day = yesterday(nowMs);
    const last = typeof lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastDay) ? lastDay : '';
    return { due: last < day, day: day, last: last };
  }

  function link(href) {
    const t = typeof href === 'string' ? href.slice(0, 2000) : '';
    if (!/^https?:\/\/[^\s?#]+/.test(t)) return '';
    const base = t.split('#')[0].split('?')[0];
    return base + '?' + PARAM + '=' + VALUE;
  }

  return { PARAM, VALUE, wants, yesterday, due, link };
}));
