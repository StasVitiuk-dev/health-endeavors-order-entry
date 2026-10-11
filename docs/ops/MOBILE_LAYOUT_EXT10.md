# Phone layout and mobile table strategy (EXT10, U38)

**Status:** CURRENT (2026-10-11). Implemented in branch `claude/platform-ext10-operations-hardening-2026-10-11`, tested locally (Chromium at phone sizes). **Not merged, not deployed.** Real iPhone Safari / VoiceOver: NOT VERIFIED (see `MANUAL_DEVICE_CHECKLIST_EXT9.md`).

## 1. Audit (before the change)

All 30 pages at 320, 360, 375, 390, 414, 430 and 768 px, with the standard synthetic data:

| Finding | Widths | Size |
|---|---|---|
| Page itself scrolls sideways | none | 0 px (already fixed in EXT8/9) |
| Tasks: open tasks table needed sideways scrolling inside its box | 320–430 | +227 px at 320, +157 px at 390 |
| Tasks: "Recently done" table | 320–414 | +98 px at 320 |
| Orders, Purchase order lines, Incidents, AI decisions, Report history, Tax receipts | (empty in the standard data) | wide by design: 5–9 columns, buttons or an input in a row |

## 2. Strategy per table

| Table | Columns | Phone strategy | Why |
|---|---|---|---|
| Tasks (open, recently done) | 3–4 + buttons | **Card per row** | Buttons were partly off-screen without scrolling |
| Orders | 5 + Delete | **Card** | Delete button must never be hidden off to the side |
| Purchase order lines | 7 + lot field | **Card** | The lot field is typed into during receiving |
| Incidents | 5 | **Card** | Title wraps instead of being cut |
| AI decisions | 5 | **Card** | Long summaries |
| Report history | 9 | **Card** | Nine numbers cannot fit in 390 px |
| Tax: expenses missing a receipt | 4 | **Card** | Vendor names wrap |
| Change history in the record inspector (Field / Before / After) | 2–3 | **Fits** (kept table) | Already fits; values wrap |
| AI model setup | 4 | **Intentional sideways scroll** | Rarely used, read-only, short values |
| Accounting by category, tax by state | 2–3 | **Fits** | — |
| Tablet 768 px and desktop | all | **Normal table** | Room for every column |

**Column priority:** the first column (title, order number, item) becomes the card heading; the remaining columns appear as "label … value" lines in their original order; cells without a header (row buttons) sit at the bottom. **Detail view:** tapping a row still opens the record inspector as a bottom sheet (unchanged).

## 3. How it works (for reviewers)

- A table opts in with `class="phoneCards"`. Below 600 px the CSS (`assets/owner-login.css`, "EXT10 (U38)") draws each row as a card.
- `labelPhoneCards()` in `owner-login.html` labels each cell with its column name (`data-label`) when the table appears, and sets explicit `table/row/cell/columnheader` roles so screen readers keep treating it as a table even though the layout changes. The header row is visually hidden, not removed.
- Overdue rows keep their red marking (the whole card is tinted and outlined).
- No data, query or button behaviour changed. Tests that address cells by position still pass.

## 4. Tests

`tests/specs/mobile-cards-ext10.spec.js`: at 320/360/375/390/414/430 px every card table has 0 px inner overflow, every value is labelled, no button or field is off-screen, roles present; label drawn next to the value; desktop and 768 px keep the normal table; purchase order lines with the lot field at 320 px. Phone visual references for Orders, Tasks, Tax Records and dark Orders were updated (reviewed by eye). Existing `mobile-tasks`, `layout-sweep-ext9`, `responsive-widths`, `phone-po-tap` pass.

## 5. Rollback

Remove `class="phoneCards"` from a template (or revert the commit): the table returns to the earlier sideways-scroll behaviour. No data involved.

## 6. Still open

- Real iPhone Safari: confirm VoiceOver reads "Customer, SYNTHETIC …" once (the label is drawn with CSS `::before`; some screen readers also read generated content, which would duplicate the column name). Manual check item M-38 added to the device checklist list in `UNFINISHED_WORK_EXT10.md`.
- Lists that are not tables (approvals, recycle bins, flags) already wrap (EXT5); not changed.
