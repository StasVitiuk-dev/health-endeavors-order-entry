# Revertability analysis — how to undo parts of this branch safely

Status: CURRENT · Safe-local analysis (rehearsed in a disposable worktree; no
history was rewritten, nothing was pushed) · As of 2026-10-19 · HEAD `b57ac46`

This answers: *if something on the branch has to be undone later, how hard is it,
and what is the right tool?* The headline case is the **Calendar colour fix**,
because it is the one owner-visible change still awaiting Stas's sign-off.

---

## The Calendar colour fix: `b040032`

**What it is.** One commit, "calendar: restore per-calendar colours (fix
invalid-CSS colour bug)". It:

- removed two malformed CSS lines from `assets/owner-login.css` (leftover
  JavaScript that had leaked into the stylesheet during the EXT15 inline-style →
  class conversion in `1d9c350`, which silently killed the calendar colours), and
- added a small `paintCalColors()` helper in `assets/owner-login-app.js` that
  sets each calendar's colour the CSP-safe way (via the CSSOM, not an inline
  style attribute), plus its regression tests.

**Can it be reverted on its own?** Rehearsed with `git revert b040032` against
HEAD in a throwaway worktree:

| Question | Result |
|---|---|
| Clean `git revert`? | **No — DEPENDENT_REVERT** |
| Where it conflicts | `owner-login.html`, `tests/specs/modules-ext15.spec.js`, `docs/ops/APPLICATION_MODULE_MAP_EXT15.md` |
| Nature of the conflict | **Mechanical, not behavioural** — the later Trusted Types scaffold commit `acd6181` bumped the same asset-version string (`?v=…`) and the same move-guard/module-map lines. The calendar logic itself does not conflict. |
| Side effect of reverting | **Re-introduces the original bug** — `css:check` FAILS again because the malformed CSS comes back. |

**Conclusion — do NOT undo the Calendar fix with `git revert`.** It is the wrong
tool twice over: it conflicts on unrelated version lines, and it brings the bug
back. If Stas decides **not** to approve the new calendar colours, the correct
path is a **new forward commit** that removes `paintCalColors()` and leaves the
stylesheet clean (colours simply absent, not broken). That keeps `css:check`
green and does not disturb the Trusted Types work. This is a visual/owner
decision, not an engineering blocker.

---

## Revert-risk classes for the branch's logical groups

How a reviewer should think about undoing each kind of work on this branch:

| Group | Revert class | Note |
|---|---|---|
| Documentation commits (138) | `DOC_ONLY` | revert freely; no behaviour change |
| Test / test-infra commits (~57) | safe | reverting only reduces coverage |
| Trusted Types conversion (44) | `GROUP_REVERT_REQUIRED` | later conversions build on the `h()` DOM builder and the empty sink allowlist introduced earlier; revert as a group, newest first, or not at all |
| Modularization (HTML → `assets/app/*.js`) | `GROUP_REVERT_REQUIRED` | the module registry + extractions are layered; a single extraction cannot be reverted without its registry |
| Calendar colour fix (`b040032`) | `DEPENDENT_REVERT` | see above — prefer a forward fix |
| Generated artifacts (module map, write-path matrices, lockfile) | `GENERATED_ARTIFACT_REGEN_REQUIRED` | never hand-edit a revert; re-run the generator (`module-map.js --write`, `write-paths.js`, `npm install`) |
| SQL drafts under `docs/ops/sql/` | `SQL_ONLY` / `DOC_ONLY` | drafts only; never executed against production from here |

**General rule for this branch:** because it is one long linear history with many
commits touching the shared monolith and its module map, *surgical* single-commit
reverts of shipped code will usually conflict on adjacent lines. The reliable way
to undo a behaviour is a **new forward commit**, reviewed and tested like any
other change — not a historical `git revert`. Historical reverts are safe only
for isolated docs/test commits.

---

## Why this is safe analysis

The revert was rehearsed in a disposable git worktree checked out at HEAD, then
aborted and the worktree removed. The real feature branch was not changed, no
history was rewritten, and nothing was pushed. Re-run the rehearsal yourself:

```bash
git worktree add --detach /tmp/rev HEAD
cd /tmp/rev && git revert --no-edit b040032   # observe the conflict, then:
git revert --abort && cd - && git worktree remove --force /tmp/rev
```

Related: `docs/ops/EXT20J_RESERVE_VII_REVIEW_PACKAGE.md` (branch shape + merge
rehearsal), `docs/ops/INVENTORY_TRUSTED_TYPES_HARDENING.md` (the TT program).
