# Operations center (EXT10): how to run the business day with the dashboard

**Status:** CURRENT (2026-10-11). The single entry point for **daily use** of the internal dashboard: what to look at, what each status means, what to do when something is wrong. Describes the dashboard on branch `claude/platform-ext10-operations-hardening-2026-10-11` (IMPLEMENTED IN BRANCH, TESTED LOCALLY, **NOT DEPLOYED**; after the merge it describes the live dashboard). Project state and what is left: `CURRENT_PLATFORM_STATE_EXT10.md`. Production steps: `PRODUCTION_CHANGE_PACKAGE_EXT10.md`. Short card for staff: `OPERATOR_QUICK_REFERENCE_EXT10.md`.

## 1. The one rule

**When the dashboard says it does not know, stop.** "UNKNOWN", "NOT VERIFIED", "Could not check", "may or may not have been saved", "Receipt status unknown" all mean: do not press the button again, do not fix numbers by hand to make them look right. Check, then act. Repeated clicking is how duplicates and wrong stock happen.

## 2. Owner: 5-minute morning check

1. **Home → Checks: what needs a look.** Read red first (data that cannot be right), then amber (to do). Every row says *what*, *why* ("Why is this here?"), *how old* ("oldest …"), *how serious* (Data problem / To do / Info / Could not check), *where* (Open) and **Next step**.
2. **Home → Nightly integrity check.** PASS / WARN / FAIL / STALE / NOT VERIFIED (until installed it says "Not set up yet": expected).
3. **Backups line** always says "not verified here": do the 2-minute look once a week (or before any production step).
4. **Urgent incidents** and **approvals waiting** rows: handle or delegate.
5. **Agents failed or not running on schedule** row (if present): open AI Agents and read the last error. Do not "catch up" data by hand.

That is all. No need to visit every page.

## 3. Owner: weekly check (15 minutes)

| Look at | Where | Healthy looks like |
|---|---|---|
| Backup freshness | private backups repo (V1, owner only) | nightly ≤ 2 days, restore test ≤ 35 days |
| Open incidents and stuck tasks | Home checks; Incidents; Tasks | nothing old without an owner |
| Agents | AI Agents (badges) | Enabled / Dry run / Off — on purpose; no Failed, Stale or Unknown you did not expect |
| Low stock and "level not set" | Home checks → Inventory | decisions made, nothing reordered automatically |
| Read-only drift check (after any production step) | Query H (V13) | no FAIL rows |
| System status | Continuity → System status | Database "Reading works"; environment PRODUCTION |

## 4. Month-end read-only review (no accounting actions)

Returns still open (Home "Returns waiting") · Tax Records "expenses missing a receipt" list · open purchase orders (late deliveries) · Query F (or the nightly card) · backups (V1) · anything on Home marked Data problem. The dashboard never posts journal entries, files taxes or moves money.

## 5. What each status word means (one vocabulary everywhere)

