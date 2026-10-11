# Owner unblock center (EXT11)

**Status:** SUPERSEDED as the entry point by `OWNER_UNBLOCK_CENTER_EXT12.md` (extension 12). §3 packets and §1 boards remain the detail; §2 decisions are now in `OWNER_DECISION_STATUS_EXT12.md`. Was: CURRENT (2026-10-11, extension 11). Supersedes `OWNER_UNBLOCK_CENTER_EXT10.md` as the entry point; that file keeps the full U01–U50 list (U-numbers unchanged) and stays the place for each item's detail. **Start here, then `PRODUCTION_READINESS_BOARD_EXT11.md`.** Claude changed nothing in production.

## 0. What do I do now? (one page)

| | |
|---|---|
| **Do now** | 1. Backup look (card 1, 2 minutes) · 2. Reconnect GitHub as `stasvitiuk-reos` (card 4, 5 minutes) · 3. Read-only session (card 2, about 20 minutes) · 4. Review and merge the EXT11 **draft PR #27** (it replaces #26) |
| **Safe** | every SAFE READ-ONLY CHECK card in `OWNER_CHECKS_EXT11.md`; merging the PR (every new switch stays OFF; System status shows "OK: all of these switches are OFF") |
| **Still unknown** | backups · agent #1 · who may do what in the database (Query G) · which tables keep an audit trail · whether production matches what was reviewed (Query H) |
| **Do not touch** | the backups repository (look only) · any SQL file not named in a card · any switch until its SQL step is done and checked |

### Ranked next actions (blockers first, never visual preferences)

Ranking rule: (1) gates every production step → (2) gives facts that change what gets built → (3) merges code → (4) installs a database step → (5) switches something on → (6) decisions that can wait. Inside a rank, the shorter action goes first.

| Rank | Action | Time (conservative) | Unblocks | Card |
|---|---|---|---|---|
| 1 | Backup look | 2 min | every database step (valid 7 days, re-look on the day) | card 1 |
| 2 | Reconnect GitHub least-privilege (X6-17) | 5 min | safe merging; production readiness G6 | card 4 |
| 3 | Read-only session C, D, E, F, G, H | 20–30 min | permission fixes, audit gaps, agent truth, stock-writer check before R1–R5 | card 2 |
| 4 | Review + merge the EXT11 PR | 15 min reading + 2 min clicking + 5 min postcheck | everything after; fixes live today | PR body |
| 5 | Install R1–R5 (P2) then switch rows (P3) | 30 min, one sitting | the five stock switches | `R1-R5-INSTALL-RUNBOOK.md` |
| 6 | One stock switch per sitting (P4) | 10 min each + one working day of observation | atomic stock changes | readiness board §3 |
| 7 | Line guard, integrity rules, request keys (P5–P7b) | 15 min each, separate sittings | — | change package |
| 8 | Decisions in §2 | 5–15 min each | as listed | §2 |

### Do not do

- Do not merge and then turn everything on at once. One switch per sitting, with observation in between.
- Do not press Receive (or Mark Received / Quarantine) again after a "connection dropped" message. Read what the page says; for a PO use **Check this order now**.
- Do not paste passwords, keys, tokens or recovery codes anywhere, including into a chat with Claude.
- Do not open logs, re-run jobs or change settings in the backups repository.
- Do not turn a switch on before its SQL step is installed and checked. The page refuses anyway; System status and Query H show **PROBLEM** / **FAIL** if it ever happens.
- Do not run a database step on a day without a green backup look.
- Do not try to fix a failed precheck yourself. Stop, screenshot, ask.

## 1. Boards (one line each; detail in the files named)

**R1–R10:** R1–R5 functions TESTED LOCALLY, READY FOR OWNER DEPLOYMENT, NOT DEPLOYED (dashboard IMPLEMENTED IN BRANCH behind switches that are OFF; System status now shows whether each is installed) · R6 escaping and R7 pinned library: IMPLEMENTED IN BRANCH, TESTED LOCALLY, NOT DEPLOYED; merging changes only page files, no database step · R8 real products: NOT STARTED (owner; intake in §3) · R9 Shopify sync: NOT STARTED on purpose (§3) · R10 e-mail: NOT STARTED, no send path exists (§3).

**Queries:** C, D, E, F, G, H all PREPARED and TESTED LOCALLY; **none run on production**. One sitting: card 2. Query E is the stock-vs-history and deliveries-vs-stock-and-expense reconciliation (`04_READONLY_E_stock_reconciliation.sql`), read with the same interpreter.

**Agents:** #1 UNVERIFIED · #2 #3 #7 #8 off on purpose (not yet proven) · #4 #5 #6 reported running (not yet proven) · #9 #10 calculated in the dashboard. Proof: card 3.

