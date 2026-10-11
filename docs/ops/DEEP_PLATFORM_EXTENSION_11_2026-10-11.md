# Deep platform completion: extension 11 (2026-10-11)

**Status:** CURRENT. Branch `claude/platform-ext11-final-readiness-2026-10-11`, created from the final EXT10 commit `56a927c` (EXT10 draft PR #26 stays as history; the EXT11 draft PR replaces it for review). **Not merged, not deployed. Production not touched.** `main` unchanged at `d3db7bc`. Internal dashboard/platform only.

Plain-English summary for Stas: EXT11 looked for everything still worth doing before you start production checks, and found five real problems. The dashboard could:

- count an order with no total as $0 of revenue;
- after a lost connection on a return, say "nothing was changed" when the return had in fact been saved as Received but its stock never added back;
- do the same on a recall, leaving recalled stock sellable;
- show missing report figures as 0;
- label a received return "Restocked to Available" even when its restock had not run.

All five are fixed and tested. System status now also shows which database steps are installed, and warns if a switch is ON without its step. A new test proves that merging the code before any SQL is safe.

Your remaining work is now a short, ordered list of checks and steps only you can do: **`OWNER_UNBLOCK_CENTER_EXT11.md`**, then **`PRODUCTION_READINESS_BOARD_EXT11.md`**.

## 1. Start-of-session check (read-only)

| Check | Result |
|---|---|
| Repository / origin | `StasVitiuk-dev/health-endeavors-order-entry` |
| EXT10 final / frozen | `56a927c` (pushed, remote = local) / `e3268a6` |
| `main` | `d3db7bc`, unchanged at the end too |
| PR #26 | open, draft, not merged, head `56a927c`, no comments |
| Tree | clean; no website, Real Estate OS or secret files |
| Named docs | `KNOWN_BUGS_AND_RISKS.md`, `TESTING_AND_EVIDENCE.md`, `CODING_BOUNDARIES.md` do not exist in this repository (topics covered elsewhere; not created) |

## 2. Real bugs fixed (each has a test that fails on the old code)

| ID | Problem | Test |
|---|---|---|
| X11-01 | An order saved without a total added $0.00 to revenue silently on Home, Daily Summary, Accounting, Tax Records and in the tax export | missing-totals-ext11 (4 of 5 fail on the old code; the 5th is the "no warning when fine" check) |
| X11-02 | Return Mark Received after a lost connection said "nothing was changed" although the return could be Received with its restock never run; a second press was refused | failure-recovery "X11-02" (3 tests) |
| X11-03 | Recall Quarantine, same pattern: recall Quarantined, stock never moved | inventory-safety "X11-03" |
| X11-04 | Report History showed 0 / $0.00 for a figure missing from a daily report, and week/month totals looked complete | missing-totals-ext11 "Report History", helpers-unit "EXT11" |
| X11-06 | A received return was labelled "Outcome: Restocked to Available" even when the restock had not run (found by reviewing the final screenshots); now "Chosen outcome: Restock to Available" | failure-recovery "X11-02: claim saved" |

**Test-harness problems found and fixed (not dashboard bugs):** the System status row helper matched "Database" inside "Database steps"; the diagnostic test read the text before it was written; the new merge-before-SQL adjustment test checked the history row before it was saved (reproduced with a delayed save). Two existing tests expected the old wording "nothing was changed" for the not-saved case and now expect the read-back wording (behaviour change on purpose).

## 3. New capabilities (IMPLEMENTED IN BRANCH, TESTED LOCALLY, NOT DEPLOYED)

| Capability | Notes |
|---|---|
| System status: "Database steps (read-only check)" and "Switch safety" (X11-05) | uses the switches' own harmless probes; runs only while the page is open or on Check again / Copy (never at sign-in); PROBLEM names any switch ON without its step; UNKNOWN when switches cannot be read |
| Merge-before-SQL test profile | `tests/helpers/pre-sql.js` answers like today's production database; `merge-without-sql-ext11` (10 tests) |
| One-sitting read-only session | `interpret-query-results.js session --env … --run-date …` with D/E/F/G/H CSVs and the backup answer; refuses without a stated environment; backup not checked is never PASS |
| Backup intake + evidence expiry | VERIFIED HEALTHY / STALE / FAILED / UNKNOWN with a 7-day expiry; queries expire after 30 days |

## 4. Documents

New: `CURRENT_PLATFORM_STATE_EXT11` · `OWNER_UNBLOCK_CENTER_EXT11` · `PRODUCTION_READINESS_BOARD_EXT11` (gap breakdown with a machine-readable copy, board, owner order, merge-before-SQL evidence, checkpoint log) · `OWNER_CHECKS_EXT11` (backup card, read-only session, Query C–H in plain words, F01–F15, agents, GitHub, real devices, evidence expiry) · `ENGINEERING_CATALOG_EXT11` (7 + 4 write paths, transaction boundaries, audit, lost-response model, RLS result → fix matrix, error vocabulary, cap registry, agents and D1–D11, roadmap) · `UNFINISHED_WORK_EXT11`. EXT10 entry points marked SUPERSEDED. Backlog 355 items, 249 done in the branch.

## 5. Honest completion model (documentation not counted)

| Area | Estimate | Basis |
|---|---|---|
| Dashboard (branch) | ~89% (was 87%) | five more truth fixes, installation status |
| Live dashboard | ~60% | `main` still lacks EXT1–11 |
| **Production readiness** | **~15% (unchanged)** | `PRODUCTION_READINESS_BOARD_EXT11.md` §1: nothing merged, installed or checked in production |
| Data integrity | ~74% (was 72%) | unknown-vs-zero and lost-reply read-back; database packages still not installed |
| Operational readiness | ~72% (was 70%) | owner cards and one-sitting session ready; not yet used on live data |
| Security | ~72% | unchanged; X6-17 and permission facts open |
| Staging | ~62% | unchanged; location needs owner choice |
| R1–R5 deployment readiness | ~90% of what Claude can do; 0% deployed | |
| RLS readiness | ~35% | templates only until Query G |
| Audit readiness | ~40% | expected map only until Query C §10 |
| Agent observability | ~45% | honest states; no source, no heartbeat |
| Automation readiness | ~35% | D1 ready to install; others design or never |
| Backup readiness | ~15% | intake and expiry ready; status UNKNOWN |

## 6. Final evidence (all local, synthetic data; production not touched)

Page code frozen at **`32c05e2`** (final): no page, helper or CSS change after it; later commits change only tests and docs. The earlier freeze `ba2b055` was replaced after the screenshot review found X11-06 (one label).

| Check | Result |
|---|---|
| Full suite on `32c05e2` (desktop 1100 + iPhone 390) | **2,786 tests: 1,783 passed (including 8 expected failures), 1 failed, 0 flaky**, 1,002 skipped with a stated reason, **0 unexplained**. The 1: the 10,000-record search-speed test, whose page switch can wait past 20 s while 10,000 rows are drawn; it fails **1 in 5 on the EXT10 code too** (measured), so not an EXT11 regression; fixed in the test (`eb8f31b`: wait for the drawing first), then 8/8 |
| Earlier full suite on `13cea22` (freeze `ba2b055`) | 2,786 tests: 1,778 passed, 6 failed (3 generated lists, 1 new-test timing reproduced and fixed, the search-speed test and one session reload under load; both passed alone and ×3), 0 flaky |
| High-risk specs ×3 (45 files incl. every EXT11 spec, search-palette, session-failures) on `199ed38` | **2,733 passed, 0 failed, 0 flaky** |
| After X11-06: returns / stock / System status / write-path / request-baseline specs ×3 on `eb8f31b` | **966 passed, 0 failed** |
| Page mutations | **153 / 153 caught** (full set on `199ed38`) + the X11-06 mutant on `32c05e2` = **154 / 154** |
| SQL mutations | **13 / 13 caught** |
| Local database tests (re-run; no SQL changed in EXT11) | install package 61/61 · PO forced orderings 0 guarded failures · browser-path races 0/0 · request keys 23/23 · reconciliation 24/24 · Query F 33/33 · restore drill 6/6 · stock switches 23/23 · Query G 11/11 · integrity rules 17/17 · nightly schedule 12/12 · request-key switch 10/10 · Home results 25/25 · 50k performance 10/10 · drift 27/27 |
| Stress / random | 5 runs, 0 failed · seed 909 × 40 rounds: 0 failing, 0 deadlocks |
| R1–R5 fingerprint | `3df2bf7a07b451f12f9359ceca1c85df` (unchanged) |
| Secret scan (`56a927c..HEAD`) | clean: no keys, tokens, private keys, real e-mails or model identifiers |
| Screenshots | 8 in `design-review/dashboard-extension-11-2026-10-11/` (`MANIFEST.md`), captured on `32c05e2`, reviewed by eye (the review found X11-06) |
| `main` | `d3db7bc`, unchanged; nothing merged or deployed |

### What these results do NOT show
Local SQL tests are not a production install. Prepared RPCs are not installed. Every switch is OFF. UNKNOWN is never healthy. A local restore drill is not a real backup restore. Chromium phone emulation is not a real iPhone. Prepared permission fixes are not deployed (none are even written until Query G).

### Lessons recorded
- Regenerate the write-path lists after the **last** page change, not an earlier one.
- A test that waits for one write must not assume the next write has landed.
- A speed budget measured under three parallel workers needs a solo re-run, and a run on the previous code, before it is called a regression.
- Review the final screenshots before freezing (found X10-24 in EXT10 and X11-06 here).
