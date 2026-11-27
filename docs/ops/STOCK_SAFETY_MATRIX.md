# Stock safety: every case, and where it is proven (or what it waits for)

Status: CURRENT · written 2026-11-27 (night). Nothing here is installed or switched on in production: the
stock functions (drafts 10, 21, 17) and partial receiving (draft 40) are drafts tested on throwaway
databases (`sql-review/ITEM_20_…`, `ITEM_5_…`). Rules kept: the owner's rules of Nov 22 (D-ops-5: stock
changes only when the owner, and since Nov 24 an administrator, approves what staff recorded); declined
items stay declined.

## The worked example (every quantity checked)

`sql/local-test/stock_example_20_8_12_3_test.sh` (17 of 17), starting at 0 Available, 0 Damaged:

| Step | Who | Available / Damaged | Order line: ordered / received / outstanding | Order |
|---|---|---|---|---|
| start | — | 0 / 0 | 20 / 0 / 20 | Ordered |
| 8 arrive: staff record, owner approves | staff, owner | 8 / 0 | 20 / 8 / 12 | Ordered |
| 12 arrive | staff, owner | 20 / 0 | 20 / 20 / 0 | Received |
| 3 sent back to the supplier, replacement expected (nothing moves until approved) | staff, administrator | 17 / 0 | 20 / 17 / 3 | Ordered again |
| the 3 replacements arrive | staff, owner | 20 / 0 | 20 / 20 / 0 | Received |
| a customer returns 3 of 5 sold: awaiting inspection (not for sale) | staff | 20 / 0 | — | — |
| the owner decides: 2 sellable, 1 damaged | owner | 22 / 1 | — | — |

Starting stock plus every stock movement equals today's stock (22 / 1), and every movement names who
approved it.

## Every case

| Case | Today (proven on a throwaway database) | Where |
|---|---|---|
| Receive a delivery all at once (no half-saved delivery after a dropped connection) | R1 `receive_purchase_order` | drafts/10; `stress_test.sh`, `true_concurrency_test.sh`, `install_package_test.sh` |
| Partial receiving (8 now, 12 later) | yes | drafts/40; `partial_receiving_test.sh` §1, the worked example |
| More than outstanding is refused | yes | `partial_receiving_test.sh` §2 |
| Rejected units stay outstanding, with a reason | yes | §3 |
| Damaged on arrival goes to Damaged, not for sale | yes | §4 |
| Surplus waits for the owner's decision | yes | §5 |
| Two approvals of the same delivery at the same moment | one goes through, never received twice | §6 (ten at once: one approval, one movement) |
| Double click or lost reply when recording | one record ("duplicate") | §1, §8 (each request carries its own key) |
| Return to the supplier, with or without a replacement | yes | §7, the worked example |
| Customer return: inspection first; sellable / damaged / opened (never restocked) | yes | §8, the worked example |
| Corrections: linked, with a reason and the approver; the original stays | yes | §9 |
| The stock history cannot be written, changed or deleted by hand | yes | §10 |
| A stock adjustment, a recall quarantine, a return restock, deleting an unused product, each all at once and retry-safe | R4, R2, R3, R5 | drafts/10; `stress_test.sh`, `concurrency_test.sh`, `extreme_stress_test.sh` |
| A purchase-order line changed while that order is being received | refused | drafts/17 |
| A new record saved twice after a dropped connection | refused by the request key | drafts/19, 27; `request_keys_test.sh`, `request_key_scale_test.sh` |
| Stock-count corrections need the owner's or an administrator's approval, applied once | yes | drafts/34; `stock_count_adjustments_test.sh`, `stock_count_apply_once_test.sh` |

## Not built, and what each waits for

| Case | State | Waits for |
|---|---|---|
| An order reserves stock when it is placed; a cancellation releases it | **not built**: the `reserved` bucket exists, nothing fills it automatically; orders change stock only through a person's adjustment | the owner's decision on one stock count for every channel (task "One stock count for all channels") and R9 |
| A Shopify order message arriving twice, or an older one after a newer one | **UNKNOWN for today's order import**: it runs in the private backups repository, which Claude does not open. Nothing in this repository lowers stock from a Shopify order | R9 (when built: one record per Shopify order id; a message older than the stored one is ignored; replaying a message changes nothing) |
| The money side of Shopify payouts arriving twice | each difference is recorded once (`issue_key` unique, `on conflict do nothing`) | drafts/42 (not installed) |

No live stock write is switched on by any of this; each stock button keeps today's behaviour until its own
switch is turned on after its draft is installed (item 20).
