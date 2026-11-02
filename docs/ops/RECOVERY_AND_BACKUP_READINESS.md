# Recovery and backup readiness

**Status:** CURRENT (2026-10-07, extension 8). The authoritative recovery page from now on; `ROLLBACK_AND_BACKUP_REVIEW.md` keeps the per-change rollback table and the history (EXT3–EXT7). **Backup health: UNKNOWN.** Claude never opened the private backups repository, never read a backup, and changed nothing about backups.

## 1. Proven vs assumed

| Fact | Status | Evidence |
|---|---|---|
| A nightly backup and a monthly restore test exist (GitHub Actions, private backups repository) | REPORTED, not verified | PROJECT_RECORD §2 |
| They are still running (Actions minutes ran out once, Sept 13) | **UNKNOWN** | PROJECT_RECORD history |
| A backup can be restored into a fresh database and is complete and usable | **Proven locally only** (synthetic data, same PostgreSQL major version) | `local-test/restore_drill.sh`: 6/6, dump ≈1 s, restore ≈1 s for ~2,200 synthetic rows |
| A production backup restores | **UNKNOWN** | Needs the owner's drill (§4) |
| RPO (how much work can be lost) | **UNKNOWN**; if nightly works, up to ~24 h | Owner to confirm the schedule |
| RTO (how long until working again) | **UNKNOWN** for production; locally seconds | Measure in the owner's drill |
| Supabase's own platform backups (plan-dependent) | **UNKNOWN** | Owner: Supabase → Project settings → Backups (read-only look) |
| Dashboard code can be rolled back | Proven | Revert the merge commit; Pages republishes in 1–5 min (tested revert path) |

## 2. Owner checks (read-only)

**2-minute backup check** (unchanged from EXT4; still the first step):
1. GitHub → private backups repository → Actions.
2. Newest nightly backup: date, green or red?
3. Newest monthly restore test: date, green or red?
4. Actions minutes left this month?
5. Tell the session only "nightly: green/red, date; restore test: green/red, date; minutes: OK/out". Never paste logs, file names or contents.
6. Red or older than 2 days → stop before any production change.

**New (EXT8): 1-minute Supabase look:** Supabase → Project settings → Database → Backups: is "daily backups" listed, and what is the newest date? (Read-only. Do not click Restore.)

## 3. How a silent backup failure would be noticed

Today: only by the owner looking (§2), or a GitHub e-mail if notifications are on. The dashboard shows **"Backups: not verified here" (UNKNOWN)** on Home on purpose (EXT8). Recommended (design, `AUTOMATION_AND_AGENT_ARCHITECTURE.md` D5): the backup job writes one row (finished_at, ok, size, restore_tested_at) into a table the dashboard can only read; Home then shows HEALTHY / NEEDS REVIEW / UNKNOWN. No backup secret ever reaches the dashboard. Needs owner approval (a table + a change in the private repository's job).

## 4. Safe restore drill for production (owner, when approved)

1. Create a **separate, throwaway Supabase project** (never the production one).
2. Restore the newest backup into it (the backup job's documented restore, or Supabase's restore-to-new-project).
3. Run, in the throwaway project: Query E and Query F (read-only), and compare row counts with production's Query B.
4. Record: date, backup date restored, minutes taken (RTO), anything missing.
5. Delete the throwaway project.
Claude can prepare the checklist and read the results; only the owner can run it. Restore permissions: only the owner account; never an automated session.

## 5. Dashboard behaviour after a restore or with stale data

| Situation | What the dashboard does | Evidence |
|---|---|---|
| Data restored from an older backup | Shows what is in the database; the Home checks and Queries E/F reveal gaps (stock vs history, duplicates, stuck work) | attention-checks.spec, integrity_check_test |
| A figure cannot be read | "?" / "could not check", never zero | owner-control-center, attention-checks specs |
| Older replies arriving late | Ignored (latest request wins) | out-of-order.spec |
| Session from before the restore | Sign-in re-checked on return from the Back-button cache; user switch wipes | auth-chaos.spec |

## 6. Gaps (owner decisions / production access)

- Backup health and schedule: owner check (§2). **P0 before relying on production.**
- RPO/RTO targets: owner decision (suggestion: RPO 24 h, RTO 4 h for now).
- Backup status row for Home (D5): owner approval, BUILD LATER.
- Production restore drill (§4): owner, once before launch.
