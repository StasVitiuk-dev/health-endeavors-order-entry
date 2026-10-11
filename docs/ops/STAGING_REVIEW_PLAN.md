# Staging review plan (dashboard)

**Status:** CURRENT (2026-10-10, extension 8, workstream O). **Staging review URL: NOT AVAILABLE.** No approved staging host exists, and Claude did not set one up on its own (the task's rule: "do not improvise an unsafe deployment"). The staging copy itself is **built and tested**; the owner only has to choose where it may be shown (§4).

## 1. Why there is no URL yet

| Option | Why not used without the owner |
|---|---|
| GitHub Pages of this repository | Pages publishes `main`, which **is** the live dashboard. A second site would need a new repository or Pages setting change: owner approval, and settings are off-limits for Claude |
| A new repository / Netlify / Vercel / Supabase branch | New account, hosting or project: owner approval (and for Supabase, production-adjacent) |
| A private claude.ai page (published from this session) | Technically possible and private by default, but the copy looks like the real owner sign-in page of a real business. Claude leaves that choice to the owner instead of publishing it unasked |

## 2. What the staging copy is

Built by `node tests/tools/staging/build-staging.js <folder>` (writes `index.html`, `staging-runtime.js`, `assets/`). Plain static files; no server code.

| Safety property | How | Proven by |
|---|---|---|
| Never reaches production | Production database address and key are **replaced** by `staging-demo.invalid` and a fake key, in the page and in every bundled helper; the build **refuses to finish** if any trace is left | `staging-build.spec.js` (build check) |
| Synthetic data only | Every database / sign-in call is answered inside the browser by the same fake Supabase the tests use, seeded from `tests/tools/staging/staging-seed.js` (all names `SYNTHETIC …`, e-mails `@example.test`) | spec: seeded orders/tasks appear |
| No outside contact | The stand-in refuses every other address; live connections (WebSocket) are off; only the pinned Supabase library is loaded from the CDN | spec: zero outside requests; `fetch('https://example.com')` refused |
| Clearly labelled | Permanent banner **"DEVELOPMENT / STAGING — NOT PRODUCTION"**, page title starts with "STAGING —" | spec + screenshots |
| No password can be typed | E-mail and password fields are read-only; a button signs in as the synthetic owner | spec |
| Nothing is saved | All changes live in the open tab; reload starts again from the seed | by design |
| No secrets | Contains only the public test fixtures | build check + secret scan |

Screenshots (EXT8): `design-review/dashboard-extension-8-2026-10-10/` (staging sign-in and Home, desktop and phone).

**Limits:** emulated in the browser, so it does not prove real database behaviour (RLS, triggers, functions); those stay covered by the local PostgreSQL tests. File uploads and documents use the test stand-in (nothing stored). Real Safari / VoiceOver still need a real iPhone.

## 3. Rebuild

```bash
npm install
node tests/tools/staging/build-staging.js staging-build   # folder is not committed
npx playwright test --config tests/playwright.config.js staging-build
```

## 4. Smallest owner step (pick one)

1. **Private claude.ai page (smallest):** reply in a Claude session: *"Publish the staging copy as a private claude.ai page."* Claude rebuilds it, runs the staging test, publishes it privately (only Stas can open it unless Stas shares it) and gives the link. It can be deleted any time.
2. **On your Mac, no hosting:** ask Claude for the zipped folder; double-click is not enough (browsers block local scripts), so Claude would give one Terminal line (`npx serve staging-build`) to open it at `http://localhost:3000`.
3. **A separate staging repository with its own Pages site:** owner creates an empty repository (e.g. `health-endeavors-dashboard-staging`), adds the Claude account as a collaborator, turns on Pages. Claude then pushes only the built staging folder there. Never this repository, never `main`.

Do not point any staging copy at the production Supabase project, and do not create a staging Supabase project with copied production data.

## 5. Staging approaches ranked (EXT9)

Scored 1 (worst) to 5 (best). All use only synthetic data, the "DEVELOPMENT / STAGING — NOT PRODUCTION" banner, no production keys, no customer messages, no money actions, no cron; removal = delete the page or folder.

| Approach | Safety | Simplicity | Cost | Maintenance | Production similarity | Notes |
|---|---|---|---|---|---|---|
| **Private claude.ai page** (this build, in-browser stand-in) | 5 | 5 | 5 (free) | 4 (rebuild per branch) | 2 (fake database in the browser) | Recommended first step; the frame guard is removed in this build only |
| Local on your Mac (`npx serve staging-build`) | 5 | 3 (one Terminal line) | 5 | 3 | 2 | No hosting at all |
| Separate staging repository + its own GitHub Pages | 4 | 3 | 5 | 3 | 2 | Needs a new repo and Claude added as collaborator (owner) |
| Separate **Supabase staging project** with the real schema and synthetic data | 4 (if never seeded from production) | 2 | 3 (free tier possible) | 2 (keep schema in step) | **5** (real RLS, functions, triggers) | Best for rehearsing R1–R5 and Query G fixes; needs owner setup; never copy production data or keys |

The EXT9 build also contains the stock switches (all off, no switch rows in the synthetic data), so it behaves like the merged dashboard on day one.
