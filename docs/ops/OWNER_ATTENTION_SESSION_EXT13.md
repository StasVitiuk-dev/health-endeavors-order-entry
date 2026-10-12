# Owner attention session (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · branch `claude/platform-ext13-owner-attention-final-audit-2026-10-11` · dashboard code frozen at `32c05e2` (identical to PR #28) · `main` = `d3db7bc` (live, unchanged).
**SUPERSEDES:** `OWNER_UNBLOCK_CENTER_EXT12.md` (what to do now) and, as the decision list, `OWNER_DECISION_STATUS_EXT12.md`, `OWNER_DECISION_PACKETS_EXT10.md` §6, `OWNER_DECISIONS_NEXT.md`. Those files stay as history and keep their longer explanations.

**What this is:** everything that needs Stas, on one page set, in the order to do it. Nothing here has been done in production. Claude cannot do any of it: each item needs the owner, an outside person, or a production fact only the owner can see.

**Words used here**

- **Read-only:** only looks; changes nothing.
- **Safe decision:** you choose, nothing in production changes yet.
- **Production change:** changes the live database or site; one per sitting, with a backup look the same day.
- **High-risk production change:** can lock people out or move real stock or money; needs a stop point before and after.

---

## 1. Everything that needs you, sorted into eight piles

Time is a conservative guess for a non-technical person doing it the first time.

### A. Do with Stas now (no production change)

