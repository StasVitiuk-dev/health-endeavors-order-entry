# Deep platform readiness, extension 6 (2026-10-07)

Authoritative long-form report for this session. The owner prefers detailed evidence here and a short chat summary (`docs/health-endeavors-current-state.md` §7).

## 1. Starting point, verified before any change

| Check | Result |
|---|---|
| Branch / local / remote | `claude/platform-deep-readiness-extension-5` at `ae8e9aa`; remote identical; working tree clean; no stash; one worktree |
| `main` | `d3db7bc`, unchanged; extension 5 **not** merged |
| Open PRs | #5–#24 open, none merged (heads unchanged since Sept 29–30) |
| Ancestry | Extension 5 contains `main`, every open PR head, `project-record`, `ops-readiness`, `po-receive-investigation`, the overnight branch, extensions 3 and 4. Not contained, on purpose: `tests-only-ci` and `tests-only-ci-v2` (CI workflow drafts) |
| Concurrent changes | none found |
| Leftovers from test runners | none in the repository (the mutation runners work in scratch copies) |
| Ruleset `protect-main` | active: PR required, 1 approval, stale approvals dismissed, last push approved by someone else, code-owner review, no force push, no deletion; **bypass: repository admin, always** |
| **GitHub identity** | The GitHub API answers as **`StasVitiuk-dev` with admin, maintain and push rights**. CLAUDE.md and the access record expect `stasvitiuk-reos` (push only, not admin). **Flagged as X6-17 (owner decision).** No admin ability was used: no settings, ruleset, merge, approval or direct push to `main` |
| Authoritative docs | current-state, progress, PROJECT_RECORD, READINESS_GATE, OWNER_DECISIONS_NEXT, the backlog, the EXT4/EXT5 reports, the runbook, the Query C/D guides, the rollback review |

