# Owner unblock center (EXT12)

**Status:** CURRENT (2026-10-11, extension 12). Supersedes `OWNER_UNBLOCK_CENTER_EXT11.md` as the entry point. That file keeps the packets for outside help (§3) and the R1–R10 board. The step cards are still in `OWNER_CHECKS_EXT11.md`. Claude changed nothing in production.

## 0. What do I do now? (unchanged order; EXT12 makes each step's answer immediately usable)

| Rank | Action | Time | What you send back | What Claude does the same day |
|---|---|---|---|---|
| 1 | Backup look (card 1) | 2 min | `nightly green:DATE, restore green:DATE, minutes ok` | records it; database steps may be scheduled for that day |
| 2 | Reconnect GitHub as `stasvitiuk-reos` (card 4) | 5 min | the four lines `account / role / backups_repo_visible / bypass` | closes X6-17 if all four are right; says which line is wrong otherwise |
| 3 | Read-only session C, D, E, F, G, H (card 2) | 20–30 min | the six CSV downloads | reads each, lists findings, writes the drafts the findings call for (permission fixes, audit triggers, corrections list) as a draft PR |
| 4 | Review and merge the EXT12 draft PR #28 (replaces #27) | 15 min reading + 2 min clicking + 5 min postcheck | a screenshot of Home after the merge | compares it with the PR screenshots; if anything differs: revert card |
| 5+ | One database step or switch per sitting | `DEPLOYMENT_SIMULATION_EXT12.md` §4 | the card's check result | interprets it; prepares the next card |

How to send each result and what happens next: `OWNER_EVIDENCE_GUIDE_EXT12.md`. Decisions and the exact three lines to answer them: `OWNER_DECISION_STATUS_EXT12.md`.

### Do not do

- Do not paste passwords, keys, tokens or recovery codes anywhere. The intake refuses them and stores nothing, but the chat would still have seen them.
- Do not send a result without saying where it came from (production / staging / local). Without it the result proves nothing.
- Do not merge and then turn everything on. One change per sitting, with observation between switches.
- Do not run a database step on a day without a green backup look.
- Do not press Receive / Mark received / Quarantine again after a "connection dropped" message (`INCIDENT_SIMULATION_EXT12.md`).
- Do not open logs, re-run jobs or change settings in the backups repository.

## 1. Merge safety (questions an owner asks)

| Question | Answer | Evidence |
|---|---|---|
| Can I merge before running any SQL? | Yes. Every new feature is behind a switch that is absent or OFF; the page uses today's path. | `merge-without-sql-ext11` (11 tests) |
| Before R1–R5 are installed? | Yes. Stock actions use today's path; the switch refuses to turn on without the functions. | `stock-functions.spec.js`; simulator "switch before SQL" refusal |
| Before request keys? | Yes. Saves work without the columns; retry messages say "look at the list first". | `request-keys.spec.js`, `request-keys-ext10.spec.js` |
| Before the permission fixes (Query G)? | Yes. The page never widens permissions; the fixes are database drafts written only after Query G. | `ENGINEERING_CATALOG_EXT11.md` permissions |
| What if the merge breaks something? | GitHub → the merge commit → Revert. Pages republishes in 1–5 minutes. | change package §5 |

## 2. What is still unknown (and which result removes it)

| Unknown | Removed by |
|---|---|
| Are backups running and restorable? | BACKUP |
| Is agent #1 on? Are the off agents really off? | QUERY_C §1 / AGENT_STATUS |
| Who may change what in the database? | QUERY_G |
| Which tables keep an audit trail? | QUERY_C §10 |
| Does stock match its history? | QUERY_E |
| Does production match what was reviewed? | QUERY_H |
| Does the page work on a real iPhone and with VoiceOver? | REAL_DEVICE (card 5) |
| Does the session still act as an admin? | GITHUB_ACCESS |

## 3. What changed in EXT12

No page change. New: an intake that reads every kind of owner evidence and labels it honestly; a simulator that rehearses the rollout and refuses wrong orders; an incident map in the page's own words; deployment cards, training pack and decision table. Detail: `CURRENT_PLATFORM_STATE_EXT12.md`.
