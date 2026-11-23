# Sales tax: what is built, and what I need from you to finish the setup

Status: CURRENT · 2026-11-16, answers 1 and 2 recorded 2026-11-22 · For: Stas · OWNER DECISION REQUIRED (the other answers below)
Scope: staging only (made-up data). Nothing here is live. This page is not tax
advice: it lists what the dashboard needs to be told, so you can confirm the
answers with the Illinois Department of Revenue or your accountant.

## What the dashboard does now (your decision of Nov 16)

| Rule | How it behaves in staging | Where it is tested |
|---|---|---|
| No tax rate is built in | The code holds no rate at all. A rate exists only after it is confirmed for one named place, with who confirmed it and when. Two places can have two rates. | `tests/specs/tax-ext21.spec.js` |
| Unknown tax is never shown as 0 | Until a rate is confirmed, a draft says **Tax: PENDING**, shows **Total before tax**, and has no total. On paper it prints "DRAFT — TAX PENDING, NOT A FINAL INVOICE". | `tax-ext21`, `invoice-print-view-ext21`, `ops-preview-wiring-ext21` |
| Pending tax blocks issuing | Nobody can issue a draft whose tax is pending. The database draft refuses it too, and refuses a 0 stored in place of unknown tax. | `invoice-desk-ext21`, `docs/ops/sql/local-test/invoices_test.sh` |
| Shipping stated separately and optional (for example pickup is offered) | Shipping is **not** taxed. | `tax-ext21` case 1 |
| Mandatory shipping, or shipping bundled into the price | Shipping **is** taxed. | `tax-ext21` case 2 |
| Shipping terms not recorded on the order | The tax stays pending and says that the shipping terms are missing. Nothing is guessed. | `tax-ext21`, `invoice-desk-ext21` |
| Wholesale resale with verified exemption documentation | Tax is $0.00 and the invoice names the certificate, who verified it and when. | `tax-ext21` case 3 |
| Resale claimed without verified documentation, or with an expired document | Not exempt: taxed like any other order, and the reviewer is told which piece is missing. | `tax-ext21` |
| A confirmed rate has a start day (added Nov 23) | Used only for sales on or after the day it starts (and up to its end day, if one is given). Two rates for one place: the one in effect on the sale day is used. | `tax-ext21` (dated rate) |
| Rates can change on January 1 and July 1 (added Nov 23) | After the first January 1 or July 1 since the rate was confirmed (or last re-checked), new sales stay **Tax: PENDING** with "re-check the rate" until the owner re-checks it. Nothing old is charged by mistake. | `tax-ext21` (re-check) |

The rates used in the tests and in the example screen (8%, 9%, 10%) are made-up
numbers for made-up places. They are not Illinois rates.

## Your answers so far (Nov 22)

| # | Question | Your answer (Nov 22) | What it settles |
|---|---|---|---|
| 1 | From which address are orders shipped? | One place in Illinois, for now: your own home. The lab sends finished product to you; you hold it and ship each order yourself. | The place of sale is one Illinois location. **Its exact address and ZIP are deliberately not stored in this public repository** (you asked to keep your home details private). They go only into the dashboard's tax settings, when you confirm the rate for that place. |
| 2 | A location where customers can buy or pick up in person? | No, not for now (it is a private home). This may change once there is a small warehouse or store. | Retail customers cannot pick up, so they cannot avoid the shipping charge. |

What these two answers mean (not decided yet; nothing changed in the dashboard):
- **Shipping tax (question 10 still open):** under the rule already in the dashboard,
  shipping that the buyer cannot avoid is taxed. With no pickup, shipping on retail
  orders would therefore be taxed, unless your accountant or the Department of Revenue
  says otherwise. For wholesale, it still depends on whether a buyer may use their own
  carrier (question 10).
- **Still needed before any tax can be confirmed:** question 5 (does the rate follow
  where the order ships from or where it ships to; confirm with the Illinois Department
  of Revenue or your accountant), question 4 (the full combined rate for your location,
  and the date it applies from) and question 6 (all products at the general rate?).
