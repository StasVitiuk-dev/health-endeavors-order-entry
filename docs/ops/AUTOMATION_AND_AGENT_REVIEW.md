# Automation and agent review: proposals (extension 7, workstream K)

> **SUPERSEDED BY EXT9** for agent states: `AGENT_CURRENT_STATE_EXT9.md`. HISTORICAL ONLY.

**Status:** PROPOSED, 2026-10-07. Review and recommendations only. **No agent, cron job, workflow, switch or schedule was installed, turned on, changed or run.** The existing agents (#1–#10) and their reported states are described in `agents-review-and-owner-checklist.md` (still CURRENT for what exists). This page proposes what to add next and how risky each item is.

Classes:
- **DETERMINISTIC**: plain code, same input gives the same output, no judgement.
- **RULE-BASED**: deterministic, but its thresholds or rules are business choices the owner sets.
- **AI ASSISTANT**: uses a language model to draft or summarise. **It never acts on its own**: a person reads and decides.
- **HUMAN-ONLY**: should not be automated at all.

Timing: **NOW** = can be built on the dashboard branch with no production change. **SOON** = needs a small, approved production change (SQL draft + rollback ready first). **FUTURE** = after launch, once there is real volume.

## 1. Summary

| # | Proposal | Class | Build | Cost (running) | Production change? |
|---|---|---|---|---|---|
| K1 | Daily integrity check (stock vs history, received orders, one expense per order, lots) | DETERMINISTIC | SOON | free (one read-only query a day) | a read-only scheduled query, owner approval |
| K2 | "Needs attention today" digest on the dashboard (overdue tasks, pending approvals, unknown service states, orders without items) | DETERMINISTIC | **NOW (partly done in EXT7)** | free | no |
| K3 | Automation health view: last run / failure of every scheduled job and agent | DETERMINISTIC | SOON | free | read access to `cron.job_run_details` (Query C shows what exists) |
| K4 | Low-stock and expiring-lot alerts | RULE-BASED | SOON | free | none for the dashboard view; an e-mail alert needs the email service decision |
| K5 | Reorder suggestion (draft purchase order from low stock + lead time) | RULE-BASED | FUTURE | free | none (creates a *draft* only after a person clicks) |
| K6 | Duplicate-record watcher (same supplier name, same expense amount + date + vendor, same order twice) | RULE-BASED | NOW (supplier check done in EXT7) / SOON (nightly list) | free | read-only |
| K7 | Month-end close checklist (unreceived POs, unpaid POs, expenses without receipts, refunds pending, mixed currencies) | RULE-BASED | NOW | free | no |
| K8 | Customer-service reply drafts (existing Agent #7) | AI ASSISTANT | as is, disabled | ~$0.01–0.05 per draft, capped at $30 / month on the dashboard | already exists; keep drafts-only |
| K9 | Weekly plain-English business summary | AI ASSISTANT | FUTURE | ~$0.10 per week | a new scheduled job, owner approval |
| K10 | Incident write-up helper (turns an incident's notes into a structured report) | AI ASSISTANT | FUTURE | cents per report | no (button on the page) |
| K11 | Approving purchases, refunds, recalls, FDA reports, legal holds, deleting records, price changes, customer messages | HUMAN-ONLY | never automate | — | — |

## 2. Details

### K1. Daily integrity check — DETERMINISTIC, SOON
- **PURPOSE:** catch a broken number the day it happens, not at tax time.
- **WHY:** stock and money are written by several paths (dashboard, agents, triggers). Until R1–R5 are installed, a failure part-way through a multi-step action can leave stock and history disagreeing. `local-test/invariants.sql` already lists 12 rules and is tested.
- **DATA:** inventory, inventory_adjustments, inventory_lots, purchase orders and lines, expenses, recalls, returns. Read-only. No customer data.
- **RISK:** low. Read-only. A false alarm costs a look. The production version must not use the "history starts at zero" rule (production history does not start at zero); use the reconciliation view instead (`reconciliation_test.sh`).
- **HUMAN APPROVAL:** to schedule it (pg_cron) and to choose where the result shows (dashboard banner recommended; e-mail needs the email decision).
- **COST:** free.
- **BUILD:** SOON (after Query C confirms which writers exist).

### K2. "Needs attention today" — DETERMINISTIC, NOW
- **PURPOSE:** one place that answers "what do I have to do today?"
- **WHY:** the owner opens many pages to find the same answers. EXT7 already made the Business Health tiles show "?" (unknown) per tile instead of blanking, made the work tiles open their page, and fixed the lists that could hide open items.
- **DATA:** tasks, approvals, incidents, service status, orders without items (EXT6). Read-only.
- **RISK:** very low. The only real risk is a wrong count; each count is tested against its list.
- **HUMAN APPROVAL:** none to build; the owner chooses what belongs on it.
- **COST:** free.
- **BUILD:** NOW. Next step: add "orders saved without items" and "unknown service states" tiles.

### K3. Automation health view — DETERMINISTIC, SOON
- **PURPOSE:** see, on one page, whether every scheduled job and agent ran and succeeded.
- **WHY:** there are two schedulers (Supabase pg_cron and GitHub Actions in the private repository). A failure is visible today only on separate pages or in GitHub e-mail. Agent #1's state is still UNVERIFIED.
- **DATA:** `agent_controls.last_run_*`, pg_cron run history (if readable), the dashboard's own switches. No customer data.
- **RISK:** low. It must say UNKNOWN when it cannot read a source, never "OK".
- **HUMAN APPROVAL:** a read grant on the cron history, if the owner wants it shown (production permission change).
- **COST:** free.
- **BUILD:** SOON.

### K4. Low-stock and expiring-lot alerts — RULE-BASED, SOON
- **PURPOSE:** reorder before running out; use or quarantine lots before they expire.
- **WHY:** thresholds already exist per product (low-stock threshold). Expiry is on lots.
- **DATA:** inventory, thresholds, lots.
- **RISK:** low. Thresholds are business choices (the owner sets them).
- **HUMAN APPROVAL:** the thresholds; any e-mail alert waits for the email-service decision.
- **COST:** free.
- **BUILD:** SOON (dashboard view first, no e-mail).

### K5. Reorder suggestion — RULE-BASED, FUTURE
- **PURPOSE:** pre-fill a draft purchase order for low items.
- **WHY:** saves time once there is real volume.
- **DATA:** stock, thresholds, supplier, last cost.
- **RISK:** medium if it ever ordered by itself. **It must only create a draft after a person clicks, and never send anything to a supplier.**
- **HUMAN APPROVAL:** every draft is reviewed and sent by a person.
- **COST:** free.
- **BUILD:** FUTURE.

### K6. Duplicate-record watcher — RULE-BASED
- **PURPOSE:** find records created twice (a lost reply, then a second press).
- **WHY:** 23 create paths can duplicate until request keys are installed (`IDEMPOTENCY_AND_RETRY_POLICY.md` §5).
- **DATA:** suppliers, expenses, returns, recalls, orders. Read-only.
- **RISK:** low. It lists suspects; a person decides. It never deletes.
- **HUMAN APPROVAL:** none for the list.
- **COST:** free.
- **BUILD:** NOW for suppliers (done in EXT7: same-name question). SOON for a nightly list.

### K7. Month-end close checklist — RULE-BASED, NOW
- **PURPOSE:** a checklist the owner runs before the accountant sees the month.
- **WHY:** Accounting and Tax Records are exact (independent oracle tests), but they are only as complete as the records. Open items should be visible.
- **DATA:** POs (unreceived, unpaid), expenses without receipts, partial refunds, mixed currencies.
- **RISK:** low. Read-only.
- **HUMAN APPROVAL:** none.
- **COST:** free.
- **BUILD:** NOW (next extension).

### K8. Customer-service reply drafts (Agent #7) — AI ASSISTANT
- **PURPOSE:** draft replies to customer inquiries.
- **WHY:** exists already; disabled until there are products and customers.
- **DATA:** inquiries, orders, and only the SOPs marked "agent may reference" (the EXT7 fix makes that switch show its real state after a conflict).
- **RISK:** medium. Customer data goes to a model provider. **It must stay drafts-only; never send.** No-AI and Emergency modes pause it (tested).
- **HUMAN APPROVAL:** every reply is read and sent by a person. Turning it on is the owner's decision.
- **COST:** capped at $30 / month (dashboard tile).
- **BUILD:** as is. Do not turn on in this session.

### K9. Weekly plain-English summary — AI ASSISTANT, FUTURE
- **PURPOSE:** "what happened this week" in a few sentences.
- **WHY:** useful once there is volume.
- **DATA:** totals only (no customer names or e-mails sent to the model).
- **RISK:** low if only totals are sent. A model can misstate a number, so every figure in it must be copied from the dashboard's own totals, not computed by the model.
- **HUMAN APPROVAL:** to schedule it.
- **COST:** about $0.10 a week.
- **BUILD:** FUTURE.

### K10. Incident write-up helper — AI ASSISTANT, FUTURE
- **PURPOSE:** turn rough incident notes into a structured report (what, when, impact, cause, fix, follow-up).
- **WHY:** a quality and compliance trail (see the roadmap, `ARCHITECTURE_ROADMAP_INCIDENT_QUALITY_COMPLIANCE.md`).
- **DATA:** the incident's own notes.
- **RISK:** low. A person edits and saves.
- **HUMAN APPROVAL:** each report.
- **COST:** cents.
- **BUILD:** FUTURE.

### K11. Human-only decisions — never automate
Approving purchases, refunds and approval requests; recalls, quarantines and FDA adverse-event reporting; legal holds; deleting records; price or cost changes; any message to a customer or supplier; turning agents or Emergency mode on or off. **Why:** each has legal, money or customer impact, and the owner is accountable for it.

## 3. Rules for every future automation

1. **Unknown is not OK.** Every automation shows UNKNOWN when it cannot read a source.
2. **Drafts, not actions.** Anything that would change money, stock or customer contact creates a draft for a person.
3. **One switch per automation**, visible on the AI Agent Activity page, paused by Emergency mode if it writes data (owner decision D-ops-8).
4. **Idempotent by design:** a re-run changes nothing new (request keys or a natural unique key).
5. **Logged:** every run writes who/what/when, so the audit history explains it.
6. **No customer data to an AI model** unless the owner decides it, per agent.
