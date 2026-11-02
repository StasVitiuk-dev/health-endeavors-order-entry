# Owner decision status (EXT12)

> **SUPERSEDED (EXT13 navigation, 2026-10-11)** by `OWNER_ATTENTION_SESSION_EXT13.md` §6 (decision list; the answer format here is unchanged). Start at `START_HERE_EXT13.md`; authority per topic: `SOURCE_OF_TRUTH_MAP_EXT13.md`. Nothing below this line was changed by EXT13 except dated correction notes.

**Status:** CURRENT (2026-10-11, extension 12). Every open decision in one table, with its safe default, who answers, what it changes, and the exact text to send back. Supersedes the decision table in `OWNER_UNBLOCK_CENTER_EXT11.md` §2 (same decisions; the EXT10 packets in `OWNER_DECISION_PACKETS_EXT10.md` keep the long explanations). The machine copy is `DECISIONS` in `tests/tools/evidence.js`; `tests/specs/evidence-ext12.spec.js` checks the rules.

**Received so far: none.** Every decision is OPEN. Until answered, the dashboard keeps today's behaviour (the safe default).

## 1. How to answer

Three lines, in a chat message or a text file:

```
decision: partial_returns
choice: whole line
decided_by: Stas
```

- `choice` must be one of the listed options (free text only for `email_provider` and `data_retention`).
- To change your mind, send the same decision again; the latest wins.
- To withdraw an answer, send `choice: revoked`: the decision reopens and everything it unlocked goes back to waiting.
- The accountant answers `refund_rule_n4`; the lawyer answers `legal_hold_vs_delete` and `data_retention`. The same answer sent as an owner decision is a CONFLICT (not accepted).

## 2. The decisions

| Decision (`decision:`) | Options (`choice:`) | Safe default (today) | Who | What a "yes" leads to (a small draft PR, never a production change by Claude) | Status |
|---|---|---|---|---|---|
| `thresholds` (Query F, X8-D4) | as written / custom | as written | owner | needed before the nightly check (P9); "as written" may be accepted explicitly | OPEN |
| `low_stock_levels` | global / per product / no alerts | no alerts | owner | Home low-stock rows; D4. Nothing is ever ordered automatically | OPEN |
| `partial_returns` (D-ops-5) | partial quantity / whole line | whole line | owner | R3 quantity parameter + a quantity field on the return form (new draft version of R3 → its fingerprint changes) | OPEN |
| `staging_location` (X8-D1) | private artifact page / local only / separate private repository | private artifact page | owner | publishing the synthetic staging copy there | OPEN |
| `rpo_rto` (X8-D5) | 24h/4h / custom | none (must be chosen) | owner | restore drill target (U17) | OPEN |
| `backup_row` (X8-D6) | approve / not yet | not yet | owner | P11 backup status on Home (needs a change in the private backup job; Claude cannot do it) | OPEN |
| `week_definition` (X8-D2) | last 7 days / calendar week / both | last 7 days | owner | report windows | OPEN |
| `employee_approval` | yes / no | no | owner | an approval permission draft, before anyone is hired | OPEN |
| `recall_per_lot` | one per lot / several allowed | several allowed | owner | optional unique rule INV-16 | OPEN |
| `orders_without_items` | A: count as revenue (today) / B: exclude until items added | A | owner | revenue rule on Accounting/Tax | OPEN |
| `document_categories` | keep 7 / add categories | keep 7 | owner | the document form | OPEN |
| `order_number_rule` | unique in the database / page check only (today) | page check only | owner | optional unique rule on orders (after Query C/F show no duplicates) | OPEN |
| `refund_rule_n4` | a / b / c | a | **accountant** | how Accounting and Tax subtract refunds | OPEN |
| `legal_hold_vs_delete` | 1 / 2 | 2 (nothing deleted while a hold is open) **[wrong: see the EXT13 correction under this table]** | **lawyer** | delete buttons check holds | OPEN |
| `data_retention` | (to be written) | delete nothing | **lawyer** | none until decided | OPEN |
| `email_provider` | provider name | none | owner (provider facts, packet D) | R10 adapter; still no sending until separately approved | OPEN |

> **EXT13 correction (2026-10-11):** the words in brackets were wrong. In the original decision (`OWNER_DECISIONS_NEXT.md`), option **1** = block deletes while a hold is active, option **2** = allow deletes with a warning and a record of who deleted. Today nothing checks holds. Corrected list: `OWNER_ATTENTION_SESSION_EXT13.md` §6.

## 3. Staging host (the one decision with a recommendation)

| Option | Label | Why |
|---|---|---|
| Private artifact page | **RECOMMENDED** | private by default, free, nothing in this public repository, fully separate from production; a permanent STAGING banner and synthetic data only |
| Local only (on the owner's Mac) | ALTERNATIVE | simplest, nothing published, but only one person can look |
| Separate private repository with Pages | NOT RECOMMENDED now | more setup and another place with access to manage; needs the owner's approval for a new repository |

Guards in every option (tested in `staging-build.spec.js`): synthetic data only; no production address or key in the staging build; a permanent "DEVELOPMENT / STAGING — NOT PRODUCTION" banner; nothing outside is contacted. The copy is built from a fixed synthetic seed (`tests/tools/staging/build-staging.js`), so rebuilding it is the demo reset.

## 4. Decisions that matter most for the rollout

1. `thresholds` — the only decision that blocks a production step (P9 nightly check). Accepting "as written" is enough.
2. `partial_returns` — decide before switching R3 on; changing it later means a new R3 version and a new fingerprint.
3. `refund_rule_n4` — until answered, refunds are records only and the Accounting/Tax pages say so.

Everything else can wait without risk.
