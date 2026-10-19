#!/usr/bin/env bash
# EXT20J Reserve VII: merge rehearsal in a DISPOSABLE worktree.
#
# Rehearses combining the feature HEAD with origin/main EXACTLY as a GitHub PR
# "Create a merge commit" would, WITHOUT touching main, without pushing anything,
# and without changing the real feature branch. It reports:
#   * whether the merge is clean (conflict count)
#   * whether the merged tree is identical to the feature HEAD tree
#     (identical => the merge introduces nothing beyond HEAD, so every gate that
#      passes on HEAD transfers exactly to the merged result)
#   * the TT ceiling, CSS gate and DOM-sink gate on the merged worktree
#
# It always removes the disposable worktree, even on failure. Re-running it with
# the same two SHAs gives the same result (Program 33 reproducibility).
#
# Usage:  bash tests/tools/merge-rehearsal.sh
# Safe: read-only against main; no network; no push; no production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SCRATCH="${SCRATCH_DIR:-${TMPDIR:-/tmp}}"
WT="$SCRATCH/he-merge-rehearsal.$$"

MAIN="$(git rev-parse origin/main)"
HEAD_SHA="$(git rev-parse HEAD)"
FEATURE_TREE="$(git rev-parse "HEAD^{tree}")"

echo "merge rehearsal"
echo "  main        $MAIN"
echo "  feature     $HEAD_SHA"

cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || true; git worktree prune >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$WT"
git worktree add --detach "$WT" "$MAIN" >/dev/null 2>&1
# node tooling needs the installed deps; the worktree shares none, so point at the
# main checkout's node_modules (read-only use).
[ -d "$ROOT/node_modules" ] && ln -s "$ROOT/node_modules" "$WT/node_modules"

cd "$WT"
if git merge --no-ff --no-commit "$HEAD_SHA" >/dev/null 2>&1; then
  : # merged cleanly, stopped before commit
else
  echo "  result      MERGE HAD CONFLICTS"
fi
CONFLICTS="$(git diff --name-only --diff-filter=U | wc -l | tr -d ' ')"
MERGED_TREE="$(git write-tree)"

echo "  conflicts   $CONFLICTS"
echo "  merged-tree $MERGED_TREE"
if [ "$MERGED_TREE" = "$FEATURE_TREE" ]; then
  echo "  tree        IDENTICAL to feature HEAD (merge introduces nothing beyond HEAD)"
else
  echo "  tree        DIFFERS from feature HEAD (main carries changes HEAD does not) -> review"
fi

TT_CEIL="$(grep -oE 'const CEILING = [0-9]+' tests/specs/trusted-types-ext20.spec.js | grep -oE '[0-9]+' || echo '?')"
echo "  TT ceiling  $TT_CEIL (must be 0)"
if node tests/tools/css-lint.js --check >/dev/null 2>&1; then echo "  css gate    PASS"; else echo "  css gate    FAIL"; fi
if node tests/tools/dom-sinks.js --gate >/dev/null 2>&1; then echo "  sink gate   PASS"; else echo "  sink gate   FAIL"; fi

RESULT="CLEAN"
[ "$CONFLICTS" = "0" ] || RESULT="CONFLICTS"
echo "  overall     $RESULT"
[ "$RESULT" = "CLEAN" ]
