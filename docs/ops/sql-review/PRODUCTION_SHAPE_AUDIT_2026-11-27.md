# What every waiting database draft relies on in production, and how sure we are (audit of Nov 27)

Status: CURRENT · written 2026-11-27 (night) · nothing here was run in production. This page lists, for
each waiting draft, what it needs to find in your real database, and whether your own read-only looks
**show** it (evidenced), or whether it is **UNKNOWN** until a look is run. The local copy the tests use is
**shaped like production where the looks show it**; it is not production, and where a look is missing
the copy uses a stand-in that is marked as such.

## The evidence (only what the owner's read-only looks and installs showed)

| # | Look | Date | What it shows |
|---|---|---|---|
| E1 | Query A (18 tables) | Oct 5 | columns, types, defaults, checks, unique and foreign keys of approval_requests, audit_log, documents, evidence_locker, expenses, inventory, inventory_adjustments, inventory_lots, order_items, orders, products, profiles, purchase_order_items, purchase_orders, recalls, returns, suppliers, tasks (→ `local-test/01_REAL_SHAPE_…`). **Seven weeks old**: a change since is not seen until Query H (drift check) runs |
| E3 | Shipments look | Nov 24 | the Shipping/Tracking agent's `shipments` table (columns, unique key) |
| E4 | Second look | Nov 25 | the three history and sign-in functions (`employee_activity`, `employee_activity_people`, `list_my_sessions`), the two read rules on `profiles` |
| E5 | Looks of Nov 27 | Nov 27 | the role helpers that exist (`current_role()` returns **app_role**, no switched-off check; `is_owner_or_admin()` checks role and **active**, not removed); the role list **app_role** = owner, employee, ai_agent, administrator; `audit_trigger_function()` word for word (writes **new.id / old.id**); `audit_log` columns |
| E6 | Installs verified | Nov 26–27 | drafts 68, 70, 72, 50, 74 installed and checked (so `is_active_staff()`, `active_role()`, `shared_settings` with `id` now exist) |

**Still UNKNOWN** (no look yet): the shapes of the 24 tables outside E1's 18 (Query A2 is prepared, `08_READONLY_A2_outside_tables.sql`, and has not been run; that these tables exist is only known because the live dashboard reads them); the columns of `feature_flags` and whether its `id` fills itself in (the
read-only query in the launch plan); whether **pg_cron** is installed (Query C); the row rules and grants on
the existing tables other than `profiles` (Query G); triggers on existing tables other than the history
recorder on `tasks` (Query C §7 and §10); anything changed in E1's tables since Oct 5 (Query H).

## Draft by draft

"Needs" = helpers, tables or extensions the draft uses that it does not create. "Precheck" = it stops,
changing nothing, if one is missing (checked in the file). Install order and undo files: `START_HERE_GUIDED_RUNS.md`.

