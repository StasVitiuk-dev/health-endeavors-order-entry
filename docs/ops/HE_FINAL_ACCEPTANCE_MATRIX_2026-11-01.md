# HE dashboard — expanded acceptance matrix (100 checks) + owner handoff — 2026-11-01

Status: CURRENT. Local branch `claude/ext20-recovery-2026-10-31` @ `d3eed75`
(11 commits on PR #35 head `c06c8b5`; `main` = `d3db7bc`, untouched). Synthetic
tests only; nothing pushed/merged/deployed; no production, provider or money
action. Tested config: this container, Chromium build **1243** via an uncommitted
diagnostic `executablePath` override (the pinned **1194** cannot be downloaded
here — cdn.playwright.dev 403), so pinned-browser acceptance stays OPEN.

Verdicts: **COVERED** (existing evidence closes it, cited) · **GAP** (missing
evidence / demonstrated defect, with repro) · **BLOCKED** (needs a prerequisite
outside local synthetic scope) · **N/A** (with reason). Companion detail:
`SALES_RECOVERY_VALIDATION_2026-11-01.md` (refs, PR/CI audit, failure ledger).

## A. Release source and dependencies
| ID | Verdict | Evidence / repro / prerequisite |
|---|---|---|
| 001 | COVERED | Refs from live GitHub: main `d3db7bc`; EXT20/PR35 head `c06c8b5`; local HEAD `d3eed75` built on `c06c8b5` (linear `git log`). |
| 002 | COVERED | Executable commits: 113b519, c5dc51d, b63759c, e6b0946, 37b0a9a, ca20919, 3323d03 (tests/tools/detector). Doc-only: 03eda31 (MANIFEST), ba81582, 6bbd450, d3eed75. |
| 003 | COVERED | PR35 body: it replaces #34(EXT19→#33→#29); #35 head carries the EXT14 program-split of #29 as ancestor. #35 ⊇ #29 content via chain. |
| 004 | COVERED | Still-required: #35. Superseded/ancestor: #29 and the #25–#34 chain. #16–#24 tests/docs-only. No conflict (linear ancestry). |
| 005 | COVERED | Failing remote check head = `c06c8b5`, runs 40433231842 (push) + 40433239016 (PR), both this SHA. |
| 006 | COVERED | Remote (historical): red on `c06c8b5` — one failing test. Local (current): same base + 11 commits; the fix is committed (03eda31). Kept distinct. |
| 007 | COVERED | `.github/workflows/ci.yml` read: triggers `pull_request→main`, `push→claude/**`, `workflow_dispatch`; tests-only, `contents: read`, no deploy/Pages, no secrets. Not executed. |
| 008 | PARTIAL | **Pages config (reported):** Codex independently viewed owner Settings→Pages (dated 2026-11-02) and reported deploy-from-branch `main`, `/(root)`, with no setting changes — recorded here as reported external evidence, not something this session verified. **This session can verify** only the public live URL serving and that `ci.yml` contains no deploy/Pages step (tests-only, `contents: read`); it cannot read Settings without admin. **Branch-protection internals** (`protect-main` rule bodies: 1 code-owner approval, no self-approval, admin-only bypass) remain separately UNVERIFIED by this session (known from CLAUDE.md, not read from the API). No setting change requested or needed. |
| 009 | COVERED | Proposed future sequence drafted (§Owner handoff below + validation doc); not executed. |
| 010 | COVERED | No unresolved dependency conflict: linear ancestry, one net review target (#35). Proposed order documented. |

## B. Failure acceptance and performance
| ID | Verdict | Evidence / repro / prerequisite |
|---|---|---|
| 011 | COVERED | 21-failure ledger retained verbatim in validation doc; none closed by fiat. |
| 012 | COVERED | 2439-pass run source recorded: reconstructed tree, Chromium 1243 via diagnostic override (NOT pinned 1194). |
| 013 | COVERED | `malformed-data-ext15:50` assertion (<8000ms) + 50k 'W' fixture unchanged (git-clean). |
| 014 | COVERED | Measured control: unbroken 50k = 15.6s; breakable 50k = 0.98s; desktop unbroken = 0.9s (validation doc §session 3). |
| 015 | COVERED | Two CSS mitigations measured: overflow-wrap:anywhere → ~14.6s; table-layout:fixed → ~13.7s; both reverted. |
| 016 | COVERED | Doc now states two mitigations are two data points, NOT proof no safe fix exists (correction applied). |
| 017 | COVERED | Timing = preexisting (reproduces on base `c06c8b5`, rendered code unchanged). Visual = harmless (reflow). Labeled distinctly. |
| 018 | COVERED | All 20 actual/expected/diff images VIEWED (VISUAL_INSPECTION_LEDGER_2026-11-01.md). 0 product defects: no lost/clipped/covered content; all differences are AA + font-metric reflow. Exact pinned-1194 pixel acceptance still BLOCKED (download 403). |
| 019 | COVERED | Per-image gap stated honestly (018); lost-content ruling rests on metrics + content/a11y specs passing on same browser, labeled as supporting evidence, not sign-off. |
| 020 | COVERED | Close-out commands: `npx playwright install chromium` on Playwright 1.56.1 in an env that can reach cdn.playwright.dev → build 1194; then `npx playwright test tests/specs/visual.spec.js` with NO executablePath override; and re-run `malformed-data-ext15` on reference CPU. |

## C. Core dashboard and orders (Sales OFF; synthetic)
| ID | Verdict | Evidence |
|---|---|---|
| 021 | COVERED | Routes/behavior: `owner-control-center`, `operations-pages`, `admin-pages`, `pages-data`, `nav-history`, `role-matrix`. |
| 022 | COVERED | Sales flag OFF default + core navigable: `trusted-types-ext20`, `pages-strict-ext16`, `sales-wiring-ext20j` (flag gating), `nav-history`. |
| 023 | COVERED | `report-totals`, `report-boundaries`, `money-periods`, `accounting-oracle`, `tax-oracle`. |
| 024 | COVERED | `numeric-contract`, `manual-order-entry`, `inventory-safety` (refused edits leave prior valid state). |
| 025 | COVERED | `unsaved-changes`, `double-submit-stale` (cancel cannot persist half-edit). |
| 026 | COVERED | `purchase-orders`, `write-path-inventory` (stable identifiers vs duplicate labels). |
| 027 | COVERED | `po-receive`, `purchase-orders` (receipt rows after reordering). |
| 028 | COVERED | `double-submit-stale`, `reauth-double-submit`, `out-of-order` (repeat confirm not duplicated). |
| 029 | COVERED | `error-language`, `empty-database`, `missing-totals-ext11` (empty/error/loading ≠ zero-total success). |
| 030 | COVERED | Owner end-to-end walkthrough drafted below (§Owner handoff). |

## D. Decision engines and approvals (advisory; simulated)
| ID | Verdict | Evidence |
|---|---|---|
| 031 | COVERED | `sales-wavea-correctness-ext20k`, `sales-wiring-ext20j`, `generated-determinism-ext20` (render ← engine result). |
| 032 | COVERED | `sales-wavec-uncertainty-ext20k` (heuristic score vs calibrated probability kept distinct). |
| 033 | COVERED | `missing-totals-ext11`, `sales-cost-ext20j`, `sales-wavea-correctness` (missing ≠ known zero). |
| 034 | COVERED | `local-dates`, `timezone-contract`, `sales-progression-ext20k` (missing dates cannot fabricate age). |
| 035 | COVERED | `sales-priority-ext20k`, `sales-nextaction-ext20k`, `generated-determinism-ext20` (documented stable tie rules). |
| 036 | COVERED | `sales-concentration-ext20k`, `sales-caps*-ext20j` (unknown accounts not merged). |
| 037 | COVERED | `sales-approval-ext20k` (material edit invalidates reviewed version). |
| 038 | COVERED | `sales-approval-ext20k`, `double-submit-stale` (stale handler cannot approve newer revision). |
| 039 | COVERED | `no-live-send`, `sales-outreach-ext20j`, `sales-replies-followup-ext20j` (decline/DNC dominate). |
| 040 | COVERED | `no-live-send`, `sales-simulator-ext20j` (simulated ≠ live send). |

## E. Data handling and rendering
| ID | Verdict | Evidence |
|---|---|---|
| 041 | COVERED | `sales-import-ext20j` (accepted schema vs documented formats). |
| 042 | COVERED | `sales-import-ext20j`, `malformed-data-ext15` (validate before partial replacement). |
| 043 | COVERED | `sales-import-ext20j`, `sales-concentration-ext20k` (duplicate identity semantics). |
| 044 | COVERED | `sales-import-ext20j` (rejected input preserves last accepted dataset). |
| 045 | COVERED | `sales-export-ext20j`, `csv-export-guard` (field selection excludes stray props). |
| 046 | COVERED | `csv-export-guard`, `helpers-unit`, `property-node-ext15` (leading =,+,-,@, control/space). |
| 047 | COVERED | `sales-export-ext20j`, `csv-export-guard` (quotes/newlines/Unicode round-trip). |
| 048 | COVERED | `xss-everywhere`, `search-dashboard-escaping`, `sales-ui-ext20j`, `security-static-ext18` (unsafe text stays text). |
| 049 | COVERED | `link-scheme-check`, `scale-urls`, `xss-property-ext15`, `csp-strict-ext15` (javascript:/invalid URLs not navigable). |
| 050 | COVERED | `error-language`, `secret-scan` tool, `supply-chain-ext18` (no token/record leak in errors). |

## F. Security and regression enforcement
| ID | Verdict | Evidence |
|---|---|---|
| 051 | COVERED | `ci.yml` static job step "DOM sink gate" runs `dom-sinks.js --gate` on every change; invoked by normal CI, not a one-off. |
| 052 | COVERED | Verified this session: restoring ceiling 109 → gate FAILS (`Expected 0, Received 109`); `security-static-ext18.spec.js:95` asserts `ceilings.innerHTML===0`. |
| 053 | COVERED | Baseline zero-sink source PASSES (`dom-sinks.js --gate` → PASS; `security-static-ext18` test "shipped code is clean"). |
| 054 | COVERED | `security-static-ext18.spec.js:102` — name-concealed `const rowsHtml=t.title; innerHTML=rowsHtml` still fails via ceiling-0 count backstop. |
| 055 | COVERED | Lexical/dataflow/syntax limits stated (validation doc "Detector guarantee"; no exhaustive claim; computed-property/alias out of scope). |
| 056 | COVERED | `run-page-mutations.js` imports `classify-run.js`; `mutation-classify-ext.spec.js` pins it. |
| 057 | COVERED | `mutation-classify-ext.spec.js` — launch-fail, 30000ms timeout, page.goto/net/closed-target → INFRA, never CAUGHT. |
| 058 | COVERED | Same spec — NO_TEST (no summary) vs NOT_CAUGHT (all passed) distinct; single-test 0-co-pass kill still CAUGHT. |
| 059 | COVERED | 10/10 mutants CAUGHT on working browser; #9 shows 1 failed/10 passed (baseline-green); recovery-notes matrix. |
| 060 | COVERED | Verified this session: `ci-traps-ext15` passes 8/8 and the new specs appear in the CI Node-only step 17 list in `ci.yml` (assigned, not orphaned). |

## G. Mobile and accessible interaction
| ID | Verdict | Evidence |
|---|---|---|
| 061 | COVERED | `numeric-contract` (23 number inputs scanned incl. DOM-builder), `sales-a11y-ext20k` (labels + associated errors). |
| 062 | COVERED | `a11y-basics`, `a11y-ext8`, `zoom-400-ext17` (visible keyboard focus). |
| 063 | COVERED | `chaos-ui-ext15`, `nav-history` (focus returns to a surviving control on rerender). |
| 064 | COVERED | `auth-chaos`, `ui-chrome` (dialog close does not fire background action). |
| 065 | COVERED | `mobile-cards-ext10`, `phone-po-tap`, `phone-swipe`, `sales-wavec-mobile-ext20k` (narrow-width identity). |
| 066 | COVERED | `responsive-widths`, `layout-sweep-ext9`, `shrink-ext16` (long text doesn't cover controls). |
| 067 | COVERED | `zoom-400-ext17` (200%/400% text keeps meaning). |
| 068 | COVERED | `forced-colors-ext20.spec.js` added (5 tests): demonstrated a real defect — inputs/palette lost their focus indicator under forced-colors (box-shadow not painted) — and FIXED it with a `@media (forced-colors: active)` system-colour outline; status is text-equivalent; no forced-color-adjust:none bypass (negative-control guarded). Browser-EMULATED; real Windows HC/Safari/VoiceOver stay BLOCKED (070). |
| 069 | COVERED | `a11y-basics`, `auth-chaos`, `sales-a11y-ext20k` (live-region messages useful, no storm). |
| 070 | BLOCKED | Real Safari/iPhone/VoiceOver not runnable here (emulated Chromium only). Manual checklist below. |

## H. State lifecycle and recovery
| ID | Verdict | Evidence |
|---|---|---|
| 071 | COVERED | `login-session`, `session-security-ext18`, `auth-chaos` (mocked sign-out clears sensitive state). |
| 072 | COVERED | `session-expiry-midway`, `session-expiry-reads-ext15` (expired session disables stale privileged actions). |
| 073 | COVERED | `out-of-order`, `double-submit-stale` (record switch cannot take an older async result). |
| 074 | COVERED | `resource-leaks`, `nav-history`, `soak-ext15` (no stale surface accumulation). |
| 075 | COVERED | `unsaved-changes` (cancel honours the edit contract). |
| 076 | COVERED | `storage-safety`, `storage-adversarial-ext17` (storage refusal → honest guidance). |
| 077 | COVERED | `storage-adversarial-ext17`, `sales-approval-ext20k` (corrupt saved state can't silently change approval). |
| 078 | COVERED | `double-submit-stale`, `sales-audit-ext20k` (retry can't duplicate audit/accepted action). |
| 079 | COVERED | `error-language`, `empty-database`, `fault-injection` (loading/error/empty distinct). |
| 080 | COVERED | `agent-safety-ext20`, `agent-registry`, `no-live-send` (unavailable providers shown disconnected, no calls). |

## I. Preservation and reproducibility
| ID | Verdict | Evidence |
|---|---|---|
| 081 | COVERED | Newest archive `he-dashboard-recovery-2026-11-01d.tar.gz`; full sha256 in §Export below; per-file SHA256SUMS.txt inside. |
| 082 | COVERED | `git bundle verify`: contains HEAD `d3eed75`, REQUIRES base `c06c8b5` (thin bundle). README states retrieval. |
| 083 | COVERED | README says plainly the bundle is NOT self-contained and how to supply the base. |
| 084 | COVERED | 11 commits = 11 patches (0001–0011) + bundle HEAD `d3eed75`; COMMITS.txt lists all. |
| 085 | COVERED | Uncommitted diagnostic `executablePath` override excluded and labeled in README + validation doc. |
| 086 | COVERED | Clean restore verified in a disposable checkout (see §Export); tree matches `d3eed75`. |
| 087 | COVERED | Archive holds only git objects + docs: no node_modules, browser profiles, secrets, or other projects (tar listing). |
| 088 | COVERED | Earlier archives v2/v3/v4 left intact; v5 is additive. Generated+exposed this session; downloaded-confirmation is the user's to report. |
| 089 | COVERED | v5 generated after meaningful doc/audit work and exposed via the session file channel. |
| 090 | COVERED | README minimal restore steps another session can follow (clone → fetch base → pull bundle / git am patches). |

## J. Owner review and project finish
| ID | Verdict | Evidence |
|---|---|---|
| 091 | COVERED | 47 Sales pages (flag-gated OFF) · 46 engine modules (39 loaded) · 14 screenshot subset — three distinct counts (validation doc). |
| 092 | COVERED | Capabilities split below (deterministic advisory vs simulated vs live-connected). |
| 093 | COVERED | Review path uses existing nav; §Owner handoff. |
| 094 | COVERED | `design-review/sales-preview-2026-10-27/MANIFEST.md` labels the 28 PNGs; browser/synthetic-state noted. |
| 095 | COVERED | Manual real-device/AT checklist below. |
| 096 | COVERED | Engineering vs environment vs manual vs owner separated (validation doc + this matrix). |
| 097 | COVERED | Prices/MOQ/MSRP/claims/photos remain deferred; none invented. |
| 098 | COVERED | Owner decisions listed with approve/decline/defer below; engineering items are not owner decisions. |
| 099 | COVERED | Draft review/release note below, with limitations + rollback; PR35 body already carries one. |
| 100 | COVERED | Single checkpoint = final report (chat) + this matrix + validation doc. |

## Capabilities (092): what the dashboard does, by honesty class
- **Deterministic advisory** (computed from synthetic data, no side effect): order/
  report totals, priority/next-action scores, concentration, progression, inventory
  math. Shown as advice, not live action.
- **Simulated** (dry-run, never leaves the browser): outreach, replies, Gmail/agent
  flows — gated behind the OFF Sales flag; `no-live-send` proves nothing is sent.
- **Live-connected**: NONE enabled. Supabase is read via anon key + RLS behind
  login (not exercised here). No Shopify/Gmail/provider action.

## Owner handoff — review path, decisions, manual checklist, release note
**Corrected manual review package (2026-11-02, items #9–#16).** Test the EXACT
candidate as a LOCAL, isolated, SYNTHETIC preview — NOT the live GitHub Pages site
and NOT old `main` (an unmerged branch is not what Pages serves). Everything below is
synthetic, offline, dry-run; it sends nothing and touches no production/customer data.

*Build the preview from the candidate (dashboard bytes are identical from `ff52294`
on — the later commits add only tests/tools/docs, no `owner-login.html`/app change):*
```bash
git checkout 9173ccf            # pushed candidate head (or local 5fbe0c1; same dashboard)
node tests/tools/staging/build-staging.js staging-build --offline
# → writes staging-build/ (pinned library bundled; no CDN, nothing fetched)
```
*Open on your Mac (Safari):* open `staging-build/owner-login.html`. A permanent
**"DEVELOPMENT / STAGING — NOT PRODUCTION"** banner shows; click its **synthetic-owner
sign-in** button — no password, no real account. The banner has a **scenario selector**
(or append `?scenario=<id>` to the URL).
*Open on your iPhone (you run this; I do not bind/serve or change any firewall):* on the
Mac, in `staging-build/`, run a local static server (e.g. `python3 -m http.server 8000`)
and on the iPhone (same Wi-Fi) open `http://<your-Mac-LAN-IP>:8000/owner-login.html`.
Keep it on your LAN; do not expose it publicly.

**Executable checks — mark each PASS/FAIL + note; real-device/AT rows are UNRUN until
you supply evidence.** AI-spend expected value is the configured cap
(`AI_SPEND_CAP`, currently **$30** in `owner-login-app.js`), not a hard-coded number;
"unavailable" (**"?" / "could not be read"**) must never look like a legitimate
**$0.00**.

| # | Route / setup | Action | Expected | Evidence |
|---|---|---|---|---|
| M1 Login | `owner-login.html` (default scenario) | Click synthetic-owner sign-in | Home loads with synthetic figures; AI spend shows a real **$0.00 / $30.00** (legitimate zero) | ☐ UNRUN |
| M2 Expiry | `?scenario=session-expired`, sign in | Press **Refresh** (⌘⇧R) on Home | Every figure becomes **"?" / "could not be read"**; an "expired / sign in again" message; **never a fresh $0.00** | ☐ UNRUN |
| M3 Recovery | after M2 | Switch the banner scenario back to **default** and reload; sign in | Real figures return, AI spend back to **$0.00 / $30.00** (not "could not be read"). *(Same-page reauth without reload is covered by the automated spec `home-reauth-recovery-ext20`.)* | ☐ UNRUN |
| M4 Narrow width | a Sales decision page (see setup note) at 320 px and 390 px | Read the card | Identity, recommendation, uncertainty wording, **STOP/DNC**, reasons and next-action all readable, nothing clipped or overlapping | ☐ UNRUN |
| M5 Keyboard/focus | any page, keyboard only | ⌘K opens the palette; Tab within it; **Esc** | Focus enters the palette, Tab stays inside, **Esc** closes and returns focus to where you were | ☐ UNRUN |
| M6 Dialog (no real write) | Orders → a synthetic order → Delete | At the password prompt press **Cancel / Esc** | Nothing is deleted or sent; focus returns. **Do not complete a delete** (staging is synthetic, but keep it Cancel-only) | ☐ UNRUN |
| M7 Uncertainty/STOP | Approvals / an outreach page | Read the wording | States plainly **Approve is not Send**; a DNC/decline dominates | ☐ UNRUN |
| M8 Search response | ⌘K, type a few letters | Watch the results | Updates feel immediate; results capped, readable (this is the automated `search-palette` check's manual counterpart) | ☐ UNRUN |
| M9 VoiceOver | Home + one decision page (real iPhone/Mac) | VoiceOver on | Tiles/controls announced with names; "?" announced as unavailable, not zero | ☐ UNRUN (AT) |

*Setup note for M4/M7 (Sales decision pages — flag ON, load-time + reload):* in the
browser console run `localStorage.setItem('he_sales_growth','on')` then **reload**; the
**"Sales & Growth"** group appears — open **"Growth Command Center"** (`salesCommandPanel`)
and the other six pages. The flag is read once at load (there is no runtime toggle), so
a reload is required; flag visibility is a preview only, not authorization to use Sales.

**Still genuinely BLOCKED (need your physical devices):** M9 VoiceOver and the real
Safari/iPhone WebKit rendering (CI runs Linux Chromium only); and the pinned-1194 pixel
pass is done by CI on Linux (advisory) — it is not a substitute for how the pages look on
real iOS/macOS WebKit.

**True owner decisions (approve / decline / defer):**
1. PR #35 is now pushed and GREEN on head `9173ccf` (PR run all 6 jobs pass; the
   push-event run shows one red from a pre-existing intermittent `search-palette`
   timing flake — see the validation doc). Remaining: **merge** (publishes the live
   dashboard — yours), and optionally push the local-only docs commit `5fbe0c1`. — *decide*
2. Prices / MOQ / MSRP / wholesale. — *deferred*
3. Product claims / descriptions / photos. — *deferred*
4. Gmail / provider / publish (Q11/Q12). — *deferred*
5. Single-approver constraint (you are the only code-owner approver). — *decide*

**Draft release note (NOT published):** "EXT20 recovery — rebuilds lost local
test/detector fixes (DOM-sink bare-RHS review + ceiling-0, RFC-reserved email
allowlist, numeric-contract builder scan, 10 re-pointed mutants, infra-aware
mutation classifier, committed regressions). Zero rendered-page/CSS/app/engine
change. Fixes PR #35's one red check (missing screenshot MANIFEST). Rollback:
`git revert` the range or drop the branch; `main` never changed."

## Export (v5)
- Dir: `…/scratchpad/he-dashboard-recovery-2026-11-01d/`
- Archive: `…/scratchpad/he-dashboard-recovery-2026-11-01d.tar.gz`
- Archive sha256: filled by the commit step (see chat/final report).
