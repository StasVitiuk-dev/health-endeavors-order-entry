# Dashboard production-readiness gate

**Status:** CURRENT (2026-10-06, extension 5). Branch work is **not live** until merged. A draft is never counted as done. Full item list: `MASTER_PLATFORM_BACKLOG_2026-10-06.md`.

| Stage | Meaning | Items |
|---|---|---|
| **1. Code complete and tested on the branch** | Implemented with tests that fail on the old code; waiting only for review and merge | 168 backlog items marked DONE, including every EXT3–EXT5 fix. Highlights:<ul><li>stale-tab guards on all 51 guarded status writes</li><li>manual-order retry safety</li><li>receive uses the saved order</li><li>money totals keyset-paged</li><li>Emergency always switches off Order Sync / Agent #7</li><li>cents everywhere</li><li>timezone contract</li><li>skip link / focus trap</li></ul> |
| **2. Merge (owner)** | Review and merge the branch (or the PRs in the recommended order); check live | Branch `claude/platform-deep-readiness-extension-5`; contains all 20 open PRs (`pr-merge-order.md`) |
| **3. Owner decisions** | Business, legal or accounting choices | 30 items (`OWNER_DECISIONS_NEXT.md`): N4 refunds, D-ops-1…6, legal hold, document categories, CI required check, backup check, … |
| **4. Query C (owner runs, read-only)** | Facts from production needed before any production change | 12 items:<ul><li>other stock writers (INV-22)</li><li>value rules for unverified tables (SM-04…09)</li><li>audit coverage (X3-18)</li><li>Emergency flag columns (X3-17)</li><li>activity ordering ties (X5-15)</li></ul> |
| **5. Production database changes (each needs approval)** | Drafted, tested locally only, not installed | 15 items:<ul><li>R1–R5 install</li><li>PO line guard (drafts/17)</li><li>request keys (X5-11)</li><li>CHECK rules (INV-19)</li><li>revoke direct stock writes (INV-20)</li><li>audit trigger extension (X3-18)</li><li>one recall per lot (INV-16)</li><li>orphan-file sweep</li></ul> |
| **6. Launch steps** | Store and integrations, not dashboard code | Real products; Shopify Order Sync (stays **off** until approved); agents #2/#3/#7/#8 |
| **7. Future enhancements** | Deliberately deferred | 22 items (P4 / after launch), e.g. forcing Central time for remote viewers (X4-26), drawing inventory edit forms on demand (X4-27) |

## Launch-blocking right now (none can be closed on the branch)

| Blocker | Waiting on |
|---|---|
| Stock races in the browser path (R1–R4) | Query C, then owner approval, then install |
| Other writers to stock (INV-22) | Query C sections 5–7 |
| Backup health unknown (X3-25) | Owner read-only check |
| Refund accounting rule (N4) | Owner / accountant |
| Live bugs on `main` fixed only on the branch:<ul><li>manual-order dates and duplicates</li><li>same-second merges</li><li>stale-tab receive</li><li>wrong-month delivery expense</li><li>Emergency switch-off gap</li><li>double-counted totals mid-read</li></ul> | Owner merge |

## Remaining safe branch-only work

Small: one queued P3 item (MD-04 upload-helper module, low value) and one P2 that waits on D-ops-4 (INV-15). X5-16 (threshold last-write-wins) was fixed in extension 5. Every P0 and P1 item that is not done is blocked on Query C, an owner decision or a production change.
