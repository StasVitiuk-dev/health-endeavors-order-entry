# EXT20J — final report (Trusted Types cascade + Reserve IV safe-local exhaustion)

Status: **CURRENT** (2026-10-18). Local feature-branch engineering only. No production, no merge, no deploy, no secrets, no Real Estate, no backups. This report closes the EXT20J Reserve IV program after the safe-local queue reached genuine exhaustion.

## Identity (report fields 1–11)
1. Branch: `claude/platform-ext20-adversarial-completion-2026-10-13`
2. Starting SHA (this session): `95ccdd3`
3. Final SHA: `6f9d0f9`
4. Origin: in sync (`origin/…` == HEAD)
5. main: `d3db7bc` — **not touched, not merged**
6. Start executable: owner-login.html pre-cascade (dynamic innerHTML sinks present)
7. Final tested executable: owner-login.html `sha256 8f5bdd7317f6dce4…`
8. Commits this session: **13**
9. Commit list: `c981cde` Home business-health tiles · `44e2aef` activity feed + change-detail · `bce094f` activity people strip · `e5db8c8` record inspector · `115f6cf` order lookup · `5a03889` Guide body · `6034216` command palette · `621c767` calendar · `493f7b6` TT inventory doc · `6d0480b` two test-guard updates · `<checkpoint>` Reserve IV classification doc · `<guards>` full-suite guard fixes · `6f9d0f9` TT ceiling 56→4
10. Clean tree: yes
11. Pushed: yes

## Safety (12–21)
Production touched: **no**. Production SQL run: **no**. Query D2: **NOT RUN** (interpreter kept read-only). Customer data: untouched. Secrets: none accessed or committed (secret-scan clean). Real Estate: untouched. Backups: untouched. main: untouched. Merge: no. Deploy: no.

## Trusted Types (22–30) — the headline
- Screens hardened at session start: Inventory, Returns, Approvals, Agents, Security Center, Home (partial), Purchase Orders (from prior EXT20 work).
- **New screens hardened this session:** Home business-health tiles, Employee Activity (feed + people strip + change-detail), Record Inspector, order lookup, Guide body, command palette, Calendar (all views), plus the QC/Recalls/AI/Continuity/Daily-Summary/Flags/Business-Rules/System-Mode/Accounting/Tax/Inventory-Adjustments screens committed in the same cascade.
- **Total: every dynamic screen of the dashboard.**
- Start sink count: dozens of dynamic `innerHTML` interpolations (reviewed allowlist ~52 at EXT20 start).
- **Final sink count: 0 dynamic sinks** — DOM sink gate reports 0 reviewed interpolations, 0 dangerous; the `dom-sinks-reviewed.json` allowlist is empty.
- Dynamic risky sinks: 0. Reviewed exceptions: 0.
- **Enforcement simulation:** report-only `require-trusted-types-for 'script'` across every page now yields **4 violations, down from 56** — and all 4 are static-literal overlay scaffolds (Guide, command palette, keyboard shortcuts, quick-add) that carry no dynamic data. Ceiling lowered 56 → 4 and locked.
- Remaining blockers to full enforcement: (a) convert the 4 static scaffolds (deferred — the move-guard cannot waive a non-declaration statement rewrite without a shared text fragment, and these carry zero XSS risk); (b) install a Trusted Types policy / `require-trusted-types-for` header (owner/deploy concern). Both documented.

## Fresh defects found this session (bugs section 127–137)
1. **Calendar colours never apply** (pre-existing, cosmetic): `owner-login.css` ~1030–1031 carry leftover template-literal text from the EXT15 inline-style→class conversion, so the per-calendar `u-bg-colorforcalendar-*` swatch/bar/dot rules are invalid CSS and dropped. `colorForCalendar()` is exported but unused. **Flagged for owner (visual change needing screenshot review), not fixed.**
2. **Stale write-path artifacts** (my regen bug): the combined `write-paths.js --md --json --inventory-md` only regenerated the inventory because the tool dispatches with `else if`. Fixed by running the three generators separately; MATRIX.md + JSON regenerated (105 paths, retry-class totals unchanged).
3. Test-maintenance debt exposed by the first broad suite in a while (all fixed): `assets.spec` helper-count (41→40 after esc dropped), `ci-traps` inline-style trap (he-tasks no longer has `class="`), `state-machine` data-next scan (h() attr form), 3 visual baselines (the "· oldest X ago" age suffix / h() whitespace), and the `xss-everywhere` control (re-pointed from the retired esc() defence to the current h() defence).

