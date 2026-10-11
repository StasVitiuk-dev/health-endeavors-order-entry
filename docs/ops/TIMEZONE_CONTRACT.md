# Timezone contract (dashboard)

**Status:** CURRENT on branch `claude/platform-deep-readiness-extension-4` (2026-10-06, extension 4, workstream E). Not live until merged.

## The rule

| Kind of value | Stored as | How the dashboard reads and writes it |
|---|---|---|
| A moment (order placed, task done, audit time) | `timestamptz` (UTC) | Shown in the viewer's local time. Range filters send the local-midnight instant as a full UTC timestamp. |
| A calendar day (expense date, expected delivery, expiry date, FDA deadline, report date) | `date` (no time) | Read as a local calendar day (`'YYYY-MM-DD' + 'T00:00:00'`, never `new Date('YYYY-MM-DD')`, which means UTC midnight = the previous evening in Central). Written and compared with `localDateString()`. |
| "Today", "This Month", "This Year", "Last 7 days" | computed | From the viewer's own clock: `acctRangeStart` / `taxRangeStart` (helpers file), local midnight. "Last 7 days" = the same wall-clock time 7 days earlier; for date-only columns, from that calendar day. |

**Business time is Central (America/Chicago).** The dashboard uses the viewer's own computer clock and calendar. For the owner in Central, that is Central.

## Fixed in extension 4

| Where | Problem | Fix |
|---|---|---|
| Purchase order "Receive" → expense | `expense_date` was the **UTC** date: a delivery received after 7 pm Central (6 pm in winter) on the 30th was logged on the 1st, so it fell in the **next month** in Accounting and Tax Records | `localDateString(new Date())` |
| Accounting "Last 7 days" (expenses) | Start date was a UTC slice of a local time: after 7 pm the expenses from exactly 7 days ago were left out, while orders from that evening were counted | `localDateString(start)` |
| Accounting / Tax expense ranges (all) | Same UTC slice; correct in Central at local midnight, wrong for a viewer east of UTC (e.g. travelling in Europe: September 30 counted in October) | `localDateString(start/end)` |
| Weekly report grouping key | Same UTC slice (grouping only) | `localDateString(...)` |

Earlier fixes (extension 3): manual order dates (`placedAtFor`, noon local for other days); the date box showing "tomorrow" after 7 pm; Accounting / Tax ranges moved to local midnight.

## Tested boundaries

- Unit (`helpers-unit.spec.js`, Node with `TZ=America/Chicago`): DST start (March 8, 2026) and end (November 1, 2026) never skip or repeat a day; "Today" at 23:30 on the DST-end day starts at the CDT midnight; "Last 7 days" across a DST change keeps the wall-clock time; leap day 2028-02-29; 23:59:59 vs 00:00 at a month end; December 31 23:59 vs January 1 00:00.
- Page (`timezone-contract.spec.js`, `po-receive.spec.js`, `report-boundaries.spec.js`, `manual-order-entry.spec.js`, `local-dates.spec.js`): 9 pm "Last 7 days"; 11:59 pm on the last day of a month; a Berlin viewer just after midnight on the 1st; a delivery received at 9 pm on September 30; May 31 23:30 vs June 1 00:30; December 31 23:30 vs January 1 00:30; manual orders at 9 pm.

## Known limits (not fixed; recorded)

- **Viewer outside Central:** a viewer in another time zone sees *their own* calendar ("This Month" starts at their midnight). For a single Central business this is acceptable; forcing Central everywhere would need every date computation to use `Intl` with `America/Chicago`. **OWNER DECISION (optional):** only needed if someone will regularly use the dashboard from another time zone (listed in `OWNER_DECISIONS_NEXT.md`).
- **Server-side jobs and agents:** which time zone the database functions, cron jobs and agents use for "today" is **not verified** (Query C shows the schedule but not the session time zone). Daily reports written by agents carry a `report_date`; the dashboard displays it as written.
- **Order timestamps from Shopify** arrive as full timestamps and are not changed.
- An expense's own date is whatever the person typed or the receive day; the dashboard does not move it.
