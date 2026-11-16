// Printable reports & export manifest — DETERMINISTIC model (Phase 2 item 9,
// local/synthetic).
//
// Pure: no DOM, no network, no file writing, no real PDF rendering, no email.
// Reuses the Report History daily-row shape (the nightly daily_reports snapshot
// written by the scheduled DB job) but never writes to it — this is a
// selection / print-preview / export-packaging model only.
//
// What it provides:
//   selectReports  — pick the daily rows in a date range (inclusive).
//   dailySummary   — roll a set of daily rows into totals, keeping MISSING
//                    values UNKNOWN (never silently zero).
//   printModel     — a US-Letter print model (page geometry + rows) that a
//                    renderer could lay out. It is a MODEL, not a rendered PDF.
//   buildManifest  — package selected rows into an export manifest with a
//                    deterministic content checksum.
//   verifyManifest — recompute the checksum and confirm it still matches.
//   exportAttempt / retryExport — a simulated export with a dedup key and an
//                    explicit failure→retry path (never a double export).
//
// Numbers that were never measured stay the string 'UNKNOWN'; a real measured
// zero stays 0. The two are never conflated.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-report-export'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // US-Letter at 96 CSS px/in, 0.5in margins. A print renderer would consume
  // these; we only model them so the layout is deterministic and testable.
  const US_LETTER = Object.freeze({
    page: 'us-letter', widthPx: 816, heightPx: 1056, marginPx: 48,
    contentWidthPx: 816 - 96, contentHeightPx: 1056 - 96, orientation: 'portrait',
  });

  // Export package schema. A restore refuses an unsupported version before it
  // reads any data, so a newer package never half-applies into an older build.
  const SCHEMA_VERSION = 1;
  const SUPPORTED_SCHEMAS = [1];
  // Automatic off-machine sync (e.g. to a Mac) is a SEPARATE native component,
  // not part of this package and not enabled here. Named so it is never assumed.
  const MAC_SYNC_DEPENDENCY = 'automatic Mac sync is a separate native background component (not part of this package and not enabled here); existing backups are untouched';

  const METRICS = ['orders_count', 'revenue', 'new_inquiries_count', 'tasks_opened_count', 'incidents_opened_count', 'ai_calls_count', 'ai_cost'];
  const COUNT_METRICS = new Set(['orders_count', 'new_inquiries_count', 'tasks_opened_count', 'incidents_opened_count', 'ai_calls_count']);

  // A value is MISSING when it is null/undefined or an empty string. 0 is a
  // real value and is preserved.
  const isMissing = (v) => v === null || v === undefined || v === '';
  // Nov 16: a value already marked 'UNKNOWN' (a row read back from an export)
  // stays UNKNOWN, and so does any value that is not a readable number. Before,
  // Number('UNKNOWN') was NaN and was written as null, so a restored export with
  // an unmeasured figure could never reproduce its own checksum.
  const numOrUnknown = (v) => {
    if (isMissing(v) || v === 'UNKNOWN') return 'UNKNOWN';
    const n = Number(v);
    return Number.isFinite(n) ? n : 'UNKNOWN';
  };

  // Deterministic, dependency-free content hash (FNV-1a, 32-bit, hex). Used to
  // fingerprint an export's canonical JSON so a later verification can confirm
  // the package was not altered. Not a cryptographic guarantee — an integrity
  // check for a local print/export workflow.
  function fnv1a(input) {
    const str = String(input == null ? '' : input);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // Canonical JSON: object keys sorted, so the checksum is stable regardless of
  // property order in the source rows.
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (k) {
        return JSON.stringify(k) + ':' + canonical(value[k]);
      }).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }

  // Normalize one daily row to the fields we export/print, keeping MISSING as
  // 'UNKNOWN'. Dates are expected as 'YYYY-MM-DD' (local date string).
  function normalizeRow(r) {
    const row = r || {};
    const out = { report_date: String(row.report_date || row.date || '').trim(), currency: row.currency || 'USD' };
    METRICS.forEach(function (m) { out[m] = numOrUnknown(row[m]); });
    out.emailed = row.emailed_at ? true : false;
    return out;
  }

  // Integer-cents helpers for ledger aggregation (avoid float drift).
  const cents = (v) => Math.round((Number(v) || 0) * 100);
  const money = (c) => Math.round(c) / 100;

  // The business-day date for a timestamp, under a fixed UTC offset (hours).
  // offsetHours shifts the instant before the calendar date is taken, so an
  // order at 23:30 local on the 7th counts on the 7th, not the UTC-8th.
  function businessDate(at, offsetHours) {
    const t = +new Date(at);
    if (isNaN(t)) return null;
    return new Date(t + (Number(offsetHours) || 0) * 3600000).toISOString().slice(0, 10);
  }

  // Aggregate a synthetic ledger of events into daily report rows. Event types:
  //   order   (amount; a null amount makes that day's revenue UNKNOWN, not 0)
  //   cancel  (removes the order from the count; reverses its amount if given)
  //   refund  (amount; reduces net revenue)
  //   expense (amount; tracked separately, never netted into revenue)
  // Each event is assigned to a business day via businessDate(at, offsetHours),
  // or — owner decision #4 (reporting day ends at midnight Central) — via a
  // caller-supplied dayOf(at) such as the daylight-saving-aware business day in
  // he-report-schedule. A fixed offset is wrong for half the year in a zone
  // that observes daylight saving; dayOf is the way to roll up by local day.
  function summarizeLedger(events, opts) {
    const o = opts || {}; const off = o.offsetHours || 0; const cur = o.currency || 'USD';
    const dayOf = typeof o.dayOf === 'function' ? o.dayOf : function (at) { return businessDate(at, off); };
    const byDay = {};
    (Array.isArray(events) ? events : []).forEach(function (e) {
      if (!e || typeof e !== 'object') return;                 // an empty row is skipped, not a crash
      const day = dayOf(e.at); if (!day) return;
      const r = byDay[day] || (byDay[day] = { report_date: day, currency: cur, orders_count: 0, revenueC: 0, refundC: 0, expenseC: 0, canceled_count: 0, revenueUnknown: false });
      if (e.type === 'order') { r.orders_count += 1; if (e.amount == null) r.revenueUnknown = true; else r.revenueC += cents(e.amount); }
      else if (e.type === 'cancel') { r.orders_count -= 1; r.canceled_count += 1; if (e.amount != null) r.revenueC -= cents(e.amount); }
      else if (e.type === 'refund') { r.refundC += cents(e.amount); }
      else if (e.type === 'expense') { r.expenseC += cents(e.amount); }
    });
    return Object.keys(byDay).sort().map(function (day) {
      const r = byDay[day];
      return {
        report_date: r.report_date, currency: r.currency,
        orders_count: Math.max(0, r.orders_count), canceled_count: r.canceled_count,
        revenue: r.revenueUnknown ? 'UNKNOWN' : money(Math.max(0, r.revenueC - r.refundC)),
        refunds: money(r.refundC), expenses: money(r.expenseC),
      };
    });
  }

  // Select the daily rows whose report_date falls within [from, to] inclusive.
  // from/to are 'YYYY-MM-DD'; omitting one leaves that side open. Results are
  // sorted ascending by date and normalized.
  function selectReports(history, range) {
    const r = range || {};
    const from = r.from ? String(r.from) : null;
    const to = r.to ? String(r.to) : null;
    return (Array.isArray(history) ? history : []).filter(function (row) { return row && typeof row === 'object'; })
      .map(normalizeRow)
      .filter(function (row) {
        if (!row.report_date) return false;
        if (from && row.report_date < from) return false;
        if (to && row.report_date > to) return false;
        return true;
      })
      .sort(function (a, b) { return a.report_date < b.report_date ? -1 : a.report_date > b.report_date ? 1 : 0; });
  }

  // Roll selected rows into totals. A metric total is UNKNOWN unless at least
  // one row carried a real value; rows with a missing value are counted in
  // `missing` so the gap is visible rather than hidden as zero.
  function dailySummary(rows) {
    const list = (Array.isArray(rows) ? rows : []).filter(function (row) { return row && typeof row === 'object'; });
    const totals = {}; const measured = {}; const missing = {};
    METRICS.forEach(function (m) { totals[m] = 0; measured[m] = 0; missing[m] = 0; });
    list.forEach(function (row) {
      METRICS.forEach(function (m) {
        if (row[m] === 'UNKNOWN') { missing[m] += 1; }
        else { totals[m] += Number(row[m]) || 0; measured[m] += 1; }
      });
    });
    const out = { days: list.length, currency: (list[0] && list[0].currency) || 'USD', missing: missing };
    METRICS.forEach(function (m) {
      out[m] = measured[m] === 0 ? 'UNKNOWN' : (COUNT_METRICS.has(m) ? totals[m] : Math.round(totals[m] * 100) / 100);
    });
    return out;
  }

  // A US-Letter print model: page geometry + a title + the normalized rows +
  // the summary. A renderer lays this out; this is NOT a rendered PDF and does
  // not produce a file. Labeled SIMULATED so it is never mistaken for one.
  function printModel(input) {
    const i = input || {};
    const rows = selectReports(i.history || i.rows || [], { from: i.from, to: i.to });
    return {
      kind: 'print_model', label: 'SIMULATED', renderedPdf: false,
      page: US_LETTER,
      title: i.title || 'Daily report',
      range: { from: i.from || (rows[0] && rows[0].report_date) || null, to: i.to || (rows[rows.length - 1] && rows[rows.length - 1].report_date) || null },
      columns: ['Date', 'Orders', 'Revenue', 'New questions', 'Tasks', 'Incidents', 'AI calls', 'AI cost'],
      rows: rows,
      summary: dailySummary(rows),
      note: 'Print model only — not a rendered PDF and nothing is sent. Values marked UNKNOWN were never measured.',
      synthetic: true,
    };
  }

  // Package selected rows into an export manifest with a deterministic checksum
  // over the canonical payload. Never writes a file — it describes what an
  // export WOULD contain so it can be previewed and verified first.
  function buildManifest(input) {
    const i = input || {};
    const rows = selectReports(i.history || i.rows || [], { from: i.from, to: i.to });
    const format = i.format || 'json';
    const payload = { reports: rows, summary: dailySummary(rows) };
    const canonicalStr = canonical(payload);
    const checksum = fnv1a(canonicalStr);
    const range = { from: i.from || (rows[0] && rows[0].report_date) || null, to: i.to || (rows[rows.length - 1] && rows[rows.length - 1].report_date) || null };
    return {
      kind: 'export_manifest', label: 'SIMULATED',
      schemaVersion: SCHEMA_VERSION,
      format: format, rowCount: rows.length,
      range: range,
      coverage: { from: range.from, to: range.to, days: rows.length },
      macSync: { automatic: false, dependency: MAC_SYNC_DEPENDENCY },
      byteLength: canonicalStr.length,
      checksum: checksum, checksumAlgorithm: 'fnv1a-32',
      createdAt: i.now || null,
      entries: [
        { name: 'reports.' + (format === 'csv' ? 'csv' : 'json'), kind: 'data', rows: rows.length },
        { name: 'summary.json', kind: 'summary', rows: 1 },
        { name: 'MANIFEST.txt', kind: 'manifest', rows: 1 },
      ],
      payload: payload,
      note: 'Export package description only. Nothing was written, uploaded or emailed.',
      synthetic: true,
    };
  }

  // Recompute the checksum from the manifest's own payload (or from supplied
  // rows) and confirm it still matches. Catches a payload that was altered
  // after the manifest was built.
  function verifyManifest(manifest, rowsOverride) {
    const m = manifest || {};
    const payload = rowsOverride
      ? { reports: selectReports(rowsOverride, {}), summary: dailySummary(selectReports(rowsOverride, {})) }
      : m.payload;
    if (!payload) return { ok: false, reason: 'no payload to verify' };
    const recomputed = fnv1a(canonical(payload));
    const ok = recomputed === m.checksum;
    return { ok: ok, expected: m.checksum, actual: recomputed, mismatch: !ok };
  }

  // The package an export WOULD write: schema version, the entry names, the
  // checksum and the payload. Pure — nothing is written to disk.
  function packageOf(manifest) {
    const m = manifest || {};
    return { schemaVersion: m.schemaVersion, entries: (Array.isArray(m.entries) ? m.entries : []).map(function (e) { return e && e.name; }), checksum: m.checksum, payload: m.payload };
  }

  // Open (restore) a package for a recovery drill. Rejects an unsupported schema
  // version, a missing entry file, or a checksum mismatch — and does so BEFORE
  // any data would be applied (this function is pure and writes nothing, so a
  // rejection can never leave a half-written restore). `present` lists the entry
  // files actually found (defaults to all); omit one to simulate a missing file.
  function openPackage(pkg, opts) {
    const p = pkg || {}; const o = opts || {};
    if (SUPPORTED_SCHEMAS.indexOf(p.schemaVersion) === -1) {
      return { ok: false, rejected: true, stage: 'schema', applied: false, reason: 'unsupported schema version: ' + p.schemaVersion };
    }
    const want = p.entries || [];
    const present = o.present || want;
    const missing = want.filter(function (n) { return present.indexOf(n) === -1; });
    if (missing.length) {
      return { ok: false, rejected: true, stage: 'files', applied: false, reason: 'missing file(s): ' + missing.join(', ') };
    }
    const recomputed = fnv1a(canonical(p.payload));
    if (recomputed !== p.checksum) {
      return { ok: false, rejected: true, stage: 'checksum', applied: false, reason: 'checksum mismatch (package altered or corrupt)' };
    }
    const rows = (p.payload && p.payload.reports) || [];
    return { ok: true, rejected: false, applied: true, schemaVersion: p.schemaVersion, coverage: { from: rows[0] && rows[0].report_date, to: rows.length ? rows[rows.length - 1].report_date : null, days: rows.length } };
  }

  // Simulated export attempt. NEVER moves data anywhere — it only models the
  // state so a UI can show success/failure/retry. `fail` forces a failure (for
  // testing the retry path); `key` dedups so re-running the same export does
  // not double-count. Returns a state object to pass back to retryExport.
  function exportAttempt(manifest, opts) {
    const o = opts || {};
    const key = String(o.key || '');
    const base = { key: key || null, manifestChecksum: (manifest || {}).checksum || null, attempts: [] };
    return applyAttempt(base, o);
  }

  function retryExport(state, opts) {
    const s = state || { attempts: [] };
    if (s.status === 'exported') return Object.assign({}, s, { duplicate: true });
    return applyAttempt(s, opts || {});
  }

  function applyAttempt(state, o) {
    const attemptNo = (state.attempts || []).length + 1;
    const failed = o.fail === true;
    const attempt = { attempt: attemptNo, at: o.at || null, ok: !failed, reason: failed ? (o.reason || 'simulated export failure') : null };
    const attempts = (state.attempts || []).concat([attempt]);
    return Object.assign({}, state, {
      attempts: attempts,
      attempt: attemptNo,
      status: failed ? 'failed' : 'exported',
      ok: !failed,
      canRetry: failed,
      duplicate: false,
    });
  }

  return {
    US_LETTER, METRICS, isMissing, fnv1a, canonical,
    SCHEMA_VERSION, SUPPORTED_SCHEMAS, MAC_SYNC_DEPENDENCY,
    businessDate, summarizeLedger,
    normalizeRow, selectReports, dailySummary, printModel,
    buildManifest, verifyManifest, packageOf, openPackage, exportAttempt, retryExport,
  };
}));
