begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.moderation_secret (
  singleton boolean primary key default true check (singleton),
  secret bytea not null
);
insert into private.moderation_secret values (true, extensions.gen_random_bytes(32));
create table private.blocked_emails (
  fingerprint bytea primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
revoke all on all tables in schema private from public, anon, authenticated;

create table public.account_moderation (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null check (status in ('active', 'suspended', 'banned', 'deleted')),
  suspended_until timestamptz,
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  updated_at timestamptz not null default now(),
  auth_deleted_at timestamptz,
  check ((status = 'suspended') = (suspended_until is not null))
);
create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  target_type text not null check (target_type in ('user', 'project', 'service')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'delete', 'suspend', 'ban', 'reactivate')),
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  created_at timestamptz not null default now()
);
create index moderation_events_owner_created_idx on public.moderation_events(owner_id, created_at desc, id desc);
create index moderation_events_created_idx on public.moderation_events(created_at desc, id desc);
alter table public.account_moderation enable row level security;
alter table public.moderation_events enable row level security;
revoke all on public.account_moderation, public.moderation_events from anon, authenticated;
grant select on public.account_moderation, public.moderation_events to authenticated;

create function public.is_account_enabled(target_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    left join public.account_moderation m on m.user_id = p.id
    where p.id = target_user_id and p.is_active
      and (m.status is null or m.status = 'active'
        or (m.status = 'suspended' and m.suspended_until <= now()))
  );
$$;
revoke all on function public.is_account_enabled(uuid) from public;
grant execute on function public.is_account_enabled(uuid) to anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_account_enabled(auth.uid()) and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy account_moderation_read on public.account_moderation for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy moderation_events_read on public.moderation_events for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

alter table public.projects add column is_hidden boolean not null default false;
alter table public.provider_service_listings add column is_hidden boolean not null default false;

-- A detached conversation is immutable history, not a newly creatable chat type.
alter table public.conversations add column source_deleted_at timestamptz,
  add column source_title text;
alter table public.conversations drop constraint conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check check (
  (source_deleted_at is not null and project_id is null and application_id is null and service_request_id is null)
  or (source_deleted_at is null and (
    (project_id is not null and service_request_id is null)
    or (service_request_id is not null and project_id is null and application_id is null)
  ))
);
alter table public.conversations drop constraint conversations_project_id_fkey;
alter table public.conversations add constraint conversations_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete restrict;
-- Keep identity tombstones and messages even if Auth is administratively deleted.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete restrict;

create function private.assert_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end;
$$;

create function private.email_fingerprint(email text) returns bytea
language sql stable security definer set search_path = '' as $$
  select extensions.hmac(convert_to(lower(btrim(email)), 'UTF8'), secret, 'sha256')
  from private.moderation_secret where singleton;
$$;

-- Covers direct Auth signups and email changes as well as the app's registration form.
create function private.guard_auth_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.blocked_emails b
    where b.fingerprint = private.email_fingerprint(new.email)
      and (tg_op = 'INSERT' or b.user_id <> new.id))
    or (coalesce(new.email_change, '') <> '' and exists (
      select 1 from private.blocked_emails b
      where b.fingerprint = private.email_fingerprint(new.email_change)
    )) then
    raise exception 'Account registration is unavailable.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.email is distinct from old.email
    and exists (select 1 from public.account_moderation where user_id = new.id and status in ('banned', 'deleted'))
    and new.deleted_at is null then
    raise exception 'Account unavailable.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger moderation_auth_email before insert or update of email, email_change on auth.users
  for each row execute function private.guard_auth_email();

create function public.before_user_created_moderation(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.blocked_emails
    where fingerprint = private.email_fingerprint(event->'user'->>'email')) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Account registration is unavailable.'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_user_created_moderation(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_moderation(jsonb) to supabase_auth_admin;

create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare login_email text;
begin
  if exists (select 1 from public.account_moderation where user_id = new.id and status = 'deleted') then
    new.email := new.id::text || '@deleted.invalid';
  else
    select email into login_email from auth.users where id = new.id;
    if login_email is not null then new.email := login_email; end if;
  end if;
  return new;
