# Production evidence intake (read-only results)

**Status:** CURRENT (updated EXT12, 2026-10-11). Empty until Stas sends a result. **How to send results and how they are read: `../OWNER_EVIDENCE_GUIDE_EXT12.md`.** Since EXT12 each result is recorded by `npm run evidence:intake`, which adds one sanitized line to `ledger.jsonl` in this folder (type, environment, run date, operator, verdict, and each row's name, status and a short note of at most 160 characters with e-mail addresses removed; never the full pasted text). It refuses text that looks like a key or token, and replaces e-mail addresses with `[email]`. The ledger changes only through a reviewed pull request.

Rules (the repository is public):
- Store only counts, record numbers, PASS/WARN/FAIL rows and dates. **Never** customer names, e-mails, addresses, keys, tokens or backup log text.
- File name: `V<n>_<yyyy-mm-dd>.csv` or `.md` (e.g. `V5_2026-10-15.csv`).
- Each file gets one line in the table below and the matching row in `../OWNER_UNBLOCK_CENTER_EXT10.md` is updated.
- Validity: backups (V1) 7 days; GitHub access 90 days; real-device results until the page changes; decisions until changed; everything else 30 days, or until the production step it unblocks, whichever is sooner. Older = STALE: re-run before acting on it.

| File | Check | Date run | Result in one line | Valid until |
|---|---|---|---|---|
| (none yet) | | | | |
