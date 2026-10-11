# Owner review package: dashboard / backend / operations session

**Date:** 2026-10-05. **Branch:** `claude/ops-readiness`. It is committed locally; **the push was refused (see §0)**. Nothing was merged, deployed, enabled or disabled. No production database or Shopify setting was touched, and no secrets were used. The website session's branches and files were not touched.

## 0. One blocker first: GitHub push access

`git push -u origin claude/ops-readiness` returned **403: "Claude doesn't have GitHub access to StasVitiuk-dev/health-endeavors-order-entry"**. Reading the repository still works.

**To fix:**
1. Reconnect GitHub at https://claude.ai/connect-github and make sure the Claude GitHub App is installed on this repository.
2. Tell me, and I'll push `claude/ops-readiness`. It's a new branch: no PR, no merge.

Until then, the work exists only in this session's container. A git bundle is saved in the session scratchpad as a backup.

## 1. What was completed

| Task | Result | Where (branch `claude/ops-readiness`) |
|---|---|---|
| PR map and merge order #5–#24 | Classified all 20. **Simulated merging all 20 in order: 20 clean merges, suite green at every step, 404 passed / 0 failed at the end.** | `docs/ops/pr-merge-order.md` |
| 1. Tests | Full suite on this branch: **101 passed**. New `ops-findings.spec.js`: **36/36** on `main` and on the fully merged tree. | `tests/specs/ops-findings.spec.js` |
| 2. R1–R4 deep review and read-only schema queries | Queries A, B and C (§5), each tested on a local PostgreSQL 16 | `docs/ops/sql/00_…`, `01_…`, `02_…` |
| 3. DB-function designs R1, R4, R2, R3 (+R5) | SQL drafts, rollback, unit tests (all pass) and parallel-session tests (12/12 PASS, incl. 20 overlapping receives with no deadlock) | `docs/ops/R1-R5-function-design.md`, `docs/ops/sql/drafts/`, `docs/ops/sql/local-test/` |
| 4. R5, R7, approvals race, PO states, PO Cancel, S10 | Recommendations; R7 pin and SRI hash verified from npm | `docs/ops/other-fixes-review.md` |
| 5. Test gaps | 18 tests (×2 sizes) pinning today's behaviour, plus "wanted" `test.fail` tests for each fix. No dashboard code changed. | `ops-findings.spec.js` |
| 6. Tests-only CI | Inactive draft: SHA-pinned actions, no secrets, `contents: read`, no deploy | `docs/ops/ci/` |
| 7. Agents | Review and owner checklist | `docs/ops/agents-review-and-owner-checklist.md` |
| 8. Shopify integration service | Architecture: inbox, idempotency, reconciler, least-privilege role; stock publishing blocked until R1–R4 | `docs/ops/integration-service-architecture.md` |
| 9. Modularization plan | Plan is sound; 7 sequencing changes | `docs/ops/modularization-review.md` |
| 10. Skeptical review | New findings N1–N14 | `docs/ops/other-fixes-review.md` |
| Work log | Running log | `docs/ops/WORKLOG.md` |

## 2. Most important discoveries

1. **N13: stale Returns page → second restock and second refund.** Approve on an old tab turns a refunded return back into "approved", so Mark Received restocks again. The R3 draft now refuses a second restock (`received_at` guard), but the dashboard also needs conditional status updates. 🟠
2. **N14: Accounting and Tax totals are unpaged.** Supabase silently returns at most "Max rows" (1,000 by default), so all-time and full-year totals would be understated once there are more than 1,000 orders or expenses. 🟠 (after launch)
3. **N3: Cancel after Receive** turns a received PO into "cancelled" while the stock and the expense stay recorded. 🟠
4. **N1: lot lookup uses `ilike`**, so `A_1` matches `AB1` and stock goes into the wrong batch (recall traceability). 🟠
5. **Deadlock risk found and fixed in the R1 draft.** Processing PO lines by line id deadlocked 3–11 of 20 overlapping receives. Processing by product: 0.
6. **N4: Accounting ignores refunds recorded on Returns.** 🟠 accounting decision.
7. **R7 is live:** the Supabase library `@2` moved to a new release on 2026-10-02 without review. The pin and hash are ready.
8. Compliance one-click actions: legal-hold release (N6), FDA flag (N11), recall resolved without quarantine (N12), receipt file hard delete (N10). 🟡
9. **Agent #1 (invoices) state is unverified.** The dashboard's "Live now" text for it is fixed text, not the real switch.

