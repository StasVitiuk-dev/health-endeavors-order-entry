# Owner evidence guide (EXT12)

**Status:** CURRENT (2026-10-11, extension 12). How to send each piece of evidence, how Claude reads it, and what happens next. Replaces the intake rules in `evidence/README.md` §rules (that file keeps the table of received files). How to *produce* each result is still in `OWNER_CHECKS_EXT11.md` (cards 1–6); this file is about *sending it back*.

**Never send:** passwords, keys, tokens, recovery codes, customer names, e-mails, addresses, or backup log text. If a pasted text looks like a key or token, the intake tool **refuses it and stores nothing** (status MALFORMED). E-mail addresses are replaced by `[email]` before anything is saved.

## 1. The rules Claude applies to every result

| Rule | What it means for you |
|---|---|
| **Environment is required** | Say which system the result came from: `production`, `staging` or `local`. Without it the result is UNKNOWN. A staging or local result can never count as production proof. |
| **Nothing is guessed as PASS** | A partial, cut-off, unreadable or error result is INCOMPLETE / MALFORMED / UNKNOWN, never PASS. |
| **Dates matter** | Each result carries the date it was run. Old results go STALE (table §2) and must be re-run before acting on them. |
| **Two different answers for the same day** | CONFLICT. A person looks; nothing is auto-fixed. |
| **Result disagrees with the documents** | CONFLICT (examples: Query G shows a staff member can update tasks; an agent that should be off shows ON). |
| **Device results are tied to a page version** | A real-device result names the commit it tested. After any page change it is STALE. |
| **Decisions are versioned** | The latest answer wins; "revoked" reopens the decision and everything that depended on it. |

Status words: NOT RECEIVED · RECEIVED · MALFORMED · INCOMPLETE · CONFLICT · PASS · WARN · FAIL · UNKNOWN · STALE.

## 2. The 15 kinds of evidence

| # | Type | How to send it | Valid for | Card |
|---|---|---|---|---|
| 1 | `BACKUP` | one line: `nightly green:YYYY-MM-DD, restore green:YYYY-MM-DD, minutes ok` (use `red:` for a failed run, `minutes out` if over budget) | 7 days, and re-look on the day of any database step | card 1 |
| 2 | `QUERY_C` | the CSV download of Query C (columns `section,item,result`) | 30 days | card 2 |
| 3 | `QUERY_D` | Query D CSV (`function_name,classification`) | 30 days | card 2 |
| 4 | `QUERY_E` | Query E CSV (`section,check_name,result`) | 30 days; re-run on the day of every stock switch | card 2 |
| 5 | `QUERY_F` | Query F CSV (`section,check_name,findings,examples`) | 30 days | card 2 |
| 6 | `QUERY_G` | Query G CSV (`check_id,level,object,detail`) | 30 days | card 2 |
| 7 | `QUERY_H` | Query H CSV (`id,item,expected,observed,status,action`) | 30 days, **and after every production step** | card 2 |
| 8 | `AGENT_STATUS` | Query C section 1 rows (same CSV is fine) | 30 days | card 3 |
| 9 | `GITHUB_ACCESS` | four lines: `account:`, `role:`, `backups_repo_visible:`, `bypass:` | 90 days | card 4 |
| 10 | `REAL_DEVICE` | `device:` (iPhone Safari / Mac Safari / VoiceOver / Chrome), `sha:` (shown in the PR), `tester:`, then one line per step `name: pass` or `name: fail — what happened` | until the page changes | card 5 |
| 11 | `OWNER_DECISION` | `decision:`, `choice:`, `decided_by:` (names in `OWNER_DECISION_STATUS_EXT12.md`) | until changed | — |
| 12 | `ACCOUNTANT_DECISION` | same three lines; only `refund_rule_n4` | until changed | packet B |
| 13 | `LAWYER_DECISION` | same; `legal_hold_vs_delete`, `data_retention` | until changed | packet C |
| 14 | `PROVIDER_DECISION` | same; `email_provider` | until changed | packet D |
| 15 | `AGENT_SOURCE` | `agent:`, `reads:`, `writes:`, `schedule:`, `failure_recorded_as:`, `second_run_duplicates:` (no keys) | until the agent's code changes | packet E |

A decision answered by the wrong party (for example the refund rule answered as an owner decision) is a CONFLICT: the accountant answers N4, the lawyer answers the legal items.

## 3. What Claude does with it (commands; all local, read nothing from production)

```bash
npm run evidence:interpret -- QUERY_H path/to/query_h.csv --env production --run-date 2026-10-20
npm run evidence:intake -- QUERY_H path/to/query_h.csv --env production --run-date 2026-10-20 --operator Stas
npm run evidence:status -- --today 2026-10-20
npm run evidence:diff -- QUERY_H
```

- **interpret** reads the file and prints the verdict, each row, and **NEXT** steps. It stores nothing.
- **intake** does the same and adds one sanitized line to `docs/ops/evidence/ledger.jsonl` (type, environment, run date, operator, verdict, and each row's name, status and a short note of at most 160 characters with e-mail addresses removed; never the full pasted text). It goes into the repository only through a reviewed pull request.
- **status** prints the board: the latest status of each type with staleness and conflicts, plus open decisions.
- **diff** compares the last two results of a type: NEW FAILURE · RESOLVED · UNCHANGED · NEW UNKNOWN · NEW.

## 4. Re-entry: what each result leads to (prepared next steps only)

| Result | Next Claude work (a draft PR; never a production action) |
|---|---|
| Backup PASS | database steps may be scheduled for that day; nothing else changes |
| Backup WARN / FAIL / INCOMPLETE | no database step; ask for a fresh look; FAIL stops all production work until the owner has looked |
| Query C audit gap (`audit_trigger=NONE` on a required table) | write an audit-trigger draft + rollback + local tests for that table |
| Query C agent unknown / failed / off-agent ON | update the agent rows; for ON-when-off: card asking the owner to switch it off |
| Query C unexpected stock writer | stop R1–R5 planning; describe the writer; ask who owns it |
| Query D C/D/E rows | definer-function review notes; E = FAIL → a draft to fix that function's settings |
| Query E mismatches | list which rows to correct by hand (adjustment with a reason) before integrity rules or a stock switch |
| Query F findings | same as E for open-work rows; thresholds decision if many |
| Query G FAIL rows | the exact permission-fix drafts (each with its old policy as rollback) + local tests |
| Query H FAIL | switch OFF what its ACTION column names; no next step until H is PASS |
| GitHub PASS | mark X6-17 CLOSED in the docs |
| GitHub FAIL | X6-17 stays open; the card says which of the four lines is wrong |
| Device FAIL | route to the area's tests and fix in a page PR; the device result is then STALE and needs re-testing |
| Decision PASS | the matching small change (table in `OWNER_DECISION_STATUS_EXT12.md`) |
| Decision revoked | reopen it and every item it unlocked |
| Agent source complete | write that agent's contract tests; `second_run_duplicates: yes` → FAIL, the agent needs a duplicate guard before it can be switched on |

## 5. Synthetic examples (for practice; never production)

Every evidence type has synthetic examples in `tests/fixtures/evidence-samples.js` (complete, audit gap, unknown agent, failed agent, off agent ON, extra stock writer, missing section, cut-off output, permission denied, timeout, wrong environment, stale, conflicting, secrets…). `tests/specs/evidence-ext12.spec.js` proves each one gets the right status. These are **test data**, not production evidence.
