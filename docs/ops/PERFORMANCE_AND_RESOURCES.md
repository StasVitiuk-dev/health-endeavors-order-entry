# Performance and browser resources

**Status:** CURRENT (2026-10-06, extension 4, workstreams AG and AH). Measured on the mocked backend (no network delay) on the session's container. These are the page's own costs, not Supabase timings.

| Check | Result | Test |
|---|---|---|
| Inventory page, 100 products | 1.5 s to draw | `performance-scale.spec.js` (limit 5 s) |
| Inventory page, 1,000 products | 5.1 s to draw | same (limit 15 s) |
| Inventory page, 10,000 products | about 60 s (only possible past the 1,000-row server limit, where the page now shows its "may be incomplete" notice) | `search-palette.spec.js` (scale test) |
| Accounting "All Time", 1,000 orders | 0.35 s | `performance-scale.spec.js` |
| Accounting "All Time", 20,000 orders (20 paged reads) | 2.3 s | same (limit 60 s) |
| Command palette over 10,000 records | slowest keystroke under 250 ms | `search-palette.spec.js` |
| CSV of 20,000 rows × 8 columns | well under 1 s to build | `helpers-unit.spec.js` |
| Leaks: every page visited 3 more times after a warm-up | event listeners 226 → 226, DOM nodes 8,079 → 8,079, live timers 2 → 2 | `resource-leaks.spec.js` |

**Why the Inventory page is the slowest:** every product row carries its full edit form (hidden until "Edit product"), lots and badges. The cost is linear (no quadratic loop). **P4 (X4-27):** only worth optimising (draw edit forms on demand) if the catalogue approaches 1,000 products.

**Full test suite duration:** about 32 minutes with 2 workers on this container. CI's 40-minute limit on the inactive CI branch is close; see the extension 4 report (CI review).
