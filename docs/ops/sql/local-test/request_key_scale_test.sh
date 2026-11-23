#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT14, 2026-10-11). Never point this at Supabase.
# Request keys at volume (drafts/19): on a throwaway real-shape database,
# fills expenses with 10k / 100k / 1M rows carrying random keys, then measures
# a key lookup (plan + time), a repeat insert being refused by the index, and
# the index size. Every fixture lives in the throwaway database and is dropped
# at the end (also on Ctrl-C).
# Usage: request_key_scale_test.sh <psql connection args> [sizes...]
CONN=""; SIZES=""
for a in "$@"; do if [[ "$a" =~ ^[0-9]+$ ]] && [[ ! "$prev" =~ ^-[hpU]$ ]]; then SIZES="$SIZES $a"; else CONN="$CONN $a"; fi; prev="$a"; done
SIZES=${SIZES:-"10000 100000 1000000"}
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../../.." && pwd)"
DB=he_rk_scale_$$
P() { psql $CONN -d $DB -qtAX -v ON_ERROR_STOP=1 "$@"; }
cleanup() { dropdb $CONN --if-exists $DB >/dev/null 2>&1; }
trap cleanup EXIT INT TERM
createdb $CONN $DB && P -f "$DIR/01_REAL_SHAPE_schema_for_local_tests.sql" >/dev/null || exit 1
(cd "$ROOT" && P -f docs/ops/sql/drafts/19_DRAFT_request_keys.sql >/dev/null 2>&1) || { echo "drafts/19 failed"; exit 1; }
have=0; fail=0
for n in $SIZES; do
  add=$((n - have))
  s=$(date +%s%N)
  P -c "insert into expenses (category, amount, expense_date, client_request_id) select 'packaging', 1, current_date, gen_random_uuid() from generate_series(1,$add);" >/dev/null || { echo "fill failed"; exit 1; }
  fill_ms=$(( ($(date +%s%N)-s)/1000000 )); have=$n
  P -c "analyze expenses" >/dev/null
  key=$(P -c "select client_request_id from expenses where client_request_id is not null offset $((n/2)) limit 1")
  pl=$(P -c "explain (analyze, format json) select id from expenses where client_request_id = '$key'")
  info=$(node -e 'const p=JSON.parse(process.argv[1])[0]; const s=[]; (function w(x){ if(/Scan/.test(x["Node Type"])) s.push(x["Node Type"]); (x.Plans||[]).forEach(w); })(p.Plan); console.log(s.join("+")+" "+p["Execution Time"].toFixed(3)+"ms")' "$pl")
  dup=$(P -c "insert into expenses (category, amount, expense_date, client_request_id) values ('packaging', 1, current_date, '$key')" 2>&1 | grep -c "duplicate key")
  size=$(P -c "select pg_size_pretty(pg_relation_size('expenses_client_request_id_key'))")
  [ "$dup" = "1" ] || fail=1
  case "$info" in Index*) ;; *) fail=1 ;; esac
  echo "rows=$n fill_${add}_ms=$fill_ms lookup=\"$info\" repeat_refused=$([ "$dup" = 1 ] && echo yes || echo NO) index_size=$size"
done
# collision sanity: 1M random keys, 0 duplicates expected (the unique index would have refused one)
echo "distinct_keys=$(P -c "select count(distinct client_request_id) = count(client_request_id) from expenses")"
[ $fail -eq 0 ]