No new product correctness, authorization, data-integrity, race, or performance bugs were found; the h() conversions preserved classes, data-* hooks, event delegation, write/role guards and accessibility throughout (verified per-screen and by the broad suite).

## Validation (138–158)
- Targeted per-screen specs: pass for every converted screen (owner-control-center, missing-totals, activity-page, search-palette, ui-chrome, capped-reads, a11y-ext8, calendar-owner, local-dates, modules-ext15, purchase-orders/po-receive, compliance/QC, etc.).
- Gates: DOM sink gate PASS (0/0); static-security, regex, styles, status, docs, schema-contract PASS; type gate 0 gated; move-guard OK (every converted symbol registered); module map + write-path artifacts regenerated.
- **Broad suite (Program 237, one run, sharded 1/4–4/4):** shard 1 610 passed, shard 2 593 passed, shard 3 532 passed, shard 4 381 passed. Initial failures (2 in shard 1, 5 in shard 3, 3 in shard 4) were all stale test expectations / stale generated artifacts from the cascade — every one fixed and re-verified green. Net: **the dashboard test suite is green on `6f9d0f9`.** First-pass after fixes. Skips are the usual cross-project (desktop-only vs iphone-only) and node-only skips.
- security:quick PASS. secret scan: clean.

## Readiness deltas (183–197, engineering view only)
- Trusted Types readiness: **dynamic sinks 100% converted** (0 remain); strict enforcement gated only on the 4 static scaffolds + a policy header.
- Maintainability / test infrastructure: improved — the sink ratchet floor is now 0, the TT ceiling is 4, and the broad suite is green and honest (false-green guards intact).
- Everything else (security engineering, authorization, data integrity, operator safety, a11y, responsive, release engineering) is unchanged from EXT20 — this session was client-render hardening, not behavioural change.
- Production readiness and real-device verification: unchanged and still owner/device-gated.

## What genuinely remains (175–182, 248 classification — see EXT20J_RESERVE_IV_CHECKPOINT.md)
- **Safe local:** essentially exhausted. The only further local TT step (convert the 4 static scaffolds) is blocked by the move-guard mechanics and carries no security value without a policy header; deferred with reason.
- **Owner read-only production:** Query D2 (interpreter + card ready, NOT run) — the single best next owner action.
- **Owner decisions:** approval separation, aunt role, final-owner lockout policy (models/cards prepared, no choice made).
- **Owner production changes:** FIX 3, F1, R1–R5 (packages + rollback tooling ready, not applied).
- **Real devices:** Safari / Firefox / phone / VoiceOver-NVDA-TalkBack / aunt-account (test contracts ready).
- **Merge / deploy:** owner only; PR review package prepared.

## Single best owner next action (field 204)
Run **Query D2** (read-only) in the Health Endeavors Supabase SQL editor using the prepared card, then paste the result for the interpreter to classify. It is the one remaining production-verification step that unblocks the security-posture evidence chain, and it changes nothing.

## Final judgment (205–221)
- Biggest gain: the dashboard is now **Trusted-Types-render-ready end to end** — no dynamic data path reaches `innerHTML`; XSS safety rests on the `h()` DOM builder (proved by the re-pointed xss-everywhere control), not on escaping discipline.
- Most serious bug found: the calendar-colour CSS defect (cosmetic, pre-existing) — flagged for owner.
- Raw sink reduction: dynamic reviewed interpolations ~52 → 0; report-only TT violations 56 → 4.
- Substantial unresolved **local** risks: none open (the 4 static scaffolds are a documented, zero-data residual).
- Another major local autonomous program justified? **No** — the safe-local queue is genuinely exhausted; the meaningful remaining work requires the owner (read-only production query, policy decisions, production changes) or real devices.
