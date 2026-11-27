#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-27). Never point this at Supabase.
# Installs every waiting database draft, in order, on a throwaway copy shaped like production as
# the owner's read-only looks of Nov 27 showed it:
#   * profiles.role is the fixed list app_role (owner, employee, ai_agent, administrator);
#   * current_role() returns app_role and checks only "not removed"; is_owner_or_admin() checks
#     role and "active" (both run with raised rights, as in production);
#   * is_active_staff() does NOT exist until drafts/72;
#   * profiles rules: a signed-in person reads their own row; the owner reads all.
# Why: on Nov 27 step A stopped in production on a helper the local stand-ins had and production
# did not. Every draft must now install on this shape. All rows synthetic.
# Usage: production_shape_install_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_production_shape_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
OUTF=$(mktemp)
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
# Nov 27 (night): built from the real-shape schema alone, NOT copied from he_real, because he_real
# already has drafts/10 and drafts/13 installed and production does not: the launch-critical
# reliability drafts (10-29: stock functions R1-R5, request keys, integrity checks, report totals)
# must install on the production shape too.
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB" >/dev/null || { echo "cannot create $DB"; exit 2; }
psql "${CONN[@]}" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/local-test/01_REAL_SHAPE_schema_for_local_tests.sql" >"$OUTF" 2>&1 || { echo "real-shape schema failed:"; cat "$OUTF"; exit 2; }
q "drop function if exists public.is_active_staff() cascade;
   drop function if exists public.active_role() cascade;
   drop policy if exists local_self on profiles;
   do \$\$ begin create type app_role as enum ('owner', 'employee', 'ai_agent', 'administrator'); exception when duplicate_object then null; end \$\$;
   alter table profiles alter column role drop default;
   alter table profiles alter column role type app_role using role::app_role;
   drop function if exists public.current_role() cascade;
   create function public.current_role() returns app_role language sql stable security definer set search_path = public as
     \$f\$ select role from public.profiles where id = auth.uid() and deleted_at is null; \$f\$;
   create or replace function public.is_owner_or_admin() returns boolean language sql stable security definer set search_path = public as
     \$f\$ select exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('owner'::app_role, 'administrator'::app_role) and profiles.is_active = true); \$f\$;
   create policy profiles_select_own on profiles for select using (id = auth.uid());
   create policy profiles_select on profiles for select using ((id = auth.uid()) or (public.current_role() = 'owner'::app_role));" >"$OUTF" 2>&1
grep -q ERROR "$OUTF" && { echo "set-up failed:"; cat "$OUTF"; }
# STAND-INS for what production has and the local copy lacks (shapes from the earlier read-only
# looks; bodies synthetic): Supabase's storage schema, the Shipping/Tracking agent's table, the
# guard on account details, and the three history functions step 18 changed.
q "create schema if not exists storage;
   create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
   create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null,
     owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(), metadata jsonb);
   alter table storage.objects enable row level security;
   grant usage on schema storage to authenticated, anon;
   grant select, insert, update, delete on storage.objects to authenticated, anon;
   grant select on storage.buckets to authenticated, anon;
   create table public.shipments (
     id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
     external_fulfillment_id text, carrier text, tracking_number text, tracking_url text,
     shipment_status text not null default 'pending', shipped_at timestamptz, delivered_at timestamptz, last_status_at timestamptz,
     created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
     unique (order_id, external_fulfillment_id));
   alter table public.shipments enable row level security;
   create policy shipments_owner_admin on public.shipments for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());
   create function public.guard_profile_privileged_columns() returns trigger language plpgsql set search_path = public as \$f\$
   begin
     if auth.uid() is null then return new; end if;
     if (new.role is distinct from old.role or new.is_break_glass is distinct from old.is_break_glass) and coalesce(public.current_role()::text, '') <> 'owner' then
       raise exception 'STAND-IN: only the owner changes a role.' using errcode = '42501';
     end if;
     return new;
   end \$f\$;
   create trigger guard_profile_privileged_columns before update on profiles for each row execute function public.guard_profile_privileged_columns();
   create function public.employee_activity_people() returns table(role text)
     language plpgsql stable security definer set search_path to 'public' as \$f\$
   begin return query select p.role::text from profiles p where p.id = auth.uid(); end \$f\$;
   create function public.employee_activity(p_search text default null, p_person uuid default null, p_area text default null,
     p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 100, p_offset integer default 0)
     returns table(id bigint, person_role text)
     language plpgsql stable security definer set search_path to 'public' as \$f\$
   begin return query select 1::bigint, p.role::text from profiles p where p.id = auth.uid(); end \$f\$;
   create function public.list_my_sessions() returns table(n integer)
     language sql security definer set search_path to 'auth', 'public' as \$f\$ select 1 \$f\$;" >"$OUTF" 2>&1
grep -q ERROR "$OUTF" && { echo "stand-ins failed:"; cat "$OUTF"; }
echo "Every waiting draft installs on a copy shaped like production (throwaway database $DB)"
ok "set-up: the role is app_role and current_role() answers app_role" "$(q "select pg_get_function_result(to_regprocedure('public.current_role()'))")" "app_role"
ok "set-up: is_active_staff() is missing, as in production" "$(q "select to_regprocedure('public.is_active_staff()') is null")" "t"

# STAND-IN, NOT YET VERIFIED against production (morning list of Nov 28): the switches table the
# dashboard reads (Shopify Order Sync, Feature Flags page). Drafts 21, 27 and 29 add their switch rows
# to it and check its columns first (flag_key, label, description, enabled, an id that fills itself in).
# Same shape as the other local tests' stand-in; audited like production's other switch tables.
q "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false);
   insert into public.feature_flags (flag_key, label, enabled) values ('shopify_order_sync', 'Shopify order sync', false);
   create trigger feature_flags_audit after insert or update or delete on public.feature_flags for each row execute function public.local_audit();" >"$OUTF" 2>&1
grep -q ERROR "$OUTF" && { echo "feature_flags stand-in failed:"; cat "$OUTF"; }
# The order production will see: first the five already installed there (Nov 26-27: 72, 50, 74, 68, 70),
# then the launch-critical reliability drafts in their install order (10, 21, 17, 23, 19, 27, 25, 29, 13),
# then every other waiting draft.
ORDER="72 50 74 68 70 10 21 17 23 19 27 25 29 13 32 34 36 38 40 44 46 48 52 54 56 58 60 62 64 66"
for id in $ORDER; do
  f=$(ls "$DIR"/drafts/${id}_DRAFT_*.sql 2>/dev/null | grep -v rollback | head -1)
  [ -n "$f" ] || { ok "drafts/$id exists" "missing" "present"; continue; }
  r=$(run "$f")
  if [ "$r" != 0 ]; then echo "      $(grep -m1 -i 'error' "$OUTF" | cut -c1-200)"; fi
  ok "drafts/$id installs ($(basename "$f"))" "$r" "0"
done

# Production's audit_trigger_function() writes new.id / old.id (owner's look, Nov 27): a table it is
# attached to without an id column refuses every write ('record "new" has no field "id"'), as step A's
# shared_settings did before step A2. After every waiting draft is installed, no such table may remain.
ok "every table with production's audit trigger has the id column it records" "$(q "select coalesce(string_agg(distinct c.relname::text, ','), '') from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and p.oid = (select tgfoid from pg_trigger where tgrelid = 'public.tasks'::regclass and not tgisinternal and lower(tgname) like '%audit%' limit 1) and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped)")" ""

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
