# Before you approve the push: what changes against `main`, and how it looks

Status: OWNER DECISION REQUIRED (push; palette) · 2026-11-21, figures updated 2026-11-22 · For: Stas
Nothing has been pushed. `main` (`d3db7bc`) is what is live.

## 1. Diff summary against `main`

Counted at the last code commit, `fd6eb97` (the one commit after it adds only this
page and the test record):

**1,019 files changed: 107,931 lines added, 9,805 removed.** 733 commits over `main`.

| Where | Share of the changed files | What it is |
|---|---|---|
| `tests/` | 393 files (39%) | the automated tests (specs, helpers, tools) |
| `docs/` | 333 files (33%) | records, decisions, review items, database drafts and their local tests |
| `design-review/` | 174 files (17%) | picture records of earlier look reviews (no effect on the site) |
| `assets/` | 108 files (11%) | the dashboard's program and styles, split out of the pages; the switched-off previews; the sales pages |
| the six pages (`*.html`) | 6 files | 636 lines added, 9,783 removed (see below) |
| `.github/` | 1 file | one test workflow (`ci.yml`, new): tests only, read-only, no secrets, no deployment |
| `package.json`, `package-lock.json` | 2 files | the list of test tools (Playwright); not loaded by the site |

The six pages (`owner-login.html` and the five others) shrink because their
built-in program and styles moved into separate files under `assets/`, so a
strict security rule can apply. What they do is meant to be unchanged; the tests
cover them.

## 2. What the commits include

| Batch | Dates | Commits | What it is |
|---|---|---|---|
| The ten waiting draft PRs **#26 to #35** | Sept 29 – Nov 2 | 562 | safety fixes (stock never counted twice, failed saves that say so and keep the typed text, double clicks that save once, stale pages that cannot overwrite newer data); US-evening date fixes; readability fixes (Oct 6); the program split into modules; the test suite; database drafts (not installed); sales and growth pages (switched off) |
| After #35 | Nov 2 – Nov 22 | 171 (+1 record) | the square, aligned controls you asked for on Nov 3 (colours restored to the originals the same day); the Nov 7 operations features (scan shipment, reorder planning, invoice and export previews, cycle counts, supplier scorecard and documents — all switched off); your decisions of Nov 14 and Nov 16 (tax pending, payment terms, owner-only stock approval, supplier checklist and storage); accessibility and phone fixes; records |

(Corrected Nov 22: the Nov 21 version said 559 commits up to Oct 31; counted again
from #35's last commit `9173ccf`, which is dated Nov 2, it is 562.) The commits after
#35 also carry the work of Nov 21–22: supplier documents (hand-off to you,
owner-only files), the partial receiving example, the backup restore check with the
drafts installed, the iPhone Duo (folding iPhone) layout check with one fix and
one improvement, four fixes found by tests, and the device checklist.

By kind (roughly, from the commit titles, as counted on Nov 21): documents and records 143; looks,
phone and accessibility 81; features that are switched off or read-only 71;
fixes and safety 68; database drafts and queries 67; sales and growth 64;
tests 58; the rest mixed.

## 3. The 20 picture-comparison failures, page by page

Why they fail: the reference pictures in the test suite were taken on Oct 18 on
the branch, before the restyle. They are **not** pictures of what is live, and
`main` has none. So for this review every screen was photographed twice under
identical test conditions: from live `main` (`d3db7bc`) and from the branch.
Side-by-side images: review package, `1-look-review/side-by-side/`.

| Screen (computer + phone = 2 failures each) | What differs from live | Intended? |
|---|---|---|
| Sign-in | square button and fields | yes — your Nov 3 direction |
| Home | new "Checks: what needs a look" list and "Nightly integrity check" above the reminders; square controls | yes — October features |
| Orders | square buttons; amounts on the right; "partially refunded" in words; revenue leaves out cancelled and refunded orders and says so; on the phone one card per order instead of a table that cut off the status | yes — accounting fix and phone fix (Oct) |
| Orders, dark mode | the above, plus darker button fills | yes — readability (below) |
| Inventory | labelled form fields that line up; shorter explanation with "More about this" | yes — Nov 3 and Nov 16 |
| Returns | labelled form; "Damaged" instead of a code; "Older order number" search | yes |
| Expenses | labelled form; receipt picker styled; the "View receipt" link uses the theme blue instead of the browser's default blue | yes |
| Accounting | "Last 7 days" instead of "This Week" (it always counted 7 days); two new review lists; shorter explanation | yes |
| Tax Records | shorter explanations; amounts on the right; a receipt dated June 2 shows "Jun 2" (live showed "Jun 1, 7:00 PM": a date shifted into the evening before — known bug 9) | yes — a fix |
| Tasks | square buttons; "Recently finished" fold | yes |

**Unintended changes found: none.** No layout or wording change outside the
intended ones above. The reference pictures stay as they are until your styling
review (then they are retaken in one commit).

## 4. The palette

Every colour used on 12 pages, in light and dark, was read from the screen on
live and on the branch and compared. The Nov 3 restyle changed **no** colour.
The only differences come from one commit, `1b85068` (Oct 6, "text contrast in
light and dark"), which fixed text that was below the readability minimum
(4.5 : 1 contrast):

| Where | Live | Branch | Readability, live → branch |
|---|---|---|---|
| Dark mode: blue buttons (Restore, Open, Refresh) | #2997ff fill | #0071e3 fill (the light-mode blue) | 3.02 → 4.70 |
| Dark mode: red Delete / Deny buttons | #ff6961 fill | #d70015 fill (the light-mode red) | 2.82 → 5.38 |
| Light mode: green "low" badge text | #1d8a3f | #187a37 | 4.03 → 4.95 |
| Light mode: grey labels under figures | #86868b | #6e6e73 (the theme grey) | 3.33 → 4.66 |
| Light mode: small grey text in rows | #8a9694 | #6e6e73 | 3.06 → 5.07 |
| Light mode: form label grey | #6b7877 | #6e6e73 | 4.59 → 5.07 |
| Expenses "View receipt" link | browser default blue | theme blue | — |

**Your decision:** keep these readability fixes (recommended: the live colours
fail the minimum, and in dark mode white button text is hard to read), or
restore the exact live colours. Either is a one-commit change; nothing else
depends on it.

## 5. Tests for the exact commit you would approve

Commit `fd6eb97` is the last one that changes the dashboard; the commit after it
adds only this page and the records. Run in Chromium on Linux with every network
call answered by made-up data, and a throwaway local Postgres. Full record:
`docs/ops/NOV7_BOUNDED_REVIEW.md`.

| Check | Passed | Failed | Skipped |
|---|---|---|---|
| Computer size (1100 px), every test | 2,561 | 10 | 66 |
| Phone size (390 px, iPhone profile; not real Safari) | 546 | 10 | 458 |
| Database tests (11 suites, throwaway database) | 528 | 0 | — |

- The 20 failures are the picture comparisons, explained in section 3; they pass
  once the reference pictures are retaken after your styling review.
- Skipped tests are skipped on purpose (one screen size only; the iPhone Duo
  sweep runs only on the phone profile; known issues marked as such).
- The pass before this one (on `ff3d3cb`) found two crashes on malformed input in
  this week's new code; both were fixed in `fd6eb97` and pass here.
- Real Safari, a real iPhone or iPhone Duo, and VoiceOver: your checks (the device
  checklist; the first five are S1, S2, S4, P1, V1).
