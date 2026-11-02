# Screenshot policy (EXT14)

Status: **CURRENT.** Checked by `tests/specs/screenshots-policy-ext14.spec.js`.

## Why

`design-review/` held 146 screenshots (26.2 MB, 83% of the repository's bytes). Six of them were byte-identical copies of an earlier round's file: screens that had not changed got captured and stored again.

## Rules

1. **Changed screens only.** A new review round captures only the screens whose code changed in that round, plus at most one "unchanged" reference set when a reviewer asks for it.
2. **No byte-identical copies.** If a screen did not change, the round's manifest points to the earlier file instead of storing it again. The test fails on any two identical PNGs.
3. **Every package has a manifest (`design-review/<package>/MANIFEST.md`).** It lists each PNG (page, state, width, synthetic yes/no, production no). The test fails if a PNG is not listed, or if a listed file is missing.
4. **Size.** No single screenshot over 1.5 MB. Use the 3 standard widths (1100, 390, 320) unless a check needs another.
5. **Synthetic data only.** Never a production page, customer record or real e-mail (existing rule, unchanged).

## EXT14 clean-up

| Removed (identical copy) | Same bytes as |
|---|---|
| `dashboard-extension-8-2026-10-10/2026-10-10_ext8_09-approvals_{1100,390,320}.png` | `dashboard-extension-7-2026-10-07/05-approvals-{1100,390,320}.png` |
| `dashboard-extension-9-2026-10-10/2026-10-10_ext9_10-staging-home_{1100,390,320}.png` | `dashboard-extension-8-2026-10-10/2026-10-10_ext8_19-staging-home_{1100,390,320}.png` |

The 6 files came to 736 KB. The manifests mark them "removed in EXT14: byte-identical to …". The identical bytes are themselves evidence that those screens did not change between rounds.

## Not done (and why)

- **History not rewritten.** The removed files stay in git history, so `.git` does not shrink. Rewriting history needs a force push to shared branches. That is forbidden, and not worth it for 736 KB.
- **Older rounds not re-compressed.** Lossless re-compression would change every file's bytes and fingerprint for a small saving. That is for a later round, if Stas wants it.