end;
$$;

-- Restrictive policies AND with all existing permissive policies. Triggers also
-- cover writes inside the pre-existing SECURITY DEFINER marketplace RPCs.
create function private.guard_account_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_account_enabled(auth.uid()) then
    if not (tg_table_name = 'profiles' and tg_op = 'INSERT'
      and not exists (select 1 from public.profiles where id = auth.uid())) then
      raise exception 'Account unavailable.' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['profiles','client_profiles','provider_profiles','projects',
    'provider_service_listings','provider_service_requests','applications','conversations',
    'messages','service_workrooms','project_request_features','project_request_goals',
    'provider_business_domains','provider_feature_capabilities','provider_goal_focuses',
    'provider_languages','provider_service_types'] loop
    execute format('create trigger moderation_account_write before insert or update or delete on public.%I for each row execute function private.guard_account_write()', t);
    if t <> 'profiles' then
      execute format('create policy moderation_account_access on public.%I as restrictive for all to authenticated using (public.is_account_enabled(auth.uid())) with check (public.is_account_enabled(auth.uid()))', t);
    end if;
  end loop;
end;
$$;

create function private.guard_listing_moderation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') and (
    (tg_op = 'INSERT' and new.is_hidden) or
    (tg_op = 'UPDATE' and new.is_hidden is distinct from old.is_hidden)
  ) then
    raise exception 'Use the moderation action.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger moderation_listing_fields before insert or update on public.projects
  for each row execute function private.guard_listing_moderation();
create trigger moderation_listing_fields before insert or update on public.provider_service_listings
  for each row execute function private.guard_listing_moderation();

create function private.guard_admin_profile_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if new.is_active is distinct from old.is_active then
      raise exception 'Use the moderation action.' using errcode = '42501';
    end if;
    if old.id = auth.uid() and new.role is distinct from old.role then
      raise exception 'Self moderation is not allowed.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger zzzz_moderation_profile before update on public.profiles
  for each row execute function private.guard_admin_profile_write();

create policy moderation_project_visibility on public.projects as restrictive for select to anon, authenticated
using (public.is_admin() or client_id = auth.uid() or (not is_hidden and public.is_account_enabled(client_id)));
create policy moderation_service_visibility on public.provider_service_listings as restrictive for select to anon, authenticated
using (public.is_admin() or provider_id = auth.uid() or (not is_hidden and public.is_account_enabled(provider_id)));