## 3. Tests and results

| What | Result |
|---|---|
| Full suite on `claude/ops-readiness` (`main` + new spec) | **101 passed**, 0 failed |
| Merge simulation, all 20 PRs | **404 passed**, 0 failed, 0 conflicts (per-step table in `pr-merge-order.md`) |
| `ops-findings.spec.js` on the merged tree | 36/36 |
| Each "wanted" test with `test.fail` removed | Fails on its intended assertion (checked one by one) |
| SQL function unit tests (`12_…`, local PG16, guessed schema) | ALL PASSED (repeated runs) |
| Parallel-session tests (`concurrency_test.sh`) | 12/12 PASS: no lost updates, below-zero race safe, receive/recall/return applied once, no deadlocks |
| Query A / B / C on local PG16 | run without error (A: 209 rows, B: 15 rows; C2 needs pg_cron) |

**Limit:** the SQL was tested against a **guessed** schema. It becomes real only after your Query A/B output.

## 4. Branches, PRs and files changed

- **Branch:** `claude/ops-readiness` only (14 commits, not pushed, see §0). **No PR opened. No existing branch or PR modified.**
- **Files (all new except as noted):**
  - `docs/ops/WORKLOG.md`
  - `docs/ops/OWNER-REVIEW-PACKAGE.md` (this file)
  - `docs/ops/pr-merge-order.md`
  - `docs/ops/R1-R5-function-design.md`
  - `docs/ops/other-fixes-review.md`
  - `docs/ops/agents-review-and-owner-checklist.md`
  - `docs/ops/integration-service-architecture.md`
  - `docs/ops/modularization-review.md`
  - `docs/ops/ci/README.md`, `docs/ops/ci/tests-only.yml.draft` (inactive)
  - `docs/ops/sql/00_READONLY_A_schema.sql`, `01_READONLY_B_data_health.sql`, `02_READONLY_C_agents.sql`
  - `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql`, `11_DRAFT_rollback_stock_functions.sql`, `12_DRAFT_tests_stock_functions.sql`
  - `docs/ops/sql/local-test/00_GUESSED_schema_for_local_tests.sql`, `concurrency_test.sh`
  - `tests/specs/ops-findings.spec.js`
- **Not changed:** `owner-login.html` or any other page, workflows, Supabase, Shopify, secrets, the website workspace.

## 5. Copy/paste Supabase queries (READ-ONLY)

**How:**
1. Supabase → SQL Editor → New query.
2. Paste **one** query and click Run.
3. Export the result as CSV (or copy all rows) and send it to me.

All three only `SELECT`. They return no customer data and no function source code.

**What I need from the output:**
- **Query A** (schema), so the R-function drafts can be reconciled with reality:
  - real column names and status values
  - whether `inventory.product_id` is unique, and the FK delete rules (R5)
  - RLS policies and grants
  - audit triggers
  - which functions exist and whether they are SECURITY DEFINER and executable by `anon`/PUBLIC
- **Query B** (data health): negative stock, duplicate PO expenses, wildcard-risk lot numbers, received-then-cancelled POs, status values. If it errors on a missing column, **send the exact error**: that is useful too.
- **Query C (version 2, one statement):** table counts, agent switches and last runs, scheduled jobs and what they call, every database path that can change stock, and Shopify-sync evidence (answers D-ops-6).

### Query A: schema (one statement)