**Automations D1–D11:** `ENGINEERING_CATALOG_EXT11.md` §8. Nothing automated is switched on; D9 and D10 are never built.

## 2. Decisions (one table; the safe default is always "leave as today")

| Decision | Kind | Options | Safe default | What it changes in the system | Who |
|---|---|---|---|---|---|
| Query F thresholds (X8-D4) | operational | 14 / 7 days as written, or your numbers | as written | when stuck work turns amber on Home and in the nightly check | owner |
| Low-stock levels | operational | one level for all products / a level per product / no alerts | no alerts (today: "Low-stock level not set — CONFIG REQUIRED") | per product: Inventory → that product's low-stock field; Home then counts it. Nothing is ever ordered automatically | owner |
| Partial returns (D-ops-5) | operational | allow a partial quantity / whole line only | whole line (today) | R3 would take a quantity; today the whole line is restocked. Example: 3 bottles sold, 1 returned damaged → whole line = 3 restocked into "damaged" (wrong by 2); partial = 1 | owner |
| Refund rule N4 | accounting | a / b / c (`OWNER_DECISION_PACKETS_EXT10.md`) | a (today: the dashboard only records a refund made elsewhere) | how Accounting and Tax subtract refunds | owner + accountant |
| Legal hold vs delete | legal | 1 / 2 | 2 (nothing deleted while a hold is open) | whether delete buttons check open holds. Not legal advice | owner + lawyer |
| Data retention | legal | to be decided | delete nothing | none until decided | owner + lawyer |
| Staging location (X8-D1) | technical | (1) private Artifact page, best privacy, free, fully separate · (2) on your Mac only, simplest, nothing published · (3) a separate private repository, more setup | (1) | where the synthetic-data copy can be looked at; never connected to production | owner |
| RPO / RTO (X8-D5) | technical | 24 h / 4 h suggested | suggested | how stale a backup may be, how fast a restore must be | owner |
| Backup status row on Home (X8-D6) | technical | approve / not | not yet | Home could show backup health; needs a change in the private backup job | owner |
| E-mail provider (R10) | provider | to be chosen | none | §3 packet D lists the requirements | owner |
| Week definition (X8-D2) | operational | last 7 days / calendar week / both | last 7 days (labelled) | report windows | owner |

## 3. Packets for outside help (smallest possible; each says what it unblocks)

| Packet | For | What is needed | Why | How to return it | Unblocks |
|---|---|---|---|---|---|
| **A** | Owner | the backup look, the read-only session CSVs, the GitHub reconnect | facts only you can see | screenshots / CSVs in the chat | G4, G5, G6 |
| **B** | Accountant | answer to the refund rule N4 (one page, `OWNER_DECISION_PACKETS_EXT10.md`), and a look at one tax export | the dashboard must not invent accounting treatment; until answered it says refunds are records only | a short written answer | N4; tax export confidence |
| **C** | Lawyer | legal hold vs delete, data retention, website claims review (D8) | system behaviour depends on legal rules; Claude gives no legal advice | written answer | U22, retention, D8 |
| **D** | E-mail provider (when chosen) | transactional sending (receipts) yes/no; support replies yes/no; sender domain; delivery log; retry; unsubscribe for marketing | no send path exists today, on purpose | provider's documentation link | R10 |
| **E** | Whoever controls the agents' code (Supabase functions, private repository workflows) | for each agent #1–#8: what it reads, what it writes, its schedule, how it records a failure, whether a second run can duplicate work. **No secrets, no keys** | the agents cannot be failure-tested without it (`ENGINEERING_CATALOG_EXT11.md` §8) | a text description or the code without credentials | agent failure tests (U30), supervisor (U41) |
| **F** | Real-device tester (can be you) | card 5 on an iPhone and a Mac | Chromium emulation is not an iPhone or VoiceOver | PASS / FAIL per line + screenshots of FAILs | G15 |

**R8 real products (owner intake):** for each product send `product name · SKU exactly as printed on the label · active or not`. Evidence needed: a photo of the label or the supplier's list (SKU visible). Claude never invents SKUs. **R9 Shopify sync:** waits for the website and Shopify store to launch with real products (R8) and for the stock functions to be on (P4); turning it on earlier would import nothing useful and add risk.

## 4. What changed in EXT11

Five real problems fixed (X11-01 to X11-04, X11-06: orders without a total no longer counted as $0; return and recall after a lost connection now say whether the save happened and that the stock step did not run; report figures that are missing show "—"; a received return no longer claims "Restocked" when the restock may not have run). New: System status shows which database steps are installed and flags a switch that is ON without its step; one-sitting read-only session with a single verdict; backup answer intake with expiry. Full report: `DEEP_PLATFORM_EXTENSION_11_2026-10-11.md`.
