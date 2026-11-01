# Sales/EXT20 recovery + validation record — 2026-11-01

Status: CURRENT · Local reconstruction branch `claude/ext20-recovery-2026-10-31`
on top of remote `claude/platform-ext20-adversarial-completion-2026-10-13` @
`c06c8b5` · NOT pushed/merged/deployed · `main` untouched (`d3db7bc`).

## Why this exists
A prior session's local fixes were committed but never pushed; the ephemeral
container was reclaimed, so those commits were lost (confirmed absent from
refs/reflog and the remote). This branch rebuilds them as NEW commits and
adds one newly-found fix, all verified locally. Everything synthetic; no
production access.

## Commits (new SHAs; the lost originals are unrecoverable)
1. `113b519` security(dom-sinks): review bare innerHTML/outerHTML RHS + ceiling 109→0
2. `c5dc51d` test(safety): RFC-reserved placeholder email domains + fixtures
3. `03eda31` docs(design-review): reconstruct sales-preview MANIFEST (28 PNGs)
4. `b63759c` test(numeric-contract): scan DOM-builder number inputs
5. `e6b0946` test(mutation): re-point 10 drifted page mutants
6. `37b0a9a` test(mutation): don't score infrastructure failures as CAUGHT

## Verification (this reconstruction, matched/working browser)
- **Static/Node (real):** dom-sinks gate PASS; bare `innerHTML=s.name`/`=getRaw()`
  now FAIL; safe forms stay clean. safety both scans 0 violations. numeric 23
  boxes (≥19), money set complete. screenshots-policy 0 issues. mutation
  `--check` 221/0-not-applicable.
- **Affected specs (real Playwright):** safety, numeric-contract, screenshots-policy,
  mutation-runner, 3 sales specs = **45 passed**.
- **Mutation catch (real, matched browser):** 10/10 CAUGHT for the right reason
  (3 node-only: he-format×2, supplier; 7 browser). #9 shows 1 failed / 10 passed
  (baseline-green proof). Earlier broken-browser run EXCLUDED from acceptance.
- **Runner reporting defect fixed (`37b0a9a`):** infra/launch/timeout failures no
  longer mis-scored as CAUGHT; meta-spec 5/5; real mutants still CAUGHT.

## Full integrated browser suite (reconstructed tree, this environment)
- **EXIT 1: 2439 passed, 21 failed, 370 skipped (1.4h), desktop+iphone.**
- **All 21 failures are environment-attributable, NOT reconstruction regressions**
  (git-proven: these 6 commits change only test specs/tools/config + a MANIFEST —
  zero rendered-page/CSS/app/engine code):
  - 20 × `visual.spec` (screenshot baselines) — the container can't download the
    Playwright-1.56.1-matched Chromium build 1194 (proxy blocks cdn.playwright.dev,
    403); tests ran on the pre-installed Chromium 1243/v153, whose rendering
    differs pixel-wise from the committed 1194 Linux baselines. Not updated (that
    would bake in 1243 renders / could mask real diffs).
  - 1 × `malformed-data-ext15:50` (iphone) — a timing-threshold test (page draw
    <8000ms) on a 50k-char name; 15.9s here, reproducible in isolation; browser-
    build/CPU-bound, not introduced by these commits. Threshold not loosened.
- The `test.fail()` "wanted ... needs R1-R5" atomicity tests are EXPECTED failures
  (counted as passing by Playwright); they are not in the 21 and need no production.

## Detector guarantee (exact, honest)
Scanned: `assets/owner-login-app.js` + `assets/app/*.js` (20 files). Zero-sink
enforcement (outerHTML/insertAdjacentHTML/document.write/eval/setAttribute("on*")
= 0) is dataflow-independent. innerHTML ceiling 0 (was 109; shipped usage 0) fails
the gate on ANY innerHTML assignment regardless of RHS. The added bare-RHS
classifier is a **lexical** heuristic: a deliberately reassuring name (a BUILDER-ish
var, UPPER const, or `*Html()/card()/row()` call) holding untrusted data evades the
*content* check — but in the current zero-innerHTML tree the ceiling backstop still
fails the gate on it (proven). The lexical gap only matters if the innerHTML ceiling
is later raised above 0. No claim of full JS dataflow or exhaustive sink-syntax
coverage; computed-property/alias sinks are out of scope.

## Counts (separately verified; not interchangeable)
47 Sales pages (flag-gated, OFF) · 46 engine modules (39 loaded) · 14 screenshot
preview subset.

## Not done / dependencies
- DB: no DB-relevant code changed → no new DB run warranted; historical isolated
  34/34 stands as historical only. No production Supabase / R1-R5.
