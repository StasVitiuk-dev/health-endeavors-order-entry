# Platform matrices (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · dashboard code `32c05e2` · `main` `d3db7bc` · **SUPERSEDES** the matrix sections in `OWNER_UNBLOCK_CENTER_EXT11.md` §1 and `CURRENT_PLATFORM_STATE_EXT12.md` §2–4 (both kept as history).

One page per question an owner or reviewer asks. **Nothing here has been done in production.** "Branch" = PR #28, not live.

Status words:

- **IMPLEMENTED IN BRANCH:** in PR #28, not live.
- **TESTED LOCALLY:** synthetic data, never production.
- **READY FOR OWNER DEPLOYMENT:** a draft the owner may install after approval.
- **DEPLOYED:** done in production.
- **PRODUCTION VERIFIED:** checked in production with evidence.
- **UNKNOWN:** nobody has looked yet.

---

## 1. R1–R10

| Item | What it is | Implemented? | Tested locally? | Database install needed? | Owner decision? | Deployed? | Production verified? |
|---|---|---|---|---|---|---|---|
| R1 | Receive a purchase order all-or-nothing (`receive_purchase_order`) | page: in branch, behind `stock_fn_receive_po` (OFF); SQL: draft 10 | YES (stress, concurrency, failure injection) | YES: drafts 10 + 21 | rollout order (#2) | NO | NO |
| R2 | Recall quarantine all-or-nothing (`quarantine_recall`) | same, `stock_fn_recall` | YES | YES | — | NO | NO |
| R3 | Return restock all-or-nothing (`receive_return`) | same, `stock_fn_return` | YES | YES | partial returns (#6) before switching on | NO | NO |
| R4 | Manual stock change all-or-nothing (`adjust_inventory`) | same, `stock_fn_adjust` | YES | YES | — | NO | NO |
| R5 | Delete an unused product safely (`delete_unused_product`) | same, `stock_fn_delete_product` | YES | YES | — | NO | NO |
| R6 | Database text shown as plain text everywhere (no injected code) | IMPLEMENTED IN BRANCH | YES (`xss-everywhere`, `search-dashboard-escaping`) | NO | — | NO (merge = deploy) | NO |
| R7 | Supabase library pinned with an integrity hash on every page | IMPLEMENTED IN BRANCH | YES (`library-pin`) | NO | — | NO (merge = deploy) | NO |
| R8 | Real products entered (name, SKU exactly as on the label) | NOT STARTED (owner data) | — | NO | owner supplies the list | NO | NO |
| R9 | Shopify order sync | NOT STARTED on purpose; switch `shopify_order_sync` expected OFF (production state UNKNOWN until Query C §2) | sync UX tested | NO | waits for R8 and the stock switches | NO | NO |
| R10 | Customer e-mail | NOT STARTED; **no send path exists** | `no-live-send`, `hard-walls` | NO | provider (#22) | NO | NO |

## 2. Queries A–H (all read-only)

| Query | Purpose (plain English) | Read-only? | Prepared? | Run on production? | Result | What it unblocks |
|---|---|---|---|---|---|---|
| A | Table shapes, permissions export | YES | YES | **YES** (owner, Oct 5) | used to correct the drafts to the real tables | (done) |
| B | Data health counts | YES | YES | **YES** (owner, Oct 5) | used for the real-shape tests | (done) |
| C | Counts, agents, switches, schedules, stock writers, triggers, audit coverage (11 sections) | YES | YES (tested locally, real output read by the intake) | NO | — | R1–R5 install (no other stock writer), audit drafts, agent truth |
| D | Which database functions run with elevated rights, and whether they are safe | YES | YES | NO | — | definer-function review |
| E | Stock vs history; deliveries vs stock and expense | YES | YES | NO | — | integrity rules (P6); verifying each stock switch |
| F | Stuck work, duplicates, wrong references, impossible values (F01–F15) | YES | YES | NO | — | integrity rules; nightly check thresholds |
| G | Who can read or write what (row-level security, grants) | YES | YES | NO | — | permission fix drafts (P8) |
| H | Does production match what was reviewed (H01–H11) | YES | YES | NO | — | every switch-on and every verify |

Plain-English guides to F, G and H: `OPERATIONS_HANDBOOK_EXT13.md` §9.

## 3. Agents 1–10

| # | Agent | Expected state | Known state | Production verified? | Source available? | Failure tested? | Owner action |
|---|---|---|---|---|---|---|---|
| 1 | Invoice (database trigger) | ON | **UNVERIFIED** (paused Sept 24, not recorded as back on) | NO | NO | NO | Query C §1/§7; agent source (E1) |
| 2 | Order Intake (GitHub Actions, private repo) | OFF until products exist | OFF (REPORTED) | NO | NO | NO | Query C; source |
| 3 | Order Monitoring | OFF until products exist | OFF (REPORTED) | NO | NO | NO | same |
| 4 | Retail/Wholesale (pg_cron :03) | ON | ON (REPORTED) | NO | NO | NO | Query C §5; source |
| 5 | Shipping/Tracking (pg_cron :10) | ON | ON (REPORTED; pause test passed) | NO | NO | NO | same |
| 6 | Customer Notification (dry run, pg_cron :05) | ON, **cannot send** | ON dry run (REPORTED) | NO | NO | NO | same; must stay unable to send |
| 7 | Customer Service (paid AI, drafts only) | OFF until products exist | OFF (REPORTED) | NO | NO | NO | same |
| 8 | Supervisor | OFF | OFF (REPORTED) | NO | NO | NO | same |
| 9 | Accounting (page calculation) | live | live | page code, tested | YES (page) | YES (oracle tests) | N4 (#17) |
| 10 | Tax Record (page calculation) | live | live | page code, tested | YES (page) | YES (oracle tests) | accountant look (#18) |

Facts per agent: `AGENT_CURRENT_STATE_EXT9.md`. Contract: `ENGINEERING_CATALOG_EXT11.md` §8.

## 4. Automations D1–D11

| D | What | Built | Ready | Scheduled | Owner approval needed | Intentionally off | Deferred |
|---|---|---|---|---|---|---|---|
| D1 | Nightly integrity check + Home card | SQL + page in branch | READY FOR OWNER DEPLOYMENT | NO | YES (P9, thresholds #1) | until installed | — |
| D2 | Reconciliation monitor | as Query E | YES (manual) | NO | optional schedule | — | dashboard view |
| D3 | Duplicate watcher | Query F F06–F09 | YES | with D1 | with D1 | — | — |
| D4 | Inventory attention | Home low/negative rows; Query E | YES | — | low-stock levels (#7) | — | large-adjustment rule |
| D5 | Backup monitor | design only | NO | NO | YES (#13; private backup job) | YES | YES |
| D6 | Agent supervisor | design only | NO | NO | needs agent source | YES | YES |
| D7 | Customer-draft queue | drafts only | partial | NO | provider (#22) | send: YES | approval log |
| D8 | Claims review queue | NO | NO | NO | lawyer (#21) | YES | until the website launch |
| D9 | Automatic reordering | — | — | — | — | **DO NOT BUILD** | — |
| D10 | AI answering customers | — | — | — | — | **DO NOT BUILD** | — |
| D11 | Weekly AI summary | NO | NO | NO | YES | YES | optional, later |

## 5. Switches

| Switch | Purpose | Needs first | Default | State in branch | Production state known? | Owner action |
|---|---|---|---|---|---|---|
| `stock_fn_receive_po` | R1 on the Receive button | drafts 10 + 21, Query H PASS | absent → OFF | OFF (row absent until draft 21) | YES: absent (the row does not exist yet) | P4, first |
| `stock_fn_adjust` | R4 on manual adjustment | same; R1 VERIFIED | absent → OFF | OFF | absent | P4, second |
| `stock_fn_recall` | R2 on quarantine | same; R4 VERIFIED | absent → OFF | OFF | absent | P4, third |
| `stock_fn_return` | R3 on return restock | same; R2 VERIFIED; partial-returns decision | absent → OFF | OFF | absent | P4, fourth |
| `stock_fn_delete_product` | R5 on product delete | same; R3 VERIFIED | absent → OFF | OFF | absent | P4, fifth |
| `request_keys` | duplicate-proof creates | drafts 19 + 27 | absent → OFF | OFF | absent | P7b |
| `integrity_results_home` | nightly result on Home | drafts 25 + 29; thresholds | absent → OFF | OFF | absent | P9b |
| `shopify_order_sync` | Shopify order import | R8, stock switches | OFF | OFF | **UNKNOWN** until Query C §2 | none now |
| Agent switches (`agent_controls`) | pause/resume agents #1–#8 | — | as table | unchanged | **UNKNOWN** until Query C §1 | read Query C |
| Emergency mode (`system_mode`) | read-only emergency | — | off | unchanged | UNKNOWN | none |

The page refuses to turn any of the first seven on before its database step exists (probe). System status shows **PROBLEM** if one is ever ON without it; Query H H03–H09 do the same.

## 6. Migrations (database drafts, in install order)

| Order | Draft | What | Needs first | Lock risk | Row-count risk | Transaction | Status |
|---|---|---|---|---|---|---|---|
| 1 | `drafts/10` R1–R5 functions | 6 functions, grants | merge; Query C; backup | LOW (creates functions; advisory lock) | none (no data change) | one transaction; preflight stops if a table/column is missing | READY FOR OWNER DEPLOYMENT |
| 2 | `drafts/21` stock switch rows | 5 rows, OFF | 10 | LOW | 5 inserts | one transaction; refuses without 10 | READY |
| 3 | `drafts/17` PO line guard | 1 trigger | merge | LOW (brief trigger create lock) | none | one transaction | READY |
| 4 | `drafts/23` integrity rules | 4 CHECK constraints | Query E + F clean | LOW today (table scan of small tables under an exclusive lock; MEDIUM at large volume, see note) | validates every row once | one transaction; refuses with counts if rows break a rule | READY |
| 5 | `drafts/19` request-key columns | nullable column + unique index on each create table | merge | LOW today (index build blocks writes per table for a moment; tables small) | none (empty column) | one transaction; skips missing tables | READY |
| 6 | `drafts/27` request-key switch row | 1 row, OFF | 19 | LOW | 1 insert | one transaction; refuses without 19 | READY |
| 7 | permission fixes (P8) | per Query G row | Query G | LOW per statement | none | one per draft | **NOT WRITTEN** (waits for Query G) |
| 8 | `drafts/25` nightly check | 1 table, 1 view, 1 function, 1 schedule | thresholds | LOW | none | one transaction | READY |
| 9 | `drafts/29` Home card tables + switch row | 1 table, column, policies, row OFF | 25 | LOW | none | one transaction; refuses without 25 | READY |
| — | `drafts/13` server-side report totals | 1 function | N4 decision | LOW | none | one transaction | **OPTIONAL / DEFERRED**: not in the production plan; the page keeps paging. *Update 2026-10-12 (EXT14): rollback `drafts/31` written and tested; a missing order total is no longer summed as $0 but reported as `orders_missing_total`.* |
| later | P10 revoke direct stock writes | grants | all five switches VERIFIED | LOW | none | — | NOT WRITTEN (on purpose) |

Note on draft 23 at volume: adding a CHECK validates every existing row while holding the table. At today's size that is milliseconds. If a table ever holds millions of rows, the same rule should be added `NOT VALID` and validated separately (`POST_LAUNCH_BACKLOG_EXT13.md` §9).

Test drafts `12`, `14`, `15`, `16` are **LOCAL ONLY**: each runs inside `BEGIN … ROLLBACK` and keeps nothing. They are never part of the production plan.

## 7. Rollback (every change → its undo)

| Change | Undo | Refuses while | Undoes business effects? |
|---|---|---|---|
| Merge (P0) | GitHub → Revert the merge commit | — | n/a (no data changed) |
| drafts/10 | `drafts/11` | any stock switch row exists (roll back 21 first) | **NO** — *Correction 2026-10-12 (EXT14): in EXT13 `drafts/11` did NOT itself check this; it relied on the operator. EXT14 added the check: it now refuses while any `stock_fn_*` switch is ON (tested; SQL mutant).* |
| drafts/21 | `drafts/22` | any stock switch is ON | NO |
| A stock switch ON | switch it OFF (instant) | never refused | **NO**: stock already received/adjusted stays; correct by hand with a note |
| drafts/17 | `drafts/18` | — | n/a |
| drafts/23 | `drafts/24` | — | n/a |
| drafts/19 | `drafts/20` (after the switch is OFF and draft 28 has run) | — | n/a |
| drafts/27 | `drafts/28` | — | n/a |
| permission fix | the exact old policy text from Query G G02 | — | n/a (but can lock staff out until undone) |
| drafts/25 | stop: `select cron.unschedule('integrity_check_nightly');` · remove: `drafts/26` (after 30) | — | deletes its own check history only |
| drafts/29 | `drafts/30` (before 26) | — | n/a |
| drafts/13 (optional) | `drafts/31` (EXT14) | — | n/a |

## 8. Production steps P0–P11

| Step | What | Who | Risk | Status |
|---|---|---|---|---|
| P0 | Merge PR #28 | owner | LOW | NOT DONE |
| P1 | Read-only checks (Query C–H) | owner | NONE | NOT DONE |
| P2 | Install R1–R5 | owner | LOW | NOT DONE |
| P3 | Stock switch rows | owner | LOW | NOT DONE |
| P4 | One stock switch per sitting | owner | **MEDIUM–HIGH** | NOT DONE |
| P5 | PO line guard | owner | LOW | NOT DONE |
| P6 | Integrity rules | owner | LOW | NOT DONE |
| P7 / P7b | Request keys + switch | owner | LOW | NOT DONE |
| P8 | Permission fixes | owner | **MEDIUM–HIGH** | NOT WRITTEN (needs Query G) |
| P9 / P9b | Nightly check + Home card | owner | LOW | NOT DONE |
| P9b-check | Query H after every step | owner | NONE | — |
| P10 | Revoke direct stock writes | owner | MEDIUM | NOT WRITTEN |
| P11 | Backup status row | owner (private backup job) | LOW | NOT WRITTEN (needs #13) |

## 9. Evidence

| Evidence | Received? | Valid? | Stale? | Unlocks |
|---|---|---|---|---|
| Backup look | NO | — | — | every database step (valid 7 days; look again on the day) |
| Query C | NO | — | — | R1–R5 install; audit drafts; agent truth |
| Query D | NO | — | — | definer review |
| Query E | NO | — | — | integrity rules; switch verify |
| Query F | NO | — | — | integrity rules; thresholds |
| Query G | NO | — | — | permission drafts |
| Query H | NO | — | — | every switch and verify |
| GitHub access | NO | — | — | X6-17 closed |
| Agent status | NO (Query C §1) | — | — | agent rows |
| Agent source | NO | — | — | agent contract tests |
| Real device | NO | — | — | accessibility / Safari verification |
| Decisions | NONE received | — | — | per §6 of the attention session |
| Query A / B | YES (Oct 5, before the intake existed) | historical schema snapshots | re-run Query C/H instead of relying on them | (used) |

## 10. Blockers by group

| Group | Blockers |
|---|---|
| OWNER | thresholds; rollout order; merge; every production step |
| PRODUCTION EVIDENCE | backup look; Query C–H |
| SECURITY | X6-17 GitHub admin; RLS unverified (Query G); switch tables open to staff (X7-14b, UNKNOWN) |
| DATA INTEGRITY | R1–R5 not installed (stock changes are multi-step today); integrity rules not installed; request keys off |
| ACCOUNTING | N4; orders without items; tax export look |
| LEGAL | legal hold; retention; claims queue (website) |
| PROVIDER | e-mail (nothing sends today, on purpose) |
| AGENT SOURCE | agents #1–#8 descriptions |
| DEVICE | iPhone Safari, Mac Safari, VoiceOver |
| STAGING | location decision (#5) |
| POST-LAUNCH | `POST_LAUNCH_BACKLOG_EXT13.md` (not blockers) |

## 11. Dependency graph

```
Backup look green (today)
  └─► any database step may be considered that day

GitHub as stasvitiuk-reos (X6-17 closed) ─► safer merging

Merge PR #28 (P0) ─► postcheck clean ─► (all database steps below)

Query C (no other stock writer)
  └─► drafts/10 R1–R5 ─► postcheck (fingerprint) ─► Query H PASS
        └─► drafts/21 switch rows (all OFF) ─► switch-off verified
              └─► owner turns R1 ON ─► canary ─► one working day ─► Query H + Query E clean ─► R1 VERIFIED
                    └─► R4 ─► … ─► R2 ─► … ─► R3 (after partial-returns decision) ─► … ─► R5
                          └─► (later) P10 revoke direct stock writes

Query E + F clean ─► drafts/23 integrity rules
drafts/19 request-key columns ─► drafts/27 switch row ─► owner turns request_keys ON

Query G ─► RLS decision per finding ─► Claude writes a fix draft + rollback + local test ─► owner review ─► owner installs one per sitting ─► Query G re-run

Thresholds decision ─► drafts/25 nightly ─► first run ─► drafts/29 Home card ─► owner turns integrity_results_home ON

Query C §10 audit gaps ─► audit-trigger drafts ─► owner review ─► install
Agent source (E1) ─► agent contract tests ─► agent supervisor (D6) design
```

## 12. Critical paths

**Shortest safe path to the first controlled production step:**
backup look → GitHub least privilege → read-only session (clean) → thresholds → **merge PR #28**. One production change, low risk, revert in one click.

**Path to 50% production readiness** (weights from `PRODUCTION_READINESS_BOARD_EXT11.md`):

| Row | Points | Needs |
|---|---|---|
| already done (G1 live dashboard, G2 switch pattern) | 15 | — |
| G4 backup verified | +10 | backup look |
| G5 read-only facts | +10 | Query C–H received from production |
| G6 GitHub least privilege | +3 | X6-17 |
| G3 code merged | +15 | merge PR #28 |
| **Total** | **53** | four owner actions; only one (the merge) changes production, and it changes no data |

**Path to 80%:** the 50% path, then:

| Row | Points | Running total |
|---|---|---|
| G7 R1–R5 installed and fingerprinted | +12 | 65 |
| G10 RLS verified (fixes applied if Query G finds any) | +8 | 73 |
| G12 agent state verified (Query C with no UNKNOWN/CONFLICT) | +4 | 77 |
| G8 request keys installed | +4 | **81** |

Every point needs production evidence recorded through the intake (§13).

## 13. Score model (what each percentage means, and what moves it)

| Score | Now | Components | Raised only by | Does NOT raise it |
|---|---|---|---|---|
| **Production readiness** | **15** | G1–G16 (weights in `PRODUCTION_READINESS_BOARD_EXT11.md` §1) | production evidence through the intake; production steps with postchecks (§6 of that board) | docs, synthetic tests, simulations, local SQL runs, branch code |
| Branch dashboard | ~89 | pages and workflows implemented and tested in PR #28 | real page work + tests | docs |
| Live dashboard | unchanged since `d3db7bc` | what users see today | merging | anything unmerged |
| Data integrity | ~40 | live guards today + drafts tested but not installed (R1–R5, rules, keys) | installing drafts; Query E/F clean | more local stress runs |
| Operational readiness | ~65 | runbooks, incident map, training, routines, System status | real use; a real drill; staff trained | more documents |
| Security | ~60 | CSP, escaping, pinned library, refusal handling in branch; X6-17 open; RLS unverified | X6-17 closed; Query G clean; fixes installed | reviews without production facts |
| Staging | ~50 | built and tested on synthetic data; not published | location decision + publish | — |
| Training | ~70 | 15 modules, 20-question quiz (EXT13) | a real person passing the quiz on staging | more modules |
| Backup | **0 verified** | unknown | the backup look; a restore drill into a throwaway project | the local restore drill (it is not a production backup restore) |
| Agents | ~20 | truth model in the page; contracts written | Query C; agent source; contract tests | — |
| Automation | ~30 | D1 ready; D2–D4 manual; D9/D10 never | installing D1; owner approvals | designs |

**What does NOT move production readiness, ever:** more documents · more synthetic tests · local simulations (`deploy:sim`) · local PostgreSQL runs · the local restore drill · staging on synthetic data · automated accessibility checks · prepared (not executed) queries · prepared (not installed) functions · switches that are OFF.
