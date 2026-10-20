# Current platform state (EXT18)

**AS OF:** 2026-10-13 · branch `claude/platform-ext18-security-reliability-2026-10-12` · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT17.md` (rows not listed are unchanged).

No owner evidence has arrived. Nothing in EXT18 touched production.

## 1. What changed since EXT17

| Area | State |
|---|---|
| Script injection | 160 HTML-building sites inventoried; 52 values hand-reviewed (all safe); a gate blocks new unreviewed ones; dangerous sinks at 0 |
| Script policy | scripts only from this site + the one pinned library file (was: the whole CDN) |
| Framing | all 6 pages tested inside a hostile frame |
| Values named like built-ins | **4 real bugs fixed** (sales tax by state, Accounting duplicate check, Tax category labels, cost estimate) |
| Slow patterns | 142 regexes audited; error text capped; no pattern can freeze the page |
| Sign-out with a save in flight | **bug fixed**: the note no longer claims "not sent" |
| Sessions | 5-tab sign-out, offline sign-out, storage inventory tested |
| Database (local) | RLS contract + audit completeness/immutability (63 checks); 2 findings for Query G (F1, F2) |
| Supply chain / secrets | lockfile, scripts, secret-file firewall tested |
| Commands | `npm run security:quick` / `security:deep` |
| Everything else (Queries C–H, backups, agents, real devices) | unchanged: production state UNKNOWN |

## 2. Scores (planning estimates)

| Score | EXT17 | EXT18 | Why |
|---|---|---|---|
| Branch dashboard | ~92% | ~93% | five real bugs fixed |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | unchanged: no production evidence |
| Security (branch) | ~68% | ~78% | gates, narrower policy, fixes, local RLS contract |
| Engineering health | ~78% | ~80% | security gates in CI |
| Test reliability | ~82% | ~83% | INT-6 found and fixed in the new tests |

Details: [SECURITY_ARCHITECTURE_EXT18.md](SECURITY_ARCHITECTURE_EXT18.md), [RELEASE_REVIEW_EXT18.md](RELEASE_REVIEW_EXT18.md).
