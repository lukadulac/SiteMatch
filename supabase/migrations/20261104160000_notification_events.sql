-- The rest of the hiring events, written by triggers in the same transaction.
--
--   application_accepted      a client hired a provider (to the provider, links the workroom)
--   application_rejected      an application was declined, also when another provider was
--                             hired or the brief was cancelled (to the provider)
--   service_request_accepted  a provider accepted a request (to the client, links the workroom)
--   service_request_rejected  a provider declined a request (to the client)
--   workroom_completed        the provider completed the work (to the client)
--
-- Acceptances are written when the workroom opens, so the notification can point at it.
-- An accept that finds its workroom already there (accept_provider_service_request's
-- on conflict path) opens nothing and notifies nothing. "Review received" waits for
-- reviews to exist.

begin;

alter table public.notifications
  drop constraint notifications_type_check,
  drop constraint notifications_entity_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'application_received',
    'application_accepted',
    'application_rejected',
    'service_request_received',
    'service_request_accepted',
    'service_request_rejected',
    'workroom_completed'
  )),
  add constraint notifications_entity_type_check check (entity_type in (
    'project',
    'application',
    'service_request',
    'workroom'
  ));

-- Display name of a profile, for notification titles.
create function private.notification_name(person uuid, fallback text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = person),
    fallback
  );
$function$;

-- What a workroom is about: the brief's title or the service's.
create function private.workroom_subject(target public.service_workrooms)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (select p.title from public.projects p where p.id = target.project_id),
    (select s.title from public.provider_service_listings s where s.id = target.service_id),
    'your project'
  );
$function$;

create function private.notify_workroom_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.application_id is not null then
    insert into public.notifications (user_id, type, entity_type, entity_id, title)
    values (
      new.provider_id,
      'application_accepted',
      'workroom',
      new.id,
      left(format('%s hired you for %s',
        private.notification_name(new.client_id, 'A client'),
        private.workroom_subject(new)), 300)
    );
  elsif new.service_request_id is not null then
    insert into public.notifications (user_id, type, entity_type, entity_id, title)
    values (
      new.client_id,
      'service_request_accepted',
      'workroom',
      new.id,
      left(format('%s accepted your request for %s',
        private.notification_name(new.provider_id, 'The provider'),
        private.workroom_subject(new)), 300)
    );
  end if;

  return new;
end;
$function$;

create trigger notifications_workroom_opened
  after insert on public.service_workrooms
  for each row execute function private.notify_workroom_opened();

create function private.notify_workroom_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.notifications (user_id, type, entity_type, entity_id, title)
  values (
    new.client_id,
    'workroom_completed',
    'workroom',
    new.id,
    left(format('%s marked %s completed',
      private.notification_name(new.provider_id, 'The provider'),
      private.workroom_subject(new)), 300)
  );

  return new;
end;
$function$;

create trigger notifications_workroom_completed
  after update of status on public.service_workrooms
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function private.notify_workroom_completed();

create function private.notify_application_rejected()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  brief_title text;
begin
  select p.title into brief_title
  from public.projects p
  where p.id = new.project_id;

  insert into public.notifications (user_id, type, entity_type, entity_id, title)
  values (
    new.provider_id,
    'application_rejected',
    'application',
    new.id,
    left(format('Your application to %s was not selected', coalesce(brief_title, 'a brief')), 300)
  );

  return new;
end;
$function$;

create trigger notifications_application_rejected
  after update of status on public.applications
  for each row
  when (new.status = 'rejected' and old.status is distinct from 'rejected')
  execute function private.notify_application_rejected();

create function private.notify_service_request_rejected()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  service_title text;
begin
  select s.title into service_title
  from public.provider_service_listings s
  where s.id = new.service_id;

  insert into public.notifications (user_id, type, entity_type, entity_id, title)
  values (
    new.client_id,
    'service_request_rejected',
    'service_request',
    new.id,
    left(format('%s declined your request for %s',
      private.notification_name(new.provider_id, 'The provider'),
      coalesce(service_title, 'their service')), 300)
  );

  return new;
end;
$function$;

create trigger notifications_service_request_rejected
  after update of status on public.provider_service_requests
  for each row
  when (new.status = 'rejected' and old.status is distinct from 'rejected')
  execute function private.notify_service_request_rejected();

revoke all on function private.notification_name(uuid, text) from public, anon, authenticated;
revoke all on function private.workroom_subject(public.service_workrooms) from public, anon, authenticated;
revoke all on function private.notify_workroom_opened() from public, anon, authenticated;
revoke all on function private.notify_workroom_completed() from public, anon, authenticated;
revoke all on function private.notify_application_rejected() from public, anon, authenticated;
revoke all on function private.notify_service_request_rejected() from public, anon, authenticated;

commit;
