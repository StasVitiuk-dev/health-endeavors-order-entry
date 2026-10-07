# Deep platform readiness: extension 7 (2026-10-07)

**Status:** CURRENT. Branch `claude/platform-deep-readiness-extension-7`, created from extension 6 (`444e00c`). **Not merged, not deployed. Production not touched.** `main` is unchanged at `d3db7bc`. Internal dashboard only: the website repository, Real Estate OS, the backups repository, production Supabase and Shopify were not opened.

Plain-English summary for Stas: this pass found and fixed **12 real problems** in the dashboard, two of them live on the site today, and added three owner features (Recently finished + Reopen, "?" tiles that open their page, a "not saved yet" question). It also re-checked the GitHub access problem (still open) and wrote the agent, role, compliance and recovery plans. Nothing needs a database change to merge.

## 1. Start-of-session check (read-only)

| Check | Result |
|---|---|
| Account the session acts as | `StasVitiuk-dev` (the owner account), **admin** on the repository; `protect-main` reports `current_user_can_bypass: always`. Expected `stasvitiuk-reos`, push only. **Not used.** See §6 |
| Repositories in scope | This repository only |
| `main` | `d3db7bc`, unchanged since EXT6 |
| Ruleset `protect-main` | Active: PR required, 1 approval, code-owner review, last push approved by someone else, stale approvals dismissed, no force push, no deletion; bypass: Repository admin (always) |

## 2. Bugs fixed (every one has a test that fails on the old code)

| # | Problem | Live on `main`? | Fix | Proof |
|---|---|---|---|---|
| X7-01 | Tax Records "sales tax by state" split one state into several rows ("CA", "California", " california ") | **yes** | `taxStateKey` helper (US codes, full names, case, spaces; outside the US "Province (CC)") | `tax-oracle.spec.js` (4 seeds up to 1,100 orders, independent cents calculation) |
| X7-02 | Tax Records cost estimate missed SKUs in another case ("syn-a" vs "SYN-A"); estimate showed $68.50 instead of $215.50 in the proof | **yes** | case/space-insensitive SKU match; all products read (paged) | same |
| X7-03 | A money figure could freeze part-way through its count-up under load ($99,949.17, later $99,745.45, instead of the real total) | **yes** (same animation) | First a timer fallback; the final full suite proved that was not enough (the trace showed frames **and** the timer stopped). Final fix: figures keep their exact text and only **fade in**; nothing ever rewrites a number | `accounting-oracle.spec.js` "frames stop part-way" and "copied while counting up" (fails on the count-up: $75,855.37); mutant "effect changes the number" caught |
| X7-04 | Tasks, Approvals and Incidents read the first 100 rows of **every** status and dropped closed ones in the browser: with enough closed rows, open ones never appeared | **yes** | the database returns open rows only (incidents keep rows with no status); the count note counts open rows | `owner-control-center.spec.js` (4 tests) + 3 mutants |
| X7-06 | One failed read blanked the whole Business Health panel | yes | each read settles on its own; its tile shows "?" with the reason | 2 tests + 1 mutant |
| X7-07 | Typed but unsaved work was lost silently on close, reload or sign out (dashboard and order page) | yes | question first; a failed order save keeps the protection; forced sign-out never waits | `unsaved-changes.spec.js` (8) + 3 mutants |
| X7-08 | Business Continuity showed an unknown or missing status as "Operational" and left it out of the counts | yes | "Unknown (…)" option and count; a change is guarded on the real value | `stale-tab-gaps.spec.js` |
| X7-09 | SOP "agent may reference" switch guessed its state after a stale refusal | yes | re-reads | same |
| X7-10 | Adding a supplier after a lost reply could create a duplicate | yes | same-name check first (any case, literal match), with a question | same |
| X7-11 | A different person signing in in another tab left the previous person's data in the open tab (dashboard and order page, including the unfinished order attempt) | yes | tab wipes when the signed-in person changes; same-person refresh ignored | `auth-chaos.spec.js` (3) + 3 mutants |
| — | New EXT7 error lines showed "[object Object]" (found by the EXT7 screenshots, before any commit reached `main`) | no | text passed correctly | tests forbid "[object" |
| — | Two inventory creates were classed "dangerous to repeat"; the database's `UNIQUE (product_id)` already refuses a second row | doc only | reclassified SAFE ALREADY | `IDEMPOTENCY_AND_RETRY_POLICY.md` §5 |

Also: the request baseline had not been updated for the EXT7 products read (would have failed the suite); fixed with the next commit.

## 3. New owner features (workstream J)