```sql
-- =============================================================================
-- Health Endeavors — READ-ONLY schema check (Query A of 2) (for R1–R5 and the
-- approval / purchase-order / upload fixes).
--
-- SAFE TO RUN: this is ONE SELECT statement. It reads system catalogs and
-- counts rows. It creates, changes or deletes NOTHING.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query):
--   1. Paste this whole file. 2. Click "Run".
--   3. In the results grid use "Export → Download CSV" (or select all rows and copy).
--   4. Send the CSV / text back to Claude.
--
-- PRIVACY / SECRETS:
--   * No customer names, emails, addresses or order contents are returned.
--   * Function source code is NOT returned (Agent functions may contain keys);
--     only name, settings and an md5 fingerprint. The one exception is the
--     source of TRIGGER functions on the inventory/purchasing tables, with any
--     line that mentions key/secret/token/password/bearer/authorization
--     replaced by '-- [line removed]'. Glance at those rows before sending.
-- =============================================================================
with
t(tbl) as (values
  ('products'),('inventory'),('inventory_lots'),('inventory_adjustments'),
  ('purchase_orders'),('purchase_order_items'),('suppliers'),('expenses'),
  ('recalls'),('returns'),('orders'),('order_items'),('approval_requests'),
  ('evidence_locker'),('documents'),('audit_log'),('profiles'),('tasks')
),
cols as (
  select '1 column' as section, c.table_name as item,
         c.ordinal_position::text || ' ' || c.column_name || ' ' || c.data_type ||
         case when c.is_nullable = 'NO' then ' NOT NULL' else '' end ||
         coalesce(' DEFAULT ' || c.column_default, '') as detail
  from information_schema.columns c join t on t.tbl = c.table_name
  where c.table_schema = 'public'
),
missing as (
  select '0 table missing' , t.tbl, 'not found in schema public'
  from t where not exists (select 1 from information_schema.tables x where x.table_schema='public' and x.table_name=t.tbl)
),
cons as (
  select '2 constraint', cl.relname, con.conname || ' ' || pg_get_constraintdef(con.oid)
  from pg_constraint con join pg_class cl on cl.oid = con.conrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
),
idx as (
  select '3 index', tablename, indexname || ': ' || indexdef
  from pg_indexes join t on t.tbl = tablename where schemaname = 'public'
),
rls as (
  select '4 rls', cl.relname, 'row level security ' || case when cl.relrowsecurity then 'ON' else 'OFF' end ||
         case when cl.relforcerowsecurity then ' (forced)' else '' end
  from pg_class cl join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname where cl.relkind = 'r'
),
pol as (
  select '5 policy', p.tablename,
         p.policyname || ' | ' || p.cmd || ' | roles=' || array_to_string(p.roles, ',') ||
         ' | using=' || coalesce(p.qual, '-') || ' | check=' || coalesce(p.with_check, '-')
  from pg_policies p join t on t.tbl = p.tablename where p.schemaname = 'public'
),
grants as (
  select '6 grant', g.table_name, g.grantee || ': ' || string_agg(g.privilege_type, ',' order by g.privilege_type)
  from information_schema.role_table_grants g join t on t.tbl = g.table_name
  where g.table_schema = 'public' and g.grantee in ('anon','authenticated','service_role','public')
  group by g.table_name, g.grantee
),
trg as (
  select '7 trigger', cl.relname,
         tg.tgname || ' → ' || pn.nspname || '.' || p.proname || '() ' ||
         case when tg.tgenabled = 'D' then '[DISABLED] ' else '' end || pg_get_triggerdef(tg.oid)
  from pg_trigger tg join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
  join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not tg.tgisinternal
),
trgsrc as (
  select distinct '8 trigger function source (secrets-redacted)', pn.nspname || '.' || p.proname,
         regexp_replace(pg_get_functiondef(p.oid),
           '[^\n]*(key|secret|token|password|bearer|authorization|apikey)[^\n]*', '-- [line removed]', 'gi')
  from pg_trigger tg join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not tg.tgisinternal and cl.relname in
    ('inventory','inventory_lots','inventory_adjustments','purchase_orders','purchase_order_items','expenses','recalls','returns','approval_requests','products')
),
funcs as (
  select '9 function (no source)', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         case when p.prosecdef then 'SECURITY DEFINER' else 'security invoker' end ||
         ' | returns ' || pg_get_function_result(p.oid) || ' | lang ' || l.lanname ||
         ' | md5 ' || md5(pg_get_functiondef(p.oid)) ||
         ' | execute: ' || coalesce((select string_agg(distinct coalesce(r.rolname, 'PUBLIC'), ',') from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      left join pg_roles r on r.oid = a.grantee where a.privilege_type = 'EXECUTE'), '-')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') -- skip extension functions
),
ext as (
  select '10 extension', e.extname, 'version ' || e.extversion from pg_extension e
)
select * from missing
union all select * from cols union all select * from cons union all select * from idx
union all select * from rls union all select * from pol union all select * from grants
union all select * from trg union all select * from trgsrc union all select * from funcs
union all select * from ext
order by 1, 2, 3;
```

