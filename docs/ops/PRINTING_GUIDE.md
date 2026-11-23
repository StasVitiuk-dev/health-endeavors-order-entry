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

### Elegant layout (owner requests, Nov 23: "luxury, professional, high level and elegance", then "more elegance, more business casual")

`CURRENT` on the branch; the owner can still switch the typefaces. The invoice, packing slips and
labels use two typefaces instead of the system font:

- **EB Garamond** (a classic book serif) for names, the order number, quantities on the label,
  item descriptions on Letter pages (italic) and the total.
- **Source Sans 3** (a calm, readable sans) for everything else, with lightly spaced small
  capitals for labels such as BILL TO, ITEM, QTY and the document name.

Three pairings were shown to the owner side by side: A Classic (EB Garamond + Source Sans 3,
chosen as the default), B Editorial (Playfair Display + Lato), C Couture (Cormorant Garamond +
Jost, the first try, more fashion-like). Switching is a change of `assets/print/he-print-fonts.css`
and the font files only; the layout stays the same.

Layout: the wordmark centred over the document name and a thin-over-thick double rule; hairline
rows instead of boxes; a double rule over the total; at the foot a short rule, the swirl, a line in
italic serif ("Thank you for choosing Health Endeavors." on invoices and labels, the label's
tagline on Letter slips) and, in small capitals, "WE APPRECIATE YOUR BUSINESS" (owner's choice;
it replaced "With gratitude · Health Endeavors"). A contact line (website · email · phone) can be
added there once the owner gives the details (`OWNER DECISION REQUIRED`). Product names lead on
invoice lines in the serif with the SKU as a small line above; money columns are right-aligned
with figures that line up. Black only, as before. The 4 × 6 label uses heavier text (no thin weights) and rules of at least 0.75 pt, because
thermal printers lose very thin lines; it still holds 7 item lines per label.

Both typefaces are free, open-licence fonts (SIL Open Font License 1.1; licence files in
`assets/fonts/`). They are stored in this repository because the page's security policy allows
fonts from this site only; nothing is fetched from Google or any other service. They are declared
in `assets/print/he-print-fonts.css` and are fetched only when a printout screen opens
(`preloadPrintFonts()`), so they don't slow down the rest of the dashboard. If they ever fail to
load, the printout falls back to Georgia / Helvetica.

Rollback: replace `assets/print/he-print.css`, `assets/print/he-print-label.css` and
`assets/owner-login-app.js` with the previous versions and remove the `he-print-fonts.css` link
from `owner-login.html`.

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
The two typefaces really load (not the fallback) and the invoice title, total and label order
number use them.
A deliberate break (the black-ink sheet turned off) makes the black-ink test fail, as it should.

## Still to check on the real printers (when they arrive)

0. Print the two test pages (Orders → Packing slips) and measure the 1-inch square.
1. Brother: print the invoice preview; check it is black only and nothing is cut off.
2. Rollo: print the 4 × 6 label slip from iPhone (AirPrint) and from the computer; check the size
   and that the text is sharp.
3. Send me a photo of each (blur any real customer details).
