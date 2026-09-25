-- Adds service request conversations, atomic request creation, and request decisions.

begin;

do $$
begin
  if exists (
    select 1
    from public.provider_service_requests
    group by service_id, client_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add global service request uniqueness: duplicate service/client requests exist.';
  end if;
end $$;

alter table public.provider_service_requests
  drop constraint if exists provider_service_requests_service_id_fkey;

alter table public.provider_service_requests
  add constraint provider_service_requests_service_id_fkey
  foreign key (service_id)
  references public.provider_service_listings(id)
  on delete restrict;

drop index if exists public.provider_service_requests_one_active_per_client_service_idx;

create unique index if not exists provider_service_requests_client_service_unique_idx
  on public.provider_service_requests(service_id, client_id);

alter table public.conversations
  alter column project_id drop not null,
  add column if not exists service_request_id uuid;

do $$
begin
  alter table public.conversations
    add constraint conversations_service_request_id_fkey
    foreign key (service_request_id)
    references public.provider_service_requests(id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.conversations
    add constraint conversations_kind_check
    check (
      (
        service_request_id is null
        and project_id is not null
      )
      or
      (
        service_request_id is not null
        and project_id is null
        and application_id is null
      )
    );
exception
  when duplicate_object then null;
end $$;

create unique index if not exists conversations_service_request_id_unique_idx
  on public.conversations(service_request_id)
  where service_request_id is not null;

create index if not exists conversations_service_request_id_idx
  on public.conversations(service_request_id)
  where service_request_id is not null;

create or replace function public.validate_service_request_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  linked_request record;
begin
  if new.service_request_id is null then
    return new;
  end if;

  select
    r.client_id,
    r.provider_id
  into linked_request
  from public.provider_service_requests r
  where r.id = new.service_request_id;

  if not found then
    raise exception 'Service request not found.';
  end if;

  if new.client_id <> linked_request.client_id
    or new.provider_id <> linked_request.provider_id then
    raise exception 'Conversation participants must match the service request.';
  end if;

  return new;
end;
$function$;

drop trigger if exists conversations_validate_service_request
  on public.conversations;

create trigger conversations_validate_service_request
before insert or update on public.conversations
for each row
execute function public.validate_service_request_conversation();

create or replace function public.request_provider_service(
  target_service_id uuid,
  request_message text
)
returns table (
  request_id uuid,
  request_status public.provider_service_request_status,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_message text := trim(regexp_replace(coalesce(request_message, ''), '[[:space:]]+', ' ', 'g'));
  current_user_role public.user_role;
  selected_service record;
  inserted_request_id uuid;
  inserted_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  select p.role
  into current_user_role
  from public.profiles p
  where p.id = current_user_id;

  if current_user_role is distinct from 'client'::public.user_role then
    raise exception 'Only clients can request provider services.';
  end if;

  if char_length(normalized_message) < 10
    or char_length(normalized_message) > 2000 then
    raise exception 'Message must be between 10 and 2000 characters long.';
  end if;

  select
    s.id,
    s.provider_id,
    s.status
  into selected_service
  from public.provider_service_listings s
  where s.id = target_service_id;

  if not found or selected_service.status <> 'published'::public.provider_service_listing_status then
    raise exception 'Service is not available for requests.';
  end if;

  if selected_service.provider_id = current_user_id then
    raise exception 'You cannot request your own service.';
  end if;

  insert into public.provider_service_requests (
    service_id,
    client_id,
    provider_id,
    status,
    message
  )
  values (
    selected_service.id,
    current_user_id,
    selected_service.provider_id,
    'pending'::public.provider_service_request_status,
    normalized_message
  )
  returning id into inserted_request_id;

  insert into public.conversations (
    service_request_id,
    project_id,
    application_id,
    client_id,
    provider_id
  )
  values (
    inserted_request_id,
    null,
    null,
    current_user_id,
    selected_service.provider_id
  )
  returning id into inserted_conversation_id;

  insert into public.messages (
    conversation_id,
    sender_id,
    message_text
  )
  values (
    inserted_conversation_id,
    current_user_id,
    normalized_message
  );

  return query
  select
    inserted_request_id,
    'pending'::public.provider_service_request_status,
    inserted_conversation_id;
exception
  when unique_violation then
    raise exception 'You already requested this service.';
end;
$function$;

create or replace function public.accept_provider_service_request(
  target_request_id uuid
)
returns table (
  request_id uuid,
  request_status public.provider_service_request_status,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  updated_request record;
  linked_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  update public.provider_service_requests r
  set status = 'accepted'::public.provider_service_request_status
  where r.id = target_request_id
    and r.provider_id = current_user_id
    and r.status = 'pending'::public.provider_service_request_status
  returning r.id, r.status
  into updated_request;

  if not found then
    raise exception 'Service request could not be accepted.';
  end if;

  select c.id
  into linked_conversation_id
  from public.conversations c
  where c.service_request_id = updated_request.id;

  return query
  select updated_request.id, updated_request.status, linked_conversation_id;
end;
$function$;

create or replace function public.reject_provider_service_request(
  target_request_id uuid
)
returns table (
  request_id uuid,
  request_status public.provider_service_request_status,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  updated_request record;
  linked_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  update public.provider_service_requests r
  set status = 'rejected'::public.provider_service_request_status
  where r.id = target_request_id
    and r.provider_id = current_user_id
    and r.status = 'pending'::public.provider_service_request_status
  returning r.id, r.status
  into updated_request;

  if not found then
    raise exception 'Service request could not be rejected.';
  end if;

  select c.id
  into linked_conversation_id
  from public.conversations c
  where c.service_request_id = updated_request.id;

  return query
  select updated_request.id, updated_request.status, linked_conversation_id;
end;
$function$;

create or replace function public.cancel_provider_service_request(
  target_request_id uuid
)
returns table (
  request_id uuid,
  request_status public.provider_service_request_status,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  updated_request record;
  linked_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  update public.provider_service_requests r
  set status = 'cancelled'::public.provider_service_request_status
  where r.id = target_request_id
    and r.client_id = current_user_id
    and r.status = 'pending'::public.provider_service_request_status
  returning r.id, r.status
  into updated_request;

  if not found then
    raise exception 'Service request could not be cancelled.';
  end if;

  select c.id
  into linked_conversation_id
  from public.conversations c
  where c.service_request_id = updated_request.id;

  return query
  select updated_request.id, updated_request.status, linked_conversation_id;
end;
$function$;

revoke all on function public.request_provider_service(uuid, text) from public;
revoke all on function public.accept_provider_service_request(uuid) from public;
revoke all on function public.reject_provider_service_request(uuid) from public;
revoke all on function public.cancel_provider_service_request(uuid) from public;

grant execute on function public.request_provider_service(uuid, text) to authenticated;
grant execute on function public.accept_provider_service_request(uuid) to authenticated;
grant execute on function public.reject_provider_service_request(uuid) to authenticated;
grant execute on function public.cancel_provider_service_request(uuid) to authenticated;

with inserted_conversations as (
  insert into public.conversations (
    service_request_id,
    project_id,
    application_id,
    client_id,
    provider_id,
    created_at,
    updated_at
  )
  select
    r.id,
    null,
    null,
    r.client_id,
    r.provider_id,
    r.created_at,
    r.updated_at
  from public.provider_service_requests r
  where not exists (
    select 1
    from public.conversations c
    where c.service_request_id = r.id
  )
  returning id, service_request_id, client_id, created_at
)
insert into public.messages (
  conversation_id,
  sender_id,
  message_text,
  created_at
)
select
  c.id,
  c.client_id,
  r.message,
  c.created_at
from inserted_conversations c
join public.provider_service_requests r
  on r.id = c.service_request_id;

drop policy if exists "Service requests are updatable by participants"
  on public.provider_service_requests;
drop policy if exists "Service requests are deletable by participants"
  on public.provider_service_requests;

drop policy if exists "Conversations are insertable by participants or admin"
  on public.conversations;
drop policy if exists "conversations_insert_participants_only"
  on public.conversations;
drop policy if exists "conversations_insert_valid_application_client"
  on public.conversations;

create policy "Conversations are insertable for valid service requests"
on public.conversations
for insert
to authenticated
with check (
  (
    service_request_id is null
    and (
      client_id = auth.uid()
      or provider_id = auth.uid()
      or public.is_admin()
    )
  )
  or
  exists (
    select 1
    from public.provider_service_requests r
    where r.id = conversations.service_request_id
      and r.client_id = conversations.client_id
      and r.provider_id = conversations.provider_id
      and (
        r.client_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "Messages are insertable by sender participant or admin"
  on public.messages;
drop policy if exists "messages_insert_sender_in_conversation"
  on public.messages;
drop policy if exists "messages_insert_active_conversation_participant"
  on public.messages;

create policy "Messages are insertable in valid conversations"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.client_id = auth.uid()
        or c.provider_id = auth.uid()
      )
      and (
        exists (
          select 1
          from public.applications a
          where a.id = c.application_id
            and a.status in (
              'pending'::public.application_status,
              'viewed'::public.application_status,
              'shortlisted'::public.application_status,
              'accepted'::public.application_status
            )
        )
        or exists (
          select 1
          from public.provider_service_requests r
          where r.id = c.service_request_id
        )
      )
  )
);

commit;
