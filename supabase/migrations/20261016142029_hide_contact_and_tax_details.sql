-- Hide other users' contact and tax details.
--
-- Every signed-in user could read every profile's email and phone
-- (profiles_select_own_or_public used `using (true)`), and every client's tax
-- ID and project idea (client_profiles_select_all_authenticated). The app only
-- needs other users' names and locations (messaging, workrooms, applications,
-- Find Talent), so:
--
--   * profiles stays readable row by row, but only these columns: id, role,
--     full_name, avatar_url, country, city, is_active, created_at, updated_at.
--     email and phone are not readable by any signed-in user, their own
--     included; a user reads their own through get_own_contact_details().
--     A column added to profiles later is unreadable until granted. anon gets
--     the same columns (it has no select policy, so it sees no rows, but a
--     signed-out page that embeds profiles must not fail on a missing grant).
--   * profiles.email always follows auth.users. It stays writable, and the
--     unique index on it is enforced against rows the caller cannot read, so a
--     writable email would let anyone test whether an address is registered
--     (409 on a duplicate) and point mail meant for them at someone else.
--   * client_profiles is readable by its owner and admins only.
--
-- Writes are otherwise unchanged: a user still inserts, upserts and updates
-- their own phone and the rest (INSERT and UPDATE privileges are not narrowed).
--
-- Rollout: the app must be deployed before this runs. The previous app selects
-- email and phone, which fail once the columns are revoked.

begin;

-- A column-level revoke cannot narrow a table-level grant, so take the table
-- grant away and grant the readable columns back.
revoke select on public.profiles from authenticated, anon;

grant select (id, role, full_name, avatar_url, country, city, is_active, created_at, updated_at)
  on public.profiles to authenticated, anon;

-- One select policy for profiles instead of two overlapping ones; the column
-- grant above is what limits what a row reveals.
drop policy if exists "Profiles are readable by owner or admin" on public.profiles;
drop policy if exists profiles_select_own_or_public on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;

create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

-- Tax IDs and project ideas are private to the client (and admins, through the
-- existing "readable by owner or admin" policy). Nothing signed-out reads them.
drop policy if exists client_profiles_select_all_authenticated on public.client_profiles;

revoke select on public.client_profiles from anon;

-- profiles.email is the address on the login, whatever a profile write says.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  login_email text;
begin
  select u.email into login_email from auth.users u where u.id = new.id;

  if login_email is not null then
    new.email := login_email;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists trg_profiles_sync_email on public.profiles;

create trigger trg_profiles_sync_email
  before insert or update on public.profiles
  for each row execute function public.sync_profile_email();

create or replace function public.get_own_contact_details()
returns table (email text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  return query
    select p.email, p.phone
    from public.profiles p
    where p.id = current_user_id;
end;
$function$;

revoke all on function public.get_own_contact_details() from public, anon;
grant execute on function public.get_own_contact_details() to authenticated;

commit;
