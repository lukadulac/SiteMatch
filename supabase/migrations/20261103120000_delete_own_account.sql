-- Let a user delete their own account (GDPR right to erasure).
--
-- Mirrors the admin "delete" decision in admin_moderate_user: the transaction marks
-- the account deleted (so the account gate blocks it at once), removes listings and
-- briefs nobody else is working on, drops the role profiles and anonymises the
-- profile. Unlike an admin deletion it does not block the email, so the person can
-- register again later. The server action then soft-deletes the auth user with the
-- service role and records auth_deleted_at.
--
-- What other people keep: conversations, messages, workrooms and briefs that are
-- assigned or completed stay, shown as "Deleted user". Pending applications and
-- service requests are withdrawn or cancelled so nobody waits on a deleted account.

create function public.delete_own_account(confirm_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  caller_role public.user_role;
  login_email text;
  caller_claims text := current_setting('request.jwt.claims', true);
  caller_sub text := current_setting('request.jwt.claim.sub', true);
  listing record;
begin
  if caller is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;

  select role into caller_role from public.profiles where id = caller for update;
  if not found then raise exception 'Account not found.' using errcode = 'P0002'; end if;
  if caller_role = 'admin' then
    raise exception 'Admin accounts cannot be deleted here.' using errcode = '42501';
  end if;

  if exists (select 1 from public.account_moderation where user_id = caller and status = 'deleted') then
    return jsonb_build_object('id', caller, 'alreadyDeleted', true);
  end if;

  select email into login_email from auth.users where id = caller for update;
  if confirm_email is null or lower(btrim(confirm_email)) <> lower(login_email) then
    raise exception 'The email does not match this account.' using errcode = '22023';
  end if;

  -- The caller is authorised. From here the function acts as the system, as the admin
  -- path does through the service role: guard_account_write and preserve_listing_chat
  -- restrain a user's own direct writes, and the gate below closes before they could
  -- run. The caller's claims are restored before returning.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  -- First, so the account gate blocks the account at once and sync_profile_email
  -- writes the placeholder address.
  insert into public.account_moderation(user_id, status, suspended_until, reason)
  values (caller, 'deleted', null, 'Deleted by the account owner.')
  on conflict (user_id) do update set status = 'deleted', suspended_until = null,
    reason = excluded.reason, updated_at = now();

  update public.applications set status = 'withdrawn', updated_at = now()
  where provider_id = caller and status in ('pending', 'viewed', 'shortlisted');

  update public.provider_service_requests set status = 'cancelled', updated_at = now()
  where (client_id = caller or provider_id = caller) and status = 'pending';

  -- Briefs someone was hired on stay for the other side; the rest go.
  for listing in select id from public.projects
    where client_id = caller and status not in ('assigned', 'completed') order by id loop
    delete from public.projects where id = listing.id;
  end loop;
  for listing in select s.id from public.provider_service_listings s where s.provider_id = caller
    and not exists (select 1 from public.service_workrooms w where w.service_id = s.id and w.status = 'active') order by s.id loop
    delete from public.provider_service_listings where id = listing.id;
  end loop;
  -- Listings kept for an active workroom are taken off the marketplace.
  update public.provider_service_listings set status = 'paused', is_hidden = true where provider_id = caller;

  delete from public.client_profiles where user_id = caller;
  delete from public.provider_profiles where user_id = caller;
  update public.profiles set full_name = 'Deleted user', email = caller::text || '@deleted.invalid',
    avatar_url = null, phone = null, country = null, city = null, is_active = false where id = caller;


  insert into public.moderation_events(actor_id, owner_id, target_type, target_id, action, reason)
  values (caller, caller, 'user', caller, 'delete', 'Deleted by the account owner.');

  perform set_config('request.jwt.claims', coalesce(caller_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(caller_sub, ''), true);
  return jsonb_build_object('id', caller, 'alreadyDeleted', false);
end;
$$;

revoke all on function public.delete_own_account(text) from public, anon;
grant execute on function public.delete_own_account(text) to authenticated;
