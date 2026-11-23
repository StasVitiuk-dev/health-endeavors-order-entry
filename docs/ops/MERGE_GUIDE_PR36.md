# Merging PR #36: step by step, live check, undo

Status: CURRENT · written Nov 23, 2026 · for Stas. Replaces `docs/ops/pr-merge-order.md` (DEPRECATED:
that order was for PRs #5–#24, which are all inside #36).

Merging PR #36 **is the live deploy**: GitHub Pages publishes `main` 1–5 minutes later. Merging runs
**no database change** (SQL drafts are separate, each with its own guided run later).

## Before you start

- The PR description says the **final full test run is green** and GitHub's checks show green ticks.
  If not, wait: Claude fixes first.
- Have 15 minutes, a computer, and your iPhone for the last check.

## What changes for everyone at the merge

- The dashboard has the **Aurora** look (indigo-to-cyan accents, accent lines, calmer dark mode).
- Every new feature stays **off** behind its switch (Feature Flags → Preview features), so pages
  work as before apart from the look and the fixes listed in the PR.
- Printouts (invoice, packing slips, labels) carry the logo and the new typefaces; they appear only
  when their switches are turned on.

## Steps (GitHub, in your browser)

1. Open https://github.com/StasVitiuk-dev/health-endeavors-order-entry/pull/36
2. Scroll to the bottom. Press **Ready for review** (the PR is a draft until then).
3. At the top, open the **Files changed** tab. Press **Review changes** (top right).
4. Choose **Approve**, then press **Submit review**.
5. Go back to the **Conversation** tab. At the bottom, press **Merge pull request**, then
   **Confirm merge**. (If GitHub offers "Squash and merge" or "Rebase", choose plain **Merge**.)
6. Send Claude a screenshot of the page after the merge.

Why you can approve: you are the code owner, and the last push came from Claude's account, so your
approval counts as "someone else". Claude cannot approve or merge.

## Live check (5 minutes after the merge)

1. Open a **Private Window** (Safari: File → New Private Window), or hard refresh with Cmd+Shift+R.
2. Go to https://stasvitiuk-dev.github.io/health-endeavors-order-entry/owner-login.html and sign in.
3. The look is Aurora: indigo-to-cyan accents, a thin coloured line under page titles.
4. Open Home, Orders, Inventory, Returns, Expenses, Accounting, Tax Records and Tasks. Each opens,
   and the figures match what you saw before the merge.
5. Feature Flags: a **Look** section (Aurora chosen) and the preview switches, all **Off**.
6. On your iPhone: open the same link, sign in, open the menu and two pages.
7. **Stop if anything looks different from the preview or from before** (apart from the look), and
   send Claude a screenshot. Don't change anything else first.

## Undo (if something is wrong)

- Tell Claude. Claude opens a **revert pull request** (it puts the previous version back); you approve
  and merge it exactly like steps 3–5. GitHub Pages republishes the previous version in 1–5 minutes.
- Or yourself: the merged PR #36 → **Revert** button → a new PR → merge it. Because you made that PR
  yourself, GitHub may ask for someone else's approval; as the repository admin you can tick
  "Merge without waiting for requirements to be met".
- Only your own browser's look choice is stored on the device; nothing in the database changes, so
  no database undo is needed.

## After a good live check

- Close the older PRs #5–#35 (each one: **Close pull request**). Their work is inside #36.
- Next: SQL review items 1–7, one at a time, guided (`docs/ops/NEXT_SESSION_CHECKLIST.md`).
