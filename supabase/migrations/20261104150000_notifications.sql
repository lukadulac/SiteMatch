-- Notification outbox: one row per event, for the person it concerns.
--
-- Rows are written in the same transaction as the event, by triggers that run as
-- the table owner. This first step covers the two events that start a hire:
--   application_received      a provider applied to a client's brief (to the client)
--   service_request_received  a client requested a provider's service (to the provider)
-- New service requests only ever come from request_provider_service (insert is
-- revoked from users), so a trigger on provider_service_requests fires exactly
-- there. The remaining events follow with the inbox.
--
-- A user reads their own notifications and can only change read_at. Nobody writes
-- rows directly; emailed_at is for the email dispatcher, which uses the service role.

begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_type_check check (type in (
    'application_received',
    'service_request_received'
  )),
  constraint notifications_entity_type_check check (entity_type in (
    'project',
    'service_request'
  )),
  constraint notifications_title_length_check check (char_length(title) between 1 and 300)
);

create index notifications_user_created_at_idx
  on public.notifications(user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications(user_id)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Events -------------------------------------------------------------------------

create function private.notify_application_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  brief record;
  applicant_name text;
begin
  select p.client_id, p.title into brief
  from public.projects p
  where p.id = new.project_id;

  if not found then
    return new;
  end if;

  select coalesce(nullif(btrim(pr.full_name), ''), 'A provider') into applicant_name
  from public.profiles pr
  where pr.id = new.provider_id;

  insert into public.notifications (user_id, type, entity_type, entity_id, title)
  values (
    brief.client_id,
    'application_received',
    'project',
    new.project_id,
    left(format('%s applied to %s', coalesce(applicant_name, 'A provider'), brief.title), 300)
  );

  return new;
end;
$function$;

create trigger notifications_application_received
  after insert on public.applications
  for each row execute function private.notify_application_received();

create function private.notify_service_request_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  client_name text;
  service_title text;
begin
  select coalesce(nullif(btrim(pr.full_name), ''), 'A client') into client_name
  from public.profiles pr
  where pr.id = new.client_id;

  select s.title into service_title
  from public.provider_service_listings s
  where s.id = new.service_id;

  insert into public.notifications (user_id, type, entity_type, entity_id, title)
  values (
    new.provider_id,
    'service_request_received',
    'service_request',
    new.id,
    left(format('%s requested %s', coalesce(client_name, 'A client'), coalesce(service_title, 'your service')), 300)
  );

  return new;
end;
$function$;

create trigger notifications_service_request_received
  after insert on public.provider_service_requests
  for each row execute function private.notify_service_request_received();

revoke all on function private.notify_application_received() from public, anon, authenticated;
revoke all on function private.notify_service_request_received() from public, anon, authenticated;

commit;
