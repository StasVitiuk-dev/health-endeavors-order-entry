# Security testing (EXT18)

Status: **CURRENT on the feature branch.** Local only: synthetic data, mocked Supabase, local Chromium, throwaway PostgreSQL. **Nothing was run against production or any third-party system.**

## 1. Commands

| Command | What | Time |
|---|---|---|
| `npm run security:quick` | secret scan, static security check, DOM sink gate, slow-regex audit, SQL lint, Node-only security specs | ~35 s |
| `npm run security:deep` | quick + browser security specs (desktop + iPhone) + 17 security mutants + the local RLS contract (if `CI_PG` is set) | ~8 min (measured: 480 s on `3e1c0ad`) |
| `npm run security:static` / `security:sinks` / `security:regex` / `secrets:scan` | one gate each | seconds |

Each run prints its **provenance** first and its result last, so a pasted result always names the code it checked:

- the commit;
- the number of uncommitted files;
- the time (UTC);
- the Node and Playwright versions.

The CI static job runs the four gates and the three Node-only EXT18 specs on every push.

## 2. New tests in EXT18

| Spec / tool | Proves | Mutants that it catches |
|---|---|---|
| `security-static-ext18.spec.js` | the static check and the DOM sink gate pass; each planted dangerous pattern (16) and page weakening (11) is caught; the gate refuses unreviewed / over-used / stale / reason-less entries and raised ceilings | gate disabled, static check disabled, supplier name unescaped |
| `frame-csp-ext18.spec.js` | 6 pages hide in a hostile frame; normal pages are not hidden; another CDN package is refused (control: the old policy let it run); a scriptless form submission leaks nothing | whole-CDN policy |
| `prototype-keys-ext18.spec.js` | state, category, SKU and expense-note values named like built-ins are ordinary text; poisoned storage pollutes nothing | 3 (plain objects / prototypes restored) |
| `security-parsers-ext18.spec.js` | the regex audit passes and its detectors fire; 1 MB error text and masked text are handled in well under a second | length cap removed |
| `supply-chain-ext18.spec.js` | exact versions, sha512 lockfile, no install scripts, `--ignore-scripts`, no deploy scripts; secret scanner fires on 8 fake key kinds and 6 secret file names | 2 (scanner disabled) |
| `session-security-ext18.spec.js` | 5 tabs; sign-out with a save in flight (honest note); sign-out offline; dialog during sign-out; storage / console / URL / diagnostics inventory | in-flight counting removed |
| `rls_contract_test.sh` (DB suite) | 6-caller RLS contract, audit completeness and immutability, 2 planted weaknesses noticed | (self-test inside) |
| `regex-audit.js` | 142 regexes timed on hostile 20,000-character input + nested-quantifier check | (self-test in spec) |

## 3. Penetration-style local pack (what an attacker would try, all local)

- **Script injection:** the adversarial XSS corpus (EXT9/EXT15 `xss-everywhere`, `xss-property-ext15`) plus EXT18 sink review and policy tests.
- **Code from another origin:** the CDN package test, foreign script and stylesheet tests (EXT15).
- **Clickjacking:** the hostile frame test.
- **Session theft or reuse:** storage inventory, sign-out across tabs, Back-button cache, offline sign-out.
- **Privilege:** role matrix and the RLS contract (local model).
- **Data-shaped attacks:** values named like built-ins, 1 MB inputs, hostile regex inputs, poisoned storage.
- **Supply chain:** lockfile, scripts, secret files.

## 4. Fuzz shrinking and corpus

The property tests (EXT15/16) shrink failures to a small replay. The XSS and URL corpora live in the existing specs. The regex probes and the built-in-name list (`__proto__`, `constructor`, `toString`, `hasOwnProperty`, `valueOf`, `__defineGetter__`, `prototype`) are the EXT18 additions.

## 5. Intermittent failures

INT-6 (new, FIXED): the EXT18 multi-tab tests ran out of time under 8 parallel workers. The saved snapshot showed correct behaviour. See `tests/forensics/intermittent-register.json`. INT-3 remains OPEN (unexplained, unchanged).

## 6. Limits

Automated tests are not a real penetration test, not real devices, not Safari and not VoiceOver. The local RLS model is not production RLS.
