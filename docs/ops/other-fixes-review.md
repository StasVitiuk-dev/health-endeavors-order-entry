# R5, R7, approval queue, PO state checks, PO Cancel, S10 — recommendations

**Status:** review only, 2026-10-04. No dashboard behaviour was changed. Line numbers refer to `owner-login.html` on `main` (`d3db7bc`).

**One pattern is already proven in this codebase.** Task buttons v2 (lines 5665–5685) change status with a *conditional* update:

```js
.update({ status: to }).eq('id', id).in('status', allowedFrom).select('id, status')
```

If no row comes back, they show "That task was already changed (by someone else or an agent)…". The database applies the condition and the change in one step, so two people can never both win. The approval-queue, PO-status and return-status fixes below should **reuse exactly this pattern**. It needs no SQL and no new permissions.

## R5 — product delete wipes stock first (line 8031)

**Today:** the page deletes the `inventory` row, ignores any error, and then tries to delete the product. If the product is in use, the product delete fails, but the stock row is already gone.

**Recommendation:** use the database function `delete_unused_product` (draft in `sql/drafts/10_…`):
- it refuses when the product has stock
- it refuses when the product is in use
- either way it keeps the stock row, because the failed delete rolls back together

This was tested locally.

**Quick stop-gap, if the function must wait:** stop deleting the stock row from the page. Delete the product first, and the stock row only if that succeeds. This depends on the real foreign key between `inventory` and `products`: if it is `ON DELETE RESTRICT`, the product delete can never succeed while the stock row exists. Query A will show which.

**Owner decision:** D-ops-2 (the function is recommended).

## R7 — Supabase library loaded unpinned from a CDN (all 6 pages)

**Today:** `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`. This means "whatever the newest 2.x is". A new release (one was published 2026-10-02) silently changes the code that holds staff sessions, with no review, no hash check and no rollback.

**New facts (2026-10-04):**
- The CDN is blocked from Claude's environment, but the **npm registry is reachable**, and jsDelivr serves npm package files unchanged.
- Version 2.117.2 is the newest 2.x today, so it is very likely what the live pages already load. It is also exactly the version the test suite has always served in place of the CDN (`tests/helpers/mock-supabase.js`).
- Integrity hash of `@supabase/supabase-js@2.117.2/dist/umd/supabase.js`, computed from a fresh npm download and matching `package-lock.json`'s verified copy:
  `sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok` (217,945 bytes)

**Options:**

**A — pin plus integrity (recommended):** in all 6 pages:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"
        integrity="sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok"
        crossorigin="anonymous"></script>
