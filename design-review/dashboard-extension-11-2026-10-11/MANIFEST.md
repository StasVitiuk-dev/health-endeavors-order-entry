# Screenshots: dashboard extension 11 (2026-10-11)

Captured with `SHOT_SPEC=capture-screenshots-ext11 npx playwright test -c tests/tools/screenshots.config.js` on branch `claude/platform-ext11-final-readiness-2026-10-11`. Page code frozen at **`32c05e2`**. **Not merged, not deployed.** Synthetic data only (test mock); no production system or customer record used. Widths 1100 / 390; Chromium only (not a real iPhone).

| File | Page / state | Width | Synthetic | Production |
|---|---|---|---|---|
| `2026-10-11_ext11_01-system-status-nothing-installed_1100.png` | System status as it will look right after the merge, before any SQL: every step "not installed", switches all OFF | 1100 | yes | no |
| `2026-10-11_ext11_01-system-status-nothing-installed_390.png` | System status as it will look right after the merge, before any SQL: every step "not installed", switches all OFF | 390 | yes | no |
| `2026-10-11_ext11_02-system-status-switch-problem_1100.png` | System status when a switch is ON without its database step: PROBLEM names it | 1100 | yes | no |
| `2026-10-11_ext11_02-system-status-switch-problem_390.png` | System status when a switch is ON without its database step: PROBLEM names it | 390 | yes | no |
| `2026-10-11_ext11_03-home-revenue-missing-total_1100.png` | Home: today's revenue says an order without a total is not counted (X11-01) | 1100 | yes | no |
| `2026-10-11_ext11_03-home-revenue-missing-total_390.png` | Home: today's revenue says an order without a total is not counted (X11-01) | 390 | yes | no |
| `2026-10-11_ext11_04-return-lost-connection-saved_1100.png` | Returns: lost connection after the return was saved; the restock did NOT run; row says "Chosen outcome" (X11-02, X11-06) | 1100 | yes | no |
| `2026-10-11_ext11_04-return-lost-connection-saved_390.png` | Returns: lost connection after the return was saved; the restock did NOT run; row says "Chosen outcome" (X11-02, X11-06) | 390 | yes | no |
