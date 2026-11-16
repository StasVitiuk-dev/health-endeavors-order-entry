# Supplier document storage

Status: PROPOSED · 2026-11-16 · For: Stas · OWNER DECISION REQUIRED (install of drafts/36, and the three questions at the end)
Scope: built and tested on a throwaway local database with made-up data. Nothing is
installed in production; nothing in production changes until you approve drafts/36.

This continues `SUPPLIER_DOCUMENT_CHECKLIST_2026-11-16.md` (the checklist itself).

## What is stored

| Fact | Where |
|---|---|
| Supplier | `supplier_documents.supplier_id` |
| Document type (from the checklist) | `kind` |
| What it is for (purchase order, formula, batch, component, artwork) | `subject_kind`, `subject_ref`, `subject_label` |
| Reference on the document (invoice number, certificate number…) | `reference` |
| Dates | `received_on`, `document_date`, `expires_on` |
| Status | `received` (awaiting review) → `approved` / `rejected`; `withdrawn` |
| Who recorded it, when | `recorded_by`, `recorded_at` (set by the database, cannot be typed) |
| Review | `reviewed_by`, `reviewed_at`, `review_note` (set by the database) |
| Review history | `supplier_document_events`: every recording, correction, approval, rejection, withdrawal and checklist change, with who and when. Nobody can write, edit or delete a history entry. |
| The checklist, by supplier type | `supplier_document_types`, `supplier_type_document_profiles`, and `supplier_document_supplier_profiles` (one supplier's own list) |

Files: SQL `docs/ops/sql/drafts/36_DRAFT_supplier_documents.sql` (install) and
`37_DRAFT_rollback_supplier_documents.sql` (undo).

## Who may do what (enforced by the database)

| Action | Owner | Administrator | Staff |
|---|---|---|---|
| See documents, checklist, history | yes | yes | yes |
| Record that a lab, bottle or label document arrived | yes | yes | yes |
| Record a purchase document (quote, invoice, packing slip) | yes | yes | **no** (staff cannot see purchase orders today) |
| Approve or reject | **yes** | no | no |
| Correct a document waiting for review | **yes** | no | no |
| Withdraw a document waiting for review | yes | only one they recorded | only one they recorded |
| Withdraw an approved document | **yes** | no | no |
| Change the checklist | **yes** | no | no |
| Delete anything | nobody | nobody | nobody |

Tested both ways: through the screen, and with the screen's own check bypassed
(the database still refuses).

## Retries and double clicks

- Each document being entered gets one request key, kept until its save succeeds.
  If the reply is lost and the person presses Save again, the database recognises
  the key and returns the document already recorded. Nothing is added twice.
- A double click sends one save; the second press waits.
- Ten simultaneous sends of one save: one records, nine get it back.
- Approving twice decides once (ten simultaneous approvals: one history entry).

## On the screen (Suppliers page)

Two switches, both OFF:

1. `he_supplier_documents` (on the Feature Flags page): shows the checklist with example data.
2. `he_supplier_documents_store` (not on the page, on purpose): reads and saves the
   real records. It does anything only when drafts/36 is installed; otherwise the
   page says "Storage is switched on but not available… not installed" and keeps
   showing the example data. Production today: not installed.

With storage on, the page shows the stored checklist and:
- a "Record a document that arrived" form;
- Approve / Reject (owner only) and Withdraw on each document awaiting review;
- the review history (latest 20);
- for the owner, "Checklist by kind of supplier" to change which checklist each
  supplier type is held to.

## Tests (made-up data, throwaway database)

| Test | Result |
|---|---|
| `docs/ops/sql/local-test/supplier_documents_test.sh` (database rules, history, checklist, rollback) | 90 of 90 |
| `docs/ops/sql/local-test/supplier_docs_store_adapter_test.js` (the page's adapter against the real draft) | 45 of 45 |
| `tests/specs/supplier-docs-storage-ext22.spec.js` (the page in a browser, against the real draft) | 12 of 12 at both sizes; 60 of 60 when each test was repeated 5 times |

The browser tests that need the database run only where the local throwaway
database runs; on GitHub they are skipped and say so.

## Rollback

`37_DRAFT_rollback_supplier_documents.sql` removes everything drafts/36 added.
It refuses (and removes nothing) once any document has been approved or rejected,
because those rows are the record of your reviews; export them first and decide
separately. Tested: refuses with reviewed documents; succeeds with only waiting
ones; a second run is harmless; install works again afterwards.

## Follow-up: private file uploads (not built), and how access would work

Today a document row holds the facts but not the scanned file. The follow-up
would follow the pattern the dashboard already uses for receipts, evidence and
documents (private storage, links that work for 60 seconds):

1. **A private storage folder** `supplier-documents` in Supabase Storage, not
   public. Files are addressed as `supplier id / document id / random name`. No
   file ever gets a public link.
2. **Upload:** after a document is recorded, the person who recorded it (or the
   owner) attaches the file while the document still waits for review. Allowed
   types: PDF, JPEG, PNG; at most 10 MB (checked by the page and by the folder's
   own settings). A new column `supplier_documents.file_path` (a later draft)
   points to it.
3. **The exact file is what gets approved:** at upload the page computes the
   file's fingerprint (SHA-256) and stores it; Approve records that fingerprint.
   If a file were swapped later, it would no longer match what was approved.
4. **Viewing:** the page asks for a link that works for 60 seconds, each time
   someone clicks "Open". The storage rules decide who may get one (see question 2).
5. **No overwriting and no deleting:** files cannot be replaced or removed by the
   page; a wrong file means withdrawing the document and recording it again.
6. **Backups:** files in storage are not part of the database backups. Backing
   them up needs its own decision.

Storage rules are permission changes, so they would be a separate draft for your
approval, with their own tests.

## Decisions for you

1. **Purchase documents by staff:** keep as built (owner or administrator records
   quotes, invoices and packing slips), or let staff record them too? The second
   needs staff to see purchase order numbers, a permission change.
2. **Who may open the files** once uploads exist: everyone on staff, or only you
   and administrators? Certificates of analysis and ingredient lists can contain
   formula details.
3. **One administrator approving:** like stock counts, approval could be granted to
   one named administrator account by you. Not built for supplier documents; say if
   you want it.
