# Agents 1–10: current state (EXT9)

**Status:** CURRENT (2026-10-10, extension 9). One table per agent. **Nothing here was installed, enabled, disabled or run in production by Claude.** Sources: the dashboard's agent registry (`owner-login.html` `AGENT_REGISTRY`), `agents-review-and-owner-checklist.md` (reported states, Sept 24–26), `AUTOMATION_AND_AGENT_ARCHITECTURE.md` (what to build). Supersedes the per-agent table in `AUTOMATION_AND_AGENT_REVIEW.md` (EXT7, kept as history).

Wherever a production fact has not been read back from the database it says **PRODUCTION STATE REQUIRES READ-ONLY VERIFICATION** (Query C §agents, `PRODUCTION_READONLY_VERIFICATION_EXT9.md` V3).

## 1. Summary

| # | Agent | Kind | Runs | Intended state now | Last known state | Customer contact | Money |
|---|---|---|---|---|---|---|---|
| 1 | Invoice | Deterministic | Database trigger on order create/change | ON | **UNVERIFIED**: paused for a test on Sept 24, not recorded as turned back on | None | Paperwork only (invoices), never moves money |
| 2 | Order Intake | Deterministic | GitHub Actions (private repo) | OFF until products exist | OFF (workflow disabled, Sept 26, REPORTED) | None | None |
| 3 | Order Monitoring | Deterministic | GitHub Actions | OFF until products exist | OFF (REPORTED) | None | Opens approval requests for large refunds/cancellations; cannot approve |
| 4 | Retail/Wholesale | Deterministic | Supabase pg_cron hourly :03 | ON | ON (REPORTED, v4) | None | None |
| 5 | Shipping/Tracking | Deterministic | Supabase pg_cron hourly :10 | ON | ON (REPORTED, v3; pause test passed) | None (opens tasks) | None |
| 6 | Customer Notification | Deterministic, **dry run** | Supabase pg_cron hourly :05 | ON (dry run) | ON (REPORTED, 32 clean runs) | **Cannot send**: no e-mail service connected; writes a log of what it would send | None |
| 7 | Customer Service | **Model-backed** (paid AI) | GitHub Actions | OFF until products exist | OFF (REPORTED) | **Drafts only**, a person sends | None; capped $30/month |
| 8 | Supervisor | Deterministic | GitHub Actions (move to Supabase planned) | OFF | OFF (REPORTED) | None | None |
| 9 | Accounting | Dashboard calculation | In the page when opened | Always (not a job) | Live | None | Read-only figures |
| 10 | Tax Record | Dashboard calculation | In the page when opened | Always (not a job) | Live | None | Read-only figures |

## 2. Per-agent detail

| # | Reads | Writes | Human approval | De-duplication | Retry / stuck behaviour | Audit | Known risks | Production verification required |
|---|---|---|---|---|---|---|---|---|
| 1 Invoice | orders | invoices | none needed (paperwork) | one invoice per order (trigger logic, REPORTED; invoices table shape not exported) | runs inside the order's own transaction: fails with it, never half-done | trigger-defined (unknown) | its pause state is unknown; orders ↔ invoices reconciliation needs the invoices table shape (D2) | **YES**: switch state (V3), trigger present (Query C) |
| 2 Order Intake | orders | tasks | a person handles each task | duplicate-order-number flag; task dedupe UNKNOWN | GitHub retry semantics UNKNOWN | ai_decision_log? UNKNOWN | could open duplicate tasks if re-run (UNKNOWN) | **YES**: workflow disabled (owner looks at the private repo's Actions page; Claude does not open it) |
| 3 Order Monitoring | orders | approval_requests, tasks | **yes**: refunds/cancellations over the threshold wait for a person; the agent cannot approve | UNKNOWN | UNKNOWN | approval rows show who decided | duplicate approval requests on re-run (UNKNOWN) | **YES** (as #2) |
| 4 Retail/Wholesale | orders | customers, order→customer link, tasks (email mismatch) | mismatch → task for a person | never relinks once set (REPORTED) | hourly; a failed run retries next hour | unknown | same person with a changed e-mail becomes a second customer (by design: no automatic identity merge) | **YES**: cron job active (Query C) |
| 5 Shipping/Tracking | orders, business_rules | shipments, tasks, ai_decision_log | delayed/failed → task | up to 500 orders per run; repeated runs update the same shipment row (REPORTED) | hourly; next run catches up | ai_decision_log rows | a delayed task stays open after delivery until a person closes it (by design) | **YES**: cron job active |
| 6 Customer Notification | order events | customer_notifications (log only) | — | one log row per event (REPORTED) | hourly | the log itself | **must stay dry-run** until an e-mail service, templates and an approval step are decided (owner R10) | **YES**: no e-mail service connected (V3 checks for one) |
| 7 Customer Service | customer_inquiries, orders, opted-in SOPs | reply drafts, ai_decision_log | **every reply is reviewed and sent by a person** (dashboard has no send path: `hard-walls.spec.js`) | one draft per inquiry (overwrite guarded by the page) | paused by No-AI and Emergency modes | ai_decision_log | model cost; claims in drafts (compliance queue D8) | **YES**: workflow disabled |
| 8 Supervisor | orders, invoices, tasks, shipments, inquiries | tasks | tasks for a person | UNKNOWN | UNKNOWN | unknown | not running: nothing watches for stuck agents today (design D6) | **YES**: disabled |
| 9 Accounting | orders, expenses | nothing | — | — | recomputed on every page load; latest request wins (EXT8) | — | refund rule N4 undecided (figures follow today's rule) | No |
| 10 Tax Record | orders, order_items, products, expenses | nothing (CSV export only, formula-safe) | — | — | as #9 | — | estimate only; accountant decides | No |

## 3. Failure and recovery testing (EXT9 workstream 9): what could and could not be done here

| Agent | Tested here? | Why |
|---|---|---|
| 9, 10 | **Yes**: oracles, period boundaries, out-of-order replies, empty data, huge data (accounting-oracle, tax-oracle, money-periods, out-of-order, scale specs) | They are page code |
| 1–8 | **No** synthetic failure tests possible in this repository | Their code lives in Supabase (triggers / pg_cron functions) and the private repository, which this session must not open. The dashboard side (switch display, unknown vs paused vs off, Emergency switch-off) is tested (agent-truth, admin-pages, safety specs) |

What is needed to test 1–8 safely: the owner exports each agent's function source (Query C already lists names and schedules without printing code), and a separate approved task reproduces them on the local throwaway database with duplicate runs, crashes mid-run, stale tasks and malformed rows. **EXTERNAL INFORMATION REQUIRED** (function source), **OWNER APPROVAL REQUIRED**.

## 4. Rules every agent must keep (from `AUTOMATION_AND_AGENT_ARCHITECTURE.md` §5)

UNKNOWN is never shown as fine; intentionally off is never shown as broken; read-only by default; any writing automation is idempotent, logged, behind its own switch and paused by Emergency mode; no automatic deletion, refund, reorder, recall, report to an authority or customer message.
