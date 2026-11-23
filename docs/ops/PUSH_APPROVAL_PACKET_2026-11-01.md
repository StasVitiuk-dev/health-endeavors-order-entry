# Feature-branch push — approval packet (owner decision) — 2026-11-01

Status: CURRENT · prepared locally · **nothing pushed.** This packet is for the
owner to decide. No merge/deploy/PR publication is proposed or authorized.

## 1. Exact source (local)
- Local branch: `claude/ext20-recovery-2026-10-31`
- Source SHA (HEAD): **`f280b8d33967941957409497380f12192fac7284`**
- Base (ancestor, on remote): `c06c8b5` = tip of
  `claude/platform-ext20-adversarial-completion-2026-10-13` (PR #35 head).
- 15 commits on top of the base; working tree clean except ONE uncommitted
  diagnostic (`tests/playwright.config.js` executablePath override — NOT to be
  pushed, NOT in any archive).

## 2. Remote target + fast-forward analysis (read-only `git ls-remote`)
- `claude/platform-ext20-adversarial-completion-2026-10-13` = `c06c8b5` (unchanged).
- `claude/ext20-recovery-2026-10-31` = **does not exist on remote.**

Two possible destinations:
- **(A) Update PR #35's branch** (`…adversarial-completion-2026-10-13`): its tip
  `c06c8b5` is a direct ancestor of `f280b8d`, so this is a **FAST-FORWARD**
  (no force, no history rewrite). It updates PR #35 in place.
- **(B) Push as a new branch** `claude/ext20-recovery-2026-10-31`: creates a new
  remote ref (not a fast-forward question); would need a new PR, which is NOT
  authorized here.
Recommended destination if approved: **(A)**, fast-forward.

## 3. What the push would and would not do
- **CI:** push to any `claude/**` branch triggers `.github/workflows/ci.yml`
  (the ONLY workflow in the repo) — tests only: `permissions: contents: read`,
  no secrets, no deploy/Pages/release/environment step (grep confirms none).
- **main:** NOT touched. The push targets a `claude/**` branch, never `main`.
  GitHub Pages serves `main`, so a feature-branch push does not republish the
  live site **by the mechanisms visible to this session.**
- **Residual uncertainty (prerequisite, per honest disclosure):** Pages
  configuration and repository/branch settings are NOT readable without admin
  (blocked). I cannot *prove* from inside the repo that no org-level or
  Pages-side automation exists. The argument that no deploy occurs rests on
  (a) the single tests-only workflow and (b) the target being a non-`main`
  branch. If the owner wants certainty, confirming Pages is "deploy from `main`"
  (Settings → Pages) is the one prerequisite before relying on "deploy-free".
- **PR #35:** the push is **expected to address** PR #35's one observed red
  check (ENOENT on `design-review/sales-preview-2026-10-27/MANIFEST.md`, fixed by
  commit `03eda31`). It does **not guarantee** PR #35 goes green: the browser,
  database and visual jobs were **skipped** on the last red run (they `need` the
  static job), so they have never run on this head — **downstream CI pending.**

## 4. Post-approval validation sequence (to run only AFTER approval; not executed)
1. Confirm the new remote head equals `f280b8d` (`git ls-remote`).
2. Watch the CI run on that head; inspect each job/check individually.
3. If the static job passes: verify the browser + database jobs (first real run
   on this head) and read their results.
4. Preserve any failure logs/artifacts; diagnose root cause (no baseline refresh,
   no threshold change, no skip).
5. Apply only authorized LOCAL fixes and push again if the fix is in scope.
6. Any step that would merge, deploy, publish a PR, touch production, or add a
   reviewer/approval is OUT OF SCOPE → stop and report for a new approval.
7. Report CI outcome; keep `main` untouched throughout.

## 5. Guardrails preserved
- No force push / history rewrite (destination A is a clean fast-forward).
- `protect-main` review requirements untouched; no bypass, self-approval, or
  account additions proposed.
- Business inputs (prices/MOQ/MSRP, claims, photos, provider/Gmail, publish)
  remain deferred — not part of this push.

## 6. Still OPEN / BLOCKED after a successful push (unchanged by it)
- Pinned-Chromium **1194** visual pixel acceptance — download 403 here; next:
  run `visual.spec` on matched 1194 in a network-allowed env. (7 emulated
  forced-colors passes are NOT physical-device acceptance.)
- 50k-token **8 s timing** bound — reference-env re-measure; OPEN.
- Real Windows High Contrast / Safari / iPhone / VoiceOver — manual.

## 7. THE decision (one question)
See the owner summary. Approve / decline / defer **pushing `f280b8d` to the PR #35
branch as a fast-forward (tests-only CI, no deploy, main untouched).**
Expected to clear PR #35's MANIFEST check; downstream CI will run for the first
time on this head and its result is not guaranteed.
