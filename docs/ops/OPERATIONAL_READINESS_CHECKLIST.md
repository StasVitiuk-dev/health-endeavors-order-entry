# Internal platform: operational readiness checklist

**Status:** CURRENT (2026-10-06, extension 3). One consolidated list for the internal dashboard and platform (not the public website).

| Label | Meaning |
|---|---|
| **PASS** | Live on `main` and verified (by you, or by a read-only check you ran) |
| **BRANCH READY** | Built and tested on a review branch; **not merged, not live** |
| **OWNER DECISION** | Waits for your decision |
| **QUERY C** | Waits for the Query C results |
| **PRODUCTION VERIFY** | Needs a check on the live site after merging |
| **BLOCKED** | Waits for something outside this repository (e.g. real products in Shopify) |

Branch work counts as preparation, never as live completion.

## Data integrity
| Item | Status | Evidence |
|---|---|---|
| Existing production data is clean (no repair needed) | PASS | Query B ran clean |
| Real table shapes and value rules known (18 core tables) | PASS | Query A |
| Every page write uses only values the database accepts | BRANCH READY | `state-machine.spec.js`; the mock enforces Query A rules in every test |
| Every workflow state change is conditional on what the page showed (no stale overwrite) | BRANCH READY | mock rule `STATE_COLUMNS`; `state-transitions.spec.js` (71) |
| No "saved" message when nothing was saved | BRANCH READY | `fault-injection.spec.js` (45), silent-refusal sweep |
| Value rules for tables Query A did not cover (incidents, legal holds, inquiries, …) | QUERY C | section 9 |

## Authorization
| Item | Status | Evidence |
|---|---|---|
| Stock tables Owner/Administrator only (database) | PASS | Query A (row-level security) |
| Page refuses employees / unknown roles before sending stock actions | BRANCH READY | `role-matrix.spec.js` |
| Refusals explained in plain words, no internal names | BRANCH READY | `fault-injection.spec.js`, `explainDbError` tests |
| Signed out in another tab: page leaves the dashboard | BRANCH READY | `session-failures.spec.js` |
| Elevated database functions reachable by the public key | QUERY C → Query D (prepared, not run) | `03_READONLY_D_…` |

## Inventory
| Item | Status | Evidence |
|---|---|---|
| All-or-nothing stock functions R1–R5 | BRANCH READY (drafts) → PRODUCTION CHANGE after QUERY C | SQL tests 15/16, stress 25 scenarios, install package tests (34) |
| Dashboard switched to R1–R5 | BLOCKED (on the R1–R5 install) | backlog INV-06 |
| Interim browser protection (claim-first, compare-and-set) | BRANCH READY | po-receive, inventory-safety specs |
| No other writer of stock (agents, jobs, triggers) | QUERY C | sections 5–7 |

## Purchasing
| Item | Status | Evidence |
|---|---|---|
| PO status only moves forward; Cancel/Receive guarded | BRANCH READY | `state-transitions.spec.js`, stress S25 |
| Received delivery: one expense, stock once | BRANCH READY (browser) / R1 after install | po-receive spec, stress S3/S4 |
| Shipping, tax, line values validated | BRANCH READY | `second-pass-fixes.spec.js` |

## Returns and refunds
| Item | Status | Evidence |
|---|---|---|
| Return decisions guarded; restock once | BRANCH READY | transitions matrix, stress S11/S24 |
| Every open return listed (no silent cut at 200) | BRANCH READY | X3-04 test |
| How Returns refunds count against revenue | OWNER DECISION | N4 (`N4-refunds-accounting-map.md`) |
| Partial-quantity returns | OWNER DECISION | D-ops-5 |

## Recalls
| Item | Status | Evidence |
|---|---|---|
| Quarantine once, never below zero | BRANCH READY | stress S7/S12 |
| One active recall per lot | OWNER DECISION | D-ops-4 |

