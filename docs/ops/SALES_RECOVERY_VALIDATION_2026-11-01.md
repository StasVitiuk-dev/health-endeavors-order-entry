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
