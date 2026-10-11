# Owner unblock center (EXT10): everything still unfinished, in one place

**Status:** CURRENT (2026-10-11, extension 10). Supersedes `OWNER_UNBLOCK_CENTER_EXT9.md` (kept as history; U-numbers are the same). For Stas: every unfinished item of the internal platform is here once, with who does the next step. Nothing in production was changed by Claude.

**Classes:** **A** Claude can safely complete now · **B** owner decision · **C** read-only production check · **D** owner production action · **E** outside provider or person · **F** deliberately deferred.

## 0. Your next three actions (in this order)

1. **U01 — the 2-minute backup look** (`PRODUCTION_READONLY_VERIFICATION_EXT10.md` §1). Nothing in the database should change until this is green.
2. **U03 — reconnect GitHub as `stasvitiuk-reos`** (Write role), so no session can bypass review (claude.ai → Settings → Connectors → GitHub).
3. **U02 — review and merge the EXT10 pull request** (contains EXT1–10). Every new safety feature ships switched off; it fixes many problems that are live today.

**Single best action:** the backup look (U01). It costs two minutes, needs no technical step, and is the gate for every production change after the merge.

### Your 10-minute action pack (if you have one sitting)

| Minute | Do | Send back |
|---|---|---|
| 0–2 | U01 backup look | one line (green/red + dates) |
| 2–5 | U03 reconnect GitHub as `stasvitiuk-reos` | screenshot of Collaborators (V10) |
| 5–10 | Open the PR, read the plain-English summary and "Known limitations"; look at the 12 screenshots in `design-review/dashboard-extension-10-2026-10-11/` | "approved to merge" or questions |

## 1. The list (changes since EXT9 in **bold**)