- Manual/device: real Safari/iPhone + VoiceOver unverified (emulated Chromium only).
- Owner/external: push decision; prices/MOQ/MSRP; claims; Gmail/provider; publish
  (Q11/Q12); GitHub single-approver constraint. All deferred.
- The executablePath browser override used to run tests here is an uncommitted
  local diagnostic (proxy blocks the matched browser); it is NOT part of these
  commits and a normal environment needs it not at all.

## Update — failure investigation + durable safety tests (later 2026-11-01)
Two more commits (now 9 total on the branch):
- `ca20919` extract the mutation runner's run classifier into a pure module
  (`tests/mutation/classify-run.js`) + committed unit fixtures
  (`tests/specs/mutation-classify-ext.spec.js`): CAUGHT / INFRA / NOT CAUGHT /
  NO TEST RAN, incl. launch-fail, timeout, page.goto, 0-co-pass single kill,
  colour codes. Makes the infra-false-CAUGHT guard durable, not a manual replay.
- `3323d03` committed regression in `security-static-ext18`: the innerHTML
  ceiling must be 0 (guards the 109-headroom problem); a bare `el.innerHTML =
  t.title` is caught; a name-concealed `const rowsHtml = t.title; innerHTML =
  rowsHtml` evades the lexical content classifier but is still failed by the
  ceiling-0 backstop; outerHTML zero-sink unchanged; textContent not flagged.

### Visual failures (20) — evidence-based classification (NOT diff-scope-based)
Regenerated diffs on Chromium 1243 (full-run artifacts were cleared by later
Playwright runs — stated, not reconstructed as originals):
- login: same size, 2838 px (ratio 0.01) — pure rasterization/AA.
- 8 page panels: tiny ratios 0.01–0.04, differing mainly in HEIGHT by +/-5..30 px
  in MIXED directions (some taller, some shorter) = font-metric reflow between
  Chromium builds, not truncation (which would be uniformly shorter).
- Decisive ruling-out of lost content/clipping/overflow: on the SAME browser,
  every content/layout/a11y assertion spec PASSED (a11y-basics, device-matrix,
  responsive, sales-wavec-mobile: presence, visibility, no sideways scroll, tap
  targets, 200% text, contrast, focus). Those would fail if content were lost.
- Exact pinned-browser (1194) acceptance remains BLOCKED (cdn.playwright.dev 403);
  committed baselines left UNCHANGED (no refresh to erase failures).

### malformed-data-ext15:50 (1) — timing, unresolved under this environment
A 50,000-char unbroken token ('W'×50000) rendered on page nav; one gotoPage took
15.9 s (> 8 s bound), reproducible in isolation. Rendered-code path unchanged by
these commits, so it reproduces on base c06c8b5 too — preexisting + browser/CPU-
bound, not a reconstruction regression. Full engine-vs-layout decomposition
incomplete. Threshold NOT raised, data NOT truncated, test NOT skipped. Candidate
owner-reviewed perf follow-up; timing acceptance left unresolved here.

### Failure classification (your required split)
- Confirmed product defects: none demonstrated.
- Confirmed infrastructure: 20 visual (browser-version baseline mismatch; matched
  browser un-downloadable here).
- Preexisting unresolved behaviour: 1 malformed-data timing (browser/CPU-bound).
- Blocked exact-browser verification: pinned-1194 visual acceptance.
"No reconstruction regression" is narrower than "ready to launch."

## Update — performance root cause CLOSED + visual qualification (session 3)
### malformed-data-ext15:50 — root cause established (measured), no safe fix
The test navigates to tasksPanel/inventoryPanel after seeding a 50,000-char
UNBROKEN token ('W'×50000) and asserts each gotoPage < 8000ms. The failure is
**iphone-only** (390px). Measured, serial, one worker, Chromium 1243:
- iphone unbroken token, tasksPanel: ~15.6 s (reproduces the failure).
- iphone BREAKABLE string, same ~50k length ('W '×25000), tasksPanel: ~0.98 s.
- desktop (1100px) unbroken: ~0.9 s (not slow).
- inventoryPanel unbroken (iphone): ~0.5 s (not slow).
Conclusion: the cost is the browser's text layout/line-breaking of a SINGLE
unbroken 50k-char token at narrow width — not application/JS work (an equal-
length breakable string is ~16× faster) and not inventory. Attempted CSS
mitigations, both MEASURED and both ineffective (so neither kept):
- `.taskTitle{overflow-wrap:anywhere}` → token wraps (scrollWidth 294 = clientWidth,
  no overflow) but still ~14.6 s.
