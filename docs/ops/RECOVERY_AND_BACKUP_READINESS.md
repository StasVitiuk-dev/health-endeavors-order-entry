# Recovery and backup readiness

**Status:** CURRENT (updated 2026-11-24 with the owner's own look; first written 2026-10-07, extension 8). The authoritative recovery page; `ROLLBACK_AND_BACKUP_REVIEW.md` keeps the per-change rollback table and the history (EXT3–EXT7). **Backup health: PARTLY KNOWN (owner-reported, Nov 24): the nightly backup is green and the platform's daily backups are listed; whether a production backup restores is still UNKNOWN.** Claude never opened the private backups repository, never read a backup, and changed nothing about backups.

## 1. Proven vs assumed

| Fact | Status | Evidence |
|---|---|---|
| A nightly backup and a monthly restore test exist (GitHub Actions, private backups repository) | REPORTED, not verified | PROJECT_RECORD §2 |
| They are still running (Actions minutes ran out once, Sept 13) | **REPORTED by the owner, Nov 24:** nightly backup green, run on Nov 24 (scheduled). The monthly restore test exists; its latest result (green/red, date) was **not seen** and is still owed. Minutes: not reported | Owner's look at the Actions page, Nov 24 (told in chat; no logs, names or contents were shared) |
| A backup can be restored into a fresh database and is complete and usable | **Proven locally only** (synthetic data, same PostgreSQL major version) | `local-test/restore_drill.sh`: 6/6, dump ≈1 s, restore ≈1 s for ~2,200 synthetic rows |
| (Nov 22) A restored backup keeps every protection of the pending drafts 32, 34, 36, 38: row-level security on, the same rules, guards, functions and permissions; the invoice counter carries on; an administrator still cannot approve, staff still cannot open a file | **Proven locally only** (synthetic data) | `local-test/restore_with_drafts_test.sh`: 32/32 |
| A production backup restores | **UNKNOWN** | Needs the owner's drill (§4) |
| RPO (how much work can be lost) | Up to about 24 h while the nightly and the platform's daily backups keep running (both reported green/listed on Nov 24). A "point in time" option exists on the platform's backups page; whether it is switched on was **not seen** | Owner's look, Nov 24 |
| RTO (how long until working again) | **UNKNOWN** for production; locally seconds | Measure in the owner's drill |
| Supabase's own platform backups (plan-dependent) | **REPORTED by the owner, Nov 24:** daily backups listed for the last seven days (Nov 18–24), each with a Restore button; "Restore to new project" is offered. The page itself says **files kept in Storage are not included** in these backups | Owner's look at the Backups page, Nov 24 (read-only; nothing was clicked) |
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

## 3a. Backup status on Home: prepared (Nov 26) — PROPOSED, nothing installed

The design D5 above, prepared so it is ready when the owner approves it:

- **Database step 19** (`docs/ops/sql/drafts/70_DRAFT_backup_reports.sql`, undo `71_…`): one small
  table, `backup_reports`, with one line per finished backup job run: which job (`nightly_backup` or
  `restore_test`), when it finished, OK or failed, and the size (optional). **Nothing else can be
  stored in it:** no file names, paths, errors or logs. The owner and administrators can read it;
  nobody signed in to the dashboard can add, change or delete a line. Only the backup job writes,
  with the database's own service key it already uses. Local test
  `local-test/backup_reports_test.sh`: 40 of 40.
- **Home** (preview switch "Backup status on Home", off): the backups line then says one of:
  - **last night's backup succeeded** (with the time; and the last restore test, if one reported);
  - **the newest backup is older than a day**, or **the last backup failed**: urgent, at the top;
  - **the last restore test failed**, or **is more than 35 days old**: needs a look;
  - **no backup has reported yet**, or **not verified here** (step 19 not installed): as today.
- **One step in the private backups repository (the owner's; Claude may not open it).** In the
  nightly backup workflow, add this as the LAST step (and the same in the monthly restore test, with
  `restore_test` instead of `nightly_backup`). It uses the two secrets the job **already** has for
  the database; put their existing names where the angle brackets are. Never paste a key anywhere.
  If the report cannot be sent, the backup itself still counts as done.

  ```yaml
      - name: Tell the dashboard how this run went (one line, no details)
        if: always()
        env:
          DB_URL: ${{ secrets.<the database URL secret this job already uses> }}
          DB_KEY: ${{ secrets.<the service key secret this job already uses> }}
          RUN_OK: ${{ job.status == 'success' }}
        run: |
          curl -fsS -X POST "$DB_URL/rest/v1/backup_reports" \
            -H "apikey: $DB_KEY" -H "Authorization: Bearer $DB_KEY" \
            -H "Content-Type: application/json" -H "Prefer: return=minimal" \
            -d "{\"kind\":\"nightly_backup\",\"finished_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"ok\":$RUN_OK}" \
            || echo "The report to the dashboard was not sent; the backup result above still stands."
  ```

  Order: install step 19 first, then add this step, then switch "Backup status on Home" on. To undo:
  remove this step first, then run `71_…`.

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

- ~~Backup health and schedule: owner check (§2)~~ **Done Nov 24** for the nightly backup and the platform's daily backups (§1). Still owed: the newest monthly restore test (green/red, date) and the minutes.
- RPO/RTO targets: owner decision (suggestion: RPO 24 h, RTO 4 h for now).
- Backup status row for Home (D5): owner approval, BUILD LATER. The owner wants a warning on Home when the newest backup is older than a day (§7).
- Production restore drill (§4): owner, once before launch.

## 7. "Backups at the best level" (owner's request, Nov 24) — PROPOSED

The owner asked for the strongest protection, "even if a virus or a break-in". What exists today (§1) is two copies: the platform's own daily backups and the nightly backup made by the private backups repository. Both sit behind sign-ins of the business. What is missing, in order of value:

1. **A third copy that cannot be changed or deleted for a set time**, at a different provider from the other two, owned by the business. This is what protects against a break-in: a person who gets into the database or the repository still cannot erase it. OWNER DECISION REQUIRED (which provider; a few dollars a month at this size).
2. **One real restore drill** (§4) into a throwaway project, with the minutes written down. A backup that has never been restored is a hope, not a backup.
3. **Files in Storage** (for example supplier documents and receipts, once those features are installed) are not in the platform's database backups. They need their own copy in the nightly job. Today few or no files exist, so nothing is at risk yet; this must be in place before those features are switched on for real.
4. **A warning on Home** when the newest backup is older than a day (the design in §3).
5. **Two-step sign-in** on the accounts behind the dashboard (the database provider, GitHub, Shopify): the owner decided "later"; it is one of the last lines on the launch list (`NEXT_SESSION_CHECKLIST.md`).

**The owner's idea: the business partner's Administrator account receives the third copy.** Not possible as asked, and not recommended in the nearby form:

- A dashboard account is a sign-in with a role. It holds no files, so a backup cannot be "sent to" it.
- Putting a copy into a person's own private account (a personal cloud drive or mailbox) would move every customer's name, address and order out of the business's control, and a copy that one person can delete is not the protected copy described in point 1.
- What gives the same result safely: the third copy lives in a storage account that belongs to the business, and the partner gets her own emergency sign-in to that account, so she can reach the backups if the owner cannot. This matches the owner's rule that the sign-ins behind the dashboard stay with the owner and the emergency account, with the partner able to print and recover in an emergency.

Who can build it: points 1 and 3 are changes inside the private backups repository, which a Claude session may not open (`CLAUDE.md`). Claude can write the plan and the exact steps in this repository; the owner (or a session the owner approves for that one task) makes the change there. Points 2 and 4 follow §4 and §3.

## 8. Evidence still needed (owner queue of Nov 25, task 9) — CURRENT

A green scheduled job is not proof that a restore works. Each line is "proven" only when its
evidence exists. Claude cannot open the backups repository (`CLAUDE.md`), so every line marked
**owner** is a look or a step only the owner can do, reported in the short form only ("green/red,
date"; never logs, file names or contents).

| # | What must be true | Evidence that proves it | Status (Nov 25) | Who |
|---|---|---|---|---|
| E1 | The newest nightly backup succeeded | its date and green/red | **REPORTED** green, Nov 24 | owner |
| E2 | The newest monthly restore test succeeded | its date and green/red | **missing** (exists, result not seen) | owner |
| E3 | GitHub Actions minutes are not running out | "minutes: OK/out" | **missing** | owner |
| E4 | A production backup really restores, and how long it takes | one drill into a throwaway project (§4): start and end time, row counts of five main tables match | **missing** (proven only locally on synthetic data, §1) | owner, guided |
| E5 | Uploaded files are covered, not only database rows | a list of the storage buckets in the nightly job; one file restored from it | **missing**: the platform's backups exclude files (its own page says so); no file feature is installed yet, so nothing is lost today | owner (backups repository) |
| E6 | One copy is independent: another provider, owned by the business, cannot be deleted for a set time | the provider's retention setting and one test restore from it | **missing** (§7 point 1, PROPOSED) | owner |
| E7 | A stale or failed backup is noticed within a day | a warning on Home when the newest backup is older than a day, tested with a deliberately old date | **PREPARED** (Nov 26, §3a): drafts 70/71, Home line behind a switch, tested locally with old and failed dates; needs step 19 and the repository step | Claude built, owner installs |
| E8 | A replacement Mac can take over | the steps below, walked once on a second computer: sign in to GitHub, Supabase, Shopify, the backup copy; open the live dashboard; no secret was stored only on the old Mac | **missing** | owner, guided |

**Replacement Mac, in short (to walk once, with Claude):** (1) a new Mac signs in to the
password manager first (that is where every sign-in lives, never in files or chat); (2) GitHub:
the dashboard code is all on GitHub, nothing to copy; (3) Supabase and Shopify: sign in, check
two-step sign-in; (4) the backup copy (E6): sign in and list the newest backup; (5) open the live
dashboard, sign in, check Home. Anything that only existed on the old Mac (a local file, a
printer setting) is written down here when found.

### Printouts are not backups

A printout (the weekly owner report, packing slips, labels, invoices) is a **paper record for
people**: it cannot be loaded back into the database. A backup is the copy the system can be
**restored from**. Both are kept; neither replaces the other.

| Printout | Checked by tests (made-up data, simulated screen) | Real printer |
|---|---|---|
| Invoice (Letter) | `invoice-print-ext21`, `invoice-print-view-ext21`: headings, totals, long tables across pages | **pending** (Brother) |
| Packing slip and 4×6 label | `slip-print-view-ext21`, `order-slips-ext22`, `batch-labels-ext24`, `printers-ext22` | **pending** (Rollo, Brother) |
| Reports and the weekly owner report | `report-print-view-ext21`, `backups-page-ext22` | **pending**; the Print button opening the print window was seen live by the owner on Nov 24 |
| Automatic printing on the Mac | `auto-print-ext24` (the page side only) | **pending**, and unattended printing stays off until tested and approved |