| # | Issue | Class | Current state | Next action | Who | Blocks merge | Blocks prod readiness | Blocks normal business |
|---|---|---|---|---|---|---|---|---|
| U01 | Backup health | C | NOT CHECKED (UNKNOWN) | 2-minute look | Stas | NO | **YES** | NO |
| U02 | Merge the branch (EXT1–10) | D | **READY FOR OWNER DEPLOYMENT on the EXT10 PR** (full suite on the frozen commit) | review → merge → 5-minute postcheck (`PRODUCTION_CHANGE_PACKAGE_EXT10.md` §5) | Stas | — | YES | YES (live bugs) |
| U03 | GitHub access (X6-17) | D | session acts as the owner with admin (re-checked; never used) | reconnect as `stasvitiuk-reos` | Stas | NO | YES | NO |
| U04 | Query C | C | prepared, tested | run V2 | Stas | NO | YES | NO |
| U05 | Query D | C | prepared | run V4 | Stas | NO | YES | NO |
| U06 | Query G | C | prepared, tested 11/11 | run V5 | Stas | NO | YES | NO |
| U07 | Query E + F | C | prepared, tested | run V6, V7 | Stas | NO | YES | NO |
| U08 | Install R1–R5 | D | READY FOR OWNER DEPLOYMENT (drafts/10) | runbook | Stas | NO | YES | NO |
| U09 | Stock switches, one at a time | D | dashboard in branch; drafts/21 ready | P3, P4 | Stas | NO | YES | NO |
| U10 | PO line guard | D | ready | P5 | Stas | NO | YES | NO |
| U11 | Request keys | D | **dashboard covers all 18 create paths (EXT10)**; drafts 19 + 27 ready | P7 → V11 → P7b | Stas | NO | YES | NO |
| U12 | Integrity rules (drafts/23) | D | ready | P6 | Stas | NO | YES | NO |
| U13 | Permission fixes | C→A→D | waiting for Query G | send V5 CSV | Stas then Claude | NO | YES | NO |
| U14 | Query F nightly | B+D | drafts/25 ready; **runtime measured: 0.3 s at 50k orders** | decide thresholds (X8-D4), P9 | Stas | NO | NO | NO |
| U15 | Revoke direct stock writes | C→A→D | not drafted | after U09 + V2/V5 | Claude then Stas | NO | YES | NO |
| U16 | Backup status on Home | B+D | design only | X8-D6 | Stas | NO | NO | NO |
| U17 | Restore drill (throwaway project) | D | local drill 6/6 only | `RECOVERY_AND_BACKUP_READINESS.md` §4 | Stas | NO | YES | NO |
| U18 | Refund rule N4 | B+E | status-only today | accountant answers the one page | Stas + accountant | NO | YES (before real refunds) | after refunds start |
| U19 | Orders without items | B | policy A | choose A/B | Stas | NO | NO | NO |
| U20 | Partial returns (D-ops-5) | B | whole line restocked; **decision packet in `OWNER_DECISION_PACKETS_EXT10.md` §1** | yes / no | Stas | NO | NO | after returns volume |
| U21 | One recall per lot | B | allowed twice | yes / no | Stas | NO | NO | NO |
| U22 | Legal hold vs delete | B | nothing checks holds | option 1 / 2 | Stas | NO | NO | NO |
| U23 | Can employees approve? | B | DB allows any staff | yes / no | Stas | NO | before hiring | NO |
| U24 | Switch tables owner/admin only | C+B | UNKNOWN | after V5 | Stas | NO | before hiring | NO |
| U25 | Last 7 days vs calendar week | B | "Last 7 days"; **side-by-side packet §2** | keep / change | Stas | NO | NO | NO |
| U26 | Staging location | B | built + tested; no URL | pick one of 3 | Stas | NO | NO | NO |
| U27 | RPO / RTO | B | none set | accept 24 h / 4 h | Stas | NO | YES | NO |
| U28 | Agent #1 on/off | C | UNVERIFIED | V2 §2 | Stas | NO | YES | if invoices needed |
| U29 | Agents #2/#3/#7/#8 | F | off on purpose | later | Stas | NO | NO | NO |
| U30 | Agent failure tests | E+B | code outside the repo | export source | Stas | NO | before agents go live | NO |
| U31 | Real products with exact SKUs (R8) | D | not done | add products | Stas | NO | YES | YES |
| U32 | Shopify order sync (R9) | F | off on purpose | after U08–U09, U31 | Stas | NO | YES | at launch |
| U33 | E-mail provider (R10) | E+B | none; no send path | choose provider | Stas | NO | YES | at launch |
| U34 | VoiceOver / real iPhone | D (manual) | automated only; **add M-38: phone cards read once** | 15-minute checklist | Stas | NO | NO | NO |
| U35 | Safari / Firefox desktop | D (manual) | Chromium only | checklist C | Stas | NO | NO | NO |
| U36 | Required tests before merge | D | CI drafted, inactive | GitHub settings | Stas | NO | recommended | NO |
| U37 | Document categories | B | 7 fixed | keep / add | Stas | NO | NO | NO |
| **U38** | Phone card layout | **DONE IN BRANCH** | 7 wide tables are cards below 600 px; tested 320–430 px | real-iPhone look (M-38) | Stas (look) | NO | NO | NO |
| **U39** | Code structure | **PARTLY DONE IN BRANCH** | change-password strict policy; helpers API 9; remaining map M5b–d, M1–M4 | next steps after the merge | Claude | NO | NO | NO |
| U40 | Claims review queue | B+E | design only | approve | Stas | NO | before website launch | NO |
| U41 | Agent supervisor | B+D | design only | approve | Stas | NO | before agents go live | NO |
| **U42** | Request keys on other creates | **DONE IN BRANCH** | all 18 creates + escalation; lifecycle tested | (part of U11) | — | NO | NO | NO |
| **U43** | Query F on Home | **DONE IN BRANCH** | card + drafts 29/30, switch off | P9 + P9b | Stas | NO | NO | NO |
| U44 | Audit coverage | C | gaps listed | V2 §10 | Stas | NO | YES | NO |
| U45 | Storage access rules | C | UNKNOWN | look only | Stas | NO | YES | NO |
| **U46** | Strict script policy on the other 5 pages (M5b–d) | A (after merge) | change-password done | one page per PR | Claude | NO | NO | NO |
| **U47** | Request key on manual orders (X10-05) | A (after U11) | same-order match today | small PR | Claude | NO | NO | NO |
| **U48** | Drift check (Query H, V13) | C | PREPARED, tested locally 27/27 | run after each production step; first run any time (all NOT INSTALLED today) | Stas | NO | YES | NO |
| **U49** | Server-side pagination for Orders / PO lists (X10-19) | F | lists say "Showing N of M" when capped | when real data passes ~1,000 rows | Claude | NO | NO | NO |
| **U50** | Duplicate-customer watcher key (X10-20) | B | not built (emails optional, not normalized) | choose the matching rule (e.g. same e-mail ignoring case) | Stas | NO | NO | NO |

