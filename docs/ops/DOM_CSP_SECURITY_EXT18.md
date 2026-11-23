# Page markup, script policy and framing (EXT18)

Status: **CURRENT on the feature branch.**

## 1. In plain English

- **Script injection.** Every value from the database, a customer or a person is turned into harmless text before it goes on the page. A tool now lists every place where the page builds HTML. A new place that is not escaped fails the checks until someone reviews it.
- **Script policy.** The browser may run scripts only from this site and from **one exact file**, the pinned Supabase library. Before EXT18 it was any file on the whole CDN.
- **Framing.** If another site puts the dashboard inside a frame, the page hides itself. That stops someone tricking a click on the dashboard.

## 2. DOM sink inventory (`npm run security:sinks`)

| Sink | Count | Rule |
|---|---|---|
| `innerHTML =` | 160 | ceiling 160 (may go down, not up) |
| `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` / `Function`, `setAttribute('on…')` | 0 | must stay 0 |
| `href` / `src` assignment | 2 | ceiling 2 |
| style writes | 47 | CSSOM only (allowed by the policy) |

Values inserted into HTML, by class:

- ESCAPED: 347;
- NUMERIC: 57;
- BUILDER: 20;
- LITERAL: 54;
- REVIEW: 52.

All 52 REVIEW values were read by hand, and each is recorded with its reason in `tests/tools/dom-sinks-reviewed.json` (keyed by file + expression, not line). **No injection hole was found.** The gate fails on any of these:

- a new unreviewed value;
- a reviewed value used more often than reviewed;
- a stale entry;
- an entry without a reason;
- a dangerous sink;
- a raised ceiling.

## 3. Static security check (`npm run security:static`)

**Scripts** are read as syntax trees, so comments and message text cause no false alarms. The check refuses:

- code from strings: `eval`, `Function`, timers given a string;
- `document.write`;
- created `<script>` elements;
- inline `on…=` handlers in markup;
- `javascript:` links;
- `target=_blank` without `noopener`;
- `window.open` without `noopener`;
- navigation to a computed address;
- `.srcdoc` / `.outerHTML`;
- an unreviewed cross-window `message` listener.

**Pages** must have:

- the frame guard as the first script;
- only same-site scripts, or the pinned library with an integrity hash;
- a policy whose `script-src` names that exact file;
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-src 'none'`;
- no unsafe script allowance;
- `referrer: no-referrer`;
- no `<iframe>` / `<object>` / `<embed>` / `<base>`;
- no form posting to another site, and no named password field. A form whose scripts failed to load must never put a password in the address (tested in a browser with scripts off).

Today: **PASS on 27 scripts and 6 pages.** 16 planted script patterns and 11 planted page weakenings are each caught (self-test).

## 4. Script policy (CSP) round 4

| Directive | Value | EXT18 change |
|---|---|---|
| `script-src` | `'self'`, the frame guard's hash, `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js` | **was the whole `https://cdn.jsdelivr.net` host** |
| `style-src` | `'self'` (4 smaller pages also allow Google Fonts' stylesheet) | — |
| `connect-src` | `'self'`, the Supabase project (https + wss) | — |
| `object-src` / `frame-src` / `base-uri` / `form-action` | `'none'` / `'none'` / `'self'` / `'self'` | — |

**Proof:** a browser test injects a script from another package on the same CDN. It is refused, the browser does not even fetch it, and a policy violation is reported. A control run with the old policy shows the same script would have run. Inline script, inline handlers, `javascript:` links, inline styles and foreign stylesheets were already refused (EXT15/16).

**Not possible on GitHub Pages:** `frame-ancestors`, HSTS and other response headers. A `<meta>` policy cannot carry `frame-ancestors`. **We do not fake HSTS:** GitHub Pages serves HTTPS only, but no HSTS header is claimed.

## 5. Framing (clickjacking)

All 6 pages open inside a hostile frame were tested. Each one either hides itself completely (no visible input, button or link) or takes over the whole window. Opened normally, none is hidden.

**Limitation:** a frame with the `sandbox` attribute and no `allow-scripts` stops the guard from running. The page then shows, but none of its scripts run, so sign-in cannot work. The real fix is a `frame-ancestors` header, which needs hosting that can send headers (owner decision, later).

## 6. Trusted Types

Still **not enforced** (see `TRUSTED_TYPES_EVALUATION_EXT17.md`: 86 code locations). EXT18 adds the guard rails needed first:

- an innerHTML ceiling;
- reviewed exceptions;
- zero dangerous sinks.

The reduction waves are planned for EXT19.
