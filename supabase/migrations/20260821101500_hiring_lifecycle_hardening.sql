-- Documents the hiring lifecycle DB changes that were first applied manually.
-- Scope: application lifecycle RPCs, marketplace visibility policies, messaging
-- write policies, and indexes required by pre-accept conversations.

begin;

create unique index if not exists conversations_application_id_unique_idx
  on public.conversations (application_id)
  where application_id is not null;

create unique index if not exists applications_project_provider_unique_idx
  on public.applications (project_id, provider_id);

create unique index if not exists applications_one_accepted_per_project_idx
  on public.applications (project_id)
  where status = 'accepted';

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);

create index if not exists conversations_client_updated_at_idx
  on public.conversations (client_id, updated_at desc);

create index if not exists conversations_provider_updated_at_idx
  on public.conversations (provider_id, updated_at desc);

create index if not exists applications_project_status_idx
  on public.applications (project_id, status);

create index if not exists applications_provider_created_at_idx
  on public.applications (provider_id, created_at desc);

create or replace function public.accept_project_application(target_application_id uuid)
returns table(
  application_id uuid,
  application_status public.application_status,
  conversation_id uuid
)
language plpgsql
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  selected_application record;
  selected_project record;
  already_accepted_application_id uuid;
  existing_conversation_id uuid;
  inserted_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  select
    a.id,
    a.project_id,
    a.provider_id,
    a.status
  into selected_application
  from public.applications a
  where a.id = target_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  select
    p.id,
    p.client_id,
    p.status
  into selected_project
  from public.projects p
  where p.id = selected_application.project_id
  for update;

  if not found then
    raise exception 'Project not found.';
  end if;

  if selected_project.client_id <> current_user_id then
    raise exception 'Application not found.';
  end if;

  if selected_project.status not in ('published', 'in_discussion') then
    raise exception 'This project is no longer accepting providers.';
  end if;

  if selected_application.status in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'This application can no longer be updated.';
  end if;

  select a.id
  into already_accepted_application_id
  from public.applications a
  where a.project_id = selected_application.project_id
    and a.status = 'accepted'
    and a.id <> selected_application.id
  limit 1
  for update;

  if already_accepted_application_id is not null then
    raise exception 'A provider has already been accepted for this project.';
  end if;

  select c.id
  into existing_conversation_id
  from public.conversations c
  where c.application_id = selected_application.id
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (
      application_id,
      project_id,
      client_id,
      provider_id
    )
    values (
      selected_application.id,
      selected_application.project_id,
      selected_project.client_id,
      selected_application.provider_id
    )
    on conflict (application_id) where application_id is not null
    do update set updated_at = public.conversations.updated_at
    returning id into inserted_conversation_id;

    existing_conversation_id := inserted_conversation_id;
  end if;

  update public.applications
  set status = 'accepted'
  where id = selected_application.id;

  update public.applications
  set status = 'rejected'
  where project_id = selected_application.project_id
    and id <> selected_application.id
    and status in ('pending', 'viewed', 'shortlisted');

  update public.projects
  set status = 'assigned'
  where id = selected_project.id;

  return query
  select
    selected_application.id,
    'accepted'::public.application_status,
    existing_conversation_id;
end;
$function$;

