#!/usr/bin/env bash
# EXT18 security checks, one command each. Local only; never touches production.
#   npm run security:quick    static gates + Node-only security specs (about a minute)
#   npm run security:deep     quick + browser security specs + security mutants
#                             (+ the local RLS contract if CI_PG points at a local PostgreSQL)
# Every run starts with its provenance (commit, uncommitted changes, time,
# Node, Playwright) and ends with one PASS/FAIL line, so a pasted result says
# exactly which code it is about. Exit code = number of failed steps.
set -u
cd "$(dirname "$0")/../.."
MODE="${1:-quick}"
fails=0; t0=$(date +%s)
step() { local name="$1"; shift; local s=$(date +%s); echo "── $name"; if "$@"; then echo "   PASS $name ($(( $(date +%s)-s ))s)"; else echo "   FAIL $name"; fails=$((fails+1)); fi; }

echo "SECURITY CHECK ($MODE)"
echo "  commit:     $(git rev-parse HEAD 2>/dev/null || echo unknown)"
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo "  uncommitted files: $dirty$( [ "$dirty" != 0 ] && echo '  (result is about the working tree, not a commit)')"
echo "  time (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  node:       $(node --version)   playwright: $(node -e 'console.log(require("@playwright/test/package.json").version)' 2>/dev/null || echo missing)"

step "secret scan (tracked files + secret-holding file names)" node tests/tools/secret-scan.js
step "static security check (pages + scripts)" node tests/tools/static-security.js
step "DOM sink gate" node tests/tools/dom-sinks.js --gate
step "slow-regex audit" node tests/tools/regex-audit.js
step "SQL package lint" node tests/tools/sql-lint.js
step "schema contract" node tests/tools/schema-contract.js
step "Node-only security specs" npx playwright test --config tests/playwright.config.js --project=desktop --reporter=line \
  tests/specs/security-static-ext18.spec.js tests/specs/security-parsers-ext18.spec.js tests/specs/supply-chain-ext18.spec.js tests/specs/ci-guard-ext14.spec.js

if [ "$MODE" = "deep" ]; then
  step "browser security specs (desktop + iPhone)" npx playwright test --config tests/playwright.config.js --reporter=line \
    tests/specs/frame-csp-ext18.spec.js tests/specs/prototype-keys-ext18.spec.js tests/specs/session-security-ext18.spec.js \
    tests/specs/csp.spec.js tests/specs/csp-strict-ext15.spec.js tests/specs/xss-everywhere.spec.js tests/specs/xss-property-ext15.spec.js \
    tests/specs/link-scheme-check.spec.js tests/specs/library-pin.spec.js tests/specs/session-failures.spec.js tests/specs/auth-chaos.spec.js \
    tests/specs/role-matrix.spec.js tests/specs/csv-export-guard.spec.js tests/specs/diagnostics-ext14.spec.js tests/specs/storage-adversarial-ext17.spec.js
  step "security mutants (each must be caught)" env MUT_ONLY='frame|whole CDN|without escaping|escaping broken|role check removed|secret scanner|plain object again|keep their prototype|no longer cut|no longer counted|signed out in another tab|gate lets|notices eval|verbatim|policy' \
    node tests/mutation/run-page-mutations.js "${TMPDIR:-/tmp}/he-security-mutants"
  if [ -n "${CI_PG:-}" ]; then
    step "RLS contract + audit immutability (local PostgreSQL)" bash docs/ops/sql/local-test/rls_contract_test.sh $CI_PG
  else
    echo "── RLS contract: SKIPPED (set CI_PG, e.g. CI_PG=\"-h localhost -p 5433 -U postgres\")"
  fi
fi
echo "SECURITY CHECK ($MODE): $( [ $fails = 0 ] && echo PASS || echo "FAIL ($fails step(s))" ) in $(( $(date +%s)-t0 ))s on $(git rev-parse --short HEAD 2>/dev/null)$( [ "$dirty" != 0 ] && echo ' + uncommitted changes')"
exit $fails
