# Health Endeavors — current state (cross-project summary)

**Last updated:** November 27, 2026, early morning (§1: #137–#139 merged; steps 0, A and A2 installed and verified; settings shared by every device work in production). Before that: November 26, 2026, late night (§1: #130–#134 and #136 merged; steps 18 and 19 installed and verified, the first database steps in production; Supabase Pro with the spend cap on). Before that: November 26, 2026 (§1, §4, §5, §8, §9: #112–#115 and #117–#119 merged on the evening of Nov 25 and just after midnight; the owner's Nov 25 answers; nothing installed). Before that: November 25, 2026 (§1, §4, §5, §8: #110 merged in the afternoon with #102–#109 inside it; nothing installed). Before that: November 24, 2026 (§1, §4, §5, §8, §9: PR #85 merged in the evening with #56–#84 inside it; live check by the owner still to come; the owner's open decisions). Before that: November 23, 2026, evening (§1, §4, §5: PR #36 merged and checked live). Earlier Nov 23: §5, §8, §9 (PR #36 carries everything; Nov 23 decisions). Before that: November 15, 2026 (Nov 7 build). Internal-platform entry point: `docs/ops/START_HERE_EXT14.md`. **Keep this short.** Details live in the linked documents; update this file whenever the verified state changes materially.

Labels: **CURRENT** (verified in a repository or workspace) · **REPORTED** (from the owner's earlier chats, not re-checked) · **PROPOSED** · **OWNER DECISION REQUIRED** · **DEPRECATED**.

| Topic | Authoritative source |
| --- | --- |
| Internal platform in detail (features, evidence, bugs R1–R10, history) | [PROJECT_RECORD.md](PROJECT_RECORD.md) |
| Progress per work area, with percentages | [health-endeavors-progress.md](health-endeavors-progress.md) |
| Standing rules for Claude sessions | [`CLAUDE.md`](../CLAUDE.md) (PR #5) |
| Public website | Separate local workspace, `docs/website/README.md` there (see "Public website" below) |

## 1. Internal platform (the dashboard)

- **CURRENT (Nov 26, 2026, night, Central), read this first:** `main` is at `af8a012` and is the
  live dashboard. Since the late evening the owner merged #130 (four lists keep what is being typed),
  #131 and #133 (CI in four even groups), #132 (notes) and #134 (Purchase Orders keep what is being
  typed). **First database steps installed in production: step 18** (drafts/68, the history
  functions' search path) **and step 19** (drafts/70, the empty backup reports table), run by the
  owner and verified read-only on Nov 26. Every other draft is still not installed. Next for backups:
  the owner's step in the backups repository, then the switch "Backup status on Home".
  Later that night: #136 merged (`af8a012`: the printer test page fits one sheet); the Brother printer
  is set up on the owner's Mac; the 12:02 AM daily print timer is set up and switched off until launch;
  Supabase plan confirmed: Pro, spend cap on.
- **CURRENT (Nov 27, 2026, night, Central):** `main` is at `2aca253`. Merged by the owner since the morning: #141, #142, #143, #145 (settings shared by every device are now the rule), #146, #144, #148, #149, #147, #152. **#145 checked live by the owner** (about 6:54 PM: menu shows at once, Feature Flags normal, Real profit On, Packing slips Off); the phone is not yet checked. Nothing new installed in the database. Open for the owner: #150, #151, #153, #154, #155 (tests and notes only; #150 carries the history rows of all five). Details: `docs/PROJECT_RECORD.md` §9.
- **Earlier (Nov 27, 2026, morning, Central, owner asleep):** nothing new merged or installed. Open for the owner, in merge order: #141, #142, #145, #146, then #143 (after #142) and #144 (any time) (owner list: `docs/ops/MORNING_LIST_2026-11-28.md`). Final run on `c4cc136`: 4,024 passed, 0 failed, 901 skipped; database suite 61/61. Readiness, frozen (`docs/ops/READINESS_LEDGER.md`): business ≈42%, dashboard ≈59%, storefront ≈21% (website REPORTED).
- **Earlier (Nov 27, 2026, early morning, Central):** `main` is at `c0143f6` after #138 (CI fix) and
  #137 (step 0 and eight waiting drafts adjusted to the real database). **Step 0 installed in production
  and verified read-only** (drafts/72: `is_active_staff()` and `active_role()`, both with the caller's
  rights). Later: **step A installed and verified** (drafts/50, `true | 0 | 1 | false`), but the first save
  was refused by production's history recorder (`record "new" has no field "id"`; nothing changed): the
  recorder writes each row's `id`, which the settings table lacks. "Settings shared by every device" is
  back off, so switches stay per browser. Then (after 4 AM): #139 merged (`6988cdb`), **step A2 installed
  and verified** (drafts/74, `uuid | 0 | 1`), "Settings shared by every device" turned on again, and the
  first shared save worked (one row `feature_switches`, 2 history rows); the Real profit estimates saved "for every phone and computer". Installed so far: steps 0, 18, 19,
  A and A2. Next: the owner's phone (turn the same switch on there), then the small update that makes the
  shared settings the rule for every device.
- **Nov 26, 2026, late evening:** `main` was at `a8b2517` and is the
  live dashboard. Since the evening: #127, #128, #126 (Incidents and the redraw correction) and #129
  (Business Rules). Open: #130 (four lists keep what is being typed) and #131 (tests: even CI
  groups); Purchase Orders follow #130. Eighth full run on `19a4bc5`: 3951 passed, only the local guard
  failed.
- **Nov 26, 2026, evening:** `main` was at `19a4bc5`. During Nov 26 the owner merged #120 and #121 (tests; rollback practice, email sender and
  legal-page guides), #123, #124 and #125 (typed notes, own events and inquiry replies survive a
  redraw) and #122 (Ready to launch: rollback practice line). Open: #126 (Incidents, plus a correction
  to the redraw fixes) and #127 (tests only). Monthly costs: `docs/ops/MONTHLY_RUNNING_COSTS.md`.
  Backups: nightly green Nov 26, minutes OK; restore test not yet reported.
- **Nov 26, 2026 (early morning):** `main` was at `c60e07e`.
  From the evening of Nov 25 to just after midnight (Central) the owner merged #112 (managers approve
  supplier documents), #113 (managers decide deliveries and returns someone else recorded, the owner's
  choice A), #114 (database drafts 68/69: three history and sign-in functions name `pg_temp` last),
  #115 (the weekly report's profit line), #117 (records), #118 (backup status on Home: drafts 70/71
  and a Home line behind the preview switch "Backup status on Home") and #119 (guide for database
  steps 18 and 19). **Every database draft is still not installed**, so the live dashboard behaves as
  before until each draft's sitting. The owner's emergency-account check is done.
  History: `PROJECT_RECORD.md` §9.
