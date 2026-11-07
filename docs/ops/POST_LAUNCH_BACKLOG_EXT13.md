# Post-launch backlog (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · page code `32c05e2`. **SUPERSEDES** the "post-launch" rows of `UNFINISHED_WORK_EXT11.md` §1 and `ENGINEERING_CATALOG_EXT11.md` §9 (kept as history).

**None of this is needed before launch.** Every item is either an improvement for when the business grows or something deliberately deferred. A future session should not start any of it until the owner's launch-critical list (`OWNER_ATTENTION_SESSION_EXT13.md`) is done, and only when a trigger in §10 says so.

## 1. Server pagination (specific pages)

| Page / query | Today | Later |
|---|---|---|
| Orders list | newest N with a labelled cap + "look up in all orders" | server-side paging with a total count |
| Expenses list | labelled cap | server-side paging |
| Accounting / Tax | paged reads in the browser (correct, tested to 50k) | `drafts/13` server totals (needs N4 and a rollback file) |
| Audit history / inventory history per product | newest first, capped | paging by date |
| Home revenue tiles | computed from paged reads | a database aggregate |

## 2. Roles (RBAC)

Owner/admin vs active staff only, today. Later, when staff exist: per-page roles (warehouse, support, bookkeeping), an owner-only rule on switch tables (decision #11), an approval rule (decision #10). Each is a permission draft after Query G.

## 3. Multi-location inventory

**Only if the business opens a second location.** One stock row per product today. It would need a location column on stock, lots and history, and new R1–R5 versions. Do not start without a real second location.

## 4. Forecasting

Reorder suggestions from sales history (suggestions only; **automatic reordering is never built**, D9). Needs months of real orders first.

## 5. Analytics

Sales by channel/product over time; returns rate; supplier lead times (from PO expected vs received dates). Read-only.

## 6. Automation

- D1 nightly check (after install), then D2 reconciliation view.
- D6 agent supervisor (needs the agent source).
- D5 backup row (needs decision #13 and a change in the private backup job).
- D11 weekly summary (optional).
- D7 approval log when an e-mail provider exists.
- **Never:** D9 automatic reordering, D10 AI answering customers.

## 7. UI polish

Input border contrast (decision #24) · catalogue picker on manual orders (#23) · strict script policy on the remaining pages, one PR each (U46) · request key on manual orders (U47) · duplicate-customer watcher (U50) · large-adjustment alert (needs a threshold).

## 8. Deferred performance work

Next code extractions from `owner-login.html` (System status, Tax, Returns blocks): each costs a full re-verification, so do them one per PR when a change is needed there anyway. Revisit when a trigger in §10 fires.

## 9. Technical debt (real items only)

| Item | Why it matters | When |
|---|---|---|
| `owner-login.html` is one large file (~10k lines) | slower reviews | split one block per PR, only when touching it |
| `drafts/13` has no rollback file | must exist before it is ever proposed | before proposing it |
| CHECK constraints at large volume (`drafts/23`) | full-table validation under a lock | if any table reaches millions of rows: `NOT VALID` then `VALIDATE` |
| Test drafts live beside install drafts in `drafts/` | could confuse | renaming touches tests and docs; leave unless reorganising |
| Full browser suite is slow | longer verification | shard or split the Node-only profile (coverage unchanged) |
| No CI | tests run only in sessions | decision #15 (workflow change needs owner approval) |

## 10. Scale triggers (when to revisit §1 and §8)

Qualitative, because there is no real volume yet:

- any list shows its "showing the newest N" warning in normal daily use;
- Accounting or Tax takes noticeably long to open (more than a few seconds);
- more than one person works in the dashboard at the same time every day;
- orders per month reach the thousands;
- stock history per product reaches the thousands;
- the nightly check takes more than a few seconds (it took 0.3 s at 50k orders locally).

## 11. Performance hotspots and watchlists

| Watch | Why | Signal |
|---|---|---|
| Home health queries | several reads on every open | Home slow to show "Checked at" |
| Search (palette + "all orders") | literal match over all orders | search slow on large history |
| Audit / stock history | grows forever | history panes slow |
| Supplier / PO lists | joins lines and lots | PO detail slow |
| N+1 reads | per-row reads in lists | request-baseline test fails when added |
| Memory / listeners | long-open tabs | `resource-leaks` test |
| Accounting / Tax | paged reads | open time |

## 12. Do not build yet

These would create busywork or risk without a real need:

- multi-location;
- forecasting;
- automatic reordering (never);
- AI answering customers (never);
- a full role system before staff exist;
- an RPC for every write (only R1–R5 matter);
- a separate request-key log table;
- server paging everywhere;
- a browser upload page for production evidence;
- automatic incident repair (never);
- automatic switch-off on a FAIL (a person decides);
- further splitting of `owner-login.html` just to split it;
- 100k-order performance runs;
- more synthetic samples or more documents that restate existing ones.

## 13. Delete, archive and retention (dependencies; nothing deleted)

| Data | Today | Depends on |
|---|---|---|
| Orders, expenses | soft delete; restorable | lawyer: retention (#20) |
| Products with history | archived, never deleted | — |
| Documents | delete removes the stored file (password required) | lawyer: legal hold (#19), retention |
| Audit log | kept (no deletion path) | lawyer: audit retention |
| Recycle bin (soft-deleted rows) | kept | lawyer: how long |
| Customer data | kept | lawyer: customer-data retention |
| Nightly check results | 90 nights (its own table only) | — |

---

# Owner backlog addition — 2026-11-07 (PLAN ONLY, not authorized to build)

> **UPDATE 2026-11-07 (later same day):** a follow-up owner handoff now authorizes
> **local, synthetic implementation** of these areas (Operations track) alongside
> new feature phases. The plan-only framing below is superseded **for local build
> only** by `NOV7_BUILD_HANDOFF_2026-11-07.md`, which carries the capability/gap
> map, completion criteria and owner dependencies. External actions stay OFF. The
> gap analysis and pending-owner-decisions below remain authoritative.

Added at the owner's request after the existing items above. **Documentation /
backlog authorization only.** Nothing here is authorized for implementation,
production access, backup configuration, accounting actions, live invoice
delivery, settings changes, or push/merge/deploy. Current task order (the UI
polish tranche — forms done; report tables / empty states next) continues
first. Each item below is reconciled against what already exists, so the gaps
are the *real* remaining work, not a restatement of built features.

**Platform constraint that shapes all three items:** the owner dashboard is a
**static site served by GitHub Pages**. A web page cannot, on its own, write
files to the owner's Mac on a schedule, run in the background, or keep
credentials for a local folder. A browser can only hand the owner a file to
save *while the page is open and after a click* (or via the File System Access
API, Chrome-family only, with a per-session permission grant and the tab open).
So anything described as "automatic", "background", "while asleep", or
"scheduled onto the Mac" is **out of scope for the dashboard itself** and needs
a separate component (a small native/menu-bar Mac app, or a scheduled job on a
machine the owner runs) plus owner decisions. This is the single biggest
dependency across items 14 and 15 and must not be glossed over.

## 14. Backups & Reports page (owner-local daily exports)

**Owner ask:** automatic daily files on the owner's Mac covering orders, new
clients and important records: encrypted structured exports that preserve
identifiers/relationships + attachment manifests, plus a readable daily PDF
(sales, new clients, stock changes, unpaid invoices, exceptions). A page that
shows last successful export, covered period, verification, failures and a
manual download. An owner-selected Mac folder, background downloader with secure
credentials, schedule/time-zone, offline/sleep catch-up, retries, atomic writes,
checksums, duplicate prevention. Distinguish *data exports* from *complete
recoverable backups*. Propose retention, a second independent copy, and isolated
restore verification for a later owner decision. **Preserve current backup
systems.**

**Reconciliation with what exists:**
- CSV export already exists on specific pages (Employee Activity →
  `exportActivityCsv`, Tax Records → tax CSV). These are per-page, on-demand,
  click-to-download, single-table, unencrypted.
- "Report History" already exists (`he-reports.js`): it *browses* nightly
  snapshot rows already saved in the database (daily/weekly/monthly rollups,
  missing values stay `?`). It is a read view of server data, not a file export.
- The **current backup system** is the **private Health Endeavors backups
  repository** (off-limits; holds DB backups + workflows with production
  secrets) and the nightly database job. "Preserve current backup systems" =
  this new page is **additive, owner-local**, and must not change or replace the
  private backup repo or its job. This session must not open, configure, or
  request access to that repo.
- §6 "D5 backup row" and §13 retention already flag backup surfacing as
  dependent on owner decision #13 — this item supersedes D5's scope and inherits
  decision #13.

**Actual gaps (what is genuinely not built):**
- No multi-table, relationship-preserving structured export (the identifiers
  exist — orders, profiles/account_number, invoices, expenses, inventory,
  audit_log — but nothing bundles them with referential integrity + an
  attachment manifest).
- No encryption of an export, and no key/recovery story.
- No daily *readable PDF* (no PDF generation exists anywhere yet — see item 15).
- No "last successful export / covered period / verification / failures" status
  surface.
- No scheduling, background download, catch-up, retries, atomic writes,
  checksums, or duplicate prevention — **and most of this cannot live in the web
  page** (see platform constraint). The dashboard part is realistically: an
  on-demand "export now" that produces the encrypted bundle + PDF for the owner
  to save, plus a status page reading export records. The *automatic/background*
  part is a separate Mac-side component.

**Dependencies:**
- Owner decisions (see consolidated list below): retention; export
  scope/attachments; destination folder; encryption & recovery.
- Technical: a structured-export format (versioned schema) + manifest;
  client-side vs server-side generation (anon key + RLS limits what the browser
  can read — a *complete* backup needs a privileged/server path, which is
  Supabase + owner approval, not client-only); encryption library + key
  custody; PDF generation (item 15); a Mac-side downloader for the automatic
  path.
- Hard line: a **data export ≠ a complete recoverable backup**. The page must
  label which it is producing and never imply a browser-made export is a full
  disaster-recovery backup.

**Later acceptance criteria (for when/if built):** exports are verifiable
(checksum + a documented restore check on an isolated copy); identifiers and
relationships round-trip; attachments are listed in a manifest with hashes;
encryption has a written, owner-held recovery path; the status page shows real
last-success/period/failure; nothing touches or bypasses the existing private
backup system; "export" vs "backup" is stated on screen; a second independent
copy and isolated restore verification are offered per owner decision.

## 15. Print-ready reports (branded PDFs)

**Owner ask:** branded US-Letter PDFs using the existing approved logo/colors —
readable tables, margins, repeating headers, date range, totals, page numbers;
a daily-summary report and a selected-detail report; multipage + grayscale
output; minimize unnecessary private data. Paper supplements electronic
recovery. Provide sample layouts for review later.

**Reconciliation with what exists:**
- No PDF generation exists today. The only "PDF" references in the code are
  about *rejecting* disguised uploads and *accepting* receipt uploads — not
  producing PDFs. So this is greenfield output work.
- Report History (item 14 note) already computes daily/weekly/monthly rollups —
  that computation is a reuse candidate as the PDF's data source, so the PDF
  layer sits on top of existing numbers rather than recomputing them.
- Approved logo/colors already exist in the dashboard brand (the restored
  original palette); the PDF must reuse those, not invent new branding.

**Actual gaps:** a PDF renderer (client-side library, pinned version, offline —
CSP already restricts script sources, so any library must be vendored and hashed
like existing vendor files); US-Letter page geometry, repeating table headers,
page numbers, grayscale mode; a "daily summary" vs "selected detail" chooser;
a data-minimization pass (exclude customer PII that a paper report does not
need); sample layouts for owner review.

**Dependencies:** item 14 (the daily PDF is shared); the brand assets; a
vendored PDF library that passes the CSP/SRI setup; owner review of sample
layouts before any build. No new data model.

**Later acceptance criteria:** PDFs render on US Letter with margins, repeating
headers, totals and page numbers; branding matches the approved logo/colors;
grayscale output is legible; multipage tables break cleanly; only necessary
fields appear; sample layouts approved by the owner before implementation.

## 16. Dedicated Invoices page

**Owner ask:** a dedicated page for invoices — manual draft creation and
automatic generation from wholesale orders, linked to store accounts/orders;
company/logo details, billing/shipping, unique invoice number, dates, payment
terms, line items (qty, price, discount), shipping, applicable tax, currency,
totals, balance; states draft / issued / partially-paid / paid / overdue /
void; permissions; saved issued versions; correction history; partial-payment
representation; duplicate/concurrent-request protection; drafts editable; PDFs
downloadable + printable. Owner decides numbering, generation trigger, business
details. Automatic generation and live emailing are **separate** decisions.
Related proposed items: packing slips (optional prices), quotes, credit notes —
pending prioritization.

**Reconciliation with what exists (important — this is NOT greenfield):**
- Production **already has an `invoices` table** and **Agent #1 "Invoice Agent"**
  — a database trigger that **already generates, re-syncs and voids invoices
  automatically whenever an order is created or changes**, while its switch is
  on. It "only ever creates paperwork — never touches money or sends anything."
- Agent #5 already **checks for orders missing an invoice**
  (`invoice_missing_threshold_hours`).
- So "automatic generation" substantially **exists at the database level
  already.** What is missing is the **dashboard surface** (there is no Invoices
  page to view/search/manage invoices) and the **richer invoice model**
  (explicit states, saved issued versions, correction history, partial payments,
  PDF) the owner describes.
- Invoices are **paperwork tied to money/accounting**. Per CLAUDE.md, changes to
  money/accounting logic in production, and any new table/column/trigger, need
  owner approval and are **Supabase drafts (SQL + rollback), not client-only**.
  The dashboard can read and present invoices and build *drafts/PDFs*; the
  generation trigger and any schema change are owner + Supabase.

**Actual gaps:** no Invoices page/UI; the existing `invoices` rows' current
shape is unverified from here (need Query of the schema — owner-run) so the gap
between "what Agent #1 writes today" and "the fields the owner lists" is unknown
until reconciled against the real table; no explicit state machine
(draft/issued/partially-paid/paid/overdue/void) surfaced; no saved issued
versions / correction history / partial-payment model confirmed; no invoice PDF
(shares item 15); numbering scheme undecided; manual draft creation not built;
duplicate/concurrent-request protection (the dashboard already has a
request-key pattern that would apply).

**Dependencies:** the real `invoices` schema (owner-run query — do not access
production from here); owner decisions on numbering, generation trigger, and
business/tax details; item 15 for the PDF; store-account/order links (exist);
**money/accounting = Supabase + owner approval**. Automatic generation and live
emailing stay separate decisions (emailing also needs a provider — see §6 D7 and
the standing "no real customer messages" rule). Packing slips / quotes / credit
notes are parked until the owner prioritizes them.

**Later acceptance criteria:** an Invoices page lists/searches invoices linked
to accounts/orders; a draft can be created and edited; issued invoices are
versioned and immutable with a correction trail; states and partial payments are
represented correctly; totals/tax/currency/balance compute correctly and match
accounting; duplicate/concurrent submits are blocked; a branded PDF is
downloadable/printable; numbering is unique and gap-audited per the owner's
chosen scheme; nothing sends anything to a customer without a separate explicit
decision.

## Pending owner decisions (consolidated, for items 14–16)

Record-only; none authorizes work. Owner must decide before the matching item
starts:
1. **Retention** — how long exports/backups and invoice versions are kept
   (ties to §13 and lawyer retention #19/#20).
2. **Export scope & attachments** — which tables/records and which attachments
   are included; what "important business records" covers exactly.
3. **Destination** — the Mac folder and whether an automatic background
   downloader (separate Mac-side component) is wanted, vs on-demand export from
   the dashboard only.
4. **Encryption & recovery** — encryption method and, critically, who holds the
   recovery key and how it is recovered if lost (no production secrets in this
   repo).
5. **Invoice details / terms / tax** — company/business details, payment terms,
   tax treatment, currency rules shown on invoices.
6. **Invoice numbering scheme** — format, sequence, uniqueness/gap rules.
7. **Invoice generation trigger** — keep/extend the existing Agent #1 DB trigger
   vs manual vs a new trigger; and separately, whether live emailing is ever
   enabled (its own decision, needs a provider).
8. **Role permissions** — who may create/issue/void invoices and who may run or
   download exports.
9. **Second independent copy & isolated restore verification** — whether to keep
   a second copy and how restores are test-verified (item 14).

**Guardrails reaffirmed:** preserve current backup systems; do not open/config
the private backups repo; no production access, accounting actions, backup
configuration, live invoice/customer delivery, settings changes, or
push/merge/deploy under this note. Build nothing here until the owner moves an
item out of backlog and the current task order reaches it.
