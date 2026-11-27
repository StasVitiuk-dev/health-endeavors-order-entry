# Readiness ledger: one yardstick, frozen (v1, Nov 27, 2026)

Status: CURRENT · written 2026-11-27 (night). Percentages are planning estimates, not measurements; the
**rules** below are fixed so the numbers can no longer move because the scope changed. Progress per work
area stays in `docs/health-endeavors-progress.md`; this page fixes how the totals are counted.

## Why this exists

In chat the overall figure was given as 50–55%, then about 40–42%, and the dashboard as 70% and 80–85%.
Those were different scopes (whole business vs dashboard only; features built vs live and checked). From
now on every figure names its scope and uses the weights below; a change of weights is a new version
(v2) with the reason written down.

## The counting rules (v1)

1. **Done** means merged to `main` and, where it matters, live and checked. Work in an open pull request,
   a prototype, a database draft not installed, or a switch that is off counts as preparation.
2. **Documentation-only commits and quality fixes are not features.** They never raise a percentage.
3. An **R item** (launch fix) is complete only when its launch requirement is in production and has
   been exercised (stage column 7 below). Anything less shows in the columns, not in the count.
4. **REPORTED** (from the owner or older chats) is kept apart from **verified here** (in this repository,
   its tests or the owner's dated screenshots).
5. The public website is a separate project. Its figure is **REPORTED** from its own workspace and is
   never verified from this repository.

## The three totals (v1)

**A. Business launch readiness** (everything that must exist to sell and operate):

| Area | Weight | Estimate | Weighted | Source |
|---|---|---|---|---|
| Internal platform features | 40 | 70% | 28.0 | progress row 1 |
| Launch fixes R1–R10 | 15 | 30% (3 of 10, rule 3) | 4.5 | table below |
| Store launch readiness (products, sync) | 10 | 10% | 1.0 | progress row 7 |
| Public website | 25 | 31% (**REPORTED**) | 7.75 | progress row 8 |
| Website ↔ platform integration | 10 | 5% | 0.5 | progress row 9 |
| **Total** | 100 | | **41.75 → ≈ 42%** | |

**B. Dashboard launch readiness** (the internal platform only: rows 1 and 2, same weights):
(28.0 + 4.5) / (40 + 15) = 32.5 / 55 = **≈ 59%**. (The "70%" said in chat is row 1 alone: features
built and merged, most behind switches that are off.)

**C. Storefront readiness** (rows 7, 8, 9): (1.0 + 7.75 + 0.5) / (10 + 25 + 10) = 9.25 / 45 = **≈ 21%**,
of which the website part is **REPORTED**, not verified here.

**D. Owner's launch tasks** (not software; a plain count, no weights): 2 of 10 done —
backups with a green monthly restore test (Nov 1, REPORTED by the owner); the Brother printer set up and its
test page right (Nov 26, REPORTED). Not done: product list from the lab (R8); tax registration and rate;
payments set up in Shopify; shipping rates and policies; legal pages approved; rollback practice; the Rollo
label printer; one test order end to end.

## R1–R10, item by item

Columns: 1 built · 2 verified locally (tests on throwaway copies) · 3 verified in CI · 4 merged to `main` ·
5 database step installed in production · 6 switched on · 7 exercised end to end in production · 8 blocked by.

| R | What | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 blocked by |
|---|---|---|---|---|---|---|---|---|---|
| R1 | Receive a purchase order all at once (`receive_purchase_order`) | yes | yes | yes (database suite) | page side and the draft file yes; function no | **no** | no (switch row not yet there) | no | Query C, then drafts 10 and 21 (item 20) |
| R2 | Recall quarantine all at once | yes | yes | yes | as R1 | **no** | no | no | as R1 |
| R3 | Restock a return all at once | yes | yes | yes | as R1 | **no** | no | no | as R1; the partial-returns rules (drafts 40) |
| R4 | Stock adjustment all at once | yes | yes | yes | as R1 | **no** | no | no | as R1 |
| R5 | Delete an unused product all at once | yes | yes | yes | as R1 | **no** | no | no | as R1 |
| R6 | Database text shown as plain text everywhere | yes | yes | yes (`dom-sinks` gate) | yes (#36) | n/a | live | REPORTED (live check after #36, Nov 23) | — |
| R7 | Supabase library pinned with an integrity hash | yes | yes | yes | yes (#36) | n/a | live | REPORTED (as R6) | — |
| R8 | Real products entered (exact codes) | import tool yes | yes | yes | tool yes | n/a | tool off | no | **the product list from the lab** |
| R9 | Shopify order sync | design and drafts (42) only | drafts yes | yes | drafts yes | **no** | off (on purpose) | no | R8, R1–R4, payments decision |
| R10 | Customer email | no send path; tripwires | yes | yes | yes | n/a | nothing sends | — | counted complete for launch **only** while no customer email is sent at launch (**OWNER DECISION**: if real email is wanted at launch, R10 is 0: R1–R10 = 20%, weighted 3.0, and A = 40.25 → ≈ 40%) |

Count under rule 3: **3 of 10** (R6, R7, R10 as above) = 30%.

## What moved tonight, and what did not

Since Nov 24–25 (owner's installs and merges, and this night): steps 0, A and A2 installed and verified;
shared settings work in production (owner's screenshots). Under these rules that moves **no** total: no R
item reached column 7, and the shared settings are part of row 14 (roles and settings), which has no
weight in v1. The night's pull requests (#141–#143, the shared-settings PR, the screenshots PR) are
records, tests and one display fix: preparation and quality, not features.