- **CURRENT (Nov 25, 2026), read this first:** `main` is at `f173b97` and is the live dashboard. On
  Nov 24 evening and Nov 25 the owner merged #51, #86, #87, #88, #100 (administrators run email
  campaigns too), #93, #101 (the one People-page safety exception) and, at about 2:14 pm Central,
  **#110, which brought in #102–#109**: administrators approve deliveries and returns, supplier
  documents and stock-count corrections; managers do what employees can; the owner-protection map
  and the complete install index; one shipping email per order and the end-to-end rehearsal; two
  devices never erase each other's settings. Two full local test runs on the combined code found no
  real failures. **Every database draft is still not installed**, so the live dashboard behaves as
  before until each draft's sitting. Status of the owner's Nov 25 queue: `PROJECT_RECORD.md` §3b.
- **Nov 24, 2026 (kept for history):** `main` was at `e08ec8c` and is the live dashboard. The
  owner merged PR #36, then #37, #45 (which contains #38–#44) and #55 (which contains #46–#54), all on
  Nov 23, and checked the live site after the last one. Everything built since was **merged by the owner on Nov 24 at about 6:03 PM Central (merge commit `1f86df0`)**, live check by the owner still to come: PR #85 contained #56–#84 (the owner's requests of Nov 24: shorter menu, printing, agents
  at a glance, Store Campaigns, Customer Emails, Content Helper, store finder, drafts on every device,
  the email sending records as a database draft, personal settings on every device, a "Handled" button for agent hand-offs, copying an approved customer email, a Reviews page and its database draft). Every new page
  is behind a switch that is off. **No SQL was run: every database draft is still not installed**, and
  **nothing sends an email or a text.** Item by item: `docs/ops/BUILD_TRACKER_2_WEEKS.md`.
