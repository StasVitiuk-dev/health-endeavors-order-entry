# START HERE (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · dashboard code `32c05e2` (identical in PR #28) · live `main` `d3db7bc` · branch `claude/platform-ext13-owner-attention-final-audit-2026-10-11`.
**SUPERSEDES:** `START_HERE_EXT12.md` (kept as history).

## Where we are (five lines)

1. The live dashboard is **unchanged**. Nothing has been merged, deployed or run on production.
2. All the work (extensions 1–13) waits in **one draft pull request, #28** (its branch now carries the EXT13 commits). The older drafts #5–#27 are all inside it.
3. Merging it is safe before any database step: every new feature stays **off** until you install its SQL.
4. Production readiness is about **15 / 100**. Four of your actions take it to about **53**: backup look, GitHub reconnect, read-only session, merge.
5. Nothing more can be done safely without you: every remaining item needs your evidence, your decision, or a production step.

## Open this first

**`OWNER_ATTENTION_SESSION_EXT13.md`**: what needs you, how long each item takes, what is safe and what is risky, the order, the 30-minute / 60-minute / 2-hour / full-day plans, the stop points, the decision list, and a checklist to work through with ChatGPT or Claude.

## Then, only if you need it

| Question | File |
|---|---|
| Exactly what is the state of everything? | `CURRENT_PLATFORM_STATE_EXT13.md` |
| Which file is the truth for which topic? | `SOURCE_OF_TRUTH_MAP_EXT13.md` |
| R1–R10, queries, agents, automations, switches, migrations, rollback, evidence, critical path | `PLATFORM_MATRICES_EXT13.md` |
| Is PR #28 safe to merge? What does it change? | `RELEASE_REVIEW_EXT13.md` §1 |
| How do I send results back? | `OWNER_EVIDENCE_GUIDE_EXT12.md` |
| The step cards (backup, read-only session, GitHub, devices) | `OWNER_CHECKS_EXT11.md` |
| One card per production sitting | `DEPLOYMENT_SIMULATION_EXT12.md` §4 |
| Staff training, what-if cases, incidents | `OPERATIONS_HANDBOOK_EXT13.md`, `INCIDENT_SIMULATION_EXT12.md` |
| Tables, write paths, invariants | `DATA_MODEL_DICTIONARY_EXT13.md` |
| What can wait until after launch | `POST_LAUNCH_BACKLOG_EXT13.md` |
| What to paste into the next session | `OWNER_SESSION_PROMPTS_EXT13.md` |
| What is left and who unblocks it | `UNFINISHED_WORK_EXT13.md` |

## Tools (local; they connect to nothing)

```bash
npm install                     # once
npm test                        # whole suite (desktop + iPhone size)
npm run evidence:interpret -- QUERY_H file.csv --env production --run-date YYYY-MM-DD
npm run evidence:status -- --today YYYY-MM-DD
npm run deploy:sim -- tests/fixtures/deploy-plan-wrong-order.json --env local
npm run incident -- lookup "text the screen shows"
npm run docs:check              # every file and command named in the owner documents exists
```

## The single best next step

The **2-minute backup look** (card 1 of `OWNER_CHECKS_EXT11.md`). Every database step waits on it, and only you can see it.
