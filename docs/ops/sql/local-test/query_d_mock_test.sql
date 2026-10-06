-- LOCAL ONLY: checks Query D (docs/ops/sql/03_READONLY_D_…) with synthetic
-- SECURITY DEFINER functions (gated, open writer, open reader, JWT-claims
-- gate, revoked, trigger) inside BEGIN … ROLLBACK. Expected classification:
-- t_open = E, t_read = D, t_gated / t_jwt = C, t_rows = B, t_trg = A.
-- Run from the repository root.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create function public.t_gated() returns void language plpgsql security definer set search_path=public as $f$
begin
  if not public.is_owner_or_admin() then raise exception 'no'; end if;
  update products set name = name where false;
end $f$;
create function public.t_open() returns void language plpgsql security definer as $f$
begin delete from audit_log where false; end $f$;
create function public.t_rows() returns setof products language sql security definer as $f$ select * from products $f$;
revoke execute on function public.t_rows() from public;
create function public.t_trg() returns trigger language plpgsql security definer as $f$ begin return new; end $f$;
create function public.t_jwt() returns setof products language plpgsql security definer as $f$ begin if current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' then raise exception 'no'; end if; return query select * from products; end $f$;
create function public.t_read() returns bigint language sql security definer as $f$ select count(*) from products $f$;
\i docs/ops/sql/03_READONLY_D_definer_function_identity_check.sql
rollback;