### Query B: data health (one statement)

**Corrected 2026-10-05 after Query A:** every column is named, so the CSV keeps all three columns; written against the real table shapes.

```sql
-- =============================================================================
-- Health Endeavors — READ-ONLY data-health check (Query B)
-- ONE SELECT statement: counts only, no customer data, changes NOTHING.
--
-- Every output column has its own name (section, check_name, result), so the
-- Supabase results grid and its CSV export keep all three columns. (Query A
-- left two columns unnamed and the export merged them.)
--
-- Written against the real table shapes from Query A (2026-10-05) and tested
-- on a local copy of those shapes. If it still stops with an error, send me
-- the exact error message.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query):
--   1. Paste this whole file. 2. Click "Run".
--   3. Export → Download CSV (or select all rows and copy) and send it back.
-- =============================================================================
select '1 stock' as section, 'inventory: rows with any negative bucket' as check_name, count(*)::text as result
    from inventory where least(available, reserved, damaged, sample, wholesale, promotional, returned, recalled) < 0
  union all select '1 stock', 'inventory: rows with recalled < 0 (recalled has no database rule yet)',
    count(*)::text from inventory where recalled < 0
  union all select '1 stock', 'inventory: rows whose product no longer exists',
    count(*)::text from inventory i where not exists (select 1 from products p where p.id = i.product_id)
  union all select '1 stock', 'products: rows with no inventory row',
    count(*)::text from products p where not exists (select 1 from inventory i where i.product_id = p.id)
  union all select '1 stock', 'inventory_adjustments: total rows',
    count(*)::text from inventory_adjustments
  union all select '2 lots', 'inventory_lots: lot numbers containing _ or % (wildcard bug exposure)',
    count(*)::text from inventory_lots where lot_number like '%\_%' escape '\' or lot_number like '%\%%' escape '\'
  union all select '2 lots', 'inventory_lots: quantity_remaining < 0 or > quantity_received',
    count(*)::text from inventory_lots where quantity_remaining < 0 or quantity_remaining > quantity_received
  union all select '2 lots', 'inventory_lots: quantities that are not whole numbers',
    count(*)::text from inventory_lots where quantity_received <> trunc(quantity_received) or quantity_remaining <> trunc(quantity_remaining)
  union all select '3 purchasing', 'purchase_orders: count by status (not deleted)',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from purchase_orders where deleted_at is null group by status) d), 'none')
  union all select '3 purchasing', 'purchase_orders: deleted (deleted_at set), by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from purchase_orders where deleted_at is not null group by status) d), 'none')
  union all select '3 purchasing', 'purchase_orders: received but a catalogue line not fully received',
    count(*)::text from purchase_orders po where po.status = 'received' and exists
    (select 1 from purchase_order_items i where i.purchase_order_id = po.id and i.product_id is not null and i.quantity_received < i.quantity)
  union all select '3 purchasing', 'purchase_orders: cancelled but stock was received (Cancel-after-Receive)',
    count(*)::text from purchase_orders po where po.status = 'cancelled' and exists
    (select 1 from purchase_order_items i where i.purchase_order_id = po.id and i.quantity_received > 0)
  union all select '3 purchasing', 'purchase_order_items: catalogue lines with a non-whole quantity',
    count(*)::text from purchase_order_items where product_id is not null and quantity <> trunc(quantity)
  union all select '3 purchasing', 'expenses: purchase-order notes logged more than once (possible R1 duplicates)',
    coalesce((select string_agg(note || ' x' || n, ' | ' order by note)
              from (select note, count(*) n from expenses where note like 'Purchase order %' and deleted_at is null group by note having count(*) > 1) d), 'none')
  union all select '4 recalls', 'recalls: count by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from recalls group by status) d), 'none')
  union all select '5 returns', 'returns: count by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from returns group by status) d), 'none')
  union all select '5 returns', 'returns: refund_amount recorded (count, sum)',
    count(refund_amount)::text || ', ' || coalesce(sum(refund_amount), 0)::text from returns
  union all select '5 returns', 'returns: refund_amount above the order line value',
    count(*)::text from returns r join order_items oi on oi.id = r.order_item_id
    where r.refund_amount is not null and r.refund_amount > coalesce(oi.line_total, oi.quantity * oi.unit_price)
  union all select '6 orders', 'orders: count by status (not deleted) — the words Accounting/Tax classify',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from orders where deleted_at is null group by status) d), 'none')
  union all select '6 orders', 'orders: count by source (not deleted)',
    coalesce((select string_agg(source || '=' || n, ', ' order by source)
              from (select source, count(*) n from orders where deleted_at is null group by source) d), 'none')
  union all select '7 approvals', 'approval_requests: count by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from approval_requests group by status) d), 'none')
  union all select '8 documents', 'documents: count by related_type (database allows supplier, general or empty)',
    coalesce((select string_agg(coalesce(related_type, '(none)') || '=' || n, ', ' order by related_type)
              from (select related_type, count(*) n from documents group by related_type) d), 'none')
order by 1, 2;
```

