# Release review (EXT18): owner review package

**Branch:** `claude/platform-ext18-security-reliability-2026-10-12` (from EXT17 final `9b589bf`). Base `main` `d3db7bc`. **Draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

Merging changes the dashboard code only. No SQL runs on merge, nothing touches customers, stock or money. On top of EXT17, merging EXT18 changes:

1. **Five real bugs fixed:**
   - Sales tax by state: a customer's shipping state typed as a JavaScript word (`constructor`, `toString`) showed "—", and `__proto__` made that order's tax disappear from the table.
   - Accounting: an expense note "Purchase order constructor" broke the duplicate check.
   - Tax Records: such a category showed a blank label; such a SKU broke the cost estimate.
   - Sign-out in another tab while a save was still on its way: the page said the change "was not sent". It may have been saved; the page now says so.
2. **Stricter script rule:** the browser may load scripts only from this site and the one pinned library file (before: any file on the whole CDN).
3. **Very long error messages** can no longer slow the page down.
4. **Everything else** is tests, check tools, CI gates and documents.

## 2. Scope

| Changed | Files |
|---|---|
| Dashboard | `assets/owner-login-app.js`, `assets/owner-login-helpers.js`, `assets/app/he-config.js`, `assets/app/he-data.js`, `assets/app/he-agents.js`, `assets/app/he-audit.js`, `assets/app/he-compliance.js`, `assets/app/he-inquiries.js`; all 6 `*.html` (script policy line; `owner-login.html` asset versions) |
| Tests and tools | 6 new specs, `static-security.js`, `dom-sinks.js --gate` + reviewed list, `regex-audit.js` + reviewed list, `security-check.sh`, secret-scan extension, local `rls_contract_test.sh`, 12 new mutants |
| CI | static job runs the new gates and Node-only specs (no new permission, no secret, no deploy) |
| Docs | `docs/ops/*_EXT18.md` (10), status documents, intermittent register (INT-6) |

**Not changed:** the SQL drafts (R1–R5 fingerprint unchanged), any production setting, the website, Real Estate OS, backups.

## 3. Tests run

RESULTS_TABLE

## 4. Rollback (step by step)

1. On GitHub, open the merged pull request and press **Revert** → **Create pull request**.
2. Approve and merge the revert pull request.
3. Wait 5 minutes, then hard-refresh the live dashboard (Cmd+Shift+R) or use a Private Window.

No database change needs undoing, because merging installs none.

## 5. Relationship to the open draft PRs

EXT18 is a successor draft PR containing everything in #32 (EXT17 → #31 → #30 → #29). Review EXT18 instead. The older drafts can then be closed without merging.

## 6. Deployment instructions for Stas (only when you decide to)

1. Open the EXT18 draft PR and check that the description says the tests passed.
2. Press **Ready for review** → **Approve** → **Merge pull request** → **Confirm**.
3. Wait 5 minutes and open the live dashboard in a Private Window.
4. Check:
   - you can sign in;
   - Home shows its cards;
   - Tax Records and Accounting open;
   - the sidebar works;
   - System status → Copy diagnostic summary shows "modules 19/19";
   - sign out, then sign in again.
5. If anything differs, change nothing else, use §4, and send Claude a screenshot.

## 7. Known limitations

- **Production RLS UNKNOWN** (run Query G). Two local-model findings (F1 audit insert privilege, F2 audit read by any signed-in user) wait for that evidence. See `AUTHORIZATION_CONTRACT_EXT18.md`.
- No `frame-ancestors` / HSTS header (GitHub Pages cannot send them). A sandboxed frame stops the frame guard.
- Trusted Types not enforced (86 locations).
- Google Fonts on 4 smaller pages (no integrity hash possible).
- CI `postgres:16` image pinned by tag, not digest.
- INT-3 still open. No real Safari, iPhone or VoiceOver test.
