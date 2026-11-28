# Security finding: the Claude session's GitHub credential is an admin (X6-17)

**Status:** CURRENT, OPEN, OWNER DECISION REQUIRED. First seen 2026-10-07 (extension 6), re-checked read-only 2026-10-07 (extension 7). Severity: **High** (process risk; nothing bad has happened). Backlog item X6-17.

**What Claude did with these rights: nothing.** No settings, ruleset, collaborator, Pages, secrets or environment page was opened for writing; no merge, approval, direct push to `main`, force push or branch deletion. Every change went to a `claude/...` branch. No "test write" was tried to probe permissions.

## 1. What was observed (read-only GitHub API calls)

| Check | Expected (CLAUDE.md, `claude-access-verification.md`) | Observed 2026-10-07 |
|---|---|---|
| Account the session acts as (`GET /user`) | `stasvitiuk-reos` (collaborator) | **`StasVitiuk-dev`** (the owner's own account) |
| Permissions on this repository (`GET /repos/...`) | push = true, admin = false, maintain = false | **admin = true, maintain = true**, push = true |
| Ruleset `protect-main` (`GET /repos/.../rulesets/24159982`) | PR required, 1 approval, code-owner review, last push approved by someone else, stale approvals dismissed, no force push, no deletion; bypass: repository admin | Same rules, and the bypass list has the **Repository admin** role with mode **always**. GitHub reports **`current_user_can_bypass: "always"`** for this session |

## 2. Why it is dangerous

- **The review rule does not apply to this session.** `protect-main` requires a pull request approved by the code owner. Because the session *is* the code owner and an admin with "always" bypass, GitHub would accept a direct push to `main`, a merge of an unreviewed PR, or a change to the ruleset itself.
- **Merging to `main` is the live deploy.** GitHub Pages publishes `main` in 1–5 minutes, so a mistaken or manipulated session could change the live dashboard with no human in the loop.
- **The only thing stopping it is written instructions** (CLAUDE.md and each session's rules). That is a single layer. A prompt-injection in a PR comment, issue or file, or a plain mistake, would meet no technical barrier.
- **Approval is meaningless when author and approver are the same account.** "The last push must be approved by someone else" cannot hold if Claude's pushes are made as the owner.
- **Blast radius beyond this repository.** An owner-account credential may reach every repository the owner can (for example the private backups repository, which holds production-secret workflows). This session's tool scope limits it to one repository, but the credential itself is broader.
- **Audit trail is blurred.** Commits and actions by Claude appear under the owner's name, so the history cannot show which changes a person made.

## 3. Minimum privilege actually needed

Claude's work here needs only:

| Need | Permission |
|---|---|
| Read code, issues, PRs, checks | Read |
| Push `claude/...` branches | Write (push) to non-protected branches |
| Open / update pull requests and issues, comment | Write (pull requests, issues) |
| **Not needed** | Admin, Maintain, ruleset bypass, merge to `main`, settings, Pages, secrets, environments, collaborators, deleting branches, other repositories |

That is the "Write" collaborator role on this one repository, **as a separate account** (`stasvitiuk-reos`), never the owner's account.

## 4. Remediation (owner only; one of these, best first)

1. **Connect Claude with the collaborator account.** In claude.ai → Settings → Connectors → GitHub (and the Claude GitHub App installation), sign in as `stasvitiuk-reos`, not `StasVitiuk-dev`. Keep `stasvitiuk-reos` at the **Write** role on this repository only.
2. **Also harden the ruleset (recommended even after step 1).** In GitHub → this repository → Settings → Rules → `protect-main`: change the Repository admin bypass from "always" to **"for pull requests only"**, or remove it, so even an admin cannot push straight to `main`. Keep code-owner review on. (This is a settings change: Claude must not make it.)
3. **If neither can be done soon:** treat every Claude session as able to deploy. Read each session's final report for "Main changed: NO" and check the `main` commit history after each overnight session.

Nothing here needs a secret to be shared with Claude. Never paste tokens or recovery codes into a chat.

## 5. How to verify the fix (read-only, Claude can do this at the start of any session)

1. `GET /user` → login is `stasvitiuk-reos`.
2. `GET /repos/StasVitiuk-dev/health-endeavors-order-entry` → `permissions.admin = false`, `maintain = false`, `push = true`.
3. `GET /repos/StasVitiuk-dev/health-endeavors-order-entry/rulesets/24159982` → `current_user_can_bypass` is `"never"` (or the field is absent), and the rules above are unchanged.
4. Record the result in `docs/security/claude-access-verification.md` through a normal PR, and mark X6-17 DONE in the backlog.

## 6. Related

- `docs/security/claude-access-verification.md` (the first access record, which found `stasvitiuk-reos` with push only; it has not been edited)
- `docs/ops/OWNER_DECISIONS_NEXT.md` (X6-17 row), `docs/ops/PRODUCTION_READINESS_MATRIX.md`, `docs/ops/READINESS_GATE.md`

## 7. Re-check, Nov 28, 2026 (still OPEN)

Read-only re-check in a cloud session: the GitHub connection still acts as **`StasVitiuk-dev`** (the owner's
own account), not `stasvitiuk-reos`. Commits are authored "Claude", but every pull request the session opens
shows the owner as its author.

**What this means in practice (seen Nov 27–28):** GitHub never lets the author of a pull request approve it,
so the owner cannot give the one approval `protect-main` requires on Claude's pull requests. The merge page
shows "Merging is blocked", and the only way through is the admin box "Merge without waiting for requirements
to be met (bypass rules)". #157 was merged that way, with no review recorded. The safeguard "the last push
must be approved by someone else" therefore does nothing for Claude's work today.

**What Claude does meanwhile:** unchanged from section 1. It merges nothing, approves nothing and never uses
the bypass. It posts "Ready" only once every check has passed, so the owner knows when a bypass merge is
reasonable.

**The fix is still remediation 1 in section 4:** connect Claude with `stasvitiuk-reos`. After that the
owner's own **Approve** button works on Claude's pull requests, and the bypass is no longer needed.