| Draft | Needs (besides what it creates) | Evidence | Precheck | Verdict |
|---|---|---|---|---|
| 10 stock functions | `is_owner_or_admin()`, inventory / lots / PO / returns / recalls / products tables and their unique indexes | E5, E1 | yes (tables, columns, indexes, helper) | ready; E1 age → run Query H first if unsure |
| 13 report totals | orders, expenses (E1 columns) | E1 | yes | waits on your refund decision (N4) |
| 17 PO line guard | purchase_order_items, purchase_orders | E1 | yes | ready |
| 19 request keys | the 22 tables it adds a column to | E1 for 14 of them; the other 8 exist (the live dashboard uses them), shapes **UNKNOWN** (A2 not run) | reports and skips a missing table | ready (it adds one empty column; a shape difference does not matter) |
| 21 stock switches | drafts/10; `feature_flags` with a self-filling `id` | **UNKNOWN** (feature_flags) | yes (stops if `id` does not fill itself in) | ready once the feature_flags look is in |
| 23 four rules | inventory, inventory_lots, purchase_order_items, returns | E1 | stops if any row already breaks a rule | ready |
| 25 nightly check | **pg_cron** (optional: without it nothing is scheduled) | **UNKNOWN** | says so and schedules nothing | ready; Query C tells whether it will schedule |
| 27 request-keys switch | drafts/19; `feature_flags` | **UNKNOWN** (feature_flags) | yes | as 21 |
| 29 nightly on Home | drafts/25; `is_owner_or_admin()`; `feature_flags` | E5; **UNKNOWN** (feature_flags) | yes | as 21 |
| 32 invoices | `is_active_staff()` (72), `is_owner_or_admin()`, orders, tasks, the history recorder (`invoice_counters` now has `id`) | E6, E5, E1 | yes | waits on the tax answers |
| 34 stock-count approval | `active_role()` (72), `is_active_staff()`, products | E6, E1 | yes | ready |
| 36 / 38 supplier documents | `active_role()`, suppliers; 38: Supabase **storage** schema | E6, E1; storage: standard on Supabase, **not looked at** | yes | ready; 38 after 36 |
| 40 partial receiving | `active_role()`, `is_active_staff()`, PO / returns / order_items / inventory_adjustments | E6, E1 | yes | ready |
| 42 Shopify payouts | `is_owner_or_admin()` | E5 | yes | waits on the payments decision |
| 44 staff see POs | `is_active_staff()`, purchase_orders, purchase_order_items, row rules on | E6, E1; RLS on: **UNKNOWN** (Query G) | yes (stops if row rules are off) | ready |
| 46 tax rates | `active_role()` | E6 | yes | ready |
| 48 parcels | `shipments`, orders, `is_active_staff()` | E3, E1, E6 | yes | ready |
| 52 order costs | orders, the history recorder (`order_costs` has `id`) | E1, E5 | yes | ready |
| 54 order batches | orders, inventory_lots, products | E1 | yes | ready |
| 56 email | `active_role()`, the history recorder (`email_suppressions` has `id`) | E6, E5 | yes | sends nothing; real sending is a separate decision |
| 58 my settings | `is_active_staff()` | E6 | yes | ready |
| 60 reviews | `is_owner_or_admin()` | E5 | yes | ready |
| 62 / 64 manager, levels | app_role (62 adds 'manager'); 64: `current_role()` used only after an active check | E5 | yes | your decision on managers |
| 66 managers approve | 40 and 62 | — | yes | only if you choose A (Nov 25) |

**Metadata note:** the headers of drafts 32, 44, 48, 54 and 58 say `@depends-on: none`, but they need step 0
(drafts/72) for `is_active_staff()`; each stops safely without it. Step 0 is installed (E6), so this cannot
bite in production; the headers were left as they are so the fingerprints you review do not change.

## Regression checks (each fix removed on purpose must make a check fail)

`local-test/production_shape_mutation_test.sh` (Nov 27 night, **23 of 23**; part of the database suite), on a copy built by
`production_shape_install_test.sh` with nothing waiting installed:

| Problem of Nov 27 | With the fix | With the fix removed (a temporary copy) |
|---|---|---|
| M1 the role list is **app_role** | draft 36 asking `active_role()` installs | asking `current_role() = 'manager'` does not install: `invalid input value for enum app_role: "manager"` |
| M2 `current_role()` answers for switched-off accounts | a switched-off administrator's shared save is refused by the save function's own check | through `current_role()` that check lets the save through; only the read rule (production's `is_owner_or_admin()`, which checks "active") still refuses it. Two layers today; the fix keeps the first one working |
| M3 no `is_active_staff()` before step 0 | with step 0 first, step A installs | without step 0, step A stops, names the helper, creates nothing |
| M4 the history recorder writes `new.id` | draft 52 installs, the "every audited table has id" check is empty, and the owner's write is saved and recorded in the history log | without its `id` the check names `order_costs`, and a write fails with `has no field "id"` |
