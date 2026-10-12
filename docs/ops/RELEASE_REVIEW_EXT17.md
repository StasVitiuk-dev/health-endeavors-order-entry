# Release review (EXT17): owner review package

**Branch:** `claude/platform-ext17-deep-reliability-2026-10-12` (from EXT16 final `bcf4f25`). Page code frozen at FROZEN_SHA. Base `main` `d3db7bc`. **Draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

Merging changes the dashboard code only. No SQL runs on merge, the database functions stay uninstalled, and nothing touches customers, stock or money. On top of EXT16, merging EXT17 changes three things:

1. **Manual stock adjustment.** If the connection drops while saving, pressing Save again first checks whether the first save went through, and never adds the stock twice. If the stock was saved but its history line was not, the message now says the stock WAS changed.
2. **Sidebar.** It keeps working when the browser's storage is full, blocked or holds an old or broken value.
3. **Nothing else visible.** The rest is tests, test tools, SQL drafts (not installed) and documents.

The SQL drafts changed too: three fixes, and a new reviewed fingerprint `f6d9c2c8be690710eeb721041f6779d9`. They are installed only later, by you, through the R1–R5 runbook. Merging does not install them.

## 2. Scope

| Changed | Files |
|---|---|
| Dashboard | `assets/owner-login-app.js` (adjustment flow), `assets/app/he-ops.js` (repeatable mode), `assets/app/he-data.js` (records an attempted stock change on a lost reply), `assets/app/he-nav.js` (memory-first sidebar state), `owner-login.html` (asset versions) |
| SQL drafts (not installed) | `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql`, its tests, Query H expected fingerprint, MANIFEST |
| Tests and tools | 6 new specs, `tests/db/inventory-model.js`, `tests/helpers/chaos.js`, Trusted Types probe, mutation runners (`--check` from EXT16, summary parsing, model detector), DB suite steps |
| Docs | `docs/ops/*_EXT17.md` (8), runbook, check cards, project record, current state, progress |

**Not changed:** the CI workflow, any other screen's behaviour, the CSP policies, any production setting.

## 3. Tests run

TESTS_TABLE

## 4. Rollback (step by step)

1. On GitHub, open the merged pull request and press **Revert** → **Create pull request**.
2. Approve and merge the revert pull request.
3. Wait 5 minutes, then hard-refresh the live dashboard (Cmd+Shift+R) or use a Private Window.

No database change needs undoing, because merging installs none.

## 5. Relationship to the open draft PRs

EXT17 is a successor draft PR containing everything in #31 (EXT16), which contains #30 and #29. Review EXT17 instead. The older drafts can then be closed without merging. Merging any of them is your decision.

## 6. Deployment instructions for Stas (only when you decide to)

1. Open the EXT17 draft PR. Check that the description says the tests passed.
2. Press **Ready for review** → **Approve** → **Merge pull request** → **Confirm**.
3. Wait 5 minutes and open the live dashboard in a Private Window.
4. Check:
   - you can sign in;
   - Home shows its cards;
   - Inventory opens and its adjustment form is there (do not save a real adjustment just to test);
   - the sidebar sections open and close;
   - System status → Copy diagnostic summary shows "modules 19/19".
5. If anything differs: change nothing else, use §4, and send Claude a screenshot.

## 7. Known limitations

- INT-3 (one shrinker replay, unexplained) is still open.
- No real Safari, iPhone or VoiceOver test; 400% zoom is an automated layout check only.
- Trusted Types is not enforced (86 locations would break); see `TRUSTED_TYPES_EVALUATION_EXT17.md`.
- The SQL fixes are drafts, tested only on a throwaway database. The production database state remains UNKNOWN until Query C is run.
