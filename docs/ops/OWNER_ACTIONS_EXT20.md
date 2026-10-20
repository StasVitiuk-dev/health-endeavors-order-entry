# Owner actions (EXT20): the one list for Stas

Status: **CURRENT.** This is the single owner file. It supersedes the older owner checklists and unblock centers for *what to do next*; they stay as history. Nothing here has been done for you, and Claude never runs anything on production.

## 0. Where we are

- The dashboard on the review branch is well tested locally.
- **Production is not verified:** database rules (RLS), backups, agents, Queries C–H.
- The next useful work is **yours**: read-only checks and decisions. More local coding has little left to find (see `FINAL_AUTONOMOUS_GAP_MAP_EXT20.md`).

## 1. The single best next step: run Query G (read-only, about 5 minutes)

**Why:** it shows who can read and change each table in the real database. It also answers the two open audit-log questions (F1, F2) directly.

**Steps:**

1. Open supabase.com → your Health Endeavors project → **SQL Editor** → **New query**.
2. In GitHub, open `docs/ops/sql/06_READONLY_G_permissions_inventory.sql`, press **Raw**, select everything and copy it.
3. Paste it into the SQL Editor and press **Run**. It only reads: it changes nothing.
4. Press **Export → Download CSV**.
5. Open the CSV and check that it has no e-mail addresses or keys. It should hold none: only table names, policy names and rules.
6. Send Claude the CSV, or a screenshot of all rows, and the date you ran it.

**What NOT to do:**

- do not edit the query;
- do not run anything else in the same editor tab;
- do not paste any key or password into chat.

**What the result means (Claude will read it for you):**

| Row | PASS / INFO | WARN | FAIL |
|---|---|---|---|
| G01 | table protected | — | a table has no row protection: fix before launch |
| G03 | tasks protected | — | any signed-in user can change any task |
| G04 | — | not-signed-in visitors can read a table | not-signed-in visitors can change a table |
| G08 (F1) | nobody can write fake audit lines | blocked today, but one mistaken rule would allow it: a small fix is prepared | fake audit lines are possible now: stop and fix first |
| G09 (F2) | only chosen people read the audit log | every signed-in user can read all history: **your decision** (§3) | — |

## 2. Other read-only checks (each changes nothing)

| Order | Check | File | Why | Time |
|---|---|---|---|---|
| 1 | **Query G** | `06_READONLY_G_permissions_inventory.sql` | permissions plus F1/F2 | 5 min |
| 2 | Backup check | §4 below | prove a recent, healthy backup exists before any database change | 2 min |
| 3 | Query C | `02_READONLY_C_agents.sql` (guide: `QUERY_C_OWNER_RUN_GUIDE.md`) | agents, switches, schedules, stock writers, audit coverage | 5 min |
| 4 | Query A2 (**new**) | `08_READONLY_A2_outside_tables.sql` | the shape of the 24 tables never exported; Claude runs the drift checker on it | 5 min |
| 5 | Query D | `03_READONLY_D_definer_function_identity_check.sql` | functions with elevated rights | 5 min |
| 6 | Query E, F | `04_READONLY_E_stock_reconciliation.sql`, `05_READONLY_F_daily_integrity_check.sql` | stock and data health | 5 min each |
| 7 | Query H | `07_READONLY_H_drift_check.sql` | after any change: does production match what was reviewed | 5 min |

Same steps as §1 for each: paste, Run, Export CSV, send it with the date.

## 3. Decisions only you can make (Claude will not choose)

| # | Decision | Options | Claude's note |
|---|---|---|---|
| D1 | **F2: who may read the audit log** | A owner only · B owner + administrators · C leave as is | B matches every other owner/admin page. Decide after Query G |
| D2 | Google Fonts on 4 smaller pages | keep · system fonts (like the main dashboard) | system fonts remove an outside dependency and change the look slightly |
| D3 | Saved-link rule | keep the block-list (javascript:, data:, vbscript:) · allow-list (http, https, mailto, tel, message, photos) | the allow-list is stricter, but could block a link type you use |
| D4 | Merge the review PR | read PR #34 / the EXT20 PR first | merging publishes the dashboard; no database change happens on merge |
| D5 | Hosting with security headers | stay on GitHub Pages · add a front (e.g. Cloudflare) later | needed for clickjacking protection headers; not urgent for an internal tool |

## 4. Backup check (2 minutes, no secrets)

1. GitHub → the **private backups repository** → **Actions** tab. Claude never opens it.
2. Look at the latest backup run: is it **green**, and was it in the **last 24 hours**?
3. Open it and check that the step that uploads or stores the backup **succeeded** (green tick).
4. Send Claude only:
   - the date and time;
   - green or red;
   - the name of the last successful step.

   No logs, no file names that contain secrets.
5. Once a month: confirm a restore was tested, or ask Claude for a restore-test plan.

If the latest run is red or older than 24 hours: **no database change of any kind** until it is fixed.

## 5. Agents 1–10: what to verify in production (read-only)

| # | Agent | Expected state | Safe read check | Write risk | Human approval point | Outside dependency |
|---|---|---|---|---|---|---|
| 1 | Invoice | on | Query C agent row + last run | creates invoices | none (paperwork only) | database trigger |
| 2 | Order Intake | **off** (intended) | Query C: switch off, workflow disabled | opens tasks | you read the task | GitHub workflow |
| 3 | Order Monitoring | **off** (intended) | same | approval requests | you approve refunds/cancellations | GitHub workflow |
| 4 | Retail/Wholesale | on (hourly) | Query C schedule + last run | customer link/tag | none | pg_cron |
| 5 | Shipping/Tracking | on | Query C last run | shipments, tasks | you act on tasks | carrier data |
| 6 | Customer Notification | on, **cannot send** | Query C: no email service connected | log rows only | any future sending needs your approval | none connected |
| 7 | Customer Service (AI) | **off** (intended) | Query C switch off | drafts only | you copy every reply yourself | AI model |
| 8 | Supervisor | **off** (intended) | Query C switch off | tasks only | you read tasks | GitHub workflow |
| 9 | Accounting | display only | page shows totals; no writes | none | — | none |
| 10 | Tax Record | display only | same | none | — | none |

## 6. Production change order (for later; nothing is executed now)

1. **Read-only evidence first:** G, backup, C, A2, D, E, F.
2. **Review the migration** Claude drafts from that evidence. Every draft has an exact rollback and was tested locally (install → test → rollback → reinstall).
3. **All related switches OFF** before installing.
4. **One change at a time**, with the backup checked on the same day.
5. **Verify** with Query H (and the page's System status) straight after.
6. **Roll back** at once if anything is unexpected. Change nothing else, and send Claude a screenshot.

## 7. Still prohibited until you approve each one

- any production SQL that writes;
- any RLS or policy change;
- any switch;
- enabling any agent;
- schedules;
- customer messages;
- Shopify;
- backups access;
- merging or deploying.
