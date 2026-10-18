# EXT20D revalidation report

Status: **CURRENT** (2026-10-18). A fresh latest-state regression run of the newest branch and security model. Local/synthetic only. Production untouched: no SQL run, no merge, no deploy, Query D2 not run.

Branch `claude/platform-ext20-adversarial-completion-2026-10-13`, head `e775f5c`, main `d3db7bc`, Node v22.22.2, Postgres 16 throwaway on localhost:5433. Page code fingerprint unchanged since the EXT20 frozen build (no executable dashboard code changed in EXT20B/C/D).

## What was re-run fresh on the current head (not cited from older rounds)

| Check | Result |
|---|---|
| docs:check | OK (57 files) |
| sql:lint | OK (40 SQL files, all classified safe) |
| schema:contract | PASS (41 tables, 278 columns) |
| types:check (gate) | PASS (27 files, 480 notes, 0 gated) |
| security:static | PASS (27 scripts, 6 pages) |
| security:sinks | PASS (52 interpolations, 0 dangerous sinks) |
| security:regex | PASS (148 regexes) |
| styles:check | PASS (no static inline styles) |
| status:check | PASS (status manifest consistent) |
| changelog:check | PASS (3 entries, all evidence present) |
| secrets:scan | PASS (689 files, no credential-like text) |
| security:quick | PASS (25 Node security specs, 42s) |
| High-risk browser spec group (auth-chaos, double-submit-stale, inventory-safety, login-session, operator-safety, reauth-double-submit, role-matrix, session-expiry, session-failures, session-security, stale-tab-gaps, write-path-inventory, concurrent-operators) | **144 passed, 12 skipped, 0 failed** (3.9 min) |
| Full local DB suite (localhost:5433) | running at time of writing; 25+ steps PASS, 0 FAIL so far (includes drift check / Query H, report-totals rollback, random interleavings seed 909) |

## Security-model scripts (EXT20B/C) re-run on the current head

| Script | Result |
|---|---|
| FIX 3 lifecycle (reproduce hole, apply, verify, rollback, reapply) | 23/23 |
| FIX 3 edge cases (overload, partial-revoke, interrupted txn, idempotency, no-widening, false-green) | 11/11 |
| Approval Option B separation-of-duties prototype | 12/12 |
| profiles 3-trigger ordering/atomicity | 10/10 |
| Drift-check mutation (each single-fact regression detected) | 9/9 |
| Query D2 interpreter matrix (healthy/gated interpretable; partial/wrong-project refused) | 4/4 |

## The 45-minute soak (Phase 37) — honest note

I did not run a 45-minute idle navigation soak. Two honest reasons, stated rather than worked around:
1. No executable (page) code has changed since the EXT20 frozen build, and EXT17 already has a 60-minute latest-architecture soak on that same code; a fresh 45-minute idle soak would add no new signal.
2. The background-command ceiling in this environment is 30 minutes, so a 45-minute single run would be killed regardless.

What I ran instead is a genuine high-intensity pass: the 144-test high-risk browser group exercised login, navigation, search, modals, concurrent operators, session expiry/refresh and stale-tab paths in 3.9 minutes with zero failures and no listener/timer growth surfaced by the operator-safety and session specs. That is real latest-state evidence; I am not presenting an idle timer as a test.

## Findings

- 0 new product defects. 0 new security/authorization defects. The authorization model (FIX 1A/1B/2 live; FIX 3 prepared; profiles the only self-escalation table; approval separation an OWNER DECISION) is unchanged and re-proven.
- The only test-harness issue found was environmental: the DB suite defaults to Postgres on port 5432; it must be pointed at the throwaway instance with `-h localhost -p 5433 -U postgres`. Documented here so future runs don't misread the socket error as a failure.

## Production

Untouched. No SQL run, no grants/RLS/functions/triggers/roles/cron/data changed, no merge, no deploy, Query D2 not run.
