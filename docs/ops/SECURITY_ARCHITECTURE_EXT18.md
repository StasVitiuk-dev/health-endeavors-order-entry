# Security architecture (EXT18): single source of truth

Status: **CURRENT on the feature branch** `claude/platform-ext18-security-reliability-2026-10-12`. Nothing here is live until the owner merges. Production RLS, backups and agents are **not verified** (UNKNOWN until Queries C–H are run).

The topic documents go into detail; this page says what protects what, and where the proof is.

| Topic | Document |
|---|---|
| Sign-in, sessions, sign-out, browser storage | [AUTH_SESSION_SECURITY_EXT18.md](AUTH_SESSION_SECURITY_EXT18.md) |
| Who may read and change what | [AUTHORIZATION_CONTRACT_EXT18.md](AUTHORIZATION_CONTRACT_EXT18.md) |
| Page markup, script policy, framing | [DOM_CSP_SECURITY_EXT18.md](DOM_CSP_SECURITY_EXT18.md) |
| Database rules, audit log, locks | [DATABASE_SECURITY_EXT18.md](DATABASE_SECURITY_EXT18.md) |
| Packages, CDN, CI, secrets | [SUPPLY_CHAIN_SECURITY_EXT18.md](SUPPLY_CHAIN_SECURITY_EXT18.md) |
| How it is all tested | [SECURITY_TESTING_EXT18.md](SECURITY_TESTING_EXT18.md) |
| What to do when something goes wrong | [SECURITY_INCIDENT_RUNBOOK_EXT18.md](SECURITY_INCIDENT_RUNBOOK_EXT18.md) |
| Owner review package | [RELEASE_REVIEW_EXT18.md](RELEASE_REVIEW_EXT18.md) |

## 1. In plain English

The dashboard is a set of static pages on GitHub Pages. It talks only to the production Supabase project, using the **public** key plus the signed-in person's own session. The database's row-level security (RLS) decides what each person may see or change. The page itself holds no secret, so everything the page does could be done by anyone with a valid sign-in. **The real protection is the database rules.** The page's job is to avoid three things:

- running someone else's code (script injection);
- leaking the session;
- telling the person something untrue about what was saved.

## 2. Assets and trust boundaries (threat model)

| Asset | Where it lives | Who may reach it | Main threat | Main control |
|---|---|---|---|---|
| Business data (orders, stock, money, customers) | Supabase tables | signed-in staff, by RLS | a person reading or changing beyond their role; injected script acting as them | RLS (production: UNKNOWN until Query G); no script injection (§3) |
| Session token | browser `localStorage` (`sb-…-auth-token`) | the page's own scripts | script injection; token in an address, a log or a shared screenshot | strict script policy, no dynamic script, token never shown or logged (tested) |
| Audit trail | `audit_log`, written by a trigger | read: signed-in users; write: the trigger | forged or edited lines | no UPDATE/DELETE privilege; no INSERT policy (local model; production UNKNOWN) |
| Page code | GitHub repository → Pages | the owner (merge) | a malicious change or package | branch protection, owner approval, pinned packages, CI gates |
| Supabase library | jsDelivr CDN | everyone | a changed or swapped file | exact version + integrity hash (SRI); the policy names that one file |
| Owner's trust in what the page says | — | — | "saved" when it was not, or the reverse | unknown-result states; honest messages (tested) |

**Trust boundaries:** (1) browser ↔ Supabase (every request carries the person's token; RLS decides); (2) page ↔ CDN (integrity hash); (3) customer text (Shopify orders, addresses) and staff text → page (always escaped, never used as code or as an object key with meaning); (4) repository ↔ live site (owner merge only).

**Out of scope here:** the website/storefront, Real Estate OS, the backups repository and production Supabase settings. None of these are touched.

## 3. Controls by layer

| Layer | Control | Proof |
|---|---|---|
| Markup | every data value escaped (`esc`), 52 reviewed exceptions recorded with reasons; 0 `eval`, `document.write`, `insertAdjacentHTML`, `outerHTML`, `setAttribute('on…')` | `npm run security:sinks`, `security-static-ext18.spec.js` |
| Script policy (CSP) | scripts only from this site + **the one pinned library file** (was: the whole CDN); no inline script except the hashed frame guard; styles only from this site | `frame-csp-ext18.spec.js`, `csp-strict-ext15.spec.js` |
| Framing | frame guard hides the page inside another site's frame; `frame-ancestors` cannot be sent by GitHub Pages | `frame-csp-ext18.spec.js` |
| Links | `javascript:` / `data:` / `vbscript:` refused; new tabs `noopener` | `link-scheme-check.spec.js`, static check |
| Keys from data | lookups keyed by database or customer text use prototype-free objects | `prototype-keys-ext18.spec.js` |
| Slow patterns | every regex timed on hostile 20,000-character input; error text capped at 2,000 characters | `npm run security:regex` |
| Session | sign-out in any tab clears all tabs; Back-button cache rechecked; a save still on its way is reported honestly | `session-security-ext18.spec.js`, `session-failures.spec.js`, `auth-chaos.spec.js` |
| Database | RLS contract (6 callers), audit completeness and immutability, locally | `docs/ops/sql/local-test/rls_contract_test.sh` |
| Supply chain | exact versions, sha512 lockfile, no install scripts, SHA-pinned actions, read-only CI token | `supply-chain-ext18.spec.js`, `ci-guard-ext14.spec.js` |
| Secrets | none in the repository; `.env` / key files refused by name | `npm run secrets:scan` |

## 4. What is NOT protected by the page (honest limits)

- Anyone with a valid sign-in can call the database directly. Only RLS stops them, and **production RLS is UNKNOWN** until Query G is run.
- The session token lives in `localStorage` (the Supabase default). An injected script could read it. The defence is preventing injection (§3), not hiding the token.
- No HSTS or `frame-ancestors` header: GitHub Pages does not let us set response headers. GitHub Pages serves HTTPS only.
- Trusted Types is not enforced (86 `innerHTML` code locations; see `TRUSTED_TYPES_EVALUATION_EXT17.md`).
- Real devices, Safari and VoiceOver are not tested.