- **Recently finished** (Tasks page): the 10 most recently changed finished or cancelled tasks. **Reopen** puts a *finished* task back to Open, asks first, and applies only if the task is still finished (`status in (done)` in the same request). A cancelled task cannot be reopened (agents cancel for reasons the page can't see). State machine updated (`STATE_MACHINES.md`).
- **Business Health:** "?" per tile when a figure can't be read (unknown is not zero); Pending approvals, Overdue tasks and Open high/critical incidents are buttons that open their page.
- **Unsaved-changes protection**, **Unknown service states**, **supplier same-name question** (above).
- Mobile: checked at 320, 390 and 1100 px (screenshots). Known limitation: wide tables scroll sideways on phones (pre-existing, X7-15).

## 4. Matrices and inventories

### A/C. Write paths and retry classes
`MUTATION_WRITE_PATH_INVENTORY.json` (generated by `node tests/tools/write-paths.js --json`, kept current by a test): **99 write paths. SAFE ALREADY 70 · CLIENT-SIDE MITIGATION ONLY 6 · DATABASE REQUEST KEY NEEDED 23 · UNRESOLVED 0.** Reusable request-key design: `IDEMPOTENCY_AND_RETRY_POLICY.md` §5 (draft 19, OWNER APPROVAL REQUIRED).

### B. R1–R5 random and interleaved stress
`local-test/random_interleavings.sh`, seed 2026, 300 rounds per column (local PostgreSQL 16, real table shapes, synthetic data):

| Scenario | Without guard | EXT5 draft | Current draft | Revised draft | Expected |
|---|---|---|---|---|---|
| Random parallel mixes: adjustments, R1 receive, stale-tab line edit / delete / add, recall quarantine, return restock, today's browser stock write | **75 / 300 broken** ("received order with an unreceived line"); minimal repro: *stale-tab line add + R1 receive of the same order* | 0 / 300 (1,262 stale changes refused) | 0 / 300 (1,186 refused) | not needed | 0 |
| Browser step-by-step receive vs stale-tab edit (EXT6 forced orderings) | 1 SILENT, 5 reported | 2 reported | all agree | not needed | all agree |
| Deadlocks | 0 | 0 | 0 | — | 0 |

A harness bug was found and fixed during this work: the clean-up between rounds was itself refused by the guard (correctly), so guarded rounds could have run on leftover rows. The clean-up now runs with triggers off and stops the run on any error, and the summary counts real activity (orders received, changes applied and refused) so "0 broken" can be trusted.

### D. Accounting oracle
Tax Records now has its own independent oracle (`tax-oracle.spec.js`): the 5 figures, the by-state table and the cost estimate equal a separate whole-cents calculation for 4 seeds (0 to 1,100 orders, deleted rows, cancelled / refunded / partially refunded statuses, mixed spellings, unmatched SKUs). Accounting's oracle (EXT6) gained the frozen-animation case.

### E. State machines
`STATE_MACHINES.md` regenerated: tasks now `done → open` (Reopen) and `cancelled` is the only terminal state. Stale-tab tests added for service status (had none), the SOP switch and supplier creation.

### G. Auth / session chaos
New: different-person sign-in elsewhere (wipe), same-person refresh (no wipe), order page user switch (form and unfinished attempt cleared), forced sign-out with unsaved typing (no prompt, page wiped).

### H. Roles
`ROLE_PERMISSION_MATRIX.md`: every area with TESTED / DB (Query A) / UNKNOWN evidence. Open questions: employees can approve requests in the database; admin switches have no page-side check and their database rule is UNKNOWN (Query D).

### I. Auditability
Reopen is recorded by the existing `tasks` audit trigger. Compliance tables outside the trigger remain the main gap (roadmap step L2).

## 5. Plans and reviews (documents only; nothing installed)

- **K. Agents / automation:** `AUTOMATION_AND_AGENT_REVIEW.md`, proposals K1–K11 with class, purpose, why, data, risk, approval, cost and timing. Recommended first: K2 (needs-attention, partly done), K7 (month-end checklist), K1 (daily integrity check, SOON). **No agent was turned on or installed.**
- **L. Incident / quality / compliance:** `ARCHITECTURE_ROADMAP_INCIDENT_QUALITY_COMPLIANCE.md`, steps L1–L9; L2 (audit trigger on the compliance tables) is the cheapest first step.
- **Q. Recovery:** `ROLLBACK_AND_BACKUP_REVIEW.md` EXT7 section. Backup health is still **UNKNOWN**; a restore drill into a throwaway project is recommended (X7-16).
- **N. Accessibility:** new tiles are real buttons with spoken names ("Overdue tasks: 3. Open that page."), visible focus ring; Recently finished uses a native disclosure; the Unknown option is a real (disabled) option. Covered by the a11y specs in the full suite.
- **O. Performance:** the open-items fix *reduces* rows read (closed rows no longer fetched). Business Health reads unchanged.
- **S. Modularization:** one helper added to the shared helper file (`taxStateKey`, API 7); no new page-level duplication.

## 6. Security finding (workstream F)

`docs/security/GITHUB_CREDENTIAL_ADMIN_FINDING_2026-10-07.md`: what was observed (owner account, admin, "always" bypass), why it is dangerous (review rule does not apply; merge = live deploy; one layer of protection), minimum privilege (Write collaborator on this repository only, as `stasvitiuk-reos`), remediation (reconnect Claude with the collaborator account; set admin bypass to pull-requests-only) and verification (three read-only API checks). **These rights were not used.**

## 7. Red-team review (workstream T)

| Attack idea | Result |
|---|---|
| Hide an open item by creating many closed ones | Fixed (X7-04) |
| Leave a shared computer signed in; second person signs in from another tab | Fixed (X7-11) |
| Stale tab reopens a task someone just cancelled | Refused by the database condition; tested |
| Stale tab edits a PO line during receive | Refused by the guard draft (not installed); 75/300 rounds break without it |
| Supplier name with `%` or `_` to match everything | Matched literally; tested |
| URL / message-based injection | No URL-driven routing, no message listeners, no eval in any page (static check) |
| Automated session pushes to `main` | Technically possible today (X6-17); only written rules prevent it |

## 8. Owner decisions and production blockers

Decisions (`OWNER_DECISIONS_NEXT.md`, "New in extension 7"): X6-17 GitHub access; X7-14 employee approvals and admin switches; X7-16 restore drill; which automations next. Earlier decisions unchanged.

Production blockers (none can be closed on the branch): R1–R5 install, PO line guard, request keys (each OWNER APPROVAL REQUIRED); Query C and Query D not run; backup health unknown; Agent #1 state unverified; GitHub admin credential.

## 9. Final evidence

(Filled in after the final verification on the frozen code; see below.)
