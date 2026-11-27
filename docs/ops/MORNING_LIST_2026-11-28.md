# Morning list for Stas (Nov 28, 2026)

Status: CURRENT · written overnight Nov 27–28 while you slept · short on purpose. Each item says what to
click and how long it takes. Nothing here has been merged, installed or switched on by Claude.

## Sitting 1 — merge, in this order (about 10 minutes)

Each one: open the pull request → **Merge pull request** → **Confirm merge**. I write "Ready" on each one
first, only once its checks have finished. "Screenshots (informational)" is red on all of them for the
reason fixed in #144; it never blocks.

| Order | Pull request | What it is |
|---|---|---|
| 1 | #141 | Records: step A2 installed (notes only) |
| 2 | #142 | The two-week launch plan; every waiting draft checked on your database's shape; the frozen readiness yardstick (notes and tests) |
| 3 | #145 | Settings shared by every device, with no switch to turn on; honest wording when they cannot be read (dashboard change: check the live page after it, steps in the pull request) |
| 4 | #143 | One page each for the stock steps, request keys and the nightly check (notes only) |
| 5 | #144 | Why the screenshot check is always red, and the fix (test machinery only) |

#142 contains #141, and #145 contains both, so those three merge one after the other without a conflict; #143 and #144 touch other files, so their order does not matter.

## Sitting 2 — two read-only looks in Supabase (about 15 minutes; they change nothing)

1. The `feature_flags` columns (needed before drafts 21, 27 and 29): the query is in
   `docs/ops/LAUNCH_PLAN_2_WEEKS.md`.
2. Query C: does anything else change stock (an agent, a timer, a trigger)? Guide:
   `docs/ops/QUERY_C_OWNER_RUN_GUIDE.md`. I send each one in the chat, one at a time.

## Decisions (one word each is enough)

1. The two-week plan: **go**, or what to change (`docs/ops/LAUNCH_PLAN_2_WEEKS.md`).
2. Stock steps, request keys and the nightly check in the launch: **yes / not yet** (items 20–22). My
   recommendation: yes.
3. The nightly check: should Home warn after one missed night? (decision X8-D4)
4. Customer email at launch: **none** (only drafts to copy) or **real sending**? (decides whether launch fix
   R10 counts as done; `docs/ops/READINESS_LEDGER.md`)
5. The product list from the lab: which day can you send it? (the plan's deciding item)
6. Store texts (privacy, terms, returns, shipping) belong to the store, not to this repository: a new
   private repository for the website (needs your approval), or written straight into Shopify with you?

## Small things only you can do

- **Screenshots, once #144 is merged (10 minutes):** GitHub → Actions → Dashboard CI → Run workflow → tick
  *update_screenshots* → when it finishes, download the `screenshots-…` file and send it in the chat.
- **Products typed once, not twice (proposal):** Shopify → Products → Import → "Download a sample CSV" →
  send it in the chat. Then I can add a "Save for Shopify" file to the product import. I do not touch Shopify.
- **After the shared-settings pull request is live:** on your iPhone, open the dashboard and sign in;
  Feature Flags should show Real profit and Backups & Printouts on. Send a screenshot.

## Found and fixed overnight (details in `docs/PROJECT_RECORD.md`, history, Nov 27)

- After choosing a menu, the keyboard lost its place when "Saved for every device" appeared: fixed.
- Feature Flags said every switch was "this browser only", even with shared switches; and said nothing
  when they could not be read: both fixed, with the reason shown.
- The Launch page pointed to the removed switch: fixed.
- The list of database steps called the stock steps "a separate decision" while the plan needs them:
  items 20–22 written.
- The screenshot check had been red for days because the pictures were made with a newer Chrome than CI
  uses: cause shown, fix in #144.
- #141 and #142 would have conflicted: combined.
