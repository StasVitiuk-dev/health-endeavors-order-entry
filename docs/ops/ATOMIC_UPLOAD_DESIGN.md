# Atomic upload + record: design note (ST-09)

**Status:** PROPOSED (2026-10-06). Design only; nothing is built or installed. Needs your approval before any production change.

## The problem

An upload is two systems: the file goes to Supabase Storage, and the record (document, receipt, evidence) goes to the database. A browser cannot make two systems change together. The dashboard now handles every failure it can see:
- refused record → the file is removed again;
- a lost reply after the record was saved → the file is kept;
- a file that fails to delete → the page says so.

Two gaps remain that only a server can close:

1. **The browser tab closes (or the laptop sleeps) between the upload and the record.** The file stays in storage with nothing pointing at it: an orphan.
2. **Two people replace the same document's file at the same moment.** Each upload succeeds; the record points at one file, and the other file is an orphan.

Neither loses business data: orphans are invisible extra files. They cost storage, and could hold sensitive scans that nobody knows are there.

## Options

| Option | How | Pros | Cons |
|---|---|---|---|
| A. **Nightly orphan sweep** (recommended first) | A scheduled read-only job lists storage objects with no matching record (ST-08 query), and reports them; deletion only after your review | Simple; no change to how uploads work; catches every cause, old and new | Orphans live until the sweep; needs a scheduled job (production change) |
| B. Upload to a "pending/" folder, then the record's database function moves it | Record insert + file move in one server step (an edge function or database function with storage access) | No orphans from closed tabs | Needs an edge function holding storage rights; more moving parts |
| C. Signed upload URL issued by a database function that first creates a "pending" record | The record exists before the file; a sweep removes pending records older than a day, with their files | Every file always has a record | Two-phase states to handle on every page |

## Recommendation

1. **A first:** read-only report of orphans (ST-08 already prepared) run on a schedule, with deletion only after review. Low risk, and it covers the past too.
2. Revisit B or C only if orphans turn out to be frequent.

## Owner decisions needed
- Is a scheduled job acceptable (production change, your approval)?
- Who reviews orphan reports before anything is deleted?
- Retention: should orphaned scans of compliance documents be kept (legal hold) rather than deleted?
