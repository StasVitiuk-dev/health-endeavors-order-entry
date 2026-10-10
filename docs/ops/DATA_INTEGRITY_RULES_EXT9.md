# Data integrity rules (EXT9 catalog)

**Status:** CURRENT (2026-10-10, extension 9). The rules the platform must never break, each with where it is enforced and the test that proves it. "Page" = dashboard code (convenience and honesty); "DB" = the database itself (the real lock). "Today" = live on `main` / production; "Branch" = on the EXT9 branch; "Draft" = SQL written and tested locally, not installed. Per-workflow view: `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md`.

| # | Rule | Enforced by | State | Proof (tests) |
|---|---|---|---|---|
| I-1 | Stock never silently doubles: a delivery, return or recall moves stock once, whatever the clicks, tabs or retries | Page: claim-first conditional status change. DB: R1/R2/R3 lock the row and answer "already done" | Page: Branch (EXT5–8); DB: Draft (R1–R3) + switch (EXT9) | po-receive, inventory-safety, stock-functions; po_race_interleavings.sh, stress_test.sh S2/S20 |
| I-2 | An already-received purchase order cannot be received again | Page claim (status must be ordered/shipped); R1 returns `already_received` | Branch / Draft | po-receive "second tab", stock-functions "lost reply" |
| I-3 | One delivery = one expense | Same claim; R1 inserts the expense in the same transaction | Branch / Draft | concurrency_test.sh (12 simultaneous receives: one expense) |
| I-4 | No stock bucket below zero | DB CHECK on 7 buckets (today); `recalled` too with draft 23; page and R4 refuse first | Today (7) / Draft (recalled) | inventory-safety "below zero", integrity_constraints_test.sh |
| I-5 | A stale page never overwrites a newer save | `updateIfUnchanged` with the values shown (status, payment, shipping/tax, product `updated_at`, calendar note text, personal event fields); R4 `p_expected` | Branch | double-submit-stale, state-transitions, pages-data "another tab", calendar-owner, stock-functions "saved elsewhere" |
| I-6 | A slower old reply never draws over a newer one | latest-request token on parameterised loads | Branch (EXT8) | out-of-order |
| I-7 | One operation never half-applies where it must be atomic (stock + history + status + expense) | Today: partial failures are **detected and reported** with what to finish by hand. With switches on: one DB transaction | Branch (report) / Draft + switch (atomic) | po-receive "dropped connection", stock-functions "failure part-way changes nothing" |
| I-8 | A failed, unknown or skipped check never shows as success or as zero | "could not check" (UNKNOWN) states; refusals with 0 rows shown as "not permitted" | Branch | attention-checks, owner-control-center, silent-refusal specs |
| I-9 | Health results know their age | "Checked at …", stale warning after 15 min, re-run on return | Branch (EXT9) | attention-checks "freshness" |
| I-10 | Dangerous actions need an explicit human action | second press (receive, delete), password (switches, Emergency, approvals), no automatic approval | Branch / Today | reauth-double-submit, admin-pages, safety |
| I-11 | DRAFT ≠ SEND: nothing leaves for a customer from the dashboard | no send code path at all | Today + Branch | hard-walls, no-live-send |
| I-12 | Accounting and tax are read-only | no page writes accounting/tax/payment tables; refunds are records, never money movements | Today + Branch | hard-walls, accounting-oracle, tax-oracle |
| I-13 | A lot never holds more than was received, nor below 0 | DB CHECK (draft 23) | Draft | integrity_constraints_test.sh |
| I-14 | A PO line is never received beyond what was ordered | DB CHECK (draft 23); R1 sets received = ordered | Draft | integrity_constraints_test.sh, invariants.sql |
| I-15 | A product with history is never deleted (archived/deactivated instead) | Page checks every reference + sold SKUs; R5 in one transaction; foreign keys | Branch / Draft | inventory-safety "product delete", product-lifecycle, stock-functions R5 |
| I-16 | A stock switch can only be on when its function exists | Page probes before allowing it; draft 21 refuses without R1–R5 | Branch / Draft | stock-functions "Feature Switches", stock_switches_test.sh |
| I-17 | Duplicate creates after a lost reply are prevented (not just warned) | request keys | Draft (19) + dashboard change **not built** | request_keys_test.sh |
| I-18 | Every write is attributable (who, when, what) | audit trigger on core tables (Query A); history rows carry `adjusted_by`; gaps listed in `AUDITABILITY_REVIEW.md` | Partly (gaps known) | auditability review; V2 §10 to confirm coverage |
| I-19 | Exports never run as spreadsheet formulas | `csvCell` neutralises = + - @ tab CR LF and full-width forms | Branch | helpers-unit "csvCell", csv-export-guard |
| I-20 | The dashboard is never shown inside another site's frame | frame guard on every page | Branch (EXT9) | csp "framed by another site" |
