# Cumulative change inventory: what would reach `main`

**Status:** CURRENT (2026-10-07, extension 7 addendum in §7; sections 1–6 are from extension 6). Compares `main` (`d3db7bc`) with the extension branches. Line-level detail lives in the backlog (`MASTER_PLATFORM_BACKLOG_2026-10-06.md`, 168+ items marked DONE) and in each extension report. This file answers one question: **if the owner merged the newest extension branch, what would change for the people using the dashboard, and what would that need?**

## 1. Ancestry: one branch contains everything

`claude/platform-deep-readiness-extension-6` was created from extension 5 (`ae8e9aa`). Verified with `git merge-base --is-ancestor` on 2026-10-07:

- **Contained:** `main`; all 20 open PRs (#5–#24) at their current heads; `claude/project-record`; `claude/ops-readiness`; `claude/po-receive-investigation`; overnight implementation (`37050c6`); extension 3 (`3d5f1cc`); extension 4 (`82c2582`); extension 5 (`ae8e9aa`).
- **Deliberately NOT contained:** `claude/tests-only-ci` and `claude/tests-only-ci-v2`. These hold the inactive CI workflow drafts. A workflow file needs its own owner-approved PR (CLAUDE.md), so it is kept out of the dashboard branch.

**Consequence:** merging the newest extension branch merges every open PR's content too. The open PRs are not independently deployable in a different order without conflicts (`pr-merge-order.md`). Choosing between "one merge of the extension branch" and "PRs one by one" is an owner decision (**DOC-02**, `OWNER_DECISIONS_NEXT.md`). Either way, CLAUDE.md changes as in PR #5.

## 2. Size and shape

- 188 commits from `main` to extension 5, plus the extension 6 commits.
- About 190 files, but only **9 are what users load**: `owner-login.html`, `manual-order-entry.html`, `index.html` (identical copy), `dashboard.html`, `search.html`, `change-password.html`, `assets/owner-login-helpers.js`, `assets/owner-login.css`, `assets/owner-login-icon.png`.
- Everything else is tests (`tests/`), documents (`docs/`) and `CLAUDE.md`. GitHub Pages publishes the whole repository, so these become reachable at the site address too. They are already public on GitHub (public repository) and contain no secrets or real data (secret scan, `@example.test` addresses only).

## 3. Checks on what users load (main vs branch)

| Check | `main` | Branch | Verdict |
|---|---|---|---|
| Outside hosts | jsDelivr (Supabase library), Google Fonts (4 smaller pages), the Supabase project | the same, nothing new | no new connection |
| Supabase library | floating `@2` (whatever is newest that day), no integrity check | pinned `2.117.2` + integrity hash on all 6 pages | safer: a changed or compromised file is refused; tests run the same pinned file |
| Content-Security-Policy | none | on `owner-login.html`: scripts only from self and jsDelivr; connections only to the Supabase project; no frames or plugins | safer. Checked: the page loads no Google Fonts, and stored files open in a new tab, so nothing it uses is blocked |
| Browser storage (localStorage) | 5 keys: theme, last page, open groups, pinned pages, calendar view | the same 5 | unchanged |
| Browser storage (sessionStorage) | none | manual-order "attempt in progress" (order number + fingerprint hash, no customer details since EXT5; removed after success) | new; small; tab-scoped |
| Sign-in calls | 1 "signed out elsewhere" listener | 6 (every page follows a sign-out in another tab) | safer |
| Writes (code sites) | 46 update, 30 insert, 8 delete, 5 upsert, 11 RPC | 20 update + the shared guarded helper (51 guarded paths), 31 insert, 10 delete, 2 upsert, 12 RPC | most status changes now go through "only if still …" |
| New tables, columns or functions the page needs | — | **none**. The branch runs against today's database | no SQL needed to merge |
| npm dependencies | — | unchanged (`package.json` pins Playwright and the Supabase library, for tests only) | no runtime change |
| Workflows (`.github/workflows`) | none | none | unchanged |
| Cache safety | — | the CSS, helpers and icon each load with a content hash (`?v=…`), checked by `assets.spec.js` | a merge or rollback never mixes old and new files |

## 4. Major changes, one row each

"Live today?" means the problem exists on `main` now. **Readiness** values: *branch-tested* = code done, tests fail on the old code, waiting only for merge; *needs SQL* = the full fix also needs an approved database change.

| # | Change | Problem solved | Files | Data / security implications | Evidence | Production SQL? | Owner approval | Rollback | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Guarded status changes (`updateIfUnchanged`) on 51 paths | Stale tab, second person or double click silently overwrote a newer decision (tasks, returns, POs, approvals, recalls, legal holds, FDA flag, restores…) | owner-login.html, helpers | Same tables and columns; adds a WHERE condition and reads the row back | state-transitions ×2, guarded-toggles, double-submit-stale, fault-injection ×2 (210 cases) | No | Merge | Revert merge | branch-tested |
| 2 | Receive works from the saved order; reports in-flight edits | Receiving used the page's old lines, shipping and tax (**live**) | owner-login.html | Same writes; one extra read | po-receive (+8 EXT5/6), purchase-orders | No (full atomicity: R1) | Merge; R1 + guard separately | Revert merge | branch-tested; needs SQL for atomic |
| 3 | Money totals read by keyset pages; "-$0.00" fixed; figures settle in US format | Totals could double-count a record created mid-read (**live**); zero showed "-$0.00" (**live**); a non-US browser showed "$25.000,00" (**live**) | owner-login.html, helpers | Read-only | report-totals, accounting-oracle (generated, independent calculation) | No | Merge | Revert merge | branch-tested |
| 4 | Manual orders: retry-safe, dates, unfinished orders listed | Duplicates on retry; one-day-early dates; orders without items forgotten | manual-order-entry.html, index.html | sessionStorage attempt (no customer details); reads own recent orders | manual-order-entry (31 desktop) | No (request keys: drafts/19) | Merge | Revert merge | branch-tested |
| 5 | Sign-out elsewhere, expired sessions, re-authentication | A tab signed out elsewhere kept showing data; failed writes after expiry | all 6 pages | Fewer requests without a session | session-failures, session-expiry-midway, login | No | Merge | Revert merge | branch-tested |
| 6 | Plain-language errors (`explainDbError`, `plainError`) | Raw internals (table, policy, constraint names) shown to staff | owner-login.html, helpers, dashboard.html, search.html | Hides internal names | error-language, helpers-unit | No | Merge | Revert merge | branch-tested |
| 7 | Escaping and injection guards | Database text placed into pages unescaped (`dashboard.html` on main); CSV formula injection; unsafe link schemes | all pages | Security fix | xss-everywhere, csv, link-scheme | No | Merge | Revert merge | branch-tested |
| 8 | Supabase library pinned + integrity; CSP | Floating library version; no integrity | all pages | Supply-chain hardening | assets, safety | No | Merge | Revert merge | branch-tested |
| 9 | Emergency mode honesty | A failed flag save stopped later safety steps; partial failures hidden | owner-login.html | Order Sync and Agent #7 are always switched off, and failures are named | emergency specs, fault-injection | No | Merge | Revert merge | branch-tested |
| 10 | Agent status truth model | Status shown as certain when unknown | owner-login.html | Read-only | agent specs | No | Merge | Revert merge | branch-tested |
| 11 | Storage safety | Orphaned files, unsafe names, deleted records leaving files | owner-login.html | Removes a stored file only with its record; size and type limits | storage-safety | No | Merge | Revert merge | branch-tested |
| 12 | Query A state-machine fixes | Deny wrote a value the database refuses; document link types; categories | owner-login.html | Writes only values the database accepts | state-machine, db-constraints mock | No | Merge | Revert merge | branch-tested |
| 13 | Product delete safety | Deleting a sold product; false success under row-level security | owner-login.html | Fewer deletes succeed | product-lifecycle | No (R5 for atomic) | Merge | Revert merge | branch-tested |
| 14 | Timezone contract, whole cents | UTC dates in US evenings; float money | owner-login.html, helpers, manual order | Dates as Central calendar days | timezone-contract, numeric-contract | No | Merge | Revert merge | branch-tested |
| 15 | Accessibility, phone layouts | Skip link, focus trap, live regions, swipe tables, phone PO tap | owner-login.html, css | None | a11y-basics, device-matrix, responsive | No | Merge | Revert merge | branch-tested (no real VoiceOver or device test) |
| 16 | Modularization steps 1–3 | 500 KB single file hard to test | assets/*.css, *.js, icon | 3 new files must be served (Pages serves them); helper-load failure shows a banner | assets.spec | No | Merge | Revert merge | branch-tested |
| 17 | EXT5/EXT6 smaller fixes | Inquiry drafts overwritten, activity rows repeated, threshold last-write-wins, number-box messages, undone-step messages | owner-login.html, helpers | Guarded writes | guarded-toggles, activity-page, pages-data, helpers-unit | No | Merge | Revert merge | branch-tested |
| 18 | Tests, docs, local SQL tests, drafts | Evidence and owner packages | tests/, docs/ | None at runtime | — | — | Merge (CLAUDE.md change included) | Revert merge | — |

**Database drafts (not part of a merge, each installed separately after approval):** R1–R5 (`drafts/10`, rollback `11`), PO line guard (`17`, rollback `18`, revised in EXT6), request keys (`19`, rollback `20`, new in EXT6). The read-only owner queries C, D and E are prepared, not run. See `SQL_DEPENDENCY_GRAPH.md`.

## 5. Overlaps, duplicates and conflicts checked

- **Open PRs vs the branch:** every PR head is an ancestor of the branch, so there are no conflicting copies. Merging the branch makes the PRs redundant: closing them is the owner's choice.
- **Duplicated fixes:** none found. EXT3–EXT6 extend earlier fixes in place (for example the manual-order retry was tightened in EXT4 and EXT5; the line guard was extended in EXT5 and revised in EXT6). The extension reports record each step.
- **Conflicting migrations:** none. Drafts 10–20 touch separate objects. The guard (17) and R1 (10) were tested together, in both install orders. Request keys (19) add columns R1–R5 do not use. R1–R5's column preflight lists exact columns, so the new nullable column does not trip it (`install_package_test.sh` passes with 19 installed: see the EXT6 report).
- **Stale documentation:** statements that the guard must be installed "after R1" are marked superseded (runbook, rollback review, owner decisions). The F3-09 backlog status (threshold "DEFERRED") is reconciled to DONE via X5-16.

## 6. Rollback complications

- Reverting the merge commit restores the old pages exactly. The content hashes stop browsers mixing versions; a hard refresh (Cmd+Shift+R) clears anything cached.
- If request keys (19) were installed **and** a future dashboard sends them, roll back the dashboard **before** the SQL (otherwise every save fails on the missing column). Today no dashboard code sends them.
- The guard (17) and R1–R5 roll back independently. Rolling back R1 while the guard stays is safe (EXT6 guard does not depend on R1).

## 7. Extension 7 addendum (2026-10-07)

`claude/platform-deep-readiness-extension-7` was created from extension 6 (`444e00c`), so it contains everything in sections 1–6. `main` is still `d3db7bc`. EXT7 adds (all page files, tests, tools and docs; **no SQL draft, no workflow file**):

| Change | Who notices | Needs SQL first? |
|---|---|---|
| Tax Records: one row per state; SKU costs match any case | Owner, accountant | No |
| Money figures never freeze mid-animation | Everyone | No |
| Tasks / Approvals / Incidents show every open item | Everyone | No |
| Recently finished tasks + Reopen | Owner, staff | No |
| Business Health "?" per tile; tiles open their page | Owner | No |
| "Not saved yet" question on close / sign out | Everyone | No |
| Another person signing in elsewhere wipes the tab | Shared computers | No |
| Business Continuity shows Unknown statuses | Owner | No |
| SOP switch re-reads after a conflict; supplier same-name question | Owner | No |

Helper file API is 7 (was 6); the page refuses a mix of old and new files. `manual-order-entry.html` and `index.html` stay identical. Rollback: revert the merge commit.

## 8. Extension 8 addendum (2026-10-10)

`claude/platform-deep-readiness-extension-8-2026-10-07` was created from extension 7 (`f868903`), so it contains everything above. `main` is still `d3db7bc`. EXT8 adds page files, tests, tools and docs, plus one **read-only** query (Query F); **no SQL draft that changes data, no workflow file**:

| Change | Who notices | Needs SQL first? |
|---|---|---|
| Home "Checks: what needs a look" | Owner | No |
| Every waiting customer question listed; answered capped with a count | Owner, staff | No |
| Older-order finder (returns), all-orders lookup (search), Show more on capped lists | Everyone | No |
| Browser Back / deep links inside the dashboard; sign-in re-checked after Back-button cache | Everyone | No |
| "Last 7 days" one window everywhere | Owner | No |
| Product edit and PO shipping/tax refuse to overwrite a newer save | Owner, staff | No |
| Latest request wins on Accounting, Tax, Activity, Calendar, Evidence | Owner | No |
| Content-Security-Policy on the other 5 pages | Nobody (invisible) | No |

Helper file API is 8 (was 7); the page refuses a mix of old and new files. Products are read with `updated_at` (an existing column). Rollback: revert the merge commit.

## 9. Extension 9 addendum (2026-10-10)

`claude/platform-deep-completion-extension-9-2026-10-10` was created from extension 8 (`8aa24a9`), so it contains everything above. `main` is still `d3db7bc`. EXT9 adds page code, tests, tools, docs, one read-only query (G) and drafts 21–28 (not installed); **no workflow file**.

| Change | Who notices | Needs SQL first? |
|---|---|---|
| Stock buttons can use R1–R5 (switch per button) | Nobody until a switch is turned on | Yes: drafts/10 then drafts/21, then a switch |
| Request keys on 5 create forms (switch) | Nobody until the switch is on | Yes: drafts/19 then drafts/27 |
| Feature Switches refuses to turn those switches on early | Owner | No |
| Frame guard + no-referrer | Nobody (invisible) | No |
| Home checks: time, stale warning, re-run | Owner | No |
| Calendar note / personal event conflict refusal | Owner, staff | No |
| Currency warning only on its own page | Owner | No |
| Expenses: Show more past 200 | Owner | No |
| CSV: more formula starters neutralised | Accountant | No |

Helpers file unchanged in API (8); its hash changed (CSV guard). `index.html` = `manual-order-entry.html`. Rollback: revert the merge commit (and, if any switch was turned on, turn it off first).


## 10. Extension 10 addendum (2026-10-11)

`claude/platform-ext10-operations-hardening-2026-10-11` was created from extension 9 (`f9e4850`), so it contains everything above. `main` is still `d3db7bc`. EXT10 adds page code, three new assets (`assets/change-password.js`, `assets/search-page.js`, `assets/dashboard-page.js`), tests, tools, docs and drafts 29–30 (not installed); **no workflow file**.

| Change | Who notices | Needs SQL first? |
|---|---|---|
| Wide tables are cards on phones | Everyone on a phone | No |
| Request keys on every create form + escalation once (switch) | Nobody until the switch is on | Yes: drafts/19 then drafts/27 |
| Lost-reply messages say whether pressing again is safe | Owner, staff | No |
| Home "Nightly integrity check" card | Owner/admin: "Not set up yet" until installed | Yes for results: drafts/25 then drafts/29, then its switch |
| Feature request Add button works after the first add (X10-01) | Owner | No |
| Evidence without a file no longer reports a failure after saving (X10-02) | Owner, staff | No |
| Unreadable amounts show "—" instead of $0.00 (X10-03) | Owner | No |
| change-password, search and dashboard pages: no inline script, strict policy | Nobody (invisible) | No |
| Home checks say "Next step"; new checks: low-stock level not set, retired products with stock, agents unhealthy / unknown | Owner, staff | No |
| Agents off on purpose show "Off — on purpose"; an unreadable schedule shows Unknown, not Stale (X10-14) | Owner | No |
| Receive whose reply was lost: "Receipt status unknown — do not press again" + read-only "Check this order now" (X10-13); received line short of stock says so (X10-12) | Owner, staff receiving | No |
| System status card on Continuity + "Copy diagnostic summary" | Owner | No |
| Switches show ON/OFF and what they need first | Owner | No |
| Lists and pick-lists no longer stop silently at the database reply limit (X10-15) | Everyone with large data | No |
| Search/dashboard pages say so when the library is refused instead of going blank (X10-21) | Everyone (rare) | No |
| Tax export refuses while a newly picked period is still loading (X10-22) | Owner, accountant | No |
| Phone: check/approval/session rows stack instead of squeezing the text (X10-23) | Everyone on a phone | No |
| Phone: System status values wrap instead of running off the screen (X10-24) | Owner on a phone | No |
| Query H (drift check) + result interpreter tool | Owner (read-only, runs nothing) | No |

Helper file API is 9 (was 8); the page refuses a mix of old and new files. Rollback: revert the merge commit.


## 11. Extension 11 addendum (2026-10-11)

`claude/platform-ext11-final-readiness-2026-10-11` was created from the final EXT10 commit (`56a927c`), so it contains everything above. `main` is still `d3db7bc`. EXT11 changes page code (`owner-login.html`, `assets/owner-login-helpers.js`), tests, one tool and docs; **no SQL, no workflow file**.

| Change | Who notices | Needs SQL first? |
|---|---|---|
| Orders without a total are named on Home, Daily Summary, Accounting, Tax Records and in the tax export, never counted as $0 (X11-01) | Owner, accountant | No |
| Return Mark Received after a lost connection says whether it was saved and that the restock did not run (X11-02) | Owner, staff | No |
| Recall Quarantine after a lost connection, same (X11-03) | Owner | No |
| Report History shows "—" for a figure missing from a daily report; the week/month total is unknown too (X11-04) | Owner | No |
| A received return says "Chosen outcome: Restock to Available" instead of "Restocked to Available" (X11-06) | Owner, staff | No |
| System status: database steps installed / not installed / UNKNOWN and "Switch safety" (only while the page is open) | Owner | No |
| Interpreter: one-sitting read-only session summary, backup intake, evidence expiry | Owner (via Claude) | No |

Rollback: revert the merge commit.


## 12. Extension 12 addendum (2026-10-11)

`claude/platform-ext12-preproduction-simulation-2026-10-11` was created from the final EXT11 commit (`ad9a0ab`), so it contains everything above. `main` is still `d3db7bc`. **EXT12 changes no page code, no SQL and no workflow file**: only tests, local tools, `package.json` scripts and docs. Merging it changes nothing a user sees beyond EXT11.

| Change | Who notices | Needs SQL first? |
|---|---|---|
| `npm run evidence:interpret / intake / status / diff`: reads owner results; records sanitized lines in `docs/ops/evidence/ledger.jsonl` | Owner (via Claude) | No |
| `npm run deploy:sim`: rehearses a rollout order; refuses wrong orders; simulation only | Owner (via Claude) | No |
| `npm run incident`: incident cards and lookup by screen text | Owner, staff | No |

Rollback: revert the merge commit.

## 13. Extension 13 addendum (2026-10-11)

`claude/platform-ext13-owner-attention-final-audit-2026-10-11` continues EXT12 (`bd574df`). `main` is still `d3db7bc`. **No page code, no executable SQL, no workflow file changed.** Changes: owner documents and matrices, a comment-only note in `drafts/19`, dated correction notes, navigation lines on 30 old documents, `tests/tools/doc-check.js` + `npm run docs:check`, evidence intake fix (undated results are UNKNOWN), 8 decisions added to the intake, tests and mutants.

| Change | Who notices | Needs SQL first? |
|---|---|---|
| `npm run docs:check` | Claude sessions | No |
| Evidence intake refuses undated results | Owner (via Claude) | No |

Rollback: revert the merge commit.


## 14. Extension 14 addendum (2026-10-12)

`claude/platform-ext14-deep-engineering-2026-10-11` continues EXT13 (`cc9a142`). `main` is still `d3db7bc`. Page code frozen at `3a40095`. Details: `ENGINEERING_REPORT_EXT14.md`.

| Change | Who notices | Needs SQL first? |
|---|---|---|
| Owner page program loaded from `assets/owner-login-app.js`; no inline scripts except one hashed boot line | Nobody, if it works; a plain "program did not load" message if the file fails to load | No |
| Diagnostic summary: an unknown role value reads "other (not a standard role)" | Owner, when copying the diagnostic summary | No |
| `.github/workflows/ci.yml`: tests on pull requests and `claude/**` pushes; no secrets, no deploy | Owner and Claude (✓ / ✗ on pull requests) | No |
| `drafts/11` refuses while a stock switch is ON; `drafts/13` reports missing totals; new `drafts/31` | Owner, only when installing SQL | — (drafts only) |
| `npm run sql:lint`, `sql:graph`, `sql:headers`, `status:check`, `ci:local`, `db:suite`, `secrets:scan`, `staging:build` | Claude sessions | No |

Rollback: revert the merge commit (removes the workflow too).
