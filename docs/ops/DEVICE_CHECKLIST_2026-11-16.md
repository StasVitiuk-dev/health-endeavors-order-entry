# Real-device checks: Mac Safari, iPhone, VoiceOver

Status: CURRENT · 2026-11-16 · For: Stas · checks only you can do
These replace the earlier list of 15. The test browser here is Chromium on Linux;
it imitates an iPhone screen size but is not Safari, not an iPhone, and not VoiceOver.

## Where to do them

Open the preview link for the build under review (it is in the latest update and in
the review package's `README.md`). It is a copy of the dashboard with made-up data;
nothing you do there reaches the real database, Shopify or e-mail. Press **Sign in
as the synthetic owner**. Preview switches are on the **Feature Flags** page.

If the link shows a blank page, use the review package instead (its README has the
two Terminal lines), and tell me, so I know the link does not work on your device.

## How to report a failure

Send me, for each check that fails: **the check number** (for example "S3"), a
**screenshot** (iPhone: side button + volume up; Mac: Shift-Command-4), and one
sentence on what you expected and what you saw. For VoiceOver, write down what it
said. I stop, fix only that, and send you a new link to check again.

## Mac Safari (5)

| # | Do this | You should see |
|---|---|---|
| S1 | Employee Activity: look at the two dropdowns "Any time" and "All areas" | one arrow each, at the right edge; the words are not covered |
| S2 | Inventory, then Purchase Orders, Suppliers, Returns, Expenses: look at the add forms | boxes in one row have the same height and line up; corners are square; blue buttons are rectangles, not pills |
| S3 | Open any dropdown | Safari's own menu opens (it looks like a Mac menu). That is expected: only the closed box is styled |
| S4 | Feature Flags → switch on "Invoice preview"; Report History → **Print invoice** | one US-Letter page; at the top "DRAFT — TAX PENDING, NOT A FINAL INVOICE"; "Invoice (draft — numbered when issued)"; Tax and Total say PENDING, never $0.00 |
| S5 | Press the theme button (half moon) until the page is dark; visit Home, Orders, Inventory | every page stays readable; blue text on outlined buttons stays readable when the mouse is over it |

## iPhone, Safari (5)

| # | Do this | You should see |
|---|---|---|
| P1 | Sign in, open the menu (☰), pick Orders | one card per order; nothing scrolls sideways |
| P2 | Returns | on every return the buttons sit under the text; the refund box reads "Refund $" in full |
| P3 | Tap into any field (for example Inventory → Product name) | the page does not zoom in |
| P4 | Turn the phone sideways on Inventory | the form fields still line up |
| P5 | Pull down on a page | it refreshes; nothing is lost |

## VoiceOver (5) — Mac: Command-F5 · iPhone: Settings → Accessibility → VoiceOver

| # | Do this | You should hear |
|---|---|---|
| V1 | Move through the left menu | each page read as a link; the page you are on as "current page" |
| V2 | Enter (Mac) or double-tap (iPhone) on "Expenses" | "Expenses page opened" (or the page you chose) |
| V3 | Press ? for the shortcut list, then Escape | the list's title read first; afterwards you are back where you were |
| V4 | Report History with "Invoice preview" on: move to the tax line | "Tax", then "PENDING", never a dollar amount |
| V5 | Feature Flags → "Supplier documents" on; Suppliers: move through a supplier's table | each cell read with its column name (Document, For, Status, Detail) |

## What changed on screen (so you know what to look for)

- **Buttons and fields:** square corners and one height. The colours are your
  original palette, unchanged.
- **Employee Activity:** one arrow per dropdown. Safari used to tile the arrow across
  the whole box and cover the text. The search box is square like the others.
- Pictures of both, before (live today) and after, are on the look review page:
  https://claude.ai/artifact/S9o8whP84v1SgoAiiEJiCa