```

If the CDN ever served different bytes, the browser refuses the script. The pages then fail visibly (login stops working) rather than running altered code. It is a one-line change per page. The tests keep working, because the mock matches the URL prefix.

**B — host a copy in this repo** (`vendor/supabase-js-2.117.2.js`, about 213 KB): no third-party CDN at all at runtime. But the repo now carries the library, and upgrades become a deliberate file replacement.

**Owner check after deploying A:** open the dashboard, log in, and check that the browser console shows no "integrity" error. **Rollback:** revert the PR.

**Owner decision:** A or B (A recommended). Then a small PR touching the 6 pages, with a test that every page has a pinned URL and an integrity attribute.

## Approval queue race (lines 6907–6925)

**Today:** Approve and Deny run `update … where id = X` with no status condition:
- two staff can act on the same request
- the second click overwrites the first: approved, then denied
- an already-decided request can be re-decided from a stale page

**Recommendation:**
- the Task-v2 pattern: `.eq('id', id).eq('status', 'pending').select('id, status')`
- if no row comes back: "Someone already decided this request — the list has been refreshed", then reload
- keep the existing password re-check

**Before coding:** confirm the exact pending status value (Query B lists the statuses).

**Owner decision:** none really (a decided request should stay decided). Just confirm.

## PO status checks and the Cancel-after-Receive bug (lines 4514–4529)

**Today:** Mark ordered, Mark shipped and Cancel write `status = next` unconditionally.

**Concrete consequence (new):** a PO page left open in another tab still shows **Cancel** after the order was received elsewhere. Pressing it changes `received` to `cancelled`, while the stock and the expense stay recorded. Reports would show a cancelled order whose goods were counted and paid. Query B counts any existing cases ("cancelled but stock was received").

**Recommendation:**
- the Task-v2 pattern with an allowed-from map:
  - `ordered` ← `draft`
  - `shipped` ← `ordered`
  - `cancelled` ← `draft`, `ordered` or `shipped`
- if no row comes back: "This order was already changed — refreshed"
- receiving is protected separately by the R1 function, which locks the PO

## PO Cancel has no confirmation

**Recommendation:** use the same two-press "Really cancel?" pattern the page already uses for product delete (lines 8020–8027). It is consistent and keyboard-friendly. Optionally require the password re-check only for orders already `shipped` (money may be committed).

**Owner decision:** two-press confirmation (recommended), or also the password for shipped orders.

## S10 — files left in storage when a save fails

This affects three places, not two:
- evidence (`evidence-files`, line 7351)
- documents (`document-files`, line 7559)
- **expense receipts** (`expense-receipts`, line 8669)

**Today:** the file uploads first, then the database row is inserted. If the insert fails, the file stays in storage with nothing pointing to it. This is not a leak to the public (the buckets are private and use signed links), but it wastes space and may keep personal or legal material nobody can see.

**Recommendations, by bucket:**
- **Documents and expense receipts:** after a failed insert, delete the just-uploaded file (best effort; it needs a storage delete policy for staff).
- **Evidence:** evidence can sit under legal hold, and automatic deletion of evidence files may be deliberately impossible, and arguably *should* be. Instead:
  1. insert the evidence row first (with `file_path` empty)
  2. upload
  3. set `file_path`

  A failed upload then leaves a visible row saying "file missing", never an invisible file.
- **For all three:** a periodic **read-only** owner query listing storage objects with no matching row, so the owner decides what to delete.

**Owner decision:** whether evidence files may ever be deleted automatically (recommended: never).

## New findings, not in earlier reviews

| # | Severity | Finding | Where | Recommendation |
|---|---|---|---|---|
| N1 | 🟠 Medium | **Lot-number lookup uses `ilike`**, so `_` and `%` in a typed lot number are wildcards. `A_1` matches an existing `AB1` and adds stock to the wrong batch (traceability for recalls). Several matches make the receive fail half-way. | 4568–4570 | Fixed in the R1 function (exact case-insensitive match). Query B counts lots containing `_`/`%`. |
| N2 | 🟠 Medium | **Return restock uses the whole order line's quantity.** There is no "units returned" field, so returning 1 of 3 restocks 3. | 8259, 8327 | The R3 function has an optional quantity (D-ops-5). |
| N3 | 🟠 Medium | **Cancel after Receive** (above) marks received goods as cancelled. | 4514–4529 | Conditional status update. |
| N4 | 🟠 Medium (accounting) | **Accounting ignores refunds recorded on the Returns page.** Revenue is based only on `orders.status`; `returns.refund_amount` is never subtracted. For manual and wholesale orders nothing changes the order status, so profit is overstated by every refund recorded there. | `loadAccounting` 8727+ | **Owner/accounting decision:** subtract recorded return refunds from revenue, or require the order status to change. Not changed (accounting logic). |
| N5 | 🟡 Low/Medium | **Mark Refunded has no state check or cap.** Any amount (even above the line's value) from any state; a second click overwrites the amount. | 8388–8410 | Conditional update (from `received` only) and a cap at the line value (D-ops-7). |
| N6 | 🟡 Medium (compliance) | **Release legal hold is one click**: no confirmation, no password re-check. It isn't listed in the security review's S6 coverage table. | 7753–7768 | Two-press confirmation plus `requireReauth('release this legal hold')`. |
| N7 | ℹ️ Design limit | **Stock is tracked per product, not per lot.** A recall assumes the lot's remaining units are all still in Available. | recall logic | Document. Lot-level buckets are a future design topic, not a launch fix. |
| N8 | ℹ️ Process | **R7 risk is live:** `@2` moved to a new release on 2026-10-02 without review. | all pages | Pin (above). |
| N9 | 🟡 Low | **The PO expense date uses the UTC date** (tomorrow's date in US evenings). It was deliberately left out of PR #11 as accounting-adjacent. | 4617 | D-ops-3: the R1 function takes the business date. |

## More findings (second pass, 2026-10-04)

| # | Severity | Finding | Where | Recommendation |
|---|---|---|---|---|
| N10 | 🟡 Medium (tax records) | **"Remove receipt" permanently deletes the receipt file from storage in one click.** There is no confirmation and no recycle bin, unlike expenses themselves, which are soft-deleted. The code comment says this is deliberate ("owner-only page"). But receipts are tax records that normally must be kept for years. | `removeExpenseReceipt` ~8564 | **Owner decision:** two-press confirmation at least. Better: unlink only (clear `receipt_path`, keep the file) and leave real deletion to an owner-run cleanup. |
| N11 | 🟡 Medium (compliance) | **"Mark reported to FDA" is one click**, with no confirmation and no undo button. It doesn't record who marked it (unless an audit trigger does; Query A shows triggers). A mis-click silently clears an FDA deadline from view. | ~7654 | Two-press confirmation; record `fda_reported_by`; optionally ask for the FDA report reference. Test: `ops-findings.spec.js`. |
| N12 | 🟡 Medium (compliance) | **"Mark resolved" is offered on a recall whose stock was never quarantined.** One click resolves it (an empty note becomes "Resolved."). That removes it from Needs Your Attention and hides "Quarantine stock" for good. There is no status condition either, so it can race with Quarantine. | 4897, 4992–5010 | Require a written note; if the recall is still `initiated`, ask "Stock was never quarantined — resolve anyway?". Conditional update from `initiated`/`quarantined`. Test added. |
| N13 | 🟠 Medium (stock and money) | **A stale Returns page can re-open a finished return.** Approve/Reject write `status` with no condition. A tab opened while a return was `requested` can later turn a `refunded` (or `closed`) return back into `approved`. Mark Received then appears again and **restocks a second time**, and Mark Refunded can **record a second refund**. The R3 function's "not approved → already done" check cannot catch this, because the status really is `approved` again. | 8275–8291, 8298–8310 | Task-v2 conditional updates for every return status change: Approve/Reject from `requested`; Close from `rejected`, `received` or `refunded`; Refunded from `received` (N5). This should land **with or before** R3. Test added. |

Lower impact, noted only:
- Inquiry "answered" (6238) has no status condition. Harmless.
- Feature-request advance (7144) reads, then writes, so a double click can skip a status. Harmless.

| # | Severity | Finding | Where | Recommendation |
|---|---|---|---|---|
| N14 | 🟠 Medium/High (tax, accounting) | **Accounting and Tax Records totals may silently stop at 1,000 rows.** `loadAccounting` (~8727) and `loadTaxRecords` (~8821) fetch every order and expense in the range with no paging. Supabase's API returns at most its "Max rows" setting per request (1,000 by default) and **does not report an error** when it cuts the list short. An "All time" or full-year view with more than 1,000 orders or expenses would understate revenue, expenses and the tax export, with nothing on screen saying so. Not a problem today (no real orders yet); it becomes one after launch. | 8727+, 8821+ | Totals from a database function (`sum` in SQL, one row back) rather than adding rows in the browser; or page with `.range()` until a short page comes back, and show the row count. **Owner check:** Supabase → Project Settings → API → "Max rows". |

Also checked: the Accounting/Tax date boundaries use local midnight, which gives the correct day in US time zones. Partial refunds count the full order total but are listed under "needs review" (existing, documented behaviour).