- Until then every non-exempt invoice keeps showing **Tax pending** and cannot be
  issued. Nothing about your address is stored anywhere yet.

## Which answers come first (added later on Nov 16)

The numbers refer to the questions below.

| Order | Questions | Why | Until answered |
|---|---|---|---|
| 1. Blocks every real invoice | 1, 2, 5, 4, 6 | Without the place of sale, the rule that picks the rate (ship-from or ship-to), the rate itself and whether the products are general merchandise, no tax figure can be confirmed. | Every non-exempt draft stays TAX PENDING and cannot be issued. |
| 2. Blocks shipped wholesale invoices | 9, 10, 3 | Whether shipping is taxed depends on how it is charged; selling into other states may bring other states' rules. | Drafts with shipping stay pending ("shipping terms not recorded"); out-of-state sales need their own confirmed rate. |
| 3. Blocks exempt resale invoices | 13, 14 | "Verified" must mean something you have decided. | Resale orders are taxed like any other order. |
| 4. Can wait: a safe default is in place | 7, 8, 11, 12, 15, 16, 17, 18, 19 | Each has a working default (tax added on top, discount before tax, owner or administrator confirms rates, etc.). | The default applies; change it when you answer. |

What still needs checking outside the dashboard, whatever the answers: questions 3,
4, 5 and 6 should be confirmed with the Illinois Department of Revenue or your
accountant. The dashboard only records what you confirm, with your name and the date.

## What I need from you

Please answer in plain words; "I don't know yet" is a fine answer, and the item
then simply stays pending. Do not send account numbers, passwords or logins.

### A. Where the sale is taxed (decides which rate applies)

1. From which address are orders shipped? (your own location, the lotion lab, a
   fulfilment service, or more than one)
2. Does Health Endeavors have a location in Illinois where customers can buy or
   pick up?
3. Do you ship to customers outside Illinois? If yes, to which states, roughly?
4. For each place a sale can be taxed: the full combined rate to charge, and the
   date it applies from. I need the place and the rate, not how you looked it up.
5. Should the rate follow the place the order ships **from**, or the place it
   ships **to**? (Illinois treats these differently depending on how the seller
   is set up; this is the one to confirm with the Department of Revenue.)

### B. What is taxed

6. Are all current products taxed at the general merchandise rate? Does any
   product carry a medical claim or count as a medicine? (That can change the rate.)
7. Are your prices tax-exclusive (tax added on top), as the examples assume?
8. Order discounts: taken off before tax, as the examples assume?

### C. Shipping

9. On a wholesale invoice, is shipping always a separate line?
10. Can a wholesale buyer avoid the shipping charge (pick up, or use their own
    carrier)? Always, sometimes, never?
11. Do you ever include a handling fee with shipping?
12. Should every order record these two facts (separate line? avoidable?) at the
    time it is entered, so the tax is never left pending for that reason?

### D. Wholesale resale

13. Which document do you collect from a reseller (for example the Illinois
    resale certificate), and where is it kept?
14. Who checks it, and how: just that the form is complete, or also that the
    registration number is valid?
15. How long do you treat a certificate as good before asking for a new one?
16. Do you sell to any tax-exempt organisations (they use a different number)?

### E. Running it

17. Who may confirm or change a tax rate in the dashboard: only you, or also an
    administrator? (Today: owner or administrator, in staging only.)
18. Online orders are taxed by the store checkout. Should a wholesale invoice
    made here use the same rates, or its own confirmed ones?
19. When an invoice is corrected by a credit note, should the tax be credited in
    the same proportion?

## What happens after your answers

- A to C settle the "tax settings" screen: the places, their rates and dates.
  Until then every non-exempt draft stays TAX PENDING, which is safe.
- D settles what "verified" means; today it means a certificate number, the
  person who checked it, the date, and an expiry date that has not passed.
- Nothing becomes live from this page. Live tax settings need your separate
  approval, and SQL draft 32 (invoice storage) needs your approval before it is
  installed.
