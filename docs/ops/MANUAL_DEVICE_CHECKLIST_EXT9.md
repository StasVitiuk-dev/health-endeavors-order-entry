# Manual device and browser checklist (15 minutes)

**Status:** CURRENT (2026-10-10, extension 9). The automated tests run in Chromium only, at desktop and iPhone sizes. These checks need real devices and only a person can do them. Do them on the **live site after a merge**, signed in as yourself. Change nothing: just look and tap. Send a screenshot where it says so.

## A. iPhone, Safari (5 minutes)

1. Open the dashboard link and sign in. ✔ The page fits the screen; nothing is cut off at the right.
2. Tap ☰ → Inventory. ✔ The menu closes; Inventory opens; the Back gesture returns to Home.
3. Home: scroll to "Checks: what needs a look". ✔ Each row's buttons can be tapped without zooming.
4. Open a document or receipt link (Documents or Expenses). ✔ It opens (iPhone Safari may block pop-ups: if nothing happens, screenshot).
5. Rotate the phone sideways and back. ✔ Nothing overlaps.

## B. iPhone, VoiceOver (5 minutes)

Settings → Accessibility → VoiceOver → On (triple-click the side button toggles it if set up).

1. On Home, swipe right repeatedly. ✔ You hear the page headings ("Business health — right now", "Checks: what needs a look") and each check's text, then its buttons by name ("Open", "Hide until it changes").
2. Double-tap "Why is this here?". ✔ It says "expanded" and reads the reason.
3. Open the menu (☰). ✔ It reads the page names; double-tap one opens it.
4. Trigger a harmless message: on Expenses, tap "Add" with nothing filled in. ✔ The error is read out.
5. Turn VoiceOver off.

Send: one line per step that did **not** work, with a screenshot.

## C. Desktop Safari and Firefox (5 minutes)

For each browser: sign in; open Home, Orders, Inventory, Accounting; press Cmd+K (search) and type an order number; press Escape. ✔ Same as in Chrome; no blank areas; no error banner you don't expect.

## What is NOT claimed until this is done

Real-device VoiceOver behaviour, iPhone Safari pop-up handling for signed file links (X6-22), and Safari/Firefox rendering are **not verified**. Automated checks cover: keyboard reachability, accessible names, live regions, focus order in dialogs, 200% text at 320 px, sideways-scroll at 320–768 px (Chromium).