## 2. R1–R10 launch fixes: exact status

| # | Item | Status |
|---|---|---|
| R1 | PO receive all-or-nothing | function TESTED LOCALLY, READY FOR OWNER DEPLOYMENT; dashboard IMPLEMENTED IN BRANCH (`stock_fn_receive_po`, off); NOT DEPLOYED |
| R2 | Recall quarantine | same (`stock_fn_recall`) |
| R3 | Return restock | same (`stock_fn_return`); partial quantity waits on D-ops-5 |
| R4 | Manual adjustment | same (`stock_fn_adjust`) |
| R5 | Product delete | same (`stock_fn_delete_product`) |
| R6 | Escaping on search/dashboard pages | IMPLEMENTED IN BRANCH, TESTED LOCALLY; NOT DEPLOYED |
| R7 | Library pinned + integrity hash | IMPLEMENTED IN BRANCH, TESTED LOCALLY; NOT DEPLOYED |
| R8 | Real products with exact SKUs | NOT STARTED (owner) |
| R9 | Workflows / Shopify sync | NOT STARTED (deliberately) |
| R10 | E-mail service | NOT STARTED (provider not chosen); no send path (tested) |

## 3. Owner decisions, compressed by phase (no duplicates; safe default is always "leave off / keep today's behaviour")

| Phase | Decision | Options | Safe default | Unblocks |
|---|---|---|---|---|
| **Before merge** | Connect Claude as `stasvitiuk-reos` (X6-17) | do / don't | do | safe merging |
| Before merge | Merge EXT10 | merge / wait | merge | everything after |
| **Before database steps** | R1–R5 rollout order (D-ops-1) | suggested R1→R4→R2→R3→R5 | suggested | U08–U09 |
| Before database steps | RPO / RTO (X8-D5) | 24 h / 4 h suggested | suggested | U17 |
| **Before automation** | Query F thresholds + staleness (X8-D4) | defaults (FAIL = wrong reference / impossible value; 26 h) / custom | defaults | U14, U43 |
| Before automation | Backup status row (X8-D6) | approve / not | not yet (Home says "not verified") | U16 |
| Before automation | Next automation (X8-D7) | per D1–D11 | Query F nightly first | — |
| **Before real refunds / returns volume** | Refund rule N4 | a / b / c | a (today) | U18 |
| Before returns volume | Partial returns (D-ops-5) | yes / no | yes recommended; today whole line | R3 quantity |
| **Before hiring staff** | Employees approve? (X7-14a) | yes / no | no | permission draft |
| **Can wait** | Orders without items (X6-14) | A / B | A | — |
| Can wait | One recall per lot (D-ops-4) | yes / no | yes | INV-16 |
| Can wait | Legal hold vs delete | 1 / 2 | 2 | — |
| Can wait | Staging location (X8-D1) | private page / local / repo | private page | U26 |
| Can wait | Last 7 days vs week (X8-D2) | keep / calendar week / show both | keep | — |
| Can wait | Document categories | keep / add | keep | — |
| Can wait | CI required check (CI-02) | on / off | on | — |

## 3b. Added by the second EXT10 mission (operations)

Operations entry point: **`OPERATIONS_CENTER_EXT10.md`** (5-minute morning check, weekly and month-end routines, status vocabulary, incident runbooks). Maps for maintainers: `OPERATIONS_MAPS_EXT10.md`. Decisions grouped by DEPLOYMENT / OPERATIONS / AUTOMATION / ACCOUNTING / STAGING with consequences: `OWNER_DECISION_PACKETS_EXT10.md` §6. Seven more real bugs fixed (X10-12…15, X10-21 search/dashboard went blank when the library was refused, X10-22 tax export mislabelled a period, X10-23 phone rows squeezed their text, X10-24 System status cut off on phones); eleven in EXT10 in total.

## 4. Claude-safe work still remaining

U46 (strict policy on the other pages) and U47 (manual-order key), both best done after the merge (they touch many lines and would conflict with review), plus the items in `UNFINISHED_WORK_EXT10.md` class A. Everything else needs production evidence (C), an owner decision (B), an owner production action (D) or an outside party (E).
