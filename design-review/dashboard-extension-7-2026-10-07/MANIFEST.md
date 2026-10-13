# Screenshots: dashboard extension 7 (2026-10-07)

Captured with `npx playwright test -c tests/tools/screenshots.config.js` from the code at commit **`a6a1cc32bb2919455c178da286d3bc923ff546cc`** on branch `claude/platform-deep-readiness-extension-7` (not merged, not deployed). Every screen uses **synthetic data** served by the test mock (`tests/helpers/mock-supabase.js`). **No production system, customer record or live page was used.** Widths: 1100 (desktop), 390 (iPhone), 320 (small phone). Chromium only; real Safari not tested.

| File | Page / state | Width | Commit | Synthetic | Production |
|---|---|---|---|---|---|
| `01-home-business-health-1100.png` | Home: Business Health tiles (work tiles open their page) | 1100 | `a6a1cc3` | yes | no |
| `01-home-business-health-320.png` | Home: Business Health tiles (work tiles open their page) | 320 | `a6a1cc3` | yes | no |
| `01-home-business-health-390.png` | Home: Business Health tiles (work tiles open their page) | 390 | `a6a1cc3` | yes | no |
| `02-home-unknown-tile-1100.png` | Home: one read failed, its tile shows "?" with a plain reason; other tiles still show | 1100 | `a6a1cc3` | yes | no |
| `02-home-unknown-tile-320.png` | Home: one read failed, its tile shows "?" with a plain reason; other tiles still show | 320 | `a6a1cc3` | yes | no |
| `02-home-unknown-tile-390.png` | Home: one read failed, its tile shows "?" with a plain reason; other tiles still show | 390 | `a6a1cc3` | yes | no |
| `03-tasks-recently-finished-1100.png` | Tasks with Recently finished open (Reopen only on a finished task) | 1100 | `a6a1cc3` | yes | no |
| `03-tasks-recently-finished-320.png` | Tasks with Recently finished open (Reopen only on a finished task) | 320 | `a6a1cc3` | yes | no |
| `03-tasks-recently-finished-390.png` | Tasks with Recently finished open (Reopen only on a finished task) | 390 | `a6a1cc3` | yes | no |
| `04-continuity-unknown-1100.png` | Business Continuity: unknown / missing status shown as Unknown and counted | 1100 | `a6a1cc3` | yes | no |
| `04-continuity-unknown-320.png` | Business Continuity: unknown / missing status shown as Unknown and counted | 320 | `a6a1cc3` | yes | no |
| `04-continuity-unknown-390.png` | Business Continuity: unknown / missing status shown as Unknown and counted | 390 | `a6a1cc3` | yes | no |
| `05-approvals-1100.png` | Approval queue (open requests only) | 1100 | `a6a1cc3` | yes | no |
| `05-approvals-320.png` | Approval queue (open requests only) | 320 | `a6a1cc3` | yes | no |
| `05-approvals-390.png` | Approval queue (open requests only) | 390 | `a6a1cc3` | yes | no |
| `06-tax-by-state-1100.png` | Tax Records: sales tax by state (one row per state however it is spelled) | 1100 | `a6a1cc3` | yes | no |
| `06-tax-by-state-320.png` | Tax Records: sales tax by state (one row per state however it is spelled) | 320 | `a6a1cc3` | yes | no |
| `06-tax-by-state-390.png` | Tax Records: sales tax by state (one row per state however it is spelled) | 390 | `a6a1cc3` | yes | no |
| `07-suppliers-form-1100.png` | Suppliers: add form (same-name question on save) | 1100 | `a6a1cc3` | yes | no |

Known visual limitation (pre-existing pattern, not new in EXT7): at 390 px and 320 px the wide tables (Tasks, Recently finished) scroll sideways inside their panel, so the last column is cut off until scrolled.

## Preview

No safe live preview exists without deploying: GitHub Pages publishes only `main`, and publishing this branch would mean changing Pages settings or merging, both forbidden in this session. **Offline preview:** these screenshots, or check out the branch and open `owner-login.html` through the test mock (`npm test` shows it is fully mocked). **Smallest owner-approved step for a staging preview:** a separate, private staging repository (or a second Pages site) that the owner creates, pointed at a throwaway Supabase project, never the production one. Not done.
