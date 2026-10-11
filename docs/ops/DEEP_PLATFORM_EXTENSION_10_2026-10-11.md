# Deep platform completion: extension 10 (2026-10-11, two missions)

**Status:** CURRENT. Branch `claude/platform-ext10-operations-hardening-2026-10-11`, created from extension 9 (`f9e4850`). **Not merged, not deployed. Production not touched.** `main` unchanged at `d3db7bc`. Internal dashboard/platform only: no website, Real Estate OS, backups repository, production Supabase, Shopify or Gmail was opened.

Plain-English summary for Stas: phones now show wide lists as cards, and Home rows no longer squeeze their text. Every create form can refuse a duplicate after a lost reply, once you install the request-key step and turn on its switch. Home can show the nightly integrity check with honest states. Every Home check now says what to do next. Agents switched off on purpose say so. A Receive whose reply was lost locks itself and offers a safe "Check this order now". The Continuity page has a System status card with a copyable diagnostic summary. Lists no longer stop silently at the database's 1,000-row reply limit. **Ten real problems were fixed.** Nothing new is switched on, and nothing touches production. Your next steps are in **`OWNER_UNBLOCK_CENTER_EXT10.md`**; daily use is in **`OPERATIONS_CENTER_EXT10.md`**.

Note on the branch: the session's assigned branch (`claude/sweet-hamilton-5ty3zp`) is the head of open PR #5 (CLAUDE.md rules). As with extensions 4–9, EXT10 uses its own feature branch so it does not stack onto that PR.

## 1. Start-of-session check (read-only)

| Check | Result |
|---|---|
| Repository / origin | `StasVitiuk-dev/health-endeavors-order-entry` |
| Start point | EXT9 `f9e4850`, clean tree |
| `main` | `d3db7bc`, unchanged at the end too |
| Account | `StasVitiuk-dev`, admin rights (X6-17, still open, never used) |
| Mission 2 start | the mission-1 verification was allowed to finish; clean tree; mission-1 frozen code `121489a` recorded and kept |

## 2. Real bugs fixed (each has a test that fails on the old code)

| ID | Problem | Test |
|---|---|---|
| X10-01 | Feature request "Add" button stayed stuck after the first add | request-keys-ext10 |
| X10-02 | Evidence saved without a file was reported as a failure after saving | request-keys-ext10 |
| X10-03 | An unreadable amount was shown as $0.00 (now "—") | helpers-unit |
| X10-12 | A received order said "stock added" although some lines were short | po-receive "never shows stock added" |
| X10-13 | After "do not press Receive again", Receive was offered again on reopen | po-receive "receipt status unknown" |
| X10-14 | An unreadable agent schedule was shown as Stale instead of Unknown | agent-truth |
| X10-15 | Products, suppliers, lots and several lists stopped silently at the 1,000-row reply limit | scale-ext10b, scale-matrix |
| X10-21 | Search and dashboard pages went blank when the pinned library was refused | library-pin |
| X10-22 | Tax export pressed while a newly picked period was loading produced a file named for the new period with the old figures | report-totals |
| X10-23 | On a phone, Home checks, approvals, recently-deleted and session rows squeezed their text to one word per line | mobile-cards-ext10 "X10-23" (fails at 26% width on the old CSS) |

Test-harness problems found and fixed (not dashboard bugs): session-failures race; phone-swipe test used a table that is now a card list; the write-path extractor did not read scripts moved into `assets/`; three local database scripts relied on rows left by other scripts (integrity constraints, integrity performance, install package: 59/61 on an empty database, now 61/61); report-totals timing under load (X10-11); an outdated scale test that expected the 1,000-row notice for products, which X10-15 removed on purpose (rewritten to prove that all 5,000 products are offered, plus a new test that keeps the notice covered for lists still read in one request).

## 3. New capabilities (IMPLEMENTED IN BRANCH, TESTED LOCALLY, NOT DEPLOYED)

