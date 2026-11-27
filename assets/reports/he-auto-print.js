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
//   missed(lastDay, nowMs)  -> the days the link did not open for, between the last one and yesterday
//                             (at most 14, oldest first; none when nothing was opened this way yet)
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

  // Nov 27: the Mac can be asleep or off at 12:02 AM, and the timer does not run late. The days in between
  // are named, so nobody believes a day was printed when the link never opened for it.
  function missed(lastDay, nowMs, max) {
    const last = typeof lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastDay) ? lastDay : '';
    const until = yesterday(nowMs);
    if (!last || last >= until) return [];
    const cap = Math.max(1, Math.min(31, Number(max) || 14));
    const out = [];
    const d = new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, Number(last.slice(8, 10)));
    for (;;) {
      d.setDate(d.getDate() + 1);
      const day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      if (day >= until) break;
      out.push(day);
      if (out.length >= cap) break;
    }
    return out;
  }

  function link(href) {
    const t = typeof href === 'string' ? href.slice(0, 2000) : '';
    if (!/^https?:\/\/[^\s?#]+/.test(t)) return '';
    const base = t.split('#')[0].split('?')[0];
    return base + '?' + PARAM + '=' + VALUE;
  }

  return { PARAM, VALUE, wants, yesterday, due, missed, link };
}));
