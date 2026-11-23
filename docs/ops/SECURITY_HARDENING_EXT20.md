# Security hardening (EXT20)

Status: **CURRENT on the feature branch.** Local and synthetic only. Local security tests do not prove a system cannot be hacked.

## 1. Changes

| Area | Change | Proof |
|---|---|---|
| Raw HTML | 51 fixed-text HTML strings and the toast skeleton are built as elements. Trusted Types violations 86 → **56**; `innerHTML` assignments 159 → **109** | `trusted-types-ext20.spec.js` (ratchet ≤ 56), 2,000 hostile toasts, 3 mutants |
| CI supply chain | database service image pinned to `postgres:16@sha256:ca0bd484…641d`, the digest read from Docker Hub's registry on 2026-10-17 (not invented) | `ci-guard-ext14.spec.js`: every `image:` must carry `@sha256:` (verified it fails when unpinned) |
| Audit permissions | Query G answers F1 (G08) and F2 (G09) directly | local planted cases, `evidence-ext12.spec.js` |
| Agents | the dashboard's stated agent boundary is guarded (9/10 read-only, 6 cannot send, 7 off by intent, no money writes) | `agent-safety-ext20.spec.js`, 3 mutants |

## 2. Audited, no change needed (with reason)

| Area | Finding |
|---|---|
| Output escaping (names, titles, order numbers, products, notes, incidents, audit values, search results, operator text) | every remaining HTML-string value is `esc()`, numeric, or one of 52 hand-reviewed values. The DOM sink gate fails on any new one; hostile-text property tests from EXT15/EXT19 cover every page |
| URL safety | saved links pass `isSafeLink()`, which refuses `javascript:`, `data:` and `vbscript:` (control characters and spaces ignored), on save **and** on display. Links open with `rel="noopener noreferrer"`. **PROPOSED (owner decision):** switch to an allow-list (http, https, mailto, tel, message, photos, relative) to also refuse unusual protocol handlers. Not done, because Apple Mail/Photos links are a stated use and an allow-list could break other links Stas uses |
| CSS / style injection | 47 style writes. All are fixed values, prototype-free fixed tables, clamped numbers, or a `#hex` colour checked by a regular expression. None passes a raw database value |
| CSV export | formula-injection guard unchanged since EXT18 (`csv-export-guard.spec.js` in the deep check) |
| File uploads | traversal, odd MIME types, long names, Unicode, duplicate names: `storage-safety.spec.js` and `storage-adversarial-ext17.spec.js`. The duplicate-name test was hardened (INT-8) |
| Diagnostics and error text | error *kinds* only; no stack, path or token in operator messages (EXT14 diagnostics fuzz) |
| Secret scan | planted fake keys are caught (`supply-chain-ext18.spec.js`); EXT20 scanned 666 files |
| npm scripts | no deploy, publish or production-write command (`supply-chain-ext18.spec.js`) |
| GitHub Actions | already pinned to full commit SHAs (EXT15); not redone |
| Dependencies | 14 locked packages, exact versions, sha512. **No dependency added in EXT20** |

## 3. Third-party origins at runtime

| Origin | Pages | Why | Integrity |
|---|---|---|---|
| `cdn.jsdelivr.net` (one file: supabase-js 2.117.2) | all 6 | database client | SRI `sha384` + exact URL in the script policy |
| `*.supabase.co` | all 6 | the database API | TLS; data protected by RLS |
| `fonts.googleapis.com`, `fonts.gstatic.com` | `dashboard`, `search`, `index`, `manual-order-entry` | Fraunces / Public Sans / IBM Plex Mono | **none possible** (Google serves different CSS per browser) |

No unexpected origin was found.

**Google Fonts decision (OWNER DECISION, not made here):**

| Option | Notes |
|---|---|
| (a) Keep | no change |
| (b) Use the system fonts the main dashboard already uses | removes the outside dependency; changes the look of those 4 pages |
| (c) Self-host | the fonts are under the SIL Open Font License, but the brief forbids publishing font files in this public repository, so (c) is not done |

**Recommendation:** (b).

## 4. Hosting limits (cannot be fixed in page code)

- GitHub Pages cannot send `Content-Security-Policy: frame-ancestors`, `X-Frame-Options` or HSTS.
- A `<meta>` tag cannot carry `frame-ancestors`, so none was added; faking it would give false assurance.
- The page's JavaScript frame guard is **not** equivalent: a sandboxed frame disables it.
- **Future requirement:** a host or proxy that sends these headers, for example Cloudflare in front of Pages, Netlify or Vercel. That is an owner/platform decision.

## 5. Rollback

Each EXT20 code change is in its own commit (`RELEASE_REVIEW_EXT20.md` §4). Reverting the PR restores EXT19 exactly. No database change is involved.
