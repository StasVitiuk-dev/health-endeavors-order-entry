# Data integrity and concurrency matrix (per workflow)

**Status:** CURRENT (2026-10-10, extension 8). One row per business workflow, summarising the 99 write paths in `WRITE_PATH_INVENTORY.md` (generated, per call site) and its machine-readable twin `MUTATION_WRITE_PATH_INVENTORY.json`. Race-by-race detail from EXT4/EXT5 stays in `CONCURRENCY_MATRIX.md` (still accurate; this page adds the EXT8 findings and the per-workflow view). Retry rules: `IDEMPOTENCY_AND_RETRY_POLICY.md`.

Legend: **✓** protected and tested · **R1** safe once the drafted database functions are installed (not installed) · **KEY** needs the drafted request keys (draft 19, not installed) · **GAP** known and recorded · **—** not applicable. "Server" = what the database enforces (Query A export); "UI" = what the page checks. UI checks are convenience only; the database is the real lock.

| Workflow | Money | Stock | Personal data | Stale tab (another tab changed it) | Optimistic concurrency | Retry / double click | Partial completion | Races proven | Server vs UI authorisation | Rollback of the dashboard change | Tests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Tasks: create / finish / reopen / edit | — | — | ✓ names | ✓ status condition | ✓ `updateIfUnchanged` | create: button lock, **KEY** for lost replies | — single write | two tabs: one wins, other told | Server: staff rule; UI: role hides buttons | revert merge | state-transitions, owner-control-center, tasks |
| Approvals: approve / deny | ✓ refunds, discounts | — | ✓ | ✓ status = pending | ✓ | password re-entry + lock | — | two tabs ✓ | Server: owner/admin; UI: re-auth | revert | reauth-double-submit, state-machine |
| Incidents, recalls, legal hold, FDA flag | — | recall quarantine **R1** (R2) | ✓ | ✓ | ✓ | lock; incident create **KEY** | recall quarantine: browser steps **GAP until R2** | stress S28 (R2) | Server: Query D for some tables (UNKNOWN) | revert | compliance-pages, state-transitions-2 |
| Customer inquiries: answer / review | — | — | ✓ e-mails | ✓ | ✓ | lock | — | ✓ | UNKNOWN until Query D | revert | capped-reads, no-live-send |
| Products: add / edit / retire / delete | ✓ prices, cost | ✓ | — | **EXT8 ✓** edit refused if saved meanwhile (`updated_at`) | **EXT8 ✓** | add: **KEY** | delete: fresh checks + foreign keys; **R5** | delete vs delivery ✓ (S15, S29) | Server: owner/admin | revert | product-lifecycle, inventory-safety |
| Stock adjustments | — | ✓ | — | ✓ compare-and-swap per bucket | ✓ (5 retries) | lock | **GAP until R1**: stock and history are two requests | 2…200 people exact with R1; browser path exact numbers | Server: owner/admin | revert | inventory-safety, stress S1/S21 |
| Purchase orders: lines, totals, payment, status | ✓ | lines → stock on receive | — | ✓ status; **EXT8 ✓** shipping/tax refused if changed meanwhile | ✓ | line add: lock only (**CLIENT-SIDE ONLY**) | — | line edit vs receive: detected; **safe with draft guard 17** | Server: owner/admin | revert | purchase-orders, po-receive, concurrency |
| Purchase orders: receive | ✓ expense | ✓ | — | ✓ claim-first | ✓ | second receive refused | **YES until R1**: failure part-way reported with what to finish by hand | double receive ✓, cancel vs receive ✓ | Server + UI role check | revert; data fixes by hand per report | po-receive, po_race_interleavings.sh |
| Returns: approve / receive / refund record | ✓ | restock **R1** (R3) | ✓ | ✓ | ✓ | lock | restock: two requests **GAP until R3** | ✓ two tabs | Server: owner/admin | revert | state-transitions, refund-policy |
| Manual orders | ✓ | — (no stock change by design) | ✓ | — new rows | — | ✓ same order only if every field matches; survives reload | items saved after order: reported, retry fills in | two tabs same second: separate numbers | Server: staff | revert | manual-order-entry |
| Expenses, receipts, documents | ✓ | — | receipts may hold names | ✓ delete conditional | ✓ | add: **KEY** | upload then row: orphan cleanup | ✓ | Storage rules UNKNOWN (Query D) | revert | storage-safety, ops-findings |
| Agents, feature flags, system mode, service status | — | — | — | ✓ | ✓ | lock + password for Emergency | — | ✓ toggles | Server: owner; UI: role | revert | agent-truth, guarded-toggles, stale-tab-gaps |
| Sign-in, sign-out, sessions | — | — | ✓ | **EXT8 ✓** re-checked on Back-button return | — | — | — | user switch wipes page | Supabase Auth | revert | auth-chaos, session-failures |

## Read-side integrity (new in EXT8)

| Risk | Before EXT8 | Now | Test |
|---|---|---|---|
| A slower old reply draws over a newer one (period, month, search) | Possible on Accounting, Tax, Activity, Calendar, Evidence | Latest request wins (`newLoadToken`) | out-of-order.spec |
| Capped lists silently hide rows | Inquiries, returns order list, search, recycle bins, evidence | Every waiting item listed; "Showing N of M" + Show more; finders for older orders | capped-reads.spec |
| A check that cannot read shows "fine" | — | "Could not check" (UNKNOWN), never zero | attention-checks.spec |

## Invariants checked by Query F (read-only, `05_READONLY_F_…`)

Stuck work, duplicate risks (same PO expense twice, same supplier name, same manual order twice), wrong references, impossible values: 15 checks, 33/33 local tests, each with a planted violation. The stock-history invariants remain in `invariants.sql` and Query E.

## Still open (P-ranked in `READINESS_GATE.md`)

- **R1–R5 + guard 17 installation** (owner approval, production): removes every "GAP until R…" above.
- **Request keys (draft 19)**: removes every **KEY** above; until then a lost reply on a create can duplicate, which Query F lists.
- **Query D**: replaces every "UNKNOWN until Query D" server rule with fact.
- Agents writing at the same time as people: not tested (needs Query C results).
