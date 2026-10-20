# Pagination and scale audit: every dashboard read

**Status:** CURRENT (2026-10-06, branch `claude/platform-overnight-implementation`; not live).

**Two limits matter:**
- **Row cap.** Supabase returns at most 1,000 rows per request by default, and says nothing when it cuts a reply short.
- **URL length.** API gateways reject URLs past a few KB, so a long `.in(…)` list of ids fails.

Earlier rounds (finding N14, 2026-10-05) fixed silent truncation in Accounting, Tax, Business Health and Daily Summary. They added `fetchAllRows` (paged, with an exact count and a hard error if rows go missing) and `fetchAllRowsIn` (chunked id lists), with >1,000 and 2,500-row tests (`report-totals.spec.js`).

This round reviewed all ~77 read queries in `owner-login.html`. Totals and money are only calculated from complete reads (`fetchAllRows`, `count: 'exact'` heads, or database views).

## Fixed on branch (2026-10-06)

| # | Severity | Where | Problem | Fix | Test |
|---|---|---|---|---|---|
| P1 | MEDIUM | Calendar notes | All event ids went into one URL, silently capped at 300 events. With real (long) calendar ids, ~120 events already exceeded common URL limits, and the error was ignored, so every note vanished without a message | Notes fetched in batches of 50 ids | `scale-urls.spec.js` (120 events with long ids, 8 KB URL limit) |
| P2 | LOW | Customer inquiries | Up to 200 order ids in one URL (~7.5 KB) | `fetchAllRowsIn` (chunks of 150) | `scale-urls.spec.js` (200 inquiries, 6 KB URL limit) |

## Reviewed: bounded by design (no change)

| Query | Why it's fine |
|---|---|
| Recent orders, activity, AI decision log, inquiries list, attention summary | Explicit `.limit(…)` lists of recent items; the page says "recent", and the totals beside them come from complete reads |
| Calendar events | Filtered to the visible day/week/month |
| Order items for one order (Returns form) | Filtered to one order |
| Config tables: agent_controls, ai_model_config, service_status, feature_flags, system_mode, business_rules, sop_documents | Tens of rows at most |
| profiles `.in(updated_by ids)` | A handful of staff |
| Single-row reads (`.single()`, `.maybeSingle()`, `eq('id')`, `head: true` counts) | One row / a count |

## Reviewed: not a problem at launch scale; watch later (LOW)

These lists read the whole table. They would silently show only the first 1,000 rows. None feeds a money or stock total.

| Query | Realistic size | When to revisit |
|---|---|---|
| Products and their stock (Inventory page, PO/QC/recall pickers) | Catalogue size, well under 1,000 | If the catalogue nears 1,000 products |
| Inventory lots (PO page, QC target, recall lot pickers) | One per delivery per product | A few hundred per year; revisit around 800 lots (pickers would quietly miss older lots) |
| Purchase orders list | Tens per year | Years away |
| Quality checks, recalls, documents, legal holds, adverse events, feature requests, suppliers | Slow-growing compliance records | Years away |
| needs_attention (view) | Open reminders and items needing action | Only if hundreds stay open |

A cheap, uniform improvement later: a "showing the first 1,000" notice wherever a list reply has exactly 1,000 rows.
