# Query C: owner run guide

**Status:** CURRENT (2026-10-06). Query C version 3 is **prepared, not run**. No production results exist yet, and none are recorded here.

> **DO NOT RUN AUTOMATICALLY.** Query C is run only by you (Stas), by hand, in the Supabase SQL Editor, when you choose to. No Claude session, workflow, script or scheduled job runs it. A session may improve and test it only on a local copy with synthetic data.

## What it is for

Before the stock functions (R1–R5) can be installed safely, we need to know whether anything else writes stock directly: an agent, a scheduled job or a database trigger. Query C answers that, plus a few other questions about switches and value rules. It only **reads**. It changes nothing.

File: `docs/ops/sql/02_READONLY_C_agents.sql` (version 3).

## Why it is safe to run

Proven on a local copy and by an automated check (`tests/specs/sql-readonly.spec.js`, which runs with every test suite):

| Property | How it is proven |
|---|---|
| Read-only: exactly one `SELECT` statement, with no insert, update, delete, create, alter, drop, grant or revoke | Static check that removes comments and quoted text first, then counts statements and looks for write keywords. A control test proves the checker catches a hidden write. |
| No function source code or scheduled-job command text in the output (a job command can contain a key) | Those texts are used only for pattern matching. The static check fails if any other use is added. Local test: a job command containing a fake key and project address produces output with neither. |
| No customer data | Only counts, and the names of agents, flags, jobs, functions and tables. Agent error text is cut to 120 characters, with e-mail addresses shown as `[email]` and long token-like strings as `[token]` (both tested). |
| Named columns (`section`, `item`, `result`), so the CSV export keeps every field | Same layout as Query B. |
| Runs even if the scheduler extension (pg_cron) is not installed | Version 3 reads the scheduler tables only if they exist. Tested locally both ways. |

## How to run it (about 2 minutes)

1. Supabase → your Health Endeavors project → **SQL Editor** → **New query**.
2. Open `docs/ops/sql/02_READONLY_C_agents.sql` on GitHub, click **Raw**, select all, copy.
3. Paste into the editor. Check that the first line starts with `-- ===` and the last line ends with `order by 1, 2;`.
4. Click **Run**. Expected: a table with three columns (`section`, `item`, `result`), usually 50–200 rows.
5. If you see a red **ERROR** instead, nothing was changed. Copy the exact error text into the chat.

## Before you share the result: look it over (1 minute)

Export → **Download CSV**. Before sending it, scroll through and check:

- **Section `1 agents`, the `last_error=` parts:** they should contain only short technical messages. If you see a real customer's name, a phone number or anything that looks like a password, delete that cell before sending.
- **Nothing else should contain personal data.** Every other section is counts, names of switches, jobs and functions, or yes/no answers.
- **Do not paste the CSV into a public place** (for example a GitHub issue or PR). Send it in the private chat. The analysis written into the repository will describe findings only in general terms, as was done for Query B.

## What the sections mean

| Section | What you will see | How to read it |
|---|---|---|
| `0 counts` | Number of rows in each main table | Numbers only. "table not found" just means that table does not exist. This also answers "is the product catalogue populated?" (owner instruction: verify, don't assume). |
| `1 agents` | One row per agent switch: ON/off, last run, last status, last error (masked) | Shows which agents really run, and whether any switch is in an unexpected state. |
| `2 switches` | Each feature flag ON/off, and the system mode | Shopify Order Sync should read `off` (intentionally off before launch). |
| `3 agent #1 invoices` | The invoice trigger, whether it is enabled, and whether it checks its switch | Answers the open question about Agent #1 being "enabled". |
| `4 shopify sync` | Sync flag, orders that came from Shopify, sync-like jobs, AI decision log per agent | Evidence that the sync really has never run (or has). |
| `5 scheduled jobs` | Each scheduled database job (schedule, active, last run, failures, which functions it calls, whether it reaches stock), plus "(pg_cron installed)" | **Key section.** Any job with `reaches stock=true` must be dealt with before R1–R5. |
| `6 stock writers` | Every database function that writes the stock tables directly, who can call it, and what fires it | **Key section.** Each one is a second path into stock that R1–R5 would not protect. |
| `7 triggers` | Every trigger on the stock, order, purchasing and returns tables | A trigger with `writes stock=true` changes stock automatically. |
| `8 direct writes` | Whether the public (`anon`) and signed-in (`authenticated`) roles may write the stock tables directly, and whether row-level security is on | Used later to remove direct writes once R1–R5 are the only path (backlog INV-20). |
| `9 value rules` | Every database rule on allowed values (status lists, categories) | Fills in the tables Query A did not cover (incidents, legal holds, inquiries, …). |

**Pattern flags are hints, not proof.** "writes stock" means the function's text matches a pattern such as `update inventory`. A person reads anything flagged before acting. Code that builds its SQL at run time (`EXECUTE format(…)`) is not detected; that limitation is stated in the file header.

## What Query C unlocks

| Waiting item | Unlocked by |
|---|---|
| INV-22: agents or automations writing stock directly | Sections 5, 6, 7 |
| R1–R5 install (INV-01…05), then the dashboard switch-over (INV-06) | Sections 5–7 show no other stock writer, or each one has been dealt with, plus your written approval |
| INV-20: remove direct stock-table writes after R1–R5 | Section 8 |
| SM-04, SM-05, SM-06, SM-09: value rules for incidents, `orders.channel`, feature requests, and others | Section 9 (added to `tests/helpers/db-constraints.js`) |
| incidents.severity `normal` question (escalation could fail) | Section 9 |
| Agent #1 "enabled" question | Section 3 |
| Catalogue populated? | Section 0 |

## What happens after you send it

1. A session analyses the CSV (read-only) and writes the general findings into `docs/ops/` without business details.
2. Value rules from section 9 go into the test mock, so the tests enforce them.
3. Any stock writer found gets its own plan (pause, rewrite, or route through R1–R5), each needing your approval.
4. Only then is the R1–R5 install runbook (`docs/ops/R1-R5-INSTALL-RUNBOOK.md`) ready for you to use.

**Query D** (elevated functions) stays prepared only. It is not part of this step and will not be given until you approve it.
