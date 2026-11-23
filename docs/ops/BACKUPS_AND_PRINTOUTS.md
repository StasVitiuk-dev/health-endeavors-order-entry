# Backups & Printouts page (owner request of Nov 23)

Status: PROPOSED · preview only, off by default (switch "Backups & Printouts" on the Feature
Flags page). With the switch off the page is not in the menu and nothing changes.

> "For backups you can create a separate section, so I can access the recap files from there
> and print manuals in case I need them."

## What it holds

| Part | What you can do | Where it comes from |
|---|---|---|
| Daily recaps | Choose a month; **Print this month** (US Letter, black only, with month totals) or **Save as a spreadsheet** (CSV) to keep on your computer and one more place | The nightly reports (the same rows as Report History). A day without a revenue figure shows "—", never $0.00 |
| Manuals to print | **If the dashboard is down** (what to do by hand, with a paper stock-change log), **How the dashboard works** (the built-in guides), **Your procedures** (the Procedures page), **Printer setup**, or **all together** (each starts on a new page) | Built into the dashboard, plus your own procedures |
| Database backups | An honest note: the backups run outside the dashboard, so the page shows **UNKNOWN** instead of a tick it cannot prove, and opens Business Continuity | The same rule as the System status section |

Reads only: nothing is written, changed or sent. Printouts are black on white whatever look or
dark mode is on screen (see `docs/ops/PRINTING_GUIDE.md`).

## Files

`assets/owner-login-app.js` (Backups & Printouts section), `assets/app/he-config.js` (switch
`he_backups_page`, menu entry, icon), `owner-login.html` (`#backupsPanel`),
`tests/specs/backups-page-ext22.spec.js`.

## Checks (local, made-up data)

Switch off: no menu entry, nothing drawn. Newest month shown and another can be chosen; a
month prints on one Letter page with exact totals, black on white in dark mode (the browser's
own PDF is 612 × 792 points); the spreadsheet holds every day with the exact figures; the
"dashboard is down" sheet has its 14-line paper log; all manuals print on separate Letter
pages; with no procedures written that manual cannot be printed; phone width fits.

## Not done yet

- Saving the spreadsheet does not work inside the claude.ai preview (that page blocks
  downloads); it works on the real dashboard.
- The database backups themselves are not reachable from the dashboard on purpose (their
  repository holds production secrets); checking them stays an owner check.
