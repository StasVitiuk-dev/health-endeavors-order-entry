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

Each decision exists as tested, draft-only logic. Three of them are **not yet used
by the screens that will eventually depend on them** — that is the remaining work:

- **Tax (1):** the rule engine is tested and shown as a worked example in the invoice
  preview ("Per your decisions" card). The invoice draft's own totals row still uses
  a placeholder rate; switching the totals to the engine waits for the local rate.
- **Terms (2):** the helpers are tested and shown in the preview; issuing an invoice
  does not yet fill in terms and due date automatically.
- **Day cutoff (4):** the `America/Chicago` day function is tested; the daily report
  roll-up still uses the earlier fixed-offset method and has not been switched over.
- **Numbering (3), permissions (5):** already how the invoice engine behaves.
- **Exports (6):** a procedure on the owner's Mac; nothing to switch on yet.

Evidence: `tax-ext21`, `owner-decisions-ext21`, `ops-preview-wiring-ext21` (tests);
commits `fe9f2f0`, `9b0b2b8`, `3f850cb`, `5bce21f`.

## Still pending (owner/provider, not decided here)
- The **combined live tax rate** (state 6.25% + the confirmed local rate) and the sourcing rule — owner confirms before any real issue.
- Business **email provider** (report/notification delivery stays simulated until connected).
- Real **tracking/shipping** provider; real **Safari/iPhone/VoiceOver** device check.
- The safe stock-write **`adjust_inventory` (R4)** before any real stock change.

## Source references (owner-provided)
- Illinois rate guidance: tax.illinois.gov ST-1 instructions.
- Shipping rules: Illinois tax matrix (PIO-101).
- Resale certificates: tax.illinois.gov business CRT info.
