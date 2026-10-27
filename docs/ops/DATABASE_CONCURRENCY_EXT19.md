# Database concurrency (EXT19, local throwaway PostgreSQL only)

| Run | Calls | Result |
|---|---|---|
| Extreme stress, 100 callers per function | 540 | 12/12, every R1–R5 function applied exactly once, 0 deadlocks, 0 refused |
| 150 callers | 790 | 12/12, 0 deadlocks, 0 refused |
| 250 callers | 1,290 | 12/12, 0 deadlocks, 0 refused |
| Combined run (100/150/250) | 2,540 in 40 s | 28/28 |

- **New:** the summary counts callers the server refused before they started. A storm beyond `max_connections` (100 here) can then never read as a full run.
- **Honest limit:** each call finishes quickly, so the callers did not all overlap. The true peak of simultaneous connections was not measured.
- Local DB ≠ production DB. The R1–R5 drafts are tested here, **not installed**.
