# Supplier document storage

Status: PROPOSED · 2026-11-16, updated 2026-11-21 · For: Stas · OWNER DECISION REQUIRED (install of drafts/36, then optionally drafts/38)
Scope: built and tested on a throwaway local database with made-up data. Nothing is
installed in production; nothing in production changes until you approve drafts/36
(documents) and, separately, drafts/38 (private files).

**Nov 21 update — your decision 4 is built:** staff record a purchase document for an
order they can already see, and hand it to you when they cannot (purchase-order access
is not widened); private files are opened and approved by you only; administrator
approval stays off. Details below.

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
| Review history | `supplier_document_events`: every recording, correction, approval, rejection, withdrawal, file attached, hand-off and checklist change, with who and when. Nobody can write, edit or delete a history entry. |
| The file (Nov 21) | `file_path`, `file_sha256` (fingerprint), `file_bytes`, `file_type` (PDF, JPEG or PNG), `file_attached_by`, `file_attached_at`; on approval, `approved_file_sha256` = the fingerprint of the exact file you approved (set by the database, cannot be typed) |
| Hand-offs (Nov 21) | `supplier_document_handoffs`: supplier, document type, the order number as printed on the paper, reference, date, note, who handed it over; then waiting → recorded (you linked it to an order) or dismissed (with your reason) |
| The checklist, by supplier type | `supplier_document_types`, `supplier_type_document_profiles`, and `supplier_document_supplier_profiles` (one supplier's own list) |

Files: SQL `docs/ops/sql/drafts/36_DRAFT_supplier_documents.sql` (install) and
`37_DRAFT_rollback_supplier_documents.sql` (undo); for private files,
`38_DRAFT_supplier_document_files.sql` (install, after 36) and
`39_DRAFT_rollback_supplier_document_files.sql` (undo).

## Who may do what (enforced by the database)

| Action | Owner | Administrator | Staff |
|---|---|---|---|
| See documents, checklist, history | yes | yes | yes |
| Record that a lab, bottle or label document arrived | yes | yes | yes |
| Record a purchase document (quote, invoice, packing slip) | yes | yes (they see every order) | **only for an order they can already see** (today: none; who sees orders is unchanged) |
| Hand a purchase document to the owner | — | yes | yes |
| Link a hand-off to an order, or dismiss it | **yes** | no | no |
| Attach the one file of a document waiting for review | yes | only one they recorded | only one they recorded |
| Open (or get a link to) a file | **yes** | **no** | **no** |
| Replace or delete a stored file | nobody | nobody | nobody |
| Approve or reject | **yes** | no | no |
| Correct a document waiting for review | **yes** | no | no |
| Withdraw a document waiting for review | yes | only one they recorded | only one they recorded |
| Withdraw an approved document | **yes** | no | no |
| Change the checklist | **yes** | no | no |
| Delete anything | nobody | nobody | nobody |

Tested both ways: through the screen, and with the screen's own check bypassed
(the database still refuses). For files, "with the check bypassed" means asking the
storage service directly for a link as a staff member or an ordinary administrator:
it answers "Object not found", because the read rule on the bucket lets only the
owner see the file at all.

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
  supplier type is held to;
- (Nov 21) for everyone but the owner, "Hand a purchase document to the owner":
  supplier, document, the order number as printed, reference, date, note, and a list
  of their own hand-offs with what happened to each;
- (Nov 21) for the owner, "Handed to you (N)": each waiting hand-off with a list of
  that supplier's orders to link it to ("Link and record": it then waits for your
  review like any other document), or "Dismiss" with a reason;
- (Nov 21) "Attach file" on a document waiting for review, for the person who recorded
  it or the owner; once attached, staff see "File attached. Only the owner can open
  it." and the owner sees "Open file", which makes a link that works for 60 seconds
  (a link rather than a pop-up, because phones block pop-ups opened after a wait).

## Tests (made-up data, throwaway database)

| Test | Result |
|---|---|
| `docs/ops/sql/local-test/supplier_documents_test.sh` (database rules, history, checklist, visible-order rule, hand-offs, file attach, rollback) | 125 of 125 (Nov 21; was 90) |
| `docs/ops/sql/local-test/supplier_document_files_test.sh` (drafts/38 and 39: private bucket, who may upload or open, no replace or delete, rollback) | 30 of 30 (new Nov 21) |
| `docs/ops/sql/local-test/supplier_docs_store_adapter_test.js` (the page's adapter against the real drafts, with a storage stand-in) | 63 of 63 (Nov 21; was 45) |
| `tests/specs/supplier-docs-storage-ext22.spec.js` (the page in a browser, against the real drafts) | 13 of 13 on desktop and 11 of 11 at iPhone size (2 are desktop-only on purpose); each repeated 3 times with no failure (Nov 21; was 12) |

The local database has no Supabase storage service, so the file tests run against a
minimal stand-in of its storage tables with the same rules switched on. The real
storage service applies those rules to every upload, download and link, but its exact
behaviour (for example, whether an upload also needs the read rule) has to be
confirmed on a Supabase staging project before drafts/38 goes live.

The browser tests that need the database run only where the local throwaway
database runs; on GitHub they are skipped and say so.

## Rollback

`37_DRAFT_rollback_supplier_documents.sql` removes everything drafts/36 added.
It refuses (and removes nothing) once any document has been approved or rejected,
because those rows are the record of your reviews; export them first and decide
separately. Tested: refuses with reviewed documents; succeeds with only waiting
ones; a second run is harmless; install works again afterwards.

## Private file uploads (built Nov 21 as drafts/38; this was the design)

Built as designed below, with your Nov 21 answer to question 2: **only you open files**.
What changed from the design: files are addressed as `document id / fingerprint.pdf`
(the folder is the document, which the upload rule checks), the column lives in
drafts/36, and the bucket and its two rules are drafts/38.

The design, as written on Nov 16:

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

## Decisions

Answered on Nov 21 (decision 4):

1. **Purchase documents by staff:** DECIDED — staff record them for orders they can
   already see; otherwise they hand the document to you. Purchase-order access is
   not widened.
2. **Who may open the files:** DECIDED — only you, to start with.
3. **One administrator approving:** DECIDED — off for now.

Still yours (OWNER DECISION REQUIRED):

- Installing drafts/36 in production (see `docs/ops/sql-review/` item 4), and then,
  separately, drafts/38 for files.
- Backing up the files bucket (files are not in the database backups).
- Whether staff should later be allowed to see some purchase orders (for example,
  received ones), so they can record those slips themselves instead of handing them
  over. Not built; today staff see no purchase orders.
