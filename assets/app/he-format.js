// assets/app/he-format.js — display rules: missing values never shown as zero, mixed-currency notes, badges, number fields
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-format', { api: 1, needs: ['CLOSED_WORDS','esc','fmtDateOnly'] }, function (ctx) {
    const { CLOSED_WORDS, esc, fmtDateOnly } = ctx;
    // PostgREST list of the closed status words, for "status not in (...)" (EXT7).
    const CLOSED_IN = '(' + CLOSED_WORDS.map(w => '"' + w + '"').join(',') + ')';
    // EXT5: a browser number box silently empties text it can't read ("$12.50",
    // "1,200", "12 units"), so the page used to say "is empty". This hands the
    // number check something that is clearly not a number instead, so the
    // person is told to type plain digits.
    function numVal(el){
      if (!el) return '';
      if (el.validity && el.validity.badInput) return '(not a plain number)';
      return el.value;
    }
    // A failed check's type suggests which Incident category fits, but a
    // critical severity always points at product safety regardless of type —
    // that's the one case worth overriding the type-based guess.
    function qcIncidentCategory(qc){
      if (qc.severity === 'critical') return 'product_safety';
      if (qc.check_type === 'customer_complaint') return 'customer_complaint';
      if (qc.check_type === 'other') return 'other';
      return 'manufacturing';
    }
    function inqStatusBadgeClass(status){
      if (status === 'needs_review') return 'sev-high';
      if (status === 'drafted') return 'sev-medium';
      if (status === 'answered') return 'sev-low';
      return '';
    }

    // Business Continuity: the health of every outside service this system
    // depends on. Status is manually set by the owner; a couple of rows also
    // get a real "last seen" signal pulled live from actual activity.
    function continuityBadgeClass(status){
      if (status === 'operational') return 'sev-low';
      if (status === 'degraded') return 'sev-medium';
      if (status === 'down') return 'sev-high';
      return '';
    }

    // EXT6: totals add every order's amount as one currency, labelled with the
    // first order's currency. Say so plainly if the orders are in more than
    // one currency, instead of showing a confident but meaningless sum.
    // X11-01: an order saved without a total used to add $0.00 to revenue
    // silently (Number(null) is 0). Count those so each page can say the
    // figure leaves them out, instead of looking complete.
    function missingTotalCount(orders){
      return (orders || []).filter(o => o.total === null || o.total === undefined || String(o.total).trim() === '').length;
    }
    function missingTotalNote(orders, where){
      const n = missingTotalCount(orders);
      if (!n) return '';
      return where + ': ' + n + ' order' + (n === 1 ? ' has' : 's have') + ' no total saved, so ' + (n === 1 ? 'it is' : 'they are') + ' left out of the revenue figure (not counted as $0 sales on purpose). Open Orders and correct ' + (n === 1 ? 'it' : 'them') + '.';
    }
    function mixedCurrencyNote(orders, where, shown){
      const set = [...new Set((orders || []).map(o => String(o.currency || 'USD').toUpperCase()))].sort();
      if (set.length < 2) return '';
      return where + ': these orders are in more than one currency (' + set.join(', ') + '), but the totals add them together and show them as ' + shown
        + '. Do not rely on these totals until the amounts are converted (ask your accountant).';
    }

    // EXT11: a count or amount missing from a report is shown as "—", never as 0 / $0.00.
    function missingToNaN(v){ return (v === null || v === undefined || String(v).trim() === '') ? NaN : v; }
    function reportCount(v){
      if (v === null || v === undefined || String(v).trim() === '') return '—';
      const n = Number(v);
      return Number.isFinite(n) ? n : '—';
    }

    function docExpiryBadge(expirationDate){
      if (!expirationDate) return '';
      const exp = new Date(expirationDate + 'T00:00:00');
      const days = Math.round((exp.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
      if (days < 0) return `<span class="badge sev-high">Expired ${esc(fmtDateOnly(expirationDate))}</span>`;
      if (days <= 30) return `<span class="badge sev-medium">Expires in ${days}d (${esc(fmtDateOnly(expirationDate))})</span>`;
      return `<span class="badge sev-low">Valid until ${esc(fmtDateOnly(expirationDate))}</span>`;
    }

  return { missingToNaN, reportCount, missingTotalCount, missingTotalNote, mixedCurrencyNote, docExpiryBadge, inqStatusBadgeClass, continuityBadgeClass, qcIncidentCategory, numVal, CLOSED_IN };
});
