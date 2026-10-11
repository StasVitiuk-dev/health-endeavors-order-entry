# Owner unblock center (EXT9): everything still unfinished, in one place

**Status:** CURRENT (2026-10-10, extension 9). For Stas: this page replaces searching through many documents. Every unfinished item of the internal platform is here once, with who does the next step. Detail lives in the linked files. Nothing in production was changed by Claude.

**Classes:** **A** Claude can safely complete now · **B** needs an owner decision · **C** needs a read-only production check · **D** needs an owner production action · **E** needs an outside provider or person · **F** deliberately deferred.

**Start here (in this order):** U01 backup check → U02 merge the branch → U03 GitHub access → U04–U07 read-only checks → then the database steps U08 onward, one at a time.

## 1. The list

| # | Issue | Class | Current state | Why it matters | Depends on | Exact next action | Who | Evidence | Rollback | Prod risk | Blocks merge | Blocks prod readiness | Blocks normal business |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U01 | Backup health | C | **NOT CHECKED** (UNKNOWN) | No production change is safe without it | — | 2-minute look (`PRODUCTION_READONLY_VERIFICATION_EXT9.md` §1) | Stas | one line: green/red + dates | — | none | NO | **YES** | NO |
| U02 | Merge the EXT9 branch (contains EXT1–EXT9) | D | READY FOR OWNER DEPLOYMENT (tests green, see PR) | Fixes dozens of bugs live on the site today; every new safety switch ships OFF | PR review | Review PR → Merge → Cmd+Shift+R → check Home | Stas | screenshot of Home | Revert the merge | low (switches off) | — | **YES** | **YES** (live bugs) |
| U03 | GitHub access for Claude (X6-17) | D | Session acts as the owner with **admin** (re-checked today; not used) | A session could bypass review | — | claude.ai → Settings → Connectors → GitHub → sign in as `stasvitiuk-reos` (Write role) | Stas | V10 screenshot | reconnect | none | NO | **YES** | NO |
| U04 | Query C (agents, schedules, other stock writers) | C | PREPARED, tested locally | R1–R5 must know nobody else writes stock | — | run `02_READONLY_C_agents.sql` | Stas | CSV | — | none | NO | **YES** | NO |
| U05 | Query D (elevated functions) | C | PREPARED | finds functions anyone can call with owner rights | — | run `03_READONLY_D_…` | Stas | CSV | — | none | NO | **YES** | NO |
| U06 | Query G (permissions inventory) — NEW | C | PREPARED, tested locally 11/11 | open task updates, anon rights, duplicate read policies, tables without RLS | — | run `06_READONLY_G_…` | Stas | CSV | — | none | NO | **YES** | NO |
| U07 | Query E + F (mismatches, stuck work, duplicates) | C | PREPARED, tested | "before" picture; prechecks for U12 | — | run `04_…` and `05_…` | Stas | CSVs | — | none | NO | YES | NO |
| U08 | Install R1–R5 (all-or-nothing stock) | D | READY FOR OWNER DEPLOYMENT (drafts/10; install package 61/61 locally) | stock can double or half-save today | U01, U04 | `R1-R5-INSTALL-RUNBOOK.md` | Stas | V8 fingerprint | drafts/11 | low (unused until switches) | NO | **YES** | NO |
| U09 | Stock switches + turn on one at a time | D | Dashboard IMPLEMENTED IN BRANCH + TESTED LOCALLY; drafts/21 ready | the buttons start using R1–R5 | U02, U08 | drafts/21, then Feature Switches one switch at a time (P3/P4) | Stas | V9 + one real action per switch | switch off (instant); drafts/22 | low | NO | **YES** | NO |
| U10 | PO line guard (drafts/17) | D | READY (independent) | line edits during a receive | U01 | run drafts/17 | Stas | trigger present | drafts/18 | low | NO | YES | NO |
| U11 | Request keys (drafts/19 + 27 + switch) | D | Dashboard IMPLEMENTED IN BRANCH for 5 creates; drafts ready | duplicate records after a lost reply | U01 | drafts/19 → drafts/27 → switch on | Stas | per file | switch off; drafts/28, drafts/20 | low | NO | YES | NO |
| U12 | Integrity rules (drafts/23) | D | READY; stops itself if data already breaks a rule | the database refuses impossible values | U07 = 0 | run drafts/23 | Stas | 4 rows | drafts/24 | very low | NO | YES | NO |
| U13 | Permission fixes | C→A→D | waiting for Query G | close any FAIL | U06 | send CSV → Claude drafts fixes with exact rollback | Stas then Claude | Query G re-run: no FAIL | per draft | **medium** (can lock staff out; rollback restores) | NO | **YES** | NO |
| U14 | Query F nightly (drafts/25) | B+D | READY (local 12/12) | problems noticed automatically | X8-D4 thresholds | decide thresholds; run drafts/25 | Stas | cron job listed | drafts/26 | none | NO | NO | NO |
| U15 | Revoke direct stock writes (INV-20) | C→A→D | not drafted (needs real grants) | forces every stock change through R1–R5 | U09 stable, U04, U06 | after G: Claude drafts | Claude then Stas | — | grant back | medium | NO | YES | NO |
| U16 | Backup status on Home (D5) | B+D | design only | Home shows real backup health instead of UNKNOWN | X8-D6 | approve; change the private backups job (Claude must not) | Stas | Home line | drop table | none | NO | NO | NO |
| U17 | Restore drill into a throwaway project | D | local drill only (6/6) | proof a backup restores | U01 | `RECOVERY_AND_BACKUP_READINESS.md` §4 | Stas | minutes taken (RTO) | delete the project | none | NO | **YES** | NO |
| U18 | Refund accounting rule (N4) | B+E | today: status-only | revenue and tax after refunds | accountant | answer the one-page question (`N4_DECISION_ONE_PAGE.md`) | Stas + accountant | answer A/B/C | dashboard switch | none | NO | YES (before real refunds) | YES (after refunds start) |
| U19 | Orders saved without items (X6-14 / X8-D3) | B | policy A (counted), both tested | revenue slightly high under A | accountant | choose A or B | Stas | answer | — | none | NO | NO | NO |
| U20 | Partial returns (D-ops-5) | B | whole line restocked | stock overstated on partial returns | — | yes/no | Stas | answer | — | none | NO | NO | after returns volume |
| U21 | One recall per lot (D-ops-4) | B | allowed twice | double quarantine | — | yes/no | Stas | answer | — | none | NO | NO | NO |
| U22 | Legal hold vs delete | B | nothing checks holds | litigation risk | lawyer if unsure | option 1 or 2 | Stas | answer | — | none | NO | NO | NO |
| U23 | Can employees approve requests? (X7-14a) | B | database allows any staff | employee approves owner-level items | U06 | yes/no | Stas | answer | — | none | NO | before hiring | NO |
| U24 | Switch tables owner/admin only (X7-14b) | C+B | rule UNKNOWN | staff could flip agents or Emergency | U06 | answer after G | Stas | G02 rows | — | low | NO | before hiring | NO |
| U25 | Last 7 days vs calendar week (X8-D2) | B | "Last 7 days" everywhere | reporting convention | — | keep or change | Stas | answer | — | none | NO | NO | NO |
| U26 | Where to show the staging copy (X8-D1) | B | built + tested, no URL | review changes before merging | — | pick one of 3 (`STAGING_REVIEW_PLAN.md` §4) | Stas | answer | delete page | none | NO | NO | NO |
| U27 | Recovery targets RPO/RTO (X8-D5) | B | none set | what loss is acceptable | — | accept 24 h / 4 h or set others | Stas | answer | — | none | NO | YES | NO |
| U28 | Agent #1 (invoices) on or off? | C | UNVERIFIED since Sept 24 | invoices may not be created | U04 | read V2 §2 | Stas | CSV | — | none | NO | YES | YES (if invoices needed) |
| U29 | Agents #2/#3/#7/#8 | F | OFF on purpose until products exist | — | U31 | later | Stas | — | switch off | — | NO | NO | NO |
| U30 | Failure tests for agents 1–8 | E+B | not possible here (code outside the repo) | duplicates / stuck runs | function source export | export source; approve a local test task | Stas | — | — | none | NO | YES (before agents go live) | NO |
| U31 | Real products with exact SKUs (R8) | D | not done | needed before launch | — | add products | Stas | — | — | none | NO | YES | YES |
| U32 | Shopify order sync on (R9) | F | OFF on purpose | — | U08–U09, U31 | later | Stas | — | switch off | medium | NO | YES | YES (at launch) |
| U33 | E-mail service for customer messages (R10) | E+B | none connected; Agent #6 dry run | customer notifications | provider choice | choose provider; Claude then designs the approval step | Stas | — | — | medium | NO | YES (at launch) | at launch |
| U34 | VoiceOver / real iPhone Safari check | D (manual) | automated checks only | accessibility on real devices | — | 15-minute checklist (`MANUAL_DEVICE_CHECKLIST_EXT9.md` A–B) | Stas | screenshots | — | none | NO | NO | NO |
| U35 | Safari / Firefox desktop check | D (manual) | Chromium only tested | browser differences | — | `MANUAL_DEVICE_CHECKLIST_EXT9.md` C | Stas | screenshots | — | none | NO | NO | NO |
| U36 | Tests required before merging (CI-02/03) | D | CI drafted, inactive | a broken change could be merged | — | GitHub settings (owner only) | Stas | — | — | none | NO | recommended | NO |
| U37 | Document categories | B | 7 fixed | filing | — | keep or add | Stas | answer | — | none | NO | NO | NO |
| U38 | Phone card layout for wide tables (X7-15) | A (deferred) | wide tables scroll inside their box | readability on phones | — | small PR after merge | Claude | screenshots | revert | none | NO | NO | NO |
| U39 | Code structure steps M1–M5 | F | roadmap only | maintainability | U02 (avoid merge conflicts) | after merge, one step per PR | Claude | tests | revert | none | NO | NO | NO |
| U40 | Claims review queue (D8) | B+E | design only | legal risk on the website | lawyer | approve design | Stas | — | — | none | NO | before website launch | NO |
| U41 | Agent supervisor (D6) | B+D | design only | nothing watches agents today | heartbeat table approval | approve | Stas | — | — | none | NO | before agents go live | NO |
| U42 | Request keys on the other 17 create paths | A (later) | 5 most important done | fewer duplicates | U11 | extend after U11 proves itself | Claude | tests | revert | none | NO | NO | NO |
| U43 | Show Query F results on Home | A (after U14) | — | one place to look | U14 + a read policy | Claude drafts policy + PR | Claude then Stas | — | revert | none | NO | NO | NO |
| U44 | Audit coverage gaps | C | known list (`AUDITABILITY_REVIEW.md`) | who changed what | U04 (§10) | read V2 §10 | Stas | CSV | — | none | NO | YES | NO |
| U45 | Storage (receipts/documents) access rules | C | UNKNOWN | private files | — | Supabase → Storage → Policies (look only) | Stas | screenshot | — | none | NO | YES | NO |