- **New branch:** `claude/platform-deep-readiness-extension-6`, created from `ae8e9aa` (extension 5's final commit). Earlier history is not rewritten.

## 2. Extension 5 final verification, repaired

EXT5 ended with a test fix that the full suite had not run on. This session ran the **complete suite on `ae8e9aa` itself**, in a separate worktree so no other work could affect it:

| | Result |
|---|---|
| Full suite on `ae8e9aa` | **1,990 tests: 1,330 passed, 0 failed, 0 flaky, 660 skipped** (28.4 min) |
| Skips accounted for (new `tests/tools/skip-report.js`) | **658** deliberate one-screen-size skips (the other size ran each); **2** were NOT run at any size |
| The 2 unexplained skips | The `5..5` number-box case. Chromium turns `5..5` into `5.5` as it is typed, so a conditional `test.skip(!bad)` quietly skipped it in every run. A **test-harness defect**, not a product bug. Fixed: the premise is now asserted; the false case is replaced by "what the box shows is exactly what is saved" tests |
| Expected failures (`test.fail`) | **8** = 4 known atomicity bugs × 2 sizes (receive, recall, return restock, stock adjustment are not all-or-nothing). They wait for R1–R4 (SQL); intentionally visible |

**Verdict:** extension 5's code was clean on its own commit. Its test suite had one hidden skip, now fixed.

## 3. Plain-English summary

This round looked for places where the dashboard could quietly show the wrong thing or keep something it shouldn't. **15 real product bugs were fixed on the branch** (section 5), each with a test that fails on the old code. Five of them are **live on `main` today**:

- **Revenue was counted three different ways.**
  - Accounting excluded cancelled and refunded orders.
  - The Daily Summary and the home page's "Today's revenue" excluded only the exact word "cancelled", so "Canceled" and refunded orders counted. Tests showed $27 and $22 where the real figures were $12 and $10.
  - The Orders page's "Total revenue" added up only the newest 300 orders, cancelled ones included, under the word "Total".
  - All of them now use one rule, and the Orders figure says when it covers only the newest orders.
- **Signing out only hid the page.** The previous person's customer names, e-mails and figures stayed in it on a shared computer. Signing out now wipes the page.
- **"-$0.00"** for totals that are really zero, and figures that settled in a foreign number format on non-US computers.

Also fixed (not on `main` yet, EXT4/EXT5 code):
- manual-order recovery could create a second order;
- Emergency mode said a safety step "could NOT" be done when it simply could not tell.

**Database drafts (not installed):**
- The PO line guard had a gap: it only protected the future R1 receive, not the receive the dashboard uses today. It now protects both, and can be installed on its own.
- New: request keys (stop duplicates when a reply is lost and the person retries).
- New: Query E (read-only reconciliation of stock, deliveries and expenses).

## 4. Commits (oldest first)

| SHA | What |
|---|---|
| `d930bd1` | PO line guard protects today's receive path (NOWAIT); hidden skip removed; clear text for undone steps; skip-report tool |
| `0e03bea` | Request keys draft (19/20) + local test (23) |
| `fa29c34` | Query E + test; SQL mutations +2 |
| `d910c5f` | Accounting independent-calculation tests; "-$0.00" and animation-format fixes |
| `12d5abb` | PO race review section 0 (cases A–J); permission-removed receive test; guard needs no R1 first |
| `0ecdcc0` | Manual orders: "Finish this order" (no second order) |
| `a9efe08` | Emergency: lost reply = "may or may not" |
| `be4d2eb` | Sign-out wipes the dashboard |
| `e4ea450` | Manual-order sign-out wipes typed details |
| `863cdcc` | Static safety check for SQL drafts; draft 13 transactional; change inventory; SQL dependency graph |
| `b6600fc` | 2 / 5 / 10 concurrent operators |
| `8ef794c` | CI plan, disaster readiness table, Query E guide |
| `f2ff26e` | Local SQL test isolation; 8 page mutations |
| `b48b678` | One revenue rule (Daily Summary, home tile); mixed-currency warning; animation follow-up |
| `95cb16a` | Orders page revenue (newest 300, honest label) |
| `56f24ea` | Accounting lists orders without items; backlog +25 |
| `7a46a31`, `7da5455` | Report (evidence pending), readiness matrix, owner package, status docs; backlog note |
| `b6973ca` | 6 screenshot baselines + write-path matrix (intended changes) |
| `dd90a99`, `79a285c` | Session tests wait out the sign-out reload |
| `0db9718` | Page mutations 66/66 (2 misses fixed, MUT_ONLY filter, other-tab sign-out test) |
| `f792e66` | Stress S29 test artifact fixed; backlog X6-26 |
| (final) | This report, final evidence |

## 5. Bugs found and fixed

| ID | P | Bug | Live on `main`? | Status |
|---|---|---|---|---|
| X6-11 | P1 | Daily Summary and home "Today's revenue" counted Canceled / CANCELLED / refunded orders | **yes** | fixed |
| X6-05 | P1 | Sign-out left the previous person's data in the page (shared computer) | **yes** | fixed |
| X6-12 | P2 | Orders "Total revenue" = newest 300 orders only, cancelled included | **yes** | fixed (Accounting rule + honest label) |
| X6-02 | P2 | Zero totals shown as "-$0.00" | **yes** | fixed (formatter) |
| X6-04 | P2 | Manual-order recovery notice made a second order after the tab was closed | no (EXT5 code) | fixed ("Finish this order") |
| X6-06 | P2 | Manual-order sign-out left the typed customer details in the page | **yes** | fixed |
| X6-03 | P3 | Count-up animation re-formatted figures in the browser's language | **yes** | fixed |
| X6-07 | P3 | Emergency: lost reply on a safety step reported as "could NOT" | no (EXT4 code) | fixed |
| X6-08 | P3 | Deadlock / timeout / busy-row errors shown as raw database text | yes (raw text) | fixed |
| X6-13 | P3 | Totals summed across currencies without warning | yes | fixed (warning) |
| X6-14 (part) | P2 | Orders saved without items invisible in Accounting | yes | listed on Accounting (exclusion = owner decision) |
| X6-18 | P3 | drafts/13 not one transaction | draft | fixed |
| X6-01 | P1 | PO line guard did not protect the dashboard's step-by-step receive | draft | **fixed in the draft; needs approval** |
| (own) | — | First version of "Finish this order" compared the saved total with itself | caught before commit | fixed |
| (own) | — | First animation fix dropped thousands commas from counts (`d910c5f`) | caught by scale-matrix | fixed in `b48b678` |

Counted as **15 product bugs**: the 13 rows from X6-11 to X6-01, plus the two self-caught defects.

**Test-harness defects fixed (not product bugs):** the hidden `5..5` skip; the local SQL scripts sharing users (one left a role behind and made the stress test fail 79 checks); the browser-path test's own setup bugs while it was being written.

## 6. Tests added

| Kind | Added |
|---|---|
| New spec `accounting-oracle` | 19 tests: generated orders and expenses (0–2,500 rows, 1,000-row cap) compared with an independent whole-cent calculation; zero / small amounts; German-locale settle; Daily Summary and home-tile rule; mixed currencies; Orders figure; orders without items |
| New spec `concurrent-operators` | 6 (2 / 5 / 10 tabs; tasks; returns Approve vs Reject) |
| New spec `sql-drafts-static` | 26 static checks over every SQL draft |
| `manual-order-entry` | +6 (finish in a new tab, two refusals, stop finishing, sign-out wipe, sign-out in another tab) |
| `session-failures` | +3 (shared-computer sign-out) |
| `admin-pages` | +8 (Emergency safety steps: server error / lost reply / expired; both fail; slow database) |
| `po-receive` | +2 (permission removed mid-receive, both sizes) |
| `numeric-contract` | hidden skip removed; +3 "shown = saved" |
| `helpers-unit` | +2 (zero / rounding; deadlock text) |
| `pages-data` | 1 expectation corrected to the one revenue rule ($470 "any status" → $380, the same as Accounting) |
| Local SQL | new `po_browser_path_races.sh` (14 orderings × guard states), `request_keys_test.sh` (23), `reconciliation_test.sh` (24); stress S27 now with the revised guard |
| Mutations | page 57 → 66; SQL 11 → 13 |

Exact totals: section 8.

## 7. Workstream results (what was checked, with the honest outcome)

| Workstream | Outcome |
|---|---|
| Final test integrity | EXT5 clean on its own commit; hidden skip found and fixed; skip-report tool; every skip classified |
| Combined EXT1–6 review | `CUMULATIVE_CHANGE_INVENTORY.md`: only 9 runtime files change; no new outside hosts, storage keys, dependencies, workflows or database needs; 18 change groups with evidence and rollback |
| PO lifecycle A–J | `PO_RECEIVE_RACE_REVIEW.md` §0: guard gap found and closed in the draft; each case mapped to its evidence; permission-removed test added |
| Database idempotency | request keys drafted for 22 create tables, all-or-nothing install, rollback keeps records; dashboard part waits for the SQL |
| Inventory integrity | Query E reconciliation, tested against planted problems; R1–R5 reassessed: still the only way to make stock changes all-or-nothing |
| Accounting / tax | independent-calculation tests found "-$0.00", three revenue rules, the capped Orders figure, mixed currencies |
| Manual orders | recovery could duplicate; fixed; sign-out wipe; orders without items listed |
| Concurrency | 2/5/10 operators: exactly one change, others told (no bug) |
| Auth / sessions | sign-out data left in the page (fixed); re-authentication client verified isolated |
| Permissions / RLS | static check of every draft (search path, invoker rights, grants, no RLS/policy changes, safe dynamic SQL). The real production policies are not visible here (Query D is the read-only way to see them) |
| Auditability | no new gap found beyond X3-18 / X5-15 (who-did-it columns and ordering ties; need Query C) |
| Emergency mode | 11 failure cases; one wording bug fixed; never a false success |
| Agents | no change; status presentation already shows unknown / stale (EXT2–4) |
| Returns / recalls | covered by existing state and stress tests; atomicity waits for R2/R3 |
| Reports / exports | exports state their limits; capped lists already audited; the Orders revenue figure was the gap (fixed) |
| Performance | no regression seen (the scale and performance specs pass); no optimisation without evidence |
| Accessibility / mobile | automatic checks pass at both sizes; VoiceOver / real device still needed |
| Search / inspector | covered by the existing palette and inspector specs; no new defect found |
| Deletion / legal hold | legal-hold blocking is planned, **not implemented** (MU-11, owner decision) |
| Backup / disaster | known vs unknown table added; backup health stays **UNKNOWN** |
| Query C / D / E | all statically read-only; C/D mocks clean; E new and tested; none run on production |
| SQL migrations | dependency graph; properties per draft; static check |
| Security regression | Unicode direction tricks: stored names are ASCII-only and the upload check uses the real extension; no new defect |
| CI | inactive copy re-read: still least-privilege; additions proposed in `ci/README.md` (not pushed) |
| Operator experience | plain words for undone steps, unknown Emergency outcomes, currency warning, "newest 300" label |

## 8. Final evidence

All runs below are on this machine, in a separate worktree, on the commit named. The test mock blocks every outside host.

| Check | Result |
|---|---|
| **Full suite** on `0db9718` (desktop 1100 px + iPhone 390 px) | **2,138 tests: 1,414 passed, 0 failed, 0 flaky, 724 skipped**, 30.3 min |
| Skip report on that run | **724 / 724** skips are deliberate one-screen-size skips (the other size ran each); **0 unexplained**; 8 expected failures (the 4 known atomicity bugs × 2 sizes, waiting for R1–R4) |
| Commits after `0db9718` | `79a285c` (one test helper) and `f792e66` (stress script, backlog). **No runtime file changed** after `56f24ea`; verified with `git diff --stat 56f24ea HEAD -- '*.html' assets/` (empty) |
| **High-risk specs ×3** on `56f24ea` (fault-injection ×2, state-transitions ×2, manual orders, sessions ×2, PO receive, POs, report totals, accounting oracle, concurrent operators, admin/Emergency, activity, guarded toggles, roles, storage, safety) | 3,256 runs: **2,014 passed, 2 failed, 1,242 skipped**. Both failures were one test (wake-from-sleep sign-out): the test raced the new sign-out reload. Test-only fix in `dd90a99`, then ×10: 10/10 |
| Touched specs ×3 on `0db9718` (sessions, manual orders, screenshots) | 215 passed, **1 failed** (shared-computer test, same reload race). Test-only fix in `79a285c`, then ×10: 30/30 |
| Session / manual-order / general specs ×3 on `79a285c` | **255 passed, 0 failed**, 177 skipped by design |
| **Page mutations** (on `56f24ea`, same runtime) | **63 / 65**, then the 2 misses fixed (one equivalent mutant; one target moved by this session) + 1 new mutant: **66 / 66** (spot run 4/4) |
| SQL tests (15, 16, 14 with draft 13) | all PASSED; R1–R5 fingerprint unchanged `3df2bf7a07b451f12f9359ceca1c85df` |
| Install package | **61 / 61** (also 61/61 with request keys installed) |
| PO forced orderings with R1 | 0 failures with the EXT6 guard |
| PO forced orderings, browser path | EXT6 guard: **0 silent, 0 merely reported** (EXT5 guard: 2 reported) |
| Request keys | **23 / 23** |
| Reconciliation (Query E) | **24 / 24** |
| Query C / C without cron / D mocks | 0 errors, 0 fake secrets in output |
| Static checks | `sql-drafts-static` 26/26, `sql-readonly` 10/10 (in the full suite) |
| **Stress** | Final run ×3: 1 failed check (S29 deadlock, a test artifact, see below). After the test fix (`f792e66`): **5 × 98 passed, 0 failed, 0 deadlocks** |
| **SQL mutations** | **13 caught, 0 missed** |
| Secret scan (whole branch diff from `ae8e9aa`) | clean: no keys, tokens, real e-mails or model identifiers |
| **New tests** | **+148 test cases** (1,990 → 2,138, both sizes); **+84 that run** (1,330 → 1,414 passed). Plus 3 new local SQL scripts and 26 static SQL checks |
| **Bugs fixed** | **15 product bugs** (section 5) + test-harness defects listed below |

### Verification history (nothing hidden)

1. **Final run on `56f24ea`: 7 failures**, all expected consequences of intended changes. 6 screenshot baselines (Orders, Accounting, dark Orders; both sizes) and the generated write-path matrix. Each screenshot difference was inspected: only the new revenue label and figure, and the new Accounting section, changed. Updated in `b6973ca`.
2. **High-risk ×3: 2 failures** in the wake-from-sleep test. The sign-out reload (X6-05) cut off the test's own page command. The test now accepts that navigation and checks the end state more strictly (`dd90a99`).
3. **Page mutations: 2 misses.** One mutant was equivalent: the sign-out event listener also wipes the page, so a second protection hid the break. One target was moved by this session. Both fixed, plus a new test and mutant for the listener (`0db9718`).
4. **Touched specs ×3: 1 failure**, the same reload race in a new shared-computer test. The check now waits out the reload (`79a285c`).
5. **Stress: S29 "no deadlock" failed once.** The server log showed two copies of the test's own delivery deadlocking. The test inserted a line and called R1 in one transaction, which the dashboard never does. S29 now uses two transactions (`f792e66`). R1/R5 are unchanged; a design note for any future combined function is recorded as backlog X6-26.

**What this means:** every failure in the final verification came from test code or from expected test artifacts (screenshots, generated list). None was a dashboard defect. The runtime code verified is `56f24ea` = `0db9718` = `79a285c` = `f792e66` (identical runtime files).

## 9. Known limitations (not hidden)

- The local database is PostgreSQL 16, not Supabase. Locking behaviour is the same in principle; timings and Supabase settings are not verified.
- The concurrency browser tests use a mock that applies one request at a time. Real concurrency is proven separately on PostgreSQL.
- Accessibility is checked automatically only. Safari and iPhone behaviour (including pop-up blocking for file links, X6-22) is not verified.
- Stock changes are still not all-or-nothing until R1–R5 are installed and the dashboard calls them.
- Duplicates after a lost reply + retry remain possible until request keys are installed and sent.
- Production RLS policies, grants and elevated functions are not visible from here (Query D).
- Backup health is unknown.

## 10. Owner decisions, production-only actions, Query C/D blockers

- Decisions: `OWNER_DECISIONS_NEXT.md` ("New in extension 6": X6-17 GitHub access, X6-14 orders without items, request keys, guard, Query E, merge path).
- Production-only actions (each needs approval): R1–R5, PO line guard, request keys, CHECK rules, revoking direct stock writes, Query D permission fixes, one-recall-per-lot rule.
- Query C blocks: R1–R5 install (other stock writers), agent states, remaining value rules. Query D blocks: permission fixes.

## 11. Rollback

- Nothing is merged. To drop this work, ignore or delete `claude/platform-deep-readiness-extension-6`; extension 5 (`ae8e9aa`) is untouched.
- After a future merge: revert the merge commit; content hashes prevent mixed versions; hard refresh.
- Drafts: `11_` (R1–R5), `18_` (guard), `20_` (request keys); each tested and safe to run twice.

## 12. Safety confirmation

- `main` untouched. No merge, no PR, no force push, no deployment, no approval.
- The admin-capable GitHub credential was used only for reads and for pushing to this branch.
- No production Supabase access of any kind; Query C/D/E not run; nothing installed; RLS, cron, grants and agents untouched.
- No Shopify changes; **Shopify Order Sync untouched (off)**. No customer data or messages; no money or accounting records; no backups; no secrets.
- No workflow files changed. The website, the backups repository and Real Estate OS were not touched.
- All database work ran on a throwaway local PostgreSQL with synthetic data.
