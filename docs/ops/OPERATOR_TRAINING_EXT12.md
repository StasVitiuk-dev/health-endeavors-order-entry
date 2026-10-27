# Operator training pack (EXT12)

> **SUPERSEDED (EXT13 navigation, 2026-10-11)** by `OPERATIONS_HANDBOOK_EXT13.md`. Start at `START_HERE_EXT13.md`; authority per topic: `SOURCE_OF_TRUTH_MAP_EXT13.md`. Nothing below this line was changed by EXT13 except dated correction notes.

**Status:** CURRENT (2026-10-11, extension 12). How to train a person (staff or the owner) to use the dashboard safely **after the merge**. Short on purpose. Day-to-day wording: `OPERATOR_QUICK_REFERENCE_EXT10.md` (unchanged). Incident cards: `INCIDENT_SIMULATION_EXT12.md`. Practise on the **staging copy** (synthetic data, never connected to production; `STAGING_REVIEW_PLAN.md`) once its location is decided, never on live records.

## 1. Basic training (30 minutes)

| # | Topic | The one thing to remember | Practise |
|---|---|---|---|
| 1 | Home | Red = cannot be right; amber = to do; grey = info. **"Could not check" means unknown, not fine.** | read Home aloud and say what each row asks |
| 2 | Needs your attention | Work from the top; "Next step:" says what is expected | open two items and say who does them |
| 3 | Words | "—" is not $0; NOT VERIFIED / UNKNOWN is never "fine" | quick-reference §2 |
| 4 | Saving | If a save "may or may not have been saved", **look at the list first** | add a reminder, then find it |
| 5 | Conflicts | "changed elsewhere" → reload, compare, redo only what is still needed | open the same record in two tabs |
| 6 | Signed out | sign in again, then check your last save before redoing it | — |
| 7 | What the dashboard never does | send customer messages, move money, issue refunds, make accounting or tax entries, delete products with history, turn switches on by itself | — |

## 2. High-risk training (owner, and anyone allowed to touch stock)

| Action | Rule | Never |
|---|---|---|
| Receive a purchase order | Press twice (the second confirms). After "Receipt status unknown": **Check this order now** | press Receive again |
| Manual stock adjustment | always a reason; a bucket never goes below zero | force a number that makes another bucket wrong |
| Return: Mark received | choose the outcome (restock available / damaged / discard). After a lost connection: read the status and the stock history first | mark received twice; record a refund to "fix" stock |
| Recall: quarantine | after a lost connection, check the lot's buckets first | quarantine twice |
| Mark refunded | records a refund made elsewhere; the dashboard moves no money | treat it as issuing a refund |
| Feature switches | **owner only**, one per sitting, only after its SQL step is installed and checked (`DEPLOYMENT_SIMULATION_EXT12.md`); switching **off** is always safe | turn several on at once |
| Products | archive instead of delete when there is history | ask for a database delete |

## 3. Owner routines

**Daily (2 minutes):** Home → Checks → Nightly integrity check card (PASS / WARN / FAIL / STALE / NOT VERIFIED; "Not set up yet" until installed) → Needs your attention from the top → press **Check again** on anything older than its freshness note.

**Weekly (10 minutes):** System status (Continuity page): agents, switches (all OFF until the rollout), Database steps; Recently Done (reopen anything closed by mistake); Inventory low/negative rows; the open approvals; look at the backup run (card 1 of `OWNER_CHECKS_EXT11.md`) if a database step is planned that week.

**Month-end (30 minutes):** Accounting and Tax pages for the month (missing totals are named, never counted as $0); export the tax CSV for the accountant; compare refunds recorded with what was actually paid elsewhere (the N4 rule decides how refunds subtract; until then they are records only); re-run Query E and H if any stock switch is on; check evidence ages with `npm run evidence:status` (Claude runs it) and re-run anything STALE.

**Needs Attention noise check (once a month):** if more than about 10 rows sit amber for over a week, either the work is behind or the thresholds are wrong. That is the thresholds decision (`OWNER_DECISION_STATUS_EXT12.md`), not a reason to ignore the list.

## 4. Check questions (answers in the cards)

1. The screen says "Receipt status unknown — do not press Receive again". What do you press? → **Check this order now** (`po-receive-unknown`).
2. A save says "may or may not have been saved". Can you press Save again? → Only after looking at the list (`save-unknown-no-keys`, AFTER CHECK).
3. Same, but the page says "Pressing the button again is safe". → Yes (`save-unknown-with-keys`, request keys are on).
4. Home shows "Could not check" for a row. Is it fine? → No: unknown (`data-drift`).
5. An amount shows "—". Is it $0? → No: the figure could not be read.
6. System status shows **PROBLEM: switched ON but its database step is missing**. → Owner switches it off now (`stock-fn-missing`).
7. A customer asks for a refund. Can the dashboard issue it? → No. Make it elsewhere; then Mark refunded records it.
8. You want to correct a stock number that looks wrong. First? → Tell the owner; stock corrections go to the owner first.

A person passes when all eight answers are right without looking.

## 5. Limits

This pack has not been tried with a real staff member (there is no staff yet). Real Safari / VoiceOver use is not verified (card 5 of `OWNER_CHECKS_EXT11.md`). Practising on live records is not allowed.
