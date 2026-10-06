# Concurrency matrix

**Status:** CURRENT on branch `claude/platform-deep-readiness-extension-4` (2026-10-06, extension 4, workstream AD).

This covers what happens when two people (or two tabs, or an agent and a person) act on the same record at the same time. "Dashboard today" means the code on the branch, which uses many browser requests per action. "With R1–R5" means the drafted database functions. Those are tested on the local throwaway database only and are **not installed**.

Labels: **SAFE** = tested, nothing lost or doubled · **SAFE (R1)** = safe once the functions are installed · **GAP** = known, documented, waiting on something.

| Race | Dashboard today | With R1–R5 | Evidence |
|---|---|---|---|
| Two tabs change the same task / approval / return / PO status / legal hold / FDA flag / recall / feature request | SAFE: conditional update on the status shown; the second tab is told it changed | same | `state-transitions*.spec.js`, stress S22–S24 |
| Double click / Enter repeat on any save | SAFE: button lock or submit lock on every user write (inventory gate) | same | `write-path-inventory.spec.js`, `double-submit-stale.spec.js`, `fault-injection-2.spec.js` (late reply) |
| Two people adjust the same product's stock | SAFE for the numbers: compare-and-swap on every bucket read, up to 5 retries (`changeStock`). GAP: the history row is a second request, so a lost reply can leave stock changed without its history | SAFE (R1): stock and history in one transaction; ladder 2 … 200 people, exact | `inventory-safety.spec.js`, stress S1, S21 |
| Receive the same PO twice (two tabs) | SAFE: claim-first (status condition), one expense | SAFE (R1) | `po-receive.spec.js`, stress S2, S20 |
| Cancel vs receive the same PO | SAFE: both are status-conditional; one wins | SAFE (R1): all-or-nothing | stress S25 |
| Remove a PO line while the order is received | GAP: status read, then delete (two requests) | GAP even with R1 (2–6 of every 20 races left stock that no line explains, across 4 runs); **SAFE with the draft guard `drafts/17_…`** | stress S27 |
| Same new lot number arrives on several POs at once | n/a (dashboard: lot lookup then insert) | SAFE (R1): one lot row, quantities add up | stress S26 |
| Recall quarantine vs people taking stock out | GAP: browser steps | SAFE (R2): no bucket below zero | stress S28 |
| Delete product vs delivery for it | SAFE: fresh checks; foreign keys refuse; lost reply now looks first | SAFE (R5) | stress S15, S29, `session-expiry-midway.spec.js` |
| Manual order saved from two tabs in the same second | SAFE (EXT4): each gets its own number; never merged | n/a | `manual-order-entry.spec.js` |
| Retry after an unknown outcome (manual order) | SAFE: same order only if every field matches; survives reload | n/a | `manual-order-entry.spec.js` |
| Sign-out in another tab while editing | SAFE: tab leaves the dashboard; no false "saved" | same | `session-failures.spec.js` |
| Install / re-install of the functions while staff use them | n/a | SAFE: every successful call exact; only "function missing" blips | `install_package_test.sh` §10 |

## Data-integrity invariants

`docs/ops/sql/local-test/invariants.sql` lists every broken rule. The stress test requires it to return nothing after scenarios S20, S26 and S28. The rules:
- no negative bucket; no stock or history without a product
- lot remaining between 0 and received
- a received order has every catalogue line received, and exactly one expense
- no line is received on an order that is not received
- expenses are whole cents; quarantined recalls quarantined something
- restocked returns have history

A planted violation of each kind is detected.

## Not covered (recorded)

- Production lock timeouts and connection limits under real load: the local machine is not Supabase.
- Agents writing at the same time as people. Query C will show which agents write to which tables.
