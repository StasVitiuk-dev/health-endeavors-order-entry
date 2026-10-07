# Owner decisions: what is waiting on you (next)

**Status:** CURRENT (2026-10-07, extension 7; EXT6, EXT5 and EXT4 lists kept below). This is the one place listing decisions only you (Stas) can make. Each has a recommendation; nothing here has been decided for you. Answer in the chat in any order, for example "D-ops-4: yes". Nothing changes in production until you approve the specific step.

**OWNER DECISION REQUIRED** on every row below.

## New in extension 7 (2026-10-07)

| Decision | Why it matters | Risk if nobody decides | Blocks launch? | Production action after deciding? |
|---|---|---|---|---|
| **X6-17 (re-checked): GitHub admin credential** | Still true today: the session acts as the owner account, with admin rights, and GitHub reports it can **always bypass** `protect-main`. Full write-up: `docs/security/GITHUB_CREDENTIAL_ADMIN_FINDING_2026-10-07.md`. Not used | A mistaken or manipulated session could deploy with no review | Recommended before launch | Owner only: connect Claude with `stasvitiuk-reos` (Write role), and set the admin bypass to "pull requests only" |
| **X7-14a: can employees approve requests?** | The database lets any active staff approve or reject (`ROLE_PERMISSION_MATRIX.md` §4) | An employee could approve something meant for you | No (no employees yet) | If owner-only: a policy draft + rollback, then approval |
| **X7-14b: admin-only switches** (Emergency mode, flags, agent switches, business rules) | No page-side role check; the database rule is UNKNOWN until Query D | An employee might flip them | Before hiring staff | Run Query D (read-only), then decide |
| **X7-16: restore drill** | Backups have never been proven to restore | A real data loss might not be recoverable | Recommended before launch | Owner: backup check, then one restore into a throwaway Supabase project |
| **K-list: which automations next?** | `AUTOMATION_AND_AGENT_REVIEW.md` proposes K1–K11; nothing is installed | None (status quo) | No | Each item has its own approval step |

## New in extension 6 (2026-10-07)

