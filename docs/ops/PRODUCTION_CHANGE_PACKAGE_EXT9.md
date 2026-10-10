# Production change package (EXT9)

**Status:** CURRENT (2026-10-10, extension 9). Every future production change, in the order it may be done. **None has been done.** Each step needs Stas's approval and is done by Stas (or by a session Stas explicitly authorises for that one step). Rule: one step at a time; check after each; stop if anything differs. Read-only checks referred to as V1…V10 are in `PRODUCTION_READONLY_VERIFICATION_EXT9.md`. Supersedes the order list in `SQL_DEPENDENCY_GRAPH.md` §3 where they differ (that file keeps the per-file detail).

**Before any step:** V1 (backups) = VERIFIED HEALTHY. If not, stop.

| Order | Change | Depends on | Precheck | Approval | Change (exact) | Postcheck | Rollback | Downtime | Data risk | Evidence to send |
|---|---|---|---|---|---|---|---|---|---|---|
| **P0** | Merge the EXT9 branch (dashboard code) | — | Tests green on the PR; read the PR summary | Stas merges | GitHub: PR → Merge | Live site: Cmd+Shift+R; sign in; Home shows "Checks: what needs a look" with "Checked at …"; Feature Switches page unchanged (no stock switches yet) | Revert the merge commit (GitHub "Revert") | none (Pages republishes in 1–5 min) | none: every stock button behaves as today until a switch exists and is on | Screenshot of Home |
| **P1** | Run V2 Query C, V4 Query D, V5 Query G, V6 Query E, V7 Query F | — | — | none (read-only) | paste and run each file | — | — | none | none | CSVs |
| **P2** | Install R1–R5 (`drafts/10_DRAFT_stock_functions.sql`) | P1 (V2 shows no other stock writer; D-ops-6) | the file's own preflight stops if the database shape differs | **Stas** (D-ops-1/2) | `R1-R5-INSTALL-RUNBOOK.md`, steps 1–6 | V8 fingerprint `3df2bf7a…`; grants query (6 rows, anon false) | `drafts/11_…` (drops the functions; **stock already moved by them stays moved**) | none | none: nothing calls them yet | Screenshots of V8 and grants |
| **P3** | Add the stock switches (`drafts/21_…`) | P2 | the file stops if R1–R5 are missing or `feature_flags.id` has no default | Stas | paste and run `drafts/21_DRAFT_stock_function_switches.sql` | V9: 5 rows, all false | `drafts/22_…` (refuses while any switch is on) | none | none | Screenshot of V9 |
| **P4** | Turn on **one** stock switch, then the next (suggested R1 receive → R4 adjust → R2 recall → R3 return → R5 delete) | P3 | the page itself checks the function is installed before it lets the switch turn on | Stas, per switch | Feature Switches page → the switch → password | Do that button once on a small real case (e.g. receive a 1-unit PO); check Inventory, Expenses and the PO | Turn the switch off (instant). Undo the business effect by hand if wrong (e.g. an adjustment back) | none | low: the function is all-or-nothing; a wrong business action is a person's action, not a half-save | Screenshot after each |
| **P5** | PO line guard (`drafts/17_…`) | none (independent since EXT6) | read the file header (what it changes, how to verify) | Stas | paste and run drafts/17 | trigger present (query in the file's header) | `drafts/18_…` | none | none | Screenshot |
| **P6** | Integrity rules (`drafts/23_…`) | V6 + V7 show 0 for the four rules | the file stops with counts if existing rows break a rule | Stas | paste and run drafts/23 | 4 rows (query in the file) | `drafts/24_…` | < 1 s write lock per table | none (no value changes) | Screenshot |
| **P7** | Request keys (`drafts/19_…`) | — | the file's own precheck | Stas | paste and run drafts/19 | per file | `drafts/20_…` | < 1 s per table | none; **nothing uses the keys until a later dashboard change** (not built yet) | Screenshot |
| **P8** | Permission fixes | P1 (V5 Query G output) | — | Stas | drafts to be written from V5 (`PERMISSION_RLS_MAP_EXT9.md` §4) | re-run V5: no FAIL | each draft's rollback restores the exact original policy text | none | **medium**: a too-narrow policy locks staff out (rollback restores) | V5 CSV after |
| **P9** | Schedule Query F nightly (pg_cron, read-only) | P1, X8-D4 thresholds | — | Stas | draft not written yet (needs a results table + job; design D1) | — | unschedule | none | none | — |
| **P10** | Revoke direct stock writes from the browser (INV-20) | all five switches on and stable for a while; V2 shows no other writer | — | Stas | draft not written yet | — | grant back | none | **medium**: the old step-by-step path stops working (intended) | — |
| **P11** | Backup status row on Home (D5) | X8-D6 | — | Stas | needs a change in the private backups job (Claude must not open it) | Home shows HEALTHY/NEEDS REVIEW | drop the table | none | none | — |

## Rules for every step

1. Only the listed file, copied from GitHub **Raw**, nothing edited.
2. One step per sitting; the postcheck before the next step.
3. If a precheck or postcheck differs: stop, send a screenshot, do not try a fix.
4. Rollback is for the database change. **It cannot undo real-world effects** (stock already received, an expense already logged, a message already sent). Those are corrected by hand with a record of who and why.

## Order guards built into the files (prevent step 4 before step 2)

| File | Refuses to run if |
|---|---|
| drafts/10 (R1–R5) | the database shape is not the one Query A reported (preflight) |
| drafts/21 (switches) | R1–R5 are missing; `feature_flags` columns missing; `id` without default |
| drafts/22 (switches rollback) | any switch is still on |
| drafts/23 (integrity rules) | existing rows break a rule (with counts) |
| drafts/19 (request keys) | its own precheck (see file) |
| dashboard (EXT9) | a stock switch cannot be turned on before its function answers |
