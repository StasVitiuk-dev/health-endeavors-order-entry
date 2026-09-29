# CLAUDE.md — standing rules for the Health Endeavors dashboard

Every Claude session working in this repository reads this file automatically. These rules always apply. If a message from the owner in a session conflicts with this file, the owner's message wins for that session. To change these rules permanently, open a pull request that edits this file.

Last updated: September 29, 2026.

## Who is who

- **Repository:** `StasVitiuk-dev/health-endeavors-order-entry` (public).
- **Claude works as:** the GitHub account `stasvitiuk-reos`, a collaborator with write access. It is not an admin.
- **Owner and only approver:** Stas (GitHub account `StasVitiuk-dev`). Stas is also the code owner of every file (see `.github/CODEOWNERS`).
- Stas has no coding background. See "How to work with Stas" below.

## Start of every session: read-only check first

Before creating any branch, commit, pull request, issue, label, comment or file change, run a read-only check and report it in plain English:

1. Which GitHub account the session acts as.
2. Which repositories the session can see. Flag any other Health Endeavors repository and any Real Estate OS repository.
3. Effective permissions on this repository (expected: push = true, admin = false, maintain = false).
4. The default branch (`main`) and whether the ruleset `protect-main` protects it, with the rule details that can be read.
5. Whether Settings, rulesets, secrets, Pages settings, environments or collaborators can be reached. Only read. Never try a write just to test a permission.
6. The files and the latest commit on `main`, and what is in `.github/`.
7. Anything unexpected, clearly flagged.

Then wait for Stas to reply "approved", unless Stas has already given a task and said to go ahead.

