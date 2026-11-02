# CSP and inline-style report (EXT15)

Status: **CURRENT on the feature branch only.** Live only after Stas merges.

## 1. In plain English

The owner dashboard tells the browser, through its Content Security Policy (CSP), where code and styling may come from. Until EXT14 the policy still had to allow *inline styles* (`style-src 'self' 'unsafe-inline'`), because the page wrote 325 `style="…"` attributes into its HTML. An allowance for inline styles is a small but real hole: injected text could restyle the page (for example hide a warning or fake a button).

EXT15 removed every one of those 325 inline styles and the allowance with them. The owner page's policy is now **`style-src 'self'`**: styling only from the site's own CSS file. The screens look the same (checked pixel-for-pixel, §4).

## 2. What changed

| | Before (3a40095) | After |
|---|---|---|
| `style="…"` in `owner-login.html` | 135 | 0 |
| `style="…"` written by the program | 190 | 0 (program + 16 modules) |
| owner page `style-src` | `'self' 'unsafe-inline'` | `'self'` |
| owner page `script-src` | `'self'` + pinned library | unchanged (already strict since EXT14) |
| Utility classes generated | — | 129 (`u-<property>-<value>`, in `assets/owner-login.css` between markers) |

How:

1. **Mechanical conversion** (`node tests/tools/inline-styles.js --write`): each declaration becomes one class, e.g. `style="font-size:11px;color:var(--muted)"` → `class="u-fs-11 u-c-muted"`. Utility classes use `!important` so they keep the priority the inline style had, **except `display`**: the page shows and hides things by setting `element.style.display` from JavaScript, and that must keep winning.
2. **Dynamic values by hand** (values computed at run time cannot be classes):
   - sidebar group colours → `data-group-color` + `element.style.setProperty('--groupColor', c)` **only if `c` is a plain hex colour** (`/^#[0-9a-fA-F]{3,8}$/`); anything else is ignored;
   - system-mode pill → class `modePill` + colours set through the CSS object model;
   - agent job health → classes `u-c-danger` / `u-c-warn` / `u-c-muted`.
   Setting styles through the CSS object model (`el.style.x = …`) is allowed by `style-src 'self'`; only style *attributes in HTML text* and `<style>` blocks are blocked.
3. **Hidden-by-class fallout fixed**: two toggles (activity details, product edit) checked `box.style.display === 'none'`, which is no longer true when the element starts hidden by a class. They now read `getComputedStyle(box).display`. Found by the browser tests, fixed before any commit.

The move proof (`verify-moves.js --styles`) first applies step 1 to the old program, so the only edits outside the mechanical conversion are the named ones in `APPLICATION_MODULE_MAP_EXT15.md` §5.

## 3. Checks

| Check | What it proves |
|---|---|
| `npm run styles:check` (also in CI) | no static `style="…"` left in the owner page, program or modules, and the generated CSS block is current |
| `tests/specs/csp-strict-ext15.spec.js` → policy test | the shipped policy has no `'unsafe-inline'` in `style-src` or `script-src` |
| → normal use | visiting every page and overlay causes **zero** CSP violation reports |
| → deliberate breaks | an inline script, inline handler, `javascript:` link, injected external script, inline style attribute, injected `<style>` and a foreign stylesheet are each **blocked** by the browser (violation reported, no effect) |
| → CSSOM | styles set by the page itself through the CSS object model still work |
| → group colour | a configured colour that is not plain hex (e.g. `red;background:url(…)`) is not applied |
| Page mutation `style-src unsafe-inline` | putting `'unsafe-inline'` back is caught by the test suite |

## 4. Visual equality

`tests/tools/style-snapshot.spec.js` + `style-diff.js` render every owner-dashboard page on rich synthetic data before and after, at desktop and iPhone size with reduced motion, and compare the computed style of every element: **IDENTICAL**. (A first run showed opacity-only differences from transitions still running; reduced motion plus a 600 ms settle removed them.)

## 5. DOM sink audit (where text becomes HTML)

`node tests/tools/dom-sinks.js` (add `--review` for the list):

| Sink | Count |
|---|---|
| `innerHTML =` | 160 |
| `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` / `new Function`, `setAttribute('on…')` | 0 each |
| `href` / `src` assignments | 2 (fixed internal values) |
| style writes (CSSOM) | 47 |

Every `${…}` inside HTML-producing templates is classed: ESCAPED 347 (passed through `esc()` etc.), NUMERIC 57, BUILDER 20 (calls a function that builds escaped HTML), LITERAL 53, REVIEW 52. The REVIEW items were read by hand; the riskiest (account number, detail lines, lot options, incident labels, live signal) are escaped where the value is built. `tests/specs/xss-property-ext15.spec.js` puts randomized hostile strings (seeded, reproducible) into every text field the mock database returns and checks that no element, attribute or script appears that was not in the page.

## 6. Not done (remaining)

| Item | Status |
|---|---|
| `change-password.html`, `dashboard.html`, `index.html`, `manual-order-entry.html`, `search.html` still allow `'unsafe-inline'` styles (each has one `<style>` block and 1–5 style attributes; `index.html` and `manual-order-entry.html` also have one inline script) | **PROPOSED** follow-up: same method, small pages; kept out to keep this PR focused on the owner page |
| `style-src` hashes/nonces | not needed: nothing inline remains on the owner page |
| Trusted Types (`require-trusted-types-for 'script'`) | **PROPOSED** evaluation: would make all 160 `innerHTML` sinks go through one policy; large change |
| Real Safari | not verified (no Safari here); Chromium only. Safari supports `style-src 'self'` and CSSOM writes the same way |