| Word | Meaning | Never confused with |
|---|---|---|
| **0** | checked, and there are none | UNKNOWN |
| **UNKNOWN / Could not check / ?** | the dashboard could not read it | 0 or "fine" |
| **NOT VERIFIED** | not set up yet, or the dashboard cannot see it (backups, GitHub-run agents) | PASS |
| **PASS** | checked recently and nothing was found | — |
| **WARN** | something to look at (stuck work, probable duplicate) | FAIL |
| **FAIL** | data that cannot be right, or a run that failed | WARN |
| **STALE** | the last good result is too old to trust | PASS |
| **Off — on purpose** | an agent switched off by decision (#2/#3/#7/#8 until launch) | Disabled, Failed |
| **Disabled** | an agent switched off (not a recorded decision) | Off — on purpose |
| **Dry run** | runs but only logs what it would do (Agent #6) | Enabled |
| **Calculated here** | worked out by the page (Agents #9/#10) | a background job |
| **—** (instead of an amount) | the figure could not be read | $0.00 |
| **"—" CONFIG REQUIRED** | needs an owner setting (e.g. low-stock level) | 0 |

## 6. Daily operations journey (what was walked and fixed in EXT10)

Walked as an operator on synthetic data at desktop (1100 px) and phone (320–430 px): sign in → Home → checks → orders → inventory → purchase orders → tasks → approvals → incidents → returns → customer questions → Continuity → sign out.

| Found | Fixed |
|---|---|
| Home rows said what was wrong but not what to do | "Next step" on every check (and on every "could not check") |
| Low stock silently ignored products without a level | "Low-stock level not set — CONFIG REQUIRED" (never guesses a level) |
| Deactivated products with stock were invisible | "Deactivated products still holding stock" (info) |
| Agents that failed or stopped were only visible on the AI page | "Agents failed or not running on schedule" on Home; unknown ones listed as unknown |
| #2/#3/#7/#8 looked "Disabled" although off on purpose | "Off — on purpose" |
| After a lost reply on Receive, the page said "do not press Receive again" and then showed the Receive button | "Receipt status unknown" lock + read-only "Check this order now" |
| A received order said "stock added" even when lines were short | says how many lines are not in stock |
| Wide tables needed sideways scrolling on phones | cards (EXT10 first mission) |
| Pick-lists and long lists stopped silently at the database's reply limit | full reads / "Showing N of M" |
| No safe way to report a problem | Continuity → System status → "Copy diagnostic summary" (no personal data) |

Dead ends checked and not found: every Home row has an Open button to the right page; every page is reachable from the sidebar and by deep link; Back returns to the previous page (EXT8).

## 7. Incident runbooks (no destructive fixes; stop and escalate when unsure)

| Situation | Signs | Do | Do NOT |
|---|---|---|---|
| **Data drift** (production differs from what was reviewed) | Query H row FAIL | Turn the named switch OFF (Feature Switches). Send the Query H CSV. | install anything else; "fix" functions by hand |
| **RLS / permission failure** (a legitimate person is suddenly refused) | "not permitted", "Only the Owner…", page shows "Could not check" | Note page, time, person's role. Owner checks Query G (V5). | widen permissions as a workaround; share the owner login |
| **Sign-in failure** | "Sign in again", sign-in loops | Sign out, sign in. If it persists, reset password (change-password page). | paste passwords or tokens into messages |
| **Integrity check failed** | nightly card FAIL or Query F rows | Open each listed record (drill-down → Open). Fix through normal pages with a reason. | delete records to make the count zero |
| **PO receive uncertain** | "Receipt status unknown — do not press Receive again" | Press "Check this order now". Follow what it says (safe / done / add missing stock with a reason). | press Receive; adjust stock before the check |
| **Stock mismatch** | Home "Stock below zero" / "Received orders not fully in stock"; Query E | Look at the product's stock history; one manual adjustment with a clear reason. | repeated small adjustments; editing history |
| **Agent unknown** | badge Unknown; Home "Agents in an unknown state" | Owner runs Query C (V2) or looks at GitHub → Actions. | assume it is running; switch things on to test |
| **Backup stale** | V1 answer STALE or FAILED | No production change until fixed. Owner checks why (often: Actions minutes ran out). | open or change the backups repository from a Claude session |

## 8. Reporting a problem

Continuity → **System status** → **Copy diagnostic summary**, paste it into the message with one sentence of what you were doing. It contains environment, page, version, database read result, role, nightly and agent states and the *kind* of the last error — never names, e-mails, record contents, keys or tokens.

## 9. Where things are (no duplicates)

| Need | Document |
|---|---|
| State and what is left | `CURRENT_PLATFORM_STATE_EXT10.md`, `OWNER_UNBLOCK_CENTER_EXT10.md` |
| Read-only production checks (V1–V13) + interpreter | `PRODUCTION_READONLY_VERIFICATION_EXT10.md` |
| Production steps, stop conditions, observation windows | `PRODUCTION_CHANGE_PACKAGE_EXT10.md` |
| Maps (entities, write/read paths, side effects, state machines, automation rules) | `OPERATIONS_MAPS_EXT10.md` |
| Decisions | `OWNER_DECISION_PACKETS_EXT10.md` |
| Staff card | `OPERATOR_QUICK_REFERENCE_EXT10.md` |
| Integrity rules | `DATA_INTEGRITY_RULES_EXT10.md` |
| Staging | `STAGING_REVIEW_PLAN.md` |
