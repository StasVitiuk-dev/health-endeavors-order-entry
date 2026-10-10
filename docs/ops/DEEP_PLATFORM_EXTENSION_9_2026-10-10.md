# Deep platform completion: extension 9 (2026-10-10)

**Status:** CURRENT. Branch `claude/platform-deep-completion-extension-9-2026-10-10`, created from extension 8 (`8aa24a9`). **Not merged, not deployed. Production not touched.** `main` unchanged at `d3db7bc`. Internal dashboard/platform only: no website, Real Estate OS, backups repository, production Supabase, Shopify or Gmail was opened.

Plain-English summary for Stas: the biggest open technical risk (stock changes that can double or half-save) is now **ready to close without another code change**. Each stock button can use the all-or-nothing database function the moment you install it and flip that button's switch, and it can be switched back instantly. The same pattern now prevents duplicate records on the five most important create forms. Six smaller real problems were fixed, and every remaining step is listed with who does it in **`OWNER_UNBLOCK_CENTER_EXT9.md`**.

Note on the branch: the session's assigned branch (`claude/sweet-hamilton-5ty3zp`) is the head of open PR #5 (CLAUDE.md rules). Pushing EXT9 there would have stacked this work onto that PR, so EXT9 uses its own feature branch, like extensions 4–8.

## 1. Start-of-session check (read-only)

| Check | Result |
|---|---|
| Repository / origin | `StasVitiuk-dev/health-endeavors-order-entry` |
| Start point | EXT8 `8aa24a9` (remote = local), clean tree |
| `main` | `d3db7bc`, unchanged |
| Account | `StasVitiuk-dev`, admin + maintain + push (X6-17, not used) |
| Stray files | no website, Real Estate OS or secret files in the tree |

## 2. Real bugs fixed (each has a test that fails on the old code)

| ID | Problem | Live on `main`? | Test |
|---|---|---|---|
| X9-04 | The dashboard could be shown invisibly inside another website's frame and its two-press buttons clicked through it (clickjacking); no referrer policy | Yes | csp "framed by another site" |
| X9-05 | Home checks looked current when they were hours old (no time shown) | No (EXT8 feature) | attention-checks "freshness" |
| X9-06 | A calendar note saved in another tab was silently replaced (upsert); personal event edits had no conflict check | Yes | calendar-owner "edits made elsewhere" |
| X9-07 | CSV export: a leading line feed or full-width ＝＋－＠ could still start a formula in some spreadsheet locales | Yes (partly) | helpers-unit "full-width" |
| X9-08 | Expenses older than the newest 200 were unreachable (receipt, correction) | Yes | second-pass-fixes |
| X8-19 | A background load put one page's currency warning on another page (one shared banner) | Yes | accounting-oracle "never appear on a different page" |

## 3. New safety capabilities (off until the matching database step)

| Capability | How it is controlled | Tests |
|---|---|---|
| **Stock buttons use R1–R5** (receive, recall quarantine, return restock, manual adjustment, product delete) | one `stock_fn_*` switch per button, read at every press; off / missing / unreadable = today's path | stock-functions (18 tests; page paths at desktop and iPhone size), 8 page mutants, write-path inventory |
| A stock switch **cannot be turned on before its function exists** | harmless probe proven on PostgreSQL to change nothing | stock-functions, stock_switches_test.sh 23/23 |
| **Request keys** on new expenses, products, suppliers, purchase orders, recalls | `request_keys` switch; the same key is reused for a retry of the same attempt; a repeat is refused and reported "already saved" | request-keys (6), 3 mutants |
| The request-key switch cannot turn on before drafts/19 | harmless read of the new column | request-keys |
| Hard walls | no send path, no payment provider, no accounting/tax/outbound writes, reviewed function list | hard-walls (14) |

## 4. SQL package (drafts only, NOT INSTALLED; each with rollback and a local test)

