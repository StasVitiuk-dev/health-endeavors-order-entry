# Owner session prompts (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · page code `32c05e2` · branch `claude/platform-ext13-owner-attention-final-audit-2026-10-11`.

Short messages to copy into a new Claude Code session (Health Endeavors repository) when evidence arrives. Each one tells the session what arrived, what to do, and what not to do. Replace the `<…>` parts. **Never paste passwords, keys, tokens or customer details.**

Every prompt below carries these rules (the session also reads `CLAUDE.md`):

> Internal dashboard only. Do not merge, deploy, run SQL on production, turn on switches, open the backups repository or touch the website or Real Estate repositories. Use `npm run evidence:interpret` / `evidence:intake` for anything I send. Start from `docs/ops/START_HERE_EXT13.md`.

## 1. Next session (general)

```
Continue the Health Endeavors internal dashboard from docs/ops/START_HERE_EXT13.md.
Do the read-only start-of-session check from CLAUDE.md first. Here is what I have for you: <list>.
Read each item with the evidence intake, tell me in plain English what it means, and prepare only
the next small draft it calls for. Do not merge, deploy or run anything on production.
```

## 2. Backup look arrived

```
Backup result (production, checked <YYYY-MM-DD>): nightly green:<date>, restore green:<date>, minutes ok
Record it with the evidence intake (--env production --run-date <date> --operator Stas) and tell me
whether database steps may be scheduled, and until when it is valid.
```

## 3. GitHub access arrived

```
GitHub access check (production, <YYYY-MM-DD>):
account: <…>
role: <…>
backups_repo_visible: <…>
bypass: <…>
Record it as GITHUB_ACCESS. If all four are right, mark X6-17 CLOSED in the docs in a draft PR.
If not, tell me exactly which line is wrong and what to click.
```

## 4. Query G arrived

```
Query G result attached (production, run <YYYY-MM-DD>). Record it as QUERY_G.
For every FAIL or WARN row: explain it in plain English, and for each one I should fix, write a
draft with forward SQL, the exact old policy as rollback, and a local test. Draft PR only.
Do not run anything on production.
```

## 5. Query C–H arrived (read-only session)

```
Read-only session results attached (production, run <YYYY-MM-DD>): C, D, E, F, G, H.
Record each with the intake. Give me one verdict: what is fine, what is unknown, what is wrong.
Say which drafts each finding calls for (audit triggers, permission fixes, corrections list),
and prepare them as a draft PR. Stop and ask if anything is FAIL or CONFLICT.
```

## 6. Accountant answer (N4) arrived

```
Accountant answer (<YYYY-MM-DD>):
decision: refund_rule_n4
choice: <a|b|c>
decided_by: <accountant name or "accountant">
Record it as ACCOUNTANT_DECISION. If it changes the dashboard, prepare the small page change with
tests as a draft PR. No accounting data is written; the pages stay read-only.
```

## 7. Lawyer answer arrived

```
Lawyer answers (<YYYY-MM-DD>): legal_hold_vs_delete = <1|2>, data_retention = <text>, claims_review_queue = <needed|not needed>.
Record each as LAWYER_DECISION. Tell me what each changes and prepare only the dashboard part as
a draft PR. Do not delete or change any real record.
```

## 8. Agent source arrived

```
Agent descriptions attached (no keys). Record each as AGENT_SOURCE. Map each to the agent contract
(ENGINEERING_CATALOG_EXT11.md §8), flag any agent whose second run could duplicate work, and write
contract tests where possible. Do not change any agent or schedule.
```

## 9. Real-device results arrived

```
Real-device result (tested on commit <sha>):
device: <iPhone Safari|Mac Safari|VoiceOver|Chrome>
tester: <name>
<step>: pass
<step>: fail — <what happened>
Record it as REAL_DEVICE. For each fail, find the page area and its tests and prepare a fix as a
draft PR.
```

## 10. Staging decision arrived

```
decision: staging_location
choice: <private artifact page|local only|separate private repository>
decided_by: Stas
Record it. Build the staging copy from the synthetic seed and tell me exactly how to open it.
No production address or key may be in it.
```

## 11. Before a deployment sitting

```
I want to do this production step today: <P-number and card name>.
Today's backup look: <line>. Query H today: <attached>.
Check with the deployment simulator and the evidence board that the prerequisites are met, then
give me the card step by step, with the stop conditions. Do not run anything yourself.
```

## 12. After a deployment step

```
I did <P-number> today (<YYYY-MM-DD>). Postcheck screenshots and Query H attached.
Record the evidence, add a line to the checkpoint log in PRODUCTION_READINESS_BOARD_EXT11.md §5
(draft PR), tell me whether the step is verified, and what the next card is and when.
If anything differs from the card: tell me to stop and what to switch off.
```
