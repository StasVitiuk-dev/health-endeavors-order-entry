# Owner decisions: what is waiting on you (next)

**Status:** CURRENT (2026-10-06, extension 4). This is the one place listing decisions only you (Stas) can make. Each has a recommendation; nothing here has been decided for you. Answer in the chat in any order, for example "D-ops-4: yes". Nothing changes in production until you approve the specific step.

**OWNER DECISION REQUIRED** on every row below.

## Business / accounting (please decide first)

| ID | Question | Options | Recommendation | What waits on it |
|---|---|---|---|---|
| **N4** | When a refund is recorded, how should Accounting and Tax Records count it? | (a) keep today's rule: status only, refunds are not subtracted from revenue; (b) subtract the recorded refund amount in the month it was refunded; (c) your accountant's rule | Ask your accountant. Technically the dashboard is ready for (a) or (b) (`N4-refunds-accounting-map.md`) | Refund reporting accuracy |
| **D-ops-5** | Returns: record "units actually returned" (return 1 of 3)? Today the whole line is restocked | Yes, with a quantity box that defaults to the whole line / No | Yes | R3 install details; stock accuracy on partial returns |
| **D-ops-4** | Refuse a second active recall on the same lot? | Yes / No | Yes | Recall data quality (backlog INV-15) |

## Stock functions (R1–R5) rollout

| ID | Question | Recommendation |
|---|---|---|
| D-ops-1 | Rollout order of the stock functions | R1 (receive) → R4 (adjust) → R2 (recall) → R3 (returns) → R5 (delete product) |
| D-ops-2 | R5 as a database function or a quick dashboard-only stop-gap | Database function (the only version that can never lose the stock row) |
| D-ops-3 | Expense date for a received delivery | **Already handled on the branch:** the dashboard and R1 both use the Central calendar day. Please just confirm |
| D-ops-6 | Do any agents or automations change stock directly? | Query C sections 5–7 answer this; then you confirm |
| **NEW: PO line guard** | Install `drafts/17_DRAFT_po_line_delete_guard.sql` after R1? It stops a purchase-order line being removed while that order is being received. Locally, that race left stock no line explains in 2–6 of every 20 tries, even with R1 | Yes, right after R1 (small, one trigger, no data change, has a rollback) |

## Records and documents

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Document categories | Are the 7 document categories right (contract, insurance, certification, license, tax, manufacturing agreement, other)? | Keep / add (e.g. "lab report", "SDS") | Add the ones you really file. Each one is a small, approved database change |
| **Legal hold vs delete** | While a legal hold is active, may a related document or record still be deleted? | **Option 1:** block deletes of anything named on an active hold. Safest legally, but needs a database rule plus a dashboard message. **Option 2:** allow deletes, but show a warning and keep the record of who deleted what. Today nothing checks holds before a delete: orders and expenses are soft-deleted and can be restored, but a document delete also removes the stored file | Option 1 if you expect litigation or regulator requests; otherwise Option 2 with the warning. Ask your lawyer if unsure |
| Permanent product delete (X3-16) | Keep "Delete" for never-used products, or only allow Deactivate? | Keep delete for unused products (today, guarded) / Deactivate only | Keep, as today: it is refused for anything sold, received, quality-checked or recalled |

## Dashboard wording and design

| ID | Question | Recommendation |
|---|---|---|
| F3-02 | Manual orders: pick products from the catalogue (fills in the SKU) instead of typing names? | Yes, before you rely on manual orders for stock or returns |
| F3-01 | Input borders are light grey (low contrast for some eyes). Darken them? | Yes (a visual change you can see in screenshots first) |
| F3-07 | The "This Week" label means the last 7 days. Rename to "Last 7 days"? | Yes |
| Time zone (optional) | Will anyone use the dashboard regularly from outside Central time? If yes, all dates can be forced to Central | Only if yes (`TIMEZONE_CONTRACT.md`) |

## GitHub / process

| ID | Question | Recommendation |
|---|---|---|
| CI-02 | Make the automatic test run a required check before merging? | Yes, after the CI branch (`claude/tests-only-ci-v2`) is reviewed and merged. Only you can change this setting |
| CI-03 | Pin the GitHub Actions used by CI to exact versions (commit hashes)? | Yes |
| X3-25 | Backups: please check the private backups repository's **Actions** tab (read-only) and tell the session whether the latest backup runs are green. The session must not open that repository | Do this before launch |

## Also waiting on you (not decisions)

- **Query C:** run it when you choose (`QUERY_C_OWNER_RUN_GUIDE.md`). It unlocks the R1–R5 install plan.
- **Merging the branch:** it fixes bugs that are live today (manual order dates and duplicates, among others). See the extension reports for the list.
