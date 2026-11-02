# Visual failures — per-image inspection ledger (closes matrix 018) — 2026-11-01

Scope: the 20 `visual.spec.js` screenshot failures from the full suite. Each was
inspected by **viewing the actual, expected and (where same-size) diff images**,
not inferred from ratios or other specs. Artifacts regenerated this session by
re-running `visual.spec.js` on Chromium **1243** (the diagnostic browser; the
pinned **1194** cannot be downloaded here). Expected images are the committed
`tests/specs/visual.spec.js-snapshots/*-{desktop,iphone}-linux.png` baselines
(built on 1194). **No baseline was regenerated or refreshed** — the failures are
left intact.

Method: same-size cases → ImageMagick AE + full expected|actual|diff montage,
viewed. Height-differs cases (width identical) → cannot pixel-diff; viewed the
**full expected|actual montage for every panel** (both viewports) — initially via
header + footer strips, then the middle of all eight panels was viewed in full
(ordersPanel, tasksPanel, expensesPanel, accountingPanel, returnsPanel,
taxRecordsPanel, inventoryPanel, attentionPanel). So all 20 are FULL-IMAGE
inspected, not strip-only. Montages under `scratchpad/vis-montage/`.

| # | case | viewport | size exp→act | what I saw (viewed images) | verdict |
|---|---|---|---|---|---|
| 1 | login-screen | desktop | 1100x800 = | card identical (Health Endeavors / Owner sign-in / Email / Password / Log in / Forgot password); diff = AA edge noise inside the card box only | harmless raster/AA |
| 2 | login-screen | iphone | 390x844 = | same card, same fields/buttons; diff = AA + sub-px horizontal text offset | harmless raster/AA |
| 3 | dark-theme-Orders | desktop | 1100x800 = | identical layout+data (5 orders, $380.00, SYN-1001..1005, sidebar, Recycle bin, Restore); diff = AA on every glyph, amplified on dark bg (ratio 0.11) | harmless raster/AA |
| 4 | dark-theme-Orders | iphone | 390x844 = | same cards/data; diff shows small vertical text doubling = few-px reflow + AA | harmless reflow/AA |
| 5 | accountingPanel | desktop | 832x980→961 | header "Accounting" + description identical; description wraps 1 line shorter in actual (−19px); bottom padding identical | harmless reflow |
| 6 | accountingPanel | iphone | 358x1168→1228 | header+desc identical; desc wraps longer (+60px); bottom identical | harmless reflow |
| 7 | attentionPanel | desktop | 832x1635→1657 | identical KPI tiles + "Checks" list (Overdue 2 / Low stock 1 / Returns 3 / Low-stock level not set 1) + Open/Hide controls | harmless reflow |
| 8 | attentionPanel | iphone | 358x2347→2386 | same tiles + checks; +39px distributed reflow | harmless reflow |
| 9 | ordersPanel | desktop | 832x642→647 | bottom identical: Recycle bin + "SYN-0999 … $30.00" + Restore button present in both | harmless reflow |
| 10 | ordersPanel | iphone | 358x1683→1692 | header + bottom padding identical (+9px) | harmless reflow |
| 11 | inventoryPanel | desktop | 832x1305→1335 | full view: all fields present (name/SKU/Draft/Cost/Retail/Wholesale/Packaging/Add product/Adjust stock) | harmless reflow |
| 12 | inventoryPanel | iphone | 358x1555→1667 | full view: Draft+Cost share a row in expected, stack in actual at 358px (flex-wrap tip from font metrics); all fields present+usable (+112px) | harmless reflow (field wrap) |
| 13 | returnsPanel | desktop | 832x1211→1218 | header "Returns" + status-flow text identical; wraps 1 line differently; bottom identical | harmless reflow |
| 14 | returnsPanel | iphone | 358x1602→1646 | header+desc identical; +44px wrap reflow; bottom identical | harmless reflow |
| 15 | expensesPanel | desktop | 832x1254→1261 | header "Expenses" + desc identical; bottom identical | harmless reflow |
| 16 | expensesPanel | iphone | 358x1509→1514 | header+desc identical (+5px); bottom identical | harmless reflow |
| 17 | tasksPanel | desktop | 832x470→474 | bottom identical: "SYNTHETIC overdue open task / low / Open / Mark done / Mark in progress / Recently finished" all present | harmless reflow |
| 18 | tasksPanel | iphone | 358x984→980 | header + bottom identical (−4px) | harmless reflow |
| 19 | taxRecordsPanel | desktop | 832x1536→1519 | header "Tax Records" + desc identical; wraps shorter (−17px); bottom identical | harmless reflow |
| 20 | taxRecordsPanel | iphone | 358x2016→2052 | header+desc identical; +36px wrap reflow; bottom identical | harmless reflow |

## Findings
- **Confirmed product defects: 0.** No case showed lost content, clipping,
  controls pushed out of a usable region, overlap, or broken layout. Headers,
  section titles, table rows, action buttons (Restore / Mark done / Add product)
  and footers are present in both expected and actual for every case.
- **Root cause (all 20):** Chromium 1243 vs the 1194 baselines — font
  anti-aliasing (same-size cases) and font-metric line-wrap/height reflow
  (height-differs cases). Mixed ± height deltas confirm reflow, not truncation
  (truncation would be uniformly shorter).
- **One notable reflow:** inventoryPanel iphone — the Draft/Cost field pair wraps
  to two rows at 358px in 1243. Both layouts are fully usable on a phone; this is
  acceptable responsive behaviour, not a defect. (It could land either way in
  real Safari depending on font metrics — a manual-device note, not a bug.)

## Colour-state observations (use-of-colour, WCAG 1.4.1) — not new defects
While viewing the panels I noted two places that use colour for emphasis, each
with a text equivalent present, so they are acceptable (not colour-only) — logged
for a manual forced-colors/AT confirm, not fixed:
- **tasksPanel / attention overdue rows** use a red row background for "overdue".
  The past **Due date** is shown as text on every row, so the state is not
  conveyed by colour alone.
- **Segmented period toggles** (Accounting / Tax Records: Today·Last 7 days·This
  Month·All Time / This Year·Last Year·All Time) show the selected option with a
  filled background. Each option has a visible text label, and under forced-colors
  the UA still distinguishes the pressed control. Candidate manual-AT confirm.
These are existing design choices with text equivalents; changing them was not
warranted. The forced-colors fix (focus outlines) is the only change made.

## What is closed vs still open
- **Matrix 018 (per-image inspection): CLOSED** — every image was viewed; the
  content-integrity question is answered (no lost/clipped content).
- **Exact pinned-browser (1194) pixel acceptance: STILL OPEN / BLOCKED** —
  inspection ran on 1243 (download 403). Committed baselines left UNCHANGED (no
  refresh that would erase the failures or bake in 1243 renders). To finish:
  `npx playwright test tests/specs/visual.spec.js` on Playwright 1.56.1 with the
  matched 1194 Chromium and NO executablePath override, in an env that can reach
  cdn.playwright.dev. That run is expected to pass or to surface only the same
  harmless reflow, which may then warrant a deliberate baseline refresh — an
  owner call, not done here.
