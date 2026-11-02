# Sign-in, session and sign-out security (EXT18)

Status: **CURRENT on the feature branch.** Synthetic data, mocked Supabase, local Chromium. Not production.

## 1. Session states (client model)

| State | Meaning | What the page shows | Leaves by |
|---|---|---|---|
| UNKNOWN | page just opened, session not read yet | nothing from the database | reading the stored session |
| SIGNED_OUT | no session | sign-in form only; no business read is made | signing in |
| SIGNING_IN | form sent | sign-in form, button busy | success → ACTIVE; refusal / inactive account → SIGNED_OUT |
| ACTIVE | valid session for person P | dashboard for P | sign-out, expiry, another person, revoke |
| EXPIRED | the server says the sign-in expired mid-use | "Your sign-in has expired. Sign in again"; nothing claimed as saved | sign-in again |
| REVOKED / SIGNED_OUT_ELSEWHERE | another tab signed out, or the session was removed | page wiped and reloaded; a note says why | — |
| OTHER_PERSON | another tab signed in as a different person | page wiped (never shows P's data to Q) | — |

## 2. Failure matrix (each row is tested)

| Situation | Behaviour | Test |
|---|---|---|
| Sign out in this tab | login screen, no "signed out elsewhere" note | `session-failures` |
| Sign out in another tab (2 tabs) | this tab leaves at once and says why | `session-failures` |
| **Sign out in one of five tabs** | all four others leave, each with the note; no token left | `session-security-ext18` |
| **Sign out elsewhere while a save is still on its way** | note: the change *may or may not* have been saved, check before redoing (EXT18 fix) | `session-security-ext18` |
| Sign out elsewhere with nothing on its way | note: nothing unsaved was sent | `session-security-ext18` |
| **Sign out while the server cannot be reached** | signed out here, still signed out after reload, token removed | `session-security-ext18` |
| **A dialog open during a sign-out elsewhere** | dialog gone with the data | `session-security-ext18` |
| Back button restores a cached page after a sign-out | page wiped | `auth-chaos` |
| Back button, still the same person | nothing changes | `auth-chaos` |
| Another person signs in elsewhere | page wiped at once | `auth-chaos` |
| Routine token refresh for the same person | nothing changes | `auth-chaos` |
| Sign-in expires during a save | "Sign in again", nothing claimed, nothing changed | `session-failures` |
| Sign-in expires while a page loads | an error, never an empty page | `session-failures`, `session-expiry-reads-ext15` |
| Inactive account | refused, signed out | `login-session` |
| Shared computer: next person signs in | none of the previous data visible | `session-failures` |
| Scripts fail to load and the form is submitted | nothing in the address (fields have no `name`) | `frame-csp-ext18`, static check |

## 3. EXT18 fix: sign-out with a save in flight

**Before:** the note always said "Anything not already saved on that page was not sent." A change that had been sent and was waiting for its reply could still land: the server keeps accepting the old sign-in until it expires. The owner could then redo a change that had already been saved.

**Now:** the data module counts changes that are still waiting for a reply (`writesInFlight()` in `assets/app/he-data.js`). If any are waiting when the sign-out arrives, the note says that change may or may not have been saved and should be checked before it is done again. The test fails on the old code, and a mutant that stops the counting is caught.

## 4. What the browser holds (inventory, tested)

| Place | Holds | Never holds |
|---|---|---|
| `localStorage` | `sb-<project>-auth-token` (the Supabase session); `he_*` / `he.*` display preferences (theme, open sidebar groups, pinned pages, seen attention items) | e-mail addresses, business data, tokens in preferences |
| `sessionStorage` | the one-time "signed out" note; the manual order page's unfinished attempt key | tokens |
| Cookies | none | — |
| Address bar | page name (`#page=…`) | tokens, e-mail, passwords |
| Console | no token (tested) | — |
| Diagnostic summary | versions, counts, error *kinds* | tokens, e-mail, raw error text (EXT14 fuzz + EXT18) |

After sign-out, nothing of the token remains in either storage (tested).

## 5. Known limits

- The token lives in `localStorage` (Supabase default). If a script were injected it could read the token. Prevention is the strict script policy (`DOM_CSP_SECURITY_EXT18.md`).
- A sign-out does not end the server-side validity of an already issued access token before its expiry (Supabase behaviour). Revoking every session is an owner action in Supabase; see the incident runbook.
- Session reuse in tests stays OFF by default (EXT17).