## 2. R1–R10 launch fixes: exact status

| # | Item | Status |
|---|---|---|
| R1 | PO receive all-or-nothing | Function: TESTED LOCALLY, READY FOR OWNER DEPLOYMENT (drafts/10). Dashboard: IMPLEMENTED IN BRANCH (switch `stock_fn_receive_po`, off). NOT DEPLOYED |
| R2 | Recall quarantine all-or-nothing | same (switch `stock_fn_recall`) |
| R3 | Return restock all-or-nothing | same (switch `stock_fn_return`); partial quantity waits on D-ops-5 |
| R4 | Manual adjustment in the database | same (switch `stock_fn_adjust`; sends the number shown) |
| R5 | Product delete never loses stock | same (switch `stock_fn_delete_product`); today's browser path already refuses in-use / stocked products (Branch) |
| R6 | Escape output on search/dashboard pages | IMPLEMENTED IN BRANCH, TESTED LOCALLY (xss-everywhere); NOT DEPLOYED |
| R7 | Pin + integrity-hash the library | IMPLEMENTED IN BRANCH, TESTED LOCALLY (library-pin); NOT DEPLOYED |
| R8 | Real products with exact SKUs | NOT STARTED (owner) |
| R9 | Re-enable workflows / Shopify sync | NOT STARTED (deliberately; after R1–R4 live and R8) |
| R10 | E-mail service + notifications re-checked | NOT STARTED (provider not chosen); dashboard has no send path (hard-walls test) |