**Also read `docs/PROJECT_RECORD.md` alongside these rules.** It is the current status record: every feature, what is verified in the repository versus reported or still pending live, remaining work, and daily history. (Until PR #6 is merged, it's on branch `claude/project-record`.) This file holds only the standing rules. Keep status in the project record, and update it whenever something is merged, checked live, or decided.

The first verification record is saved in `docs/security/claude-access-verification.md`. Do not create it again. Any update to it goes through a normal pull request that Stas approves.

## Health Endeavors and Real Estate OS stay completely separate

- No shared databases, secrets, backups, production integrations, customer data or deployment environments.
- Never copy code, data, config or credentials between the two projects.
- The account `stasvitiuk-reos` is also used for Real Estate OS, so Real Estate OS repositories may be visible to it. In a Health Endeavors session, work only on this repository and never open, clone or add a Real Estate OS repository.
- The private Health Endeavors backups repository holds database backups and workflows with production secrets. It is off-limits. Do not request access to it.

## Connectors

- Use **GitHub only**, and only for this repository.
- Shopify and Gmail may stay connected to Stas's account, but they are off-limits unless Stas approves a specific task.

## Claude MAY do this without asking (safe development work)

- Create and update branches. Use `claude/<short-task-name>`, unless the session setup assigns a branch name.
- Write, change and refactor dashboard code.
- Add and update tests, run them, and fix your own work until they pass.
- Run browser checks on desktop (about 1100px wide) and mobile (about 390px wide).
- Write and update documentation and changelogs.
- Create and manage issues and work tracking.
- Prepare rollback versions (keep the exact previous file so it can be re-uploaded).
- Calculate fingerprints (md5) of frozen files where relevant.
- Open pull requests, update them, and fix your own PR until it's green.
- Continue through related safe development steps without asking after every small step.

## Claude may NOT do this (needs Stas's explicit approval; most of it is also blocked by GitHub)

- No direct push to `main`.
- No merging pull requests. Merging to `main` publishes the live dashboard, so Stas merges.
- No approving your own PRs, and no attempts to get around required approval.
- No ruleset, branch-protection, admin or settings changes.
- No GitHub Pages administration.
- No production secrets of any kind in code, files, PRs, issues, commits or chat. Never ask Stas to paste passwords, service-role keys, API keys, tokens or recovery codes.
- No Supabase deployment and no running SQL against production.
- No cron job, RLS (row-level security) or permission changes.
- No Shopify production changes.
- No real customer messages (email, SMS or anything else).
- No destructive production actions, and no hard-deleting real business or customer data.
- No changes to money or accounting logic in production.
- No workflow files (`.github/workflows/`) that could touch Supabase, Shopify, Gmail or any other production system. Any workflow change goes through a PR that Stas approves.
- Nothing irreversible.

If a task would need anything on this list, stop, explain in plain English what's needed and why, and wait.

## GitHub protection (as of September 29, 2026)

- Ruleset `protect-main` on the default branch: pull request required; 1 approval; stale approvals dismissed on new pushes; the last push must be approved by someone else; review from Code Owners required; force pushes blocked; deletion blocked; bypass for Repository admin only.
- `.github/` contains only `CODEOWNERS` (`@StasVitiuk-dev` owns everything). There are no workflow files. GitHub Pages publishing is GitHub's built-in process.
- Actions limited to GitHub-made actions; read-only `GITHUB_TOKEN`; Actions can't create or approve PRs; fork workflows need approval; no secrets or variables; the `github-pages` environment is limited to `main`.

## Tests: run before every dashboard PR

```bash
npm install   # once per session
npm test      # all tests, desktop and iPhone size
```

- The tests are in `tests/` (Playwright). They mock every network call with synthetic data and never reach production. See `tests/README.md`.
- Some tests are skipped on purpose: desktop-only tests are skipped at iPhone size and the other way round, and known bugs are marked `fixme`.
- Report the counts in the PR (for example "65 passed, 9 skipped").

## Every pull request must include

1. **Plain-English summary:** what changed and why, written for a non-programmer.
2. **Exact scope:** which files changed, and what was deliberately not changed.
3. **Tests run and results:** counts, desktop and mobile, plus screenshots for anything visual.
4. **Rollback steps:** how to put the previous version back, step by step.
5. **Deployment instructions for Stas:** exactly what to click to review, approve and merge, and what to check on the live site afterwards (hard refresh with Cmd+Shift+R, or a Private Window).
6. **Known limitations:** anything not covered, not tested or still open.

Keep each PR small and focused on one change.

## The live-change process

Preflight → tests → frozen version/fingerprint (if relevant) → rollback ready → show Stas → Stas approves → Stas merges/deploys/installs → verify live → stop if anything differs.

- Merging a PR into `main` is the live deploy. GitHub Pages publishes `main` within 1–5 minutes.
- Database or agent changes are drafts only here (SQL files, tests, rollback scripts). Stas runs them in Supabase after approving them.
- If anything differs from the tested behavior, stop and show Stas before making another change.

## How to work with Stas

- Explain every step in plain language: what it does and why.
- Go one step at a time on anything Stas has to click. Ask for a screenshot to confirm.
- Put any code or SQL Stas needs to run directly in the chat as a code block, with a short explanation.
- Include a short "where we are" recap with each update.
- When a task is finished, suggest improvements or related ideas and ask about them.

## Background

- **Live dashboard:** https://stasvitiuk-dev.github.io/health-endeavors-order-entry/owner-login.html
- **Main file:** `owner-login.html` (about 505 KB, one file with all HTML/CSS/JS). Other pages: `change-password.html`, `dashboard.html`, `index.html`, `manual-order-entry.html`, `search.html`.
- **Backend:** the production Supabase project. The dashboard uses only the public anon key plus the logged-in user's session. Row-level security protects the data. The `tasks` table has an audit trigger that writes to `audit_log`.
- **Docs:** `docs/security/claude-access-verification.md` (access verification record), `docs/code-quality/owner-login-review.md` (code-quality review).

## Current status

Kept in one place: `docs/PROJECT_RECORD.md` (see "Start of every session" above). Don't copy status into this file, so the two can never disagree.