## Approvals and tasks
| Item | Status | Evidence |
|---|---|---|
| Deny writes `rejected` | BRANCH READY | Query A fix |
| One decision wins among simultaneous clicks | BRANCH READY | stress S22 (120 clicks), S23 (100 task clicks) |
| Task buttons v2 live checks (5 of 9 remaining) | PRODUCTION VERIFY | owner checks |

## Agents
| Item | Status | Evidence |
|---|---|---|
| Agent page never overclaims "Enabled" | BRANCH READY | agent-truth spec |
| Real agent switch states and schedules | QUERY C | sections 1, 3, 5 |
| Emergency mode reports switch-offs that did not happen | BRANCH READY | MU-06 tests |
| Emergency Order Sync switch-off works on the real table | QUERY C (+ branch fallback) | X3-17 |

## Shopify sync
| Item | Status | Evidence |
|---|---|---|
| Order Sync kept OFF before launch | PASS (by owner decision) | owner instruction; not touched |
| Real products with exact SKUs | BLOCKED | R8 |
| Sync re-enable | OWNER DECISION, after R1–R4 | R9 |

## Reports
| Item | Status | Evidence |
|---|---|---|
| Accounting / Tax complete beyond 1,000 rows | BRANCH READY | report-totals (0 … 10,000 rows) |
| Expenses totals complete beyond 200 | BRANCH READY | X3-03 |
| Central-time month and year boundaries; exact cents | BRANCH READY | `report-boundaries.spec.js` |
| Sales tax by state | BLOCKED (first real order) | RP-09 |
| Manual orders land on the chosen day (Central), not the day before | BRANCH READY (bug live on `main`) | X3-32, `manual-order-entry.spec.js` |
| Manual order retry never creates a second order | BRANCH READY (bug live on `main`) | X3-20, `manual-order-entry.spec.js` |

## Documents and storage
| Item | Status | Evidence |
|---|---|---|
| No lost files on dropped replies; no orphans; safe names | BRANCH READY | storage-safety spec |
| Real bucket privacy, size and type rules | PRODUCTION VERIFY (read-only check prepared, not run) | ST-07 |
| Whether legal holds block deletes | OWNER DECISION | mutation-safety-audit |

## Auditability
| Item | Status | Evidence |
|---|---|---|
| Audit trigger on 18 core tables | PASS | Query A |
| Audit coverage of compliance tables | QUERY C | section 10 (`AUDITABILITY_REVIEW.md`) |

## Accessibility and responsive
| Item | Status | Evidence |
|---|---|---|
| AA contrast light and dark; names; live regions; Escape closes overlays | BRANCH READY | a11y-basics spec |
| Widths 390 / 768 / 800 / 1100 px | BRANCH READY | iPhone project, responsive-widths |
| Live look on your iPhone and Mac after merge | PRODUCTION VERIFY | owner check |

## Performance
| Item | Status | Evidence |
|---|---|---|
| No request explosion: paged reads, chunked id lists | BRANCH READY | scale-urls, pagination audit |
| Stock functions scale linearly to 100 simultaneous callers | BRANCH READY (local) | stress S21 ladder |

## CI
| Item | Status | Evidence |
|---|---|---|
| Tests-only workflow (read-only, pinned, no secrets) | BRANCH READY on `claude/tests-only-ci` | not active |
| Make it a required check | OWNER DECISION | CI-02 |

## Rollback
| Item | Status | Evidence |
|---|---|---|
| Every branch change revertible by reverting commits | BRANCH READY | git history; no data migrations |
| R1–R5 rollback script, tested (twice, harmless) | BRANCH READY | install package tests |
| Helper/CSS version guard (mixed old/new files refused) | BRANCH READY | assets spec |

## Owner actions (in order)
1. Review and merge the open PRs in the documented order (`pr-merge-order.md`), checking live after each merge.
2. Run **Query C** (`QUERY_C_OWNER_RUN_GUIDE.md`) and send the CSV.
3. Decide: N4 refunds, D-ops-1…6, document categories, legal holds and deletes, permanent product delete (X3-16).
4. After Query C: approve the R1–R5 install (`R1-R5-INSTALL-RUNBOOK.md`).
5. Activate CI and make it required (CI-02).
