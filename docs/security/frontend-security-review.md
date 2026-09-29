# Frontend security review (read-only)

Status: **findings only.** September 29, 2026. I read the source of all six pages on `main` (d3db7bc):
- Nothing was run against production, and nothing was exploited.
- No payloads were tested, not even against the mock.
- No code was changed.

## Summary

- `owner-login.html` is careful about the biggest browser risk: it escapes every database value before putting it on the page (`esc()`). I found no unescaped data path in it.
- The main risks are:
  - **two smaller pages that don't escape at all**
  - **a floating third-party library with no integrity check on every page**
  - **links that aren't checked for dangerous schemes**
  - **spreadsheet formulas in CSV exports**
  - **permission checks that exist only as a UI convention**, while real protection depends entirely on Supabase row-level security, which I can't see from here

No secrets were found. The Supabase key in the pages is the public "publishable" key, which is meant to be public.

## Findings

| # | Severity | Finding | Where | Why it matters | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| S1 | 🔴 **High** | **`search.html` and `dashboard.html` insert database text into the page without escaping** | `search.html` 174–185 (`r.label`, `r.subtitle`, the search `term`, `error.message`); `dashboard.html` 248–289, 330–352 (`r.label`, `r.status`, `r.item_type`, `r.output_summary`, `agent_key`, error messages) | Search results include **customer and order data synced from Shopify**. The activity and AI lists include **agent-written text that can quote customer emails.** A customer name or message containing HTML/script would run inside the page with the viewer's logged-in session. **All pages share one login session** (same site, same default storage key), so being logged into the owner dashboard is enough. The pages aren't linked from the dashboard, but they are live URLs. | Add the same `esc()` helper and use it on every inserted value, or build the rows with `textContent`. If these pages are no longer used, remove them from the live site (your call). |
| S2 | 🔴 **High** | **Supabase library loaded from a CDN on a floating version (`@2`) with no integrity hash, on all 6 pages** | line ~24 of `owner-login.html` (and each page's head) | Whatever the newest 2.x release is today runs inside the signed-in owner session. A bad or compromised release would get full access to everything the owner can do. | Pin an exact version and add `integrity="sha384-…"` + `crossorigin="anonymous"`. (Already in the code-quality review. It's a tiny, separate PR per page.) |
| S3 | 🟠 **Medium** | **Links saved by users are not checked for safe schemes** | `owner-login.html` 7292 (evidence `external_link`), 7474 (document `document_url`); saved at 7361 / 7570 with only `.trim()` | Escaping stops HTML injection, but a link like `javascript:…` is still a working link. Anyone who can add evidence or documents could plant one that runs code when the owner clicks "Open linked file". | Accept only `https://` (and maybe `http://`) when saving *and* when rendering. Show anything else as plain text. |
| S4 | 🟠 **Medium** | **CSV exports allow spreadsheet formulas** | Tax export (8979–9018), Activity export (3612–3635) | A cell starting with `=`, `+`, `-` or `@` runs as a formula when the file is opened in Excel or Numbers. Vendor names, customer names and change descriptions come from data others can influence. Confirmed in the tests with a synthetic vendor `=SYNTHETIC…`, which is exported unchanged. | Prefix such cells with an apostrophe (`'`) in both CSV builders. That's one shared helper. |
| S5 | 🟠 **Medium (needs your confirmation)** | **The dashboard shows every page to any active account, whatever its role** | `showDashboardFor` (1859): checks only `is_active`; role is used just for the calendar mode | Every write button (flags, business rules, system mode, approvals, stock, money) is shown to staff too. Safety then depends **entirely** on row-level security in Supabase blocking what a non-owner shouldn't do. I can't see those rules from the browser code. | Confirm the RLS policies limit non-owner roles per table (a read-only query you can run). Optionally hide owner-only pages for other roles; that's a UI nicety, not a security control. |
| S6 | 🟡 **Medium / design** | **The password re-check is a browser-side step, and it covers only some actions** | `requireReauth` is used for order delete/restore, flags, rules, approvals, system mode… but **not** for expense delete, product delete, stock adjustments, PO receive, recall quarantine, or session revoke | It stops someone at an unlocked computer from clicking those buttons. It does **not** stop direct API calls made with a stolen session token, since the server never sees the re-check. Money and stock actions are currently not covered at all. | Decide which actions should ask for the password (money and stock ones are good candidates). For real enforcement, sensitive changes go through database functions that check a recent login (`auth.jwt()` → `iat` / `amr`), a later step. |
| S7 | 🟡 **Low–Medium** | **No Content-Security-Policy on any page** | all `.html` | A CSP limits what an injected script could do, and where scripts can load from. It would reduce the impact of S1 and S2. | Add a `<meta http-equiv="Content-Security-Policy">` allowing only this site, `cdn.jsdelivr.net` (pinned) and the Supabase project. Test carefully, because inline scripts and styles need to be allowed or moved. This fits well after the CSS/JS split. |
| S8 | 🟡 **Low** | **Session token stored in `localStorage`** (Supabase default) | all pages | Normal for this kind of app, but any script injection (S1) could read it. | Handled by fixing S1/S2/S7. No change needed on its own. |
| S9 | 🟡 **Low** | **Password prompt: pressing Enter while a check is running starts another check**, and a comment says 12 s while the code uses 8 s | `requireReauth` 1930–1966 | Extra sign-in attempts count toward Supabase's rate limit, and the prompt can show a confusing message. No security impact. | Ignore Enter while a check is in progress. Fix the comment. |
| S10 | 🟡 **Low** | **Receipt upload happens before the expense is saved** | Expenses form 8671–8684 | If the save fails, the file stays in storage with no expense pointing to it (an orphan receipt). The same pattern exists for evidence (7351) and document (7559) uploads. | Delete the uploaded file if the insert fails, or save first and upload second. |
| S11 | ℹ️ **Info** | **Deactivated accounts keep working until reload** | `showDashboardFor` checks `is_active` only at login | Real enforcement must be in RLS: policies should check `is_active`. | Confirm with the same RLS query as S5. |
| S12 | ℹ️ **Info** | **Logging**: 6 `console.warn` calls log error messages only; no personal data or tokens are logged | 5528–6715 | Fine. | None. |

**What's good:**
- `esc()` is used consistently in `owner-login.html`. The palette and search results even use `textContent`.
- Signed receipt URLs expire after 60 seconds, and file names are cleaned before upload.
- Customer-data viewing is logged (`log_customer_data_access`).
- Links open with `noopener noreferrer`.
- Task status updates are conditional in the database.
- There are no inline `onclick` handlers.

## Recommended order

1. **S1**: escape `search.html` and `dashboard.html`, or retire them. This is small and has high impact.
2. **S2**: pin + integrity-hash the Supabase library on all pages.
3. **S3 + S4**: link-scheme allowlist and CSV formula guard. Small, one PR each.
4. **S5 / S11**: you run a read-only RLS query; I review the policies with you.
5. **S6**: decide which money and stock actions need the password prompt.
6. **S7**: CSP, after the CSS/JS split.

## Decisions needed

- Are `search.html`, `dashboard.html`, `index.html` and `manual-order-entry.html` still used? Retiring unused pages removes S1 entirely.
- Which extra actions should ask for your password (S6)?
- OK to prepare the read-only RLS query (S5/S11)?
