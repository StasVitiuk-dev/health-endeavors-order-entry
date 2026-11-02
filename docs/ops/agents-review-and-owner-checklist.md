# Agents and automation — review and owner checklist

**Status:** review only, 2026-10-04. Claude cannot see Supabase or the private backups repo, so every agent state below is **reported** (from earlier records), not verified. **No agent setting was changed.**

## 1. Architecture as recorded

| # | Agent | Runs where | Writes | Switch | Reported state |
|---|---|---|---|---|---|
| 1 | Invoice | Database trigger on order create/change | invoices | `agent_controls.enabled` (pause enforcement verified 2026-09-24) | **UNVERIFIED.** Paused for a test on 2026-09-24; not recorded as turned back on. |
| 2 | Order Intake | GitHub Actions (private repo) | flags | switch | Disabled until products exist |
| 3 | Order Monitoring | GitHub Actions | approval requests | switch | Disabled |
| 4 | Retail/Wholesale | Supabase pg_cron, hourly at :03 | customer links, flags | switch | Live (v4) |
| 5 | Shipping/Tracking | Supabase pg_cron, hourly at :10 | shipments, tasks | switch | Live (v3) |
| 6 | Customer Notification | Supabase pg_cron, hourly at :05 | a log of emails it *would* send (dry run) | switch | Live (v2), no email service |
| 7 | Customer Service | GitHub Actions; calls a paid AI model | reply drafts only (never sends) | switch; auto-paused by No-AI and Emergency modes | Disabled |
| 8 | Supervisor | GitHub Actions (move to Supabase planned) | flags, tasks | switch | Disabled |
| 9 | Accounting | Dashboard calculation | nothing | – | Live |
| 10 | Tax Record | Dashboard calculation | nothing | – | Live |

Frozen versions, fingerprints and rollback files for #4–#6 are in the owner's private *System Documentation* §16. They are deliberately not in this public repo, and this session has not seen them.

## 2. Findings

1. **Agent #1 state is the biggest launch risk among the agents.** If it is still paused when real orders arrive, orders will have no invoices. The registry text on the dashboard says "Live now" for #1 **whatever its switch says** (it is fixed text). Only the switch row on the AI Agent Activity page shows the truth.
2. **Stale text** for #2/#3/#7/#8 ("waiting on GitHub Actions minutes, resets Oct 1"): it is now past Oct 1 and they stay off by design. PR #8 fixes the wording only.
3. **Emergency mode doesn't stop the writing agents.** No-AI and Emergency pause only #7. #1, #4, #5 and #6 keep running and writing. **Owner decision:** should Emergency pause every agent that writes data? Recommendation: yes for Emergency, no for No-AI.
4. **Unknown: do any agents change stock?** If Agent #5 (shipping) or a trigger adjusts `inventory` directly, those writes bypass the R1–R4 fixes and keep the lost-update risk. Query C3 answers this from function names alone.
5. **Two schedulers.** Supabase pg_cron runs #4–#6, the calendar sync, the daily report and the compliance checks. GitHub Actions in the private repo runs backups, the restore test, the security watch, credential rotation and #2/#3/#7/#8 when enabled. A failure in either is visible only on the dashboard pages or in GitHub email. Recommend one "automation health" view later; it is part of the integration-service design.
6. **Agent #6 and R10:** before any real email service is connected, re-check #6's templates, its opt-out handling and that it can't send twice (idempotency on order + event).

## 3. Owner checklist (no setting changes; just look and tell Claude)

1. **Agent #1 switch:** Dashboard → AI Agent Activity → Agent #1. Is the switch ON or OFF? (Look only. Don't flip it without deciding first.)
2. Same page: for #4, #5 and #6, does each show "Scheduled job … active" and a **Last run** within the last hour, with status not "failed"?
3. Run **Query C** (`docs/ops/sql/02_READONLY_C_agents.sql`), all three parts, and send the results.
4. **GitHub (private backups repo) → Actions:**
   - did last night's backup succeed?
   - did the most recent monthly restore test succeed (date)?
   - are #2/#3/#7/#8 still disabled?
   Screenshots are fine.
5. **System Mode page:** which mode is it in now (Normal)?
6. Task buttons v2, still open from Sept 29:
   - status survives a refresh
   - the `audit_log` row is a status-only change
   - Cancel on "Mark done" changes nothing
   - real iPhone check
   - optional second staff account
7. Returns: try "Mark Refunded" and restock-to-Available once on a synthetic test return, then tell Claude what the Accounting page shows (relates to finding N4).

## 4. Recommended agent work (after R1–R4; each needs owner approval)

1. The Agent #1 decision, then make its registry text come from the switch (like #4–#6).
2. Emergency mode pauses all writing agents (D-ops-8).
3. Move #8 Supervisor to Supabase, with its in-progress de-duplication.
4. An agent run-history view (from `agent_controls.last_run_*` plus a small history table).
5. R10: re-check #6 before any email provider is chosen.
