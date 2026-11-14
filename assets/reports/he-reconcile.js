// #08 Reconciliation — DRAFT ONLY, synthetic, advisory. Compares what SHOULD have
// been received (expected: issued invoices or orders, by reference) with what
// WAS recorded (payments), and gives every difference an explicit review state.
//
//   MATCHED            recorded total equals the expected amount
//   UNDERPAID          recorded less than expected
//   OVERPAID           recorded more than expected
//   MISSING            expected, nothing recorded
//   UNEXPECTED         recorded against a reference nobody expected
//   DUPLICATE          the same recorded entry id appears more than once
//   CURRENCY_MISMATCH  recorded in a different currency (never converted here)
//   UNKNOWN_AMOUNT     the expected or a recorded amount is missing — never
//                      treated as 0, never counted as matched
//
// It never moves money, never edits an invoice or a payment and never "fixes" a
// difference: a difference is closed only by a named owner/administrator review
// with a written note, and the figures stay exactly as they were. Calibration
// (a tolerance other than exact) is the owner's call and defaults to none.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.reports registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-reconcile'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OUTCOMES = ['MATCHED', 'UNDERPAID', 'OVERPAID', 'MISSING', 'UNEXPECTED', 'DUPLICATE', 'CURRENCY_MISMATCH', 'UNKNOWN_AMOUNT'];
  const REVIEW_STATES = ['NOT_NEEDED', 'OPEN', 'REVIEWED'];
  const ROLES_MAY_REVIEW = new Set(['owner', 'administrator']);
  const GUARD = 'Advisory only — no money is moved and no invoice or payment is changed.';

  const hasAmount = (v) => v !== null && v !== undefined && v !== '' && isFinite(Number(v));
  const cents = (v) => Math.round(Number(v) * 100);
  const money = (c) => Math.round(c) / 100;
  const refOf = (x) => String(x && x.ref != null ? x.ref : '').trim();
  const curOf = (x, d) => String((x && x.currency) || d || 'USD').toUpperCase();

  // expected: [{ ref, amount, currency? }]      recorded: [{ id?, ref, amount, currency? }]
  // opts: { toleranceCents (default 0), currency (default 'USD') }
  function reconcile(expected, recorded, opts) {
    const o = opts || {};
    const tol = (typeof o.toleranceCents === 'number' && o.toleranceCents > 0) ? Math.floor(o.toleranceCents) : 0;
    const defCur = o.currency || 'USD';
    const items = [];

    // A recorded entry whose id repeats is a duplicate: the first one counts,
    // each repeat is reported on its own line and left OUT of the totals.
    const seenIds = new Set();
    const usable = [];
    (recorded || []).forEach(function (r) {
      const id = r && r.id != null ? String(r.id) : '';
      if (id && seenIds.has(id)) {
        items.push({ ref: refOf(r), outcome: 'DUPLICATE', expected: null, recorded: hasAmount(r.amount) ? money(cents(r.amount)) : null, difference: null,
          currency: curOf(r, defCur), detail: 'recorded entry ' + id + ' appears more than once; the repeat is not counted', entryIds: [id] });
        return;
      }
      if (id) seenIds.add(id);
      usable.push(r);
    });

    const byRef = new Map();
    usable.forEach(function (r) { const k = refOf(r); if (!byRef.has(k)) byRef.set(k, []); byRef.get(k).push(r); });

    const expectedRefs = new Set();
    (expected || []).forEach(function (e) {
      const ref = refOf(e); expectedRefs.add(ref);
      const cur = curOf(e, defCur);
      const recs = byRef.get(ref) || [];
      const ids = recs.map(function (r) { return r.id != null ? String(r.id) : null; }).filter(Boolean).sort();
      const base = { ref: ref, currency: cur, entryIds: ids };
      if (!hasAmount(e.amount)) {
        items.push(Object.assign(base, { outcome: 'UNKNOWN_AMOUNT', expected: null, recorded: null, difference: null, detail: 'the expected amount is missing — not treated as 0' }));
        return;
      }
      const expC = cents(e.amount);
      if (!recs.length) {
        items.push(Object.assign(base, { outcome: 'MISSING', expected: money(expC), recorded: 0, difference: money(-expC), detail: 'nothing recorded against this reference' }));
        return;
      }
      if (recs.some(function (r) { return curOf(r, defCur) !== cur; })) {
        items.push(Object.assign(base, { outcome: 'CURRENCY_MISMATCH', expected: money(expC), recorded: null, difference: null, detail: 'recorded in a different currency; not converted' }));
        return;
      }
      if (recs.some(function (r) { return !hasAmount(r.amount); })) {
        items.push(Object.assign(base, { outcome: 'UNKNOWN_AMOUNT', expected: money(expC), recorded: null, difference: null, detail: 'a recorded amount is missing — not treated as 0' }));
        return;
      }
      const recC = recs.reduce(function (s, r) { return s + cents(r.amount); }, 0);
      const diffC = recC - expC;
      const outcome = Math.abs(diffC) <= tol ? 'MATCHED' : (diffC < 0 ? 'UNDERPAID' : 'OVERPAID');
      items.push(Object.assign(base, { outcome: outcome, expected: money(expC), recorded: money(recC), difference: money(diffC),
        detail: outcome === 'MATCHED' ? (diffC === 0 ? 'exact' : 'within the allowed tolerance') : (outcome === 'UNDERPAID' ? 'short by ' : 'over by ') + money(Math.abs(diffC)).toFixed(2) }));
    });

    byRef.forEach(function (recs, ref) {
      if (expectedRefs.has(ref)) return;
      const known = recs.every(function (r) { return hasAmount(r.amount); });
      const recC = known ? recs.reduce(function (s, r) { return s + cents(r.amount); }, 0) : null;
      items.push({ ref: ref, outcome: 'UNEXPECTED', expected: null, recorded: known ? money(recC) : null, difference: known ? money(recC) : null,
        currency: curOf(recs[0], defCur), detail: ref ? 'recorded against a reference that was not expected' : 'recorded with no reference',
        entryIds: recs.map(function (r) { return r.id != null ? String(r.id) : null; }).filter(Boolean).sort() });
    });

    // Stable, readable order: by reference, then by outcome position.
    items.sort(function (a, b) { return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : OUTCOMES.indexOf(a.outcome) - OUTCOMES.indexOf(b.outcome); });
    items.forEach(function (it, i) { it.line = i + 1; it.reviewState = it.outcome === 'MATCHED' ? 'NOT_NEEDED' : 'OPEN'; it.review = null; });

    const counts = {}; OUTCOMES.forEach(function (k) { counts[k] = 0; });
    let expTotalC = 0, recTotalC = 0, unknown = false;
    items.forEach(function (it) {
      counts[it.outcome] += 1;
      if (it.outcome === 'DUPLICATE') return;                    // repeats stay out of the totals
      if (it.outcome === 'UNKNOWN_AMOUNT' || it.outcome === 'CURRENCY_MISMATCH') { unknown = true; return; }
      if (it.expected != null) expTotalC += cents(it.expected);
      if (it.recorded != null) recTotalC += cents(it.recorded); else if (it.outcome === 'UNEXPECTED') unknown = true;
    });
    return {
      items: items, counts: counts,
      totals: { expected: money(expTotalC), recorded: money(recTotalC), difference: money(recTotalC - expTotalC), complete: !unknown,
        note: unknown ? 'Totals leave out lines whose amount is unknown or in another currency — they are not complete.' : null },
      toleranceCents: tol, open: items.filter(function (it) { return it.reviewState === 'OPEN'; }).length,
      balanced: items.every(function (it) { return it.outcome === 'MATCHED'; }),
      audit: [], draft: true, synthetic: true, label: 'SIMULATED', guard: GUARD,
    };
  }

  // Record that a person looked at one difference and wrote down why it is what
  // it is. Owner/administrator only, note required. The figures do not change.
  // Pure: returns a new result; the input is not mutated.
  function markReviewed(result, line, opts) {
    const o = opts || {};
    const it = (result && result.items || []).find(function (x) { return x.line === line; });
    if (!it) return { ok: false, reason: 'no such line', result: result };
    if (!ROLES_MAY_REVIEW.has(o.role)) return { ok: false, reason: 'only an owner or administrator may close a difference', result: result };
    if (it.reviewState === 'NOT_NEEDED') return { ok: false, reason: 'a matched line needs no review', result: result };
    if (it.reviewState === 'REVIEWED') return { ok: false, reason: 'already reviewed', result: result };
    const note = String(o.note || '').trim();
    if (note.length < 5) return { ok: false, reason: 'a written note is required to close a difference', result: result };
    const review = { by: String(o.by || o.role), role: o.role, at: o.at || null, note: note.slice(0, 500) };
    const items = result.items.map(function (x) { return x.line === line ? Object.assign({}, x, { reviewState: 'REVIEWED', review: review }) : x; });
    return { ok: true, result: Object.assign({}, result, {
      items: items, open: items.filter(function (x) { return x.reviewState === 'OPEN'; }).length,
      audit: result.audit.concat([{ action: 'REVIEWED', line: line, ref: it.ref, outcome: it.outcome, by: review.by, at: review.at }]),
    }) };
  }

  // Closed = every difference has been reviewed. Closed is NOT the same as
  // balanced: reviewing a shortfall does not make the money appear.
  function status(result) {
    const r = result || { items: [] };
    const open = r.items.filter(function (x) { return x.reviewState === 'OPEN'; }).length;
    const reviewed = r.items.filter(function (x) { return x.reviewState === 'REVIEWED'; }).length;
    return {
      balanced: r.items.every(function (x) { return x.outcome === 'MATCHED'; }),
      closed: open === 0, open: open, reviewed: reviewed,
      state: r.items.every(function (x) { return x.outcome === 'MATCHED'; }) ? 'BALANCED' : (open === 0 ? 'CLOSED_WITH_DIFFERENCES' : 'NEEDS_REVIEW'),
    };
  }

  // Build the two sides from invoice records shaped like he-invoice's (number,
  // status, total, payments[], currency) plus optional credit notes
  // ({ invoiceNumber, amount }). What is EXPECTED for an invoice is its total
  // less any credit notes against it. A draft has no number and is ignored. A
  // VOID invoice expects nothing, so any payment recorded against it surfaces
  // as UNEXPECTED rather than quietly matching. Nothing here reads or changes
  // an invoice; it only lists.
  function fromInvoices(invoices, creditNotes) {
    const credited = new Map();
    (creditNotes || []).forEach(function (c) {
      const k = String(c && c.invoiceNumber != null ? c.invoiceNumber : '').trim();
      if (!k || !hasAmount(c.amount)) return;
      credited.set(k, (credited.get(k) || 0) + cents(c.amount));
    });
    const expected = []; const recorded = []; const skipped = [];
    (invoices || []).forEach(function (inv, idx) {
      const number = String(inv && inv.number != null ? inv.number : '').trim();
      if (!inv || inv.status === 'draft' || !number) { skipped.push({ index: idx, reason: 'draft or unnumbered — not yet owed' }); return; }
      const cur = curOf(inv);
      if (inv.status !== 'void') {
        const net = hasAmount(inv.total) ? money(Math.max(0, cents(inv.total) - (credited.get(number) || 0))) : null;
        expected.push({ ref: number, amount: net, currency: cur });
      }
      (inv.payments || []).forEach(function (p, i) {
        recorded.push({ id: p && p.key ? String(p.key) : number + '#' + (i + 1), ref: number, amount: p ? p.amount : null, currency: (p && p.currency) || cur });
      });
    });
    return { expected: expected, recorded: recorded, skipped: skipped };
  }

  function fixtures() {
    return {
      expected: [
        { ref: 'HE-2026-0001', amount: 272.53 },   // paid in full, two payments
        { ref: 'HE-2026-0002', amount: 180.00 },   // short by 30
        { ref: 'HE-2026-0003', amount: 96.40 },    // nothing recorded
        { ref: 'HE-2026-0004', amount: 55.00 },    // paid twice by mistake -> over
      ],
      recorded: [
        { id: 'SYN-P1', ref: 'HE-2026-0001', amount: 200.00 },
        { id: 'SYN-P2', ref: 'HE-2026-0001', amount: 72.53 },
        { id: 'SYN-P3', ref: 'HE-2026-0002', amount: 150.00 },
        { id: 'SYN-P4', ref: 'HE-2026-0004', amount: 55.00 },
        { id: 'SYN-P5', ref: 'HE-2026-0004', amount: 55.00 },
        { id: 'SYN-P5', ref: 'HE-2026-0004', amount: 55.00 }, // the same entry listed twice
        { id: 'SYN-P6', ref: 'HE-2026-0099', amount: 20.00 }, // no such invoice
      ],
    };
  }

  return { OUTCOMES, REVIEW_STATES, ROLES_MAY_REVIEW, GUARD, reconcile, markReviewed, status, fromInvoices, fixtures };
}));
