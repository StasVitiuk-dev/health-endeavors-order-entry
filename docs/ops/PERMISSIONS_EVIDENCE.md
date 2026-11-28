# Who may do what: where the server enforces it, and how sure we are

Status: CURRENT · written 2026-11-27 (night). A hidden button is never the protection: every row below is
enforced by the database (row rules, the functions' own checks, the account guard) and proven by calling
the database directly, as each person, on a throwaway copy, including the attempts a page would never
make. Nothing here is installed in production unless it says so.

## Proven on throwaway databases (drafts waiting for install)

| Rule (latest owner decision) | Attempts that must fail, and do | Proof |
|---|---|---|
| Accounts: each level looks after the levels below it; owner accounts untouchable; nobody raises their own level (Nov 25) | administrator → other administrator, owner, own level, "make administrator"; manager → manager, administrator; employee → anyone; "make owner" even by the owner; the emergency account; agent accounts; a switched-off account; a visitor; **going around the functions with a direct `update profiles`** (role, emergency mark, email, account number, switch-off) | `people_levels_test.sh` (95 checks), drafts 62/64 |
| Who sees which account | administrator: no owner, no other administrator; manager: no other manager; employee: only themselves; switched-off: only their own row; visitor: nothing | same, §3 |
| Deliveries and returns: staff record, the owner **or an administrator** approves; stock moves only then (D-ops-5, Nov 22; administrators Nov 24) | staff approve; a switched-off administrator approves; staff change the record directly; anyone writes, changes or deletes a stock movement by hand | `partial_receiving_test.sh`, `stock_example_20_8_12_3_test.sh`, drafts/40 |
| Managers decide deliveries and returns **someone else** recorded (your choice A, Nov 25) | a manager decides their own | `managers_approve_stock_test.sh`, drafts/66 (install only after 40 and 62) |
| Supplier documents: the owner or an administrator approves; a manager approves one someone else recorded (Nov 24–25) | staff approve; a switched-off administrator approves; a manager approves their own | `supplier_documents_test.sh`, drafts/36 |
| Uploaded supplier files: private; uploaded once into the document's own folder; opened only by the owner, administrators and managers | visitor or other staff upload; a switched-off administrator uploads; a file outside its folder; a second upload; the uploader opens it; staff list the bucket; **anyone replaces or deletes a file, owner included** | `supplier_document_files_test.sh` (41 checks), drafts/38 |
| Shared settings: the owner and administrators save; staff read only the "staff" ones | staff, a manager, an AI agent account, a switched-off account, a visitor; staff writing the table directly | `shared_settings_test.sh` (57) — **installed in production** (drafts 50, 74) |
| Tax rates, invoices, email campaigns, stock-count approval | staff and switched-off accounts refused; owner-only steps owner-only | the tests of drafts 46, 32, 56, 34 |
| Every change is recorded with who did it | the history log row under the person who acted | `shared_settings_audit_id_test.sh`, `people_levels_test.sh` §10 |

## Not proven here, and why

| What | State | What closes it |
|---|---|---|
| The row rules and grants on your **existing** tables (orders, inventory, products, expenses, …) | **UNKNOWN**: Query G (`06_READONLY_G_permissions_inventory.sql`) has never been run; the local copy's rules for those tables are stand-ins | you run Query G (read-only); any fix becomes its own reviewed draft (launch plan, permissions) |
| Your private history hidden from administrators | **evidenced, not tested locally**: production already does it (your second read-only look, Nov 25) | — |
| History exports | the export button saves only what the database returned to that person; the database function (`employee_activity`, production's own, hardened by step 18) decides what is returned | Query G for the rest |

## Open decisions (not invented here)

- Managers approve stock (drafts/66): prepared for your choice A; installed only if you confirm when its turn comes.
- Two-step sign-in: deferred to the last launch lines (your decision).
