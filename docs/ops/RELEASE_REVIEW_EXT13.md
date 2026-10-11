# Release review of PR #28, plus final audits (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · PR #28 head `bd574df` (EXT12) and its EXT13 continuation · dashboard code `32c05e2` · `main` `d3db7bc`.
**SUPERSEDES:** the PR-related sections in `OWNER_UNBLOCK_CENTER_EXT12.md` §1 and `pr-merge-order.md` (Oct 4 merge plan for PRs #5–#24, now obsolete: all of them are inside #28).

Written as an external reviewer would. Technical in places on purpose; §1 is the owner summary.

---

## 1. Owner summary (one page)

- **What merging changes:** the live dashboard gets the safety fixes from extensions 1–11 (wrong totals, double-saving, lost-connection honesty, phone layout, sign-out wiping, escaping, pinned library…). Every new database-dependent feature is behind a switch that does not exist yet, so it stays **off**.
- **What merging does NOT change:** the database. No SQL runs when you merge. No switch turns on. No customer is contacted. No money or accounting logic changes.
- **Production impact until you deploy a database step:** **NONE** beyond the page itself. Verified: no workflow file, no secret, no database call that writes anything new without a switch, and the test profile `merge-without-sql-ext11` (11 tests) runs the merged page against a database shaped exactly like today's production.
- **If something looks wrong after merging:** GitHub → the merge commit → **Revert** → merge the revert. The live site is back within 1–5 minutes. No data needs undoing, because merging changed none.
- **The 23 older draft PRs (#5–#27) are all inside #28.** Merge #28 only. Afterwards GitHub normally shows the older ones as merged; close any that stay open.
- **Recommendation:** merge after the backup look, the GitHub reconnect and a clean read-only session (`OWNER_ATTENTION_SESSION_EXT13.md` §2). It is technically safe earlier.

## 2. What actually differs from `main`

### 2a. Executable (what the browser runs)

| File | Change vs `main` | Behaviour |
|---|---|---|
| `owner-login.html` | +3,195 / −1,893 lines | all EXT1–11 fixes; scripts and styles moved into `assets/` |
| `assets/owner-login-helpers.js` (new, API 9) | 709 lines | pure helpers (money, dates, CSV, errors); the page refuses a mismatched version |
| `assets/owner-login.css` (new) | 1,008 lines | styles moved out of the page (strict script/style policy) |
| `assets/dashboard-page.js`, `assets/search-page.js` (new) | 195 / 100 lines | scripts moved out of `dashboard.html` / `search.html` |
| `assets/owner-login-icon.png` (new) | 6 KB | icon |
| `change-password.html`, `dashboard.html`, `index.html`, `manual-order-entry.html`, `search.html` | small–medium | CSP/frame guard/no-referrer headers, pinned library, escaping, sign-out wipe, manual-order safety |

Unchanged since the full-suite run: all of the above are byte-identical to `32c05e2` (checked with `git diff 32c05e2 HEAD`).

### 2b. Draft SQL (does nothing until the owner runs it)

- 8 read-only queries `docs/ops/sql/00_READONLY_A` … `07_READONLY_H`.
- 21 drafts in `docs/ops/sql/drafts/` (10–30): install, rollback and local-only test files.
- 24 local-test scripts in `docs/ops/sql/local-test/` (local throwaway database only).

Matrix: `PLATFORM_MATRICES_EXT13.md` §6–7.

### 2c. Documentation, tests and tools (never run by the live site)

- 147 test files;
- 107 `docs/ops` documents (plus plans and security notes);
- 151 screenshots under `design-review/` (26 MB, synthetic data);
- `package.json` scripts;
- `CLAUDE.md`;
- `.gitignore`.

Local tools: evidence intake, deployment simulator, incident map, doc checker, query interpreter, write-path extractor, staging builder, mutation runners.

### 2d. Not present (checked)

- No file under `.github/`; no workflow.
- No deleted file.
- No website or Real Estate files.
- No secrets.

## 3. Reviewer findings on PR #28

| # | Finding | Severity | Action |
|---|---|---|---|
| F1 | PR is very large (≈484 files, 316 commits) because it carries extensions 1–12 | review burden, not a defect | review by the owner summary + this file; page code was fully re-tested on `32c05e2` |
| F2 | 26 MB of screenshots will be published on GitHub Pages after the merge (the repository is public anyway) | LOW | synthetic data only; keep, or remove in a later PR if size matters |
| F3 | `pr-merge-order.md` (Oct 4) still describes merging #5–#24 one by one | MEDIUM (could mislead) | **fixed in EXT13:** marked superseded and pointed here |
| F4 | `19_DRAFT_request_keys.sql` header said the dashboard change must ship after it (true before the switch design) | LOW (stale comment) | **fixed in EXT13:** dated clarifying note added (comment only) |
| F5 | EXT11/EXT12 decision tables described legal-hold option 2 incorrectly | MEDIUM (wrong owner information) | **fixed in EXT13:** dated correction notes; correct list in the attention session |
| F6 | Evidence intake accepted a result without a run date as fresh forever | MEDIUM (an undated PASS would never expire) | **fixed in EXT13:** UNKNOWN until dated; test + mutant |
| F7 | `drafts/13` (optional report totals) has no rollback file | LOW (not in the production plan) | recorded; write the rollback before it is ever proposed |
| F8 | Test drafts `12`, `14`–`16` sit in `drafts/` beside install files | LOW (each says LOCAL ONLY and ends in ROLLBACK) | not renamed (names are referenced by tests and docs); the read-only/draft copy-paste rule in the owner cards says "only files named `0X_READONLY_…` in a read-only session" |
| F9 | Old documents still labelled CURRENT (readiness gate, launch readiness, decisions-next…) | MEDIUM (confusing) | **fixed in EXT13:** navigation banners added; authority per topic in `SOURCE_OF_TRUTH_MAP_EXT13.md` |
| F10 | Missing test mapping | none found | every invariant maps to tests (`DATA_MODEL_DICTIONARY_EXT13.md` §6) |
| F11 | Ambiguous SQL / unsafe instructions | none found | §6 below |

## 4. Merge safety and rollback (re-confirmed)

| Question | Answer | Evidence |
|---|---|---|
| Can the code merge while the database stays as it is and every switch is off? | YES | `merge-without-sql-ext11` (11 tests: sign-in reads no business data; every action uses today's path; switches refuse; System status says "not installed") |
| Does merging read anything new at sign-in? | NO | request baseline test; probes run only when Continuity → System status is open |
| What does a revert do? | restores the previous page files; nothing in the database to undo | change package §5 |
| If a switch had been turned on after the merge? | turn it off first, then revert; real stock or records made while it was on stay and are corrected by hand | rollback matrix |

## 5. PR and branch topology

| PR | Branch | Purpose | Contained in #28? | Recommendation |
|---|---|---|---|---|
| **#28** | `claude/platform-ext12-preproduction-simulation-2026-10-11` (EXT13 continues on `claude/platform-ext13-owner-attention-final-audit-2026-10-11`) | everything EXT1–12 | — | **review and merge this one only** (updated to the EXT13 head if the owner prefers one PR) |
| #27, #26, #25 | EXT11, EXT10, EXT9 branches | previous all-in-one drafts | YES | close after #28 is merged |
| #24 … #19 | `claude/tests-*` | tests only (Sept 29) | YES | close after merge |
| #18, #17 | modularization plan, frontend security review | docs only | YES | close after merge |
| #16, #15 | inventory safety audit, regression coverage | tests and report | YES | close after merge |
| #14 … #7 | small fixes (phone tap, re-auth Enter, swipe, local dates, link scheme, CSV formulas, agent text, escaping) | fixes | YES | close after merge |
| #6 | `claude/project-record` | project record docs | YES | close after merge |
| #5 | `claude/sweet-hamilton-5ty3zp` | first `CLAUDE.md` | YES | close after merge |
| (no PR) | `claude/tests-only-ci`, `claude/tests-only-ci-v2` | inactive CI workflow (150 lines) | **NO** | keep; it is the subject of decision #15. A workflow change needs the owner's approval (`CLAUDE.md`) |

Checked with `git merge-base --is-ancestor` for every open PR head. **No branch was deleted.** Recommendation: after the merge, branches of closed PRs can be deleted by the owner (GitHub offers a button). This is optional and later, and Claude does not do it.

## 6. Draft SQL static audit, round 2

Every install and rollback draft re-read for the items below. Automated checks: `sql-drafts-static.spec.js` and `sql-readonly.spec.js` (76 passed). Manual reading results:

| Check | Result |
|---|---|
| UPDATE / DELETE without WHERE | none. Every DELETE names its rows (`flag_key = …`, `run_at < now() - interval '90 days'`, one product id) |
| Unsafe DROP | none. Drops remove only the draft's own objects (`drop … if exists` on its own functions, trigger, policies, view, results table) |
| SECURITY DEFINER | none. R1–R5 and the nightly function are `security invoker`, so row-level security still applies (static test enforces it) |
| `search_path` | pinned to `public, pg_temp` on every function (static test) |
| Auth checks | every stock function checks `public.is_owner_or_admin()` first; actor = `auth.uid()` server-side, never a client-supplied id |
| Grants | EXECUTE to `authenticated` only; revoked from `public` and `anon`; nightly function revoked from all roles (runs by schedule) |
| RLS bypass | none (no definer, no `set role`, no policy that widens access) |
| Idempotency | every install is safe to run twice: `if not exists`, `create or replace`, or it refuses and changes nothing |
| Rollback | every install has a tested rollback (§7 of the matrices), except optional `drafts/13` |
| Transactions | every install and rollback is one `begin … commit`; test drafts are `begin … rollback` |
| Lock risk | LOW at today's size for all (function creates, small-table index builds, constraint scans); see the matrices for the volume note on drafts 23 and 19 |
| Headers | every install/rollback says DRAFT / NOT INSTALLED / owner approval in its first lines (static test); read-only files say READ-ONLY and contain no write statement (static test) |
| Copy-paste safety | read-only files are numbered `00`–`07` with `READONLY` in the name; drafts are `10`–`30` with `DRAFT` in the name and live in a separate folder |

## 7. Stock functions (R1–R5), security review round 2

| Topic | Finding |
|---|---|
| Actor | `auth.uid()` from the session; `is_owner_or_admin()` check before any lock or write; no user-id parameter exists |
| Request keys | not needed: each function is retry-safe by state. A second receive is refused ("already received"). A second quarantine or return finds the status already moved. A repeated adjustment carries the expected old value and is refused if stock changed |
| Same key, different payload (page request keys) | a key is reused only for the same person, and for at most 10 minutes after the content changes. A repeat with changed content is told "already saved by an earlier attempt … changes since were not saved" (tested, `request-keys-ext10`) |
| Error contract | plain-English `raise exception` messages with standard codes (42501 permission, P0002 missing, 22023 bad input, 55000 wrong state); the page shows them after `explainDbError`, which also rewrites deadlock / statement-timeout / dropped-connection text (helpers-unit tests) |
| Audit | each stock change writes an `inventory_adjustments` row with reason, product, bucket, change and `auth.uid()`; PO receive also writes lots, the expense and `received_by` |
| Concurrency / deadlock | fixed lock order: product before lot before stock row; PO lines locked in product-id order; tested with 100-caller stress and random interleavings (0 deadlocks; the old order deadlocked 15–17 of 30) |
| Timeout | no lock timeout in the functions. A long wait ends at the database's statement timeout, the transaction rolls back, and the page says nothing was changed by this step |
| Rollback semantics | all-or-nothing (one transaction); R5 restores the stock row inside a sub-block if the product delete is refused |
| Helper `_he_apply_stock_change` | granted to `authenticated` because invoker functions call it with the caller's rights; it repeats the owner/admin check, so a direct call can do no more than `adjust_inventory` |

## 8. Security boundaries (final architecture review)

| Boundary | Rule today | Where enforced |
|---|---|---|
| Auth | Supabase sign-in; the page holds only the public key and the person's session | page; Supabase |
| RLS | the database decides who reads/writes; the page shows a refusal as "not permitted, nothing changed" | database; silent-refusal sweep |
| RPC | invoker functions, owner/admin check inside, no anon | drafts 10/25 |
| Agents | run outside the page; the page only reads their records and their switches | `agent_controls`; Query C |
| Customer send | **no send path exists**; drafts only | `no-live-send`, `hard-walls` |
| Accounting / tax | read-only pages; exports are CSV with formula guard | `hard-walls`, oracles |
| Backup | private repository, owner-only; Claude never opens it | `CLAUDE.md` |
| GitHub | protected `main` (PR, code-owner review, no force push); session still admin (X6-17) | ruleset |
| Staging | synthetic data, no production address or key, banner | `staging-build` |
| Secrets | none in the repository; intake refuses key-like text | secret scans; evidence intake |
| CI | none active (no workflow); tests run locally | — |

## 9. What AI must never do on its own (prohibition matrix)

| Action | Allowed for Claude/agents? |
|---|---|
| Read, detect, draft, propose | YES |
| Merge, deploy, push to `main`, approve its own PR | NO |
| Run SQL on production, install functions, change RLS or grants | NO |
| Turn on any switch or schedule | NO |
| Change stock, receive a PO, process a return, issue a refund | NO |
| Write accounting or tax entries | NO |
| Send any customer message | NO |
| Open or change the backups repository | NO |
| Change GitHub permissions or protections | NO |
| Repair an incident automatically | NO; a person does every recovery step (incident map rule) |

Safe automation principle: **read → detect → draft → human review → controlled change by a person.**

## 10. Final reviews of cross-cutting areas (status, evidence; no new findings unless stated)

| Area | Status | Evidence |
|---|---|---|
| Feature flags | 7 new flags all absent/OFF; dependency probed before ON; `shopify_order_sync` existing, state UNKNOWN | §5 of the matrices |
| Business rules | read from `business_rules`; units shown; unknown values not guessed | admin-pages tests |
| Status enums | every page-written status checked against Query A's constraints; unknown values shown, not mapped | state-machine audit, `state-machine.spec.js` |
| Dates / time | business timezone contract; local-date fixes | `TIMEZONE_CONTRACT.md`, `timezone-contract`, `local-dates` |
| Money | cents; independent oracles; "—" for unknown, never $0 | `money-periods`, `accounting-oracle`, `tax-oracle`, `missing-totals-ext11` |
| Empty / unknown | UNKNOWN / NOT VERIFIED states; empty database handled | `empty-database`, `attention-checks` |
| Search / pagination | labelled caps; "look up in all orders"; warns at the reply limit | `capped-reads`, `scale-matrix`, `search-palette` |
| Session | expiry midway, other tab sign-out, wipe on sign-out | `session-*`, `auth-chaos` |
| Multi-tab | stale writes refused ("changed elsewhere") | `double-submit-stale`, `stale-tab-gaps` |
| Deep links | history navigation | `nav-history` |
| Export / CSV | formula-safe, correct periods | `csv-export-guard`, `report-boundaries` |
| CSP / referrer / frame | on every page | `csp` |
| XSS | database text escaped everywhere | `xss-everywhere` |
| Dependency pin | library pinned with integrity hash | `library-pin` |
| Console logs | no data written to the console | `resource-leaks`, `general` |
| Storage | document/receipt names and removal safe | `storage-safety` |
| Build / CI | no build step; no active CI | — |

## 11. Tests: inventory, skips, flakes, profiles

**Suite:** 100 spec files (`tests/specs`), Playwright, every network call mocked with synthetic data; `retries: 0` (no hidden retries).

| Category | Spec files (examples) |
|---|---|
| Functional pages | `general`, `pages-data`, `purchase-orders`, `tasks`, `operations-pages`, `compliance-pages`, `admin-pages`, `activity-page`, `calendar-owner`, `manual-order-entry`, `owner-control-center` |
| High-risk (stock, money, state) | `po-receive`, `inventory-safety`, `stock-functions`, `failure-recovery`, `state-transitions*`, `state-machine`, `double-submit-stale`, `request-keys*`, `missing-totals-ext11`, `money-periods`, `accounting-oracle`, `tax-oracle`, `refund-policy`, `product-lifecycle` |
| Mobile | `mobile-cards-ext10`, `mobile-tasks`, `phone-po-tap`, `phone-swipe`, `responsive-widths`, `device-matrix`, `layout-sweep-ext9` |
| Accessibility | `a11y-basics`, `a11y-ext8` |
| SQL (static) | `sql-drafts-static`, `sql-readonly`, `query-a-fixes` |
| Mutation | `tests/mutation/run-page-mutations.js` (169 mutants: 154 page + 12 EXT12 tool + 3 EXT13 tool), `run-sql-mutations.sh` |
| Race / concurrency | `concurrent-operators`, `out-of-order`, `reauth-double-submit`; SQL: `concurrency_test.sh`, `random_interleavings.sh` |
| Stress / scale | `scale-*`, `large-data-ext9`, `performance-scale`, `stress_test.sh` |
| Security | `csp`, `xss-everywhere`, `search-dashboard-escaping`, `link-scheme-check`, `csv-export-guard`, `library-pin`, `hard-walls`, `no-live-send`, `role-matrix`, `auth-chaos` |
| Owner tools | `evidence-ext12`, `deploy-sim-ext12`, `incidents-ext12`, `docs-integrity-ext13`, `query-interpreter-ext10`, `staging-build` |

**Expected skips:**

- desktop-only tests are skipped at iPhone size, and the other way round;
- Node-only tool tests run once, on desktop;
- `test.fail` marks 8 "wanted" behaviours that need R2/R3/R4 installed (they pass as expected failures).

**Flakes:** none known. The last one, the 10k search test, was fixed in EXT11 and passed 8/8.

**Harness debt (real items only):**

- the full browser suite is the slowest part of verification;
- the mutation runner copies the repository once per mutant (slow but isolated).

**Runtime options that keep coverage:**

- run Node-only specs in a separate fast profile;
- shard the browser suite.

**Test profiles (what to run when):**

| Profile | Run | When |
|---|---|---|
| PRE-MERGE | full suite on the frozen page commit + page mutations | any page change |
| PRE-DB | `sql-drafts-static`, `sql-readonly`, local DB suite (`local-test/*.sh`) | any draft change, before proposing an install |
| PRE-SWITCH | `merge-without-sql-ext11`, `stock-functions`, `system-status-ext10`, `deploy-sim-ext12` | before asking the owner to turn a switch on |
| POST-DEPLOY READ | evidence intake on Query H + E from production | after every production step |
| INCIDENT | `incidents-ext12` + the spec named on the card | after any incident card change |
| OWNER-TOOLS | `evidence-ext12`, `deploy-sim-ext12`, `incidents-ext12`, `docs-integrity-ext13`, `query-interpreter-ext10` + tool mutants | any tool or owner-doc change |

**Test impact matrix:**

| Changed | Required profile |
|---|---|
| `owner-login.html`, `assets/*`, any page | PRE-MERGE (full) |
| `docs/ops/sql/drafts/*` | PRE-DB |
| `docs/ops/sql/0*_READONLY_*` | `sql-readonly` + query interpreter |
| `tests/tools/*` | OWNER-TOOLS |
| owner docs only | `docs-integrity-ext13` |

## 12. Backup terminology (final)

- **Backup look:** the owner reads the private backup job's latest runs. This is production evidence.
- **Local restore drill** (`local-test/restore_drill.sh`): proves the *procedure* on a throwaway local database. It is **not** a production backup restore and never counts as backup evidence.
- **Production restore drill:** restore the latest real backup into a throwaway Supabase project (owner; never the live one). Not done yet. Needs the RPO/RTO decision (#8).

## 13. Verification run for EXT13

| Check | Result |
|---|---|
| Page files vs `32c05e2` | identical (no executable change in EXT13; no full re-run needed) |
| Owner-tool, doc, SQL static, write-path, staging, library-pin, ops-findings, mock-realism specs | **212 passed, 0 failed**, 148 skipped (Node-only run once) |
| Tool mutants (EXT12 + EXT13) | **15/15 caught** |
| `npm run docs:check` | OK (23 current documents) |
| Secret scan of history `d3db7bc..HEAD` | clean (only the deliberate fake tokens in the intake's test samples) |
| Static SQL specs | 76 passed |
