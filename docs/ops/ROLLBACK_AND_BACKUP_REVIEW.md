# Rollback and backup review (internal platform)

**Status:** CURRENT (2026-10-06, extension 3). Written from files in this repository only. The private backups repository was **not** accessed, and nothing about backups was changed.

## Backup health: UNKNOWN (no evidence here)

The repository's records disagree, and neither is verified:

- `PROJECT_RECORD.md` §2 lists the nightly backup and monthly restore test as "kept on" (GitHub Actions in the private backups repository).
- `PROJECT_RECORD.md` history, Sept 13, says that was the "last nightly GitHub backup before the Actions minutes ran out".

**OWNER CHECK (read-only, 2 minutes):** private backups repository → Actions → did the last nightly backup and the last monthly restore test succeed, and when? Until then, treat backups as **unverified**.

## What each production step would need

| Step (all need your approval) | Changes data? | Backup needed first? | Rollback | Rollback tested? |
|---|---|---|---|---|
| Merge a dashboard PR | No (page files only) | No | Revert the merge commit; GitHub Pages republishes in 1–5 minutes. The helper/CSS version guard refuses mixed old/new files | Yes (revert simulation in the merge-order checks) |
| Run Query C / Query D | No (one read-only SELECT) | No | Nothing to roll back | Read-only proven: `sql-readonly.spec.js` |
| Install R1–R5 | No (creates 6 functions; no table or row touched) | Recommended as a precaution: confirm the last backup succeeded | `11_DRAFT_rollback_stock_functions.sql` (removes only the functions, one transaction) | Yes: `install_package_test.sh` (rollback, rollback twice, re-install, failure halfway) |
| Switch the dashboard to R1–R5 (INV-06) | Normal business writes from then on | Confirm the last backup | Revert the dashboard PR **first**, then (optionally) the function rollback | Planned with that PR |
| Optional CHECK rules (INV-19) | No (adds rules) | No | `alter table … drop constraint …` (to be written with the draft) | Not yet: **PROPOSED**, written together with the draft |
| Remove direct stock-table writes (INV-20) | No (permissions) | No | Re-grant script, written together with the change | Not yet: **PROPOSED** |
| Extend the audit trigger to compliance tables (X3-18) | No | No | Drop the added triggers | Not yet: **PROPOSED** |

**Missing rollback instructions** (to be written when each change is drafted, not before):
- INV-19 (constraint rollback)
- INV-20 (re-grant)
- X3-18 (trigger rollback)

Nothing that exists today lacks a rollback.

## Branch changes are independently revertible

- No branch commit changes production data or schema: the database work is drafts plus local tests.
- Each fix is one commit with its own tests. Helper-file changes always ship in the same commit as the page's version-guard update (API 3 → 4 in `b22c45b`), so reverting that commit restores a matching pair.
- `claude/platform-overnight-implementation` (37050c6) is untouched by this extension: reverting the whole extension means dropping `claude/platform-overnight-extension-3`.
