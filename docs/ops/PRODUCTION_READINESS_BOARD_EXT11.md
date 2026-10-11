# Production readiness board (EXT11)

**Status:** CURRENT (2026-10-11, extension 11). One page that says **why production readiness is about 15%**, what exactly blocks the rest, and in what order the owner unblocks it. It does not repeat the step details: those stay in `PRODUCTION_CHANGE_PACKAGE_EXT10.md` (steps P0–P11, preconditions, stop conditions, observation window, owner dry run) and `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (checks V1–V13). The owner's own checks and cards are in `OWNER_CHECKS_EXT11.md`.

**Nothing on this page has been done in production.** Every row below is at most READY FOR OWNER DEPLOYMENT. Production readiness rises only when a production fact is checked or a production step is done, never because of work in the branch.

## 1. Why production readiness is ~15% (the gap, item by item)

Weights are planning weights, not measurements. "Done" counts only what is true in production today.

| # | Requirement | Weight | Done in production | Why it is (not) done | Unblocked by |
|---|---|---|---|---|---|
| G1 | Live dashboard works on `main` with sign-in, row-level security and the tasks audit trigger | 10 | 10 | true today (REPORTED by the owner; the live site is in use) | — |
| G2 | Database packages ready so no further dashboard change is needed before installing them (switch pattern) | 5 | 5 | IMPLEMENTED IN BRANCH and TESTED LOCALLY; counted once because it removes a whole dashboard release from the critical path | — |
| G3 | CODE MERGED (EXT1–11 on `main`) | 15 | 0 | branch only; PR not merged | owner merges (P0) |
| G4 | BACKUP VERIFIED (V1 green on the day of each production step) | 10 | 0 | UNKNOWN: Claude cannot see the backups repository | owner 2-minute look |
| G5 | Read-only facts: Query C, D, E, F, G, H run on production | 10 | 0 | PREPARED and tested locally; NOT RUN on production | owner runs one read-only session |
| G6 | GitHub least privilege (X6-17 closed) | 3 | 0 | the session still acts as an admin account (never used) | owner reconnects as `stasvitiuk-reos` |
| G7 | DATABASE FUNCTIONS INSTALLED (R1–R5) and fingerprint verified | 12 | 0 | READY FOR OWNER DEPLOYMENT; NOT DEPLOYED | P2 + V8 |
| G8 | REQUEST-KEY SQL INSTALLED (drafts 19 + 27) | 4 | 0 | READY FOR OWNER DEPLOYMENT; NOT DEPLOYED | P7 + V11 |
| G9 | INTEGRITY SQL INSTALLED (drafts 23 rules; 25 + 29 nightly check) | 6 | 0 | READY FOR OWNER DEPLOYMENT; NOT DEPLOYED | P6, P9, P9b |
| G10 | RLS VERIFIED (Query G) and any fix applied | 8 | 0 | UNVERIFIED; fixes wait for the Query G result | V5, then P8 |
| G11 | AUDIT VERIFIED (which tables log changes) | 4 | 0 | known for tasks/orders only; the rest UNKNOWN until Query C §10 | V2 |
| G12 | AGENT STATE VERIFIED (#1–#8) | 4 | 0 | #1 UNVERIFIED; #4/#5/#6 reported; off agents not proven | V2 §1–2, §5 |
| G13 | SWITCHES ENABLED one at a time and observed | 5 | 0 | every switch OFF or absent | P4, P7b, P9b |
| G14 | OWNER POLICIES DECIDED (N4 refunds, partial returns, thresholds, low-stock levels) | 2 | 0 | OWNER DECISION REQUIRED | owner, accountant |
| G15 | REAL DEVICE VERIFIED (iPhone Safari, VoiceOver) | 1 | 0 | only Chromium phone emulation | real-device tester |
| G16 | POST-DEPLOY VERIFIED (postcheck after merge and after each step) | 1 | 0 | nothing deployed yet | owner postchecks |
| | **Total** | **100** | **15** | | |

**What blocks the remaining 85:** G3 merge (15), G7 R1–R5 (12), G4 backups (10), G5 read-only facts (10), G10 permissions (8), G9 integrity SQL (6), G13 switches (5), the rest small. **None of these can be done by Claude**: each needs the owner (or a check only the owner can run).

Machine-readable copy for future status updates (update `done` only from production evidence):

```json
{"asOf":"2026-10-11","total":100,"done":15,"items":[
{"id":"G1","w":10,"done":10},{"id":"G2","w":5,"done":5},{"id":"G3","w":15,"done":0},{"id":"G4","w":10,"done":0},
{"id":"G5","w":10,"done":0},{"id":"G6","w":3,"done":0},{"id":"G7","w":12,"done":0},{"id":"G8","w":4,"done":0},
{"id":"G9","w":6,"done":0},{"id":"G10","w":8,"done":0},{"id":"G11","w":4,"done":0},{"id":"G12","w":4,"done":0},
{"id":"G13","w":5,"done":0},{"id":"G14","w":2,"done":0},{"id":"G15","w":1,"done":0},{"id":"G16","w":1,"done":0}]}
```

## 2. The board

Statuses: NOT STARTED · PREPARED · TESTED LOCALLY · READY FOR OWNER DEPLOYMENT · DEPLOYED · PRODUCTION VERIFIED · BLOCKED · DEFERRED.

| Item | Status | Current evidence | Owner action | Claude action after the owner step | Rollback | Blocking |
|---|---|---|---|---|---|---|
| Backups (V1) | NOT STARTED (UNKNOWN) | none; Claude cannot see it | 2-minute look (`OWNER_CHECKS_EXT11.md` card 1) | record the answer with its 7-day expiry (`interpret-query-results.js session`) | — | YES (gates every database step) |
| GitHub least privilege (X6-17) | NOT STARTED | session acts as admin (never used) | reconnect as `stasvitiuk-reos` (card 8) | re-run the start-of-session access check | reconnect as before | NO for merge, YES for production readiness |
| Merge EXT1–11 code (P0) | READY FOR OWNER DEPLOYMENT | full suite on the frozen EXT11 commit; merge-before-SQL test profile (§4) | review draft PR #27, merge | post-merge checklist with the owner's screenshots | GitHub "Revert" | YES |
| Read-only session (C, D, E, F, G, H) | PREPARED, TESTED LOCALLY | each file read-only (static test), each tested on the local database | run the session (card 2) | interpret, file evidence without customer data, draft permission fixes | — (read-only) | YES |
| R1–R5 install (P2) | READY FOR OWNER DEPLOYMENT | install package 61/61 locally; fingerprint `3df2bf7a07b451f12f9359ceca1c85df` | run `drafts/10` per `R1-R5-INSTALL-RUNBOOK.md` | read V8 and Query H, confirm System status shows "installed" | `drafts/11` | YES for stock safety |
| Stock switches (P3, P4) | READY FOR OWNER DEPLOYMENT | stock switches 23/23 locally; page refuses before install | run `drafts/21`; then one switch per sitting | check the canary action with the owner | switch OFF (instant); `drafts/22` | YES for stock safety |
| PO line guard (P5) | READY FOR OWNER DEPLOYMENT | PO forced orderings: 0 guarded failures locally | run `drafts/17` | — | `drafts/18` | NO |
| Integrity rules (P6) | READY FOR OWNER DEPLOYMENT | 17/17 locally; refuses if existing rows break a rule | run `drafts/23` after V6 + V7 = 0 | — | `drafts/24` | NO |
| Request keys (P7, P7b) | READY FOR OWNER DEPLOYMENT | 23/23 + switch 10/10 locally; 18 create paths keyed in the page | run 19 then 27; then the switch | confirm a lost-reply retry says "already saved" | switch OFF; `drafts/28` then `20` | NO (today's duplicate check stays) |
| Permission fixes (P8) | BLOCKED (needs the Query G result) | Query G 11/11 locally; fix templates mapped in `ENGINEERING_CATALOG_EXT11.md` §5 | send the Query G CSV | write the exact fix drafts and local tests for the real findings | per-policy rollback in each draft | YES (permissions UNVERIFIED) |
| Nightly check (P9, P9b) | READY FOR OWNER DEPLOYMENT | 33/33, 25/25, 12/12 locally; 0.3 s at 50k orders | decide thresholds (X8-D4), run 25 then 29, then the Home switch | confirm Home shows PASS / WARN / FAIL with a time | `cron.unschedule`; `drafts/30` before `26` | NO |
| Audit coverage | PREPARED | expected map in `ENGINEERING_CATALOG_EXT11.md` §3 | V2 §10 (in the read-only session) | compare expected vs observed; draft triggers where missing | drop trigger | NO for merge; YES for full audit claims |
| Agent states | PREPARED | agent cards in `OWNER_CHECKS_EXT11.md` | V2 §1–2, §5 | update `AGENT_CURRENT_STATE_EXT9.md` rows from evidence | — | NO |
| Revoke direct stock writes (P10) | DEFERRED | needs all five stock switches on and stable | — | write the draft when P4 is complete | grant back | NO |
| Backup status on Home (P11) | DEFERRED (OWNER DECISION, X8-D6) | needs a change in the private backups job | decide | — | drop the table | NO |
| Real-device checks | PREPARED | test cards in `OWNER_CHECKS_EXT11.md` card 9 | run on an iPhone / Mac | fix anything found | — | NO for merge |

## 3. Owner order (one action at a time; nothing is switched on before its prerequisite)

| Phase | Step | What | Read-only or change | Before it | After it |
|---|---|---|---|---|---|
| 0 | 0.1 | Backup look (V1) | SAFE READ-ONLY CHECK | — | answer recorded with expiry |
| 0 | 0.2 | Reconnect GitHub least-privilege (X6-17) | owner setting (not production data) | — | access check re-run |
| 0 | 0.3 | Read-only session: Query C, D, E, F, G, H (card 2) | SAFE READ-ONLY CHECK | — | one summary; evidence filed |
| 1 | 1.1 | Merge the EXT11 PR (code only; every switch OFF) | PRODUCTION CHANGE — OWNER APPROVAL REQUIRED | 0.1 not required for code, but recommended | post-merge checklist (`PRODUCTION_CHANGE_PACKAGE_EXT10.md` §5 + System status "all OFF") |
| 1 | 1.2 | Pause: a few days of normal use | — | 1.1 | Home has no new red rows |
| 2 | 2.1 | Install R1–R5 (P2) | PRODUCTION CHANGE — OWNER APPROVAL REQUIRED | 0.1 green **on the day**; 0.3 shows no other stock writer | V8 fingerprint; Query H; System status "R1 … R5: installed", switch safety OK |
| 2 | 2.2 | Add the stock switch rows, all OFF (P3) | PRODUCTION CHANGE | 2.1 | V9: 5 rows OFF |
| 3 | 3.1 | Turn on **one** stock switch: R1 receive (P4) | PRODUCTION CHANGE | 2.2; Query H PASS | canary action; one working day of observation |
| 3 | 3.2–3.5 | Then R4 adjust → R2 recall → R3 return → R5 delete, one per sitting | PRODUCTION CHANGE | previous switch observed | same |
| 4 | 4.1 | PO line guard (P5) | PRODUCTION CHANGE | — | trigger present |
| 4 | 4.2 | Integrity rules (P6) | PRODUCTION CHANGE | Query E + F show 0 for the four rules | 4 rules present |
| 5 | 5.1 | Request keys columns + switch row (P7), then the switch (P7b) in a later sitting | PRODUCTION CHANGE | — | V11; a test reminder added and deleted |
| 6 | 6.1 | Permission fixes (P8), one draft per sitting | PRODUCTION CHANGE | Query G result → drafts written and tested locally | Query G re-run: no FAIL |
| 7 | 7.1 | Nightly check (P9) then its Home card (P9b) | PRODUCTION CHANGE | thresholds decided (X8-D4) | V12; Home shows a result with a time |
| every step | — | Query H (V13) and System status after every step from 2.1 on | SAFE READ-ONLY CHECK | — | any FAIL or PROBLEM: switch OFF, stop, screenshot |

**Never:** two switches in one sitting · a switch before its SQL (the page refuses anyway) · a database step on a day without a green backup look · a fix attempt after a failed precheck (stop and ask).

## 4. Merging the code before any SQL is safe (evidence)

This is what step 1.1 relies on. Tested in `tests/specs/merge-without-sql-ext11.spec.js` with `tests/helpers/pre-sql.js`, a fixture that answers exactly like today's production database (no R1–R5 functions, no request-key columns, no nightly check tables):

| What | Result (TESTED LOCALLY) |
|---|---|
| All 30 pages open | no script error |
| Home nightly card | "Not set up yet" (never PASS or FAIL) |
| System status | every step "not installed"; "OK: all of these switches are OFF" |
| Each of the 7 switches turned on | refused with the reason; no password asked; stays OFF |
| Stock adjustment | uses today's path; no stock function is called; works |
| A switch ON by mistake (set directly in the database) while its function is missing | the button refuses and says to turn it off; System status says **PROBLEM** and names it |

## 5. Deployment checkpoint log (the owner fills this in; one line per step)

| Date | Step | Backup look (date, green/red) | Precheck result | Postcheck result | Query H | Switch states after | Who | Stopped? why |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Critical install files (fingerprints so the pasted file is exactly the reviewed one): R1–R5 `drafts/10` → installed-function fingerprint `3df2bf7a07b451f12f9359ceca1c85df` (V8). Read-only files: SHA-256 prefixes in `PRODUCTION_READONLY_VERIFICATION_EXT10.md`.
