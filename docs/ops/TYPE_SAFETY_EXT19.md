# Type safety (EXT19)

Status: **CURRENT on the feature branch.** Plain JavaScript checked by the TypeScript checker (`checkJs`); nothing is compiled or converted.

## 1. What changed

| Measure | EXT18 | EXT19 |
|---|---|---|
| Files checked | 21 (modules, registry, helpers) | **27: the whole program** (adds the owner program, theme, dashboard, search, manual order and change-password scripts) |
| Gated defects (unknown names, unused declarations, unreachable code, fall-through, impossible comparisons, wrong argument counts) | 0 | **0** |
| Other diagnostics (reported, not enforced) | 52 | 478, of which 459 are DOM typing (`.value` on an `HTMLElement`) |

## 2. What the wider check found and fixed

- Three imports the owner program never used (`BUSINESS_RULE_WHOLE_NUMBER_LIMITS`, `UPLOAD_MAX_BYTES`, `colorForCalendar`).
- `INSPECTOR_ROW`: a variable that was written but never read (dead state).
- The Supabase library global is declared for the smaller pages (it was an "unknown name" there).

## 3. Reviewed and left as they are

- **Date subtraction** (`new Date(a) - new Date(b)`, 5 places): valid JavaScript.
- **The `showPage` wrapper**: a deliberate reassignment (Back/Forward history).
- **`form.reset()` / `input.select()`**: DOM typing only.

## 4. Commands

`npm run types:check` (gate). `node tests/tools/typecheck.js --all` lists every diagnostic.
