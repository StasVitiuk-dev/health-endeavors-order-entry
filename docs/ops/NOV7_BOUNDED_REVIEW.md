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
