# Screenshots: dashboard extension 8 (2026-10-10)

Captured with `SHOT_SPEC=capture-screenshots-ext8 npx playwright test -c tests/tools/screenshots.config.js` (script: `tests/tools/capture-screenshots-ext8.spec.js`) on branch `claude/platform-deep-readiness-extension-8-2026-10-07` after the code freeze. Page code frozen at **`fc203cb`** (commit `574fb03` changed only tests and docs; no page, helper or CSS file). **Not merged, not deployed.** Every screen uses **synthetic data** from the test mock (screens 18–19: the staging build's in-browser stand-in). **No production system, customer record or live page was used.** Widths: 1100 (desktop), 390 (iPhone), 320 (small phone). Chromium only; real Safari / VoiceOver not tested.

File names: `<date>_<round>_<nn>-<page>_<width>.png`; older packages (`dashboard-extension-7-2026-10-07/`) were not touched.

| File | Page / state | Width | Synthetic | Production |
|---|---|---|---|---|
| `2026-10-10_ext8_01-home-checks_1100.png` | Home: "Checks: what needs a look" with synthetic to-dos and the honest backups line | 1100 | yes | no |
| `2026-10-10_ext8_01-home-checks_320.png` | Home: "Checks: what needs a look" with synthetic to-dos and the honest backups line | 320 | yes | no |
| `2026-10-10_ext8_01-home-checks_390.png` | Home: "Checks: what needs a look" with synthetic to-dos and the honest backups line | 390 | yes | no |
| `2026-10-10_ext8_02-home-check-unknown_1100.png` | Home: one check could not read (approvals), shown as "Could not check" with its reason open; other checks still shown | 1100 | yes | no |
| `2026-10-10_ext8_02-home-check-unknown_320.png` | Home: one check could not read (approvals), shown as "Could not check" with its reason open; other checks still shown | 320 | yes | no |
| `2026-10-10_ext8_02-home-check-unknown_390.png` | Home: one check could not read (approvals), shown as "Could not check" with its reason open; other checks still shown | 390 | yes | no |
| `2026-10-10_ext8_03-home-check-data-problem_1100.png` | Home: received purchase order with a line not in stock: red data problem, no Hide button | 1100 | yes | no |
| `2026-10-10_ext8_03-home-check-data-problem_320.png` | Home: received purchase order with a line not in stock: red data problem, no Hide button | 320 | yes | no |
| `2026-10-10_ext8_03-home-check-data-problem_390.png` | Home: received purchase order with a line not in stock: red data problem, no Hide button | 390 | yes | no |
| `2026-10-10_ext8_04-search-all-orders_1100.png` | Sidebar search: "Look up … in all orders" finds an order older than the loaded ones | 1100 | yes | no |
| `2026-10-10_ext8_04-search-all-orders_320.png` | Sidebar search: "Look up … in all orders" finds an order older than the loaded ones | 320 | yes | no |
| `2026-10-10_ext8_04-search-all-orders_390.png` | Sidebar search: "Look up … in all orders" finds an order older than the loaded ones | 390 | yes | no |
| `2026-10-10_ext8_05-returns-older-order_1100.png` | Returns: older-order finder by number | 1100 | yes | no |
| `2026-10-10_ext8_05-returns-older-order_320.png` | Returns: older-order finder by number | 320 | yes | no |
| `2026-10-10_ext8_05-returns-older-order_390.png` | Returns: older-order finder by number | 390 | yes | no |
| `2026-10-10_ext8_06-orders-bin-show-more_1100.png` | Orders recycle bin: "Showing the 50 most recent of 60" + Show more | 1100 | yes | no |
| `2026-10-10_ext8_06-orders-bin-show-more_320.png` | Orders recycle bin: "Showing the 50 most recent of 60" + Show more | 320 | yes | no |
| `2026-10-10_ext8_06-orders-bin-show-more_390.png` | Orders recycle bin: "Showing the 50 most recent of 60" + Show more | 390 | yes | no |
| `2026-10-10_ext8_07-accounting-last-7-days_1100.png` | Accounting with the "Last 7 days" window | 1100 | yes | no |
| `2026-10-10_ext8_07-accounting-last-7-days_320.png` | Accounting with the "Last 7 days" window | 320 | yes | no |
| `2026-10-10_ext8_07-accounting-last-7-days_390.png` | Accounting with the "Last 7 days" window | 390 | yes | no |
| `2026-10-10_ext8_08-tasks_1100.png` | Tasks page | 1100 | yes | no |
| `2026-10-10_ext8_08-tasks_320.png` | Tasks page | 320 | yes | no |
| `2026-10-10_ext8_08-tasks_390.png` | Tasks page | 390 | yes | no |
| `2026-10-10_ext8_09-approvals_1100.png` | Approval queue | 1100 | yes | no |
| `2026-10-10_ext8_09-approvals_320.png` | Approval queue | 320 | yes | no |
| `2026-10-10_ext8_09-approvals_390.png` | Approval queue | 390 | yes | no |
| `2026-10-10_ext8_10-incidents_1100.png` | Incidents page | 1100 | yes | no |
| `2026-10-10_ext8_10-incidents_320.png` | Incidents page | 320 | yes | no |
| `2026-10-10_ext8_10-incidents_390.png` | Incidents page | 390 | yes | no |
| `2026-10-10_ext8_11-inventory_1100.png` | Inventory page | 1100 | yes | no |
| `2026-10-10_ext8_11-inventory_320.png` | Inventory page | 320 | yes | no |
| `2026-10-10_ext8_11-inventory_390.png` | Inventory page | 390 | yes | no |
| `2026-10-10_ext8_12-purchase-orders_1100.png` | Purchase orders page | 1100 | yes | no |
| `2026-10-10_ext8_12-purchase-orders_320.png` | Purchase orders page | 320 | yes | no |
| `2026-10-10_ext8_12-purchase-orders_390.png` | Purchase orders page | 390 | yes | no |
| `2026-10-10_ext8_13-tax-records_1100.png` | Tax Records page | 1100 | yes | no |
| `2026-10-10_ext8_13-tax-records_320.png` | Tax Records page | 320 | yes | no |
| `2026-10-10_ext8_13-tax-records_390.png` | Tax Records page | 390 | yes | no |
| `2026-10-10_ext8_14-agents_1100.png` | Agents page (switched-off agents shown as off, not broken) | 1100 | yes | no |
| `2026-10-10_ext8_14-agents_320.png` | Agents page (switched-off agents shown as off, not broken) | 320 | yes | no |
| `2026-10-10_ext8_14-agents_390.png` | Agents page (switched-off agents shown as off, not broken) | 390 | yes | no |
| `2026-10-10_ext8_15-settings-flags_1100.png` | Feature switches page | 1100 | yes | no |
| `2026-10-10_ext8_15-settings-flags_320.png` | Feature switches page | 320 | yes | no |
| `2026-10-10_ext8_15-settings-flags_390.png` | Feature switches page | 390 | yes | no |
| `2026-10-10_ext8_16-customer-questions_1100.png` | Customer questions (every waiting question listed) | 1100 | yes | no |
| `2026-10-10_ext8_16-customer-questions_320.png` | Customer questions (every waiting question listed) | 320 | yes | no |
| `2026-10-10_ext8_16-customer-questions_390.png` | Customer questions (every waiting question listed) | 390 | yes | no |
| `2026-10-10_ext8_17-home-empty-database_1100.png` | Empty database: Home checks stay honest (no false alarms; backups still UNKNOWN) | 1100 | yes | no |
| `2026-10-10_ext8_17-home-empty-database_320.png` | Empty database: Home checks stay honest (no false alarms; backups still UNKNOWN) | 320 | yes | no |
| `2026-10-10_ext8_17-home-empty-database_390.png` | Empty database: Home checks stay honest (no false alarms; backups still UNKNOWN) | 390 | yes | no |
| `2026-10-10_ext8_18-staging-sign-in_1100.png` | STAGING copy: banner, read-only sign-in fields, synthetic-owner button | 1100 | yes | no |
| `2026-10-10_ext8_18-staging-sign-in_320.png` | STAGING copy: banner, read-only sign-in fields, synthetic-owner button | 320 | yes | no |
| `2026-10-10_ext8_18-staging-sign-in_390.png` | STAGING copy: banner, read-only sign-in fields, synthetic-owner button | 390 | yes | no |
| `2026-10-10_ext8_19-staging-home_1100.png` | STAGING copy after synthetic sign-in: Home with banner | 1100 | yes | no |
| `2026-10-10_ext8_19-staging-home_320.png` | STAGING copy after synthetic sign-in: Home with banner | 320 | yes | no |
| `2026-10-10_ext8_19-staging-home_390.png` | STAGING copy after synthetic sign-in: Home with banner | 390 | yes | no |

Known visual limitations (pre-existing, not new in EXT8): at 390 / 320 px wide tables scroll sideways inside their panel (X7-15); at 390 px the "Why is this here?" text in a Checks row wraps beside the buttons. Error toasts (screen 02) overlap the bottom of the page until dismissed.
