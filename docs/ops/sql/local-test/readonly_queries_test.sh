#!/usr/bin/env bash
# LOCAL ONLY (Nov 27, 2026). Runs the read-only queries the owner will run in production on the
# local throwaway database, with made-up objects, and checks what they return:
#   * Query C with a mock timer (pg_cron) and without one: runs, leaks no key / project address /
#     e-mail, and the Query C reader gives the expected answer (STOP for exactly the two planted
#     paths into stock; complete, never UNKNOWN, without pg_cron).
#   * Query D: each made-up function gets its expected class (E open writer, D open reader,
#     C gated, B not callable by visitors, A trigger only).
# These three tests existed (query_c_mock_test.sql, query_c_no_cron_test.sql, query_d_mock_test.sql)
# but no suite ran them. Every one runs inside BEGIN ... ROLLBACK: nothing is left behind.
# Usage (from the repository root): bash docs/ops/sql/local-test/readonly_queries_test.sh -h <host> -p <port> -U <user>
set -u
C="$*"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
LT="$ROOT/docs/ops/sql/local-test"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
run() { (cd "$ROOT" && psql $C -d he_real -q --csv -v ON_ERROR_STOP=1 -f "$1" > "$2" 2>"$2.err"); echo $?; }

echo "1. Query C with a mock timer"
ok "runs without error" "$(run "$LT/query_c_mock_test.sql" "$TMP/c.csv")" 0
ok "no fake key, project address or e-mail in the output" "$(grep -c -E 'SUPERSECRET|abcdefghijk|jane\.doe' "$TMP/c.csv")" 0
ok "all eleven sections present" "$(cut -d, -f1 "$TMP/c.csv" | grep -E '^[0-9]+ ' | sort -u | wc -l | tr -d ' ')" 11
ok "the reader: STOP" "$(node -e "const r=require('$ROOT/tests/tools/query-c-reader.js').read(require('fs').readFileSync('$TMP/c.csv','utf8'));console.log(r.verdict)")" STOP
ok "the reader: exactly the two planted paths are STOP" "$(node -e "const r=require('$ROOT/tests/tools/query-c-reader.js').read(require('fs').readFileSync('$TMP/c.csv','utf8'));console.log(r.findings.filter(f=>f.level==='STOP').map(f=>f.item).sort().join(' '))")" "agent4-retail-wholesale public.agent4_run"

echo "2. Query C without pg_cron"
ok "runs without error" "$(run "$LT/query_c_no_cron_test.sql" "$TMP/n.csv")" 0
ok "says no timer is installed" "$(grep -c '^5 scheduled jobs,(pg_cron installed),"NO' "$TMP/n.csv")" 1
ok "masks the token-like string" "$(grep -c FAKETOKEN "$TMP/n.csv")" 0
ok "the reader finds the file complete (never UNKNOWN)" "$(node -e "const r=require('$ROOT/tests/tools/query-c-reader.js').read(require('fs').readFileSync('$TMP/n.csv','utf8'));console.log(r.findings.filter(f=>f.level==='UNKNOWN').length)")" 0

echo "3. Query D (functions that run with extra rights)"
ok "runs without error" "$(run "$LT/query_d_mock_test.sql" "$TMP/d.csv")" 0
cls() { node -e "const {parseCsv}=require('$ROOT/tests/tools/interpret-query-results.js');const r=parseCsv(require('fs').readFileSync('$TMP/d.csv','utf8')).find(x=>x.function_name==='public.$1()');console.log(r?String(r.classification).charAt(0):'missing')"; }
ok "an open writer is E" "$(cls t_open)" E
ok "an open reader is D" "$(cls t_read)" D
ok "a gated function is C" "$(cls t_gated)" C
ok "a JWT-claims gate is C" "$(cls t_jwt)" C
ok "not callable by visitors is B" "$(cls t_rows)" B
ok "trigger only is A" "$(cls t_trg)" A

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
