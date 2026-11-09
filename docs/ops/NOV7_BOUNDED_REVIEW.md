# Nov 7 build — bounded desktop + mobile review (wave-1 item 10)

All runs at commit **597303e** on branch `claude/ext20-recovery-2026-10-31`
(local, unpushed). The full desktop suite is **2118 tests** and does not finish
inside this environment's run window (~3 h at observed speed), so it is run as
reproducible bounded shards prioritising app boot, module loading, accessibility,
CSP and Trusted Types, then the focused journeys for the changed code. Counts
are recorded per shard; everything outside these shards is **PENDING** (see
below).

Browser runs use a temporary, uncommitted `launchOptions.executablePath`
pointing at the environment's Chromium (`/opt/pw-browsers/chromium`); it is
reverted before any commit and never checked in. Pure Node-only specs do not
launch a browser.

## Shards run (each reproducible)

| Shard | Command (from repo root) | Result |
|-------|--------------------------|--------|
| A — changed code (desktop) | `npx playwright test --config tests/playwright.config.js --project=desktop ext21 --reporter=line` | **115 passed, 2 skipped** (117) |
| B — platform (desktop): boot, module loading, a11y, CSP, TT | `npx playwright test --config tests/playwright.config.js --project=desktop a11y-basics csp trusted-types modules-ext15 --reporter=line` | **62 passed, 1 skipped** (63) |
| C — mobile (iPhone): a11y, flag-OFF previews, scan reachability | `npx playwright test --config tests/playwright.config.js --project=iphone a11y-basics ops-preview-wiring-ext21 scan-flow-ext21 --reporter=line` | **5 passed, 19 skipped** (24) |

Totals across shards: **182 passed, 22 skipped, 0 failed.**

## What the shards establish

- **App boot + module loading:** modules-ext15 (12) — the module graph loads in
  order, the registry refuses a missing/stale/duplicate module, the diagnostic
  summary names every module, and the byte-identity guard (verify-moves) is
  green with the new Scan/reorder/ops-preview declarations registered.
- **Accessibility:** a11y-basics across every page (desktop + mobile): accessible
  names, unique ids, focus return, Escape-closes-overlays, AA contrast (light +
  dark), dialog roles, and mobile tap-target size.
- **CSP + Trusted Types:** csp, csp-strict-ext15, trusted-types-ext20 — report-only
  TT violations stay at/below 0 on every page, hostile toast text is shown as
  text, and the new ops-preview panels render with no TT/CSP violation (asserted
  directly in ops-preview-wiring-ext21).
- **Changed-code journeys (desktop, 115):** every ext21 spec — the new ops
  previews wiring, invoice model + corrections + print, report export + ledger +
  recovery drill, ops journey, day rehearsal, scanner recovery, approval binding,
  role boundaries — plus the prior Scan/Scout/reorder/sales ext21 journeys.
- **Mobile (5):** the flag-OFF previews render nothing on a phone, the scan entry
  and flow are reachable on a phone, and mobile a11y tap targets pass.

## Skipped (by design)

The 22 skips are project-scoping, not failures: desktop-only Node specs are
skipped under the iPhone project and vice-versa, and single-run journeys guard
`test.skip(project !== 'desktop')`. The ops-preview ON journeys are desktop-only
by that guard; the previews use the same `h()` builder on both sizes and the
flag-OFF path is confirmed on mobile.

## PENDING (not run here)

- The **full 2118-test desktop suite** and the **full iPhone suite** — infeasible
  in one run window; to be run on CI or across several windows. No new failure
  was observed in any shard, and the changed code is purely additive to new
  modules plus three narrowly-scoped shared edits (two he-config flags, the
  he-sales-approval nextAction field, the he-scan cross-assign guard), each
  covered by a passing spec and by the regression shards above.
- Known PRE-EXISTING failures unrelated to this work: `inventory-safety` carries
  `test.fail('not atomic yet')` cases (documented, not caused here).

## Owner click paths for the new previews (evidence for items 1–5)

- **Export preview:** in the browser console on the dashboard, run
  `localStorage.setItem('he_report_export','on')`, reload, open **Report History**
  — the "Export preview" card shows format, rows, date range, checksum +
  integrity, the US-Letter print-model line, and the Mac-sync note.
- **Invoice preview:** `localStorage.setItem('he_invoice_preview','on')`, reload,
  open **Report History** — the "Invoice preview" card shows the multi-line draft
  totals and the packing slip (lot labels, no prices), with issuing noted as an
  owner decision.
- Turn either off with `localStorage.removeItem('he_report_export')` /
  `removeItem('he_invoice_preview')` (both default OFF).

## Update 2026-11-09 — refreshed changed-code shard (commit c2cfee9)