create or replace function public.reject_project_application(target_application_id uuid)
returns table(
  application_id uuid,
  application_status public.application_status,
  project_id uuid,
  project_status public.project_status
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  selected_application record;
  selected_project record;
  active_application_exists boolean;
  updated_project_status public.project_status;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  select
    a.id,
    a.project_id,
    a.provider_id,
    a.status
  into selected_application
  from public.applications a
  where a.id = target_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  select
    p.id,
    p.client_id,
    p.status
  into selected_project
  from public.projects p
  where p.id = selected_application.project_id
  for update;

  if not found then
    raise exception 'Project not found.';
  end if;

  if selected_project.client_id <> current_user_id then
    raise exception 'Application not found.';
  end if;

  if selected_application.status not in ('pending', 'viewed', 'shortlisted') then
    raise exception 'This application can no longer be rejected.';
  end if;

  update public.applications
  set status = 'rejected'
  where id = selected_application.id;

  updated_project_status := selected_project.status;

  if selected_project.status = 'in_discussion' then
    select exists (
      select 1
      from public.applications a
      where a.project_id = selected_project.id
        and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
    )
    into active_application_exists;

    if not active_application_exists then
      update public.projects
      set status = 'published'
      where id = selected_project.id
        and status = 'in_discussion'
      returning status into updated_project_status;
    end if;
  end if;

  return query
  select
    selected_application.id,
    'rejected'::public.application_status,
    selected_project.id,
    updated_project_status;
end;
$function$;

create or replace function public.withdraw_project_application(target_application_id uuid)
returns table(
  application_id uuid,
  application_status public.application_status,
  project_id uuid,
  project_status public.project_status
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  selected_application record;
  selected_project record;
  active_application_exists boolean;
  updated_project_status public.project_status;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  select
    a.id,
    a.project_id,
    a.provider_id,
    a.status
  into selected_application
  from public.applications a
  where a.id = target_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if selected_application.provider_id <> current_user_id then
    raise exception 'Application not found.';
  end if;

  if selected_application.status not in ('pending', 'viewed', 'shortlisted') then
    raise exception 'This application can no longer be withdrawn.';
  end if;

  select
    p.id,
    p.client_id,
    p.status
  into selected_project
  from public.projects p
  where p.id = selected_application.project_id
  for update;

  if not found then
    raise exception 'Project not found.';
  end if;

  update public.applications
  set status = 'withdrawn'
  where id = selected_application.id;

  updated_project_status := selected_project.status;

  if selected_project.status = 'in_discussion' then
    select exists (
      select 1
      from public.applications a
      where a.project_id = selected_project.id
        and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
    )
    into active_application_exists;

    if not active_application_exists then
      update public.projects
      set status = 'published'
      where id = selected_project.id
        and status = 'in_discussion'
      returning status into updated_project_status;
    end if;
  end if;

  return query
  select
    selected_application.id,
    'withdrawn'::public.application_status,
    selected_project.id,
    updated_project_status;
end;
$function$;

grant execute on function public.accept_project_application(uuid) to authenticated;
grant execute on function public.reject_project_application(uuid) to authenticated;
grant execute on function public.withdraw_project_application(uuid) to authenticated;

alter table public.projects enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Published projects are readable by everyone" on public.projects;
drop policy if exists "Visible marketplace projects are readable by everyone" on public.projects;
drop policy if exists "projects_select_published_or_own" on public.projects;
drop policy if exists "projects_select_visible_or_own" on public.projects;
drop policy if exists "Projects are readable by owner admin or providers when publishe" on public.projects;
drop policy if exists "Projects are readable by owner admin or providers when visible" on public.projects;

create policy "Visible marketplace projects are readable by everyone"
on public.projects
for select
to anon, authenticated
using (status in ('published', 'in_discussion'));

create policy "projects_select_visible_or_own"
on public.projects
for select
to authenticated
using (
  status in ('published', 'in_discussion')
  or client_id = auth.uid()
);

create policy "Projects are readable by owner admin or providers when visible"
on public.projects
for select
to authenticated
using (
  client_id = auth.uid()
  or public.is_admin()
  or (
    status in ('published', 'in_discussion')
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
    )
  )
);

drop policy if exists "Applications are insertable by provider or admin" on public.applications;
drop policy if exists "applications_insert_provider_own" on public.applications;
drop policy if exists "applications_insert_provider_open_project" on public.applications;

create policy "applications_insert_provider_open_project"
on public.applications
for insert
to authenticated
with check (
  (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'provider'
    )
    and exists (
      select 1
      from public.projects p
      where p.id = applications.project_id
        and p.status in ('published', 'in_discussion')
        and p.client_id <> auth.uid()
    )
  )
  or public.is_admin()
);

drop policy if exists "Applications are updatable by provider project owner or admin" on public.applications;
drop policy if exists "applications_update_provider_or_project_owner" on public.applications;
drop policy if exists "applications_update_client_owner_or_admin" on public.applications;
drop policy if exists "applications_update_provider_withdraw_own" on public.applications;

create policy "applications_update_client_owner_or_admin"
on public.applications
for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.projects p
    where p.id = applications.project_id
      and p.client_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.projects p
    where p.id = applications.project_id
      and p.client_id = auth.uid()
  )
);

create policy "applications_update_provider_withdraw_own"
on public.applications
for update
to authenticated
using (
  provider_id = auth.uid()
  and status in ('pending', 'viewed', 'shortlisted')
)
with check (
  provider_id = auth.uid()
  and status = 'withdrawn'
);

drop policy if exists "Conversations are insertable by participants or admin" on public.conversations;
drop policy if exists "conversations_insert_participants_only" on public.conversations;
drop policy if exists "conversations_insert_valid_application_client" on public.conversations;
drop policy if exists "conversations_insert_valid_application_participant" on public.conversations;

create policy "conversations_insert_valid_application_participant"
on public.conversations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.applications a
    join public.projects p on p.id = a.project_id
    where a.id = conversations.application_id
      and conversations.project_id = a.project_id
      and conversations.provider_id = a.provider_id
      and conversations.client_id = p.client_id
      and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
      and (
        conversations.client_id = auth.uid()
        or conversations.provider_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "Messages are insertable by sender participant or admin" on public.messages;
drop policy if exists "messages_insert_sender_in_conversation" on public.messages;
drop policy if exists "messages_insert_active_conversation_participant" on public.messages;

create policy "messages_insert_active_conversation_participant"
on public.messages
for insert
to authenticated
with check (
  (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      join public.applications a on a.id = c.application_id
      where c.id = messages.conversation_id
        and (
          c.client_id = auth.uid()
          or c.provider_id = auth.uid()
        )
        and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
    )
  )
  or (
    public.is_admin()
    and exists (
      select 1
      from public.conversations c
      join public.applications a on a.id = c.application_id
      where c.id = messages.conversation_id
        and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
    )
  )
);

commit;
