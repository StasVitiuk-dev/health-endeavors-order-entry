# Owner checks: cards to follow step by step (EXT11)

**Status:** CURRENT (2026-10-11, extension 11). For Stas. Every card on this page is a **SAFE READ-ONLY CHECK** unless its heading says **PRODUCTION CHANGE — OWNER APPROVAL REQUIRED**. No card here changes anything. Exact file names and fingerprints: `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (V1–V13). The order to do things in: `PRODUCTION_READINESS_BOARD_EXT11.md` §3.

**Never paste or send:** passwords, keys, tokens, recovery codes, log text from the backups repository, customer names or e-mails.

---

## Card 1 — SAFE READ-ONLY CHECK: backups (2 minutes)

The backups repository is private and off-limits to Claude. Only you look. **Look, do not click.**

| | |
|---|---|
| **LOOK HERE** | GitHub → the private backups repository → **Actions** tab |
| **CHECK THIS DATE** | newest **nightly backup** run: its date (must be today or yesterday, at most 2 days old); newest **monthly restore test** run: its date (at most 35 days old) |
| **CHECK THIS STATUS** | the icon next to each: green ✓ or red ✗. Then GitHub → Settings → Billing → **Actions minutes**: are there minutes left this month? |
| **DO NOT CLICK** | "Re-run", any log, "Download", any Settings change, anything in the workflow files |
| **SEND BACK** | one screenshot of the Actions list (the run names, dates and icons; nothing else), **or** one line: `nightly green:2026-10-14, restore green:2026-10-01, minutes ok` |

**What the answer means** (the session records it with `node tests/tools/interpret-query-results.js session --env production --run-date <today> --backup-nightly green:YYYY-MM-DD --backup-restore green:YYYY-MM-DD --backup-minutes ok`):

| Answer | Status | Valid for |
|---|---|---|
| both green, nightly ≤ 2 days, restore test ≤ 35 days, minutes left | **VERIFIED HEALTHY** | 7 days for planning; must be looked at again **on the day** of any database step |
| green but too old, or minutes ran out | **STALE** | — (no database step until fixed) |
| any red | **FAILED** | — (no database step; tell the session the date) |
| could not find it / incomplete answer | **UNKNOWN** | — |

**Three different things that are never mixed up:**
- **LOCAL RESTORE DRILL PASSED**: Claude restored a synthetic test database on its own machine (6/6). Says nothing about your real backups.
- **PRODUCTION BACKUP VERIFIED**: your look above shows a green, recent nightly backup.
- **PRODUCTION RESTORE VERIFIED**: your monthly restore test shows green (the backup can actually be put back). Only this proves recovery.

---

## Card 2 — SAFE READ-ONLY CHECK: one sitting for every read-only query (about 20 minutes)

Do this once, after card 1. Nothing in it changes anything; every file is a single `select` (proved by `tests/specs/sql-readonly.spec.js`). **No write SQL is mixed in.**

1. Open Supabase → your project → **SQL Editor**. Check the project name at the top is the **live** one (not a test copy).
2. For each file in this order: C, D, E, F, G, H —
   1. open it on GitHub (`docs/ops/sql/02_READONLY_C_agents.sql`, `03_READONLY_D_…`, `04_READONLY_E_…`, `05_READONLY_F_…`, `06_READONLY_G_…`, `07_READONLY_H_drift_check.sql`) → **Raw** → select all → copy;
   2. SQL Editor → **New query** → paste → **Run**;
   3. **Export → Download CSV**. Name it `C.csv`, `D.csv` … `H.csv`.
   4. If it stops with an error: screenshot the error and go on to the next file. Nothing was changed.
3. **Do not edit any file. Do not run anything else** in the same sitting.
4. Send the six CSVs (and the card 1 answer). If a file contains an e-mail address, the interpreter says so: then send only its summary.

One summary for everything (Claude runs it; no production connection):

```
node tests/tools/interpret-query-results.js session --env production --run-date 2026-10-15 \
  --D D.csv --E E.csv --F F.csv --G G.csv --H H.csv \
  --backup-nightly green:2026-10-14 --backup-restore green:2026-10-01 --backup-minutes ok