## 3. Owner decisions, compressed (no duplicates)

| Decision | Why it matters | Options | Safe default | Unblocks | Can wait? |
|---|---|---|---|---|---|
| Connect Claude as `stasvitiuk-reos` (X6-17) | removes review bypass | do / don't | do | safe merging | NO |
| Merge EXT9 | fixes live bugs | merge / wait | merge | everything after | NO |
| R1–R5 rollout order (D-ops-1) | stock safety | R1→R4→R2→R3→R5 suggested | suggested order | U08–U09 | after U04 |
| Refund rule N4 | revenue/tax correctness | a status-only / b subtract refunds / c accountant's rule | a (today) until accountant answers | U18 | until first real refund |
| Orders without items (X6-14) | revenue | A count / B exclude | A (today, listed) | — | YES |
| Partial returns (D-ops-5) | stock accuracy | yes / no | yes (recommended) | R3 quantity | YES |
| One recall per lot (D-ops-4) | over-quarantine | yes / no | yes | INV-16 draft | YES |
| Legal hold vs delete | legal | option 1 block / option 2 warn | option 2 until legal advice | — | YES |
| Employees approve? (X7-14a) | control | yes / no | no (owner/admin only) | permission draft | until hiring |
| Query F thresholds (X8-D4) | noise vs misses | defaults / custom | defaults | U14 | YES |
| RPO/RTO (X8-D5) | recovery expectations | 24 h / 4 h suggested | suggested | U17 | NO (before launch) |
| Staging location (X8-D1) | safe review | private claude.ai page / local / staging repo | private page | U26 | YES |
| Backup status row (X8-D6) | backup visibility | approve / not | approve | U16 | YES |
| Last 7 days vs week (X8-D2) | reporting | keep / calendar week | keep | — | YES |
| Document categories | filing | keep / add | keep | — | YES |
| CI required check (CI-02) | safe merges | turn on / not | turn on | — | YES |
| Next automation (X8-D7) | effort | per D1–D11 | Query E/F once, then F nightly | — | YES |

## 4. Claude-safe work still remaining

Only U38 (phone card layout), U39 (structure steps), U42 (request keys on more forms) and U43 (Query F on Home): all deliberately left until after the merge (they touch many lines and would conflict with review) or until their database step exists. Everything else needs one of: production evidence (C), an owner decision (B), an owner production action (D), or an outside party (E).
