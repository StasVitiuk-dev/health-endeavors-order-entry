# Production change package (EXT10)

**Status:** CURRENT (2026-10-11, extension 10). Supersedes `PRODUCTION_CHANGE_PACKAGE_EXT9.md` (kept as history). Every future production change, in the order it may be done. **None has been done.** Each step needs Stas's approval and is done by Stas (or by a session Stas explicitly authorises for that one step). One step at a time; check after each; stop if anything differs. V-checks: `PRODUCTION_READONLY_VERIFICATION_EXT10.md`.

**Before any database step (P2 onward):** V1 backups = VERIFIED HEALTHY **on the same day**. If not, stop.

## 1. Phase labels (used everywhere; never skipped)

`CODE IN BRANCH` → `CODE MERGED` (= live dashboard) → `DB NOT INSTALLED` → `FUNCTION INSTALLED` (SQL ran, V-check passed) → `SWITCH OFF` → `SWITCH ON` → `PRODUCTION VERIFIED` (one real, small action checked by Stas). A feature is only "usable in production" at SWITCH ON + PRODUCTION VERIFIED. Today **every** EXT1–10 item is `CODE IN BRANCH`.

## 2. The steps

| Order | Change | Depends on | Precheck | Change (exact) | Postcheck | Rollback trigger → rollback | Downtime / lock | Data risk | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| **P0** | Merge the EXT10 branch (contains EXT1–10) | PR reviewed | tests green on the PR; §4 pre-merge checklist | GitHub: PR → Merge | §5 post-merge checks | anything in §5 differs → GitHub "Revert" on the merge | none (Pages republishes in 1–5 min) | none: every new switch is absent/off, so behaviour = branch tests | screenshots of Home (desktop + phone) |
| **P1** | V2, V4, V5, V6, V7 (read-only) | — | — | paste and run each file | — | — | none | none | CSVs |
| **P2** | Install R1–R5 (`drafts/10`) | P1 (V2: no other stock writer) | file's own preflight | `R1-R5-INSTALL-RUNBOOK.md` steps 1–6 | V8 fingerprint; grants (6 rows, anon false) | fingerprint differs → `drafts/11` | none | none: nothing calls them yet | V8 screenshot |
| **P3** | Stock switches (`drafts/21`) | P2 | file refuses without R1–R5 | run `drafts/21` | V9: 5 rows false | wrong rows → `drafts/22` (refuses while any is on) | none | none | V9 screenshot |
| **P4** | Turn on **one** stock switch, then the next (R1 receive → R4 adjust → R2 recall → R3 return → R5 delete) | P3 | page refuses if the function is missing | Feature Switches → switch → password | do that action once on a small real case; check Inventory, Expenses, PO | any number differs → **switch off** (instant); correct the business effect by hand with a note | none | low (all-or-nothing) | screenshot per switch |
| **P5** | PO line guard (`drafts/17`) | — | file header | run `drafts/17` | trigger present | error on PO edits → `drafts/18` | none | none | screenshot |
| **P6** | Integrity rules (`drafts/23`) | V6 + V7 = 0 for the four rules | file stops with counts if rows break a rule | run `drafts/23` | 4 rows | saves refused unexpectedly → `drafts/24` | < 1 s lock per table | none | screenshot |
| **P7** | Request keys: columns (`drafts/19`) then switch row (`drafts/27`, OFF) | — | 27 refuses without 19 | run 19, then 27 | **V11** | saves fail with "column … does not exist" → switch off; `drafts/28` then `drafts/20` | < 1 s per table | none | V11 screenshot |
| **P7b** | Turn on `request_keys` | P7 | page refuses if the column is missing | Feature Switches → `request_keys` → password | add one test reminder on Home, delete it; add one expense normally | any save fails → switch off (instant) | none | none | screenshot |
| **P8** | Permission fixes | V5 output | — | drafts to be written from V5 | V5 re-run: no FAIL | staff locked out → each draft's rollback restores the exact old policy | none | **medium** | V5 CSV after |
| **P9** | Nightly integrity check (`drafts/25`), optional 60 s timeout (§4 of `NIGHTLY_CHECK_PACKAGE_EXT10.md`) | X8-D4 thresholds | — | run `drafts/25`; then `select public.run_integrity_check();` once | first row in results | job errors → `select cron.unschedule('integrity_check_nightly');` or `drafts/26` | none | none (read-only checks) | screenshot |
| **P9b** | Home card for it (`drafts/29`, switch OFF) then switch on | P9 | 29 refuses without 25 | run `drafts/29`; **V12**; Feature Switches → "Nightly integrity check on Home" | Home shows PASS / WARN / FAIL with "Last success" | wrong display → switch off; `drafts/30` (before 26) | none | none | Home screenshot |
| **P10** | Revoke direct stock writes (INV-20) | all five stock switches on and stable; V2 | — | draft not written yet | — | grant back | none | medium (old path stops, intended) | — |
| **P11** | Backup status row on Home (D5) | X8-D6 | — | needs a change in the private backups job (Claude must not open it) | Home shows HEALTHY / STALE / FAILED | drop the table | none | none | — |

**Bundles (what may share one sitting):** {P1} · {P2, P3} · each P4 switch alone · {P5} · {P6} · {P7} · {P7b} alone · P8 one draft per sitting · {P9, P9b}. Never two switches in one sitting.

**Canary rule for every switch:** first use = one small real action by Stas, checked on screen, before staff use it. If the number on screen differs from what was expected: switch off, screenshot, stop.

## 3. Rules for every step

1. Only the listed file, copied from GitHub **Raw**, nothing edited.
2. One step per sitting; postcheck before the next step.
3. If a pre- or postcheck differs: stop, screenshot, do not try a fix.
4. Rollback undoes the database change; **it cannot undo real-world effects** (stock received, expense logged). Those are corrected by hand with a note of who and why.
5. Running a file twice is safe (each is idempotent and refuses in the wrong order; tested locally: install → rollback → reinstall, already-installed, wrong order).

## 4. Pre-merge checklist (P0)

- [ ] PR shows the frozen code SHA and the test counts (desktop + iPhone) on that SHA.
- [ ] No file under `.github/workflows/` changed; no secrets (secret scan in the PR body).
- [ ] `main` is still the commit the PR was tested against (otherwise ask for a re-run).
- [ ] Read "Known limitations" in the PR.

## 5. Post-merge, pre-database checks (P0 postcheck) — 5 minutes

1. Live dashboard, Private Window (or Cmd+Shift+R), sign in.
2. Home: "Checks: what needs a look" with "Checked at …"; below it **"Nightly integrity check — NOT VERIFIED — Not set up yet"** (correct: nothing installed).
3. Feature Switches: no new switches appear (the switch rows are added only by the SQL steps).
4. Add one reminder on Home and delete it (creates still work with request keys absent).
5. On an iPhone: Tasks page shows cards, not a sideways-scrolling table.
6. Change-password page opens and shows the sign-in step.

**Drift check:** if any of 2–6 differs from the screenshots in the PR (`design-review/dashboard-extension-10-2026-10-11/`), revert the merge and send a screenshot.

## 6. Pause points

After P0 (live for a few days before any database step) · after P4's first switch (one week of normal use) · before P8 (permission changes can lock staff out) · before P10.