```

It prints PASS / WARN / FAIL / UNKNOWN per query and one OVERALL line. It **refuses to give a verdict if the environment is not stated** (production, staging or local), and a result labelled staging or local never counts as production evidence. Backups not checked make the overall UNKNOWN, never PASS.

**Every result is recorded with:** environment, date and time, query letter + fingerprint prefix, overall verdict, who ran it. Counts and record numbers only; no customer data (`docs/ops/evidence/README.md`).

### What each query is, in one line

| Query | What it answers | PASS looks like | WARN / FAIL means |
|---|---|---|---|
| **C** (inventory, no verdict) | which agents and switches exist and are on, what runs on a schedule, what else writes stock, which tables log changes | — (it is a list) | Claude reads it and updates the agent and audit rows |
| **D** | which "owner-power" database functions exist and whether each checks who is calling | every row A or B | C/D = read that function next; E = it can be misused, fix before launch |
| **E** | does stock match its history, do deliveries match stock and expenses | every count 0 | a mismatch already exists; correct by hand before installing the rules |
| **F** | stuck work, things entered twice, wrong references, impossible values (F01–F15 below) | every row 0 | a row to **look at**, not an automatic error (two suppliers may share a name) |
| **G** | who is allowed to read and change what (see below) | no FAIL | FAIL = a permission fix draft is written for it |
| **H** | does production still match what was reviewed (see below) | PASS or NOT INSTALLED everywhere | any FAIL = stop, do what its ACTION column says (usually: turn a switch off) |

### Query G in plain words

| Row | Plain meaning | Why it matters |
|---|---|---|
| G01 no row-level security | a table that anyone signed in can read and change without per-row rules | should be none |
| G03 open task update | **any** signed-in person can change **any** task (not only the owner or assignee) | fix draft prepared once confirmed |
| G04 anon table rights | people who are **not signed in** have rights on a table | reading may be intended (WARN); writing is never intended (FAIL) |
| G05 duplicate read policies | two "who may read" rules on one table; they **add up**, so the looser one wins | merge into one rule |
| G06 anon can run function | a database function people who are not signed in can call | check each is intended |
| G07 RLS on, no policy | locked to everyone except the database owner | fine if intended |
| G02 policy | the full list (information) | — |

### Query H in plain words

Each row says **EXPECTED** (what should be there at this stage), **OBSERVED** (what is there), **STATUS** and **ACTION**. Before an install, NOT INSTALLED is normal. **What changed** = any row whose OBSERVED differs from the last run. **What you do:** PASS / NOT INSTALLED → nothing; WARN → send it; FAIL → do the ACTION (usually turn the named switch OFF), stop, screenshot. Never repair by hand.

| Severity | Rows | Meaning |
|---|---|---|
| critical | H01 (wrong function version), H02 (anon can run stock functions), H03–H07 (a stock switch ON without its function), H08/H09 (request-key or nightly switch ON without its tables) | stop: switch OFF |
| warning | H10 (line guard absent after its step), H11 (integrity rules count unexpected) | send it; no switch involved |
| unknown | a row that could not be read | run again; still unknown = send it |

### Query F rows (F01–F15) in plain words

| Row | Means | Usually |
|---|---|---|
| F01 | tasks "in progress" unchanged for 14+ days | finish or reassign |
| F02 | open tasks 7+ days past due | finish or move the date |
| F03 | approvals waiting 7+ days | decide them |
| F04 | recalls still "initiated" after 14+ days | quarantine or close |
| F05 | purchase orders not received 7+ days after the expected date | chase the supplier or update the date |
| F06 | an order number used twice | check both; delete the copy |
| F07 | two suppliers with the same name | may be two real companies |
| F08 | two products with the same name | may be sizes; check |
| F09 | expenses that look the same (date, amount, vendor) | may be a double entry |
| F10 | a return pointing at another order's line | wrong data; correct by hand |
| F11 | an order line whose SKU matches no product | product renamed or missing |
| F12 | an order total missing or below zero | correct the order (the dashboard now names these, X11-01) |
| F13 | an order total that does not add up from its lines | check the order |
| F14 | a stock bucket below zero | count and correct |
| F15 | refund dates that do not match the return | check the return |

Thresholds (14 days, 7 days) are suggestions; changing them is owner decision X8-D4. **Manual run:** card 2. **Future nightly run:** only after `drafts/25` is installed (P9), and its Home card after `drafts/29` (P9b). Home then shows PASS / WARN / FAIL / STALE (no result for 26 hours) / UNKNOWN, never a green that was not proven. A scheduler that fires twice runs the read-only check twice; it writes only its own results table, nothing else. **No schedule is activated by any of this.**

---

## Card 3 — SAFE READ-ONLY CHECK: agents

| Agent | What to prove | Where it is answered |
|---|---|---|
| #1 (invoices) | is it ON or OFF today? (UNVERIFIED since Sept 24) | Query C §1 (switch, last run, last status) and §3 (invoice trigger and whether it checks its switch) |
| #4 / #5 / #6 | they really run on schedule and succeed | Query C §1 (last run, last status) and §5 (each scheduled job: schedule, active, last run, failures) |
| #2 / #3 / #7 / #8 (off on purpose) | they are really off and nothing calls them | Query C §1 (switch off) and §5 (no active job calls them); plus your own look at the private repository's Actions list (no recent runs) |
| #9 / #10 | nothing to prove: they are calculated in the dashboard | — |

Claude cannot see agent source code (it lives in Supabase and the private repository), so failure testing of the agents themselves is **EXTERNAL INFORMATION REQUIRED** (`OWNER_UNBLOCK_CENTER_EXT11.md` packet E).

---

## Card 4 — GitHub access check and X6-17 closure (5 minutes; an owner setting, not production data)

**Check (look only):**
1. GitHub → `health-endeavors-order-entry` → **Settings → Collaborators and teams**: `stasvitiuk-reos` has **Write** (not Admin, not Maintain).
2. **Settings → Rules → Rulesets → protect-main**: still active; bypass list = Repository admin only.
3. The backups repository's **Collaborators** list does **not** include `stasvitiuk-reos`.

**Close X6-17 (your action):** claude.ai → Settings → Connectors → GitHub → disconnect, then connect again **signed in as `stasvitiuk-reos`**. In the next session, Claude's start-of-session check must show: account `stasvitiuk-reos`, push = true, admin = false, maintain = false, only this repository visible, no backups repository. **Send back:** a screenshot of step 1, and the session's check result.

---

## Card 5 — real-device test pack (Claude cannot do this; Chromium phone emulation is not an iPhone)

Each card takes about 10 minutes on the device named. Mark each line PASS / FAIL and send screenshots of any FAIL.

| Device | Steps | PASS when |
|---|---|---|
| **iPhone Safari** | sign in → Home → open Tasks, Orders, a purchase order (cards, lot box inside the card) → Continuity → System status → sign out | nothing cut off at the right edge; every button reachable with a thumb; text readable without zoom |
| **Mac Safari** | sign in → open a few pages → browser **Back** → sign out → **Back** again | Back moves between pages; after sign-out, Back does not show business data |
| **VoiceOver (iPhone or Mac)** | turn VoiceOver on → Home → search → an order → a task → Approval Queue → a purchase order → sign out | every button is read with a name; errors and "saved" messages are read aloud; the confirm step on a stock action can be reached and cancelled |
| **Chrome (desktop)** | same as Mac Safari | same |

**Results expire:** a PASS stays valid until the next change to that page's layout or to the phone CSS; a new PR that changes them lists which cards to repeat.

---

## Card 6 — evidence expiry (so an old green never stays green)

| Evidence | Valid for planning | Must be re-done |
|---|---|---|
| Backup look (V1) | 7 days | on the day of every database step |
| Query C, D, E, F, G, H | 30 days | before the step it unblocks, if older |
| Function fingerprint (V8) and Query H | — | after **every** production step |
| Nightly check result on Home | 26 hours (Home shows STALE after that) | automatic once installed |
| Agent states | 30 days | after any agent change |
| Real-device cards | until that page's layout changes | after a layout change |

The interpreter applies the first two rules (`evidenceAge`), and the Home card applies the 26-hour rule.
