# Trusted Types evaluation (EXT17)

Status: **EVALUATED, NOT ADOPTED.** Evidence: `tests/forensics/trusted-types.probe.spec.js` (not part of `npm test`).

## 1. In plain English

Trusted Types is a browser rule: no page code may insert raw HTML unless it goes through an approved "policy". It closes off the most common kind of web attack (script injection through HTML). Turning it on today would break the dashboard. It is the right goal, though, and the work to get there is listed in §3.

## 2. Measurement

The owner page was served with an extra **report-only** rule, `require-trusted-types-for 'script'`, which blocks nothing. Every one of the 26 sidebar pages was then opened.

| Measure | Result |
|---|---|
| Violations | 168 |
| Distinct code locations | 86 |
| Kind | all `innerHTML` |
| Busiest locations | `he-ui.js:109` (42), `owner-login-app.js:673` (40, sidebar), `he-agents.js:99` (3); the rest 1 each |
| The Supabase library | no violations |
| Browser support | Chromium-based browsers enforce it; Safari and Firefox ignore it, so it would protect only some users |

## 3. Decision and path

- **Not adopted in EXT17.** Enforcing would stop 86 code paths.
- A "default policy" that passes everything through would only look safe without protecting anything. An escaping default policy would break the markup the pages build.
- **Path**:
  1. Reduce the dynamic `innerHTML` locations, starting with the two that account for 82 of 168: the sidebar and the shared UI helper. Use `textContent` / `createElement` / `replaceChildren` there.
  2. Route the remaining structured markup through one narrow builder that escapes by default.
  3. Add a named policy for that builder and turn on report-only in a staging artifact.
  4. Enforce only when report-only shows zero violations on every page.
- Re-run the probe after each step. The number to watch is "distinct code locations".
