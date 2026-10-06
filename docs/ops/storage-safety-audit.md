# Document / storage safety audit

**Status:** CURRENT (2026-10-06, branch `claude/platform-overnight-implementation`; not live). Real Supabase Storage policies were **not** changed or read.

Three flows upload a file and then save a database record that points at it: **Documents** (`document-files`), **Evidence locker** (`evidence-files`) and **expense receipts** (`expense-receipts`). Query A's document-link bug showed the danger: the file uploads, then the record is refused.

## Fixed on branch

| # | Severity | Problem | Fix | Test (`storage-safety.spec.js` unless noted) |
|---|---|---|---|---|
| S1 | HIGH | Documents: if the connection dropped while saving the record, the cleanup deleted the uploaded file, even though the database may have saved the record (only the reply was lost). Result: a document whose file is gone | Shared `uploadThenSave`: on a network error it first checks whether the record exists; if so it's a success and the file stays; if the check itself fails, the file is kept and the page says to check before retrying | "connection drops after the record was saved…", "…before the record was saved…" |
| S2 | MEDIUM | Evidence and expense receipts: a refused record left the uploaded file in storage (no cleanup at all) | Same helper for all three flows | evidence and receipt tests |
| S3 | MEDIUM | Deleting a document removed its record but never its stored file (an orphaned file on every delete) | After the record is deleted, its file is removed; if that fails the page says so with the file name | "deleting a document also removes its stored file" |
| S4 | LOW | No size or type check: a too-large file failed only after a long upload; web pages and scripts (HTML, SVG, JS…) could be uploaded and would run when opened from storage | Refused before anything is sent: over 50 MB, or a web-page/script/program type | "over 50 MB…", "web page / script…" |
| S5 | MEDIUM | Expense without receipt: a dropped connection said "Could not save", which invites a retry and a duplicate expense | Says it may or may not have been saved and to check the list first | "expense without receipt…" |
| — | (earlier, 2026-10-05) | Unsupported link type refused before upload; refused record → file removed | kept | `query-a-fixes.spec.js` |

Double clicks: every upload form disables its button during the save (test: "a double click uploads and saves once").

## Questions for a later read-only check (not run)

1. **Bucket settings:** is each bucket private, and what are its file-size limit and allowed MIME types? The page now assumes 50 MB; it should match the bucket.
2. **Storage policies:** who may upload, read and delete in each bucket? Two checks matter. Can an employee delete a document's file even though only the Owner/Administrator may delete the record? And can anyone signed in read any file?
3. **Orphans already in storage:** a read-only listing comparing stored object names with `documents.file_path`, `evidence_locker.file_path` and `expenses.receipt_path` would show files left behind before these fixes.
4. **Receipt file delete** (`expense-receipts`) already removes the file, then clears `receipt_path` only if unchanged. If clearing fails, the record points at a removed file; the page says so. Acceptable; noted.

## Extension 3 (2026-10-06): lifecycle review, branch only

| Case | Result | Test |
|---|---|---|
| Duplicate, huge, Unicode or hostile file names | Safe, short, collision-free names (earlier round) | storage-safety "hostile…", "two uploads…" |
| **Zero-byte file** | **Was uploaded and saved as an empty "receipt" or document. Now refused before anything is sent (X3-26)** | "an empty (0-byte) file…" |
| Oversized file, or a type that can run code | Refused before upload (earlier round) | helpers-unit `uploadProblem` |
| Upload fails | Nothing saved, plain error | storage-safety |
| Database refuses after upload | File removed again (earlier round) | storage-safety |
| Reply lost after the record was saved | File kept; the record counts as added (earlier round) | storage-safety |
| Document delete: storage delete fails | Record gone; the page says the file remains and names it | "if the stored file cannot be removed…" |
| **Document delete from a stale tab whose file was replaced elsewhere** | **Was: deleted the record by id plus the OLD file, orphaning the new one. Now only while the record still has the file shown; otherwise "already changed" and nothing is removed (X3-27)** | "a document whose file was replaced…" |
| Receipt removal | Unlink first, then delete the file (ST-04) | "removing a receipt" |
| Orphan detection in real storage | Read-only listing prepared, **not run** (ST-08) | PRODUCTION VERIFY |
| Real bucket privacy, size and type rules | **Not verified** (ST-07) | PRODUCTION VERIFY |
| Legal hold blocks deletes? | **OWNER DECISION** (no check today) | — |
