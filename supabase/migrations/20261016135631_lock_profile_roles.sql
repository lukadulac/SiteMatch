-- Only admins can set a profile's role or active status.
--
-- The profiles policies let a user insert or update their own row without
-- restricting columns, so any signed-in user could make themselves an admin
-- (and is_admin() then opens every admin policy). A trigger narrows the write
-- to what the app does: provisioning inserts a client or provider profile, and
-- an upsert that repeats the same role is still fine.
--
-- Trusted backend roles (the service role, the database owner, supabase_admin)
-- are not limited. That includes security definer functions owned by the
-- database owner, which run as that owner: such a function must never take a
-- role or is_active value from its caller and write it to profiles.
--
-- is_admin() is only consulted when a privileged column is actually changing,
-- so ordinary profile edits do not depend on the profiles select policies.

begin;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  changes_privileged_column boolean;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    changes_privileged_column :=
      new.role is null
      or new.role not in ('client', 'provider')
      or new.is_active is distinct from true;
  else
    changes_privileged_column :=
      new.role is distinct from old.role
      or new.is_active is distinct from old.is_active;
  end if;

  if changes_privileged_column and not public.is_admin() then
    raise exception 'Only admins can set a profile role or active status.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_profile_privileged_columns() from public, anon, authenticated;

drop trigger if exists trg_profiles_guard_privileged_columns on public.profiles;
drop trigger if exists trg_profiles_zz_guard_privileged_columns on public.profiles;

-- BEFORE triggers fire in name order; the zz keeps the guard last so it checks
-- the row as every other trigger leaves it.
create trigger trg_profiles_zz_guard_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

commit;