- `table.phoneCards{table-layout:fixed}` → ~13.7 s.
So it is an inherent browser text-engine cost for a pathological unbroken token,
amplified by this container's Chromium 1243 + CPU. **No application code defect
was demonstrated**, and the two measured CSS mitigations above were ineffective.
That is NOT proof that no safe fix exists: the two rejected mitigations are two
data points, not an exhaustive search (e.g. a CSS containment / content-visibility
approach, or capping only the RENDERED glyph run while keeping the full title in
the DOM, were not measured here and may or may not help). The obvious
title-truncation/segmentation route is rejected because it loses record identity.
Threshold left UNCHANGED (not raised/skipped/weakened); owner-login.css left
unmodified. **Acceptance of the 8 s bound remains OPEN** (not "resolved"): it was
calibrated on a matched reference environment (pinned browser, reference CPU) and
must be re-measured there — see the matching-browser commands in the acceptance
matrix (HE-FINAL-020). Root cause investigated ≠ acceptance passed.

### Visual — scope of inspection (honest qualification)
I inspected the regenerated DESKTOP diffs' quantitative evidence (per-case pixel
ratio + image dimensions) for all 10 desktop cases: ratios 0.01–0.04 and HEIGHT
deltas of ±5–30px in MIXED directions (reflow signature, not truncation). I did
NOT pixel-inspect each of the 20 actual/expected/diff images individually; the
lost-content/clipping ruling rests on (a) those ratio/size figures and (b) the
content/layout/a11y assertion specs passing on the SAME browser. That is strong
supporting evidence, not a per-image visual sign-off. Exact pinned-1194 visual
acceptance remains BLOCKED (download 403); baselines unchanged.

## FINAL RELEASE AUDIT — GitHub source, dependency map, failure ledger (2026-11-01)
Read-only GitHub inspection (no push/merge/comment/CI rerun). Account acting:
`StasVitiuk-dev` (owner token in this session); push=implied, admin not exercised.

### Refs (from actual GitHub state)
- `main` = `d3db7bc8…` (base of every open draft PR; untouched).
- Remote EXT20 branch `claude/platform-ext20-adversarial-completion-2026-10-13`
  tip = **`c06c8b53e5…`** = PR #35 head. (Committed by GitHub user `claude`, not
  by a review bot or auto-approver.)
- Local recovery branch `claude/ext20-recovery-2026-10-31` = HEAD `d3eed75`,
  built **on top of** `c06c8b5` (11 commits; `git log` confirms linear ancestry).
  Only working-tree change: the uncommitted diagnostic `executablePath` override
  in `tests/playwright.config.js` (labeled DIAGNOSTIC-ONLY; not committed).

### PR dependency map (ancestry + bodies)
- PR #35 (EXT20, draft, "do not merge") — the CURRENT review target. Its body
  states it *replaces* #34 (EXT19 → #33 → #29). mergeable_state=blocked (draft).
- PR #29 (EXT14, draft, "do not merge") — body: its branch starts from #28's
  `cc9a142`; #29 carries #28 + EXT14. Superseded by the #34→#35 chain per #35's
  body, but still open. mergeable_state=blocked (draft).
- PRs #25–#34 are the draft "DO NOT MERGE" successor chain; #16–#24 are
  tests/docs-only. **Net: #35 is the one to review; #29 is an ancestor it
  supersedes.** None is mergeable without Stas (all draft; protect-main needs his
  code-owner approval). No resolution CONFLICT found in ancestry (linear chain).

### PR #35 remote CI — the "two displayed failures" reconciled (KEY)
PR #35 shows two red check rows on head `c06c8b5`: workflow run `40433231842`
(event=push) and `40433239016` (event=pull_request) — the **same** workflow fired
by both triggers. Job breakdown of the pull_request run:
- `Static, SQL safety, docs, tools` → **failure** at step 17 "Node-only specs".
- `Browser suite (shard …)`, `Local database suite`, `Screenshots (informational)`
  → **skipped** (they `need` the static job, which failed first).