| File | What | Local test |
|---|---|---|
| `06_READONLY_G_permissions_inventory.sql` | Query G: RLS, policies, anon rights, duplicate read policies (PASS/WARN/FAIL) | permissions_inventory_test.sh 11/11 |
| drafts/21–22 | stock switches (all off) / rollback (refuses while on) | stock_switches_test.sh 23/23 |
| drafts/23–24 | four integrity rules / rollback | integrity_constraints_test.sh 17/17 |
| drafts/25–26 | nightly Query F with saved results (pg_cron) / rollback | integrity_schedule_test.sh 12/12 |
| drafts/27–28 | request-keys switch / rollback | request_keys_switch_test.sh 10/10 |

Order, prechecks and rollback for every production step: `PRODUCTION_CHANGE_PACKAGE_EXT9.md`.

## 5. Owner documents created

`OWNER_UNBLOCK_CENTER_EXT9.md` (single list, A–F classes, R1–R10 status, compressed decisions), `CURRENT_PLATFORM_STATE_EXT9.md` (entry point), `PRODUCTION_READONLY_VERIFICATION_EXT9.md` (V1–V10 incl. the 2-minute backup check), `PRODUCTION_CHANGE_PACKAGE_EXT9.md`, `AGENT_CURRENT_STATE_EXT9.md`, `PERMISSION_RLS_MAP_EXT9.md`, `DATA_INTEGRITY_RULES_EXT9.md`, `OPERATIONS_RUNBOOK_INDEX_EXT9.md` (with incident mini-runbooks), `N4_DECISION_ONE_PAGE.md`, `MANUAL_DEVICE_CHECKLIST_EXT9.md`; staging plan ranked; superseded statements marked.

## 6. Workstreams that found nothing to fix (checked, recorded)

| Workstream | Result |
|---|---|
| Customer communication (10) | no send path exists in any page; Agent #6 dry run; #7 drafts only |
| Accounting / tax writes (11) | none; refunds are records only; N4 one-pager prepared |
| Search caps (15) | remaining caps are labelled ("newest 20 matches", "N of M"); Expenses got Show more |
| Mobile (41) / zoom (43) | all 30 pages: no sideways page scroll at 320/360/414/768 px and at 320 px with 200% text (= 400% zoom on 1280 px) |
| Large data (16) | Home checks exact over 5,000 tasks / 2,000 incidents / 1,500 approvals / 1,200 POs, drawn in seconds; lists say how many are shown |
| Agents 1–8 failure tests (9) | not possible here: their code lives in Supabase / the private repo (EXTERNAL INFORMATION REQUIRED) |

## 7. Honest completion model (conservative; documentation not counted)

| Area | Estimate | Basis |
|---|---|---|
| Dashboard UI | 85% built in branch / ~60% live | live = `main` lacks EXT1–9 |
| Operations workflows | 80% branch | partial returns, legal-hold rule, claims queue open |
| Inventory safety | 70% | atomic path ready but not installed; today's path detects and reports |
| PO safety | 75% | claim-first + R1 ready behind switch |
| Returns | 65% | D-ops-5, N4 open |
| Agents | 40% | 3 reported live, 1 unverified, 4 off, no supervisor |
| Accounting/tax safety | 80% | read-only proven; N4 open |
| Security | 70% | CSP/frame/pin done in branch; X6-17 and permission facts open |
| Permissions | 35% | expected mapped; real rules unknown until Query G |
| Auditability | 55% | gaps listed; V2 §10 needed |
| Backups readiness | 15% | UNKNOWN until owner check and restore drill |
| Staging | 60% | built and tested; no URL |
| Owner-run verification readiness | 90% | every check written, tested, one place |
| **Production readiness** | **~15%** (was ~10%) | nothing installed or merged; raised only for the switch-ready package that removes a whole dashboard PR from the critical path |
| **Overall internal platform** | **~72%** (was ~70%) | branch work counted at low weight until merged |

## 8. Rejected / deferred ideas

Automatic fallback to the old stock path when a switched-on function is missing (rejected: hides a misconfiguration; the page refuses and says "turn the switch off"); auto-enabling switches after install (rejected: owner turns each on); request keys on all 22 tables at once (deferred: the five most important first); phone card layout and code-structure steps (deferred until after the merge to avoid conflicts).

## 9. Final evidence

PENDING (filled in after the frozen-commit verification).
