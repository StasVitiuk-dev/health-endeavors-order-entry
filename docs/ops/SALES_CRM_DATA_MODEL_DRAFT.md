# Sales & Growth — CRM data-model DRAFT (design only)

Status: **PROPOSED · OWNER/LEGAL DECISION REQUIRED** · Branch work, not merged,
nothing deployed · As of 2026-10-27 · For: Stas

This is a **design document only** (Reserve IV Wave G). It models the entities
the Sales & Growth subsystem already reasons about in code, so that a future
owner-approved build has a clear, non-destructive target. **No production SQL is
written or run here, no schema is created, no customer data is touched.** The
dashboard today uses only synthetic/local data behind the default-OFF flag;
nothing in this draft changes that. Illustrative field lists are sketches for
discussion, **not runnable migrations**.

## Entities (grounded in existing engine concepts)
| Entity | What it is | Backing code today | Owner/provenance |
|--------|-----------|--------------------|------------------|
| **Prospect** | A wholesale lead (store/buyer), pre-customer | `he-sales-leads`, `he-sales-pipeline` state | Owner-entered or website inquiry (future) |
| **Retail identity** | A real customer/account (post-win) | `he-sales-retention` customers, `he-sales-concentration` accounts | Shopify/order data (future, gated) |
| **Message draft** | An unsent outreach/follow-up draft | `he-sales-ai`, `he-sales-outreach`, `he-sales-followup` | Engine draft; owner edits/sends by hand |
| **Approval** | An owner approval tied to a draft fingerprint | `he-sales-approval` | Owner only; voids on edit (B5) |
| **Source evidence** | Why a prospect/score/flag exists | `he-sales-sources`, `he-sales-audit` | Engine, append-only |
| **Suppression record** | DNC / opt-out / bounce — authoritative | `he-sales-replies` (suppresses), DNC rules | Reply signal or owner; never overridden |
| **Audit entry** | Suggestion/review/approval/simulated-outcome | `he-sales-audit` (append-only) | Engine + owner actions |
| **Incident** | A classified anomaly needing attention | `he-sales-incidents` + `he-sales-anomaly` | Engine; owner acknowledges |

## Per-entity: ownership, purpose, provenance, lifecycle (G3)
- **Prospect:** owner-owned; lifecycle = 21-state pipeline (`he-sales-pipeline`);
  provenance recorded per field; terminal states CUSTOMER/LOST/DECLINED/DNC.
- **Retail identity:** distinct from prospect; created only on a real win;
  retention segments (UNKNOWN vs INACTIVE vs LOST) must never be conflated (E1).
- **Message draft:** never auto-sent; carries a claim-scan result; an approval
  is bound to its fingerprint and voids on any material edit (B5).
- **Approval:** `{fingerprint, approvedBy, approvedAt, sent:false}`; never means
  sent; a post-approval suppression wins (B3).
- **Suppression record:** **authoritative and sticky** — an AI suggestion or a
  stale approval can never override it (B3). Applies to every proposed lifecycle
  action, including retention reorder/win-back (E4).
- **Source evidence & audit:** append-only; never rewritten (supports G4).

## Deletion / retention risk (G4)
- Deleting a **suppression record** would be unsafe: it could re-enable contact
  to someone who opted out. Suppression must be retained even if the prospect is
  deleted → model as a separate, long-lived table keyed by contact hash.
- Deleting an **audit entry** breaks explainability; audit is append-only, so
  "deletion" is out of scope — only redaction of a field value, recorded as a
  new audit entry, is contemplated.
- A prospect/customer deletion must **tombstone**, not hard-delete, anything an
  audit or suppression row references.

## Correction, supersession, conflicting sources (G5)
- Corrections are **new versioned facts**, not in-place edits; the prior value
  and its source are retained (mirrors the append-only audit discipline).
- When two sources disagree (e.g. website vs manual entry), the record keeps
  **both with provenance** and marks `OWNER DECISION REQUIRED` rather than
  silently picking one (matches the standing documentation rule).
- An approval is superseded by any material draft change (B5) and by a later
  suppression (B3).

## Stable identifiers & duplicate review (G6)
- Each entity has a stable synthetic id (`SYN-…` today). A real build needs a
  durable key independent of email (emails change): proposed = internal UUID +
  normalized-contact index for duplicate *review* (never auto-merge).
- Duplicate detection surfaces candidates for **owner review**; it never merges
  automatically (consistent with the existing duplicate-graph approach).

## Idempotency & out-of-order events (G7) — synthetic examples
- Events (reply received, draft approved, sample decided) carry an event id +
  timestamp; applying the same event twice is a **no-op** (idempotent).
- Out-of-order example: an `opt-out` dated *after* an `approval` must win even
  if it arrives first or second — suppression is resolved by **latest
  authoritative state**, not arrival order (B3). A follow-up scheduled before a
  reply that supersedes it is cancelled (already modeled in `he-sales-followup`).
- These are design assertions to be covered by tests when/if built; today they
  are illustrated with synthetic sequences only.

## Future access control (G8) — specified, NOT applied
- Proposed boundaries (for a future, owner-approved, production build):
  suppression + audit are read-mostly and write-restricted; message send is a
  separate capability that stays disabled until the owner enables it; retail
  identity/customer data is row-level-secured.
- **Not applied here.** No production RLS/policy is created or changed; this is a
  target for owner + engineering review.

## Migration & rollback posture (G9/G10)
- No migration is proposed for implementation now (no demonstrated build need).
- When built, migrations must be **additive and non-destructive** (new tables
  beside existing data), reversible (documented down-path), and must never
  drop/alter suppression or audit history.
- Rollback for *this* document: it is design-only; deleting the file removes the
  proposal with zero code/runtime effect.

## What this unlocks / what remains owner/external
- Unlocks: a shared vocabulary for prospect vs customer vs suppression vs audit,
  so later work doesn't conflate them.
- Remains owner/legal/external: whether to build a real CRM store at all; the
  production schema, RLS, and retention/deletion policy; any customer-data
  import. These are **not** Claude's to decide or execute.
