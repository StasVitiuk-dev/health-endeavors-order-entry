# Database concurrency (EXT20), measured

Status: **CURRENT.** Local throwaway PostgreSQL 16 only; never Supabase. Supersedes the "peak not measured" note in `DATABASE_CONCURRENCY_EXT19.md`.

## 1. The honest correction

EXT14–EXT19 storms started **one `psql` process per caller**. EXT20 measured those storms for the first time:

- a sampler session polled `pg_stat_activity` every ~5 ms, with a fresh snapshot each time;
- every caller's start and end time was logged.

**"50 callers" put at most 3–6 calls inside the server at the same moment.** Starting `psql` takes longer than the call itself, so callers ran mostly one after another. Earlier "100/150/250 callers" results therefore proved exactly-once **under light overlap**, not under 250 truly simultaneous calls.

Example (`extreme_stress_test.sh`, measured, N=50):

- peak running together: 3–5;
- average running: 0.3–0.4;
- latency median 547–637 ms (mostly process start);
- completion spread: about 300 ms.

`extreme_stress_test.sh` now prints this measurement for every burst (`MEASURE=0` turns it off).

## 2. True simultaneous callers (new: `true_concurrency_test.sh`)

`pgbench` opens all N connections **first**, then fires the call on every connection at once. A sampler measures how many really run together.

For each function R1–R5 (draft 10) at every level, the test checks:

- exactly one business effect;
- the history explains every bucket;
- 0 deadlocks.

| N requested | Peak measured running together (R1 / R2 / R3 / R4 / R5) | Latency median / max (R1) | Deadlocks | Exactly once |
|---|---|---|---|---|
| 25 | 18 / 25 / 22 / 13 / 19 | 41 / 54 ms | 0 | yes |
| 50 | 48 / 46 / 45 / 17–34 / 24–50 | 69 / 101 ms | 0 | yes |
| 90 | 81 / 88 / 87 / 59 / 44 | 140 / 187 ms | 0 | yes |
| 150 (`max_connections` raised to 300 locally) | 129 / 130 / 124 / 122 / 43 | 209 / 285 ms | 0 | yes |
| 250 (same) | 222 / **250** / 228 / 191 / 188 | 307 / 463 ms | 0 | yes |

- **R4** (all N callers send the same stale "current" value): exactly 1 applied. The other N−1 are refused with "Available changed since the page loaded … Nothing was changed". That is the designed stale-value refusal.
- **R5** peaks lower because the first caller deletes the product and the rest return quickly.

**Fairness (no starvation):**

- the slowest caller is 1.3–1.5× the median at every level;
- 0 callers slower than 20× the median;
- completion spread is 59–434 ms.

## 3. Connection pressure

Asking for `max_connections + 5` callers (105 against 100; 305 against 300):

- `pgbench` **refuses to start** (exit 1) and reports the connection errors;
- **0 changes are applied**;
- the history still explains every bucket.

Failure is loud and harmless. This complements EXT15's INT-1 finding (a 30-connection limit: refused callers are counted, never silently dropped).

## 4. In the DB suite

- Step "true concurrency (25/50/90 simultaneous connections, measured)" runs where `pgbench` is installed (a PostgreSQL server tool).
- Where it is missing, the suite prints **NOT RUN** with the reason. It never shows a silent pass.
- The 150/250 levels need a larger local `max_connections`, so they are documented here, not run in every suite.

## 5. Not redone (equal or stronger evidence exists)

- Transaction abort at every insert/update point (`16_DRAFT_tests_hardening_and_failures.sql`): before the change = after.
- Request keys: same key, retry, different body, delayed and concurrent retry (EXT6/EXT10 specs), plus 10k/100k scale (`request_key_scale_test.sh`). The implementation is unchanged in EXT20.
- Deadlock: S29 forced lock order (INT-4), random interleavings.

## 6. Limits

- Local PostgreSQL on 4 CPUs. Supabase uses a connection pooler (Supavisor) and has its own limits. **Production concurrency is UNKNOWN.**
- R1–R5 are DRAFTS, not installed in production.
