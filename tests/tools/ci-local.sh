#!/usr/bin/env bash
# Local equivalent of .github/workflows/ci.yml (EXT14): same steps, same order.
#   npm run ci:local                    static + browser suite (+ database suite if a local PostgreSQL is set)
#   CI_PG="-h /var/tmp/hepg -p 5499 -U postgres" npm run ci:local
#   CI_SKIP_BROWSER=1 npm run ci:local  (static + database only)
# Exit code is non-zero if any step fails. Never touches production.
set -u
cd "$(dirname "$0")/../.."
fails=0
step() { local name="$1"; shift; local s=$(date +%s); echo "── $name"; if "$@"; then echo "   PASS $name ($(( $(date +%s)-s ))s)"; else echo "   FAIL $name"; fails=$((fails+1)); fi; }
[ -d node_modules/@playwright/test ] || step "install dependencies (npm ci --ignore-scripts)" npm ci --ignore-scripts
step "secret scan" node tests/tools/secret-scan.js
step "SQL package lint" node tests/tools/sql-lint.js
step "status manifest" node tests/tools/status-validate.js
step "module graph" node tests/tools/app-modules.js
step "no inline styles" node tests/tools/inline-styles.js --check
step "type-check gate" node tests/tools/typecheck.js --gate
step "documentation check" node tests/tools/doc-check.js --current
step "static security check" node tests/tools/static-security.js
step "DOM sink gate" node tests/tools/dom-sinks.js --gate
step "slow-regex audit" node tests/tools/regex-audit.js
step "schema contract" node tests/tools/schema-contract.js
step "Node-only specs (no browser, as in CI)" env PLAYWRIGHT_BROWSERS_PATH=/nonexistent-no-browser-in-static-job npx playwright test --config tests/playwright.config.js --project=desktop --reporter=line \
  tests/specs/ci-guard-ext14.spec.js tests/specs/sql-package-ext14.spec.js tests/specs/sql-drafts-static.spec.js tests/specs/sql-readonly.spec.js \
  tests/specs/docs-integrity-ext13.spec.js tests/specs/evidence-ext12.spec.js tests/specs/deploy-sim-ext12.spec.js tests/specs/incidents-ext12.spec.js \
  tests/specs/query-interpreter-ext10.spec.js tests/specs/helpers-unit.spec.js tests/specs/status-manifest-ext14.spec.js tests/specs/screenshots-policy-ext14.spec.js tests/specs/ci-traps-ext15.spec.js tests/specs/property-node-ext15.spec.js tests/specs/security-static-ext18.spec.js tests/specs/security-parsers-ext18.spec.js tests/specs/supply-chain-ext18.spec.js tests/specs/state-contract-ext19.spec.js
if [ "${CI_SKIP_BROWSER:-0}" != "1" ]; then
  step "browser suite (all tests; screenshots excluded as in CI)" npx playwright test --config tests/playwright.config.js --ignore-snapshots --reporter=line
fi
if [ -n "${CI_PG:-}" ]; then
  step "database suite" env QUICK=1 bash tests/tools/run-db-suite.sh $CI_PG
else
  echo "── database suite: SKIPPED (set CI_PG to a local PostgreSQL to run it, as CI does)"
fi
echo "CI LOCAL: $fails failed step(s)"
exit $fails
