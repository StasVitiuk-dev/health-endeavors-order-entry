# Review item 4 of 4 — SQL draft 36 (supplier documents) and its optional step 38 (private files)

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · 2026-11-21
Nothing here has been run in production. I never run it myself: you run it, after approving it.
This is **two decisions**: draft 36 first; draft 38 only later, and only if you want files stored.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) | Last changed in |
|---|---|---|---|
| `docs/ops/sql/drafts/36_DRAFT_supplier_documents.sql` (install, step 1) | 1012 | `4b78c14b9fc7ee8f` | changed 2026-11-25 |
| `docs/ops/sql/drafts/37_DRAFT_rollback_supplier_documents.sql` (undo of 36) | 72 | `117c4297c360be26` | `be6a4c2` |
| `docs/ops/sql/drafts/38_DRAFT_supplier_document_files.sql` (install, step 2, optional) | 95 | `b65979513ca32f5e` | changed 2026-11-25 |
| `docs/ops/sql/drafts/39_DRAFT_rollback_supplier_document_files.sql` (undo of 38) | 38 | `4fb319ef4d3128e4` | `be6a4c2` |

The full text is in the review package (`5-sql/item-4-drafts-36-38/`). Before running, check the
fingerprint of the file you paste matches this table (the package's `SHA256SUMS`).

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by
you. Tested only on a throwaway local copy with made-up data. For draft 38, the local
copy has no Supabase storage service, so it was tested against a stand-in of
Supabase's storage tables with the same rules switched on (see "Honest limits").

## Changed before install: administrators review too (owner decision, Nov 24)

Your decision of Nov 24 (administrator "almost like owner"; table row "Supplier documents: approve or
reject, private files, settings → owner and administrators") is applied to both drafts before install:
- the check `supplier_documents_is_owner()` now says yes for an **active** administrator too (its
  name is kept, so the undo files 37 and 39 still match and did not change);
- the five table rules that said "owner" now say "owner or administrator";
- every refusal now reads "Only the owner or an administrator …";
- draft 38's own rules did not change (they ask the same check); only its notes changed.

Still refused: staff, managers (once drafts 62/64 add them; they are not administrators), a
switched-off administrator, and visitors, also through direct database calls and direct file links.
Each approval still names the person and the exact file (its fingerprint); the file cannot be
replaced; a rejection needs a reason. An administrator can approve a document they recorded
themselves, as you can. Which documents are required stays **your checklist of Nov 16**; nothing was
added to it.

## Purpose

Your decisions of Nov 16 and Nov 21 on supplier documents:
- a checklist per kind of supplier (purchases; lotion lab; bottles and pumps; labels);
- staff record that a document arrived; **only you or an administrator approve, reject or change the checklist** (Nov 24);
- a purchase document is recorded only against an order the person can already see;
  otherwise it is **handed to you**, and purchase-order access is not widened;
- (draft 38) **only you or an administrator open a stored file** (Nov 24; on Nov 21 this was you only).

## What each step changes

**Step 1 — draft 36.** Adds seven new, empty tables (checklist, its profiles by
supplier type and per supplier, subjects, documents, review history, hand-offs),
guards, and the functions to record, review, withdraw, correct, attach a file's
details, hand off, and link or dismiss a hand-off. Fills in the starting checklist
of Nov 16 (9 document types). **It changes no existing table, row, permission or
screen.** Every function runs with the caller's own rights (no elevated functions);
nothing is given to visitors (anon). Locks: none on existing tables. Takes seconds.

**Step 2 — draft 38 (optional, later).** Creates one **private** storage bucket,
`supplier-documents` (PDF, JPEG or PNG; at most 10 MB a file), and two rules that
apply to that bucket only:
- **read** (which opening, downloading and getting a link all need): the owner or an administrator;
- **upload**: the person who recorded a waiting document, the owner or an administrator, into that
  document's own folder, while it has no file yet.

There is no rule for replacing or deleting a file, so nobody can. The rules of your
other buckets (receipts, evidence, documents) are not touched.

## Migration order and dependencies

1. **Draft 36** depends on these existing production pieces: `auth.uid()`,
   `current_role()`, `is_active_staff()`, `is_owner_or_admin()`, and the `suppliers`,
   `purchase_orders` and `profiles` tables. The file checks them first and **stops,
   changing nothing**, if one is missing. It depends on no other draft (independent
   of 32 and 34). Safe to run twice.
2. **Draft 38** depends on **draft 36** (it uses its `supplier_documents` table and
   its `supplier_documents_is_owner()` check) and on Supabase's own `storage.buckets`
   and `storage.objects`. It checks all four first and stops, changing nothing, if one
   is missing. Safe to run twice.
3. **The dashboard switch** `he_supplier_documents_store` stays OFF until you decide to
   use it, and is not on the Feature Flags page on purpose. With it on but the drafts
   not installed, the page says so and saves nothing (tested).
4. **Roll back in the reverse order:** 39 before 37.

## Who can do what (enforced by the database and the storage rules)

| Action | Owner | Administrator | Staff |
|---|---|---|---|
| See documents, checklist, history | yes | yes | yes |
| Record a lab, bottle or label document | yes | yes | yes |
| Record a purchase document | yes | yes (they see every order) | only for an order they can already see (today: none) |
| Hand a purchase document to the owner | — | yes | yes |
| (a switched-off administrator) | | refused for everything above | |
| Link a hand-off to an order, or dismiss it | **yes** | **yes** | no |
| Approve, reject, correct; change the checklist | **yes** | **yes** | no |
| Attach the one file of a waiting document | yes | yes | only one they recorded |
| Open a file, or get a link to it | **yes** | **yes** | **no** |
| Replace or delete a file; delete anything | nobody | nobody | nobody |

## Staging evidence (throwaway database, made-up data)

| Test | What it proves | Result |
|---|---|---|
| `local-test/supplier_documents_test.sh` | draft 36: owner-only review (by function and by direct edit), visible-order rule, hand-offs (owner-only resolution, no delete), one file per document, history written only by the database, retries record once, ten simultaneous approvals decide once, rollback; Nov 25: administrators approve (also ten simultaneous approvals by the owner and two administrators decide once), correct, link a hand-off and reset a supplier's list; staff and a switched-off administrator refused | 127 of 127 |
| `local-test/supplier_document_files_test.sh` | draft 38: the bucket is private; a visitor, another staff member or an administrator cannot upload into someone else's document; **the staff member who uploaded a file, another staff member, an ordinary administrator and a visitor cannot open it**; nobody can replace or delete one (owner included); no upload after approval; other buckets untouched; rollback refuses while files exist; Nov 25: an administrator uploads, opens and approves for the exact file; a switched-off administrator and staff cannot open or list | 37 of 37 |
| `local-test/supplier_docs_store_adapter_test.js` | the dashboard's own code against both drafts: with the page's checks bypassed, the database refuses an administrator linking a hand-off, and the storage stand-in finds no file for staff; Nov 25: an administrator approves, withdraws a mistaken record, attaches a file and gets a 60-second link | 65 of 65 |
| `tests/specs/supplier-docs-storage-ext22.spec.js` | the page in a browser against both drafts: record, refresh, approve; double clicks and lost replies; staff refused for an order they cannot see; hand-off and owner linking; attach; owner gets a 60-second link; approval records the exact file approved; Nov 25: the owner **and an administrator** each get a 60-second link and approve the exact file; a staff member the page mistakes for the owner is refused by the database and the storage rules (approve, checklist, dismiss and a direct link call) | all pass, desktop and iPhone size |
| `tests/specs/sql-drafts-static.spec.js` | the exact rule text is pinned; no elevated functions; search path fixed; nothing granted to visitors; no other drops or deletes | pass |

Re-checked on 2026-11-22 (commit `62e2ea8`): fingerprints unchanged; database tests 125 of 125 and 30 of 30, adapter 63 of 63, run again on fresh throwaway copies.

## After running: checks (read-only)

After draft 36:
```sql
select (select count(*) from public.supplier_document_types) as document_types,
       (select count(*) from public.supplier_documents) as documents,
       (select count(*) from public.supplier_document_handoffs) as handoffs,
       has_table_privilege('anon', 'public.supplier_documents', 'select') as visitors_can_read;
```
Expected: `9 | 0 | 0 | false`.

After draft 38:
```sql
select public, file_size_limit, allowed_mime_types,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'supplier_document_files_%') as rules
from storage.buckets where id = 'supplier-documents';
```
Expected: `false | 10485760 | {application/pdf,image/jpeg,image/png} | 2`.

## Rollback and recovery

- **Draft 38, while no file is stored:** run `39_DRAFT_rollback_supplier_document_files.sql`.
  It removes the two rules, the upload check and the empty bucket. **It refuses while
  any file is stored** (files are business records): download them first and decide
  separately.
- **Draft 36, before any document is approved or rejected:** run
  `37_DRAFT_rollback_supplier_documents.sql` (after 39, if 38 was installed). It
  removes everything 36 added; waiting documents and hand-offs go with it.
- **After a review exists:** draft 37 **refuses**. Recovery: switch
  `he_supplier_documents_store` off (the screen goes back to example data), export
  the rows (`select * from public.supplier_documents;` and
  `select * from public.supplier_document_events;` → Export CSV), and I prepare a
  reviewed fix as a new draft. No other data is affected, because neither draft
  changes an existing table.

## Honest limits

- Draft 38 was tested against a stand-in of Supabase's storage tables, not the real
  storage service. Supabase documents that it applies these rules to every upload,
  download and link, and that a plain upload needs only the upload rule. Before files
  are used for real, one upload and one "Open file" should be tried on the live site
  with a made-up PDF, as you, and once as a staff account (it should say it cannot
  find the file).
- A 60-second link, once you have it, works for whoever holds it until it expires.
- Files are not part of the database backups; backing up the bucket is a separate decision.

## Your decisions

- [ ] Approve running draft 36 in production, or
- [ ] Not yet.
- [ ] Later and separately: approve draft 38 (files), or not yet.
