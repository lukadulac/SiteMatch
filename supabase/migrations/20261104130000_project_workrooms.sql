-- Give project hires the same workroom service requests already have.
--
-- A workroom now has exactly one source: a service request (service_request_id and
-- service_id, as before) or an accepted project application (application_id and
-- project_id). accept_project_application opens the workroom in the same transaction
-- that accepts the application, and returns its id alongside the conversation.
-- Briefs that were assigned before this migration get their workroom from the
-- backfill below (it only adds rows).
--
-- Service-request workrooms are unchanged: their columns, RPCs and policies stay as
-- they were. Completing a project workroom is the next migration's job.

begin;

alter table public.service_workrooms
  alter column service_request_id drop not null,
  alter column service_id drop not null,
  add column application_id uuid references public.applications(id) on delete restrict,
  add column project_id uuid references public.projects(id) on delete restrict;

alter table public.service_workrooms
  add constraint service_workrooms_single_source_check check (
    (
      service_request_id is not null and service_id is not null
      and application_id is null and project_id is null
    )
    or (
      service_request_id is null and service_id is null
      and application_id is not null and project_id is not null
    )
  );

-- One workroom per hire, and a brief is only ever hired once.
create unique index service_workrooms_application_id_key
  on public.service_workrooms(application_id);

create unique index service_workrooms_project_id_key
  on public.service_workrooms(project_id);

-- Backfill: briefs already assigned get an active workroom for their accepted application.
insert into public.service_workrooms (
  application_id,
  project_id,
  client_id,
  provider_id,
  status,
  accepted_at,
  created_at,
  updated_at
)
select
  a.id,
  p.id,
  p.client_id,
  a.provider_id,
  'active'::public.service_workroom_status,
  a.updated_at,
  a.updated_at,
  a.updated_at
from public.projects p
join public.applications a on a.project_id = p.id and a.status = 'accepted'
where p.status = 'assigned'
  and p.client_id <> a.provider_id
  and not exists (
    select 1 from public.service_workrooms w where w.application_id = a.id
  );

-- The return type gains workroom_id, so the function is dropped and recreated.
drop function public.accept_project_application(uuid);

create function public.accept_project_application(target_application_id uuid)
returns table (
  application_id uuid,
  application_status public.application_status,
  conversation_id uuid,
  workroom_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  selected_application record;
  selected_project record;
  already_accepted_application_id uuid;
  existing_conversation_id uuid;
  linked_workroom_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  if not exists (
    select 1
    from public.applications a
    join public.projects p on p.id = a.project_id
    where a.id = target_application_id
      and p.client_id = current_user_id
  ) then
    raise exception 'Application not found.';
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

  if selected_project.client_id is distinct from current_user_id then
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
    and c.client_id = selected_project.client_id
    and c.provider_id = selected_application.provider_id
    and c.project_id = selected_application.project_id
  limit 1;

  if existing_conversation_id is null then
    begin
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
      returning id into existing_conversation_id;
    exception
      when unique_violation then
        select c.id
        into existing_conversation_id
        from public.conversations c
        where c.application_id = selected_application.id
          and c.client_id = selected_project.client_id
          and c.provider_id = selected_application.provider_id
          and c.project_id = selected_application.project_id
        limit 1;
    end;

    if existing_conversation_id is null then
      raise exception 'A conversation could not be opened for this application.';
    end if;
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

  insert into public.service_workrooms (
    application_id,
    project_id,
    client_id,
    provider_id,
    status
  )
  values (
    selected_application.id,
    selected_application.project_id,
    selected_project.client_id,
    selected_application.provider_id,
    'active'::public.service_workroom_status
  )
  returning id into linked_workroom_id;

  return query
  select
    selected_application.id,
    'accepted'::public.application_status,
    existing_conversation_id,
    linked_workroom_id;
end;
$function$;

revoke all on function public.accept_project_application(uuid) from public, anon;
grant execute on function public.accept_project_application(uuid) to authenticated;

commit;
