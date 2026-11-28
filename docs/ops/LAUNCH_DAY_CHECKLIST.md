# Launch day: the go/no-go list and what to watch

Status: **PROPOSED** · written 2026-11-27 for launch-plan days 13–14 (`LAUNCH_PLAN_2_WEEKS.md`).
Related: the Launch page in the dashboard (Overview → Ready to launch), `TEST_ORDER_CHECKLIST.md`,
`LAUNCH_DAY_ROLLBACK_PRACTICE.md`, `RECOVERY_AND_BACKUP_READINESS.md`.

**What Claude can and cannot see.** Claude has no access to your live database, store or email. On
launch day Claude knows only what you send: screenshots, numbers, a downloaded file. Everything below
that says "check" is a check **you** do; Claude reads what you send and says what it means.

## The day before: go or no-go (about 20 minutes)

Go only when **every** line is a yes. A line you decide to launch without is written down in the chat
with your reason, so the choice is on record.

| # | Question | Where to look | Yes when |
|---|---|---|---|
| 1 | Is every line on the Launch page ready? | Overview → Ready to launch | "15 of 15 ready", or the open ones are the lines you chose to waive (written down) |
| 2 | Did the test order pass every check? | `TEST_ORDER_CHECKLIST.md` | All checks passed, order number and date in the chat |
| 3 | Is there a recent backup that was restored once? | Backups & Printouts | The nightly backup is green within the last 7 days; one restore test done |
| 4 | Did you practise going back once? | `LAUNCH_DAY_ROLLBACK_PRACTICE.md` | The practice log has your times |
| 5 | Are the stock steps installed (R1–R5), and the request keys? | Feature Flags → "Features that save real records" | Installed and switched on as planned |
| 6 | Is the sales tax rate confirmed? | Tax Records | A rate you confirmed yourself |
| 7 | Are the store's own pages live (privacy, terms, returns, shipping)? | The store | All four open |
| 8 | Have you chosen which agents run on day one? | AI Agent Activity | Few, and you know which |
| 9 | Is two-step sign-in on for the accounts behind the dashboard? | Each service's security settings | On (the last line, on purpose) |

If any answer is no and you don't waive it: **no-go**, and the plan moves by the days that line needs.

## Launch morning (about 15 minutes)

1. Feature Flags → System mode: **Normal**.
2. The switches you chose are on; everything else stays off.
3. Shopify order sync on, **only** if R9 exists (otherwise orders are entered as before).
4. You publish the store in Shopify.
5. Send Claude one screenshot of Home and one of Feature Flags. Claude confirms what it sees.

## During the day: every hour or so (2 minutes each)

| Look at | Fine when | If not |
|---|---|---|
| Home / Needs Your Attention | Nothing new, or something you understand | Screenshot to Claude |
| Orders | Each Shopify order appears **once**, with the right items | Stop: Emergency (below) |
| Inventory | Stock went down by exactly what was sold | Stop: Emergency |
| Customer Inquiries | Answered, or on your list | Answer, or ask Claude for a draft |

## Stop rules (any one is enough)

- An order appears twice, or with the wrong items or amounts.
- Stock moves when nothing was sold, or moves twice.
- A customer receives something you did not approve.
- A page shows an error you have not seen before.

**What to do:** Feature Flags → System mode → **Emergency** (under a minute). It pauses the AI agents
and turns Shopify order sync off; the rule-based agents (#1 invoices, #4, #5, #6) keep running, and
nobody is signed out. Then a screenshot to Claude. The store can stay open; orders wait in
Shopify and are brought in once the cause is found. Going back to the previous version:
`LAUNCH_DAY_ROLLBACK_PRACTICE.md`.

## End of the day (5 minutes)

1. Report History: today's recap has the day's orders and revenue.
2. The daily print at 12:02 AM opens the day pack; check the paper the next morning (it says "opened
   for printing", never "printed").
3. Tell Claude: number of orders, anything odd. Claude writes the day into `docs/PROJECT_RECORD.md`.