- **Nov 23, 2026, evening (kept for history):** **PR #36 is merged into `main`** (merge
  commit `b4ebb4b`) and **live**: the owner checked it on the computer (light and dark) and the
  iPhone (light, dark, menu). It contains every piece of branch work listed in this section, from the
  October extensions to the November build, and every earlier PR (#5–#35, now closed, not deleted).
  Everyone has the Aurora look; every new feature is still behind its switch, off; no SQL was run, so
  every database draft is still not installed. The bullets below are the history of how that work
  was built (dated, kept for reference; where they say "not merged", that was true on their date).
- **CURRENT:** the owner dashboard (`owner-login.html` + 5 other pages) on GitHub Pages from `main`, backed by the production Supabase project (public anon key + staff login + row-level security).
- **REPORTED:** broad operations features are live: orders, inventory with batch/lot tracking, purchase orders, returns, recalls, quality control, adverse event reports (15-business-day deadline), legal holds, customer inquiries, accounting and tax records, tasks, calendar, employee activity, audit log, security pages, and agents #4/#5/#6 running hourly in Supabase. See PROJECT_RECORD §2.
- **Branch work (not merged, not live), Oct 5–6:** `claude/platform-overnight-implementation` holds the Query A fixes, hardened R1–R5 stock-function drafts (tested locally only) and the state-machine, stale-tab, storage, scale, XSS, accessibility and empty-database audits, each with fixes and tests. Query B ran clean; no existing data repair is required. Queries C and D are prepared, not run. See `docs/ops/OWNER_REVIEW_2026-10-06.md`.
- **Extension 3 (Oct 6, not merged, not live):** `claude/platform-overnight-extension-3`, branched from the above at `37050c6`. Second-pass audit and fixes, all with tests:
  - Expenses totals were cut at 200; open returns were cut at 200.
  - A manual order retry could create a duplicate order.
  - A tab signed out elsewhere kept showing the dashboard.
  - A sold product could be deleted.
  - Search Enter opened the Guide instead of the page.
  - Raw error text leaked; some number inputs were unchecked.
  - Also added: a state-machine rule in every test, a failure-injection matrix, a role matrix and a scale matrix up to 20,000 rows; stress at 25 scenarios; mutation checks for the page and SQL; Query C v3 (runs without pg_cron, adds audit coverage) with an owner guide; an R1–R5 install preflight with package tests; and the readiness checklist.
  - See `docs/ops/OVERNIGHT_PLATFORM_EXTENSION_3_2026-10-06.md`.
  - Query C still not run, Query D not run, R1–R5 not installed, production untouched, Shopify Order Sync off.
- **Extension 4 (Oct 6, not merged, not live):** `claude/platform-deep-readiness-extension-4`, branched from extension 3 at `3d5f1cc`. Deep-readiness pass, every fix with tests:
  - Manual orders: retries now need an exact match; two tabs in the same second no longer merge; the attempt survives a reload.
  - Delivery expenses and the Accounting "Last 7 days" figure use the Central calendar day. A delivery received after 7 pm on the 30th used to land in the next month.
  - Emergency mode always tries to switch off Order Sync and pause Agent #7, even if the mode itself cannot be recorded.
  - Totals saved to the database are whole cents; refund amounts are checked; a stale feature-request button can no longer jump to done.
  - Gateway error pages and cut-off replies get plain words; lists at the 1,000-row server limit say they may be incomplete.
  - Accessibility: skip link and keyboard focus kept inside dialogs. The palette lists pages, then records, then Guide.
  - New gates: a write-path inventory, mock-vs-schema drift, numeric contract, error language, and runbook/Query C checksum checks.
  - Mutation testing: 47 page and 10 SQL mutations.
  - Database drafts (local only): R1 expense rounded to cents and a column-type preflight (new fingerprint `3df2bf7a07b451f12f9359ceca1c85df`). Also a new draft guard (17/18) for a PO-line-vs-receive race found in stress, and stress S26–S29 with data-integrity invariants.
  - See `docs/ops/DEEP_PLATFORM_EXTENSION_4_2026-10-06.md` and `docs/ops/OWNER_DECISIONS_NEXT.md`.
  - Query C still not run, Query D not run, R1–R5 and the guard not installed, production untouched, Shopify Order Sync off.
- **Extension 5 (Oct 6, not merged, not live):** `claude/platform-deep-readiness-extension-5`, branched from extension 4 at `82c2582`. Every fix has tests that fail on the old code:
  - Receive now uses the saved order: another tab's line or shipping changes were ignored. In-flight line edits are reported on both sides.
  - Money totals no longer double-count a record created mid-read; Employee Activity no longer repeats rows.
  - Manual orders: a retry never adopts a same-number order, and orders saved without items are listed on sign-in.
  - Inquiry reply drafts no longer overwrite each other; unreadable number text gets a clear message; no customer details kept in browser storage.
  - Database drafts (local only):
    - the PO line guard now also covers adding a line and changing a quantity (each broke the match in 5–6 of 20 races, even with R1)
    - the install survives a double Run
    - install tests 61, forced race orderings, SQL mutations 11
  - Evidence: failure matrix 14 actions × 14 failure kinds, state machines from one fixture, 57 page mutations.
  - Final verification: the full suite has 1,990 tests (1,329 passed, 660 skipped by design). Its one failure was a test-timing mistake, fixed and repeated clean. 57/57 page mutations caught; database checks all pass. Details in §6 of the report.
  - See `docs/ops/DEEP_PLATFORM_EXTENSION_5_2026-10-06.md`, `PO_RECEIVE_RACE_REVIEW.md`, `READINESS_GATE.md`.
  - Query C/D not run; R1–R5 and the guard not installed; production untouched; Shopify Order Sync off.
- **Extension 6 (Oct 7, not merged, not live):** `claude/platform-deep-readiness-extension-6`, branched from extension 5 at `ae8e9aa`. Extension 5 was re-verified clean on its own commit (1,990 tests, 0 failed; every skip accounted for). Fixed with tests that fail on the old code:
  - **Revenue figures (live on `main`):** Daily Summary and the home tile counted cancelled / refunded orders; Orders "Total revenue" covered only the newest 300 orders; zero showed "-$0.00".
  - **Shared computer (live on `main`):** signing out left the previous person's data in the page.
  - Manual-order recovery could create a second order; Emergency mode, error wording and other smaller fixes.
  - Drafts, not installed: PO line guard revised (now protects today's receive and needs no R1 first), request keys, Query E.
  - **Security note:** this session's GitHub connection has admin rights (owner decision X6-17); they were not used.
  - Final verification on the final code: 2,138 tests, 1,414 passed, 0 failed (every skip deliberate); 66/66 page mutations and 13/13 SQL mutations caught; database checks clean (stress 5 × 98).
  - See `docs/ops/DEEP_PLATFORM_EXTENSION_6_2026-10-07.md`, `PRODUCTION_READINESS_MATRIX.md`, `CUMULATIVE_CHANGE_INVENTORY.md`.
- **Extension 7 (Oct 7, not merged, not live):** `claude/platform-deep-readiness-extension-7`, branched from extension 6 at `444e00c`. Fixed with tests that fail on the old code:
  - **Tax Records (live on `main`):** "sales tax by state" split one state into several rows; the cost estimate missed SKUs typed in a different case. Checked now against an independent calculation.
  - **Open work hidden (live on `main`):** Tasks, Approvals and Incidents could hide open items once enough closed ones existed.
  - **Shared computer:** a different person signing in in another tab left the previous person's data in the open tab (dashboard and order page).
  - Unknown service status showed as "Operational"; one failed read blanked Business Health; unsaved typing was lost silently; a money figure could freeze mid-animation; SOP switch and supplier duplicates.
  - New for the owner: Recently finished tasks with a guarded Reopen; "?" per Business Health tile; work tiles open their page; "not saved yet" question.
  - Evidence: write-path inventory with retry classes (0 unresolved); randomized R1–R5 stress (no guard 75/300 rounds broken, guard 0/300); role matrix; agent/automation proposals (nothing installed); screenshots in `design-review/dashboard-extension-7-2026-10-07/`.
  - **Security:** the GitHub credential is still admin and can bypass `protect-main` (X6-17, `docs/security/GITHUB_CREDENTIAL_ADMIN_FINDING_2026-10-07.md`). Not used.
  - Final verification on the final code: 2,216 tests, 1,465 passed, 0 failed (0 unexplained skips); high-risk ×3 0 failed; 82/82 page and 13/13 SQL mutations caught; database tests and stress (5 × 98) clean. Details: `docs/ops/DEEP_PLATFORM_EXTENSION_7_2026-10-07.md` §9.
- **Extension 8 (Oct 7–10, not merged, not live):** `claude/platform-deep-readiness-extension-8-2026-10-07`, branched from extension 7 at `f868903`. Fixed with tests that fail on the old code (all live on `main`):
  - waiting customer questions hidden behind answered ones; returns only for the newest 200 orders; search missing older orders; recycle bins / histories cut at 50; evidence picker missing old open incidents
  - browser Back leaving the dashboard; Back-button cache after sign-out; "This Week" meaning two windows
  - product edits and PO shipping/tax overwriting a newer save; slower old replies drawing over newer ones (5 pages); missing Content-Security-Policy on 5 pages
  - New for the owner: Home **"Checks: what needs a look"** (17 deterministic checks; "could not check" never shown as fine; backups always UNKNOWN), older-order finders, Show more, page history and deep links.
  - Prepared, not run: **Query F** (read-only daily integrity check). Local restore drill 6/6. Staging review copy built on synthetic data; publishing it needs an owner choice (`docs/ops/STAGING_REVIEW_PLAN.md`).
  - **Security:** GitHub credential still admin (X6-17); recommended `stasvitiuk-reos` with Write role. Not used.
  - Report: `docs/ops/DEEP_PLATFORM_EXTENSION_8_2026-10-07.md`.
- **Extension 9 (Oct 10, not merged, not live):** `claude/platform-deep-completion-extension-9-2026-10-10`, built on extension 8 (`8aa24a9`).
  - Stock buttons (receive, recall, return, adjust, delete product) are ready to use the all-or-nothing database functions R1–R5, **one switch per button, all off**; a switch cannot be turned on before its function is installed. Same pattern for duplicate-proof creates (request keys) on 5 forms.
  - Fixed: calendar notes/events overwritten by another tab; currency warnings shown on the wrong page; older expenses unreachable; dashboard could be shown inside another site's frame; Home checks looked current when hours old; CSV formula edge cases.
  - Prepared (not run/installed): Query G (permissions inventory), integrity rules (draft 23), nightly Query F (draft 25), switch rows (drafts 21, 27), each with rollback and a local test.
  - Owner one-pager: `docs/ops/OWNER_UNBLOCK_CENTER_EXT9.md`. Report: `docs/ops/DEEP_PLATFORM_EXTENSION_9_2026-10-10.md`.
- **Extension 10 (Oct 11, not merged, not live):** `claude/platform-ext10-operations-hardening-2026-10-11`, built on extension 9 (`f9e4850`).
  - Phones: wide tables (tasks, orders, PO lines, incidents, AI log, report history, tax receipts) are one card per row.
  - Every create form (18) can refuse duplicates after a lost reply once request keys are installed and switched on; escalating to an incident happens at most once.
  - Home: "Nightly integrity check" with PASS / WARN / FAIL / STALE / NOT VERIFIED; shows "Not set up yet" until drafts 25 + 29 are installed and its switch is on.
  - Fixed: Feature request Add button stuck after the first add; evidence without a file reported a failure after saving; unreadable amounts shown as $0.00.
  - change-password, search and dashboard pages run without inline scripts (strict policy).
  - Second EXT10 mission: each Home check says the next step; new checks (low-stock level not set, retired products with stock, agents unhealthy / unknown); agents switched off on purpose say so; a receive whose reply was lost locks with "Receipt status unknown" plus a read-only "Check this order now"; System status card on Continuity with a copyable diagnostic summary; switches show what they need first; pick-lists and lists no longer stop silently at the database reply limit; read-only drift check Query H prepared.
  - Fixed later in EXT10: received order claimed "stock added" though lines were short (X10-12); Receive offered again after "do not press again" (X10-13); unreadable schedule shown as stale (X10-14); silent truncation at the reply limit (X10-15); search/dashboard blank when the library was refused (X10-21); tax export mislabelled a period (X10-22); phone rows squeezed their text (X10-23); System status cut off on phones (X10-24). Eleven real problems fixed in EXT10 in total.
  - Operations entry point: `docs/ops/OPERATIONS_CENTER_EXT10.md`.
  - Owner one-pager: `docs/ops/OWNER_UNBLOCK_CENTER_EXT10.md`. Report: `docs/ops/DEEP_PLATFORM_EXTENSION_10_2026-10-11.md`.
- **Extension 11 (Oct 11, not merged, not live):** `claude/platform-ext11-final-readiness-2026-10-11`, built on the final EXT10 commit (`56a927c`); its draft PR replaces EXT10's #26.
  - Fixed: orders without a total counted as $0 in revenue (X11-01); return receive and recall quarantine after a lost connection said "nothing was changed" when the save may have happened and the stock step had not run (X11-02, X11-03); report figures missing from a daily report shown as 0 (X11-04); a received return labelled "Restocked" when the restock had not run (X11-06).
  - System status now shows which database steps are installed and flags a switch that is ON without its step; tested that merging the code before any SQL is safe.
  - Owner entry points: `docs/ops/OWNER_UNBLOCK_CENTER_EXT11.md` and `docs/ops/PRODUCTION_READINESS_BOARD_EXT11.md` (why production is ~15% and the exact order to fix it). Report: `docs/ops/DEEP_PLATFORM_EXTENSION_11_2026-10-11.md`.
- **Extension 12 (Oct 11, not merged, not live):** `claude/platform-ext12-preproduction-simulation-2026-10-11`, built on the final EXT11 commit (`ad9a0ab`); its draft PR #28 replaces #27. **No page code changed** (dashboard files identical to the EXT11 frozen commit `32c05e2`).
  - New local tools (connect to nothing): an evidence intake that reads every result the owner sends back and labels it honestly (environment required, secrets refused, staleness, conflicts); a deployment simulator that rehearses the rollout and refuses wrong orders; an incident map in the page's own words.
  - Owner entry point: `docs/ops/START_HERE_EXT12.md`. No production evidence has arrived yet; production readiness unchanged at ~15%.
- **Extension 13 (Oct 11, not merged, not live):** `claude/platform-ext13-owner-attention-final-audit-2026-10-11`, continuing EXT12 (draft PR #28). **No page code changed.** Final audit (SQL, stock functions, PR #28, history secret scan), one owner-tool bug fixed (undated evidence), the decision list consolidated to 24 with conflicts flagged, stale documents marked, and one owner attention session: `docs/ops/OWNER_ATTENTION_SESSION_EXT13.md`. Four owner actions (backup look, GitHub reconnect, read-only session, merge) would take production readiness from ~15% to ~53%.
- **Extension 14 (Oct 11–12, not merged, not live):** `claude/platform-ext14-deep-engineering-2026-10-11`, continuing EXT13; draft PR #29 (contains #28). Engineering round. The owner page's program moved into `assets/owner-login-app.js` (page 617 KB → 58 KB, strict script policy). A tests-only GitHub workflow was built (inactive until merged). The SQL package is organized and machine-checked, with volume, index and scale evidence measured locally. A private staging copy now has 12 scenarios. 6 problems were fixed, including a diagnostic-summary leak, drafts/13 missing totals, the drafts/11 switch guard, and a secret check that had failed unnoticed since EXT12. Production readiness unchanged (~15%). See `docs/ops/ENGINEERING_REPORT_EXT14.md`.
- **Extension 15 (Oct 12, not merged, not live):** `claude/platform-ext15-modularization-csp-2026-10-12`, continuing EXT14 (successor draft PR, contains #29). The owner program was split into 16 modules (moved unchanged, proven by a tool); the owner page no longer allows inline styles; GitHub CI was found never to have passed on PR #29 and now runs green; the intermittent CI database failure was explained (test harness) and fixed. 4 honesty fixes (nightly blank count, unclear agent switch, AI spend read, offline bar blocking the menu). Production readiness unchanged (~15%). See `docs/ops/RELEASE_REVIEW_EXT15.md` and `docs/ops/CURRENT_PLATFORM_STATE_EXT15.md`.
- **Extension 16 (Oct 12, not merged, not live):** `claude/platform-ext16-overnight-systems-hardening-2026-10-12`, continuing EXT15 (successor draft PR). All six dashboard pages now refuse inline styles and scripts; PO receiving runs through an explicit safety state machine; two more page areas moved into modules; failing random tests shrink automatically. A rare deadlock in a draft database function (not installed) was found on GitHub, reproduced and explained; its fix is the first EXT17 item. 17 stale mutation checks were repaired. Production readiness unchanged (~15%). See `docs/ops/RELEASE_REVIEW_EXT16.md` and `docs/ops/CURRENT_PLATFORM_STATE_EXT16.md`.
- **Extension 17 (Oct 12, not merged, not live):** `claude/platform-ext17-deep-reliability-2026-10-12`, continuing EXT16. Three draft database problems fixed (rare deadlock, empty order, below-zero message; new reviewed fingerprint `f6d9c2c8be690710eeb721041f6779d9`), a stock adjustment double-count after a lost reply fixed, sidebar made robust to broken browser storage; much longer testing (1,000-step chaos, 60-minute soak, database property model). Production readiness unchanged (~15%). See `docs/ops/RELEASE_REVIEW_EXT17.md` and `docs/ops/CURRENT_PLATFORM_STATE_EXT17.md`.
- **Extension 18 (Oct 13, not merged, not live):** `claude/platform-ext18-security-reliability-2026-10-12`, continuing EXT17. Defensive security round: five real bugs fixed (values named like JavaScript built-ins in tax, accounting and cost reports; a misleading "not sent" note after a sign-out elsewhere), script policy narrowed to the one pinned library file, new security gates in CI, local database access-rule contract. Production RLS still UNKNOWN (Query G). Production readiness unchanged (~15%). See `docs/ops/RELEASE_REVIEW_EXT18.md` and `docs/ops/SECURITY_ARCHITECTURE_EXT18.md`.
- **Extension 19 (Oct 13, not merged, not live):** `claude/platform-ext19-preproduction-completion-2026-10-12`, continuing EXT18. One real bug fixed ("changed by" names never shown: wrong column name), schema contract and stricter mock, half the raw-HTML sites gone (Trusted Types reports 168 → 86), whole program type-checked, high-risk operation contract. Production readiness unchanged (~15%). See `docs/ops/RELEASE_REVIEW_EXT19.md` and `docs/ops/PREPRODUCTION_GAPS_EXT19.md`.
- **Extension 20 (Oct 17, not merged, not live):** `claude/platform-ext20-adversarial-completion-2026-10-13`, continuing EXT19. Real performance bug fixed (search palette forced a whole-page layout and built every match per keystroke), both open EXT19 intermittents closed with reproduced causes, raw-HTML sites cut again (Trusted Types 86 → 56), exactly-once proven under truly simultaneous database callers, Query G now answers the audit questions F1/F2. Production readiness unchanged (~15%). The owner's single next step: run read-only Query G. See `docs/ops/OWNER_ACTIONS_EXT20.md` and `docs/ops/RELEASE_REVIEW_EXT20.md`.
- **Nov 7 build (Nov 2–14, not pushed, not merged, not live):** local branch `claude/ext20-recovery-2026-10-31` from `9173ccf` (112 commits at `5bce21f`), synthetic data only, every new feature behind a switch that is OFF by default, nothing sent. **Not behind a switch, by design:** the control and form styling the owner directed on Nov 3 (square buttons and fields, labelled forms, right-aligned number columns, original colours kept) — the dashboard will look different as soon as this branch is merged; the owner's final look-over of the result is still open.
  - Operations: Scan Shipment flow, reorder planning, report export preview, recovery drill, invoice drafts with print views.
  - Sales & Growth (54 draft-only pages): adds in-person sample visits, content repurposing, ad variants, feedback analysis with complaint trends, creator sample offers, reorder reminders, service health with manual-fallback readiness.
  - Original blueprint items built and tested on the branch: #08, #12, #17, #21, #25, #26, #27, #53, #54, #55, #65, #70, #71, #72 (plus #24 / #36 as documents). All except #17 are reachable as dashboard screens with browser tests (each behind its own OFF switch); #17 (request limits) is tested logic only, because the form it protects belongs to the public website project. Later on Nov 14 the tax, payment-terms and day-cutoff decisions were also built into the invoice and report logic itself — for example, a draft invoice whose tax rate is still pending cannot be issued.
  - Tests: full desktop suite on Nov 9 was 2,138 passed / 14 failed — 10 picture comparisons that cannot pass in the substitute test browser, and 4 real check failures fixed on Nov 14. (Earlier notes said 0 failed; that was wrong.) 95 further tests added since, passing when run on their own; Full re-run on Nov 14: 2,239 passed / 16 failed / 46 skipped — 10 picture comparisons, 5 stale auto-generated documents (since fixed) and 1 timing failure that passed 3 of 3 alone; record in `docs/ops/NOV7_BOUNDED_REVIEW.md`. Final full pass that evening (`aa81876`): computer size 2,285 passed / 10 failed, phone size 505 passed / 11 failed — only picture comparisons and one timing test that fails the same way on the untouched base. The owner can now turn each preview on and off with buttons on the Feature Flags page (this browser only). iPhone-size results and their limits: `docs/ops/NOV7_BOUNDED_REVIEW.md`. Real Safari / iPhone / VoiceOver not tested.
  - **Nov 15 (same branch, same limits; 147 commits at `6640afe`):** simulated invoice review desk (confirm the local rate, issue, void); the sales path checked end to end with the real modules (two faults found and fixed) and made runnable on one screen, the Outreach workbench (saved in this browser, with a reset; send is simulated); the dashboard side of invoice storage, tested against the database draft but not connected to any screen; the database draft for invoices now keeps who is billed and the tax choices (still not installed); the export label names the signed-in person; keyboard and screen-reader fixes (Scan Shipment dialog, nine redrawn sections); no accidental crash left in the Sales & Growth modules on malformed input. Also fixed: very long pasted text no longer freezes any table at phone size (a cell draws the first 600 characters and says how much is hidden; saved data untouched), the quick-reminder box no longer loses the first key, and every dialog now takes keyboard focus when it opens (three did not). **Nov 16:** the left menu can be used from the keyboard (its page links could not be reached with Tab), and a very long account name no longer pushes the page sideways; sweeps of all 26 pages for mouse-only controls and for very long text found nothing else. Latest full pass at `88db1fe` (quiet machine): computer size 2,431 passed / 10 failed, phone size 513 passed / 10 failed — only the 20 picture comparisons that wait for the owner's decision on the look; the long-standing timing failure is gone because its cause was fixed. Details: `docs/PROJECT_RECORD.md` (Nov 15 row), `docs/ops/NOV7_STAGING_BACKLOG_STATUS.md`.
  - **Nov 16 (owner decisions of Nov 16; same branch, same limits):** tax PENDING until confirmed (never a built-in rate, never 0 for unknown) on invoices, the review desk and print; owner-only stock-count approval enforced in database draft 34 (not installed); supplier document checklist by kind of supplier (read-only example); review pages for SQL draft 32 and Query I; visual details fixed; add forms checked against failed saves and double clicks. Details: `docs/PROJECT_RECORD.md` (Nov 16 rows), `docs/ops/NOV7_STAGING_BACKLOG_STATUS.md`.
  - **Nov 16, later (same branch, same limits):** supplier document storage (drafts/36, owner-only review enforced by the database, connected to Suppliers behind a switch, not installed); tax-pending sweep; three separate SQL review items (`docs/ops/sql-review/`); stock count applied once and export restore across the Chicago cutoff proven locally; two bugs fixed (a printed draft showed an invoice number; a restored export with an unknown figure could not re-verify). Evidence: `docs/ops/BLUEPRINT_PRIORITIES_2026-11-16.md`. Full pass and preview link: `docs/ops/NOV7_BOUNDED_REVIEW.md`, review package.
  - **Nov 21–22 (same branch, same limits):** supplier documents per the owner's Nov 21 decision (hand-off to the owner for orders staff cannot see; owner-only private files, drafts/38; administrator approval off); partial receiving and returns as a worked example behind a switch for the D-ops-5 review (no stock written); a backup restored with the pending drafts keeps every protection; push review against `main` with the 20 picture differences explained and the palette decision; four separate SQL review items; first five device checks; the iPhone Duo (folding iPhone) checked at nine widths, with one menu fix. Full pass at `fd6eb97`: computer size 2,561 passed / 10 failed / 66 skipped; phone size 546 passed / 10 failed / 458 skipped — the only failures are the 20 picture comparisons that wait for the owner's look review. Evidence: `docs/ops/PUSH_REVIEW_2026-11-21.md`, `docs/ops/BLUEPRINT_PRIORITIES_2026-11-16.md` (Nov 22 additions).
  - **Nov 22 (same branch, same limits):** invoice drafts 32/33 revised after the owner's review (audit, validation, Net 14 on every path, numbering, permissions, safe install, rollback; 161 local checks); partial receiving and returns under the owner's Nov 22 rules as new drafts 40/41 (74 local checks) and in the Inventory-page example. Palette C1–C7 comparison page for the owner's choice per change. Blueprint counts 51 / 14 / 25 relabelled previously reported, awaiting reconciliation. Tax still pending. Evidence: `docs/ops/sql-review/ITEM_1_DRAFT_32_INVOICE_STORAGE.md`, `docs/ops/sql-review/ITEM_5_DRAFT_40_PARTIAL_RECEIVING.md`, `docs/ops/BLUEPRINT_EVIDENCE_CHECKLIST_2026-11-22.md`.
  - **Nov 23 (same branch, same limits):** a new look proposed as three directions behind a preview switch (Aurora, Graphite, Original+; owner to pick one, today's look until then), every text readable in each; print layouts for the owner's printers (Rollo 4×6 label slip, Brother black-only Letter; dark-mode printouts no longer use colour ink). Evidence: `docs/ops/NEW_LOOK_2026-11-23.md`, `docs/ops/PRINTING_GUIDE.md`.
  - **Nothing here is counted as done in the progress tracker** until it is merged and checked live. Review entry point: `docs/ops/NOV7_STAGING_REVIEW_AND_OWNER_CHECKLIST.md`.
- **Store not launched:** 0 real orders, real products not yet added, the Shopify order sync and agents #2/#3/#7/#8 switched off on purpose until products exist (REPORTED). Agent #1's on/off state is **unverified**.

## 2. Public website (customer storefront)

- **CURRENT (local only):** a Shopify Online Store 2.0 theme with working, tested code: complete homepage, product page with gallery, 360° photo viewer (synthetic frames) and related products, cart, search, forms with a server-side intake prototype, cinematic hero structure, degraded states (offline, broken images), policy page structure and a strict production-readiness gate that fails today on purpose. It lives in a **separate local workspace, not in this repository**, and is **not deployed**. Synthetic data only. Theme Check: 0 findings. Also contains an integration simulator and an end-to-end synthetic customer journey (one sale = one order/invoice/journal). Website ≈31% built (code ≈66%, visual implementation ≈35% provisional, staging ≈26%, launch ≈5%). A theme setting switches between preview mode (nothing sent) and Shopify mode (Shopify cart, search, recommendations and customer form). Shopify mode has not been verified in a real store.
- **Design:** TEMPORARY. Final colours, typography, photography and identity are to be chosen by the owner separately.
- **Content:** all placeholder; no product claims written. The legacy Sea Foam bottle is the real packaging. The current final INCI list is required from the manufacturer or lab before launch. Owner visual direction (premium, editorial, oceanic; possible whale secondary mark) is recorded as a decision to make, not a final design.
- **Owner review path:** local preview now → unpublished Shopify development-theme preview link → private staging → production domain, each only with owner approval.
- **Preservation:** dated ZIP + git bundle snapshots are sent to the owner as files, together with a whole-business `handoff/` package covering the dashboard and the website. A GitHub repository for it needs the owner's approval (proposed name `health-endeavors-website`, private).

## 3. Architecture (PROPOSED — OWNER APPROVAL REQUIRED)

- **Shopify custom theme** for the storefront (not headless). Shopify keeps cart, checkout, payments, customer accounts and order records.
- **Internal platform** stays the source of truth for physical inventory (lots, quarantine, recalls), fulfilment operations, returns handling, wholesale, accounting, complaints and quality.
- **The website never touches the internal database.** Forms go to a server-side intake endpoint (insert-only). Shopify events go to a server-side integration service with an idempotent inbox and a reconciliation poll, so a paid order can never be silently lost.
- The platform pushes only a *sellable quantity* to Shopify, and only after the stock functions are made all-or-nothing (R1–R4).

## 4. Important merged work (on `main`)

- **CURRENT (Nov 26, 2026, late evening):** latest `main` commit `a8b2517` (#129). Since `19a4bc5`:
  #127, #128, #126, #129 (see §1).
- **Nov 26, 2026, evening:** latest `main` commit was `19a4bc5` (#125). Since `c60e07e`:
  #120, #121, #123, #122, #124, #125.
- **Nov 26, 2026 (early morning):** latest `main` commit was `c60e07e` (#119). Since `f173b97`: #111, #112,
  #113, #115, #114, #117, #118, #119.
- **Nov 25, 2026:** latest `main` commit was `f173b97` (#110, containing #102–#109). Earlier on
  Nov 25: #101, #93, #100; on Nov 24 evening: #51, #86, #87, #88. Detail: `PROJECT_RECORD.md` §3b and §9.
- **Nov 24, 2026:** latest `main` commit was `e08ec8c`. Merged by the owner on Nov 23, in this
  order: PR #36, PR #37 (documents), PR #45 (contains #38–#44: fonts, previous look, tax-rate dates,
  product import, confirmed tax rates, attention feed, smart scan, delivery watch), PR #55 (contains
  #46–#54, among them the agent diary, real profit, the Feature Flags section for switches that save
  real records, and closing an incident with a note). The owner's live check after #55 passed.
- **Nov 23, 2026:** PR #36 ("Dashboard Nov 2026", everything from #5–#35 plus the November build), merged by the owner; latest `main` commit `b4ebb4b`. Live check by the owner passed (see §1). GitHub's test workflow (`.github/workflows/ci.yml`: tests only, mocked network, no secrets, touches no production system) came in with it.
- Earlier: PR #1 (access verification record), PR #3 (CODEOWNERS: owner reviews everything), PR #4 (automated dashboard test suite + code-quality review); `main` was `d3db7bc` (Sept 29).
- Earlier features were added before branch protection existed (REPORTED as live; task buttons v2 is the most recent).

## 5. Active development (open PRs)

**CURRENT (Nov 26, 2026, late evening):** open for the owner: #130 (Returns, Recalls, Quality Checks and
Inventory keep what is being typed) and #131 (tests only: fresh per-file times so GitHub's three test
groups are even), plus this notes PR. Purchase Orders (same helper) follow #130.

**Nov 26, 2026, evening:** open were #126 and #127, plus a notes PR (all merged that evening).

**Nov 26, 2026, early morning:** no open PRs for the owner; #119 was the last one, merged
just after midnight Central.

**Nov 25, 2026, afternoon:** no open PRs for the owner. #110 was merged with #102–#109
inside it; #104 and #105 were closed as already contained (merging either leaves `main` unchanged).

**Nov 24, 2026, evening:** **PR #85** was merged by the owner on Nov 24 at about 6:03 PM Central (merge commit `1f86df0`); it contained #56–#84, and GitHub
marked those merged with it. Still open for the owner: **PR #51** (documents only). Merging runs no
SQL. "Screenshots (informational)" shows red on these PRs and never blocks: its reference pictures
come from another machine. What each PR holds: `docs/ops/BUILD_TRACKER_2_WEEKS.md`.

**Earlier (Nov 23, 2026, night; these were merged the same evening):** open for the owner: #37 (documents only) and #42, which contains
every code change since the merge (#38 fonts, #39 previous look, #40 tax-rate dates, #41 product import,
#42 confirmed tax rates; all new features behind switches, off). Merging #37 and #42 merges everything;
GitHub then marks #38–#41 merged. No SQL is run by merging (draft 46 is review item 8).

**Earlier (Nov 23, evening):** PR #36 is merged and live (see §1 and §4); PRs #5–#35 are
closed (their work is in #36; nothing deleted). The paragraph below is how #36 was described before
the merge (kept for history).

**Before the merge (Nov 23):** one pull request carried everything:
[PR #36](https://github.com/StasVitiuk-dev/health-endeavors-order-entry/pull/36), branch
`claude/dashboard-nov-2026` (pushed with the owner's approval on Nov 23; draft).

- It **contains every other open PR, #5 to #35** (checked with git: each PR's head commit is an
  ancestor of #36's head). Merging #36 merges them all; afterwards #5–#35 can be closed as done.
- Every new feature is behind a switch that is off, except two owner decisions of Nov 23 that apply
  at the merge: **Aurora is everyone's look**, and the **branded printouts** (logo, EB Garamond +
  Source Sans 3, one plain signature line on the invoice).
- Database changes are separate SQL drafts in `docs/ops/sql/drafts/`; merging runs no SQL.
- Status of the final full test run and the merge steps: the PR description.

Older review branches (`claude/platform-overnight-*`, `claude/platform-deep-readiness-extension-*`,
`claude/ops-readiness`, `claude/tests-only-ci`) are DEPRECATED: all of their work is inside #36.

## 6. Known bugs and risks (top items)

**CURRENT (Nov 23, 2026):** the browser-side fixes for the items below ship with PR #36 when the
owner merges it. The database halves are separate SQL drafts, none installed: the stock functions and
guards (drafts 10–31, install order in `docs/ops/PRODUCTION_CHANGE_PACKAGE_EXT10.md`) and the
November review items 1–7 (drafts 32–45 and Query I, `docs/ops/sql-review/`). Each needs the
owner's separate approval and a guided run. The dated items below are kept for their history.

1. Stock can be double-counted or lost on retries or concurrent edits: R1–R4.
   - On `main`: unprotected.
   - On the overnight branch: protected browser-side (no double counting, no lost updates). A connection drop can still leave work half-done, so the all-or-nothing database functions are still needed: drafted, reconciled with Query A and tested locally (2026-10-06); they wait for Query C and the owner's approval to install. **Blocks** automatic Shopify stock sync.
2. Product delete wipes stock first (R5). The overnight branch refuses while stock remains. *Superseded 2026-10-06:* Query A has run and R5 is reconciled with it; extension 3 also refuses sold products and products with quality checks (`docs/ops/PRODUCT_LIFECYCLE_REVIEW.md`). The R5 install still waits for Query C and your approval.
3. Unescaped output on `search.html` / `dashboard.html` (R6): fix in PR #7, plus a broad XSS test on the overnight branch.
4. Supabase library unpinned (R7): pinned with an integrity hash on the overnight branch (not merged).
5. Approval, PO, return, recall, legal-hold, flag and agent-switch actions don't check the current state (main). Fixed on the overnight branch.
6. **New (Oct 5):** report totals undercount past 1,000 rows (N14), fixed on the branch. Refunds recorded on Returns don't reduce revenue (N4): owner/accounting decision.
6. Website risks once built: third-party apps and trackers (performance and privacy), unapproved claims, and placeholder text reaching production (a launch check will search for "PLACEHOLDER").

## 7. Safety boundaries (always)

No merging or deploying by Claude · no production Supabase, SQL, cron, RLS or permission changes · no Shopify production changes, Shopify/Gmail connectors only with task approval · no real customer messages · no secrets anywhere · no money/accounting logic changes in production · no destructive or irreversible actions · Health Endeavors and Real Estate OS stay completely separate · website code never in this repository.

**How to report to the owner (CURRENT, owner instruction, Oct 6, 2026):** the owner prefers detailed evidence in durable repository documents and concise, copy-friendly final chat responses. Put the full session report (evidence, test counts, bugs, decisions, rollback, SHAs, safety) in `docs/ops/`. Keep the final chat message to roughly 600–1,200 words in the owner's fixed structure: branch, SHAs, status, tests, fixes, findings, waiting on owner, weak spots, production / merged / deployed, report path, rollback, next action. Never leave out P0/P1, security, data-integrity, production or owner-decision items, or unresolved failures. Long chat replies are hard to copy, because the browser jumps while text is being selected.

## 8. Pending owner decisions (most important first)

**Updated Nov 24, 2026 (CURRENT, with the Nov 25 additions at the top).** Platform list in full: `docs/ops/NEXT_SESSION_CHECKLIST.md`.

0. **Nov 26 (CURRENT):** the owner answered most of the Nov 25 list on the evening of Nov 25:
   (a) the §B3 read-only look is done (owner-private history needs no draft); (b) managers approve
   supplier documents (built, #112) and decide deliveries and returns someone else recorded (choice A,
   built, #113); (c) administrators see nothing of the owner's history entries; (d) the platform's own
   shipping email stays as recommended. Still open: (e) **backups** in the short form (reminder set
   for Nov 26, 10 am Central); (f) the **database sittings** in the order of
   `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md` (steps 18 and 19 are small and need nothing first);
   one stock count; the business email; printers.
   Added by the owner on Nov 26 before launch: a **rollback practice run** (about 20 minutes with
   Claude, `docs/ops/LAUNCH_DAY_ROLLBACK_PRACTICE.md`); the **email sender settings** on the
   business's own domain (`docs/ops/EMAIL_SENDER_SETTINGS_GUIDE.md`, after the mailbox provider is
   chosen); **legal pages** for the website (privacy, terms, returns; drafts for the owner's review,
   kept with the website, not in this repository).

   **Nov 25 (kept for history):** (a) the read-only look in `docs/ops/OWNER_PROTECTION_AND_PRIVATE_HISTORY.md`
   §B3, which decides the private-history draft; (b) may a **manager** approve deliveries or supplier
   documents? (c) when an administrator looks at history, show "changed by the owner" or nothing
   (proposed: nothing)? (d) confirm the platform's own shipping email is the one customers get for
   platform orders (proposed: yes); (e) backups in the short form; (f) database sittings in the
   order of `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md`.

1. ~~Merge PR #85~~ DONE Nov 24 evening (it contained #56–#84). ~~Live check~~ DONE the same evening by the owner (the shorter menu and the new switches, all Off, seen on the live site). Next: PR #51 (documents).
   NEW the same evening: the owner decided that administrators get almost everything the owner has (`docs/ops/OWNER_DECISION_2026-11-24_ADMINISTRATOR_NEAR_OWNER.md`); building it has not started.
2. **One stock count for all channels:** `docs/ops/ONE_STOCK_COUNT_DECISION_2026-11-24.md` (orders do
   not lower the dashboard's stock today; Shopify keeps its own count). A read-only shape check comes first.
3. **Business email on the business's own domain** (`docs/ops/BUSINESS_EMAIL_PLAN.md`) and **which
   email service** (the comparison of Nov 24 arrives with PR #78). Nothing is sent before the owner
   approves a specific first send.
4. **Guided database sittings**, one draft at a time: draft 50 (shared settings) first; later 56
   (email sending records, review item 13), 58 (personal settings, review item 14) and 60 (reviews, review item 15); the earlier review items stay open.
5. ~~Shopify notifications~~ DONE Nov 24 (evening): the owner's screenshots show Shopify sends the
   order confirmation and shipping confirmation itself, so the dashboard builds no order-update
   emails. They also show the store's sender email is not on the business's own domain (customers
   see a shopifyemail.com sender): the business email in point 3 fixes that. Detail:
   `docs/ops/OWNER_REQUESTS_2026-11-24_AGENTS_PHONE_PRINTING.md`, "Order-update emails".
6. **Printing at 8:00 AM:** a set-up sitting on the owner's Mac (the dashboard part is built; the
   steps are in `docs/ops/AUTO_PRINT_MAC_SETUP_2026-11-24.md`).
7. Seller accounts and the business postal address (never the home address); box sizes and costs; a
   test print of a batch sticker.
8. Still open from before: tax answers, payment service names, the product list, the website repository.

**Before Nov 24 (kept for history; item 1 is done):**

1. **Merge PR #36** once its final full test run is green (guided, one click at a time); then check
   the live site in a Private Window. Then close #5–#35 (all contained in #36).
2. **SQL review items 1–7**, one at a time, guided (about 15 minutes each, check before and after).
3. **Tax answers 4, 5, 6 and 10** (`docs/ops/TAX_SETUP_QUESTIONS_2026-11-16.md`) for a confirmed rate.
4. **Payment service names** (never passwords or keys) to finish money matching and the payment screen.
5. **Product list** (exact SKUs) for the store launch and the agents waiting on products.
6. **Printers:** a test print on each when they arrive. **Agents session** (about 1–2 hours).
7. Website: approve a separate website repository; visual direction, approved copy and photos.
8. Optional: website, email and phone for a contact line on printouts.

DECIDED on Nov 23: Aurora for everyone; printout typefaces (option A); the invoice closing
("Thank you for choosing Health Endeavors." / "WE APPRECIATE YOUR BUSINESS"); a plain signature line;
today's screens accepted as the test reference pictures; the push of the branch.

Full website list: `docs/website/decisions-needed.md` (website workspace).

## 9. Next recommended work

**Updated Nov 26, 2026 (CURRENT):** the owner's database sittings, one draft at a time, in the order
of `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md` (each with a read-only check after it); the
backups answer in the short form, then step 19 and the one small step in the backups repository
(`docs/ops/RECOVERY_AND_BACKUP_READINESS.md` §3a). The list below still applies.

**Nov 24, 2026:**

1. ~~Owner merges PR #85~~ DONE Nov 24 evening → live check with a hard refresh → PR #51.
2. Database draft 50 in a guided sitting; then a one-line PR that makes the shared switches and
   drafts the same on every device.
3. One stock count, after the owner's decision and the read-only shape check.
4. Real email sending only after: business email, the service choice, the sender settings, draft 56,
   the sending program (not written yet) and the owner's approval of the first send.
5. Not built yet, needing a data source or an account: reading reviews from the sites by itself (pasting them in is built, #82), business email in the feed, real
   stores from a listing service, agents running on a schedule.

**Before Nov 24 (kept for history):**

1. Final full test run of PR #36 green → owner merges → live check (hard refresh or Private Window).
2. SQL items 1–7, guided, one at a time; each followed by the matching switch being turned on only
   after the owner says so.
3. Payments, printers and agents as the owner's details and the printers arrive.
4. Website: separate repository once approved; then the store launch (products, SKUs, sync).
