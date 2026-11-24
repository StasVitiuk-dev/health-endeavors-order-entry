# One stock count for all channels: what was found, and the decision needed (Nov 24, 2026)

Status: OWNER DECISION REQUIRED · nothing built for this item yet

The owner's rule (Nov 24): selling out fast is welcome; **selling more than is in stock is not**, and
the shared stock count must prevent it.

## What was found in the repository (checked Nov 24)

- The dashboard's stock number (`inventory.available`) changes only when a purchase order is received,
  when someone adjusts it by hand, on a recall, and on a return. **No order, on any channel, lowers it,
  neither when the order is placed nor when it ships.** No agent writes to the inventory table.
- So after every shipping day the dashboard's number is higher than the shelf, until someone corrects
  it by hand.
- The orders table carries a payment status, not a "shipped" mark; shipping is recorded separately.
- A draft exists for bringing Shopify's data into the dashboard automatically (not installed).

Not verified here (general understanding of Shopify, to be confirmed in the owner's own Shopify):
Shopify keeps its own stock count per product, lowers it at checkout for every connected sales channel,
and can refuse a sale when the count reaches zero.

## The decision: which count is "the" count for selling?

**Option 1 (recommended): Shopify's count is the selling count; the dashboard mirrors it.**
Shopify already lowers stock at the moment of sale on every channel connected to it, which is exactly
the protection against overselling. The dashboard would show Shopify's number next to its own book
number, flag any difference, and keep everything Shopify does not: batches, receiving, quality, recalls.
New stock received in the dashboard would be sent to Shopify (that step writes to Shopify, so it needs
the owner's approval).
- Good: one system decides at checkout; nothing can be sold twice between two systems.
- Needs: the Shopify connection installed (a production step with a key the owner provides), and
  "continue selling when out of stock" switched off in Shopify.

**Option 2: the dashboard's count is the selling count and is pushed to every channel.**
The dashboard lowers its own count for every order and sends the new number to Shopify and the
channels, keeping a safety buffer.
- Good: one place to look.
- Risk: two systems counting the same sale; a delay between them is exactly when overselling happens.
  More to build and more that can drift.

## What can be built before the decision (same under both options)

A database step so that **every order takes its bottles off the dashboard's book count exactly once**
(and gives them back when an order is cancelled), with a record of each move. Under option 1 it keeps
the book count honest for comparing with Shopify; under option 2 it is the count itself.
NEXT after the owner's answer: that database step as a draft with a local test, then the screen.
