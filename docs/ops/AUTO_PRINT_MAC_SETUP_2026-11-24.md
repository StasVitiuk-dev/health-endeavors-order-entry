# Printing the day pack at 8:00 AM: the set-up on the Mac

Written November 24, 2026. Status: PROPOSED. OWNER ACTION REQUIRED (about 15 minutes, done together, one step at a time with screenshots).

The owner decided on Nov 24: every day at 8:00 AM, yesterday's day pack, on the Mac next to the printer.

## How this was checked, honestly

- The steps come from Apple's own help pages, read on November 24, 2026 through web search summaries. **They were not tried on a Mac from here**, and the exact names of buttons can differ a little between versions of macOS. That is why it is done together, with a screenshot after each step.
- The dashboard's part is built and tested (PR #74, not merged yet).

## What the dashboard already does (PR #74)

On **Backups & Printouts** there is a **daily link**. When the dashboard is opened with that link, it prints yesterday's day pack by itself, **once per day per browser**. Opening the link a second time the same day prints nothing.

A web page cannot wake up by itself. Something on the Mac has to open that link at 8:00 AM. That is all the Mac needs to do.

## What must be true at 8:00 AM

1. The Mac is on (asleep is fine if it wakes, see "Waking the Mac" below) and you are logged in to the Mac.
2. The browser is signed in to the dashboard. If the sign-in has run out, the link opens the sign-in page; after you sign in, it prints.
3. The printer is on and has paper.

## Way A (recommended to try first): the Shortcuts app

Needs **macOS 26 or newer** (Apple added automatic "time of day" shortcuts to the Mac in that version). To see the version: Apple menu → About This Mac.

1. On the dashboard: **Backups & Printouts** → the box about automatic printing → **Copy the link**.
2. Open the **Shortcuts** app on the Mac. Make a new shortcut. Search the actions for "open" and add **Open URLs**. Paste the copied link into it. Name the shortcut "Print day pack".
3. In the shortcut: **Edit → Automation**. Choose **Time of Day**, set **8:00 AM**, **Daily**, and choose to run it automatically (without asking).
4. Test it once: press the shortcut's play button. The dashboard should open and the print window should appear.

## Way B (works on older macOS too): a Calendar alert that opens a file

1. On the dashboard: copy the daily link (as in Way A, step 1).
2. Open the link in Safari, then drag the address from the address bar onto the Desktop. This makes a small file that opens the link. Name it "Print day pack".
3. Open **Calendar**. Make a new event at **8:00 AM**, repeating **Every Day**.
4. In the event: **Alert → Custom…**. Choose **Open file**, then choose the file from step 2. Set it to the time of the event.
5. Test it once by moving the event to two minutes from now, then move it back to 8:00 AM.

## Waking the Mac (only if it is asleep at 8:00 AM)

Apple's help page describes one command, typed once into the **Terminal** app, that makes the Mac wake at a set time. For every day at 7:58 AM it would be:

```
sudo pmset repeat wake MTWRFSU 07:58:00
```

- It asks for the Mac's password (typed on the Mac, never in chat).
- `pmset -g sched` shows what is scheduled. `sudo pmset repeat cancel` removes it again.
- The letters for the days (`MTWRFSU`) follow the pattern on Apple's page, which shows a single day (`M`); the all-days form is to be confirmed on the Mac with the first test.
- This is optional. If the Mac is simply left on, it is not needed.

## One click remains, unless the browser is changed

When the link opens, the browser shows its **print window**, and someone presses **Print**. A web page is not allowed to skip that window. Printing with no click at all needs the browser to be started in a special automatic printing mode, which also prints everything else that browser is asked to print without asking. **My recommendation: keep the one click at the start.** If it becomes a nuisance, the automatic mode can be set up later in a separate browser used only for this.

## Keep in mind

- The printed pages hold customer names and orders. Keep them in the business folder.
- If the Mac was off at 8:00 AM, nothing is lost: open the daily link any time that day and it prints once. A missed day can always be printed by hand on Backups & Printouts by choosing the day.

## Sources

- Shortcuts on Mac, automations: https://support.apple.com/guide/shortcuts-mac/add-automations-apdfbdbd7123/mac
- What is new in Shortcuts for macOS 26: https://support.apple.com/en-us/125148
- Open URLs action: https://support.apple.com/en-gb/guide/shortcuts-mac/apdaf74d75a5/mac
- Calendar on Mac, alerts ("Open file"): https://support.apple.com/guide/calendar/icl1012/mac
- Scheduling a Mac to wake in Terminal: https://support.apple.com/guide/mac-help/schedule-your-mac-to-turn-on-or-off-mchl40376151/mac
