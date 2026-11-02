# Supply chain and secrets (EXT18)

Status: **CURRENT on the feature branch.**

## 1. SBOM-lite (what the dashboard and its tests depend on)

| Component | Version | Where it runs | Pinned by | Notes |
|---|---|---|---|---|
| `@supabase/supabase-js` (UMD) | 2.117.2 | **live pages**, from jsDelivr | exact URL + `integrity="sha384-…"` + `crossorigin`; policy names that one file | the only third-party code on the live pages |
| Google Fonts stylesheet | n/a | 4 smaller pages (`dashboard`, `search`, `index`, `manual-order-entry`) | none possible (Google serves different CSS per browser) | styles and fonts only, no script; Google sees page visits. PROPOSED: self-host the fonts |
| `@playwright/test` | 1.56.1 | tests only | exact version, lockfile sha512 | |
| `@supabase/supabase-js` (npm) | 2.117.2 | tests and offline staging copy | exact version, lockfile sha512 | the same file the pages load (hash checked by the staging build) |
| `typescript` | 5.9.3 | tools only | exact version, lockfile sha512 | |
| GitHub Actions: checkout, setup-node, upload-artifact | v4.x | CI | full commit SHA (EXT15) | GitHub-made actions only |
| `postgres:16` service image | tag `16` | CI database job | **tag only, not a digest** | OPEN: pin to a digest from an authoritative source (not invented here) |

**Lockfile:** 14 packages, version 3, every one from `registry.npmjs.org` with a sha512 integrity. Only `fsevents` (an optional macOS file watcher, never installed on Linux CI) has an install script. CI and `ci:local` install with `npm ci --ignore-scripts` (tested).

## 2. Package scripts (tested)

- No lifecycle hooks (`preinstall`, `install`, `postinstall`, `prepare`, …).
- No script deploys, publishes, pushes, or calls `curl`, `wget`, `ssh`, the Supabase CLI or a non-local `psql`. The one deploy-shaped name, `deploy:sim`, is the offline simulator. It makes no network call (checked).

## 3. Secrets firewall

- `npm run secrets:scan` checks every tracked file for:
  - JWTs;
  - Supabase secret/service keys and service-role assignments;
  - GitHub, Stripe, AWS, Slack, Shopify and npm tokens;
  - Anthropic and OpenAI-style keys;
  - Google API keys;
  - private keys;
  - database URLs with passwords.
- **New in EXT18:** files that hold secrets by convention (.env files except .env.example, .pem and .key files, id_rsa, .npmrc, .pgpass, credentials.json, service-account*.json) are refused by name, whatever they contain. `.gitignore` lists them too.
- Fake keys used in tests are built at run time, so test files hold none.
- The staging build is scanned the same way, and refuses SQL, .env and key files.

## 4. CI pipeline (unchanged guarantees, extended gates)

- CI has a read-only token, no secrets, no deploy step and SHA-pinned actions (`ci-guard-ext14.spec.js`).
- The static job now also runs the static security check, the DOM sink gate, the slow-regex audit and three new Node-only security specs.
- **Detectors that must fire** (each proven by a test or mutant):
  - fake secret;
  - `.env` file;
  - unsafe SQL (EXT14);
  - inline script, inline handler, `javascript:` link;
  - CDN widened;
  - new unescaped HTML value;
  - new database write (write-path inventory freshness);
  - stale mutant (`--check`);
  - module cycle;
  - production URL in the staging build.

## 5. Release artifact

The live "release" is the `main` branch served by GitHub Pages. The staging artifact (`npm run staging:build`):

- is built offline;
- bundles the same library with the same hash;
- carries no CDN address after EXT18 (the build now also drops the CDN entry from its policy);
- passes the secret scan.

Asset versions are content hashes (`?v=`), so mixed old/new files cannot be served under the same name.
