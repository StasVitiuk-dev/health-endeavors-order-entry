# Production evidence intake (read-only results)

**Status:** CURRENT (EXT10, 2026-10-11). Empty until Stas runs a read-only check from `../PRODUCTION_READONLY_VERIFICATION_EXT10.md`.

Rules (the repository is public):
- Store only counts, record numbers, PASS/WARN/FAIL rows and dates. **Never** customer names, e-mails, addresses, keys, tokens or backup log text.
- File name: `V<n>_<yyyy-mm-dd>.csv` or `.md` (e.g. `V5_2026-10-15.csv`).
- Each file gets one line in the table below and the matching row in `../OWNER_UNBLOCK_CENTER_EXT10.md` is updated.
- Validity: backups (V1) 7 days; everything else 30 days, or until the production step it unblocks, whichever is sooner. Older = STALE: re-run before acting on it.

| File | Check | Date run | Result in one line | Valid until |
|---|---|---|---|---|
| (none yet) | | | | |