### Query C: agents, schedules, stock paths and table counts (one statement)

**Version 2 (2026-10-06).** The authoritative text is `docs/ops/sql/02_READONLY_C_agents.sql`; it is not copied here, so the two can never disagree. It is one read-only SELECT with named columns (section, item, result). It returns no function source and no scheduled-job command text, only names, numbers and yes/no answers. Sections: 0 table counts, 1 agents, 2 switches, 3 agent #1 invoices, 4 Shopify sync evidence, 5 scheduled jobs, 6 stock writers, 7 triggers, 8 direct stock-table writes. Tested on a local copy with mock agents, jobs and triggers (including a fake key in a job command, which does not appear in the output).

## 6. Recommended merge order (open PRs)

**5 → 6 → 17 → 18 → 15 → 16 → 19 → 20 → 21 → 22 → 23 → 24 → 7 → 9 → 10 → 13 → 11 → 12 → 14 → 8**

- docs first, then tests, then fixes
- all 20 simulated: clean, green at every step
- merge one at a time and do a live check after each `owner-login.html` change
- details and per-step fingerprints: `docs/ops/pr-merge-order.md`

`claude/ops-readiness` itself is review material. Once pushed, it could become **one** docs+tests PR after the 20 above, if you want it in `main`.

## 7. Decisions needed

