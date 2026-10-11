# Unfinished work (EXT12)

> **SUPERSEDED (EXT13 navigation, 2026-10-11)** by `UNFINISHED_WORK_EXT13.md`. Start at `START_HERE_EXT13.md`; authority per topic: `SOURCE_OF_TRUTH_MAP_EXT13.md`. Nothing below this line was changed by EXT13 except dated correction notes.

**Status:** CURRENT (2026-10-11, extension 12). Supersedes `UNFINISHED_WORK_EXT11.md` as the summary; that file keeps the full classification, which is unchanged except for the rows below.

## 1. Done in EXT12

| Item | Result |
|---|---|
| Owner-evidence intake (15 types, statuses, environment, provenance, staleness, conflicts, re-entry, ledger, diff, privacy) | `tests/tools/evidence.js` + 16 tests |
| Synthetic result libraries for Query C–H, backup, GitHub, devices, decisions, agent source | `tests/fixtures/evidence-samples.js` |
| Deployment simulator (state machine, invalid transitions, R1–R5, request keys, nightly, rollback/reinstall, partial install, drift) | `tests/tools/deploy-sim.js` + 16 tests |
| Incident response map (19 cards, stop/retry rules, page phrases verified) | `tests/tools/incidents.js` + 7 tests |
| Mutants for the three tools | 12/12 caught |
| Deployment cards, observation windows, change freeze, evidence expiry | `DEPLOYMENT_SIMULATION_EXT12.md` |
| Training pack, owner routines, check questions | `OPERATOR_TRAINING_EXT12.md` |
| Decision table with answer format; staging host recommendation | `OWNER_DECISION_STATUS_EXT12.md` |

## 2. Claude-safe meaningful work remaining

**None before the owner's next step.** EXT12 found no page bug: no page code changed, and nothing in the sweep called for a page change. Every remaining item needs one of: owner evidence, an owner decision, an owner production step, an outside person (accountant, lawyer, provider, agent-source holder), or a real device. Each of those now has a prepared intake and a prepared next step (`OWNER_EVIDENCE_GUIDE_EXT12.md` §4).

## 3. Remaining, by who unblocks it

| Who | Items |
|---|---|
| **Owner evidence (read-only)** | backup look · Query C, D, E, F, G, H · GitHub access (X6-17) |
| **Owner decisions** | 12 owner decisions in `OWNER_DECISION_STATUS_EXT12.md` (only `thresholds` blocks a production step) |
| **Owner production steps** | merge · R1–R5 + switch rows · five stock switches · line guard · integrity rules · request keys · permission fixes (after Query G) · nightly check · later: revoke direct stock writes, backup row |
| **Accountant** | refund rule N4 · one look at a tax export |
| **Lawyer** | legal hold vs delete · data retention · claims review (D8) |
| **Provider** | e-mail service (R10) |
| **Agent source** | agents #1–#8 failure / replay / duplicate tests; supervisor heartbeat (D6) |
| **Real device** | iPhone Safari · Mac Safari · VoiceOver · Chrome desktop cards |
| **Post-launch (intentional)** | unchanged from `UNFINISHED_WORK_EXT11.md` §1 |

## 4. Considered in EXT12 and not done (low value or not safe)

- **A full-suite re-run.** The page files are byte-identical to the frozen commit `32c05e2` that the full suite already ran on. The proportional checks (Node specs, static specs, mutants) cover what changed.
- **A browser "evidence upload" page in the dashboard.** It would put production evidence handling into the live site; the local tool is enough and keeps evidence out of the browser.
- **Automatic incident repair, or auto-switching off on a FAIL.** Not allowed: a person decides every recovery.
- **More synthetic samples.** Each status path already has one, and more would only repeat them.
- **Large-data, cap-registry and pagination work.** Already covered (EXT8 caps; EXT10 50k-order nightly check: 0.3 s). Nothing new to measure without production volumes.
- **Creating `KNOWN_BUGS_AND_RISKS.md`, `TESTING_AND_EVIDENCE.md`, `CODING_BOUNDARIES.md`.** These still don't exist. Their topics are covered elsewhere, and a second source would only drift (see `CURRENT_PLATFORM_STATE_EXT11.md` §5).
