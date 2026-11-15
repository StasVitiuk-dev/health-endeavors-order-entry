# Owner decisions — recorded 2026-11-14 (Stas)

Status: CURRENT · These are the owner's answers to the six go-live decisions.
Recorded here as the authoritative source. Implementation is LOCAL, DRAFT-ONLY,
default-OFF and synthetic — nothing is deployed, and no real money/accounting
path changes until Stas merges to `main`.

| # | Decision | What was decided | Build status |
|---|---|---|---|
| 1 | **Tax rate & shipping** | Illinois **state rate 6.25%**; local taxes may increase it — **live combined rate stays PENDING** until the applicable local rate + sourcing rule are confirmed. Shipping is taxable when **bundled/mandatory**; **exempt when separately stated AND the buyer could avoid it** (e.g. pickup). Resale orders need a **valid resale certificate** before the exemption applies. | **Engine built** (`he-tax.js`): 6.25% state + configurable-pending local; shipping taxability rule; resale-cert gate. Combined live rate left pending by design. |
| 2 | **Payment terms** | **Due on receipt** default for new wholesale buyers; **Net 14** per approved account when credit is extended. | **Built** (terms helper): default due-on-receipt; Net-14 only for `creditApproved` accounts. |
| 3 | **Invoices** | Auto-generate **drafts**; owner reviews & **issues manually**. Number format **`HE-2026-0001`**, year rolls over annually. Official number assigned **at issue**; voided numbers **kept in the record**. | **Reconciled + tested**: numbering + year rollover + assign-at-issue + voided-number retention. |
| 4 | **Day cutoff** | Reporting day ends at **midnight Central**, `America/Chicago` (DST handled automatically). | **Built** (DST-aware business-date, additive; existing fixed-offset path unchanged). |
| 5 | **Permissions** | Owner **and `administrator`** may issue/void invoices and release held messages (owner confirmed 2026-11-14: keep administrator — "administrator should have almost all allowed"). Staff may **prepare drafts** only. | **CONFIRMED + tested.** Engine permits owner OR administrator; staff hard-blocked from issuing/voiding. No change needed — matches the owner's confirmation. |
| 6 | **Export destination** | Manual downloads to a dedicated **"Health Endeavors Exports"** folder on the Mac; **encrypted location** for exports with customer details. Automatic Mac sync **later**, after a destination is chosen and a restore is tested. | **Recorded**: export label default classification = CONFIDENTIAL; destination is a Mac-side/owner step; auto-sync stays OFF. |

## What "built" means here (and what is not yet applied)

Each decision exists as tested, draft-only logic. Updated later on Nov 14 — the
tax, terms and day-cutoff rules now work **inside** the invoice and report engines
instead of beside them:

- **Tax (1):** the invoice engine itself now follows the rules: mandatory shipping is
  part of the taxed amount, a valid resale certificate makes the order tax-free, and
  **a draft whose rate is still pending cannot be issued** — by the owner or an
  administrator — until the local rate is confirmed (confirming it is a recorded
  revision). The invoice preview and its printout now use these rules for their own
  totals (no placeholder rate any more), show "issuing: blocked", and the printout
  says it is a draft at the state rate only. *Still open:* the real local rate has
  not been supplied.
- **Terms (2):** issuing an invoice for a named account now fills in the terms and
  the due date: due on receipt, or Net 14 (issue date + 14 days) for an account
  approved for credit. Net 14 is refused unless an approved account is named. The
  due date counts from the business day of issue (Central time), so an invoice
  issued at 10 pm Central is dated that day, not the next.
- **Day cutoff (4):** the daily roll-up can now group sales by the Central-time day,
  tested across both daylight-saving change days. *Still open:* the saved nightly
  reports are produced by a database job that is not in this repository, so nobody
  can tell from the code which cutoff it uses today. **First step, ready to run:**
  the read-only check `sql/12_READONLY_I_report_day_cutoff.sql` (Query I). It changes
  nothing and prints only counts: for each saved report in the last 45 days it counts
  that day's orders by the Central day and by the UTC day and says which one the
  report agrees with. Its first row is the conclusion — PASS (already Central),
  ACTION (uses UTC; a change is needed) or "show the result". Tested locally on
  synthetic rows (`sql/local-test/report_day_cutoff_test.sh`, 15 checks). No change
  to the job is drafted until this result is known.
- **Invoices (3):** drafts are now generated automatically from orders
  (`draftFromOrder`, `draftsForOrders`): one draft per order, none for a cancelled,
  deleted or fully refunded order or one that already has an invoice, and running it
  again creates nothing new. A draft carries the order, the account, the suggested
  terms and the tax rule; anything that does not add up (a line with no price, a
  subtotal that differs from the lines) is listed for the reviewer instead of being
  corrected. Nothing is issued or numbered — issuing stays a manual step. Shown on
  the invoice preview with example orders. *Still open:* reading real orders, and
  the screen where the owner issues a draft.
- **Numbering (3), permissions (5):** already how the invoice engine behaves.
- **Exports (6):** a procedure on the owner's Mac; nothing to switch on yet. Each
  export now carries a trace label (see blueprint item #72).

Invoices created the earlier way (no tax-decision fields, no account named) behave
exactly as before; that is tested.

Evidence: `tax-ext21`, `owner-decisions-ext21`, `invoice-decisions-ext21`,
`invoice-from-order-ext21`, `ops-preview-wiring-ext21` (tests); commits `fe9f2f0`, `9b0b2b8`, `3f850cb`,
`5bce21f`, and the Nov 14 "decisions inside the engines" commit.

## Still pending (owner/provider, not decided here)
- The **combined live tax rate** (state 6.25% + the confirmed local rate) and the sourcing rule — owner confirms before any real issue.
- Business **email provider** (report/notification delivery stays simulated until connected).
- Real **tracking/shipping** provider; real **Safari/iPhone/VoiceOver** device check.
- The safe stock-write **`adjust_inventory` (R4)** before any real stock change.

## Source references (owner-provided)
- Illinois rate guidance: tax.illinois.gov ST-1 instructions.
- Shipping rules: Illinois tax matrix (PIO-101).
- Resale certificates: tax.illinois.gov business CRT info.
