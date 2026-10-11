# Unfinished work (EXT11): the final sweep

**Status:** SUPERSEDED as the summary by `UNFINISHED_WORK_EXT12.md` (extension 12); the classification below stays the detail. Was: CURRENT (2026-10-11, extension 11). Supersedes `UNFINISHED_WORK_EXT10.md` as the summary (that file keeps the per-workstream detail). Every remaining item is classified. **FIX NOW** items found in this sweep were done in EXT11 and are listed as DONE.

## 1. Classification of everything still open

| Class | Items | Count |
|---|---|---|
| **FIX NOW (done in EXT11)** | X11-01 missing order totals counted as $0 · X11-02 return receive after a lost reply · X11-03 recall quarantine after a lost reply · X11-04 missing report figures shown as 0 / $0.00 · X11-06 received return labelled "Restocked" · installation status + switch safety · merge-before-SQL test profile · sign-in screen reads no data (test) · one-session interpreter + backup intake + evidence expiry | 8 |
| **OWNER (decision)** | Query F thresholds · low-stock levels · partial returns · staging location · RPO/RTO · backup status row · week definition · employees approve? · one recall per lot · orders without items policy · document categories · order-number uniqueness rule (after Query C/F) | 12 |
| **PRODUCTION VERIFY (read-only, owner runs)** | backup look · Query C, D, E, F, G, H · agent states · audit coverage · storage access rules · GitHub access check | 6 groups |
| **DEPLOY (owner production step)** | merge · R1–R5 + switches · line guard · integrity rules · request keys · permission fixes · nightly check · revoke direct stock writes (later) | 8 |
| **ACCOUNTANT** | refund rule N4 · tax export review | 2 |
| **LAWYER** | legal hold vs delete · data retention · claims review queue (D8) | 3 |
| **PROVIDER** | e-mail service (R10) | 1 |
| **AGENT SOURCE** | agent failure tests · agent supervisor heartbeat | 2 |
| **REAL DEVICE** | iPhone Safari · Mac Safari · VoiceOver · Chrome desktop cards | 4 |
| **POST-LAUNCH (intentional)** | server-side paging for orders / expenses · Home revenue aggregate · next code extractions (System status, Tax, Returns blocks) · strict script policy on the remaining pages one per PR (U46) · request key on manual orders (U47) · duplicate-customer watcher (U50) · large-adjustment alert (needs a threshold) | 7 |
| **OBSOLETE** | "U38/U39/U42/U43 deferred until after merge" (done in EXT10) · "silent truncation at the reply limit" (fixed X10-15) | 2 |

## 2. Claude-safe meaningful work remaining

**Effectively none before the owner's next step.** Every remaining item needs either an owner decision, a production fact only the owner can read, an owner production step, an outside person, a real device, or is deliberately post-launch. The next Claude work is triggered by owner evidence:

- Query G CSV → write the exact permission fix drafts with local tests.
- Query C §10 → write audit trigger drafts for the missing tables.
- Query C §1–5 → update the agent rows.
- Query E/F results → tell which rows to correct before installing the integrity rules.

## 3. Checked and found already done (verified, skipped)

Open tasks / incidents / pending approvals never hidden by older closed rows (open-only reads, labelled caps) · manual adjustment lost-reply message already honest · manual order entry retry-safe (four client-side paths acceptable, §1 of `ENGINEERING_CATALOG_EXT11.md`) · the seven "database key needed" paths are closed by R1–R5 · Query H already flags a stock switch ON without its function (H03–H07) · switches already refuse to turn on before their SQL · no TODO / FIXME comments in the page code.

## 4. Considered and not done (low value now)

A separate request-key log table (keys live on their rows; no growth problem) · an RPC for every multi-step write (only R1–R5 matter) · server paging everywhere (labelled caps are enough at today's volume) · a full role system (no staff yet) · further splitting of `owner-login.html` (maintainable with the current tests; each split costs a full re-verification) · a 100k-order performance run (50k already shows the nightly check takes 0.3 s; 100k would be busywork) · re-measuring the report-totals test duration (the EXT10 7% figure compared test runs with a changed test harness, not page speed; no user-visible slowdown was found).
