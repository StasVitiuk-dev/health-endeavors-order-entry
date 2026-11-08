# Business-day boundary — audit + missing policy (wave-2 item 4)

Status: 2026-11-08, commit on `claude/ext20-recovery-2026-10-31`. Local/synthetic.

## What is consistent today

The report-export model assigns every ledger event to a business day with one
function, `businessDate(at, offsetHours)`, and the same business date flows into:
- the daily **report rows** (`summarizeLedger`),
- the **export manifest** coverage and `report_date` values (`buildManifest`),

so report rows and export naming share one basis. Order history in the live
dashboard uses the row's own `report_date` / local-date helpers; those must be
driven by the **same** convention once one is chosen (see below). Verified by
`dst-boundary-ext21.spec.js` and `report-ledger-ext21.spec.js`.

## The missing policy (OWNER DECISION REQUIRED)

`businessDate` takes a **fixed UTC offset**. A fixed offset cannot be correct in
both standard time and daylight time: for US Pacific it is UTC-8 in winter (PST)
and UTC-7 in summer (PDT). An order in the near-midnight hour is therefore
misassigned by one day for half the year under any single fixed offset. Pinned
in `dst-boundary-ext21.spec.js`:

- `businessDate('2026-07-16T07:30:00Z', -8)` → `2026-07-15` (wrong under PDT)
- `businessDate('2026-07-16T07:30:00Z', -7)` → `2026-07-16` (DST-correct)

This is **not a bug to silently patch** — it is a policy choice:

1. **Fixed offset** (current): simplest, deterministic, but off by a day for the
   near-midnight hour during daylight time. Acceptable only if the store treats
   the business day in a fixed-offset sense year-round.
2. **IANA time zone** (e.g. `America/Los_Angeles`): tracks DST correctly, at the
   cost of a zone-aware date computation (the browser's `Intl`/`toLocaleString`
   with `timeZone`, or a small zone table). Recommended if order history, daily
   reports and export naming must match the owner's wall clock all year.

Until the owner picks one, the model stays on the fixed offset and this gap is
recorded rather than hidden. No report, history view or export naming should
adopt a *different* convention in the meantime — one basis, whichever is chosen.

## Next runnable change (when the owner decides)

If the owner chooses an IANA zone: replace `businessDate`'s fixed-offset shift
with a zone-aware local-date computation and pass the store's zone from config;
re-point `summarizeLedger` and the dashboard's local-date helpers at it; update
`dst-boundary-ext21.spec.js` to assert the DST-correct day. Acceptance: the
near-midnight summer order lands on the DST-correct day and report/history/export
all agree. No production data is touched.
