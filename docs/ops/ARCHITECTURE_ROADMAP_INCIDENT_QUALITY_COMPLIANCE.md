# Architecture roadmap: incidents, quality and compliance (extension 7, workstream L)

**Status:** PROPOSED, 2026-10-07. A plan only. Nothing here is installed. Each production step needs a SQL draft with a tested rollback and the owner's approval first. Related: `AUDITABILITY_REVIEW.md` (who-did-what gaps), `ROLLBACK_AND_BACKUP_REVIEW.md` (recovery), `AUTOMATION_AND_AGENT_REVIEW.md`, `integration-service-architecture.md`.

## 1. Where things stand (CURRENT)

| Area | Today | Gap |
|---|---|---|
| Incidents | `incidents` table; created by escalating a failed quality check or a recall (one per source, EXT5–EXT6); listed with due dates; **EXT7: open incidents can no longer be hidden behind closed ones** | No severity rules, no owner field, no closing note, no link back to the fix. Policies (RLS) UNKNOWN (Query D) |
| Quality checks | `quality_checks` with result and resolution; escalate to an incident once | Who resolved it is not recorded (no audit trigger on this table) |
| Recalls | Lot-based; quarantine moves stock to "recalled"; one incident per recall | One recall per lot is not enforced in the database (owner decision D-ops-4) |
| Adverse events | Recorded; "reported to FDA" flag with date | Who reported is not recorded; no deadline tracking |
| Legal holds | Placed / released with dates | Who released is not recorded; holds do not yet block deletes of the held records |
| Evidence and documents | Stored files with records; orphan files cleaned (EXT3) | Retention periods not defined |
| Audit history | Trigger on the 18 core tables (Query A); `audit_log` append-only | The compliance tables above are **outside** the trigger |
| SOPs | Written procedures; per-SOP "agent may reference" switch (**EXT7: shows its real state after a conflict**) | No version history, no "read and understood" sign-off |

## 2. Target design (PROPOSED)

```
Signal sources                      Case record                         Evidence + follow-up
-----------------                   -----------------                   ---------------------
QC check failed  ─┐                 incidents                           evidence_locker / documents
Recall opened    ─┼──▶ one case ──▶  severity, owner, due, status  ──▶  corrective action (task)
Adverse event    ─┤   per source     opened_by / closed_by / note        linked SOP change
Customer inquiry ─┤   (unique key)   audit trigger on every change       closing review (human only)
Integrity check  ─┘   (K1)
```

Principles:
1. **One case per source** (unique key on source type + source id), so a retry or a second tab never opens two (already the rule for QC and recalls).
2. **Every change is audited**: extend the audit trigger to incidents, quality_checks, recalls, adverse_event_reports, legal_holds (who + when + before/after).
3. **States are guarded** like tasks: each move applies only from the state the page showed (the existing `updateIfUnchanged` pattern).
4. **Closing is human-only** and needs a short note.
5. **Deadlines are visible**: adverse-event reporting windows and recall steps show on "Needs attention today".
6. **Legal hold blocks destruction**: a record under hold cannot be deleted (database rule), only released by the owner.

## 3. Roadmap

| Step | What | Class | Production change | Order |
|---|---|---|---|---|
| L1 | Run Query D (read-only) to list the real policies and triggers of the compliance tables | read-only | none (owner runs it) | 1 |
| L2 | Extend the audit trigger to the 5 compliance tables | DB | SQL draft + rollback, approval | 2 |
| L3 | Add `owner_id`, `closed_by`, `closing_note` to incidents; page shows and guards them | DB + page | draft + rollback, approval; page change after | 3 |
| L4 | Incident state machine on the page (open → investigating → resolved → closed), guarded, documented in `STATE_MACHINES.md` | page | none beyond L3 | 4 |
| L5 | Adverse-event deadline tracking (date received + reporting window) shown on "Needs attention" | page (+ column) | small draft, approval | 5 |
| L6 | Legal hold blocks deletes (trigger refusing deletes of held records) | DB | draft + rollback, approval | 6 |
| L7 | SOP version history and sign-off | DB + page | draft, approval | later |
| L8 | Daily integrity check feeding incidents (K1) | DETERMINISTIC | scheduled read-only query, approval | after R1–R5 |
| L9 | Retention periods per record type (documents, evidence, audit) | OWNER DECISION | policy first, then drafts | owner |

## 4. What this needs from the owner

- Run Query D (read-only) when convenient.
- Decide D-ops-4 (one recall per lot) and the retention periods (L9).
- Approve L2 first: it is the cheapest, safest step and closes the biggest "who did this?" gap.
