# Deployment simulation and deployment cards (EXT12)

**Status:** CURRENT (2026-10-11, extension 12). **Nothing here has been done in production.** This file turns the production steps (`PRODUCTION_CHANGE_PACKAGE_EXT10.md`, P0–P11, unchanged) into one card per sitting, and describes the simulator that rehearses the order and refuses wrong orders. The order of phases is in `PRODUCTION_READINESS_BOARD_EXT11.md` §3 (unchanged).

A simulation is **not** production evidence. Every simulator message in a staging or local run starts with `SIMULATED:` and a simulated "VERIFIED" says "(simulation only: not production evidence)".

## 1. The simulator (`tests/tools/deploy-sim.js`)

A pure state machine. It connects to nothing. Give it a list of steps; it says OK or REFUSED for each, with the reason in plain English.

```bash
npm run deploy:sim -- tests/fixtures/deploy-plan-wrong-order.json --env local
```

The sample plan installs R1–R5 and then tries to switch R1 on **without the switch rows (P3)**. The simulator refuses step 10 and says why. That sample is kept on purpose as a teaching example.

### States

Install steps: NOT STARTED → PRECHECK PASS → INSTALLED → POSTCHECK PASS (or FAILED → ROLLED BACK; UNKNOWN after a new draft version).
Switches: ABSENT (no row yet) → SWITCH OFF → OBSERVING (on, being watched) → VERIFIED (or back to SWITCH OFF at any time).

### What it refuses (each tested in `tests/specs/deploy-sim-ext12.spec.js`)

| Wrong move | Refusal |
|---|---|
| Switch on before its SQL step is installed **and checked** | "its database step … is not installed and checked" |
| Switch on before its switch row exists | "its switch row does not exist yet" |
| Install without a passed precheck (skipped precheck) | "Skipped precheck" |
| Verify a switch that is not under observation (verify before postcheck) | "Only a switch under observation can be verified" |
| Production run fed local, staging or unlabelled evidence | "cannot support a production step (local or staging results are not production verification)" |
| A step before its prerequisite (wrong order) | "Wrong order: … must be done and checked first" |
| A step without its read-only evidence (Query C before R1–R5; E + F before integrity rules; G before permission fixes) or decision (thresholds before nightly) | "needs QUERY_… evidence first" / "needs the … decision first" |
| A database step without a green backup look **that same day** | "No green backup look on …" |
| A second change in the same sitting | "One change per sitting" |
| A second switch while one is still being observed | "One switch at a time" |
| A stock switch out of the order R1 → R4 → R2 → R3 → R5 | "Order: … must be ON and VERIFIED before …" |
| Switch on without Query H PASS that day | "Run Query H on … first" |
| Verify before one working day, with an unexpected canary number, without Query H PASS, or (stock) without Query E 0 mismatches | each named |
| Postcheck with a wrong R1–R5 fingerprint | stops: "is not the reviewed version"; roll back with drafts/11 |
| Anything except switch-off / rollback / new evidence / owner review while stopped | "STOPPED: …" |
| Rollback while a dependent switch is ON, with dependents installed, or of something not installed (wrong rollback file) | each named |
| Unknown step, switch or action | refused, never guessed |

Accepted on purpose: **install twice** (each draft is idempotent or refuses: "running it again changes nothing"); **switch off at any time**, even while stopped; **rollback then reinstall** (through precheck again).

### Scenarios rehearsed

R1–R5 in order · request keys · nightly check + Home card · partial install (installed, postcheck failed) · mid-migration failure · wrong order · install twice · old/unreviewed function version (fingerprint) · failed postcheck · switch-on refused (no SQL) · function disappears while ON (drift → stop → switch off) · version drift (new draft version → UNKNOWN) · permission drift (stop, owner review) · rollback refused while ON · rollback order · rollback + reinstall.

**A rollback removes database objects. It cannot undo business effects** (stock received, expenses logged, returns restocked). Those are corrected by hand with a note of who and why. The simulator says this on every rollback and every switch-off.

## 2. Rules for every sitting

1. **Change freeze:** no page PR is merged between a database step and its postcheck, and none while a switch is being observed.
2. **One change per sitting.** Postcheck before ending the sitting.
3. **Backup look the same day** before any database step (card 1 of `OWNER_CHECKS_EXT11.md`).
4. **Query H after every step** from P2 on. Any FAIL → do what its ACTION column says (usually: switch off), then stop.
5. **Stop rule:** a pre- or postcheck that differs, a file that stops with an error, a wrong fingerprint, Query H FAIL, a permission error for the owner, an unexpected canary number, or a new red row on Home → **stop, screenshot, ask. Do not try a fix.**
6. **Evidence expiry:** a check result is valid for the sitting it was run in (Query H, backup) or the limits in `OWNER_EVIDENCE_GUIDE_EXT12.md` §2.

