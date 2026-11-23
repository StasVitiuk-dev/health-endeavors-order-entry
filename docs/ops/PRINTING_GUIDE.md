# Printing guide: the owner's two printers (Nov 23)

Status: CURRENT for the dashboard's print layouts (tested locally) · real printers NOT yet tested.

| Printer | Kind | Used for | Paper |
|---|---|---|---|
| Brother MFC-J1365DW | Wireless colour inkjet all-in-one | Invoices, packing slips, reports, backup printouts | US Letter |
| Rollo Wireless Label Printer | Direct thermal (no ink), Wi-Fi and AirPrint, black only | Shipping labels; 4 × 6 packing slips | 4 × 6 in labels |

## What the dashboard prints

| Button (Report History → Invoice preview) | Paper | Printer |
|---|---|---|
| Print invoice (US-Letter) | Letter | Brother |
| Print packing slip | Letter | Brother |
| Print 4×6 label slip | 4 × 6 in | Rollo |

**For real orders (Nov 23):** with the preview switch "Packing slips" on, every order on the
Orders page has **4×6 slip** (Rollo) and **Letter slip** (Brother) buttons. The slip shows the
order number large, who it is for, each item with its quantity, a blank Lot column to write by
hand and "Packed by / Checked" at the bottom; never prices. An order with more than 7 lines
continues on a second label with the heading repeated. The same box has a **test page** for
each printer: a frame that must show on all four sides and a square that must measure exactly
1 inch. An order with no lines on file says so and opens no print window.

- **Black ink only.** Every printout is black text and black lines on white, whatever look, colour
  or dark mode is on screen, so the Brother uses only its black cartridge (no colour ink).
  Before Nov 23, printing while the dashboard was in dark mode printed grey text and grey lines;
  fixed by `assets/print/he-print.css`.
- **4 × 6 label slip.** Bigger, bolder text, solid black lines (thermal printers turn grey into
  speckles), the order number large, at most 7 items per label (more items continue on the next
  label with the heading repeated), never prices. The 4 × 6 paper size is switched on only while
  this slip prints (`assets/print/he-print-label.css`); invoices and reports stay Letter.
- **Shipping labels** (with the carrier barcode) come from Shopify Shipping, which prints 4 × 6
  directly to the Rollo. The dashboard's slip is a packing slip, never a carrier label.

## Brand on every printout (owner request, Nov 23)

Every printout (invoice, both packing slips, daily recaps, manuals) starts with the black
**Health Endeavors** wordmark from the product label and the document's name in capitals, over a
strong rule; packing slips and invoices end with the swirl and a thank-you line (Letter packing
slips also carry the label's tagline, "Allow yourself to indulge in the Sea of Vitality and
Beauty."). Black only. The logo was traced from the owner's label picture into clean outlines
(`assets/brand/he-wordmark.svg`, `assets/brand/he-swirl.svg`); the owner's original artwork file
can replace them later for perfect edges. The logo is public on the products already, so keeping
it in this public repository discloses nothing new.

## Settings to choose in the print window

- Brother: paper Letter, scale 100 %. Optional: "Black & White" / "Greyscale" in the printer's
  options (the dashboard already prints black only).
- Rollo: paper size 4 × 6 (or 100 × 150 mm), margins None, scale 100 %.

## Checks (local; nothing sent to a printer)

`tests/specs/printers-ext22.spec.js`: the label model (7 lines per label, heading on each, no
prices); the 4 × 6 sheet on only while a label prints and back to Letter after; the test browser's
own PDF of each printout has the right paper (label 288 × 432 points = 4 × 6 in; invoice and slip
612 × 792 = Letter); every element of every printout black on white in dark mode, today's look and
all three new looks. With the existing print checks: 17 passed, 10 skipped on purpose (run once).
A deliberate break (the black-ink sheet turned off) makes the black-ink test fail, as it should.

## Still to check on the real printers (when they arrive)

0. Print the two test pages (Orders → Packing slips) and measure the 1-inch square.
1. Brother: print the invoice preview; check it is black only and nothing is cut off.
2. Rollo: print the 4 × 6 label slip from iPhone (AirPrint) and from the computer; check the size
   and that the text is sharp.
3. Send me a photo of each (blur any real customer details).