| ID | Decision | Recommendation |
|---|---|---|
| D-ops-1 | Rollout order of stock fixes | R1 → R4 → R2 → R3 → R5 |
| D-ops-2 | R5: database function vs dashboard stop-gap | Database function |
| D-ops-3 | PO expense date: UTC today vs business date | Business date (Central) |
| D-ops-4 | One active recall per lot | Yes |
| D-ops-5 | Partial-line returns (units actually returned) | Yes, default to the whole line |
| D-ops-6 | Do agents/automations write `inventory` directly? | You confirm (Query C3 helps) |
| D-ops-7 | Cap "Mark Refunded" at the line value; only from Received (N5) | Yes |
| D-ops-8 | Emergency mode pauses every writing agent | Yes for Emergency; No-AI stays as is |
| R7 | A: pin + integrity hash on CDN, or B: self-host | A |
| PO Cancel | Two-press confirmation; also the password for shipped POs? | Two-press; password optional |
| S10 | May evidence files ever be auto-deleted? | Never; row-first upload instead |
| N4 | Subtract Returns refunds from revenue, or require the order status to change | Accounting decision. Subtract, with a "refunds" line. |
| N6 / N11 / N12 | Confirmation (and password for legal hold) on release, FDA flag, resolve-without-quarantine | Yes |
| N10 | Receipt removal: hard delete vs unlink | Unlink only; owner-run cleanup |
| CI | Activate the tests-only workflow (move into `.github/workflows/` via a PR) and later make it required | Yes, before the refactor |
| Integration | Create private repo `health-endeavors-integration`; hosting D-3 | Yes, when Shopify work starts; Supabase Edge Functions |
| Agent #1 | Turn invoices back on before real orders | You check its state first (§8) |

## 8. Manual checks for you (look only, change nothing)

1. Run **Queries A, B, C** (§5) and send the output.
2. Dashboard → AI Agent Activity → **Agent #1 switch: ON or OFF?** For #4–#6: a recent "Last run", not failed.
3. Private backups repo → Actions:
   - last backup succeeded?
   - latest monthly restore test (date)?
   - #2/#3/#7/#8 still disabled?
4. System Mode page: current mode.
5. Supabase → Project Settings → API → **"Max rows"** value (N14).
6. Task buttons v2 open items:
   - status survives a refresh
   - the audit row shows a status-only change
   - Cancel on "Mark done" changes nothing
   - a real iPhone check
7. On a synthetic test return: Mark Refunded, then look at what Accounting shows (N4).

Full list: `docs/ops/agents-review-and-owner-checklist.md` §3.

## 9. Risks blocking launch (real orders)

1. **R1–R4: stock and PO money can be wrong** (lost updates, half-saved receives, double counting). The fix is designed and tested locally and waits on Query A/B.
2. **N13 / N3 / approvals:** stale pages can re-open finished returns, cancel received POs, and flip approvals. Fix: conditional updates (no SQL needed).
3. **Agent #1 (invoices) state unverified.** Paused orders would get no invoice.
4. **R7: unpinned Supabase library** on all 6 pages.
5. **N4: refunds** missing from Accounting (before money reporting matters).
6. **Shopify order sync stays off** until 1–3 are done (`integration-service-architecture.md` §6).
7. After launch, soon: **N14**, the row cap on Accounting/Tax totals.

## 10. Next recommended work sequence

1. You fix GitHub access; I push `claude/ops-readiness`.
2. You run Queries A/B/C and do the manual checks in §8.
3. Merge the 20 open PRs in the §6 order (your approval each).
4. Small dashboard-only PRs, no SQL, each with a test flip:
   - conditional updates for approvals, PO status (N3), returns (N13/N5)
   - R7 pin
   - confirmations for PO Cancel, legal hold, FDA flag, recall resolve
5. I reconcile the R-function SQL with Query A, then publish it as a reviewed PR (files only). You run it in Supabase. Then one dashboard PR per function: R1 → R4 → R2 → R3 → R5.
6. Activate tests-only CI.
7. Agent #1 decision; Emergency mode pausing writing agents (D-ops-8).
8. N4 accounting decision and fix; N14 totals by database sum.
9. Modularization in the improved order (`modularization-review.md`).
10. Integration service per its build order, starting in a Shopify development store, only after 4–5.
