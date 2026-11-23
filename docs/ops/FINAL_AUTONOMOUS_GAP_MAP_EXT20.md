# Final autonomous gap map (EXT20)

Status: **CURRENT.** Every known remaining item, by who can move it.

## 1. Claude can still do locally (no owner input needed)

| Item | Size | Value |
|---|---|---|
| Convert the ~45 escaped table renders and ~6 composed fragments to `h()`, then enforce Trusted Types | 2–3 focused changes | medium: defence in depth (every value is already escaped and gated) |
| Reduce the type-check notes in high-risk modules (480 notes, mostly dynamic-property TS2339; 0 gated defects) | medium | low–medium |
| Palette icon rendering via `pageIconNode` (part of the Trusted Types work) | small | low |
| Re-run the INT-3 hunt with the new evidence (only if it recurs) | small | low |

There are **fewer than 5 substantial local technical risks** left (see §9).

## 2. Owner read-only checks

| Check | What it unblocks |
|---|---|
| Query G | production RLS score, F1 fix draft, F2 decision |
| Query C | agent verification, stock-writer precondition for R1–R5 |
| Query A2 | schema drift for the 24 unexported tables |
| Query D, E, F | elevated functions, stock and data health |
| Query H | post-change verification |

## 3. Owner policy decisions

- **D1:** F2, who reads the audit log.
- **D2:** Google Fonts.
- **D3:** saved-link allow-list.
- **D4:** merge.
- **D5:** hosting with security headers.

Details: `OWNER_ACTIONS_EXT20.md` §3.

## 4. Production database changes (owner-approved, one at a time)

Each is drafted, rolled back locally and NOT installed:

- the F1 revoke (after Query G);
- R1–R5 stock functions (after Query C plus backup);
- request-key columns;
- nightly integrity check;
- report totals.

Order: `OWNER_ACTIONS_EXT20.md` §6.

## 5. Backup verification

Owner, 2 minutes: `OWNER_ACTIONS_EXT20.md` §4. Claude never accesses backups.

## 6. Real devices

- Safari on iPhone and Mac;
- VoiceOver;
- a real slow network.

None has been tested yet. The owner or a helper opens the live page after a merge.

## 7. External services

- Supabase connection pooler limits (production concurrency UNKNOWN);
- GitHub Pages header limits;
- Google Fonts.

## 8. After launch

- monitoring of agent runs;
- the nightly integrity check results;
- periodic Query H.

## 9. Diminishing returns

**Is another large local-only dashboard round justified? NO.**

The remaining local items in §1 are defence-in-depth or polish. None is an open correctness or security defect, and there are fewer than 5 substantial ones. Every remaining blocker that changes production readiness needs the owner:

- read-only evidence;
- decisions;
- approvals.

**The next phase should be OWNER REVIEW, then READ-ONLY PRODUCTION VERIFICATION, then CONTROLLED APPROVALS.** EXT21 is not started.
