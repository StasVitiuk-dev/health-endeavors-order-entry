# Security policy (CSP) report (EXT16): all six dashboard pages

Status: **CURRENT on the feature branch only.** Builds on `CSP_AND_INLINE_STYLE_REPORT_EXT15.md` (owner page).

## 1. In plain English

Every dashboard page tells the browser where code and styling may come from. After EXT15 only the owner page refused inline styles; the five smaller pages still allowed them, and the two manual-order pages also allowed inline scripts. **EXT16 removes every `'unsafe-inline'` from every dashboard page.** A test now fails if any page brings one back.

## 2. Before → after

| Page | style-src before | after | script-src before | after |
|---|---|---|---|---|
| owner-login.html | `'self'` (EXT15) | unchanged | strict + 1 hash | unchanged |
| change-password.html | `'self' 'unsafe-inline'` | `'self'` | strict + 1 hash | unchanged |
| dashboard.html | `'self' 'unsafe-inline'` + fonts | `'self'` + fonts | strict + 1 hash | unchanged |
| search.html | `'self' 'unsafe-inline'` + fonts | `'self'` + fonts | strict + 1 hash | unchanged |
| index.html | `'self' 'unsafe-inline'` + fonts | `'self'` + fonts | **`'self' 'unsafe-inline'`** | **`'self'` + frame-guard hash** |
| manual-order-entry.html (identical to index.html) | same | same | same | same |

Inline style attributes: 14 → 0 on these pages (2 + 1 + 5 + 5 + 1); `<style>` blocks: 5 → 0 (moved to `assets/change-password.css`, `assets/dashboard-page.css`, `assets/search-page.css`, `assets/manual-order-entry.css`, fingerprinted with `?v=`). Inline scripts: the 430-line order-entry script moved to `assets/manual-order-entry.js`; its inline `onerror` handler removed.

## 3. Behaviour that had to change

- **AI spend bar** (`dashboard.html`): its width was an inline style inside generated HTML (would be blocked). Now set through the CSS object model after drawing (allowed), clamped to 0–100%.
- **Library refused** (`index.html` / `manual-order-entry.html`): the page used to throw a script error with no message. It now says "This page couldn't load a required file…", like the other pages.
- Elements that start hidden use a `startHidden` class instead of `style="display:none"`; the scripts still show them by setting `element.style.display`, which wins over the class.

## 4. Tests

- `csp-strict-ext15` › "ALL dashboard pages": no `'unsafe-inline'` or `'unsafe-eval'`, `object-src 'none'`, no style attributes, no `<style>`, no inline handlers; **any inline script must match a hash named in that page's policy** (the frame guard).
- `pages-strict-ext16` (16 tests): spend bar width = 25% for $7.50 of $30; refused library message on both order-entry pages; every page loads with no policy violation and its own stylesheet applied.
- Existing page tests pass (manual orders, library pin, CSP, safety, staging).
- Mutants caught: `'unsafe-inline'` put back on the order page; spend bar width removed.

## 5. Not done

- Trusted Types (would route all `innerHTML` through one policy): not evaluated in EXT16 (EXT17 phase 32–37).
- Real Safari: NOT VERIFIED (Chromium only).
