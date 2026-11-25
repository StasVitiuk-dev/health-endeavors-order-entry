-- LOCAL TEST ONLY (2026-11-25). Never run this against Supabase.
-- Makes a throwaway copy of the local database look like production for the four-levels
-- tests (people_levels_test.sh, people_accounts_core_test.mjs): the role as a list type
-- without "manager", production's two row rules on the accounts table (your own row; the
-- owner), a stand-in for today's guard written from its description (not copied), and
-- made-up accounts. The ids are the ones both tests use.
-- like production: the role is a list type without "manager"
create type public.app_role as enum ('owner', 'employee', 'ai_agent', 'administrator');
delete from profiles where role not in ('owner', 'employee', 'ai_agent', 'administrator');
alter table profiles alter column role drop default;
alter table profiles alter column role type public.app_role using role::public.app_role;
alter table profiles alter column role set default 'employee';
create or replace function public.is_owner_or_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('owner','administrator') from profiles where id = auth.uid() and is_active and deleted_at is null), false) $$;
drop function public.current_role();
create function public.current_role() returns public.app_role language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and is_active and deleted_at is null $$;
-- like production: your own row, or the owner
drop policy if exists local_self on profiles;
create policy stand_in_read on profiles for select to authenticated using (id = auth.uid() or coalesce(public.current_role()::text, '') = 'owner');
create policy stand_in_change on profiles for update to authenticated using (id = auth.uid() or coalesce(public.current_role()::text, '') = 'owner') with check (id = auth.uid() or coalesce(public.current_role()::text, '') = 'owner');
create policy stand_in_add on profiles for insert to authenticated with check (coalesce(public.current_role()::text, '') = 'owner');
revoke delete on profiles from authenticated;
-- a stand-in for today's guard, from its description: nobody signed in passes; a level or
-- the emergency mark is the owner's only; switching an account on or off is the owner's, or an
-- administrator's for someone else
create function public.guard_profile_privileged_columns() returns trigger language plpgsql set search_path = public as $$
declare v_role text := coalesce(public.current_role()::text, '');
begin
  if auth.uid() is null then return new; end if;
  if (new.role is distinct from old.role or new.is_break_glass is distinct from old.is_break_glass) and v_role <> 'owner' then
    raise exception 'Only the owner can change a person''s role or break-glass access. Nothing was changed.' using errcode = '42501';
  end if;
  if (new.is_active is distinct from old.is_active or new.deleted_at is distinct from old.deleted_at)
     and not (v_role = 'owner' or (v_role = 'administrator' and old.id <> auth.uid())) then
    raise exception 'STAND-IN: only the owner or an administrator can switch an account on or off.' using errcode = '42501';
  end if;
  return new;
end $$;
comment on function public.guard_profile_privileged_columns() is 'STAND-IN note that was there before';
create trigger guard_profile_privileged_columns before update on profiles for each row execute function public.guard_profile_privileged_columns();
delete from profiles where id in ('00000000-0000-4000-8000-000000000c01','00000000-0000-4000-8000-000000000c02','00000000-0000-4000-8000-000000000c03','00000000-0000-4000-8000-000000000c04','00000000-0000-4000-8000-000000000c05','00000000-0000-4000-8000-000000000c06','00000000-0000-4000-8000-000000000c07','00000000-0000-4000-8000-000000000c08','00000000-0000-4000-8000-000000000c09','00000000-0000-4000-8000-000000000c0a','00000000-0000-4000-8000-000000000c0b');
insert into profiles (id, email, display_name, role, is_active, is_break_glass, account_number, created_at) values
  ('00000000-0000-4000-8000-000000000c01','owner@example.test','SYNTHETIC Owner','owner',true,false,'920000001', now() - interval '90 days'),
  ('00000000-0000-4000-8000-000000000c02','emergency@example.test','SYNTHETIC Emergency','owner',true,true,'920000002', now() - interval '90 days'),
  ('00000000-0000-4000-8000-000000000c03','admin1@example.test','SYNTHETIC Admin One','administrator',true,false,'920000003', now() - interval '60 days'),
  ('00000000-0000-4000-8000-000000000c04','admin2@example.test','SYNTHETIC Admin Two','administrator',true,false,'920000004', now() - interval '60 days'),
  ('00000000-0000-4000-8000-000000000c05','lead1@example.test','SYNTHETIC Lead One','employee',true,false,'920000005', now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000c06','lead2@example.test','SYNTHETIC Lead Two','employee',true,false,'920000006', now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000c07','staff1@example.test','SYNTHETIC Staff One','employee',true,false,'920000007', now() - interval '20 days'),
  ('00000000-0000-4000-8000-000000000c08','staff2@example.test','SYNTHETIC Staff Two','employee',true,false,'920000008', now() - interval '20 days'),
  ('00000000-0000-4000-8000-000000000c09','gone@example.test','SYNTHETIC Gone','employee',false,false,'920000009', now() - interval '200 days'),
  ('00000000-0000-4000-8000-000000000c0a','agent@example.test','SYNTHETIC Agent','ai_agent',true,false,'920000010', now() - interval '90 days'),
  ('00000000-0000-4000-8000-000000000c0b','new@example.test',null,'employee',false,false,'920000011', now() - interval '1 minute');