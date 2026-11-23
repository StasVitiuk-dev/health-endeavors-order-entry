# Data integrity rules (EXT10 catalog)

**Status:** CURRENT (2026-10-11, extension 10). Supersedes `DATA_INTEGRITY_RULES_EXT9.md` (kept as history; I-1…I-20 keep their numbers). "Page" = dashboard code (convenience and honesty); "DB" = the database (the real lock). "Today" = live on `main`; "Branch" = on the EXT10 branch (EXT1–10), tested locally, not merged; "Draft" = SQL written and tested locally, **not installed**. Per-workflow view: `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md`.

| # | Rule | Enforced by | State | Proof (tests) |
|---|---|---|---|---|
| I-1 | Stock never silently doubles (delivery, return, recall move stock once, whatever the clicks, tabs or retries) | Page: claim-first conditional status change. DB: R1/R2/R3 lock and answer "already done" | Branch / Draft + switch | po-receive, inventory-safety, stock-functions; po_race_interleavings.sh, stress_test.sh |
| I-2 | A received PO cannot be received again | page claim; R1 `already_received` | Branch / Draft | po-receive, stock-functions |
| I-3 | One delivery = one expense | same claim; R1 single transaction | Branch / Draft | concurrency_test.sh |
| I-4 | No stock bucket below zero | DB CHECK on 7 buckets (today); `recalled` with draft 23 | Today / Draft | inventory-safety, integrity_constraints_test.sh |
| I-5 | A stale page never overwrites a newer save | `updateIfUnchanged` with the values shown; R4 `p_expected` | Branch | double-submit-stale, state-transitions, calendar-owner, stock-functions |
| I-6 | A slower old reply never draws over a newer one | latest-request token (now also on the nightly check card) | Branch | out-of-order, nightly-check-ext10 |
| I-7 | An operation that must be atomic never half-applies | today: detected and reported; with switches: one DB transaction | Branch / Draft + switch | po-receive, stock-functions |
| I-8 | A failed, unknown or skipped check never shows as success or zero | UNKNOWN / NOT VERIFIED states; **EXT10: unreadable amounts show "—", not $0.00 (X10-03); nightly card never PASS without a fresh, complete, successful run** | Branch | attention-checks, nightly-check-ext10, helpers-unit |
| I-9 | Health results know their age | "Checked at …" (15 min); **nightly: last success / last attempt / 26 h staleness** | Branch | attention-checks, nightly-check-ext10 |
| I-10 | Dangerous actions need an explicit human action | second press, password, no automatic approval | Today / Branch | reauth-double-submit, admin-pages, safety |
| I-11 | DRAFT ≠ SEND: nothing leaves for a customer | no send code path | Today + Branch | hard-walls, no-live-send |
| I-12 | Accounting and tax are read-only | no page writes accounting/tax/payment tables | Today + Branch | hard-walls, accounting-oracle, tax-oracle |
| I-13 | A lot never holds more than received, nor below 0 | DB CHECK (draft 23) | Draft | integrity_constraints_test.sh |
| I-14 | A PO line is never received beyond what was ordered | DB CHECK (draft 23); R1 | Draft | integrity_constraints_test.sh |
| I-15 | A product with history is never deleted | page checks + R5 + foreign keys | Branch / Draft | inventory-safety, product-lifecycle, stock-functions |
| I-16 | A switch is on only when what it needs exists | page probes before allowing it (stock functions, request-key columns, **nightly check tables**); drafts refuse in the wrong order | Branch / Draft | stock-functions, request-keys, nightly-check-ext10, stock_switches_test, integrity_home_test |
| I-17 | Duplicate creates after a lost reply are prevented, not just warned | request keys: **dashboard IMPLEMENTED IN BRANCH on all 18 create paths (EXT10)**, switch `request_keys` off; drafts 19 + 27 NOT INSTALLED | Branch / Draft | request-keys, request-keys-ext10 (30), request_keys_test.sh |
| I-18 | Every write is attributable | audit trigger on core tables; gaps in `AUDITABILITY_REVIEW.md` | Partly | V2 §10 to confirm |
| I-19 | Exports never run as spreadsheet formulas | `csvCell` | Branch | helpers-unit, csv-export-guard |
| I-20 | The dashboard is never shown inside another site's frame | frame guard on every page | Branch | csp |
| **I-21** (new) | A record can be escalated to an incident at most once, even across tabs and retries | page re-reads the link + conditional link; **key made from the record** so the database keeps one incident | Branch / Draft (key needs drafts 19) | request-keys-ext10 "escalate twice" |
| **I-22** (new) | A request key is never reused for a different person or for clearly new content | key tied to the signed-in user and to the content after 10 minutes | Branch | request-keys-ext10 lifecycle tests |
| **I-23** (new) | The nightly check never changes business data, and a failed run is never silent | security-invoker function writing only its own tables; failure logged with its error, half results undone | Draft (25 + 29) | integrity_home_test.sh (failure planted), integrity_perf_test.sh (data unchanged at 50k orders) |
| **I-24** (new) | Nightly results are visible only to owner/admin; nobody signed in can write or run the check | RLS read rule `is_owner_or_admin()`; no write grant; function revoked from all roles | Draft (29) | integrity_home_test.sh (owner reads, staff 0, anon denied, owner cannot write or run) |

## Invariant suite (what is checked, where)

| Invariant family | Checked by | When |
|---|---|---|
| Stock vs history, deliveries vs stock and expense | Query E (`04_…`), `invariants.sql` | owner runs (V6); local after every stress run |
| Stuck work, duplicates, wrong references, impossible values | Query F (`05_…`) | owner runs (V7); nightly once drafts 25 + 29 are installed; Home card |
| Value ranges | DB CHECKs (today) + draft 23 | always (DB) |
| Write-path guards | `write-path-inventory.spec.js` + generated inventory | every test run |
