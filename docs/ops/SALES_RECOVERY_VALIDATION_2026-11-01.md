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
amplified by this container's Chromium 1243 + CPU. The only ways to cut it would
truncate/segment the DISPLAYED title (losing identity) — explicitly out of scope.
**No application code defect; no justified safe fix.** Threshold left UNCHANGED
(not raised/skipped/weakened). Acceptance of the 8 s bound is UNRESOLVED in this
environment; a matched reference environment (pinned browser, reference CPU) is
where the bound was calibrated and should be re-measured. owner-login.css left
unmodified.

### Visual — scope of inspection (honest qualification)
I inspected the regenerated DESKTOP diffs' quantitative evidence (per-case pixel
ratio + image dimensions) for all 10 desktop cases: ratios 0.01–0.04 and HEIGHT
deltas of ±5–30px in MIXED directions (reflow signature, not truncation). I did
NOT pixel-inspect each of the 20 actual/expected/diff images individually; the
lost-content/clipping ruling rests on (a) those ratio/size figures and (b) the
content/layout/a11y assertion specs passing on the SAME browser. That is strong
supporting evidence, not a per-image visual sign-off. Exact pinned-1194 visual
acceptance remains BLOCKED (download 403); baselines unchanged.