## 3. Observation windows

| After | Wait before the next switch | Must be true |
|---|---|---|
| Merge (P0) | a few days of normal use | P0 postcheck clean (§5 of the change package) |
| Each stock switch (P4) | one working day minimum; one week after the first | canary action gave the expected number; Home no new red rows; Query H PASS; Query E 0 mismatches |
| Request keys (P7b) | one working day | one reminder added and deleted; one expense added normally |
| Nightly check on Home (P9b) | one night | Home shows a dated PASS/WARN/FAIL with "Last success" |
| Permission fixes (P8) | one working day with staff | nobody locked out; Query G re-run has no FAIL |

## 4. Cards (one per sitting; each card = one change)

Each card: **before** (must be true) · **do** · **check** · **if it differs** · **record** (one line in the checkpoint log, `PRODUCTION_READINESS_BOARD_EXT11.md` §5).

**Card 0 — Merge (P0).** Before: PR green on the frozen commit; `main` unchanged since it was tested; no workflow file changed. Do: GitHub → PR → Merge. Check: change-package §5 (5 minutes, Private Window). If it differs: GitHub "Revert" on the merge. Record: date, merge commit, postcheck OK.

**Card 1 — Read-only session (P1).** Before: none (read-only). Do: Query C, D, E, F, G, H (card 2 of `OWNER_CHECKS_EXT11.md`). Check: send the CSVs; Claude runs `evidence:interpret` on each. If it differs: nothing to undo (read-only). Record: date, verdicts.

**Card R1–R5 install (P2) then switch rows (P3)** — two sittings. Before: backup green today; Query C shows no other stock writer. Do: `R1-R5-INSTALL-RUNBOOK.md` steps 1–6; next sitting `drafts/21`. Check: V8 fingerprint `3caf5c28beefd0d8dff1dfed078b6754` (EXT17 version; was `3df2bf7a…` before the INT-4 fix); grants 6 rows, anon false; V9 five rows false; Query H PASS. If it differs: `drafts/11` (P2) / `drafts/22` (P3). Record each.

**Card R1 receive / R4 adjust / R2 recall / R3 return / R5 delete (P4)** — one switch per sitting, in this order. Before: previous switch VERIFIED; Query H PASS today. Do: Feature Switches → that switch → password. Check: one small real action (the canary) and the numbers in Inventory / Expenses / the PO; after one working day Query H PASS and Query E 0 mismatches → VERIFIED. If it differs: **switch off** (instant); correct the business effect by hand with a note. R3: whole line is restocked unless the partial-returns decision says otherwise.

**Card request keys (P7, P7b)** — two sittings. Before: backup green. Do: `drafts/19`, then `drafts/27` (row OFF); next sitting switch `request_keys` on. Check: V11; one reminder added and deleted; one expense added. If it differs: switch off; `drafts/28` then `drafts/20`.

**Card permissions / RLS (P8)** — one draft per sitting. Before: Query G result interpreted; the fix draft written from it and reviewed; backup green. Do: run that one draft. Check: Query G re-run shows no FAIL for that row; a staff login still works. If it differs: the draft's rollback (restores the exact old policy). Risk MEDIUM–HIGH: can lock staff out.

**Card nightly (P9, P9b)** — two sittings. Before: thresholds decision (defaults may be accepted explicitly); backup green. Do: `drafts/25` and `select public.run_integrity_check();` once; next sitting `drafts/29`, V12, then the Home switch. Check: first row in results; Home card dated. If it differs: unschedule or `drafts/26`; Home: switch off, `drafts/30` before `26`.

**Final verification card.** After the last switch has been VERIFIED: backup look; Query C, E, G, H re-run; real-device card 5 on the deployed commit; Home clean. Then, and only then, the readiness board rows move to PRODUCTION VERIFIED.

## 5. Deployment evidence expiry

| Evidence | Good for |
|---|---|
| Backup look | that day only, for database steps |
| Query H | the sitting it was run in |
| Query E (stock switches) | the day of the verify |
| Postcheck screenshot | that step only; superseded by any later change |
| Fingerprint (V8) | until a new version of drafts/10 (then UNKNOWN) |
| Real-device result | until the page changes |

## 6. Merge before SQL (unchanged evidence)

Merging the code with **no** SQL installed is safe: every new switch is absent or OFF, and the page falls back to today's path (`merge-without-sql-ext11` profile, 11 tests; `PRODUCTION_READINESS_BOARD_EXT11.md` §4). The same holds before R1–R5, before request keys and before any permission fix: each feature checks its switch and probes for its database step, and refuses with a reason if the step is missing.
