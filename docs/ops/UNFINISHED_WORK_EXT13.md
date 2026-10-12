# Unfinished work (EXT13): final classification

**AUTHORITATIVE AS OF:** 2026-10-11 · page code `32c05e2`. **SUPERSEDES** `UNFINISHED_WORK_EXT12.md` (kept as history).

Every remaining item is in exactly one category.

| Category | Items |
|---|---|
| **OWNER NOW** | backup look · GitHub as `stasvitiuk-reos` (X6-17) · thresholds decision · 2-minute decisions (rollout order, week, document categories, staging location) · review PR #28 |
| **OWNER LATER** | 10-minute decisions (partial returns, low-stock levels, RPO/RTO, recall per lot) · employee approval and switch-table rule (before hiring) · backup row · next automation · CI check · close PRs #5–#27 after the merge |
| **READ-ONLY PRODUCTION CHECK** | Query C, D, E, F, G, H · agent status (Query C §1) · audit coverage (Query C §10) · Query H after every step · production restore drill (into a throwaway project) |
| **PRODUCTION CHANGE** | merge (P0) · R1–R5 (P2) · switch rows (P3) · five stock switches (P4) · PO line guard (P5) · integrity rules (P6) · request keys (P7, P7b) · permission fixes (P8, after Query G) · nightly check (P9, P9b) · revoke direct stock writes (P10) · backup row (P11) |
| **ACCOUNTANT** | refund rule N4 · orders without items · tax export look |
| **LAWYER** | legal hold vs delete · data retention · claims review queue |
| **PROVIDER** | e-mail service |
| **AGENT SOURCE** | agents #1–#8 descriptions → contract tests → supervisor design |
| **REAL DEVICE** | iPhone Safari · Mac Safari · VoiceOver · Chrome desktop (on the merged version) |
| **POST-LAUNCH** | everything in `POST_LAUNCH_BACKLOG_EXT13.md` |
| **OBSOLETE** | `pr-merge-order.md` merge sequence (all PRs are inside #28) · "merge EXT10 / EXT11" decisions · K-list automations (→ D1–D11) · F3-07 label (done) |

## Claude-safe work remaining

**None of value before the owner's next step.** EXT13 finished the last safe items it found:

- the undated-evidence bug;
- the legal-hold correction;
- the stale-document marking;
- the doc checker;
- the consolidation.

Considered and deferred as low value:

- renaming the local-only test drafts (touches tests and docs for no safety gain);
- writing `drafts/13`'s rollback (that draft is not in the plan);
- removing old screenshots (size only).

The next Claude work starts when owner evidence arrives (`OWNER_SESSION_PROMPTS_EXT13.md`).
