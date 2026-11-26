# Going back fast: the launch-day rollback guide and a practice run

Written November 26, 2026, at the owner's request ("a launch-day rollback practice run, so going
back takes 2 minutes if something looks wrong"). Status: **PROPOSED**; the practice run has not
happened yet. Related: `docs/ops/RECOVERY_AND_BACKUP_READINESS.md` (backups and the restore drill,
a different thing: that one brings back **data**; this guide brings back the **previous version**).

## The one rule when something looks wrong

1. **Stop.** Don't change anything else.
2. **Take a screenshot** and send it to Claude.
3. **Do the first response for that kind of change** (the table below). Every pull request's
   "Rollback steps" section names which kind it is.
4. Then Claude finds the cause, and the fix comes as a new pull request, tested first.

## What kind of change, and how to go back

| Kind of change | First response (the "2 minutes") | Back to exactly as before | Total |
|---|---|---|---|
| **A new feature behind a switch** (most new pages) | Feature Flags → turn its switch **off**. Off always works, right away | Done; the code can stay | **under 1 minute** |
| **An AI agent or the Shopify order sync misbehaving** | Feature Flags → System mode → **No AI** (pauses every AI agent) or **Emergency** (also turns Shopify Order Sync off) → Change mode | Switch back to Normal once Claude has found the cause | **under 1 minute** |
| **A dashboard change without a switch** (a merged pull request) | On the merged pull request on GitHub: **Revert** → **Create pull request** → merge it the usual way (bypass rules, merge commit) | GitHub publishes the old version in **1–5 minutes**; then a hard refresh (Cmd+Shift+R) | **about 2 minutes of clicks + 1–5 minutes of waiting** |
| **A database step** (one of the numbered drafts) | Open that step's **undo file** (named in the step's guide; usually the next number, for example 71 undoes 70) and run it in Supabase, then the read-only check in its guide | Done; the step can be done again later | **2–5 minutes** |
| **The website theme** (once the store is live) | Shopify → Online Store → Themes → the previous theme → **Publish** | Done | **about 1 minute** (to be practised on the development theme once the website is approved) |

Honest about the 2 minutes: switching something off or pausing the agents is instant. Undoing a
code change takes about 2 minutes of clicking, and then GitHub needs 1–5 minutes to put the old
version on the live site. That wait cannot be made shorter from here, which is why new features
come behind a switch.

## The practice run (about 20 minutes, with Claude, once before launch)

Nothing in it changes how the live dashboard behaves.

### Part 1. Undo a merged pull request (about 10 minutes)

1. Claude opens a **practice pull request** that adds one line to the practice log at the end of
   this file. Notes only.
2. You merge it the usual way. **Write down the time.**
3. On the merged pull request, press **Revert**. GitHub opens a new pull request named
   "Revert …". Press **Create pull request**, then merge it the usual way (bypass rules, merge
   commit). Don't wait for the checks: in a real emergency you wouldn't. **Write down the time.**
4. Claude confirms that the files on `main` are exactly what they were before step 2 (a
   comparison of the two versions shows no difference). **Write down the time.**

Goal: step 2 to step 3 in **about 2 minutes**.

### Part 2. Switch off and pause (about 2 minutes, nothing really changes)

1. Feature Flags → under "Preview features", turn one preview on, look at it, turn it off. Until
   database step 50 (shared settings) is installed, these only affect your own browser; after it,
   the page says they are shared with every phone and computer, so a practice switch is seen by
   everyone for that minute.
2. Find **System mode** at the top of Feature Flags and read the four choices. **Don't change it
   in practice**: No AI really pauses the agents that run every hour. Knowing where it is, is the
   practice.

### Part 3. Undo a database step (about 5 minutes, at your first database sitting)

Done on step 19 (backup status on Home), because it adds one **empty** table that nothing else
uses yet: install it (file 70), undo it (file 71), install it again (file 70), each followed by
its read-only check. **Write down the minutes.** Claude already runs every undo file on a
throwaway copy of the database in every full test run; this is the one practice on the real one.

### Part 4. The website theme (later)

When the website's development theme exists: publish the previous theme, then the new one again.
Not before the website repository and the Shopify development theme are approved.

## On launch day

- Before anything is merged: Claude writes down the **last good version** (its short code, for
  example `c60e07e`) in the pull request, so "back to before" is never a guess.
- New things go live behind a switch that is **off**; you turn it on, look, and leave it on.
- If anything looks different from what was tested: the one rule at the top.

## Practice log

After the practice, mark **"You practised going back to the previous version once"** on the dashboard's
"Ready to launch" page (preview switch "Ready to launch").

| Date | Part | Start | Done | Minutes | Notes |
|---|---|---|---|---|---|
| (not yet practised) | | | | | |
