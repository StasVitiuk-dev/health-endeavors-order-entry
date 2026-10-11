# Automation and agent architecture (durable recommendation)

**Status:** CURRENT recommendation (2026-10-07, extension 8). Supersedes the proposal list in `AUTOMATION_AND_AGENT_REVIEW.md` (EXT7, kept as history) where the two differ. Describes what exists, what to build, in what order, and what never to automate. **Nothing here was installed, enabled, scheduled or run in production.** Existing agents (#1–#10) and their reported states: `agents-review-and-owner-checklist.md`.

## 1. The rule

> **Facts are computed. Drafts may be written by AI. Decisions are made by people.**

| Category | Meaning | Examples |
|---|---|---|
| **A. Deterministic check** | Read-only rule over the data; same input, same answer; shows UNKNOWN if it cannot read | integrity, reconciliation, duplicate risk, stock attention |
| **B. Deterministic automation** | Writes data by a fixed rule, idempotent, logged, behind a switch | invoice creation (#1), shipping status sync (#5) |
| **C. Owner reminder** | Shows a to-do; never acts | "Checks: what needs a look" on Home |
| **D. Approval workflow** | A request waits for a person's decision (password re-entry) | approval queue |
| **E. AI-assisted draft** | A model writes text for a person to review; never sends | customer-service drafts (#7), future write-ups |
| **F. Not automated** | People only | refunds, recalls, FDA reports, legal holds, deletion, prices, customer messages, agent / Emergency switches |

## 2. What exists now (on this branch)

| Piece | Category | Where | State |
|---|---|---|---|
| Home **"Checks: what needs a look"** (17 checks: data problems, to-dos, info, honest UNKNOWN for backups) | A + C | `owner-login.html` + `attentionFindings` helper | BRANCH (EXT8), tested |
| **Query E**: stock vs history, deliveries vs stock and expense, orders without items | A | `docs/ops/sql/04_READONLY_E_…` | PREPARED, tested locally, not run |
| **Query F**: daily integrity (stuck work, duplicates, wrong references, impossible values; 15 checks) | A | `docs/ops/sql/05_READONLY_F_…` | PREPARED (EXT8), tested locally 33/33, not run |
| Approval queue with password re-entry and stale-tab guard | D | dashboard | LIVE (guard BRANCH) |
| Agent #7 customer-service drafts, never sends; paused by No-AI / Emergency | E | private repo + dashboard | disabled (REPORTED) |
| Agents #1, #4–#6 | B | Supabase (trigger / pg_cron) | REPORTED; #1 state UNVERIFIED |

## 3. Candidates: decision per item

| # | Candidate | Category | Decision | Why |
|---|---|---|---|---|
| D1 | **Daily integrity check** (Query F + Query E, scheduled, results shown on Home) | A | **BUILD NOW (read-only parts done); schedule = BUILD LATER (owner approval)** | Cheap, read-only, catches the race/retry leftovers the stock fixes are about. Scheduling needs a production pg_cron job (owner approval, `PRODUCTION ACCESS REQUIRED`) |
| D2 | **Reconciliation monitor** (orders ↔ items, POs ↔ stock ↔ expense, returns ↔ stock adjustments) | A | **BUILD NOW as queries (Query E); dashboard view LATER** | E already covers PO/stock/expense and orders without items. orders ↔ invoices needs the invoices table shape (not in the export: `EXTERNAL INFORMATION REQUIRED`); shipping ↔ orders likewise |
| D3 | **Duplicate / idempotency watcher** | A | **BUILD NOW (F06–F09 + supplier same-name question done)** | Lists suspects, never deletes. The real cure is request keys (draft 19, `OWNER APPROVAL REQUIRED`) |
| D4 | **Inventory attention monitor** (low stock, negative, large adjustments, mismatch) | A + C | **BUILD NOW (low / negative on Home; mismatch in Query E); "large unexpected adjustment" LATER** | "Large" needs an owner threshold (`OWNER DECISION`). Never reorders |
| D5 | **Backup freshness / recoverability monitor** | A | **BUILD LATER, design only** | The dashboard cannot see backups and must not hold backup credentials. Design: the backup job itself writes one row (`backup_status`: finished_at, ok, size, restore_tested_at) into a table the dashboard may only read; Home then shows HEALTHY / NEEDS REVIEW / UNKNOWN. Until that exists Home says **UNKNOWN** (done) |
| D6 | **Agent supervisor (#8) improvement** | A + B | **BUILD LATER** | Needs a heartbeat source per agent (`agent_controls.last_run_*` + a small run-history table). Must flag: stuck in progress, repeated failures, disabled, missing heartbeat, unusual volume, a draft-only agent attempting a live action. Read-only alerting first; no auto-restart. Do not enable #8 in production here |
| D7 | **Customer-service draft queue safety** | E | **KEEP AS IS + add an approval log LATER** | Already drafts-only, tested (`no-live-send.spec.js`). Add "approved by / sent by a person" fields when an email service is chosen (owner decision R10) |
| D8 | **Compliance / claims review queue** (website claims, product copy, packaging text, testimonials, INCI verification, legal review status, label / photo review) | C + D | **BUILD LATER (before the website launches)** | Cosmetics claims carry legal risk. A queue: item, source (page / label), claim text, evidence link, reviewer, status (draft → needs evidence → legal review → approved / rejected), date. **The system never decides whether a claim is true or legal**; it tracks who decided and on what evidence. Data model and states can be drafted now; needs owner + legal input (`EXTERNAL INFORMATION REQUIRED`) |
| D9 | Automatic reordering | B | **DO NOT BUILD** (now) | Money commitment without a person; drafts only if ever (`AUTOMATION_AND_AGENT_REVIEW.md` K5) |
| D10 | AI that answers customers directly | E→F | **DO NOT BUILD** | Customer messages stay human-sent |
| D11 | Weekly AI summary of totals | E | BUILD LATER (optional) | Only totals copied from the dashboard's own figures; never computed by a model |

## 4. Build order (dependencies)

1. Owner runs Query E and Query F once (read-only) → baseline of what is already off.
2. R1–R5 + PO line guard installed (approval) → most integrity findings stop appearing.
3. Schedule Query F nightly (pg_cron, read-only, approval) and show its last result on Home (a small read-only table or view).
4. Request keys (approval) → duplicate watcher becomes a safety net, not the main defence.
5. Agent heartbeat table → supervisor checks (D6).
6. Backup status row written by the backup job → backup line on Home turns from UNKNOWN to real (D5).
7. Claims review queue before the public website launch (D8).

## 5. Rules every automation must follow

1. UNKNOWN is never shown as fine; intentionally disabled is never shown as broken.
2. Read-only by default. A writing automation is idempotent (natural key or request key), logged, behind its own switch, and paused by Emergency mode (owner decision D-ops-8).
3. No customer data to an AI model unless the owner decides it per agent.
4. No automatic deletion, refund, reorder, recall, report to an authority or customer message.
5. Every finding links to the record and says why it is there.
