# START HERE (EXT12)

**Status:** CURRENT (2026-10-11). The one file to open first. Everything else is linked from here.

## Where we are

- The live dashboard (`main`, `d3db7bc`) is **unchanged**. Nothing has been merged, deployed or run on production.
- All work from extensions 1–12 is on branch `claude/platform-ext12-preproduction-simulation-2026-10-11`, in one **draft** pull request, **#28**, which replaces #27.
- The dashboard code is the same as the EXT11 frozen commit `32c05e2`, which the full test suite ran on. EXT12 added tools and documents only.
- Production readiness is still about **15 / 100** (`PRODUCTION_READINESS_BOARD_EXT11.md`). It rises only when production evidence arrives or a production step is done.
- No evidence from production has arrived yet.

## Open these, in this order

| # | File | What it answers |
|---|---|---|
| 1 | `OWNER_UNBLOCK_CENTER_EXT12.md` | what to do now; what to send back; what Claude does the same day |
| 2 | `OWNER_EVIDENCE_GUIDE_EXT12.md` | how to send each result; how it is read; what it leads to |
| 3 | `DEPLOYMENT_SIMULATION_EXT12.md` | one card per sitting; stop rule; observation windows |
| 4 | `OWNER_DECISION_STATUS_EXT12.md` | every open decision, safe default, answer format |
| 5 | `INCIDENT_SIMULATION_EXT12.md` | what to do when something goes wrong |
| 6 | `OPERATOR_TRAINING_EXT12.md` | training for staff and the owner's routines |
| 7 | `CURRENT_PLATFORM_STATE_EXT12.md` | the exact state of every area |
| 8 | `PRODUCTION_READINESS_BOARD_EXT11.md` | why ~15%, the owner order, the checkpoint log |
| 9 | `UNFINISHED_WORK_EXT12.md` | what is left and who unblocks it |

Still current and unchanged: `OWNER_CHECKS_EXT11.md` (cards 1–6), `PRODUCTION_CHANGE_PACKAGE_EXT10.md` (P0–P11), `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (V1–V13), `OPERATOR_QUICK_REFERENCE_EXT10.md`.

## Tools (local; they connect to nothing)

```bash
npm install                     # once
npm test                        # whole suite (desktop + iPhone size)
npm run evidence:interpret -- QUERY_H file.csv --env production --run-date YYYY-MM-DD
npm run evidence:status -- --today YYYY-MM-DD
npm run deploy:sim -- tests/fixtures/deploy-plan-wrong-order.json --env local
npm run incident -- lookup "text the screen shows"
```

## The single best next step for the owner

The **2-minute backup look** (card 1 of `OWNER_CHECKS_EXT11.md`). Every database step waits on it, and it is the only fact that nobody else can check.
