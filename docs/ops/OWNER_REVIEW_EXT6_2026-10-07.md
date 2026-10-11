# Owner review package: extension 6 (2026-10-07)

Plain English, one page. The full evidence is in `DEEP_PLATFORM_EXTENSION_6_2026-10-07.md`.

**A. What was fixed** (on the branch, with tests that fail on the old code)
- Revenue figures now follow one rule everywhere. The Daily Summary and the home page counted cancelled and refunded orders. The Orders page's "Total revenue" covered only the newest 300 orders.
- A total that is really zero no longer shows "-$0.00". Figures no longer follow a foreign computer's number format.
- Signing out now wipes the page, so the next person on a shared computer sees none of the previous data.
- Manual orders saved without their items can be finished safely ("Finish this order"), instead of being re-entered as a second order. They are also listed on Accounting.
- Emergency mode says "may or may not" when it truly cannot tell, instead of a wrong "NOT".
- Plain words for database "collisions" and time-outs, a warning when orders are in more than one currency, and more.

**B. What is still dangerous on live `main` today**
- The revenue figures above (Daily Summary, home tile, Orders page), and "-$0.00".
- Signing out leaves the previous person's customer data in the page.
- Receiving a delivery uses the page's old copy of the order (fixed in EXT5, still not merged).
- Money totals can count an order twice if one arrives while the page reads (fixed in EXT5).
- `dashboard.html` shows database text without escaping.
- Stock changes are not all-or-nothing until R1–R5 are installed (only the database can fix this).

**C. Branches involved:** `claude/platform-deep-readiness-extension-6`. It contains extension 5, extension 4, extension 3, the overnight branch, the project record and all 20 open PRs (#5–#24). The CI workflow branches are deliberately separate.

**D. Overlaps:** every open PR is already inside the extension branch. Merging the branch makes the PRs redundant (no conflicts). Merging PRs one by one in another order would conflict.

**E. What can merge on its own:** the extension branch as a whole. It needs **no database change**; it works against today's database. Individual PRs can't be merged in isolation without conflicts.

**F. What needs SQL first:** nothing in the branch. These *later* dashboard changes need SQL first: calling R1–R5 (INV-06) and sending request keys (X6-15).

**G. SQL waiting on a decision:** R1–R5 (Query C first, then D-ops-1/2/6) · PO line guard (approval) · request keys (approval) · one recall per lot (D-ops-4) · permission fixes from Query D.

**H. Exact test results:** see the "Final evidence" section of the EXT6 report (full suite, three-times repeats, mutations, database tests), all on the final commit.

**I. Unresolved failures:** see the same section. Anything not clean is written there plainly.

**J. Rollback:** nothing is merged. After a merge, use GitHub's "Revert" on the merge commit; Pages republishes in 1–5 minutes; then hard refresh (Cmd+Shift+R). Database drafts each have a tested rollback file (11, 18, 20).

**K. Suggested order**
1. Backup check (2 minutes, read-only).
2. Fix the GitHub access (X6-17).
3. Review and merge the extension branch.
4. Check the live site (sign in, open Accounting and Daily Summary, sign out).
5. Run Query E and Query C (read-only).
6. Install the PO line guard.
7. Install R1–R5, then the dashboard change that calls them.
8. Request keys, then their dashboard change.

**L. Evidence still missing**
- Backup health.
- Query C results (other stock writers, agent states) and Query D (elevated functions).
- A real iPhone / VoiceOver check.
- Supabase-specific timings (the local tests run on PostgreSQL 16).
