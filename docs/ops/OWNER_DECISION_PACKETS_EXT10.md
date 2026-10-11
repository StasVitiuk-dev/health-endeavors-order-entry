# Owner decision packets (EXT10)

**Status:** OWNER DECISION REQUIRED for each section (2026-10-11). Nothing here is decided or built beyond what is stated. Each packet shows the options side by side with a worked example; the safe default keeps today's behaviour.

## 1. Partial returns (D-ops-5)

**Today:** when a return is received and restocked, the **whole order line** goes back into stock. If the customer bought 3 and returned 1, stock goes up by 3.

| | Option Yes: record "units actually returned" | Option No: keep whole-line restock |
|---|---|---|
| Worked example: bought 3, returned 1, resalable | stock +1; the return shows "1 of 3" | stock +3 (2 units that do not exist) |
| Refund record | unchanged (amount typed by you) | unchanged |
| What changes in the dashboard | a quantity box on "Mark received", default = whole line, refused above the line quantity | nothing |
| What changes in the database | R3 (`receive_return`) gets a quantity argument (small change to drafts/10 before it is installed; re-tested locally) | nothing |
| Risk | low; the default behaves like today | stock overstated after every partial return |
| Recommended | **Yes**, before returns become frequent | — |

**Safe default until you answer:** No (today). **After "Yes":** Claude changes the R3 draft + the return button behind the existing `stock_fn_return` switch, with tests, in a PR you review.

## 2. "This week": calendar week vs last 7 days (X8-D2)

**Today:** Accounting's button says **"Last 7 days"** and means the 7 days up to now. Report History groups by **calendar week (Monday–Sunday)**. Both are labelled honestly; nothing is wrong today.

Worked example: today is Wednesday 15 October.

| | "Last 7 days" (today's Accounting) | "This calendar week" (Mon 13 – today) |
|---|---|---|
| Days included | Thu 9 – Wed 15 (7 days) | Mon 13 – Wed 15 (3 days so far) |
| Compares well with | any other 7-day stretch | last week's Monday–Sunday total (Report History) |
| Surprise | the window moves daily, so Monday's figure ≠ Tuesday's for the same sales | small on Mondays, grows through the week |

| Option | What happens |
|---|---|
| Keep (default) | nothing changes |
| Add "This week (Mon–today)" as an extra button | both shown; labels say exactly which days |
| Replace "Last 7 days" | only the calendar week |

**Safe default:** keep. Either change is a small dashboard PR with the existing money-period tests extended.

## 3. Refund rule N4: simulator

The question itself is in `N4_DECISION_ONE_PAGE.md`. Worked example to show your accountant: one order of **$100.00** placed on 28 September; on 3 October you refund **$30.00** (customer kept the rest); the order stays "paid".

| | Option A (today) | Option B (subtract in the refund month) | Option C example (subtract in the sale month) |
|---|---|---|---|
| September revenue | $100.00 | $100.00 | **$70.00** (September figure changes after the fact) |
| October revenue | $0.00 | **−$30.00** | $0.00 |
| Total over both months | $100.00 (overstated by $30) | $70.00 | $70.00 |
| Tax Records (sales tax base) | as revenue | as revenue | as revenue |
| Already built and tested | yes | yes (`refund-policy.spec.js`) | needs the accountant's exact rule |

**Safe default:** A until the accountant answers; it is only wrong once refunds are recorded on Returns without the order being marked refunded.

## 4. Nightly check thresholds (X8-D4)

Proposed (built as defaults, changeable): **FAIL** = a record pointing at the wrong thing or an impossible value (F10–F15); **WARN** = stuck work or a probable duplicate (F01–F09); **STALE** after 26 hours. Options: accept / move F05 "late purchase orders" to information only / a longer staleness (e.g. 50 h for weekends). Detail: `NIGHTLY_CHECK_PACKAGE_EXT10.md`.

## 5. Request keys: switch on after install? (part of U11)

Nothing to decide about *how*; only *when*. Once drafts 19 + 27 are installed and V11 passes, turning on `request_keys` prevents duplicates after a lost reply on every create form. Rollback is the switch. Recommended: turn on right after V11.