-- Lookup the source without public-listing RLS: hiding a listing must not
-- accidentally prevent its existing participants from sending messages.
create function public.can_send_conversation_message(target_conversation_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_account_enabled(auth.uid()) and exists (
    select 1 from public.conversations c where c.id = target_conversation_id
      and (c.client_id = auth.uid() or c.provider_id = auth.uid())
      and c.source_deleted_at is null
      and (exists (
        select 1 from public.applications a join public.projects p on p.id = a.project_id
        where a.id = c.application_id and a.project_id = c.project_id
          and a.provider_id = c.provider_id and p.client_id = c.client_id
          and a.status in ('pending','viewed','shortlisted','accepted')
      ) or exists (
        select 1 from public.provider_service_requests r where r.id = c.service_request_id
          and r.client_id = c.client_id and r.provider_id = c.provider_id
      ))
  );
$$;
revoke all on function public.can_send_conversation_message(uuid) from public, anon;
grant execute on function public.can_send_conversation_message(uuid) to authenticated;
drop policy "Messages are insertable in valid conversations" on public.messages;
create policy "Messages are insertable in valid conversations" on public.messages
  for insert to authenticated with check (sender_id = auth.uid() and public.can_send_conversation_message(conversation_id));

create function private.guard_archived_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare archived_at timestamptz;
begin
  select source_deleted_at into archived_at from public.conversations where id = new.conversation_id for share;
  if archived_at is not null then
    raise exception 'This conversation is read-only.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger moderation_message_archive before insert on public.messages
  for each row execute function private.guard_archived_message();

-- Serialize a new request/application against hiding/deleting its listing.
create function private.guard_new_engagement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'provider_service_requests' then
    select provider_id into owner_id from public.provider_service_listings
    where id = new.service_id and not is_hidden and status = 'published' for share;
    if owner_id is null or owner_id <> new.provider_id or not public.is_account_enabled(owner_id) then
      raise exception 'Service is not available for requests.' using errcode = '42501';
    end if;
  else
    select client_id into owner_id from public.projects
    where id = new.project_id and not is_hidden and status in ('published', 'in_discussion') for share;
    if owner_id is null or not public.is_account_enabled(owner_id) then
      raise exception 'Project is not available for applications.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger moderation_new_request before insert on public.provider_service_requests
  for each row execute function private.guard_new_engagement();
create trigger moderation_new_application before insert on public.applications
  for each row execute function private.guard_new_engagement();
revoke insert on public.provider_service_requests from authenticated, anon;

create function private.preserve_listing_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'projects' then
    if old.status = 'assigned' then
      raise exception 'Resolve active work before deleting this listing.' using errcode = '55000';
    end if;
    update public.conversations set source_title = old.title, source_deleted_at = now(),
      project_id = null, application_id = null where project_id = old.id;
  else
    if auth.uid() is not null and not public.is_admin()
      and exists (select 1 from public.provider_service_requests where service_id = old.id) then
      raise exception 'Related requests prevent deletion.' using errcode = '23503';
    end if;
    if exists (select 1 from public.service_workrooms where service_id = old.id and status = 'active') then
      raise exception 'Resolve active work before deleting this listing.' using errcode = '55000';
    end if;
    update public.conversations set source_title = old.title, source_deleted_at = now(), service_request_id = null
    where service_request_id in (select id from public.provider_service_requests where service_id = old.id);
    delete from public.service_workrooms where service_id = old.id;
    delete from public.provider_service_requests where service_id = old.id;
  end if;
  return old;
end;
$$;
create trigger moderation_preserve_chat before delete on public.projects
  for each row execute function private.preserve_listing_chat();
create trigger moderation_preserve_chat before delete on public.provider_service_listings
  for each row execute function private.preserve_listing_chat();

-- Prevent direct admin or owner deletion from bypassing the reason/audit RPC.
create function private.guard_direct_listing_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') and public.is_admin() then
    raise exception 'Use the moderation action.' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger moderation_00_delete before delete on public.projects
  for each row execute function private.guard_direct_listing_delete();
create trigger moderation_00_delete before delete on public.provider_service_listings
  for each row execute function private.guard_direct_listing_delete();

create function public.admin_moderate_listing(target_type text, target_id uuid, decision text, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_owner uuid;
begin
  perform private.assert_admin();
  if target_type is null or decision is null or target_type not in ('project','service') or decision not in ('hide','restore','delete')
    or reason is null or char_length(btrim(reason)) not between 10 and 2000 then
    raise exception 'Invalid moderation input.' using errcode = '22023';
  end if;
  if target_type = 'project' then
    select client_id into target_owner from public.projects where id = target_id for update;
  else
    select provider_id into target_owner from public.provider_service_listings where id = target_id for update;
  end if;
  if target_owner is null then raise exception 'Resource not found.' using errcode = 'P0002'; end if;
  if target_owner = auth.uid() then raise exception 'Self moderation is not allowed.' using errcode = '42501'; end if;
  if target_type = 'project' then
    if decision = 'delete' then delete from public.projects where id = target_id;
    else update public.projects set is_hidden = (decision = 'hide') where id = target_id; end if;
  else
    if decision = 'delete' then delete from public.provider_service_listings where id = target_id;
    else update public.provider_service_listings set is_hidden = (decision = 'hide') where id = target_id; end if;
  end if;
  insert into public.moderation_events(actor_id, owner_id, target_type, target_id, action, reason)
  values (auth.uid(), target_owner, target_type, target_id, decision, btrim(reason));
  return jsonb_build_object('id', target_id, 'action', decision);
end;
$$;

create function public.admin_moderate_user(target_user_id uuid, decision text, reason text, suspension_end timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_profile public.profiles; login_email text; new_status text; listing record;
begin
  perform private.assert_admin();
  if target_user_id = auth.uid() then raise exception 'Self moderation is not allowed.' using errcode = '42501'; end if;
  if decision is null or decision not in ('suspend','ban','reactivate','delete') or reason is null
    or char_length(btrim(reason)) not between 10 and 2000
    or (decision = 'suspend' and (suspension_end is null or suspension_end <= now()))
    or (decision <> 'suspend' and suspension_end is not null) then
    raise exception 'Invalid moderation input.' using errcode = '22023';
  end if;
  select * into target_profile from public.profiles where id = target_user_id for update;
  if not found then raise exception 'Resource not found.' using errcode = 'P0002'; end if;
  if target_profile.role = 'admin' then raise exception 'Admin accounts cannot be moderated.' using errcode = '42501'; end if;
  if exists (select 1 from public.account_moderation where user_id = target_user_id and status = 'deleted') then
    if decision = 'delete' then return jsonb_build_object('id', target_user_id, 'action', decision,
      'authDeleted', exists (select 1 from auth.users where id = target_user_id and deleted_at is not null)); end if;
    raise exception 'Deleted accounts cannot be restored.' using errcode = '55000';
  end if;
  if decision = 'suspend' and exists (select 1 from public.account_moderation where user_id = target_user_id and status = 'banned') then
    raise exception 'Reactivate a banned account before suspending it.' using errcode = '55000';
  end if;
  select email into login_email from auth.users where id = target_user_id for update;
  if decision in ('ban','delete') then
    insert into private.blocked_emails(fingerprint, user_id)
    values (private.email_fingerprint(login_email), target_user_id) on conflict do nothing;
  elsif decision = 'reactivate' then
    delete from private.blocked_emails where user_id = target_user_id;
  end if;
  new_status := case decision when 'suspend' then 'suspended' when 'ban' then 'banned'
    when 'delete' then 'deleted' else 'active' end;
  insert into public.account_moderation(user_id, status, suspended_until, reason)
  values (target_user_id, new_status, suspension_end, btrim(reason))
  on conflict (user_id) do update set status = excluded.status, suspended_until = excluded.suspended_until,
    reason = excluded.reason, updated_at = now();
  if decision = 'reactivate' then update public.profiles set is_active = true where id = target_user_id; end if;
  if decision = 'delete' then
    -- Active engagements retain their references. They remain hidden by the
    -- account gate; the other participant retains their workroom and messages.
    for listing in select id from public.projects where client_id = target_user_id and status <> 'assigned' order by id loop
      delete from public.projects where id = listing.id;
    end loop;
    for listing in select s.id from public.provider_service_listings s where s.provider_id = target_user_id
      and not exists (select 1 from public.service_workrooms w where w.service_id = s.id and w.status = 'active') order by s.id loop
      delete from public.provider_service_listings where id = listing.id;
    end loop;
    delete from public.client_profiles where user_id = target_user_id;
    delete from public.provider_profiles where user_id = target_user_id;
    update public.profiles set full_name = 'Deleted user', email = target_user_id::text || '@deleted.invalid',
      avatar_url = null, phone = null, country = null, city = null, is_active = false where id = target_user_id;
  end if;
  insert into public.moderation_events(actor_id, owner_id, target_type, target_id, action, reason)
    values (auth.uid(), target_user_id, 'user', target_user_id, decision, btrim(reason));
  return jsonb_build_object('id', target_user_id, 'action', decision);
end;
$$;

create function public.admin_confirm_auth_deleted(target_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  if not exists (select 1 from auth.users where id = target_user_id and deleted_at is not null) then
    raise exception 'Auth deletion is not complete.' using errcode = '55000';
  end if;
  update public.account_moderation set auth_deleted_at = now() where user_id = target_user_id and status = 'deleted';
end;
$$;

create function public.admin_list_records(resource text, page_number integer default 1, filter_value text default 'all')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare items jsonb; total bigint; page_offset bigint := (page_number::bigint - 1) * 20;
begin
  perform private.assert_admin();
  if page_number is null or page_number < 1 or page_number > 1000000
    or resource is null or resource not in ('users','projects','services','audit')
    or filter_value is null or filter_value not in ('all','hidden','visible','active','suspended','banned','deleted') then
    raise exception 'Invalid list input.' using errcode = '22023';
  end if;
  if (resource = 'users' and filter_value in ('hidden','visible'))
    or (resource in ('projects','services') and filter_value not in ('all','hidden','visible'))
    or (resource = 'audit' and filter_value <> 'all') then
    raise exception 'Invalid list input.' using errcode = '22023';
  end if;
  if resource = 'users' then
    select count(*) into total from public.profiles p left join public.account_moderation m on m.user_id = p.id
      where filter_value = 'all' or (filter_value = 'active' and public.is_account_enabled(p.id))
        or (filter_value <> 'active' and (case when m.status = 'suspended' and m.suspended_until <= now() then 'active' else coalesce(m.status,'active') end) = filter_value);
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into items from (
      select p.id, p.full_name, p.email, p.role, p.is_active, p.created_at,
        coalesce(m.status,'active') as moderation_status, m.suspended_until, m.auth_deleted_at,
        public.is_account_enabled(p.id) as access_enabled
      from public.profiles p left join public.account_moderation m on m.user_id = p.id
      where filter_value = 'all' or (filter_value = 'active' and public.is_account_enabled(p.id))
        or (filter_value <> 'active' and (case when m.status = 'suspended' and m.suspended_until <= now() then 'active' else coalesce(m.status,'active') end) = filter_value)
      order by p.created_at desc, p.id desc limit 20 offset page_offset
    ) x;
  elsif resource = 'projects' then
    select count(*) into total from public.projects where filter_value = 'all' or is_hidden = (filter_value = 'hidden');
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into items from (
      select id, client_id, title, status, is_hidden, created_at from public.projects
      where filter_value = 'all' or is_hidden = (filter_value = 'hidden')
      order by created_at desc, id desc limit 20 offset page_offset
    ) x;
  elsif resource = 'services' then
    select count(*) into total from public.provider_service_listings where filter_value = 'all' or is_hidden = (filter_value = 'hidden');
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into items from (
      select id, provider_id, title, status, is_hidden, created_at from public.provider_service_listings
      where filter_value = 'all' or is_hidden = (filter_value = 'hidden')
      order by created_at desc, id desc limit 20 offset page_offset
    ) x;
  else
    select count(*) into total from public.moderation_events;
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into items from (
      select * from public.moderation_events order by created_at desc, id desc limit 20 offset page_offset
    ) x;
  end if;
  return jsonb_build_object('items', items, 'totalCount', total, 'page', page_number, 'pageSize', 20);
end;
$$;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'projects', (select count(*) from public.projects),
    'services', (select count(*) from public.provider_service_listings),
    'hiddenProjects', (select count(*) from public.projects where is_hidden),
    'hiddenServices', (select count(*) from public.provider_service_listings where is_hidden),
    'pendingAuthDeletions', (select count(*) from public.account_moderation where status = 'deleted' and auth_deleted_at is null)
  );
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.admin_moderate_listing(text, uuid, text, text) from public, anon;
revoke all on function public.admin_moderate_user(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.admin_confirm_auth_deleted(uuid) from public, anon;
grant execute on function public.admin_moderate_listing(text, uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_user(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.admin_confirm_auth_deleted(uuid) to authenticated;
revoke all on function public.admin_list_records(text, integer, text), public.admin_overview() from public, anon;
grant execute on function public.admin_list_records(text, integer, text), public.admin_overview() to authenticated;

commit;