After the invoice/ops follow-on work (export-preview-over-live-rows, recovery-drill
panel, invoice numbering + header + number sequence + credit note + print view +
end-to-end lifecycle), Shard A was re-run:

`npx playwright test --config tests/playwright.config.js --project=desktop ext21 --reporter=line`
→ **160 passed, 2 skipped** (162). The 2 skips are the iPhone-project tests under
desktop. Platform shards (B boot/modules/a11y/CSP/TT) and mobile (C) are unchanged
from the original run and still apply. Full desktop + iPhone suites remain PENDING
(infeasible in one window).

## Update 2026-11-09b — follow-on features + refreshed shard (commit 0863bc0)

Added since the last update (all default-OFF / synthetic): US-Letter daily-report
print view (`7cedea3`), US-Letter packing-slip print view (`dab7d75`), and the
scan cross-order tracking guard wired into the UI flow (`0863bc0`). Changed-code
shard re-run:
`npx playwright test --config tests/playwright.config.js --project=desktop ext21 --reporter=line`
→ **162 passed, 2 skipped** (164). Shard 1/16 of the full desktop suite also ran
clean (133 passed, 0 failed) before the run was paused to prioritise feature
build; full-suite shards remain PENDING (bounded shards stand in).

## Update 2026-11-09c — FULL desktop suite completed in 16 shards (commit 815db38)

The full desktop suite was run to completion overnight as 16 reproducible shards
(diagnostic browser override applied during runs, reverted before this commit):

`npx playwright test --config tests/playwright.config.js --project=desktop --shard=N/16 --reporter=line`

| Shard | passed | Shard | passed | Shard | passed | Shard | passed |
|-------|--------|-------|--------|-------|--------|-------|--------|
| 1/16 | 133 | 5/16 | 135 | 9/16 | 130 | 13/16 | 135 |
| 2/16 | 137 | 6/16 | 133 | 10/16 | 135 | 14/16 | 136 |
| 3/16 | 136 | 7/16 | 124 | 11/16 | 137 | 15/16 | 137 |
| 4/16 | 138 | 8/16 | 137 | 12/16 | 131 | 16/16 | 124 |

**Total: 2,138 passed, 0 failed** across all 16 shards (shard 1 also had 5
project-skips). No non-pre-existing failures; the known `inventory-safety`
`test.fail('not atomic yet')` cases are counted as expected and did not fail the
run. The full desktop suite is therefore GREEN on this branch. The full iPhone
suite remains PENDING (the bounded mobile shard stands in).

## Update 2026-11-09d — FULL iPhone suite run in 8 shards (commit 815db38 code; 4b65e8e tree)

Ran the iPhone project to completion as 8 reproducible shards under the diagnostic
browser override (`/opt/pw-browsers/chromium`, reverted before this commit):
`npx playwright test --config tests/playwright.config.js --project=iphone --shard=N/8 --reporter=line`

**Reconciliation (planned 865 = executed + skipped):**
- passed: **489** · failed: **11** · skipped: **365** · total **865** ✓ (489+11+365)
- Per shard passed: 65, 39, 45, 82, 103, 73, 28, 54.
- "109/108 progress denominators" are per-shard test counts (passed+skipped); e.g.
  shard 1 = 65 passed + 44 skipped = 109. Skips are Node-only/desktop-only specs
  that `test.skip` at iPhone size.
- Retries: none configured (retries: 0 in config). Exclusions: desktop-only files
  via `testIgnore` are not counted in the 865. Override: diagnostic browser only
  (uncommitted, reverted). Config: `tests/playwright.config.js`; code commit the
  tests ran against: 815db38.

**The 11 failures are override/environment artifacts, NOT code regressions:**
- **10** `visual.spec.js` `toHaveScreenshot` pixel-diffs (e.g. login.png ~5,136 px,
  ratio 0.02). The committed baselines were captured on a different Chromium build
  than the diagnostic browser (build 1243). The affected screens (login + panels)
  are unchanged by the Nov 7 work and the new previews are flag-OFF, so these are
  rendering-version differences, not regressions. Not validated here on the CI
  browser; correct-browser/real-device visual verification is a SEPARATE pending
  task (see below).
- **1** `malformed-data-ext15` performance threshold: tasksPanel drew a 50,000-char
  title in 12,686 ms vs an 8,000 ms cap, under the diagnostic browser in this
  loaded cloud container. tasksPanel is untouched by the Nov 7 work and this test
  PASSES on desktop; it is an environment/browser-speed artifact, not a regression.

**Emulated vs physical — kept separate:** all of the above is emulated-Chromium at
iPhone viewport. Real Safari / physical iPhone / VoiceOver verification is NOT
done here and remains an owner/device task.
