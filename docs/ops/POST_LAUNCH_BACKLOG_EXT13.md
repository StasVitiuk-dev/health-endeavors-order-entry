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
