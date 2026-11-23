# Release review (EXT19): owner review package

**Branch:** `claude/platform-ext19-preproduction-completion-2026-10-12` (from EXT18 final `5f645d3`). Base `main` `d3db7bc`. **Draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

Merging changes the dashboard code only. No SQL runs on merge, and nothing touches customers, stock or money. On top of EXT18, merging EXT19 changes these things:

1. **One real bug fixed.** "Changed by" on System mode and the agent switches asked the database for a `full_name` column, which the real `profiles` table does not have. The page now asks for `display_name` and falls back to the e-mail address.
2. **Less raw HTML.** The sidebar and the loading placeholders are now built element by element with a safe builder, so record text can never turn into markup there. Browser "Trusted Types" violations went from 168 to 86.
3. **Everything else** is tests, check tools, CI gates and documents:
   - schema contract;
   - operation state contract;
   - whole-program type gate;
   - mutation-runner fix.

## 2. Scope

| Changed | Files |
|---|---|
| Dashboard | `assets/owner-login-app.js`, `assets/app/he-ui.js`, `assets/app/he-agents.js`, `owner-login.html` (asset versions only) |
| Tests and tools | 3 new specs (DOM builder, schema contract, state contract), `schema-contract.js`, typecheck widened to 27 files, mock refuses unknown columns, mutation runner reports "no test ran", 6 new mutants (207 → 213) |
| CI | static job runs the schema contract and the state-contract spec (no new permission, no secret, no deploy) |
| Docs | `docs/ops/*_EXT19.md` (8), operation contract JSON, status documents, intermittent register (INT-7, INT-8) |

**Not changed:**
- the SQL drafts;
- any production setting;
- the website;
- Real Estate OS;
- backups.

## 3. Tests run

The program code is frozen at `31cf21f`. Every result below was measured on that commit.

| Check | Result |
|---|---|
| Full local suite, desktop + iPhone, `31cf21f` | **2,112 passed, 0 failed, 350 skipped on purpose** (1.0 h) |
| GitHub CI, `31cf21f` | **all green** (static, screenshots, database suite, 3 browser shards) |
| Page mutants, full round, `31cf21f` | **213/213 caught** (55 min) |
| Full local database suite, `31cf21f` | **30/30 steps PASS** (698 s) |
| Static gates: security quick check, docs, type gate, schema contract, secret scan, asset versions | PASS |

The earlier run on `c956b25` and its fixes are listed in §8. After `31cf21f`, only documents changed.

## 4. Rollback (step by step)

1. On GitHub, open the merged pull request and press **Revert** → **Create pull request**.
2. Approve and merge the revert pull request.
3. Wait 5 minutes, then hard-refresh the live dashboard (Cmd+Shift+R) or use a Private Window.

No database change needs undoing, because merging installs none.

## 5. Relationship to the open draft PRs

The EXT19 draft PR contains everything in #33 (EXT18 → #32 → #31 → #30 → #29). Review EXT19 instead. The older drafts can then be closed without merging.

## 6. Deployment instructions for Stas (only when you decide to)

1. Open the EXT19 draft PR and check that the description says the tests passed.
2. Press **Ready for review** → **Approve** → **Merge pull request** → **Confirm**.
3. Wait 5 minutes and open the live dashboard in a Private Window.
4. Check each of these:
   - you can sign in;
   - Home shows its cards;
   - the sidebar shows its icons and its search finds a task;
   - System status → System mode shows a name next to "Changed by" (not blank);
   - Copy diagnostic summary shows "modules 19/19";
   - sign out, then sign in again.
5. If anything differs, change nothing else, use §4, and send Claude a screenshot.

## 7. Known limitations

- **Production RLS is UNKNOWN** (run Query G). F1/F2 are unchanged from EXT18.
- Trusted Types are not enforced: 86 violations remain, in 84 code locations.
- Peak database concurrency was not measured in the storm runs. "250 callers" means 250 clients started; how many ran at the same moment is unknown.
- Google Fonts are still on 4 smaller pages. The CI `postgres:16` image is pinned by tag, not by digest.
- INT-3, INT-7 and INT-8 are open and unexplained (see the intermittent register). No real Safari, iPhone or VoiceOver testing has been done.

## 8. Evidence (exact commits)

| Check | Result |
|---|---|
| Full local suite on `c956b25` | 2,094 passed, 18 failed, 350 skipped. Causes of the failures:<br>- 16 were mine and are fixed: the staging bundle loaded a Node-only file (11); the helper count was stale (1); the write-path inventory was stale (3); the new icon parser had a slow pattern (1).<br>- INT-7 and INT-8 are open intermittents (pass 5/5 alone and 3/3 under CPU load). |