| Decision | Why it matters | Risk if nobody decides | Blocks launch? | Production action after deciding? |
|---|---|---|---|---|
| **X6-17: GitHub access for Claude sessions** | This session's GitHub connection has **admin** rights on the repository. CLAUDE.md expects the non-admin `stasvitiuk-reos`. The `protect-main` ruleset lets admins bypass review. Claude did not use these rights | An automated session *could* push to `main` or change settings without review. Only these written rules prevent it | Recommended before launch | Yes, owner only: connect Claude Code with the non-admin account (claude.ai → Settings → Connectors / GitHub), or remove the admin bypass from the ruleset |
| **X6-14: orders saved without items** | They count as revenue. They are now listed on Accounting and on the manual-order page | Revenue slightly overstated until each is finished or deleted | No | No (dashboard choice: keep counting and listing, or exclude from revenue, with your accountant) |
| Request keys (drafts/19, revised X5-11) | Now drafted and tested locally (23 checks) | Rare duplicates on a lost reply + retry | No | Yes (adds empty columns + indexes), then a dashboard PR |
| PO line guard (drafts/17) | EXT6 revision also protects today's receive; install order is free | Rare order / stock mismatches | Recommended | Yes (one trigger) |
| Query E (read-only) | Stock vs history and deliveries vs expense, as a "before" picture | You can't see reconciliation problems that may already exist | No | No (you run it, read-only) |
| Merge path (DOC-02) | The newest extension branch contains every open PR (#5–#24) | Live bugs on `main` stay live (see the EXT6 report: revenue figures, sign-out data) | Yes, to fix the live bugs | Yes (merge = deploy) |

## At a glance (EXT5): risk of waiting, launch impact, production action

| Decision | Why it matters | Risk if nobody decides | Blocks launch? | Production action after deciding? |
|---|---|---|---|---|
| N4 refund accounting | Revenue and tax figures after refunds | Reports keep today's rule (refunds not subtracted); possible mis-statement | Yes, before real refunds | No (dashboard change only) |
| D-ops-5 partial returns | Returning 1 of 3 restocks 3 today | Stock overstated after partial returns | Before returns volume | Part of R3 install |
| D-ops-4 one recall per lot | Two recalls could quarantine a lot twice | Over-quarantine (stock wrongly unavailable) | No | Small database rule (INV-16) |
| D-ops-1/2/6 stock-function rollout | Order and scope of R1–R5 | Stock races stay in the browser path | **Yes** (R1–R4 are launch blockers) | Yes (install) |
| PO line guard (drafts/17, revised EXT6) | Line add / remove / quantity change during a receive breaks the order-vs-stock match, with or without R1 | Rare mismatches after concurrent edits; the dashboard detects and reports them but cannot prevent them | Recommended; EXT6: can be installed on its own, before or after R1 | Yes (one trigger) |
| Request keys for creates (X5-11) | A lost reply plus a retry can create a duplicate expense / return / recall | Rare duplicates; mitigated by the lock + "check before trying again" message | No | Yes (schema change per table) |
| Legal hold vs delete | Litigation / regulator requests | A held record could be deleted (documents lose their file) | Depends on legal advice | Option 1 needs a database rule |
| Document categories | Filing | Some documents filed under "other" | No | Small database rule change |
| Product delete policy (X3-16) | History preservation | None today (delete refused for anything used) | No | No |
| Manual-order product picker (F3-02) | SKUs on manual orders | Manual sales can't drive stock / returns by SKU | Before relying on manual orders for stock | No |
| Contrast / "This Week" label (F3-01/F3-07) | Readability | Minor | No | No |
| CI required check / pinned actions (CI-02/03) | Every merge tested automatically | A broken change could be merged | Recommended before launch | GitHub setting (owner only) |
| Backup check (X3-25) | Recovery if something goes wrong | **Unknown backup health** | **Yes, before any production change** | No (read-only look) |
| Time zone (optional) | Viewers outside Central | Dates follow the viewer's own calendar | No | No |

## Business / accounting (please decide first)

| ID | Question | Options | Recommendation | What waits on it |
|---|---|---|---|---|
| **N4** | When a refund is recorded, how should Accounting and Tax Records count it? | (a) keep today's rule: status only, refunds are not subtracted from revenue; (b) subtract the recorded refund amount in the month it was refunded; (c) your accountant's rule | Ask your accountant. Technically the dashboard is ready for (a) or (b) (`N4-refunds-accounting-map.md`) | Refund reporting accuracy |
| **D-ops-5** | Returns: record "units actually returned" (return 1 of 3)? Today the whole line is restocked | Yes, with a quantity box that defaults to the whole line / No | Yes | R3 install details; stock accuracy on partial returns |
| **D-ops-4** | Refuse a second active recall on the same lot? | Yes / No | Yes | Recall data quality (backlog INV-15) |

## Stock functions (R1–R5) rollout

| ID | Question | Recommendation |
|---|---|---|
| D-ops-1 | Rollout order of the stock functions | R1 (receive) → R4 (adjust) → R2 (recall) → R3 (returns) → R5 (delete product) |
| D-ops-2 | R5 as a database function or a quick dashboard-only stop-gap | Database function (the only version that can never lose the stock row) |
| D-ops-3 | Expense date for a received delivery | **Already handled on the branch:** the dashboard and R1 both use the Central calendar day. Please just confirm |
| D-ops-6 | Do any agents or automations change stock directly? | Query C sections 5–7 answer this; then you confirm |
| **NEW: PO line guard** | Install `drafts/17_DRAFT_po_line_delete_guard.sql` after R1? It stops a purchase-order line being removed, added or re-quantified while that order is being received (details: `PO_RECEIVE_RACE_REVIEW.md`). Locally, that race left stock no line explains in 2–7 of every 20 tries, even with R1 | Yes, right after R1 (small, one trigger, no data change, has a rollback) |

## Records and documents

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Document categories | Are the 7 document categories right (contract, insurance, certification, license, tax, manufacturing agreement, other)? | Keep / add (e.g. "lab report", "SDS") | Add the ones you really file. Each one is a small, approved database change |
| **Legal hold vs delete** | While a legal hold is active, may a related document or record still be deleted? | **Option 1:** block deletes of anything named on an active hold. Safest legally, but needs a database rule plus a dashboard message. **Option 2:** allow deletes, but show a warning and keep the record of who deleted what. Today nothing checks holds before a delete: orders and expenses are soft-deleted and can be restored, but a document delete also removes the stored file | Option 1 if you expect litigation or regulator requests; otherwise Option 2 with the warning. Ask your lawyer if unsure |
| Permanent product delete (X3-16) | Keep "Delete" for never-used products, or only allow Deactivate? | Keep delete for unused products (today, guarded) / Deactivate only | Keep, as today: it is refused for anything sold, received, quality-checked or recalled |

## Dashboard wording and design

| ID | Question | Recommendation |
|---|---|---|
| F3-02 | Manual orders: pick products from the catalogue (fills in the SKU) instead of typing names? | Yes, before you rely on manual orders for stock or returns |
| F3-01 | Input borders are light grey (low contrast for some eyes). Darken them? | Yes (a visual change you can see in screenshots first) |
| F3-07 | The "This Week" label means the last 7 days. Rename to "Last 7 days"? | Yes |
| Time zone (optional) | Will anyone use the dashboard regularly from outside Central time? If yes, all dates can be forced to Central | Only if yes (`TIMEZONE_CONTRACT.md`) |

## GitHub / process

| ID | Question | Recommendation |
|---|---|---|
| CI-02 | Make the automatic test run a required check before merging? | Yes, after the CI branch (`claude/tests-only-ci-v2`) is reviewed and merged. Only you can change this setting |
| CI-03 | Pin the GitHub Actions used by CI to exact versions (commit hashes)? | Yes |
| X3-25 | Backups: please check the private backups repository's **Actions** tab (read-only) and tell the session whether the latest backup runs are green. The session must not open that repository | Do this before launch |

## Also waiting on you (not decisions)

- **Query C:** run it when you choose (`QUERY_C_OWNER_RUN_GUIDE.md`). It unlocks the R1–R5 install plan.
- **Merging the branch:** it fixes bugs that are live today (manual order dates and duplicates, among others). See the extension reports for the list.
