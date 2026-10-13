# Pre-production gaps (EXT19)

Status: **CURRENT.** What still stands between the branch and a dashboard you can trust in production, sorted by who can close it. Production readiness stays at **~15%**: no production evidence has arrived, and local engineering cannot change that.

## 1. Only production evidence can close these (owner, read-only)

| Gap | How it closes | Doc |
|---|---|---|
| Production database state unknown | Query C (read-only) | `OWNER_CHECKS_EXT11.md` |
| Production RLS and audit-log rules unknown (F1, F2) | Query G (read-only) | `AUTHORIZATION_CONTRACT_EXT18.md` |
| Tables outside the Query A export unchecked (24) | Query D (read-only) | `SCHEMA_CONTRACT_EXT19.md` |
| Integrity, drift, agents, schedules | Queries E, F, H | `PRODUCTION_READINESS_BOARD_EXT11.md` |
| Backups never verified | owner check of the backups repository (Claude has no access, by rule) | `PRODUCTION_READINESS_BOARD_EXT11.md` |

## 2. Owner decisions

- Merge the draft PRs (the latest contains all earlier ones).
- Install R1–R5 through the runbook (fingerprint `f6d9c2c8be690710eeb721041f6779d9`), only after Query C.
- F2: who may read the audit log.
- Self-hosted fonts and a host that can send `frame-ancestors` / HSTS headers.

## 3. Claude can still do (local, safe)

- Trusted Types: 84 one-off `innerHTML` locations left (converted to `h()` in waves), then report-only in staging, then enforce.
- Schema contract: also parse writes and RPC arguments.
- Peak-concurrency measurement for the storms.
- INT-3 forensics (still open, unexplained).
- Real-device testing is **not** something Claude can do (needs an iPhone / Safari / VoiceOver person).

## 4. Outside both (accountant, legal, providers)

Unchanged since EXT13: the tax treatment of COGS vs operating costs, retention rules for audit and customer data, and Shopify/Supabase provider limits.