| # | Action | Time | Unblock value | Risk | Card / where |
|---|---|---|---|---|---|
| A1 | **Backup look**: open the private backups repository's Actions tab, read the latest nightly and restore runs (look only) | 2 MIN | HIGH: every database step waits on it | READ-ONLY | `OWNER_CHECKS_EXT11.md` card 1 |
| A2 | **GitHub least privilege (X6-17)**: connect Claude as `stasvitiuk-reos` with Write role, then send four lines | 5 MIN | HIGH: removes the only standing security gap | SAFE DECISION (account setting; no code, no data) | card 4 |
| A3 | **Read-only session**: run Query C, D, E, F, G, H in Supabase's SQL editor and download each result | 30+ MIN (first time) | HIGH: the facts every later step needs | READ-ONLY | card 2 |
| A4 | **Quick decisions** (2 minutes each): thresholds, rollout order, week definition, document categories, staging location | 10 MIN for all five | MEDIUM (thresholds is the only one that blocks a production step) | SAFE DECISION | §6 |
| A5 | **Read PR #28** (summary, scope, known limitations) and decide when to merge | 20 MIN | HIGH: merging puts the fixes live; every feature stays OFF | SAFE DECISION now; merging itself is a PRODUCTION CHANGE (low risk) | PR #28, `RELEASE_REVIEW_EXT13.md` |
| A6 | **Close the 23 older draft PRs (#5–#27)** once #28 is merged (all of them are already inside #28) | 5 MIN | LOW (tidiness; avoids merging an old one by mistake) | SAFE DECISION | `RELEASE_REVIEW_EXT13.md` §5 |
| A7 | **10-minute decisions**: partial returns, low-stock levels, RPO/RTO, recall per lot | 30+ MIN for all four | MEDIUM | SAFE DECISION | §6 |

### B. Send to the accountant

| # | Item | Time for you | Unblock value | Risk | Packet |
|---|---|---|---|---|---|
| B1 | Refund rule N4 (a / b / c), one page | 5 MIN to send | MEDIUM: needed before the first real refund | SAFE DECISION | `N4_DECISION_ONE_PAGE.md`, `OWNER_DECISION_PACKETS_EXT10.md` §3 |
| B2 | Orders saved without items: count as revenue (A, today) or exclude (B) | 2 MIN to add to B1 | LOW | SAFE DECISION | same message |
| B3 | One look at a tax export (CSV) | 5 MIN to send | LOW until the first filing | READ-ONLY | Tax Records → export |

### C. Send to the lawyer

| # | Item | Time for you | Unblock value | Risk |
|---|---|---|---|---|
| C1 | Legal hold vs delete: option 1 = block deletes while a hold is active; option 2 = allow with a warning and a record of who deleted. Today nothing checks holds | 5 MIN to send | LOW now; before litigation or regulator requests | SAFE DECISION |
| C2 | Data retention: how long to keep customer records, audit history, deleted items | same message | LOW now; before scale | SAFE DECISION |
| C3 | Claims review queue (D8) for website content | same message | for the website launch, not the dashboard | SAFE DECISION |

### D. Send to a provider

| # | Item | Time | Unblock value | Risk |
|---|---|---|---|---|
| D1 | E-mail service for receipts / support (packet D: transactional yes/no, sender domain, delivery log, retry, unsubscribe) | 10 MIN to ask | LOW: there is no send path, on purpose | SAFE DECISION |

### E. Send to whoever holds the agents' code

| # | Item | Time | Unblock value | Risk |
|---|---|---|---|---|
| E1 | For agents #1–#8: what it reads, what it writes, its schedule, how it records a failure, whether a second run duplicates work. **No keys, no passwords** | 10 MIN to ask | MEDIUM: agent failure tests are impossible without it | READ-ONLY (a description) |

### F. Real device, later

| # | Item | Time | Unblock value | Risk |
|---|---|---|---|---|
| F1 | Card 5 on an iPhone (Safari) and a Mac (Safari), and once with VoiceOver, **on the merged version** | 30+ MIN | LOW–MEDIUM (only verifies; the automated checks already pass) | READ-ONLY |

### G. Production deployment, later (one per sitting, each after a backup look the same day)

| # | Step | Time | Unblock value | Risk |
|---|---|---|---|---|
| G1 | Merge PR #28 (P0) + 5-minute postcheck | 10 MIN | HIGH | PRODUCTION CHANGE (low: every new feature is OFF; revert is one click) |
| G2 | Install R1–R5 (P2), next sitting the five switch rows (P3) | 20 MIN each | HIGH | PRODUCTION CHANGE (low: nothing calls the functions until a switch is on) |
| G3 | One stock switch per sitting, R1 → R4 → R2 → R3 → R5, one working day of watching after each (P4) | 10 MIN each + a day | HIGH | **HIGH-RISK PRODUCTION CHANGE** (real stock moves through new code; switch-off is instant) |
| G4 | PO line guard (P5), integrity rules (P6), request keys (P7, P7b) | 10–20 MIN each | MEDIUM | PRODUCTION CHANGE |
| G5 | Permission fixes from Query G (P8), one per sitting | 20 MIN each | HIGH for security | **HIGH-RISK PRODUCTION CHANGE** (can lock staff out; exact rollback per policy) |
| G6 | Nightly check (P9) + Home card (P9b) | 20 MIN each | MEDIUM | PRODUCTION CHANGE |
| G7 | Later: revoke direct stock writes (P10), backup row on Home (P11) | — | LOW now | PRODUCTION CHANGE |

Cards: `DEPLOYMENT_SIMULATION_EXT12.md` §4. Step details: `PRODUCTION_CHANGE_PACKAGE_EXT10.md`.

### H. Post-launch / can wait

Everything in `POST_LAUNCH_BACKLOG_EXT13.md`: server paging, more roles, more automation, polish. **None of it is needed before launch.**

---

## 2. The order (why this order)

1. **Backup look (A1).** It gates every database step, it is the fastest item, and nobody else can do it.
2. **GitHub least privilege (A2).** It closes the one security gap that affects how safely everything after it is merged.
3. **Read-only session (A3).** Its answers decide which drafts get written next (permissions, audit triggers, corrections).
4. **Quick decisions (A4).** Thresholds is needed before the nightly check; the others take two minutes and stop recurring.
5. **PR #28 review and merge (A5 → G1).** It is safe before any SQL. Merging earlier gets live fixes out sooner; merging after steps 1–3 means fewer open questions. The authoritative documents allow either order (`PRODUCTION_READINESS_BOARD_EXT11.md` §3 puts the backup look and read-only facts first, and the merge is allowed before any SQL). **Recommendation: steps 1–3 first, then merge.**
6. **Deployment planning (G2 onward).** One change per sitting, in the card order.

Accountant, lawyer, provider and agent-source messages (B–E) can go out on day one: they run in parallel and block nothing on the way to the first production step.

---

## 3. Session plans

### 30 minutes (the shortest useful session)

| Minutes | Do | Send back to Claude |
|---|---|---|
| 0–2 | A1 backup look | `nightly green:DATE, restore green:DATE, minutes ok` |
| 2–7 | A2 GitHub as `stasvitiuk-reos` | four lines: `account:`, `role:`, `backups_repo_visible:`, `bypass:` |
| 7–17 | A4 quick decisions | three lines each (`decision:`, `choice:`, `decided_by:`) |
| 17–27 | Send the B, C, D and E messages (copy them from §8) | nothing yet |
| 27–30 | Stop. Paste everything into the chat | — |

### 60 minutes

The 30-minute session, then:

| Minutes | Do |
|---|---|
| 30–55 | A3 read-only session: Query H first (2 min), then G, C, E, F, D. Download each as CSV. If one errors, screenshot the error and move on |
| 55–60 | Paste the CSVs; **stop** (stop point S2) |

### 2 hours (clears every blocker that needs no production change)

The 60-minute session, then:

| Minutes | Do |
|---|---|
| 60–80 | A5: read PR #28's summary, scope and known limitations; read `RELEASE_REVIEW_EXT13.md` §1 (one page) |
| 80–110 | A7 ten-minute decisions |
| 110–120 | Wait for Claude's reading of the CSVs. If anything is FAIL or CONFLICT: **stop here** (S2). If all clear: plan the merge sitting |

### A full day (still no uncontrolled production change)

| Block | Do | Stop point |
|---|---|---|
| Morning | The 2-hour session | S1, S2 |
| Late morning | **G1 merge** (if the read-only results were clean) + 5-minute postcheck | S3 |
| Midday | Use the live dashboard normally; nothing else changes | — |
| Afternoon | If the postcheck was clean: G2 (R1–R5 install) **only** with a backup look that same day; Query H afterwards | S4 |
| End of day | Stop. **No switch is turned on on the same day as the install.** Switches start on a later day, one per sitting (G3) | S5 |

---

## 4. Stop points (stop and ask for review before going on)

| | Stop when | Why |
|---|---|---|
| **S1** | the backup look is not green on both runs, or minutes are "out" | no database step without a good backup |
| **S2** | any read-only result is FAIL, CONFLICT, MALFORMED, or an error screenshot | the next draft depends on what it says |
| **S3** | after the merge, anything differs from the PR screenshots | revert first, ask second |
| **S4** | any precheck or postcheck differs from the card, a file stops with an error, or the fingerprint differs | do not try a fix |
| **S5** | before each switch: Query H must be PASS the same day, and the previous switch VERIFIED | one switch at a time |
| **S6** | before any permission change (G5) | can lock staff out |
| **S7** | anything on Home turns red that was not red before | stop changing records; screenshot |

---

## 5. Success condition: "ready for the first controlled production step"

All true at once:

- [ ] backup look green (nightly and restore) **today**;
- [ ] GitHub: `account: stasvitiuk-reos`, `role: write`, backups repository hidden, bypass admin-only (X6-17 closed);
- [ ] Query C, D, E, F, G, H received from **production**, dated, read by Claude;
- [ ] no FAIL in Query H; no unexpected stock writer in Query C §6; no CONFLICT left unread;
- [ ] `thresholds` decided (or the defaults accepted in writing);
- [ ] PR #28 reviewed, `main` still `d3db7bc` (or the PR re-tested against the new `main`).

Then the first controlled production step is **G1, the merge**. It is not a database step.

---

## 6. Decision inventory (one list; every open decision, once)

How to answer, one line each. Example: `decision: partial_returns · choice: whole line · decided_by: Stas`.

**Blocking key:**

- **MERGE:** blocks the merge.
- **DB:** blocks a database install.
- **SWITCH:** blocks turning a switch on.
- **AUTO:** blocks an automation.
- **LAUNCH:** blocks the store launch.
- **WAIT:** can wait.

**Safe default** means what happens if you say nothing. It is today's behaviour unless stated otherwise.

| # | Decision (`decision:`) | Who | Choices (`choice:`) | Safe default | Blocks | Time | Old IDs (merged here) |
|---|---|---|---|---|---|---|---|
| 1 | `thresholds` | OWNER | as written / custom | as written (accept explicitly) | DB (P9 nightly) | 2 MIN | X8-D4 |
| 2 | `rollout_order` | OWNER | R1→R4→R2→R3→R5 / other | R1→R4→R2→R3→R5 | SWITCH | 2 MIN | D-ops-1 |
| 3 | `week_definition` | OWNER | last 7 days / calendar week / both | last 7 days (already labelled) | WAIT | 2 MIN | X8-D2, F3-07 (done) |
| 4 | `document_categories` | OWNER | keep 7 / add categories | keep 7 | WAIT | 2 MIN | — |
| 5 | `staging_location` | OWNER | private artifact page / local only / separate private repository | private artifact page (recommended) | WAIT | 2 MIN | X8-D1 |
| 6 | `partial_returns` | OWNER | partial quantity / whole line | whole line (today) | SWITCH (decide before R3) | 10 MIN | D-ops-5, U20 |
| 7 | `low_stock_levels` | OWNER | global / per product / no alerts | no alerts | WAIT | 10 MIN | — |
| 8 | `rpo_rto` | OWNER | 24h/4h / custom | **none**: must be chosen (24h/4h suggested) | LAUNCH | 10 MIN | X8-D5 |
| 9 | `recall_per_lot` | OWNER | one per lot / several allowed | several allowed (today) | WAIT | 10 MIN | D-ops-4, INV-16 |
| 10 | `employee_approval` | OWNER | yes / no | no staff yet, so nothing to do; **"no" needs a permission draft** (today the database lets any staff approve) | LAUNCH (before hiring) | 5 MIN | X7-14a |
| 11 | `switch_tables_owner_only` | TECHNICAL (owner approves) | owner/admin only / leave | leave (decide after Query G) | LAUNCH (before hiring) | 5 MIN | X7-14b |
| 12 | `order_number_rule` | TECHNICAL | unique in the database / page check only | page check only (today) | WAIT (after Query C/F) | 5 MIN | — |
| 13 | `backup_row` | OWNER | approve / not yet | not yet | WAIT | 2 MIN | X8-D6 |
| 14 | `next_automation` | OWNER | Query F nightly first / other D-item / none | none | AUTO | 5 MIN | X8-D7, K-list (superseded) |
| 15 | `ci_required_check` | TECHNICAL | on / off | off (no workflow in the repository; an inactive one waits on branch `claude/tests-only-ci-v2`, no open PR) | WAIT | 5 MIN | CI-02, CI-03 |
| 16 | `orders_without_items` | ACCOUNTANT (with owner) | A: count as revenue (today) / B: exclude until items added | A | WAIT | 2 MIN | X6-14, X8-D3 |
| 17 | `refund_rule_n4` | ACCOUNTANT | a / b / c | a (refunds are records only) | LAUNCH (before the first real refund) | 5 MIN to send | N4, U18 |
| 18 | `tax_export_review` | ACCOUNTANT | ok / changes needed | — | WAIT (before the first filing) | 5 MIN to send | — |
| 19 | `legal_hold_vs_delete` | LAWYER | 1 (block) / 2 (warn + record) | leave as today (no hold check) until answered | WAIT | 5 MIN to send | U22 |
| 20 | `data_retention` | LAWYER | (written answer) | delete nothing | WAIT | same message | — |
| 21 | `claims_review_queue` | LAWYER | needed / not needed | not built | WAIT (website launch) | same message | D8 |
| 22 | `email_provider` | PROVIDER | provider name | none (no send path) | WAIT | 10 MIN | R10 |
| 23 | `manual_order_catalogue_picker` | POST-LAUNCH | yes / no | no (typed names) | WAIT | 2 MIN | F3-02 |
| 24 | `input_border_contrast` | POST-LAUNCH | darker / keep | keep | WAIT | 2 MIN | F3-01 |

**Totals:** 24 open decisions:

- 15 owner or technical (#1–#15);
- 3 accountant (#16–#18);
- 3 lawyer (#19–#21);
- 1 provider (#22);
- 2 post-launch (#23–#24).

Only **#1 thresholds** blocks a production step. Nothing blocks the merge.

**Duplicates removed:** about 70 mentions across `OWNER_DECISIONS_NEXT.md` (EXT4–EXT8 lists), `OWNER_DECISION_PACKETS_EXT10.md` §6, `OWNER_UNBLOCK_CENTER_EXT10.md` §3, `OWNER_UNBLOCK_CENTER_EXT11.md` §2 and `OWNER_DECISION_STATUS_EXT12.md` collapse into these 24. X6-17 appeared three times as a "decision"; it is an action (A2), not a decision.

**Superseded (kept as history, not open):**

- K-list automations → #14;
- F3-07 "This Week" label → done in EXT8;
- "Merge EXT10" and "Merge EXT11" → PR #28;
- "request keys: switch on after install?" → deployment card G4;
- "PO line guard right after R1?" → deployment order G4.

**Conflicts found (flagged, not silently chosen):**

| Topic | What the documents say | How it is shown here |
|---|---|---|
| Legal hold vs delete | `OWNER_DECISIONS_NEXT.md`: option 1 = block, option 2 = warn. `OWNER_UNBLOCK_CENTER_EXT11.md` and `OWNER_DECISION_STATUS_EXT12.md` described option 2 as "nothing deleted while a hold is open" | the original definition is used; correction notes added in both later files (dated) |
| Recall per lot, safe default | `OWNER_UNBLOCK_CENTER_EXT10.md` §3: "yes"; `OWNER_DECISION_PACKETS_EXT10.md` §6 and EXT12: "allow (today)" | today's behaviour (several allowed) is the default; "one per lot" was a recommendation. **Your choice** |
| Partial returns | EXT10: "yes recommended"; EXT12: default whole line | default = today (whole line); the recommendation is shown, not applied |
| CI required check | EXT10 decision center: safe default "on" | turning it on needs a workflow file merged (owner approval under `CLAUDE.md`). Default = off (today); "on" = recommendation |
| Employee approval | defaults say "no", but the database today lets any staff approve | "no" is a change (a permission draft), harmless while there is no staff |

---

## 7. Final owner action list (15)

| Rank | Action | Pile | Time |
|---|---|---|---|
| 1 | Backup look | A | 2 MIN |
| 2 | GitHub as `stasvitiuk-reos` (X6-17) | A | 5 MIN |
| 3 | Read-only session C–H | A | 30+ MIN |
| 4 | Decide `thresholds` (accepting the defaults is fine) | A | 2 MIN |
| 5 | Review and merge PR #28, then the 5-minute postcheck | A → G | 20 + 10 MIN |
| 6 | Send the accountant message (N4, orders without items, tax export) | B | 5 MIN |
| 7 | Send the agent-source request (no keys) | E | 10 MIN |
| 8 | Remaining 2-minute decisions (#2–#5) | A | 10 MIN |
| 9 | Install R1–R5, then the switch rows (two sittings) | G | 20 MIN each |
| 10 | Turn on R1, watch a day, then R4, R2, R3, R5 | G | 10 MIN each + a day |
| 11 | Ten-minute decisions (#6–#9) | A | 30+ MIN |
| 12 | Permission fixes after Query G (one per sitting) | G | 20 MIN each |
| 13 | Send the lawyer message (hold, retention, claims) | C | 5 MIN |
| 14 | Real-device card on the merged version | F | 30+ MIN |
| 15 | Close the older draft PRs #5–#27 after the merge | A | 5 MIN |

**Top 5:** 1 backup look · 2 GitHub least privilege · 3 read-only session · 4 thresholds · 5 review and merge PR #28.
**Top 3:** backup look · GitHub least privilege · read-only session.
**Single best action:** the **backup look** (2 minutes; it gates every database step; only you can see it).

---

## 8. Session script for Stas and ChatGPT (or Claude)

Copy this list into the chat at the start. Tick each box as it is done. Paste each result where it says **PASTE**.

**Step 1: backup (2 min).** Open the backups repository → Actions. Look only; do not re-run anything.
- [ ] Done.

> PASTE: `nightly green:YYYY-MM-DD, restore green:YYYY-MM-DD, minutes ok` (use `red:` for a failed run, `minutes out` if over budget)

**Step 2: GitHub (5 min).** claude.ai → Settings → Connectors → GitHub → sign in as `stasvitiuk-reos`. Then, in a new session, ask Claude: "Run the read-only access check from CLAUDE.md and give me the four lines."
- [ ] Done.

> PASTE: `account: …` · `role: …` · `backups_repo_visible: …` · `bypass: …`

**Step 3: decisions (10 min).**
- [ ] `thresholds`
- [ ] `rollout_order`
- [ ] `week_definition`
- [ ] `document_categories`
- [ ] `staging_location`

> PASTE: three lines per decision

**Step 4: read-only session (30 min).** Supabase → SQL editor → open each file from GitHub **Raw**, paste, Run, Download CSV. Only the files named `0X_READONLY_…`. **Never a file from `drafts/`.**
- [ ] H
- [ ] G
- [ ] C
- [ ] E
- [ ] F
- [ ] D

> PASTE: each CSV (or a screenshot of any error), with the line `environment: production · run date: YYYY-MM-DD`

**Step 5: outside messages (10 min).** Copy the four messages below and send them.
- [ ] Accountant sent.
- [ ] Lawyer sent.
- [ ] Provider (optional) sent.
- [ ] Agent-source sent.

**Step 6: PR review (20 min).** Read PR #28: summary, exact scope, known limitations. Do not merge in the same sitting as a database step.
- [ ] Read.
- [ ] Questions asked.

**Step 7: deployment plan.** Only when §5 is all ticked: plan G1 (merge) for a sitting of its own.
- [ ] §5 complete.

**If any result in steps 1–4 is red, FAIL, CONFLICT or an error: stop.** Do not go on to step 6 or 7 until it has been read.

### Messages to copy

**Accountant (B1–B3)**

> The dashboard records refunds made elsewhere; it never moves money. How should Accounting and Tax Records count a recorded refund? (a) not subtracted, as today; (b) subtracted in the month of the refund; (c) your rule. Also: should orders saved without line items count as revenue (A) or be left out until items are added (B)? I can send one tax CSV export for a look. Short written answers are enough: `refund_rule_n4: a|b|c`, `orders_without_items: A|B`.

**Lawyer (C1–C3)**

> Three questions for our internal dashboard. (1) While a legal hold is active, should deleting a related record or document be blocked (option 1), or allowed with a warning and a record of who deleted it (option 2)? Today nothing checks holds. (2) How long should we keep customer records, the change history (audit log) and items in the recycle bin? (3) Do website product claims need a review queue before publishing? Short written answers are enough.

**E-mail provider (D1)**

> We may send transactional receipts and support replies (no marketing yet). Please confirm: transactional sending (yes/no), sender domain setup, delivery log, automatic retry, unsubscribe handling. A link to the documentation is enough.

**Agent source (E1)**

> For each automated agent (#1 Invoice, #2 Order Intake, #3 Order Monitoring, #4 Retail/Wholesale, #5 Shipping, #6 Notification, #7 Customer Service, #8 Supervisor), please describe: what it reads, what it writes, its schedule, how it records a failure, and whether running it twice can create duplicates. Please send **no keys, tokens or passwords**. Six lines per agent: `agent:`, `reads:`, `writes:`, `schedule:`, `failure_recorded_as:`, `second_run_duplicates:`.

Partial, contradictory or old answers are handled honestly:

- a partial answer is INCOMPLETE (never "done");
- two answers that disagree are a CONFLICT (a person reads both);
- an old answer goes STALE (re-ask).

Rules: `OWNER_EVIDENCE_GUIDE_EXT12.md` §1. Ready-made prompts for each arrival: `OWNER_SESSION_PROMPTS_EXT13.md`.
