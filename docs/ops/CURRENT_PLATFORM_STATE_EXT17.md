# Current platform state (EXT17)

**AS OF:** 2026-10-12 · branch `claude/platform-ext17-deep-reliability-2026-10-12` · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT16.md` (rows not listed are unchanged).

No owner evidence has arrived. Nothing in EXT17 touched production.

## 1. What changed since EXT16

| Area | State |
|---|---|
| Draft stock functions (R1–R5) | three fixes (deadlock, empty order, below-zero message); new reviewed fingerprint `f6d9c2c8be690710eeb721041f6779d9`; TESTED LOCALLY, NOT INSTALLED |
| Manual stock adjustment | explicit state + read-back; no more double count after a lost reply |
| Sidebar with unusual browser storage | works when storage is full, blocked or holds junk |
| Testing | DB property model, 1,000-step chaos, 60-minute soak, storage, zoom, session-reuse isolation |
| Intermittent failures | INT-4 fixed with evidence; INT-3 still open (minor, unexplained) |
| Trusted Types | measured (86 locations); not adopted; path written down |
| Everything else (Queries C–H, backups, agents, real devices) | unchanged: production state UNKNOWN |

## 2. Scores (planning estimates)

| Score | EXT16 | EXT17 | Why |
|---|---|---|---|
| Branch dashboard | ~91% | ~92% | adjustment double-count and sidebar storage bugs fixed |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | unchanged: no production evidence |
| Engineering health | ~75% | ~78% | DB model, state machine, harness fixes, longer runs |
| Database drafts | tested | tested + model-checked | three real draft bugs fixed |
| Test reliability | ~78% | ~82% | INT-4 fixed; 5 ways a test could lie removed |