| Capability | Switch / SQL needed first |
|---|---|
| Phone card layout for wide tables (U38); stacked rows on phones (X10-23) | none |
| Request keys on all 18 create paths, plus escalation that happens at most once (U42) | `request_keys` switch (off), drafts 19 + 27 NOT INSTALLED |
| Nightly integrity check card on Home: NOT VERIFIED / PASS / WARN / FAIL / STALE / UNKNOWN (U43) | drafts 25 + 29 + 30 NOT INSTALLED, then `integrity_results_home` |
| "Next step" on every Home check; new checks: low-stock level not set (CONFIG REQUIRED), retired products with stock, agents unhealthy, agents unknown | none |
| Agents off on purpose (#2/#3/#7/#8) labelled; unreadable schedule shows Unknown | none |
| Receipt-status lock after a lost Receive reply, plus a read-only "Check this order now" | none |
| System status card plus a "Copy diagnostic summary" containing no names, e-mails, keys or project address | none |
| Switches show ON/OFF and what they need first | none |
| Query H drift check (read-only, 11 rows H01–H11), plus `interpret-query-results.js` for D/E/F/G/H | owner runs it read-only |
| change-password, search and dashboard pages without inline scripts (strict policy); helpers API 9 | none |

## 4. Documents (one per topic; EXT9 entry points marked SUPERSEDED)

`CURRENT_PLATFORM_STATE_EXT10` (start here) · `OWNER_UNBLOCK_CENTER_EXT10` · `UNFINISHED_WORK_EXT10` · `PRODUCTION_CHANGE_PACKAGE_EXT10` · `PRODUCTION_READONLY_VERIFICATION_EXT10` (V1–V13) · `DATA_INTEGRITY_RULES_EXT10` (I-1..I-24) · `OWNER_DECISION_PACKETS_EXT10` (§6 decision center) · `OPERATOR_QUICK_REFERENCE_EXT10` · `OPERATIONS_CENTER_EXT10` · `OPERATIONS_MAPS_EXT10` · `MOBILE_LAYOUT_EXT10` · `REQUEST_KEYS_EXT10` · `NIGHTLY_CHECK_PACKAGE_EXT10` · `evidence/README.md`. Backlog: 349 items, 243 done in the branch.

## 5. Honest completion model (conservative; documentation is not counted)

| Area | Estimate | Basis |
|---|---|---|
| Dashboard (branch) | ~87% (was 85%) | live `main` still lacks EXT1–10 (~60% live) |
| Production readiness | **~15% (unchanged)** | nothing merged or installed; NOT DEPLOYED |
| Data integrity | ~72% (was 70%) | request keys and nightly check ready but not installed |
| Operational readiness | ~70% | next steps, system status and runbooks in place; the owner has not yet run a full morning routine on live data |
| Security | ~72% (was 70%) | strict script policy on 3 pages; X6-17 and permission facts still open |
| Staging | ~62% (was 60%) | built and tested; no URL chosen |

## 6. Final evidence (all local, synthetic data; production not touched)

Page code frozen at **`2407328`**: no page, helper or CSS change after it. Later commits change only tests, tools, SQL-test scripts and docs.

| Check | Result |
|---|---|
| Full suite on `2407328` (desktop 1100 + iPhone 390) | **2,722 tests: 1,742 passed (including 8 expected failures), 6 failed, 0 flaky**, 974 skipped with a stated reason (device/size or run-once), **0 unexplained**. The 6 were test files out of date with the code: 3 in scale-matrix (expected the notice that X10-15 removed) and 3 generated write-path lists (line numbers). Fixed in `fe74e2f` (tests and lists only); scale-matrix 39/39 and write-path 10/10 afterwards |
| High-risk specs ×3 (40 files, including every EXT10 spec) on `fe74e2f` | **2,427 passed, 0 failed, 0 flaky** |
| Page mutations | MUT_RESULT |
| SQL mutations | **13 / 13 caught** |
| Local database tests | install package 61/61 (after the seeding fix) · PO forced orderings 0 guarded failures · browser-path races 0/0 · request keys 23/23 · reconciliation 24/24 · Query F 33/33 · restore drill 6/6 · stock switches 23/23 · Query G 11/11 · integrity rules 17/17 · nightly schedule 12/12 · request-key switch 10/10 · Home results 25/25 · 50k-order performance 10/10 · drift check 27/27 |
| Stress / random | 5 runs, 0 failed checks · seed 909 × 40 rounds: 0 failing, 0 deadlocks |
| R1–R5 fingerprint | `3df2bf7a07b451f12f9359ceca1c85df` (unchanged) |
| Secret scan (`f9e4850..HEAD`) | clean: no keys, tokens, private keys, real e-mails or model identifiers |
| Visual references | Home checks (desktop and phone) plus the Orders and Expenses phone pictures regenerated and reviewed by eye |
| Screenshots | SHOTS_RESULT |
| `main` | `d3db7bc`, unchanged; nothing merged or deployed |

### What these results do NOT show
Local SQL tests are not a production install. Prepared RPCs are not installed. Every new switch is OFF. UNKNOWN is never healthy. Synthetic staging is not production validation. The local restore drill is not a real backup restore. Automated accessibility checks are not a VoiceOver check on a real iPhone (M-38).

### Lessons recorded
- Regenerate the write-path lists and run the scale and visual specs after any change to a page's reads or CSS, before freezing.
- A local test must create its own rows; three scripts were caught borrowing them.
