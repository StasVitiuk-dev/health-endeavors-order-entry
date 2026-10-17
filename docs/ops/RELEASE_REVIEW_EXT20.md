# Release review (EXT20): owner review package

**Branch:** `claude/platform-ext20-adversarial-completion-2026-10-13`, started from EXT19 final `b433037`. Base `main` is `d3db7bc`. **Draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

Merging changes the dashboard code only. No SQL runs on merge, and nothing touches customers, stock or money. On top of EXT19, merging EXT20 changes three things:

1. **The search box (Cmd+K) is much faster with large data.** Each keystroke used to make the browser recalculate the whole page, and the search built thousands of results just to show 30. With 10,000 products, a keystroke now takes about 2.5 ms instead of about 37 ms. On a slow computer, the worst case drops from about 284 ms to about 35 ms.
2. **Fixed messages are built safely.** Messages like "No expenses logged yet", "Loading…" and toasts no longer go through raw HTML. They look exactly the same.
3. **Everything else** is tests, check tools, read-only queries (new: Query A2; Query G now answers F1/F2), the CI database image pin, and documents.

## 2. Scope

| Changed | Files |
|---|---|
| Dashboard | `assets/owner-login-app.js`, `assets/app/he-ui.js`, `he-admin.js`, `he-audit.js`, `he-compliance.js`, `he-expenses.js`, `he-reports.js`, `he-suppliers.js`, `assets/dashboard-page.js`, `assets/search-page.js`, `assets/manual-order-entry.js`; asset versions in 5 `*.html` |
| Read-only SQL | `06_READONLY_G_…` (G08, G09 added), **new** `08_READONLY_A2_outside_tables.sql` |
| Local test SQL / scripts | `true_concurrency_test.sh` (new), `schema_drift_test.sh` (new), measured `extreme_stress_test.sh`, `permissions_inventory_test.sh` (F1/F2 cases), `run-db-suite.sh` |
| Tests and tools | 5 new specs; `schema-drift.js`; 2 forensic probes; chaos failure evidence; INT-8 test fix; 8 new mutants (213 → 221) |
| CI | database image pinned by digest; the static job runs 2 more Node specs. No new permission, no secret, no deploy |
| Docs | `docs/ops/*_EXT20.md` (10), status documents, intermittent register |

**Not changed:**

- the SQL drafts (R1–R5 fingerprint unchanged);
- any production setting;
- the website, Real Estate OS, backups.

## 3. Tests run

Filled in at the end of the finals: see §8.

## 4. Rollback (step by step)

1. On GitHub, open the merged pull request and press **Revert** → **Create pull request**.
2. Approve and merge the revert pull request.
3. Wait 5 minutes, then hard-refresh (Cmd+Shift+R) or use a Private Window.

Per change, if only one part should be undone:

- the search-box fix is commit `377fcfe`;
- the fixed-text conversion is `a0ea0a4`.

Either can be reverted alone. No database change needs undoing.

## 5. Relationship to the open draft PRs

The EXT20 draft PR contains everything in #34 (EXT19), which contains #33 → #29. Review EXT20 instead; the older drafts can be closed without merging.

## 6. Deployment instructions for Stas (only when you decide to)

1. Open the EXT20 draft PR and check that the description says the tests passed.
2. Press **Ready for review** → **Approve** → **Merge pull request** → **Confirm**.
3. Wait 5 minutes and open the live dashboard in a Private Window.
4. Check:
   - you can sign in;
   - Home loads;
   - press Cmd+K, type a few letters, and use the arrow keys (the list scrolls, results appear quickly);
   - an empty page (for example Legal Holds with none) shows its message;
   - System mode shows a name next to "Changed by";
   - sign out, then sign in again.
5. If anything differs, change nothing else, use §4, and send Claude a screenshot.

## 7. Known limitations

- Production RLS, backups, agents and Queries C–H are UNKNOWN. See `OWNER_ACTIONS_EXT20.md`.
- Trusted Types is not enforced (56 locations; NOT YET SAFE).
- INT-3 is open.
- Google Fonts are still used on 4 pages (owner decision D2).
- There is no `frame-ancestors`/HSTS header (GitHub Pages limit).
- No real Safari, iPhone or VoiceOver testing has been done.
- Production concurrency is unknown (local only).

## 8. Evidence (exact commits)

To be completed with the final runs.