The static job's failing step log (verbatim): **1 failed, 280 passed** —
```
screenshots-policy-ext14.spec.js:26 › every package manifest lists exactly its files
Error: ENOENT: no such file or directory, open '…/design-review/sales-preview-2026-10-27/MANIFEST.md'
```
So the "two failures" are **two check-run rows for one root cause** (one missing
file), not two distinct defects. That root cause is **exactly** what local
reconstruction commit `03eda31` repairs (the regenerated 28-PNG MANIFEST, present
locally at `design-review/sales-preview-2026-10-27/MANIFEST.md`). A future push of
the recovery branch onto this head makes that remote check go green. This is the
same source as the local reconstruction (local base == PR #35 head).

### CI workflow consequence (read-only; PROPOSAL only, no push)
`.github/workflows/ci.yml` is **tests-only**: `permissions: contents: read`, no
secrets, no deploy/Pages step, never checks out another repo, mock blocks all
outbound. Triggers: `pull_request→main`, `push→claude/**`, `workflow_dispatch`.
The `visual` job is `continue-on-error: true` (screenshots never block). **So
pushing the recovery branch would (a) re-run tests only — no deploy, no production
touch — and (b) turn PR #35's red static check green.** Pushing remains an OWNER
decision (not done here). Pages settings and branch-protection internals are not
readable without admin and stay explicitly UNVERIFIED here; CLAUDE.md records the
`protect-main` ruleset (1 code-owner approval, no self-approval, admin-only bypass).

### Full-suite failure ledger (21 failures; kept visible, none closed by fiat)
Source run: reconstructed tree `d3eed75` region, this container, Chromium 1243 via
the diagnostic override (NOT the pinned 1194). "2439 passed, 21 failed, 370 skipped."
| # | case | project | category | evidence | closes when |
|---|---|---|---|---|---|
| 1–20 | `visual.spec` screenshot baselines | desktop+iphone | INFRA (browser-build baseline mismatch) | ratios 0.01–0.04, mixed ±5–30px height reflow; all content/a11y specs pass on same browser | re-run on pinned Chromium 1194 (download 403 here) |
| 21 | `malformed-data-ext15:50` 50k token nav <8000ms | iphone | preexisting timing, browser/CPU-bound | 15.9s; breakable 50k = 0.98s; desktop = 0.9s; reproduces on base c06c8b5 | re-measure on reference env, or a MEASURED safe fix; acceptance OPEN |
These 21 stay in the ledger until re-measured on a matched environment or a person
explicitly accepts/defers them. "No reconstruction regression" ≠ "ready to launch":
git proves the 11 commits touch only test specs/tools/config + one MANIFEST — zero
rendered-page/CSS/app/engine code — so none of the 21 is a reconstruction regression.

### Acceptance still OPEN (not resolved here)
1. Pinned-browser (1194) visual acceptance — download blocked (cdn.playwright.dev 403).
2. Timing 8s bound on the 50k unbroken-token fixture — re-measure on reference env.
3. Real Safari / real iPhone / VoiceOver — emulated Chromium only.
4. All owner/legal/external items (push, prices/MOQ/MSRP, claims, photos, provider,
   publish). These are genuine decisions, not engineering gaps.

## Current-revision integrated run (2026-11-01, HEAD 01d4170 region)
First full integrated suite on the CURRENT reconstructed tree (the earlier
2439/21/370 predated the added specs + the forced-colors fix). Config: this
container, Chromium "Chrome for Testing 153" (build ~1243) via the uncommitted
diagnostic executablePath override — NOT pinned-1194 acceptance. One invocation,
`npx playwright test` (default config, 2 workers), fullyParallel, retries 0,
trace retain-on-failure. Real process exit captured via a watcher (the detached
launcher's exit 0 was NOT the suite result).

- **2452 passed, 24 failed, 370 skipped (1.3h)** — totals 2846 selected. (The
  `test.fail()` "wanted … needs R1–R5" atomicity markers and po-receive:216
  show as ✘ in the list reporter but are EXPECTED failures, counted in passed,
  not in the 24.)
- **24 failed = 20 visual + 1 malformed-data-ext15:50 timing (iphone)** — the
  known diagnostic set — **+ 3 new**, all fixed this session:
  - generated-determinism-ext20:66, write-path-inventory:81, write-path-inventory:89
  - Root cause: stale committed write-path manifests (JSON + inventory MD), a
    `showDashboardFor→auth.signOut` path the committed files omitted. PROVEN
    PREEXISTING on base c06c8b5 (owner-login-app.js + specs byte-identical). Fixed
    by the sanctioned regeneration (`write-paths.js --md --json --inventory-md`,
    deterministic); 16/16 + generated-determinism now pass (commit 01d4170).
- **Net after the fix: 21 known-diagnostic failures, 0 reconstruction regressions.**
  Not rerun whole-suite for a 3-file generated-doc fix (targeted revalidation only).
- +13 passed vs the earlier run = the added specs (forced-colors 7, mutation-classify
  8, security regression, numeric-contract builder scan) discovered and executed.
- Still OPEN/BLOCKED (unchanged): pinned-1194 visual pixels; 50k-token 8s timing;
  real device/AT. Diagnostic-browser evidence ≠ pinned-browser or physical-device.
