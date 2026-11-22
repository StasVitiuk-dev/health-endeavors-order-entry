# Real-device checks: Mac Safari, iPhone, VoiceOver

Status: CURRENT · 2026-11-16, first five chosen 2026-11-22 · For: Stas · checks only you can do
These replace the earlier list of 15. The test browser here is Chromium on Linux;
it imitates an iPhone screen size but is not Safari, not an iPhone, and not VoiceOver.

## Where to do them

Open the preview link for the build under review (it is in the latest update and in
the review package's `README.md`). It is a copy of the dashboard with made-up data;
nothing you do there reaches the real database, Shopify or e-mail. Press **Sign in
as the synthetic owner**. Preview switches are on the **Feature Flags** page.

If the link shows a blank page, use the review package instead (its README has the
two Terminal lines), and tell me, so I know the link does not work on your device.

## Do these five first (Nov 22), about 10 minutes

They cover what the test browser here cannot imitate at all: Safari's own drawing
of form controls, Safari's print engine, a real iPhone screen, and VoiceOver.

| Order | Check | Why first | You should see / hear |
|---|---|---|---|
| 1 | **S1** (Mac Safari) | the one bug that was Safari-only: the dropdown arrow used to repeat across the whole box | one arrow per dropdown, at the right edge; the words are not covered |
| 2 | **S2** (Mac Safari) | the Nov 3 square, aligned controls, on the browser you use | same-height boxes that line up; square corners; rectangular blue buttons |
| 3 | **S4** (Mac Safari, print) | money: a draft must never print a number or a $0.00 tax | one page; "DRAFT — TAX PENDING, NOT A FINAL INVOICE"; "Invoice (draft — numbered when issued)"; Tax and Total read PENDING |
| 4 | **P1** (iPhone) | the page used most on the phone | one card per order; nothing scrolls sideways |
| 5 | **V1** (VoiceOver) | if the menu is not read properly, nothing else can be reached | each page read as a link; the current page read as "current page" |

If all five pass, the other ten can wait for a quiet moment. If one fails, send it
on its own (see below); I fix only that and send a new preview link.

## What the preview cannot exercise, and what you can check safely instead

The preview is a copy with made-up data and no real database behind it.

| Not possible in the preview | Why | Safe alternative |
|---|---|---|
| P5 "nothing is lost" across a real refresh | the preview starts again from the same made-up data on every load, so a refresh looks the same whether or not a save happened | P5 checks only that pulling down refreshes without an error; saving and refreshing is covered by the tests here (`failure-recovery`, `po-receive`), and by you on the live site after the push, on something harmless such as a reminder |
| Supplier document files (Attach file, Open file) | its storage switch is deliberately not offered as a preview, and the preview has no file storage | nothing to check now; after drafts 36 and 38 are approved and run, one made-up PDF on the live site, as you and as a staff account (item 4 of the SQL review) |
| Being signed out after a long idle time | the preview has no real sign-in session | not needed before the push; the live site behaves as today |
| Scanning a real shipping label with the camera | the preview's scan uses typed or made-up labels | Feature Flags → "Scan Shipment" on → Home → **📦 Scan Shipment** → press one of the example label buttons, or **Enter by hand**; it should find the matching made-up order and ask you to confirm. Camera use is a later step |

New since Nov 16 and visible in the preview, if you want to look (not one of the
15): Feature Flags → "Partial receiving and returns" on → Inventory. On the iPhone
each step is one card; nothing should scroll sideways.

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

## iPhone Duo, if you have one (4) — added Nov 22

The folding iPhone (on sale since Oct 23, 2026). Closed, it behaves like a phone;
open, its screen is wider than any phone this dashboard was built for. The test
browser here imitates the sizes (about 466 points wide closed, 626 open, 890 open
and sideways), but not the fold itself.

| # | Do this | You should see |
|---|---|---|
| F1 | Closed: sign in, open the menu (☰), pick Orders, then Inventory | one card per order, the add form in one column; nothing scrolls sideways |
| F2 | Open it (upright) on Orders, then Expenses | the menu is still behind ☰; orders are one card each, with the full date and the Delete button in view; the page itself never scrolls sideways |
| F3 | Open and turned sideways, on Home and Inventory | the menu stays on the left; the page next to it is readable without zooming |
| F4 | Closed on Inventory, start typing a product name; open the phone; turn it; close it again | the typed text is still there; no dark shade is left over the page; the menu is not stuck half open |

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
