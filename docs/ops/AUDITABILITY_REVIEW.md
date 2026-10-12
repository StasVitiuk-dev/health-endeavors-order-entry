# Auditability review: who changed what, when

**Status:** CURRENT (2026-10-06, extension 3). Branch only. Supersedes nothing; extends the actor table in `OVERNIGHT_PLATFORM_REVIEW_2026-10-05.md` §(actor / timestamp table).

## Two layers of evidence

1. **Database audit trigger (strongest).** Query A confirmed an audit trigger on each of the 18 core tables, writing to an append-only `audit_log`: who (`auth.uid()`), when, old row, new row. It cannot be skipped by the page, and it also records changes made by agents and scripts. The Record Inspector shows this history.
   - Core tables: products, inventory, inventory_adjustments, inventory_lots, suppliers, purchase_orders, purchase_order_items, expenses, recalls, orders, order_items, returns, approval_requests, evidence_locker, documents, tasks, profiles, and audit_log itself (append-only).
2. **Actor columns on the row** (`updated_by`, `reviewed_by`, `changed_by`, …), sent by the page. Useful at a glance, but weaker: only as good as the page that writes them.

## Tables the dashboard writes OUTSIDE the 18 audited ones

Audit-trigger coverage of these is **unknown** until Query C runs. Version 3 adds section 10, which lists for every table whether an audit trigger exists and which who/when columns it has.

| Table | Dashboard action | Actor the page sends | When the page sends | Gap |
|---|---|---|---|---|
| system_mode | Change mode | `changed_by` ✓ | `changed_at` ✓ | — |
| agent_controls | Pause / resume agent | `updated_by` ✓ | `updated_at` ✓ | — |
| business_rules | Edit value, on/off | `updated_by` ✓ | — | no time sent (may be a DB default) |
| feature_flags | Toggle | ✗ | ✗ | **No actor or time on the normal toggle.** The Emergency switch-off sends `updated_by` / `updated_at`, but nothing shows those columns exist (X3-17) |
| legal_holds | Release | ✗ | `released_at` ✓ | who released is unknown without an audit trigger |
| adverse_event_reports | Mark reported to FDA | ✗ | `fda_reported_at` ✓ | who reported is unknown without an audit trigger |
| customer_inquiries | Severity, draft, Mark answered | ✗ | `answered_at` ✓ | who answered is unknown |
| quality_checks | Resolve | ✗ | `updated_at` | who resolved is unknown |
| service_status | Change | ✗ | `updated_at` | — |
| sop_documents | Agent-visible on/off | ✗ | ✗ | — |
| feature_requests | Add (`created_by` ✓), advance, delete, restore | partly | `updated_at` / `deleted_at` | who advanced / deleted is unknown |
| manual_attention_items | Add (`created_by` ✓), dismiss | partly | ✗ | who dismissed is unknown |
| incidents | Create (escalation) | via the QC/recall row | — | — |

## Findings

| Id | P | Class | Finding |
|---|---|---|---|
| X3-17 | P1 | QUERY C (+ SAFE NOW fallback) | **The Emergency switch-off of Shopify Order Sync writes `updated_by` / `updated_at` to `feature_flags`, but no evidence shows those columns exist** (Query A did not cover the table; the page itself only reads id, flag_key, label, description, enabled). If they don't exist, the database rejects the whole write, so the Emergency switch-off of Order Sync would always fail. Since MU-06 the page says so honestly instead of claiming success. Branch fallback: if the database answers "column not found", the switch-off is retried with only `enabled = false` (tested). Query C section 10 confirms the real columns. |
| X3-18 | P2 | QUERY C → OWNER DECISION / PRODUCTION CHANGE | Compliance actions (legal hold release, FDA reported, QC resolve, inquiry answered) record **when** but not **who** on the row. If Query C section 10 shows these tables have no audit trigger, who did it is lost. The fix is a production change you would approve: extend the existing audit trigger to these tables (preferred; it needs no page change), or add `*_by` columns. |
| X3-19 | P3 | QUERY C | The page could send actor fields on more writes, but only once Query C shows the columns exist. Sending a column that doesn't exist makes the write fail, so nothing is added blind. |

## What is NOT a gap

- Failed or refused actions leave no business change, so there is nothing to audit. The page shows them as plain errors (fault-injection matrix).
- Deletes in the core tables are captured by the audit trigger with the full old row (product delete, document delete, expense soft delete).
- Stock changes have a second, purpose-built trail: `inventory_adjustments` (who, bucket, amount, reason, lot), checked by the history invariant in every stress run.

## Extension 8: gaps ranked by risk (2026-10-07)

**What is recorded today (Query A shape):** an audit trigger on 18 core tables (products, inventory, suppliers, purchase orders and lines, lots, stock history, expenses, recalls, orders and lines, returns, approval requests, evidence, documents, tasks, profiles, audit_log) writes who / when / old row / new row. The stock history table adds a written reason per change. EXT8 adds no new write without a trail: Reopen, product and PO edits, and the supplier question all go to tables that are already audited.

| Risk | Area | Gap | Why it matters | Fix (production change = owner approval) |
|---|---|---|---|---|
| **High** | Feature flags, agent switches, Emergency / system mode | Not in the export; who flipped a switch is UNKNOWN (the page writes `updated_by` where the column exists) | Security and AI-control changes must be explainable | Extend the audit trigger (roadmap L2) after Query D confirms the tables |
| **High** | Business rules (refund limits etc.) | Same | Money rules | Same |
| **High** | Legal holds, adverse-event reports | Release / "reported to FDA" record a date, not who | Compliance evidence | Same; plus `released_by` / `reported_by` columns |
| **Medium** | Customer inquiries (reply drafts, severity) | Not audited; drafts overwrite each other only with a short window left (EXT5) | Customer-facing text, personal data | Audit trigger; later a draft version history |
| **Medium** | Quality checks, incidents | Resolution: who resolved is not recorded | Quality trail | Audit trigger + `resolved_by` |
| **Medium** | Reasons | Reopen, soft-delete and restore carry no reason | "Why was this undone?" | Optional reason field when the owner wants it (avoid noise: optional, not required) |
| **Low** | Service status, SOPs, feature requests | Not audited | Low impact | Audit trigger when convenient |
| **Low** | Read access to customer data | Logged by `log_customer_data_access` for Orders views | Already covered for the main page | Extend to Inquiries when the agent goes live |

Not recommended: logging every read or every page view (noise without decision value).
